import { describe, expect, it } from 'vitest';

import { DEFAULT_CADENCE_CONFIG } from 'src/engine';
import { planConvergence } from 'src/sync/touch-plan';
import { localHourIn, toDateOnly, todayIn } from 'src/utils/civil-date';
import {
  decidePersonEdit,
  decideTouchesCreated,
  isEngineWrite,
  type PersonEdit,
} from 'src/utils/edit-decisions';
import {
  buildSuppressionIndex,
  isSuppressed,
  missingSuppressions,
  normalizeEmail,
  normalizeLinkedinUrl,
  personIdentity,
} from 'src/utils/normalize-identity';
import {
  computePersonCadence,
  diffPersonUpdate,
  engineNextActionDate,
  lastTouchOn,
  type PersonRecord,
  prepareTouches,
  toCadenceContact,
  type TouchRecord,
} from 'src/utils/person-cadence';

const CONFIG = DEFAULT_CADENCE_CONFIG;
// Thursday.
const TODAY = '2026-10-15';

const person = (overrides: Partial<PersonRecord> = {}): PersonRecord => ({
  id: 'p1',
  name: { firstName: 'Aditi', lastName: 'Rajvanshi' },
  emails: { primaryEmail: 'aditi@example.com', additionalEmails: [] },
  linkedinLink: { primaryLinkUrl: 'https://www.linkedin.com/in/aditi/' },
  cadenceOwnerId: 'owner-a',
  cadenceOwnerSince: null,
  cadenceStage: 'NOT_CONTACTED',
  cadenceHealth: 'ACTIVE',
  nextActionDate: null,
  nextActionDateOverride: null,
  snoozeUntil: null,
  revisitDate: null,
  optedOut: false,
  optOutReason: null,
  cadenceResumedAt: null,
  ...overrides,
});

let touchCounter = 0;

const touch = (
  occurredOn: string,
  channel: string,
  direction = 'OUTBOUND',
  overrides: Partial<TouchRecord> = {},
): TouchRecord => {
  touchCounter += 1;

  return {
    id: `t${touchCounter}`,
    personId: 'p1',
    channel,
    direction,
    outcome: null,
    occurredOn,
    source: 'MANUAL',
    createdAt: `2026-10-01T00:00:${String(touchCounter).padStart(2, '0')}Z`,
    deletedAt: null,
    ...overrides,
  };
};

const compute = (subject: PersonRecord, touches: TouchRecord[], suppressed = false) =>
  computePersonCadence({
    person: subject,
    touches,
    config: CONFIG,
    today: TODAY,
    suppressed,
  });

describe('person to engine contact (SPEC §2)', () => {
  it('maps stored values and presence rules', () => {
    const { contact, problems } = toCadenceContact(
      person({
        cadenceStage: 'DECK_SENT',
        cadenceHealth: 'HOLD',
        snoozeUntil: '2026-10-20',
        revisitDate: '2026-11-01T00:00:00.000Z',
      }),
      { suppressed: false },
    );

    expect(problems).toEqual([]);
    expect(contact).toEqual({
      stage: 'deckSent',
      health: 'hold',
      hasOwner: true,
      ownerSince: null,
      hasEmail: true,
      hasLinkedinUrl: true,
      optedOut: false,
      cadenceResumedAt: null,
      snoozeUntil: '2026-10-20',
      revisitDate: '2026-11-01',
      nextActionDateOverride: null,
    });
  });

  it('uses only the primary email and primary LinkedIn URL for presence', () => {
    const { contact } = toCadenceContact(
      person({
        emails: { primaryEmail: '  ', additionalEmails: ['x@example.com'] },
        linkedinLink: { primaryLinkUrl: '', secondaryLinks: [{ url: 'linkedin.com/in/x' }] },
        cadenceOwnerId: null,
      }),
      { suppressed: false },
    );

    expect(contact.hasEmail).toBe(false);
    expect(contact.hasLinkedinUrl).toBe(false);
    expect(contact.hasOwner).toBe(false);
  });

  it('treats a suppression match as opted out', () => {
    expect(toCadenceContact(person(), { suppressed: true }).contact.optedOut).toBe(true);
  });

  it('reports and defaults unknown stage and health', () => {
    const { contact, problems } = toCadenceContact(
      person({ cadenceStage: null, cadenceHealth: 'WEIRD' }),
      { suppressed: false },
    );

    expect(contact.stage).toBe('notContacted');
    expect(contact.health).toBe('active');
    expect(problems).toHaveLength(2);
  });
});

