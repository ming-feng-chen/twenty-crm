import { describe, expect, it } from 'vitest';

import { DEFAULT_CADENCE_CONFIG } from '../default-cadence-config';
import { computePosition } from '../position';
import { advancesSequence, isOurContact } from '../touches';
import type { CadenceContact, CadenceTouch } from '../types';
import { contact, touch } from './fixtures';
import { toLegacyResult } from './legacy-view';

// Ported from the predecessor's position.test.ts with identical expectations,
// read through the legacy view of the default cadence.

const CONFIG = DEFAULT_CADENCE_CONFIG;
const TODAY = '2026-08-17'; // a Monday

const position = (
  subject: CadenceContact,
  history: CadenceTouch[],
  today: string,
) => toLegacyResult(computePosition(subject, history, today, CONFIG));

const CONNECTION = touch('2026-07-01', 'linkedinConnection');
const ACCEPTED = touch('2026-07-03', 'linkedinConnection', 'inbound', 'accepted');
const LI_1 = touch('2026-07-06', 'linkedinMessage');
const LI_2 = touch('2026-07-09', 'linkedinMessage');
const EMAILS = Array.from({ length: 7 }, (_, index) =>
  touch(`2026-07-${String(13 + index).padStart(2, '0')}`, 'email'),
);
const ACCEPTED_LADDER = [CONNECTION, ACCEPTED, LI_1, LI_2];

describe('§2.2 — the sequence, in order', () => {
  it('keeps an unowned contact without LinkedIn on the connection-request step', () => {
    const result = computePosition(contact({ hasOwner: false, hasLinkedinUrl: false }), [], TODAY, CONFIG);

    expect(result).toEqual({ position: { kind: 'notStarted', stepKey: CONFIG.steps[0].key }, blockedReason: 'unowned' });
    expect(computePosition(contact({ hasLinkedinUrl: false }), [], TODAY, CONFIG).position).toEqual({
      kind: 'notStarted', stepKey: 'email',
    });
  });

  it('starts at not_started with nothing on file', () => {
    expect(position(contact(), [], TODAY).position).toEqual({
      kind: 'not_started',
    });
  });

  it('is warmed_up on a follow or a comment and nothing else', () => {
    const social = [touch('2026-06-28', 'follow'), touch('2026-06-30', 'comment')];

    expect(position(contact(), social, TODAY).position).toEqual({
      kind: 'warmed_up',
    });
  });

  it('waits at connection_sent until the request is accepted', () => {
    expect(position(contact(), [CONNECTION], '2026-07-05')).toMatchObject({
      position: { kind: 'connection_sent' },
      blockedReason: 'connection_pending',
    });
  });

  it('moves to LinkedIn message 1 and 2 once accepted', () => {
    expect(position(contact(), [CONNECTION, ACCEPTED], TODAY).position).toEqual({
      kind: 'linkedin_message',
      n: 1,
    });
    expect(
      position(contact(), [CONNECTION, ACCEPTED, LI_1], TODAY).position,
    ).toEqual({ kind: 'linkedin_message', n: 2 });
  });

  it('runs seven emails, not eight — email 7 is the wrap', () => {
    for (let sent = 0; sent < 7; sent += 1) {
      const history = [...ACCEPTED_LADDER, ...EMAILS.slice(0, sent)];

      expect(position(contact(), history, TODAY).position).toEqual({
        kind: 'email',
        n: sent + 1,
      });
    }

    expect(
      position(contact(), [...ACCEPTED_LADDER, ...EMAILS], TODAY).position,
    ).toEqual({ kind: 'drip_month', month: 1 });
  });

  it('drips monthly and indefinitely — nothing closes anybody from silence', () => {
    const history = [
      ...ACCEPTED_LADDER,
      ...EMAILS,
      touch('2026-05-01', 'email'),
    ];

    // The number is the drip touch to send, so it does not age with the days.
    expect(
      position(contact(), [...ACCEPTED_LADDER, ...EMAILS], '2026-08-17'),
    ).toMatchObject({ position: { kind: 'drip_month', month: 1 } });
    expect(
      position(contact(), [...ACCEPTED_LADDER, ...EMAILS], '2026-08-18'),
    ).toMatchObject({ position: { kind: 'drip_month', month: 1 } }); // E4: was month 2, counted in 30-day periods
    expect(position(contact(), history, '2026-11-01').position).toMatchObject({
      kind: 'drip_month',
    });
  });
});

describe('§3 — the follow and the comment never block and never count', () => {
  it('does not let a social touch consume a step', () => {
    const history = [
      touch('2026-06-30', 'follow'),
      CONNECTION,
      touch('2026-07-02', 'comment'),
    ];

    expect(position(contact(), history, '2026-07-05').position).toEqual({
      kind: 'connection_sent',
    });
  });
});

