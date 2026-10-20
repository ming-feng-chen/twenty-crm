import { describe, expect, it } from 'vitest';

import { touchForAction } from '../actions';
import { computeCadence } from '../compute-cadence';
import { DEFAULT_CADENCE_CONFIG } from '../default-cadence-config';
import { stageAfterTouch } from '../stage';
import { advancesSequence, isInMail, isOurContact, isReply } from '../touches';
import type {
  CadenceAction,
  CadenceConfig,
  CadenceContact,
  CadenceTouch,
  CadenceTouchTemplate,
} from '../types';
import { contact, touch } from './fixtures';

// The product owner's amendments to the predecessor's behaviour (SPEC §1).

const CONFIG = DEFAULT_CADENCE_CONFIG;

const cadence = (
  subject: CadenceContact,
  history: CadenceTouch[],
  today: string,
  config: CadenceConfig = CONFIG,
) => computeCadence({ contact: subject, touches: history, config, today });

const logs = (
  action: CadenceAction,
  subject: CadenceContact,
  history: CadenceTouch[],
  today: string,
) =>
  touchForAction({
    action,
    result: cadence(subject, history, today).position,
    contact: subject,
    config: CONFIG,
  });

const outbound = (channel: string) => ({ channel, direction: 'outbound', outcome: null });

const CONNECTION = touch('2026-07-01', 'linkedinConnection'); // a Wednesday
const ACCEPTED = touch('2026-07-03', 'linkedinConnection', 'inbound', 'accepted');
const LINKEDIN_LADDER = [
  CONNECTION,
  ACCEPTED,
  touch('2026-07-06', 'linkedinMessage'),
  touch('2026-07-09', 'linkedinMessage'),
];