describe('prepareTouches', () => {
  it('uses manual logging time for a fresh-owner cutoff without treating sync import time as message time', () => {
    const { touches } = prepareTouches([
      touch(TODAY, 'WHATSAPP', 'INBOUND', { createdAt: '2026-10-15T14:00:00Z' }),
      touch(TODAY, 'EMAIL', 'INBOUND', { source: 'GMAIL', createdAt: '2026-10-15T16:00:00Z' }),
    ], TODAY, CONFIG, '2026-10-15T12:00:00Z');

    expect(touches[0]).toMatchObject({ recordedAtInstant: '2026-10-15T14:00:00.000Z' });
    expect(touches[1]).not.toHaveProperty('recordedAtInstant');
  });

  it('keeps precise email order separate from the persisted cadence day', () => {
    const { touches } = prepareTouches([
      touch(TODAY, 'EMAIL', 'INBOUND', { source: 'GMAIL', occurredAt: '2026-10-15T14:00:00+01:00' }),
    ], TODAY, CONFIG);

    expect(touches).toEqual([{
      channel: 'email', direction: 'inbound', outcome: null, occurredAt: TODAY,
      occurredAtInstant: '2026-10-15T13:00:00.000Z',
    }]);
  });

  it('lends synced precision to the manual twin without consuming another step', () => {
    const { touches, ignored } = prepareTouches([
      touch(TODAY, 'EMAIL'),
      touch(TODAY, 'EMAIL', 'OUTBOUND', { source: 'GMAIL', occurredAt: '2026-10-15T09:00:00Z' }),
    ], TODAY, CONFIG);

    expect(touches).toHaveLength(1);
    expect(touches[0]).toMatchObject({ occurredAt: TODAY, occurredAtInstant: '2026-10-15T09:00:00.000Z' });
    expect(ignored).toHaveLength(1);
  });

  it('falls back to the stored day when exact time is absent or malformed', () => {
    const { touches } = prepareTouches([
      touch(TODAY, 'EMAIL', 'OUTBOUND', { source: 'GMAIL', occurredAt: 'invalid' }),
    ], TODAY, CONFIG);

    expect(touches[0]).toEqual({ channel: 'email', direction: 'outbound', outcome: null, occurredAt: TODAY });
  });

  it('ignores deleted, undated, channel-less and future touches, with reasons', () => {
    const records = [
      touch('2026-10-14', 'EMAIL'),
      touch('2026-10-14', 'EMAIL', 'OUTBOUND', { deletedAt: '2026-10-14T10:00:00Z' }),
      touch('2026-10-16', 'EMAIL'),
      touch('', 'EMAIL', 'OUTBOUND', { occurredOn: null }),
      touch('2026-10-14', 'EMAIL', 'OUTBOUND', { channel: null }),
    ];
    const { touches, ignored } = prepareTouches(records, TODAY, CONFIG);

    expect(touches).toEqual([
      { channel: 'email', direction: 'outbound', outcome: null, occurredAt: '2026-10-14' },
    ]);
    expect(ignored.map((entry) => entry.touchId)).toEqual([
      records[2].id,
      records[3].id,
      records[4].id,
    ]);
    expect(ignored[0].reason).toMatch(/future/);
  });

  it('orders by day, then by when they were logged', () => {
    const later = touch('2026-10-13', 'EMAIL', 'INBOUND', { createdAt: '2026-10-13T12:00:00Z' });
    const earlier = touch('2026-10-13', 'EMAIL', 'OUTBOUND', { createdAt: '2026-10-13T09:00:00Z' });
    const first = touch('2026-10-12', 'LINKEDIN_MESSAGE');

    expect(
      prepareTouches([later, earlier, first], TODAY, CONFIG).touches.map(
        (entry) => `${entry.occurredAt} ${entry.channel} ${entry.direction}`,
      ),
    ).toEqual([
      '2026-10-12 linkedinMessage outbound',
      '2026-10-13 email outbound',
      '2026-10-13 email inbound',
    ]);
  });

  it('counts a manual touch and a synced twin once, keeping the synced outcome', () => {
    const manual = touch('2026-10-13', 'EMAIL');
    const synced = touch('2026-10-13', 'EMAIL', 'OUTBOUND', {
      source: 'GMAIL',
      outcome: 'BOUNCED',
    });
    const syncedOnly = touch('2026-10-14', 'EMAIL', 'OUTBOUND', { source: 'GMAIL' });
    const { touches, ignored } = prepareTouches([manual, synced, syncedOnly], TODAY, CONFIG);

    expect(touches).toEqual([
      { channel: 'email', direction: 'outbound', outcome: 'bounced', occurredAt: '2026-10-13' },
      { channel: 'email', direction: 'outbound', outcome: null, occurredAt: '2026-10-14' },
    ]);
    expect(ignored).toEqual([
      { touchId: synced.id, reason: `duplicate of manual touch ${manual.id}` },
    ]);
  });

  it('keeps two manual touches of the same kind on one day', () => {
    expect(
      prepareTouches(
        [touch('2026-10-13', 'EMAIL'), touch('2026-10-13', 'EMAIL')],
        TODAY,
        CONFIG,
      ).touches,
    ).toHaveLength(2);
  });
});

