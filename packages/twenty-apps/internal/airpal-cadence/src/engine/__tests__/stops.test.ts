import { describe, expect, it } from 'vitest';

import { DEFAULT_CADENCE_CONFIG } from '../default-cadence-config';
import { computeOutreachStatus } from '../stops';
import type { CadenceContact, CadenceTouch } from '../types';
import { contact, touch } from './fixtures';
import { toLegacyStatus } from './legacy-view';

// Ported from the predecessor's stops.test.ts with identical expectations.
// August 2026: 3rd is a Monday. 8–9 and 15–16 are weekends.

const CONFIG = DEFAULT_CADENCE_CONFIG;
const TODAY = '2026-08-17'; // a Monday

const outreachStatus = (
  subject: CadenceContact,
  history: CadenceTouch[],
  today: string,
) => toLegacyStatus(computeOutreachStatus(subject, history, today, CONFIG));

const REPLIED = touch('2026-08-03', 'email', 'inbound');
// Our answer, then two follow-ups. Each aged three business days by 17 Aug.
const THREE_UNANSWERED = [
  REPLIED,
  touch('2026-08-04', 'email'),
  touch('2026-08-07', 'email'),
  touch('2026-08-12', 'email'),
];

describe('§7 — the order is the answer to "why is this contact showing this"', () => {
  it('1 — opted out beats everything, permanently', () => {
    const subject = contact({
      optedOut: true,
      health: 'dead',
      stage: 'dead',
      snoozeUntil: new Date('2027-01-01T00:00:00Z'),
    });

    expect(outreachStatus(subject, THREE_UNANSWERED, TODAY)).toEqual({
      state: 'opted_out',
    });
  });

  it('2 — dead, from either health or stage', () => {
    for (const subject of [contact({ health: 'dead' }), contact({ stage: 'dead' })]) {
      expect(
        outreachStatus(
          { ...subject, snoozeUntil: new Date('2027-01-01T00:00:00Z') },
          THREE_UNANSWERED,
          TODAY,
        ),
      ).toEqual({ state: 'dead' });
    }
  });

  it('3 — a bounce stops the cadence outright, above an owed reply', () => {
    const bounced = [
      ...THREE_UNANSWERED,
      touch('2026-08-13', 'email', 'outbound', 'bounced'),
    ];

    expect(outreachStatus(contact(), bounced, TODAY)).toEqual({
      state: 'bounced',
    });
  });

  it('4 — they spoke last, and it outranks hold and snooze', () => {
    const subject = contact({
      health: 'hold',
      snoozeUntil: new Date('2027-01-01T00:00:00Z'),
      revisitDate: new Date('2026-12-01T00:00:00Z'),
    });

    expect(outreachStatus(subject, [REPLIED], TODAY)).toEqual({
      state: 'reply_owed',
      since: '2026-08-03',
    });
  });

  it('5 — hold, carrying its revisit date, above snooze', () => {
    const subject = contact({
      health: 'hold',
      revisitDate: new Date('2026-09-01T00:00:00Z'),
      snoozeUntil: new Date('2027-01-01T00:00:00Z'),
    });

    expect(outreachStatus(subject, [], TODAY)).toEqual({
      state: 'hold',
      revisitOn: '2026-09-01',
    });
  });

  it('5 — hold with no revisit date is still a hold', () => {
    expect(outreachStatus(contact({ health: 'hold' }), [], TODAY)).toEqual({
      state: 'hold',
      revisitOn: null,
    });
  });

  it('6 — snoozed, silent until the date inclusive', () => {
    const subject = contact({ snoozeUntil: new Date('2026-08-20T00:00:00Z') });

    expect(outreachStatus(subject, [], '2026-08-20')).toEqual({
      state: 'snoozed',
      until: '2026-08-20',
    });
    expect(outreachStatus(subject, [], '2026-08-21').state).not.toBe('snoozed');
  });

  it('7 — awaiting resume, below hold and snooze', () => {
    expect(outreachStatus(contact(), THREE_UNANSWERED, TODAY)).toEqual({
      state: 'awaiting_resume',
      repliedOn: '2026-08-03',
    });
    expect(
      outreachStatus(contact({ health: 'hold' }), THREE_UNANSWERED, TODAY).state,
    ).toBe('hold');
  });

  it('8 — otherwise, the next step in §3', () => {
    const status = outreachStatus(contact(), [], TODAY);

    expect(status.state).toBe('running');

    if (status.state !== 'running') {
      return;
    }

    expect(status.result.position).toEqual({ kind: 'not_started' });
  });
});