describe('E1 — after the InMail or Skip, the sequence moves on to email', () => {
  const INMAIL = touch('2026-07-15', 'inmail');
  // How "Sent InMail" was logged before it had its own channel.
  const INMAIL_AS_MESSAGE = touch('2026-07-15', 'linkedinMessage');

  it('logs an InMail on the fourteenth day', () => {
    expect(cadence(contact(), [CONNECTION], '2026-07-15').actions).toEqual([
      'sentInMail',
      'skipToNextStep',
      'theyReplied',
      'theyAccepted',
    ]);
    expect(logs('sentInMail', contact(), [CONNECTION], '2026-07-15')).toEqual(
      outbound('inmail'),
    );
  });

  it('logs the configured InMail channel', () => {
    const config: CadenceConfig = {
      ...CONFIG,
      connectionRequest: { ...CONFIG.connectionRequest, inMailChannel: 'linkedinInMail' },
    };

    expect(
      touchForAction({
        action: 'sentInMail',
        result: cadence(contact(), [CONNECTION], '2026-07-15', config).position,
        contact: contact(),
        config,
      }),
    ).toEqual(outbound('linkedinInMail'));
  });

  it.each([
    ['an InMail', INMAIL],
    ['a LinkedIn message (older histories)', INMAIL_AS_MESSAGE],
  ])('reads Email 1 of 7 once due after %s, and Did it logs the email', (_name, sent) => {
    const history = [CONNECTION, sent];

    expect(cadence(contact(), history, '2026-07-17').isDue).toBe(false);
    expect(cadence(contact(), history, '2026-07-17').stepLabel).toBe('Email 1 of 7');

    const due = cadence(contact(), history, '2026-07-20');

    expect(due.isDue).toBe(true);
    expect(due.nextActionDate).toBe('2026-07-20');
    expect(due.stepLabel).toBe('Email 1 of 7');
    expect(due.positionLabel).toBe('Email 1 of 7');
    expect(due.prescribedTouch).toBe('email');
    expect(due.actions).toEqual(['didIt', 'theyReplied', 'somethingElse', 'theyAccepted']);
    expect(logs('didIt', contact(), history, '2026-07-20')).toEqual(outbound('email'));
  });

  it('counts the InMail as no step: the emails after it are 1, 2, 3 of 7', () => {
    const history = [CONNECTION, INMAIL, touch('2026-07-20', 'email'), touch('2026-07-23', 'email')];
    const due = cadence(contact(), history, '2026-07-28');

    expect(due.stepLabel).toBe('Email 3 of 7');
    expect(due.nextActionDate).toBe('2026-07-28');
  });

  it('runs the schedule from the InMail, like any sequence touch', () => {
    // Logged on the 16th, a day after the timeout opened.
    const late = [CONNECTION, touch('2026-07-16', 'inmail')];

    expect(cadence(contact(), late, '2026-07-16').nextActionDate).toBe('2026-07-21');
  });

  it('never offers the InMail again, even if a second one is logged', () => {
    for (const twice of [
      [CONNECTION, INMAIL, touch('2026-07-16', 'inmail')],
      [CONNECTION, INMAIL_AS_MESSAGE, touch('2026-07-16', 'linkedinMessage')],
      [CONNECTION, INMAIL, touch('2026-07-16', 'linkedinMessage')],
    ]) {
      expect(cadence(contact(), twice, '2026-07-21').stepLabel).toBe('Email 1 of 7');
      expect(cadence(contact(), twice, '2026-07-21').actions).not.toContain('sentInMail');
    }
  });

  it('is a sequence touch and our contact, but not a reply and not call-like', () => {
    const sent: CadenceTouchTemplate = { channel: 'inmail', direction: 'outbound', outcome: null };
    const answer: CadenceTouchTemplate = { ...sent, direction: 'inbound' };

    expect(advancesSequence(sent, CONFIG)).toBe(true);
    expect(isOurContact(sent, CONFIG)).toBe(true);
    expect(isInMail(sent, CONFIG)).toBe(true);
    expect(isReply(sent, CONFIG)).toBe(false);
    expect(stageAfterTouch('notContacted', sent, CONFIG)).toEqual({
      stage: 'contactedNoReply',
      change: 'started',
    });
    // An answer to it is a reply, as on any channel, and is not an InMail.
    expect(isInMail(answer, CONFIG)).toBe(false);
    expect(advancesSequence(answer, CONFIG)).toBe(false);
    expect(isReply(answer, CONFIG)).toBe(true);
  });

  it('counts as an unanswered follow-up for strikes', () => {
    const history = [
      CONNECTION,
      touch('2026-07-14', 'linkedinMessage', 'inbound'),
      touch('2026-07-15', 'inmail'),
    ];

    expect(cadence(contact(), history, '2026-07-16').stepLabel).toBe(
      'In conversation — answered, no strikes yet',
    );
    expect(cadence(contact(), history, '2026-07-20').stepLabel).toBe('Strike 1 of 3');
  });

  it('closes the gate only when sent after the request', () => {
    // An InMail before any request is outreach, but the request then sent
    // still waits for acceptance and offers the InMail after the timeout.
    const early = [touch('2026-06-24', 'inmail'), CONNECTION];

    expect(cadence(contact(), early, '2026-07-06').stepLabel).toBe(
      'Connection request — not accepted yet',
    );
    expect(cadence(contact(), early, '2026-07-15').actions).toContain('sentInMail');
  });

  it('does not close the gate when sent while the cadence was stopped', () => {
    const replied = touch('2026-07-10', 'linkedinMessage', 'inbound');
    const history = [CONNECTION, replied, INMAIL];

    expect(
      cadence(contact({ cadenceResumedAt: '2026-07-16' }), history, '2026-07-16').stepLabel,
    ).toBe('Connection request — not accepted after 14 days');
  });

  it('reads Email 2 of 7 after Skip to email logged the first one', () => {
    const skipped = [CONNECTION, touch('2026-07-15', 'email')];
    const due = cadence(contact(), skipped, '2026-07-20');

    expect(due.stepLabel).toBe('Email 2 of 7');
    expect(due.actions).toEqual(['didIt', 'theyReplied', 'somethingElse', 'theyAccepted']);
  });

  it('brings the LinkedIn messages back if they accept after the InMail', () => {
    const acceptance = touch('2026-07-16', 'linkedinConnection', 'inbound', 'accepted');

    // The InMail is not one of the two LinkedIn messages.
    expect(cadence(contact(), [CONNECTION, INMAIL, acceptance], '2026-07-17').stepLabel).toBe(
      'LinkedIn message 1 of 2',
    );
    // Logged as a LinkedIn message, it was the first of them.
    expect(
      cadence(contact(), [CONNECTION, INMAIL_AS_MESSAGE, acceptance], '2026-07-17').stepLabel,
    ).toBe('LinkedIn message 2 of 2');
  });
});