describe('same-day synced email reply status', () => {
  const afterConvergence = (group: TouchRecord[]) => {
    const plan = planConvergence(group);

    return plan === null ? group : group
      .filter((record) => !plan.deleteIds.includes(record.id))
      .map((record) => record.id === plan.survivorId ? { ...record, ...plan.update } : record);
  };

  it('keeps a new manual reply after reset when an older synced copy is merged into it', () => {
    const subject = person({ cadenceOwnerSince: TODAY, cadenceReplyResetAt: '2026-10-15T12:00:00Z' });
    const inbound = [
      touch(TODAY, 'EMAIL', 'INBOUND', { source: 'MANUAL', createdAt: '2026-10-15T14:00:00Z' }),
      touch(TODAY, 'EMAIL', 'INBOUND', { source: 'GMAIL', occurredAt: '2026-10-15T09:00:00Z', createdAt: '2026-10-15T15:00:00Z' }),
    ];

    expect(compute(subject, inbound).fields.cadenceState).toBe('REPLY_OWED');
    expect(compute(subject, afterConvergence(inbound)).fields.cadenceState).toBe('REPLY_OWED');
  });

  it('uses a manual 4pm answer despite an older 9am synced email in the same daily group', () => {
    const inbound = touch(TODAY, 'EMAIL', 'INBOUND', { source: 'GMAIL', occurredAt: '2026-10-15T14:00:00Z' });
    const outbound = [
      touch(TODAY, 'EMAIL', 'OUTBOUND', { source: 'MANUAL', createdAt: '2026-10-15T16:00:00Z' }),
      touch(TODAY, 'EMAIL', 'OUTBOUND', { source: 'GMAIL', occurredAt: '2026-10-15T09:00:00Z' }),
    ];

    expect(compute(person(), [inbound, ...outbound]).fields.cadenceState).toBe('IN_CONVERSATION');
    expect(compute(person(), [inbound, ...afterConvergence(outbound)]).fields.cadenceState).toBe('IN_CONVERSATION');
  });

  it('retains the latest manual action when convergence keeps an earlier manual survivor', () => {
    const inbound = touch(TODAY, 'EMAIL', 'INBOUND', { source: 'GMAIL', occurredAt: '2026-10-15T14:00:00Z' });
    const outbound = [
      touch(TODAY, 'EMAIL', 'OUTBOUND', { source: 'MANUAL', createdAt: '2026-10-15T08:00:00Z' }),
      touch(TODAY, 'EMAIL', 'OUTBOUND', { source: 'MANUAL', createdAt: '2026-10-15T16:00:00Z' }),
      touch(TODAY, 'EMAIL', 'OUTBOUND', { source: 'GMAIL', occurredAt: '2026-10-15T09:00:00Z' }),
    ];

    const converged = afterConvergence(outbound);
    expect(converged).toHaveLength(2);
    expect(compute(person(), [inbound, ...outbound]).fields.cadenceState).toBe('IN_CONVERSATION');
    expect(compute(person(), [inbound, ...converged]).fields.cadenceState).toBe('IN_CONVERSATION');
  });

  it('does not invent an exact time for a manual entry dated before its logging day', () => {
    const { touches } = prepareTouches([
      touch('2026-10-14', 'EMAIL', 'OUTBOUND', { createdAt: '2026-10-15T16:00:00Z' }),
    ], TODAY, CONFIG);

    expect(touches[0]).not.toHaveProperty('occurredAtInstant');
  });

  it('uses the cadence time zone when deciding whether a manual entry was logged on its day', () => {
    const { touches } = prepareTouches([
      touch(TODAY, 'EMAIL', 'OUTBOUND', { createdAt: '2026-10-14T23:30:00Z' }),
    ], TODAY, CONFIG);

    expect(touches[0]).toMatchObject({ occurredAtInstant: '2026-10-14T23:30:00.000Z' });
  });

  it('owes a 2pm reply after a 9am email and clears it after a 4pm email', () => {
    const outbound = touch(TODAY, 'EMAIL', 'OUTBOUND', { source: 'GMAIL', occurredAt: '2026-10-15T09:00:00Z' });
    const inbound = touch(TODAY, 'EMAIL', 'INBOUND', { source: 'GMAIL', occurredAt: '2026-10-15T14:00:00Z' });

    expect(compute(person(), [inbound, outbound]).fields.cadenceState).toBe('REPLY_OWED');
    expect(compute(person(), [inbound, { ...outbound, occurredAt: '2026-10-15T16:00:00Z' }]).fields.cadenceState)
      .not.toBe('REPLY_OWED');
  });
});

