import { describe, expect, it } from 'vitest';

import { touchForAction } from '../actions';
import { computeCadence } from '../compute-cadence';
import { DEFAULT_CADENCE_CONFIG } from '../default-cadence-config';
import type {
  CadenceConfig,
  CadenceContact,
  CadenceStepDefinition,
  CadenceTouch,
} from '../types';
import { validateCadenceConfig } from '../validate-cadence-config';
import { contact, touch } from './fixtures';

const [CONNECTION_STEP, LINKEDIN_STEP, EMAIL_STEP, DRIP_STEP] =
  DEFAULT_CADENCE_CONFIG.steps;

const withSteps = (
  steps: CadenceStepDefinition[],
  overrides: Partial<CadenceConfig> = {},
): CadenceConfig => ({ ...DEFAULT_CADENCE_CONFIG, steps, ...overrides });

const run = (
  config: CadenceConfig,
  history: CadenceTouch[],
  today: string,
  subject: CadenceContact = contact(),
) => computeCadence({ contact: subject, touches: history, config, today });

const CONNECTION = touch('2026-07-01', 'linkedinConnection');
const ACCEPTED = touch('2026-07-03', 'linkedinConnection', 'inbound', 'accepted');
const LINKEDIN_LADDER = [
  CONNECTION,
  ACCEPTED,
  touch('2026-07-06', 'linkedinMessage'),
  touch('2026-07-09', 'linkedinMessage'),
];
const emails = (count: number, from = 13): CadenceTouch[] =>
  Array.from({ length: count }, (_, index) =>
    touch(`2026-07-${String(from + index).padStart(2, '0')}`, 'email'),
  );

describe('a WhatsApp step between LinkedIn and email', () => {
  const WHATSAPP_STEP: CadenceStepDefinition = {
    key: 'whatsapp',
    label: 'WhatsApp',
    channel: 'whatsapp',
    repeat: 1,
    gapBefore: { amount: 3, unit: 'businessDays' },
  };
  const config = withSteps([
    CONNECTION_STEP,
    LINKEDIN_STEP,
    WHATSAPP_STEP,
    EMAIL_STEP,
    DRIP_STEP,
  ]);

  it('is valid', () => {
    expect(validateCadenceConfig(config)).toEqual([]);
  });

  it('comes after the second LinkedIn message and is what Did it logs', () => {
    const result = run(config, LINKEDIN_LADDER, '2026-07-14');

    expect(result.position.position).toEqual({
      kind: 'step',
      stepKey: 'whatsapp',
      occurrence: 1,
    });
    expect(result.stepLabel).toBe('WhatsApp');
    expect(result.prescribedTouch).toBe('whatsapp');
    expect(result.nextActionDate).toBe('2026-07-14');
    expect(result.isDue).toBe(true);
  });

  it('hands over to Email 1 once the WhatsApp message is logged', () => {
    const history = [...LINKEDIN_LADDER, touch('2026-07-14', 'whatsapp')];
    const result = run(config, history, '2026-07-15');

    expect(result.stepLabel).toBe('Email 1 of 7');
    expect(result.nextActionDate).toBe('2026-07-17');
  });

  it('is skipped over when an email is logged instead', () => {
    const history = [...LINKEDIN_LADDER, touch('2026-07-14', 'email')];

    expect(run(config, history, '2026-07-15').stepLabel).toBe('Email 2 of 7');
  });

  it('is what Skip moves on to after fourteen days unaccepted', () => {
    const result = run(config, [CONNECTION], '2026-07-15');

    expect(result.actions).toEqual(['sentInMail', 'skipToNextStep', 'theyReplied', 'theyAccepted']);
    expect(
      touchForAction({
        action: 'skipToNextStep',
        result: result.position,
        contact: contact(),
        config,
      }),
    ).toEqual({ channel: 'whatsapp', direction: 'outbound', outcome: null });
  });

  it('treats an inbound WhatsApp message as a reply', () => {
    const history = [...LINKEDIN_LADDER, touch('2026-07-14', 'whatsapp', 'inbound')];

    expect(run(config, history, '2026-07-15').status).toEqual({
      state: 'replyOwed',
      since: '2026-07-14',
    });
  });

  it('never advances the default cadence, which has no WhatsApp step, but still answers a reply', () => {
    const history = [...LINKEDIN_LADDER, touch('2026-07-14', 'whatsapp')];

    expect(run(DEFAULT_CADENCE_CONFIG, history, '2026-07-15').stepLabel).toBe(
      'Email 1 of 7',
    );

    const replied = [
      touch('2026-07-14', 'email', 'inbound'),
      touch('2026-07-15', 'whatsapp'),
    ];

    expect(run(DEFAULT_CADENCE_CONFIG, replied, '2026-07-16').status.state).toBe(
      'inConversation',
    );
  });
});