describe('ADR-0032 §4 — a call or a meeting', () => {
  const upToEmail3 = [...ACCEPTED_LADDER, ...EMAILS.slice(0, 3)];

  it('does not advance the ladder when it is outbound', () => {
    const called = [...upToEmail3, touch('2026-08-03', 'call')];

    expect(position(contact(), called, TODAY).position).toEqual({
      kind: 'email',
      n: 4,
    });
  });

  it('does not consume a LinkedIn rung either', () => {
    const met = [CONNECTION, ACCEPTED, touch('2026-07-06', 'meeting')];

    expect(position(contact(), met, TODAY).position).toEqual({
      kind: 'linkedin_message',
      n: 1,
    });
  });

  it('stops the cadence when it is inbound — a real conversation is a reply', () => {
    const history = [
      ...upToEmail3,
      touch('2026-08-03', 'call', 'inbound'),
      touch('2026-08-04', 'email'),
    ];

    expect(position(contact(), history, TODAY).position).toEqual({
      kind: 'email',
      n: 4,
    });
  });

  it('consumes no rung even when it is the call that answered a reply', () => {
    const history = [
      ...upToEmail3,
      touch('2026-08-03', 'email', 'inbound'),
      touch('2026-08-04', 'call'),
    ];
    const resumed = contact({
      cadenceResumedAt: new Date('2026-08-05T00:00:00Z'),
    });

    expect(position(resumed, history, TODAY).position).toEqual({
      kind: 'email',
      n: 4,
    });
  });
});

describe('§3 — the InMail branch', () => {
  it('is not offered before 14 calendar days', () => {
    expect(
      position(contact(), [CONNECTION], '2026-07-14').inMailAvailable,
    ).toBeUndefined();
  });

  it('is offered on the fourteenth day, and replaces the block', () => {
    const result = position(contact(), [CONNECTION], '2026-07-15');

    expect(result.inMailAvailable).toBe(true);
    expect(result.blockedReason).toBeUndefined();
  });

  it('is never offered without a LinkedIn URL — a choice of one is not a choice', () => {
    const noLinkedIn = contact({ hasLinkedinUrl: false });

    expect(
      position(noLinkedIn, [CONNECTION], '2026-08-01').inMailAvailable,
    ).toBeUndefined();
  });

  it('encodes no seniority rule — nothing about the person is an input', () => {
    expect(
      position(contact(), [CONNECTION], '2026-08-01').inMailAvailable,
    ).toBe(true);
  });

  it('reads a message sent without acceptance as the InMail, and moves on to email', () => {
    const history = [CONNECTION, touch('2026-07-16', 'linkedinMessage')];

    expect(position(contact(), history, TODAY).position).toEqual({
      kind: 'email',
      n: 1,
    }); // E1: was { kind: 'linkedin_inmail' }, which prescribed a second InMail
  });
});

describe('§5 — touches sent while the cadence was stopped do not count', () => {
  const upToEmail3 = [...ACCEPTED_LADDER, ...EMAILS.slice(0, 3)];

  it('is at email 4 after three emails', () => {
    expect(position(contact(), upToEmail3, TODAY).position).toEqual({
      kind: 'email',
      n: 4,
    });
  });

  it('still resumes at email 4 after a reply and a check-in — §5’s own example', () => {
    const history = [
      ...upToEmail3,
      touch('2026-07-20', 'email', 'inbound'),
      touch('2026-07-21', 'email'),
    ];
    const resumed = contact({
      cadenceResumedAt: new Date('2026-07-24T00:00:00Z'),
    });

    expect(position(resumed, history, TODAY).position).toEqual({
      kind: 'email',
      n: 4,
    });
  });

  it('counts an email sent after the resume click', () => {
    const history = [
      ...upToEmail3,
      touch('2026-07-20', 'email', 'inbound'),
      touch('2026-07-21', 'email'),
      touch('2026-07-27', 'email'),
    ];
    const resumed = contact({
      cadenceResumedAt: new Date('2026-07-24T00:00:00Z'),
    });

    expect(position(resumed, history, TODAY).position).toEqual({
      kind: 'email',
      n: 5,
    });
  });

  it('§9 — a touch on the same day as a reply counts as after it', () => {
    const history = [
      ...upToEmail3,
      touch('2026-07-20', 'email', 'inbound'),
      touch('2026-07-20', 'email'),
    ];
    const resumed = contact({
      cadenceResumedAt: new Date('2026-07-24T00:00:00Z'),
    });

    expect(position(resumed, history, TODAY).position).toEqual({
      kind: 'email',
      n: 4,
    });
  });
});