describe('computePersonCadence', () => {
  it('leaves a new person Cold: no date, not due', () => {
    const { fields } = compute(person(), []);

    expect(fields.nextActionDate).toBeNull();
    expect(fields.cadenceDue).toBe(false);
    expect(fields.cadenceState).toBe('RUNNING');
    expect(fields.cadenceStep).toBe('Not started');
  });

  it('schedules +3 business days after the connection request', () => {
    // Monday 12 Oct + 3 business days = Thursday 15 Oct.
    const { fields } = compute(person({ cadenceStage: 'CONTACTED_NO_REPLY' }), [
      touch('2026-10-12', 'LINKEDIN_CONNECTION'),
    ]);

    expect(fields.nextActionDate).toBe('2026-10-15');
    expect(fields.cadenceDue).toBe(true);
  });

  it('stores each action with its touch in Twenty values', () => {
    const { fields } = compute(person(), []);
    const didIt = fields.cadenceActions.actions.find((entry) => entry.action === 'didIt');

    expect(didIt?.touch).toEqual({
      channel: 'LINKEDIN_CONNECTION',
      direction: 'OUTBOUND',
      outcome: null,
    });
    expect(fields.cadenceActions.overflowActions).toEqual(['snooze', 'hold', 'markDead']);
  });

  it('owes a reply today after an inbound message', () => {
    const { fields } = compute(person({ cadenceStage: 'REPLIED_IN_CONVERSATION' }), [
      touch('2026-10-12', 'LINKEDIN_CONNECTION'),
      touch('2026-10-13', 'LINKEDIN_CONNECTION', 'INBOUND', { outcome: 'ACCEPTED' }),
      touch('2026-10-14', 'LINKEDIN_MESSAGE', 'INBOUND'),
    ]);

    expect(fields.cadenceState).toBe('REPLY_OWED');
    expect(fields.nextActionDate).toBe(TODAY);
    expect(fields.cadenceActions.replyOwedSince).toBe('2026-10-14');
  });

  it('is opted out when suppressed', () => {
    const { fields } = compute(person(), [], true);

    expect(fields.cadenceState).toBe('OPTED_OUT');
    expect(fields.cadenceActions.actions).toEqual([]);
    expect(fields.cadenceActions.isSuppressed).toBe(true);
  });

  it('keeps a typed date and says so', () => {
    const { fields } = compute(person({ nextActionDateOverride: '2026-11-02' }), [
      touch('2026-10-12', 'LINKEDIN_CONNECTION'),
    ]);

    expect(fields.nextActionDate).toBe('2026-11-02');
    expect(fields.cadenceActions.proposedNextActionDate).toBe('2026-10-15');
    expect(fields.cadenceActions.isNextActionDateTyped).toBe(true);
  });
});