describe('five emails instead of seven', () => {
  const config = withSteps([
    CONNECTION_STEP,
    LINKEDIN_STEP,
    { ...EMAIL_STEP, repeat: 5 },
    DRIP_STEP,
  ]);

  it('counts to five and then drips', () => {
    expect(run(config, [...LINKEDIN_LADDER, ...emails(4)], '2026-07-20').stepLabel).toBe(
      'Email 5 of 5',
    );

    const fiveSent = run(config, [...LINKEDIN_LADDER, ...emails(5)], '2026-07-20');

    expect(fiveSent.stepLabel).toBe('Drip, email 1'); // E4
    expect(fiveSent.nextActionDate).toBe('2026-08-16');
  });
});

describe('a two-calendar-day gap', () => {
  const config = withSteps([
    CONNECTION_STEP,
    LINKEDIN_STEP,
    { ...EMAIL_STEP, gapBefore: { amount: 2, unit: 'calendarDays' } },
    DRIP_STEP,
  ]);

  it('lands on a weekend if that is two days later', () => {
    const history = [...LINKEDIN_LADDER, touch('2026-07-17', 'email')];

    expect(run(config, history, '2026-07-17').nextActionDate).toBe('2026-07-19');
  });

  it('uses the gap of the step being waited for, so the first email still waits it', () => {
    expect(run(config, LINKEDIN_LADDER, '2026-07-09').nextActionDate).toBe(
      '2026-07-11',
    );
  });
});

describe('the drip removed', () => {
  const config = withSteps([CONNECTION_STEP, LINKEDIN_STEP, EMAIL_STEP]);

  it('ends after the seventh email and the contact goes to Cold', () => {
    const result = run(config, [...LINKEDIN_LADDER, ...emails(7)], '2026-07-20');

    expect(result.position.position).toEqual({ kind: 'sequenceComplete' });
    expect(result.stepLabel).toBe('Sequence complete');
    expect(result.nextActionDate).toBeNull();
    expect(result.isDue).toBe(false);
    expect(result.prescribedTouch).toBeNull();
    expect(result.actions).toEqual(['theyReplied', 'somethingElse']);
  });

  it('still stops and owes a reply when they answer after it ended', () => {
    const history = [
      ...LINKEDIN_LADDER,
      ...emails(7),
      touch('2026-08-03', 'email', 'inbound'),
    ];

    expect(run(config, history, '2026-08-04').status).toEqual({
      state: 'replyOwed',
      since: '2026-08-03',
    });
  });

  it('logs a reply on the last step when nothing is prescribed', () => {
    const result = run(config, [...LINKEDIN_LADDER, ...emails(7)], '2026-07-20');

    expect(
      touchForAction({
        action: 'theyReplied',
        result: result.position,
        contact: contact(),
        config,
      }),
    ).toEqual({ channel: 'email', direction: 'inbound', outcome: null });
  });
});

describe('weekends not skipped', () => {
  const config = withSteps([...DEFAULT_CADENCE_CONFIG.steps], {
    skipWeekends: false,
  });

  it('counts business-day gaps as plain days', () => {
    const history = [...LINKEDIN_LADDER, touch('2026-08-21', 'email')];

    expect(run(config, history, '2026-08-21').nextActionDate).toBe('2026-08-24');
    expect(run(DEFAULT_CADENCE_CONFIG, history, '2026-08-21').nextActionDate).toBe(
      '2026-08-26',
    );
  });

  it('lets a strike accrue over a weekend', () => {
    const history = [
      touch('2026-08-20', 'email', 'inbound'),
      touch('2026-08-21', 'email'),
    ];

    expect(run(config, history, '2026-08-24').stepLabel).toBe('Strike 1 of 3');
    expect(run(DEFAULT_CADENCE_CONFIG, history, '2026-08-24').stepLabel).toBe(
      'In conversation — answered, no strikes yet',
    );
  });
});

describe('a strike limit of two', () => {
  const config = withSteps([...DEFAULT_CADENCE_CONFIG.steps], { strikeLimit: 2 });
  const history = [
    touch('2026-08-03', 'email', 'inbound'),
    touch('2026-08-04', 'email'),
    touch('2026-08-07', 'email'),
  ];

  it('reads Strike 1 of 2, then asks to resume at the second', () => {
    expect(run(config, history, '2026-08-07').stepLabel).toBe('Strike 1 of 2');

    const decided = run(config, history, '2026-08-12');

    expect(decided.status).toEqual({
      state: 'awaitingResume',
      repliedOn: '2026-08-03',
    });
    expect(decided.strikes).toBe(2);
    expect(decided.stepLabel).toBe(
      'Awaiting resume — 2 follow-ups unanswered since they replied on 3 Aug 2026',
    );
    expect(decided.actions).toEqual(['resumeCadence']);
    expect(decided.nextActionDate).toBe('2026-08-12');
  });

  it('stays in conversation at the same point under the default limit', () => {
    expect(run(DEFAULT_CADENCE_CONFIG, history, '2026-08-12').stepLabel).toBe(
      'Strike 2 of 3',
    );
  });
});

