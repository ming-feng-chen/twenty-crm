import { describe, expect, it } from 'vitest';

import { touchForAction } from '../actions';
import { computeCadence } from '../compute-cadence';
import { DEFAULT_CADENCE_CONFIG } from '../default-cadence-config';
import { isLinkedInPosition } from '../position';
import { doesEditMoveSchedule } from '../schedule';
import { stageAfterTouch } from '../stage';
import { isTouchInFuture } from '../touches';
import type { CadenceContact, CadenceTouch } from '../types';
import { contact, touch } from './fixtures';

const CONFIG = DEFAULT_CADENCE_CONFIG;

const cadence = (
  subject: CadenceContact,
  history: CadenceTouch[],
  today: string,
) => computeCadence({ contact: subject, touches: history, config: CONFIG, today });

describe('approved handover behavior', () => {
  it('keeps late acceptance available until it is recorded', () => {
    const history = [touch('2026-08-01', 'linkedinConnection'), touch('2026-08-15', 'email')];

    expect(cadence(contact(), history, '2026-08-17').actions).toContain('theyAccepted');
    const accepted = touch('2026-08-17', 'linkedinConnection', 'inbound', 'accepted');
    expect(cadence(contact(), [...history, accepted], '2026-08-17').actions).not.toContain('theyAccepted');
    expect(cadence(contact({ ownerSince: '2026-08-16' }), history, '2026-08-17').actions).not.toContain('theyAccepted');
  });

  it('prescribes the connection request for an unowned contact without a LinkedIn URL', () => {
    const result = cadence(contact({ hasOwner: false, hasLinkedinUrl: false }), [], '2026-08-17');

    expect(result.prescribedTouch).toBe('linkedinConnection');
    expect(result.position.blockedReason).toBe('unowned');
    expect(result.actions).toContain('didIt');
  });
});

describe('the worked example, how-the-crm-works §14', () => {
  // Aditi has a LinkedIn URL and no email address.
  const aditi = contact({ stage: 'notContacted', hasEmail: false });
  const REQUEST = touch('2026-08-10', 'linkedinConnection');

  it('1 — sits on Cold before anything is sent', () => {
    const result = cadence(aditi, [], '2026-08-10');

    expect(result.nextActionDate).toBeNull();
    expect(result.stepLabel).toBe('Not started');
    expect(result.prescribedTouch).toBe('linkedinConnection');
    expect(result.actions).toEqual(['didIt', 'theyReplied', 'somethingElse']);
  });

  it('2 — the request moves the stage and schedules Thursday', () => {
    expect(stageAfterTouch('notContacted', REQUEST, CONFIG)).toEqual({
      stage: 'contactedNoReply',
      change: 'started',
    });

    const result = cadence(aditi, [REQUEST], '2026-08-10');

    expect(result.nextActionDate).toBe('2026-08-13');
    expect(result.isDue).toBe(false);
  });

  it('3 — Thursday shows connection pending, with They accepted', () => {
    const result = cadence(aditi, [REQUEST], '2026-08-13');

    expect(result.isDue).toBe(true);
    expect(result.stepLabel).toBe('Connection request — not accepted yet');
    expect(result.prescribedTouch).toBeNull();
    expect(result.actions).toEqual(['theyAccepted', 'theyReplied', 'somethingElse']);
  });

  it('4 — fourteen days on, offers Sent InMail or Skip to email', () => {
    const result = cadence(aditi, [REQUEST], '2026-08-24');

    expect(result.stepLabel).toBe('Connection request — not accepted after 14 days');
    // E2: Aditi has no address, so Add email address stands in for Skip to email.
    expect(result.actions).toEqual(['sentInMail', 'addEmailAddress', 'theyReplied', 'theyAccepted']);
    // E2: and nothing would log an email for her.
    expect(
      touchForAction({ action: 'skipToNextStep', result: result.position, contact: aditi, config: CONFIG }),
    ).toBeNull();
    expect(
      touchForAction({ action: 'sentInMail', result: result.position, contact: aditi, config: CONFIG }),
    ).toEqual({ channel: 'inmail', direction: 'outbound', outcome: null });
  });

  it('4 — after her InMail the row asks for an address for Email 1', () => {
    const sent = [REQUEST, touch('2026-08-24', 'inmail')];
    const result = cadence(aditi, sent, '2026-08-27');

    expect(result.stepLabel).toBe('Email 1 of 7 — no address on file');
    expect(result.actions).toEqual(['addEmailAddress', 'theyAccepted']);
    expect(result.nextActionDate).toBe('2026-08-27');
  });

  it('4 — skipping to email with no address leaves the row asking for one', () => {
    const skipped = [REQUEST, touch('2026-08-24', 'email')];
    const result = cadence(aditi, skipped, '2026-08-24');

    expect(result.stepLabel).toBe('Email 2 of 7 — no address on file');
    expect(result.actions).toEqual(['addEmailAddress', 'theyAccepted']);
    expect(result.nextActionDate).toBe('2026-08-27');
  });

  it('5 — had Aditi accepted, the LinkedIn messages come first', () => {
    const accepted = [
      REQUEST,
      touch('2026-08-12', 'linkedinConnection', 'inbound', 'accepted'),
    ];

    expect(
      touchForAction({
        action: 'theyAccepted',
        result: cadence(aditi, [REQUEST], '2026-08-12').position,
        contact: aditi,
        config: CONFIG,
      }),
    ).toEqual({ channel: 'linkedinConnection', direction: 'inbound', outcome: 'accepted' });
    expect(cadence(aditi, accepted, '2026-08-13').stepLabel).toBe('LinkedIn message 1 of 2');
  });

  it('6 — a reply stops the sequence, moves the stage and runs the three strikes', () => {
    const replied = [
      REQUEST,
      touch('2026-08-24', 'email'),
      touch('2026-08-26', 'linkedinMessage', 'inbound'),
    ];

    expect(
      stageAfterTouch('contactedNoReply', touch('2026-08-26', 'linkedinMessage', 'inbound'), CONFIG),
    ).toEqual({ stage: 'repliedInConversation', change: 'advanced' });

    const owed = cadence(aditi, replied, '2026-08-28');

    expect(owed.stepLabel).toBe('Reply to them — owed since 26 Aug 2026');
    expect(owed.nextActionDate).toBe('2026-08-28');
    expect(owed.actions).toEqual(['iReplied', 'somethingElse', 'theyAccepted']);

    const answered = [...replied, touch('2026-08-27', 'linkedinMessage')];

    expect(cadence(aditi, answered, '2026-08-28').stepLabel).toBe(
      'In conversation — answered, no strikes yet',
    );
    expect(cadence(aditi, answered, '2026-08-28').nextActionDate).toBe('2026-09-01');
    expect(cadence(aditi, answered, '2026-09-01').stepLabel).toBe('Strike 1 of 3');

    const chased = [
      ...answered,
      touch('2026-09-01', 'linkedinMessage'),
      touch('2026-09-04', 'linkedinMessage'),
    ];
    const decide = cadence(aditi, chased, '2026-09-09');

    expect(decide.stepLabel).toBe(
      'Awaiting resume — 3 follow-ups unanswered since they replied on 26 Aug 2026',
    );
    expect(decide.strikes).toBe(3);
    expect(decide.actions).toEqual(['resumeCadence', 'theyAccepted']);

    // The conversation consumed no steps: the sequence resumes where it stopped.
    const resumed = cadence({ ...aditi, cadenceResumedAt: '2026-09-09' }, chased, '2026-09-09');

    expect(resumed.stepLabel).toBe('Email 2 of 7 — no address on file');
  });
});

