import { describe, expect, it } from 'vitest';

import { parseCadenceActions } from 'src/ui/cadence-actions';
import {
  buildSections,
  EVERYONE,
  filterByCompanyGroup,
  groupByOwner,
  ME,
  mergeRoutePerson,
  type MyDayPerson,
  ownerFilterFor,
  type PersonNode,
  sectionOf,
  selectionFromValue,
  selectionToValue,
  showsOwner,
  toMyDayPerson,
} from 'src/ui/my-day';

const TODAY = '2026-10-16';

const actionsJson = (overrides: Record<string, unknown> = {}) => ({
  version: 1,
  cadenceId: 'c1',
  state: 'RUNNING',
  stepLabel: 'Email 3 of 7',
  positionLabel: 'Email 3 of 7',
  nextActionDate: '2026-10-16',
  proposedNextActionDate: '2026-10-16',
  isNextActionDateTyped: false,
  isDue: true,
  strikes: 0,
  replyOwedSince: null,
  blockedReason: null,
  inMailAvailable: false,
  isLinkedInPosition: false,
  isSuppressed: false,
  actions: [
    { action: 'didIt', touch: { channel: 'EMAIL', direction: 'OUTBOUND', outcome: null } },
    { action: 'theyReplied', touch: { channel: 'EMAIL', direction: 'INBOUND', outcome: 'REPLIED' } },
    { action: 'somethingElse', touch: null },
  ],
  overflowActions: ['snooze', 'hold', 'markDead'],
  ignoredTouches: [],
  problems: [],
  ...overrides,
});

const node = (overrides: Partial<PersonNode> = {}): PersonNode => ({
  id: 'p1',
  name: { firstName: 'Aditi', lastName: 'Rajvanshi' },
  company: { name: 'Heathrow' },
  emails: { primaryEmail: 'aditi@example.com', additionalEmails: [] },
  cadenceStage: 'CONTACTED_NO_REPLY',
  cadenceStep: 'Email 3 of 7',
  cadenceState: 'RUNNING',
  nextActionDate: TODAY,
  cadenceOwnerId: 'm1',
  cadenceDue: true,
  cadenceActions: actionsJson(),
  ...overrides,
});

const person = (id: string, overrides: Partial<PersonNode> = {}): MyDayPerson =>
  toMyDayPerson(node({ id, ...overrides }));

describe('toMyDayPerson', () => {
  it('reads a row from the API node', () => {
    const row = toMyDayPerson(node());

    expect(row).toMatchObject({
      id: 'p1',
      name: 'Aditi Rajvanshi',
      companyName: 'Heathrow',
      stage: 'CONTACTED_NO_REPLY',
      step: 'Email 3 of 7',
      nextActionDate: TODAY,
      ownerId: 'm1',
      primaryEmail: 'aditi@example.com',
      actionsProblem: null,
    });
    expect(row.actions?.actions.map((entry) => entry.action)).toEqual([
      'didIt',
      'theyReplied',
      'somethingElse',
    ]);
  });

  it('keeps the buttons in the order the engine gave them', () => {
    const row = toMyDayPerson(
      node({
        cadenceActions: actionsJson({
          actions: [
            { action: 'sentInMail', touch: { channel: 'INMAIL', direction: 'OUTBOUND', outcome: null } },
            { action: 'skipToNextStep', touch: { channel: 'EMAIL', direction: 'OUTBOUND', outcome: null } },
            { action: 'theyReplied', touch: { channel: 'LINKEDIN_MESSAGE', direction: 'INBOUND', outcome: 'REPLIED' } },
            { action: 'theyAccepted', touch: { channel: 'LINKEDIN_CONNECTION', direction: 'INBOUND', outcome: 'ACCEPTED' } },
          ],
        }),
      }),
    );

    expect(row.actions?.actions.map((entry) => entry.action)).toEqual([
      'sentInMail',
      'skipToNextStep',
      'theyReplied',
      'theyAccepted',
    ]);
  });

  it('reports cadence data it cannot read instead of guessing', () => {
    expect(toMyDayPerson(node({ cadenceActions: null })).actionsProblem).toMatch(
      /not been worked out/,
    );
    expect(
      toMyDayPerson(node({ cadenceActions: actionsJson({ version: 2 }) })).actionsProblem,
    ).toMatch(/version 2/);
  });

  it('names an unnamed person and drops blank companies', () => {
    const row = toMyDayPerson(node({ name: { firstName: ' ', lastName: null }, company: { name: '' } }));

    expect(row.name).toBe('Unnamed person');
    expect(row.companyName).toBeNull();
  });
});

describe('filterByCompanyGroup', () => {
  const partner = person('p1', { company: { name: 'Avolta', group: 'PARTNER' } });
  const airport = person('p2', { company: { name: 'Heathrow', group: 'AIRPORT' } });
  const untagged = person('p3', { company: { name: 'Bagid', group: null } });
  const noCompany = person('p4', { company: null });
  const everyone = [partner, airport, untagged, noCompany];

  it('keeps everyone, untagged included, when showing both groups', () => {
    expect(filterByCompanyGroup(everyone, 'ALL')).toEqual(everyone);
  });

  it('keeps only contacts whose organisation is in the chosen group', () => {
    expect(filterByCompanyGroup(everyone, 'PARTNER').map((row) => row.id)).toEqual(['p1']);
    expect(filterByCompanyGroup(everyone, 'AIRPORT').map((row) => row.id)).toEqual(['p2']);
  });
});