describe('§4 — the reply, and the three strikes', () => {
  it('owes a reply the moment they speak, and never expires', () => {
    expect(outreachStatus(contact(), [REPLIED], '2026-08-04')).toMatchObject({
      state: 'reply_owed',
    });
    expect(outreachStatus(contact(), [REPLIED], '2026-12-25')).toMatchObject({
      state: 'reply_owed',
    });
  });

  it('holds at zero strikes until the silence accrues', () => {
    const answered = [REPLIED, touch('2026-08-04', 'email')];

    expect(outreachStatus(contact(), answered, '2026-08-06')).toMatchObject({
      state: 'in_conversation',
      strikes: 0,
    });
    expect(outreachStatus(contact(), answered, '2026-08-07')).toMatchObject({
      state: 'in_conversation',
      strikes: 1,
    });
  });

  it('counts our unanswered messages, capped at three', () => {
    expect(
      outreachStatus(contact(), THREE_UNANSWERED, '2026-08-11'),
    ).toMatchObject({ strikes: 1 });
    expect(
      outreachStatus(contact(), THREE_UNANSWERED, '2026-08-12'),
    ).toMatchObject({ strikes: 2 });
    expect(outreachStatus(contact(), THREE_UNANSWERED, TODAY)).toMatchObject({
      state: 'awaiting_resume',
    });
  });

  it('counts extra messages sent off-rhythm', () => {
    const eager = [
      REPLIED,
      touch('2026-08-04', 'email'),
      touch('2026-08-05', 'email'),
    ];

    expect(outreachStatus(contact(), eager, '2026-08-10')).toMatchObject({
      strikes: 2,
    });
  });

  it('resets the loop when they reply again', () => {
    const repliedAtStrikeTwo = [
      ...THREE_UNANSWERED,
      touch('2026-08-13', 'email', 'inbound'),
    ];

    expect(outreachStatus(contact(), repliedAtStrikeTwo, TODAY)).toEqual({
      state: 'reply_owed',
      since: '2026-08-13',
    });
  });

  it('does not start a strike loop on an accepted connection request', () => {
    const accepted = [
      touch('2026-08-03', 'linkedinConnection'),
      touch('2026-08-05', 'linkedinConnection', 'inbound', 'accepted'),
    ];

    expect(outreachStatus(contact(), accepted, TODAY).state).toBe('running');
  });

  it('treats a reply on any channel the same way', () => {
    const onLinkedIn = [
      ...THREE_UNANSWERED,
      touch('2026-08-13', 'linkedinMessage', 'inbound'),
    ];

    expect(outreachStatus(contact(), onLinkedIn, TODAY).state).toBe(
      'reply_owed',
    );
  });
});

describe('§5 — the resume click is the only thing that restarts the cadence', () => {
  it('stays stopped while the reply is more recent than the resume', () => {
    const subject = contact({
      cadenceResumedAt: new Date('2026-08-01T00:00:00Z'),
    });

    expect(outreachStatus(subject, THREE_UNANSWERED, TODAY).state).toBe(
      'awaiting_resume',
    );
  });

  it('runs again once someone clicks resume', () => {
    const subject = contact({
      cadenceResumedAt: new Date('2026-08-14T00:00:00Z'),
    });

    expect(outreachStatus(subject, THREE_UNANSWERED, TODAY).state).toBe(
      'running',
    );
  });

  it('stops again on the next reply — unbounded, but every restart is a click', () => {
    const subject = contact({
      cadenceResumedAt: new Date('2026-08-14T00:00:00Z'),
    });
    const repliedAgain = [
      ...THREE_UNANSWERED,
      touch('2026-08-17', 'email', 'inbound'),
    ];

    expect(outreachStatus(subject, repliedAgain, TODAY).state).toBe(
      'reply_owed',
    );
  });
});

describe('ADR-0032 §4 amendment — a call is a chase, not a rung', () => {
  const CALL_BACK = touch('2026-08-04', 'call');

  it('clears the owed reply — phoning back is answering', () => {
    expect(
      outreachStatus(contact(), [REPLIED, CALL_BACK], '2026-08-06'),
    ).toEqual({
      state: 'in_conversation',
      strikes: 0,
      repliedOn: '2026-08-03',
    });
  });

  it('starts the strike clock from the call, not from their reply', () => {
    expect(
      outreachStatus(contact(), [REPLIED, CALL_BACK], '2026-08-07'),
    ).toMatchObject({ state: 'in_conversation', strikes: 1 });
  });

  it('counts a strike for each call that has gone three business days unanswered', () => {
    const phonedTwice = [REPLIED, CALL_BACK, touch('2026-08-07', 'meeting')];

    expect(outreachStatus(contact(), phonedTwice, '2026-08-11')).toMatchObject({
      strikes: 1,
    });
    expect(outreachStatus(contact(), phonedTwice, '2026-08-12')).toMatchObject({
      strikes: 2,
    });
  });

  it('does not let a follow or a comment answer a reply', () => {
    const followed = [REPLIED, touch('2026-08-04', 'follow')];

    expect(outreachStatus(contact(), followed, '2026-08-07')).toEqual({
      state: 'reply_owed',
      since: '2026-08-03',
    });
  });
});

describe('approved precise email ordering and fresh handover', () => {
  const precise = (time: string, direction: 'inbound' | 'outbound') => ({
    ...touch('2026-08-10', 'email', direction),
    occurredAtInstant: `2026-08-10T${time}:00Z`,
  });

  it('owes an answer to a later same-day reply and clears it only after our answer', () => {
    const history = [precise('14:00', 'inbound'), precise('09:00', 'outbound')];

    expect(computeOutreachStatus(contact(), history, TODAY, CONFIG)).toEqual({ state: 'replyOwed', since: '2026-08-10' });
    expect(computeOutreachStatus(contact(), [...history, precise('16:00', 'outbound')], TODAY, CONFIG)).toEqual({
      state: 'inConversation', repliedOn: '2026-08-10', strikes: 1,
    });
  });

  it('uses the latest of several same-day inbound replies regardless of input order', () => {
    const history = [precise('17:00', 'inbound'), precise('09:00', 'inbound'), precise('14:00', 'outbound')];

    expect(computeOutreachStatus(contact(), history, TODAY, CONFIG).state).toBe('replyOwed');
  });

  it('clears an older same-day debt on start fresh and allows a new same-day debt', () => {
    const subject = contact({ ownerSince: '2026-08-10', replyResetAt: '2026-08-10T12:00:00Z' });

    expect(computeOutreachStatus(subject, [precise('09:00', 'inbound')], TODAY, CONFIG).state).toBe('running');
    expect(computeOutreachStatus(subject, [precise('14:00', 'inbound')], TODAY, CONFIG).state).toBe('replyOwed');
    expect(computeOutreachStatus(contact(), [precise('09:00', 'inbound')], TODAY, CONFIG).state).toBe('replyOwed');
  });
});