describe('a longer strike silence', () => {
  const config = withSteps([...DEFAULT_CADENCE_CONFIG.steps], {
    strikeSilenceGap: { amount: 5, unit: 'businessDays' },
  });
  const history = [
    touch('2026-08-03', 'email', 'inbound'),
    touch('2026-08-04', 'email'),
  ];

  it('waits five business days for the strike and the follow-up', () => {
    expect(run(config, history, '2026-08-10').strikes).toBe(0);
    expect(run(config, history, '2026-08-11').strikes).toBe(1);
    expect(run(config, history, '2026-08-05').nextActionDate).toBe('2026-08-11');
  });
});

describe('a shorter acceptance timeout', () => {
  const config = withSteps([...DEFAULT_CADENCE_CONFIG.steps], {
    connectionRequest: {
      ...DEFAULT_CADENCE_CONFIG.connectionRequest,
      acceptanceTimeout: { amount: 7, unit: 'calendarDays' },
    },
  });

  it('offers InMail after seven days and says so', () => {
    expect(run(config, [CONNECTION], '2026-07-07').stepLabel).toBe(
      'Connection request — not accepted yet',
    );
    expect(run(config, [CONNECTION], '2026-07-08').stepLabel).toBe(
      'Connection request — not accepted after 7 days',
    );
  });
});

describe('a different time zone', () => {
  const config = withSteps([...DEFAULT_CADENCE_CONFIG.steps], {
    timeZone: 'America/New_York',
  });
  // 23:30 UTC on Thursday is Friday in London and still Thursday in New York.
  const lateThursday: CadenceTouch = {
    channel: 'email',
    direction: 'outbound',
    outcome: null,
    occurredAt: new Date('2026-08-20T23:30:00Z'),
  };

  it('reads an instant on the calendar of the configured zone', () => {
    const history = [...LINKEDIN_LADDER, lateThursday];

    expect(run(config, history, '2026-08-21').nextActionDate).toBe('2026-08-25');
    expect(run(DEFAULT_CADENCE_CONFIG, history, '2026-08-21').nextActionDate).toBe(
      '2026-08-26',
    );
  });

  it('takes date-only values as written, in any zone', () => {
    const history = [
      ...LINKEDIN_LADDER,
      { ...lateThursday, occurredAt: '2026-08-20' },
    ];
    const snoozed = contact({ snoozeUntil: '2026-09-01' });

    expect(run(config, history, '2026-08-21').nextActionDate).toBe('2026-08-25');
    expect(run(config, history, '2026-08-21', snoozed).nextActionDate).toBe(
      '2026-09-01',
    );
  });

  it('takes today as an instant in that zone too', () => {
    // Due on Thursday 20 Aug; 02:00 UTC that day is still Wednesday in New York.
    const history: CadenceTouch[] = [
      ...LINKEDIN_LADDER,
      { channel: 'email', direction: 'outbound', outcome: null, occurredAt: '2026-08-17' },
    ];
    const result = computeCadence({
      contact: contact(),
      touches: history,
      config,
      today: new Date('2026-08-20T02:00:00Z'),
    });

    expect(result.isDue).toBe(false);
    expect(
      computeCadence({
        contact: contact(),
        touches: history,
        config: DEFAULT_CADENCE_CONFIG,
        today: new Date('2026-08-20T02:00:00Z'),
      }).isDue,
    ).toBe(true);
  });
});

describe('LinkedIn messages without the acceptance gate', () => {
  const config = withSteps([
    CONNECTION_STEP,
    { ...LINKEDIN_STEP, gate: undefined },
    EMAIL_STEP,
    DRIP_STEP,
  ]);

  it('prescribes the first message straight after the request', () => {
    const result = run(config, [CONNECTION], '2026-07-06');

    expect(result.stepLabel).toBe('LinkedIn message 1 of 2');
    expect(result.prescribedTouch).toBe('linkedinMessage');
    expect(result.nextActionDate).toBe('2026-07-06');
  });
});

describe('email steps skipped rather than blocked', () => {
  const config = withSteps([
    CONNECTION_STEP,
    LINKEDIN_STEP,
    { ...EMAIL_STEP, whenDataMissing: 'skip' },
    { ...DRIP_STEP, whenDataMissing: 'skip' },
  ]);

  it('ends after LinkedIn for a contact with no address, and says why', () => {
    const result = run(config, LINKEDIN_LADDER, '2026-07-14', contact({ hasEmail: false }));

    expect(result.position).toEqual({
      position: { kind: 'sequenceComplete' },
      blockedReason: 'noEmailAddress',
    });
    expect(result.nextActionDate).toBeNull();
  });
});