describe('undo is deleting a touch', () => {
  it('recomputes to exactly the state before the touch was logged', () => {
    const before = [touch('2026-07-01', 'linkedinConnection')];
    const after = [...before, touch('2026-07-16', 'email')];

    expect(cadence(contact(), after, '2026-07-17').stepLabel).toBe('Email 2 of 7');
    expect(cadence(contact(), before, '2026-07-17')).toEqual(
      cadence(contact(), after.slice(0, 1), '2026-07-17'),
    );
    expect(cadence(contact(), before, '2026-07-17').stepLabel).toBe(
      'Connection request — not accepted after 14 days',
    );
  });
});

describe('a next action date typed by hand', () => {
  const history = [touch('2026-08-17', 'email')];

  it('wins over the proposal and decides whether the row is due', () => {
    const typed = contact({ nextActionDateOverride: '2026-08-18' });
    const result = cadence(typed, history, '2026-08-18');

    expect(result.proposedNextActionDate).toBe('2026-08-20');
    expect(result.nextActionDate).toBe('2026-08-18');
    expect(result.isDue).toBe(true);
    expect(cadence(contact(), history, '2026-08-18').isDue).toBe(false);
  });
});

describe('an edit moves the schedule only when it starts or ends a stop', () => {
  const history = [touch('2026-08-17', 'email')];
  const running = contact();

  const moves = (after: CadenceContact, before: CadenceContact = running) =>
    doesEditMoveSchedule({ before, after, touches: history, today: '2026-08-18', config: CONFIG });

  it('moves for snooze, hold, dead and opt-out', () => {
    expect(moves({ ...running, snoozeUntil: '2026-09-01' })).toBe(true);
    expect(moves({ ...running, health: 'hold' })).toBe(true);
    expect(moves({ ...running, stage: 'dead' })).toBe(true);
    expect(moves({ ...running, optedOut: true })).toBe(true);
    expect(moves(running, { ...running, health: 'hold' })).toBe(true);
  });

  it('leaves a typed date alone for an ordinary stage move or any other edit', () => {
    expect(moves({ ...running, stage: 'pilotDiscussion' }, { ...running, stage: 'deckSent' })).toBe(false);
    expect(moves({ ...running, hasEmail: false })).toBe(false);
    expect(moves({ ...running, snoozeUntil: null })).toBe(false);
  });
});