describe('§4 — an accepted connection request is not a reply', () => {
  it('does not stop the cadence', () => {
    expect(position(contact(), [CONNECTION, ACCEPTED], TODAY).position).toEqual({
      kind: 'linkedin_message',
      n: 1,
    });
  });

  it('is recognised by the accepted outcome on any channel', () => {
    const accepted = touch('2026-07-03', 'call', 'inbound', 'accepted');

    expect(position(contact(), [CONNECTION, accepted], TODAY).position).toEqual({
      kind: 'linkedin_message',
      n: 1,
    });
  });
});

describe('§6 — a transfer is the only restart', () => {
  const walked = [...ACCEPTED_LADDER, ...EMAILS.slice(0, 3)];

  it('resets position to not_started under the new owner', () => {
    const transferred = contact({
      ownerSince: new Date('2026-08-01T00:00:00Z'),
    });

    expect(position(transferred, walked, TODAY).position).toEqual({
      kind: 'not_started',
    });
  });

  it("keeps the old owner's touches on the contact but stops counting them", () => {
    const history = [...walked, touch('2026-08-03', 'linkedinConnection')];
    const transferred = contact({
      ownerSince: new Date('2026-08-01T00:00:00Z'),
    });

    expect(position(transferred, history, '2026-08-05').position).toEqual({
      kind: 'connection_sent',
    });
  });

  it('does not reset on a first assignment — null to someone is not a transfer', () => {
    expect(
      position(contact({ ownerSince: null }), walked, TODAY).position,
    ).toEqual({ kind: 'email', n: 4 });
  });
});

describe('§9 — missing data', () => {
  it('starts at email 1 with no LinkedIn URL, and says why', () => {
    const noLinkedIn = contact({ hasLinkedinUrl: false });

    expect(position(noLinkedIn, [], TODAY)).toMatchObject({
      position: { kind: 'not_started' },
      blockedReason: 'no_linkedin_url',
    });
    expect(position(noLinkedIn, EMAILS.slice(0, 2), TODAY)).toMatchObject({
      position: { kind: 'email', n: 3 },
      blockedReason: 'no_linkedin_url',
    });
  });

  it('reports no_email_address only once the next step needs an address', () => {
    const noEmail = contact({ hasEmail: false });

    expect(
      position(noEmail, [CONNECTION, ACCEPTED], TODAY).blockedReason,
    ).toBeUndefined();
    expect(position(noEmail, ACCEPTED_LADDER, TODAY)).toMatchObject({
      position: { kind: 'email', n: 1 },
      blockedReason: 'no_email_address',
    });
  });

  it('reports unowned above every other reason', () => {
    const unowned = contact({
      hasOwner: false,
      hasEmail: false,
      hasLinkedinUrl: false,
    });

    expect(position(unowned, [], TODAY).blockedReason).toBe('unowned');
  });
});

describe('§9 — counting and ordering', () => {
  it('advances twice when two touches are logged on the same day', () => {
    const history = [
      ...ACCEPTED_LADDER,
      EMAILS[0],
      touch('2026-07-13', 'email'),
    ];

    expect(position(contact(), history, TODAY).position).toEqual({
      kind: 'email',
      n: 3,
    });
  });

  it('recomputes when a touch is logged with an earlier date', () => {
    const backdated = [...ACCEPTED_LADDER, touch('2026-06-01', 'email')];

    expect(position(contact(), backdated, TODAY).position).toEqual({
      kind: 'email',
      n: 2,
    });
  });

  it('does not care what order the activities arrive in', () => {
    const forwards = [...ACCEPTED_LADDER];
    const backwards = [LI_2, CONNECTION, LI_1, ACCEPTED];

    expect(position(contact(), backwards, TODAY)).toEqual(
      position(contact(), forwards, TODAY),
    );
  });
});

describe('ADR-0032 §4 amendment — two predicates, two questions', () => {
  it.each<[string, boolean, boolean]>([
    ['linkedinConnection', true, true],
    ['linkedinMessage', true, true],
    ['email', true, true],
    ['call', false, true],
    ['follow', false, false],
  ])('outbound %s — rung %s, chase %s', (channel, rung, chase) => {
    expect(advancesSequence(touch('2026-08-03', channel), CONFIG)).toBe(rung);
    expect(isOurContact(touch('2026-08-03', channel), CONFIG)).toBe(chase);
  });

  it('counts nothing inbound under either — an inbound touch is theirs', () => {
    const channels = [
      'linkedinConnection',
      'linkedinMessage',
      'email',
      'follow',
      'call',
    ];

    for (const channel of channels) {
      expect(
        advancesSequence(touch('2026-08-03', channel, 'inbound'), CONFIG),
      ).toBe(false);
      expect(isOurContact(touch('2026-08-03', channel, 'inbound'), CONFIG)).toBe(
        false,
      );
    }
  });
});