describe('lastTouchOn (the person\'s last touch)', () => {
  it('is the day of the latest touch of any kind, synced copies included', () => {
    const touches = [
      touch('2026-10-01', 'EMAIL'),
      touch('2026-10-09', 'FOLLOW', 'INBOUND'),
      touch('2026-10-12', 'MEETING', 'OUTBOUND', { source: 'CALENDAR' }),
      touch('2026-10-05', 'CALL'),
    ];

    expect(lastTouchOn(touches, TODAY)).toBe('2026-10-12');
  });

  it('leaves out deleted and future-dated touches, and those with no date', () => {
    const touches = [
      touch('2026-10-02', 'EMAIL'),
      touch('2026-10-14', 'EMAIL', 'OUTBOUND', { deletedAt: '2026-10-14T10:00:00Z' }),
      touch('2026-10-16', 'EMAIL'),
      touch('not a date', 'EMAIL'),
    ];

    expect(lastTouchOn(touches, TODAY)).toBe('2026-10-02');
  });

  it('counts a touch with a channel the engine cannot use: it still happened', () => {
    expect(lastTouchOn([touch('2026-10-03', 'WHATSAPP_GROUP'), touch('2026-10-04', 'odd value')], TODAY)).toBe(
      '2026-10-04',
    );
  });

  it('counts today, and is null with no touch', () => {
    expect(lastTouchOn([touch(TODAY, 'EMAIL')], TODAY)).toBe(TODAY);
    expect(lastTouchOn([], TODAY)).toBeNull();
  });

  it('is one of the engine fields, written only when it changes', () => {
    const now = new Date('2026-10-15T08:00:00Z');
    const touches = [touch('2026-10-08', 'LINKEDIN_CONNECTION')];
    const subject = person();
    const { fields } = compute(subject, touches);

    expect(fields.lastTouchOn).toBe('2026-10-08');

    const first = diffPersonUpdate({ current: subject, patch: {}, fields, today: TODAY, now });

    expect(first).toMatchObject({ lastTouchOn: '2026-10-08' });

    const stored = person({ ...fields, lastTouchOn: '2026-10-08T00:00:00.000Z' });

    expect(diffPersonUpdate({ current: stored, patch: {}, fields, today: TODAY, now })).toBeNull();

    // Undo of the only touch: it goes back to empty.
    const undone = compute(stored, []).fields;

    expect(
      diffPersonUpdate({ current: stored, patch: {}, fields: undone, today: TODAY, now }),
    ).toMatchObject({ lastTouchOn: null });
  });
});

describe('diffPersonUpdate (write only on change)', () => {
  const now = new Date('2026-10-15T08:00:00Z');

  it('writes everything that changed, with cadenceActions and the day', () => {
    const subject = person();
    const { fields } = compute(subject, []);
    const update = diffPersonUpdate({ current: subject, patch: {}, fields, today: TODAY, now });

    expect(update).toMatchObject({
      cadenceStep: 'Not started',
      cadenceComputedOn: TODAY,
      cadenceActions: { writtenAt: now.toISOString() },
    });
  });

  it('writes nothing when the stored values already match, whatever the key order', () => {
    const subject = person();
    const { fields } = compute(subject, []);
    const stored = person({
      ...fields,
      cadenceActions: JSON.parse(
        JSON.stringify({ writtenAt: 'earlier', ...fields.cadenceActions }),
      ),
      nextActionDate: null,
      cadenceComputedOn: '2026-10-01',
    });

    expect(diffPersonUpdate({ current: stored, patch: {}, fields, today: TODAY, now })).toBeNull();
    expect(
      diffPersonUpdate({
        current: stored,
        patch: { nextActionDateOverride: null },
        fields,
        today: TODAY,
        now,
      }),
    ).toBeNull();
  });

  it('treats a date and its midnight timestamp as equal', () => {
    const subject = person({ cadenceOwnerSince: '2026-10-01T00:00:00.000Z' });
    const { fields } = compute(subject, []);
    const stored = { ...subject, ...fields };

    expect(
      diffPersonUpdate({
        current: stored,
        patch: { cadenceOwnerSince: '2026-10-01' },
        fields,
        today: TODAY,
        now,
      }),
    ).toBeNull();
  });
});