describe('E2 — nothing logs an email for a contact with no address', () => {
  const noAddress = contact({ hasEmail: false });

  it('offers Skip to email when there is an address, and it logs the email', () => {
    expect(cadence(contact(), [CONNECTION], '2026-07-15').actions).toContain('skipToNextStep');
    expect(logs('skipToNextStep', contact(), [CONNECTION], '2026-07-15')).toEqual(
      outbound('email'),
    );
  });

  it('offers Add email address in its place when there is none', () => {
    const result = cadence(noAddress, [CONNECTION], '2026-07-15');

    expect(result.actions).toEqual(['sentInMail', 'addEmailAddress', 'theyReplied', 'theyAccepted']);
    expect(logs('skipToNextStep', noAddress, [CONNECTION], '2026-07-15')).toBeNull();
    expect(logs('sentInMail', noAddress, [CONNECTION], '2026-07-15')).toEqual(
      outbound('inmail'),
    );
  });

  it('offers Skip again once an address is added', () => {
    const added = { ...noAddress, hasEmail: true };

    expect(cadence(added, [CONNECTION], '2026-07-15').actions).toEqual([
      'sentInMail',
      'skipToNextStep',
      'theyReplied',
      'theyAccepted',
    ]);
  });

  it('asks for the address on an unowned or not-started contact too', () => {
    expect(
      cadence({ ...noAddress, hasOwner: false }, LINKEDIN_LADDER, '2026-07-14').actions,
    ).toEqual(['addEmailAddress']);

    // No LinkedIn URL either: the first step is Email 1, which nobody can send.
    const unreachable = contact({ hasEmail: false, hasLinkedinUrl: false });

    expect(cadence(unreachable, [], '2026-07-14').stepLabel).toBe(
      'Not started — no LinkedIn URL on file',
    );
    expect(cadence(unreachable, [], '2026-07-14').actions).toEqual(['addEmailAddress']);
  });

  it('answers a reply on LinkedIn instead of email when that is the only thread', () => {
    // Email 1 is in play, there is no address, and they replied on LinkedIn.
    const replied = [...LINKEDIN_LADDER, touch('2026-07-13', 'linkedinMessage', 'inbound')];

    expect(cadence(noAddress, replied, '2026-07-14').actions).toEqual(['iReplied', 'somethingElse']);
    expect(logs('iReplied', noAddress, replied, '2026-07-14')).toEqual(
      outbound('linkedinMessage'),
    );

    const answered = [...replied, touch('2026-07-14', 'linkedinMessage')];

    expect(cadence(noAddress, answered, '2026-07-15').actions).toEqual([
      'iFollowedUp',
      'theyReplied',
      'somethingElse',
    ]);
    expect(logs('iFollowedUp', noAddress, answered, '2026-07-15')).toEqual(
      outbound('linkedinMessage'),
    );
    expect(logs('theyReplied', noAddress, answered, '2026-07-15')).toEqual({
      channel: 'linkedinMessage',
      direction: 'inbound',
      outcome: null,
    });
  });

  it('asks for the address when there is no LinkedIn URL to answer on either', () => {
    const unreachable = contact({ hasEmail: false, hasLinkedinUrl: false });
    const replied = [touch('2026-07-13', 'call', 'inbound')];

    expect(cadence(unreachable, replied, '2026-07-14').actions).toEqual([
      'addEmailAddress',
      'somethingElse',
    ]);
    expect(logs('iReplied', unreachable, replied, '2026-07-14')).toBeNull();

    const answered = [...replied, touch('2026-07-14', 'call')];

    expect(cadence(unreachable, answered, '2026-07-15').actions).toEqual([
      'addEmailAddress',
      'somethingElse',
    ]);
  });

  it('answers by email, as before, when the address exists', () => {
    const replied = [...LINKEDIN_LADDER, touch('2026-07-13', 'email', 'inbound')];

    expect(logs('iReplied', contact(), replied, '2026-07-14')).toEqual(outbound('email'));
  });
});

describe('E3 — I replied while the connection request is pending', () => {
  const replied = [CONNECTION, touch('2026-07-03', 'linkedinMessage', 'inbound')];

  it('logs a LinkedIn message rather than nothing', () => {
    const owed = cadence(contact(), replied, '2026-07-06');

    expect(owed.status).toEqual({ state: 'replyOwed', since: '2026-07-03' });
    expect(owed.position.position.kind).toBe('awaitingAcceptance');
    expect(owed.actions).toEqual(['iReplied', 'somethingElse', 'theyAccepted']);
    expect(logs('iReplied', contact(), replied, '2026-07-06')).toEqual(
      outbound('linkedinMessage'),
    );
  });

  it('logs the follow-up as a LinkedIn message too', () => {
    const answered = [...replied, touch('2026-07-06', 'linkedinMessage')];

    expect(cadence(contact(), answered, '2026-07-07').status.state).toBe('inConversation');
    expect(logs('iFollowedUp', contact(), answered, '2026-07-07')).toEqual(
      outbound('linkedinMessage'),
    );
  });

  it('answers on the step in play once the sequence has moved on to email', () => {
    const afterInMail = [
      CONNECTION,
      touch('2026-07-15', 'linkedinMessage'),
      touch('2026-07-16', 'email', 'inbound'),
    ];

    expect(logs('iReplied', contact(), afterInMail, '2026-07-17')).toEqual(outbound('email'));
  });
});