describe('the automatic stage moves', () => {
  it('starts on our first approach, including a call, but not on a follow', () => {
    expect(stageAfterTouch('notContacted', touch('2026-08-17', 'call'), CONFIG).change).toBe('started');
    expect(stageAfterTouch('notContacted', touch('2026-08-17', 'follow'), CONFIG)).toEqual({
      stage: 'notContacted',
      change: null,
    });
  });

  it('moves nothing when they approach us first, or when a request is accepted', () => {
    expect(
      stageAfterTouch('notContacted', touch('2026-08-17', 'email', 'inbound'), CONFIG).change,
    ).toBeNull();
    expect(
      stageAfterTouch(
        'contactedNoReply',
        touch('2026-08-17', 'linkedinConnection', 'inbound', 'accepted'),
        CONFIG,
      ).change,
    ).toBeNull();
  });

  it('never moves a stage a person set beyond the first reply', () => {
    expect(stageAfterTouch('deckSent', touch('2026-08-17', 'email', 'inbound'), CONFIG)).toEqual({
      stage: 'deckSent',
      change: null,
    });
  });
});

describe('the InMail and skip branches', () => {
  const CONNECTION = touch('2026-07-01', 'linkedinConnection');

  // E1: the predecessor stayed on "Connection request" after Skip to email, and
  // on "InMail" after an InMail. The engine moves on to the email steps.
  it('moves on to the next email once an email is logged instead of waiting', () => {
    const skipped = [CONNECTION, touch('2026-07-15', 'email')];

    expect(cadence(contact(), skipped, '2026-07-16').stepLabel).toBe('Email 2 of 7');
  });

  it('moves on to Email 1 once the InMail is logged, then counts emails', () => {
    const inMail = [CONNECTION, touch('2026-07-15', 'linkedinMessage')];

    expect(cadence(contact(), inMail, '2026-07-16').stepLabel).toBe('Email 1 of 7'); // E1: was 'InMail'
    expect(cadence(contact(), inMail, '2026-07-16').actions).toEqual([
      'didIt',
      'theyReplied',
      'somethingElse',
      'theyAccepted',
    ]);
    expect(
      cadence(contact(), [...inMail, touch('2026-07-20', 'email')], '2026-07-21').stepLabel,
    ).toBe('Email 2 of 7');
  });

  it('brings the LinkedIn messages back if they accept after emails started', () => {
    const lateAcceptance = [
      CONNECTION,
      touch('2026-07-15', 'email'),
      touch('2026-07-20', 'email'),
      touch('2026-07-22', 'linkedinConnection', 'inbound', 'accepted'),
    ];

    expect(cadence(contact(), lateAcceptance, '2026-07-23').stepLabel).toBe(
      'LinkedIn message 1 of 2',
    );
  });

  it('passes the LinkedIn messages by once all seven emails are sent', () => {
    const history = [
      CONNECTION,
      ...Array.from({ length: 7 }, (_, index) =>
        touch(`2026-07-${String(13 + index).padStart(2, '0')}`, 'email'),
      ),
      touch('2026-07-22', 'linkedinConnection', 'inbound', 'accepted'),
    ];

    expect(cadence(contact(), history, '2026-07-23').stepLabel).toBe('Drip, email 1'); // E4
  });
});

describe('positions bound to one owner’s LinkedIn account', () => {
  it('are the pending request and the LinkedIn messages', () => {
    const at = (history: CadenceTouch[]) =>
      isLinkedInPosition(cadence(contact(), history, '2026-07-05').position, CONFIG);
    const CONNECTION = touch('2026-07-01', 'linkedinConnection');

    expect(at([])).toBe(false);
    expect(at([CONNECTION])).toBe(true);
    // E1: after the InMail the next step is an email, which a handover can carry.
    expect(at([CONNECTION, touch('2026-07-02', 'linkedinMessage')])).toBe(false);
    expect(at([CONNECTION, touch('2026-07-02', 'linkedinConnection', 'inbound', 'accepted')])).toBe(true);
    expect(at([touch('2026-07-02', 'email')])).toBe(false);
  });
});

describe('inputs', () => {
  it('treats civil-date strings and midnight instants alike in London', () => {
    const asDates = [touch('2026-07-01', 'linkedinConnection'), touch('2026-07-15', 'email')];
    const asStrings = asDates.map((entry) => ({
      ...entry,
      occurredAt: (entry.occurredAt as Date).toISOString().slice(0, 10),
    }));

    expect(cadence(contact(), asStrings, '2026-07-16')).toEqual(
      cadence(contact(), asDates, '2026-07-16'),
    );
  });

  it('flags a future-dated touch so the write path can refuse it', () => {
    expect(isTouchInFuture(touch('2026-08-18', 'email'), '2026-08-17', CONFIG)).toBe(true);
    expect(isTouchInFuture(touch('2026-08-17', 'email'), '2026-08-17', CONFIG)).toBe(false);
  });

  it('rejects an impossible date rather than guessing', () => {
    expect(() =>
      cadence(contact(), [{ ...touch('2026-08-17', 'email'), occurredAt: '2026-02-30' }], '2026-08-17'),
    ).toThrow(/Not a real calendar date/);
  });
});