describe('decidePersonEdit', () => {
  const edit = (before: Partial<PersonRecord>, after: Partial<PersonRecord>, updatedFields: string[]): PersonEdit => ({
    before: person(before),
    after: person({ ...before, ...after }),
    updatedFields,
  });
  const decide = (personEdit: PersonEdit, touches: TouchRecord[] = []) =>
    decidePersonEdit({ edit: personEdit, touches, config: CONFIG, today: TODAY, suppressed: false, now: new Date('2026-10-15T12:00:00.000Z') });

  it('stores a hand-typed date as the override', () => {
    const decision = decide(
      edit(
        { nextActionDate: '2026-10-15', cadenceActions: { nextActionDate: '2026-10-15' } },
        { nextActionDate: '2026-10-22' },
        ['nextActionDate'],
      ),
    );

    expect(decision.patch).toEqual({ nextActionDateOverride: '2026-10-22' });
  });

  it('does not treat the engine’s own value as typed', () => {
    expect(
      decide(
        edit(
          { nextActionDate: '2026-10-12', cadenceActions: { nextActionDate: '2026-10-15' } },
          { nextActionDate: '2026-10-15' },
          ['nextActionDate'],
        ),
      ).patch,
    ).toEqual({});
  });

  it('clears the typed date when a snooze starts, unless a date was typed in the same edit', () => {
    const snooze = edit(
      { nextActionDateOverride: '2026-10-20', cadenceActions: { nextActionDate: '2026-10-20' } },
      { snoozeUntil: '2026-10-30' },
      ['snoozeUntil'],
    );

    expect(decide(snooze).patch).toEqual({ nextActionDateOverride: null });

    const snoozeAndType = edit(
      { nextActionDateOverride: null, nextActionDate: '2026-10-20', cadenceActions: { nextActionDate: '2026-10-20' } },
      { snoozeUntil: '2026-10-30', nextActionDate: '2026-10-25' },
      ['snoozeUntil', 'nextActionDate'],
    );

    expect(decide(snoozeAndType).patch).toEqual({ nextActionDateOverride: '2026-10-25' });
  });

  it('leaves the typed date on an ordinary stage move of a running contact', () => {
    expect(
      decide(
        edit({ cadenceStage: 'DECK_SENT', nextActionDateOverride: '2026-10-20' }, { cadenceStage: 'PILOT_DISCUSSION' }, ['cadenceStage']),
      ).patch,
    ).toEqual({});
  });

  it('starts fresh on a native owner change between two owners', () => {
    expect(
      decide(edit({ cadenceOwnerId: 'owner-a' }, { cadenceOwnerId: 'owner-b' }, ['cadenceOwner', 'cadenceOwnerId'])).patch,
    ).toEqual({ cadenceOwnerSince: TODAY, cadenceReplyResetAt: '2026-10-15T12:00:00.000Z' });
  });

  it('does nothing on a first assignment or an unassignment', () => {
    expect(decide(edit({ cadenceOwnerId: null }, { cadenceOwnerId: 'owner-b' }, ['cadenceOwnerId'])).patch).toEqual({});
    expect(decide(edit({ cadenceOwnerId: 'owner-a' }, { cadenceOwnerId: null }, ['cadenceOwnerId'])).patch).toEqual({});
  });

  it('leaves cadenceOwnerSince to the change-owner route when it recorded the request', () => {
    const request = { toOwnerId: 'owner-b', mode: 'KEEP_POSITION', requestedAt: '2026-10-15T09:00:00Z', requestedByWorkspaceMemberId: 'm1' };

    expect(
      decide(
        edit({ cadenceOwnerId: 'owner-a' }, { cadenceOwnerId: 'owner-b', cadenceOwnerChangeRequest: request }, ['cadenceOwnerId', 'cadenceOwnerChangeRequest']),
      ).patch,
    ).toEqual({});

    // A stale request (not part of this edit) does not count.
    expect(
      decide(
        edit({ cadenceOwnerId: 'owner-a', cadenceOwnerChangeRequest: request }, { cadenceOwnerId: 'owner-b' }, ['cadenceOwnerId']),
      ).patch,
    ).toEqual({ cadenceOwnerSince: TODAY, cadenceReplyResetAt: '2026-10-15T12:00:00.000Z' });
  });

  it('recognises engine writes', () => {
    expect(isEngineWrite(['nextActionDate', 'cadenceActions', 'cadenceComputedOn'])).toBe(true);
    expect(isEngineWrite(['nextActionDate'])).toBe(false);
  });

  it('reads the engine value recorded with its write', () => {
    expect(engineNextActionDate({ nextActionDate: '2026-10-15' })).toBe('2026-10-15');
    expect(engineNextActionDate({ nextActionDate: null })).toBeNull();
    expect(engineNextActionDate(null)).toBeUndefined();
  });
});