describe('parseCadenceActions', () => {
  it('accepts the JSON as a string too', () => {
    const parsed = parseCadenceActions(JSON.stringify(actionsJson()));

    expect(parsed.ok).toBe(true);
  });

  it('ignores malformed action entries', () => {
    const parsed = parseCadenceActions(
      actionsJson({ actions: [{ action: 'didIt', touch: null }, { nope: true }, 'x'] }),
    );

    expect(parsed.ok && parsed.value.actions).toEqual([{ action: 'didIt', touch: null }]);
  });
});

describe('sections', () => {
  it('puts replies first, then overdue, then due today', () => {
    expect(sectionOf(person('a', { cadenceState: 'REPLY_OWED', nextActionDate: TODAY }), TODAY)).toBe(
      'replyOwed',
    );
    expect(sectionOf(person('b', { nextActionDate: '2026-10-12' }), TODAY)).toBe('overdue');
    expect(sectionOf(person('c', { nextActionDate: TODAY }), TODAY)).toBe('dueToday');
  });

  it('sorts oldest first within each section, and counts every section', () => {
    const sections = buildSections(
      [
        person('today-b', { name: { firstName: 'Bea' }, nextActionDate: TODAY }),
        person('late-new', { nextActionDate: '2026-10-15' }),
        person('reply-new', {
          cadenceState: 'REPLY_OWED',
          cadenceActions: actionsJson({ state: 'REPLY_OWED', replyOwedSince: '2026-10-15' }),
        }),
        person('today-a', { name: { firstName: 'Amir' }, nextActionDate: TODAY }),
        person('late-old', { nextActionDate: '2026-10-02' }),
        person('reply-old', {
          cadenceState: 'REPLY_OWED',
          cadenceActions: actionsJson({ state: 'REPLY_OWED', replyOwedSince: '2026-10-09' }),
        }),
      ],
      TODAY,
    );

    expect(sections.map((section) => [section.title, section.people.map((row) => row.id)])).toEqual([
      ['Reply to them', ['reply-old', 'reply-new']],
      ['Overdue', ['late-old', 'late-new']],
      ['Due today', ['today-a', 'today-b']],
    ]);
  });

  it('keeps empty sections so their count reads 0', () => {
    expect(buildSections([], TODAY).map((section) => section.people.length)).toEqual([0, 0, 0]);
  });
});

describe('groupByOwner', () => {
  const members = [
    { id: 'm1', displayName: 'Ming-Feng Chen' },
    { id: 'm2', displayName: 'Rita Rep' },
    { id: 'm3', displayName: 'Ana Admin' },
  ];

  it('groups by owner name and leaves unowned contacts out', () => {
    const groups = groupByOwner(
      [
        person('a', { cadenceOwnerId: 'm2' }),
        person('b', { cadenceOwnerId: 'm1' }),
        person('c', { cadenceOwnerId: null }),
        person('d', { cadenceOwnerId: 'm2', nextActionDate: '2026-10-01' }),
      ],
      members,
      TODAY,
    );

    expect(groups.map((group) => [group.ownerName, group.total])).toEqual([
      ['Ming-Feng Chen', 1],
      ['Rita Rep', 2],
    ]);
    expect(groups[1].sections[1].people.map((row) => row.id)).toEqual(['d']);
  });

  it('still shows a contact whose owner left the workspace', () => {
    expect(groupByOwner([person('a', { cadenceOwnerId: 'gone' })], members, TODAY)[0].ownerName).toBe(
      'A former member',
    );
  });
});

describe('selection', () => {
  it('round-trips through the select value', () => {
    for (const selection of [ME, EVERYONE, { kind: 'member', memberId: 'm2' } as const]) {
      expect(selectionFromValue(selectionToValue(selection))).toEqual(selection);
    }

    expect(selectionFromValue('member:')).toEqual(ME);
  });

  it('never turns an unknown viewer into everyone', () => {
    expect(ownerFilterFor(ME, null)).toBeNull();
    expect(ownerFilterFor(ME, 'm1')).toEqual({ ownerId: 'm1' });
    expect(ownerFilterFor(EVERYONE, null)).toEqual({ anyOwner: true });
    expect(ownerFilterFor({ kind: 'member', memberId: 'm2' }, 'm1')).toEqual({ ownerId: 'm2' });
  });

  it('shows the owner except on the viewer’s own list', () => {
    expect(showsOwner(ME, 'm1')).toBe(false);
    expect(showsOwner({ kind: 'member', memberId: 'm1' }, 'm1')).toBe(false);
    expect(showsOwner({ kind: 'member', memberId: 'm2' }, 'm1')).toBe(true);
    expect(showsOwner(EVERYONE, 'm1')).toBe(true);
  });
});

describe('mergeRoutePerson', () => {
  it('takes the recomputed cadence fields and keeps name and company', () => {
    const merged = mergeRoutePerson(person('p1'), {
      personId: 'p1',
      cadenceStage: 'CONTACTED_NO_REPLY',
      cadenceStep: 'Email 4 of 7',
      cadenceState: 'RUNNING',
      cadenceDue: false,
      nextActionDate: '2026-10-21',
      cadenceOwnerId: 'm1',
      cadenceActions: actionsJson({ stepLabel: 'Email 4 of 7', isDue: false }),
    });

    expect(merged).toMatchObject({
      name: 'Aditi Rajvanshi',
      companyName: 'Heathrow',
      step: 'Email 4 of 7',
      isDue: false,
      nextActionDate: '2026-10-21',
    });
  });
});