describe('E4 — the drip label counts the drip touches sent', () => {
  // Email 7 goes on Sunday 19 July; each drip goes 30 calendar days after the last.
  const SEVEN_EMAILS = Array.from({ length: 7 }, (_, index) =>
    touch(`2026-07-${String(13 + index).padStart(2, '0')}`, 'email'),
  );
  const ladder = [...LINKEDIN_LADDER, ...SEVEN_EMAILS];

  it('reads Drip, email 1, 2 and 3 with the same 30-day dates', () => {
    const first = cadence(contact(), ladder, '2026-07-20');

    expect(first.stepLabel).toBe('Drip, email 1');
    expect(first.nextActionDate).toBe('2026-08-18');

    const second = cadence(contact(), [...ladder, touch('2026-08-18', 'email')], '2026-08-18');

    expect(second.stepLabel).toBe('Drip, email 2');
    expect(second.nextActionDate).toBe('2026-09-17');

    const third = cadence(
      contact(),
      [...ladder, touch('2026-08-18', 'email'), touch('2026-09-17', 'email')],
      '2026-09-17',
    );

    expect(third.stepLabel).toBe('Drip, email 3');
    expect(third.nextActionDate).toBe('2026-10-17');
    expect(third.prescribedTouch).toBe('email');
  });

  it('does not age the number while the drip goes unsent', () => {
    const overdue = cadence(contact(), ladder, '2026-12-01');

    expect(overdue.stepLabel).toBe('Drip, email 1');
    expect(overdue.nextActionDate).toBe('2026-08-18');
    expect(overdue.isDue).toBe(true);
  });

  it('reads the step label and number alone without an occurrence noun', () => {
    const [connection, linkedin, email, drip] = CONFIG.steps;
    const config: CadenceConfig = {
      ...CONFIG,
      steps: [connection, linkedin, email, { ...drip, occurrenceNoun: undefined }],
    };

    expect(cadence(contact(), [...ladder, touch('2026-08-18', 'email')], '2026-08-18', config).stepLabel).toBe(
      'Drip 2',
    );
  });
});

describe('E5 — follows, comments, likes and profile views are not replies', () => {
  it('lists like as a non-advancing channel by default', () => {
    expect(CONFIG.nonAdvancingChannels).toEqual(['follow', 'comment', 'like', 'profileView']);

    for (const channel of CONFIG.nonAdvancingChannels) {
      expect(isReply(touch('2026-07-14', channel, 'inbound'), CONFIG), channel).toBe(false);
    }

    expect(isReply(touch('2026-07-14', 'email', 'inbound'), CONFIG)).toBe(true);
  });

  it('leaves a running sequence running after an inbound comment and like', () => {
    const history = [...LINKEDIN_LADDER, touch('2026-07-13', 'email')];
    const social = [
      ...history,
      touch('2026-07-14', 'comment', 'inbound'),
      touch('2026-07-15', 'like', 'inbound'),
    ];

    const result = cadence(contact(), social, '2026-07-16');

    expect(result.status.state).toBe('running');
    expect(result.stepLabel).toBe('Email 2 of 7');
    expect(result.nextActionDate).toBe('2026-07-16');
    expect(result).toEqual(cadence(contact(), history, '2026-07-16'));
  });

  it('leaves an owed reply owed since the real reply', () => {
    const replied = [touch('2026-08-03', 'email', 'inbound')];
    const social = [
      ...replied,
      touch('2026-08-05', 'comment', 'inbound'),
      touch('2026-08-06', 'like', 'inbound'),
    ];

    expect(cadence(contact(), social, '2026-08-07').stepLabel).toBe(
      'Reply to them — owed since 3 Aug 2026',
    );
    expect(cadence(contact(), social, '2026-08-07')).toEqual(
      cadence(contact(), replied, '2026-08-07'),
    );
  });

  it('does not reset the strikes', () => {
    const chased = [
      touch('2026-08-03', 'email', 'inbound'),
      touch('2026-08-04', 'email'),
      touch('2026-08-07', 'email'),
    ];
    const liked = [...chased, touch('2026-08-10', 'like', 'inbound')];

    expect(cadence(contact(), liked, '2026-08-12').stepLabel).toBe('Strike 2 of 3');
    expect(cadence(contact(), liked, '2026-08-12').strikes).toBe(2);
  });

  it('does not move the stage to replied', () => {
    expect(
      stageAfterTouch('contactedNoReply', touch('2026-08-10', 'like', 'inbound'), CONFIG),
    ).toEqual({ stage: 'contactedNoReply', change: null });
  });
});