describe('decideTouchesCreated', () => {
  const decide = (subject: PersonRecord, created: TouchRecord[]) =>
    decideTouchesCreated({ person: subject, createdTouches: created, config: CONFIG, today: TODAY });

  it('moves Not contacted to Contacted on our first touch and ends a typed date', () => {
    expect(decide(person(), [touch('2026-10-15', 'LINKEDIN_CONNECTION')]).patch).toEqual({
      cadenceStage: 'CONTACTED_NO_REPLY',
      nextActionDateOverride: null,
    });
  });

  it('moves Contacted to Replied on a reply, but not on an acceptance', () => {
    const contacted = person({ cadenceStage: 'CONTACTED_NO_REPLY' });

    expect(decide(contacted, [touch('2026-10-15', 'LINKEDIN_MESSAGE', 'INBOUND')]).patch.cadenceStage).toBe('REPLIED_IN_CONVERSATION');
    expect(
      decide(contacted, [touch('2026-10-15', 'LINKEDIN_CONNECTION', 'INBOUND', { outcome: 'ACCEPTED' })]).patch.cadenceStage,
    ).toBeUndefined();
  });

  it('applies both moves in order for touches logged together', () => {
    expect(
      decide(person(), [
        touch('2026-10-15', 'LINKEDIN_MESSAGE', 'INBOUND'),
        touch('2026-10-14', 'EMAIL'),
      ]).patch.cadenceStage,
    ).toBe('REPLIED_IN_CONVERSATION');
  });

  it('ignores a future-dated touch entirely', () => {
    expect(decide(person(), [touch('2026-10-16', 'EMAIL')]).patch).toEqual({});
  });
});

describe('suppression matching', () => {
  it('normalises emails and LinkedIn URLs', () => {
    expect(normalizeEmail('  Aditi@Example.COM ')).toBe('aditi@example.com');
    expect(normalizeLinkedinUrl('https://www.LinkedIn.com/in/Aditi/?trk=x')).toBe('linkedin.com/in/aditi');
    expect(normalizeLinkedinUrl('linkedin.com/in/aditi')).toBe('linkedin.com/in/aditi');
    expect(normalizeEmail('')).toBeNull();
  });

  it('matches any email or URL on the person and lists what is missing', () => {
    const index = buildSuppressionIndex([{ email: 'ADITI@example.com' }]);
    const identity = personIdentity(person());

    expect(isSuppressed(identity, index)).toBe(true);
    expect(isSuppressed(personIdentity(person({ emails: { primaryEmail: 'other@example.com' } })), index)).toBe(false);
    expect(missingSuppressions(identity, index)).toEqual({
      emails: [],
      linkedinUrls: ['linkedin.com/in/aditi'],
    });
  });
});

describe('civil dates in the cadence time zone', () => {
  it('uses London, not UTC, for today across BST', () => {
    expect(todayIn('Europe/London', new Date('2026-06-15T23:30:00Z'))).toBe('2026-06-16');
    expect(todayIn('Europe/London', new Date('2026-12-15T23:30:00Z'))).toBe('2026-12-15');
  });

  it('sees 00:10 London as hour 0 in both GMT and BST', () => {
    expect(localHourIn('Europe/London', new Date('2026-06-15T23:10:00Z'))).toBe(0);
    expect(localHourIn('Europe/London', new Date('2026-12-16T00:10:00Z'))).toBe(0);
    // The two DST change days.
    expect(localHourIn('Europe/London', new Date('2026-03-29T00:10:00Z'))).toBe(0);
    expect(todayIn('Europe/London', new Date('2026-10-24T23:10:00Z'))).toBe('2026-10-25');
  });

  it('reads date-only values', () => {
    expect(toDateOnly('2026-10-15')).toBe('2026-10-15');
    expect(toDateOnly('2026-10-15T00:00:00.000Z')).toBe('2026-10-15');
    expect(toDateOnly(null)).toBeNull();
    expect(toDateOnly('soon')).toBeNull();
  });
});
