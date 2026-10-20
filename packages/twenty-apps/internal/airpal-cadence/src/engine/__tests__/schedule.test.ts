import { describe, expect, it } from 'vitest';

import { DEFAULT_CADENCE_CONFIG } from '../default-cadence-config';
import {
  isDue as isDueForConfig,
  proposeNextAction as proposeForConfig,
} from '../schedule';
import type { CadenceContact, CadenceTouch } from '../types';
import { contact, touch } from './fixtures';

// Ported from the predecessor's schedule.test.ts with identical expectations.

const CONFIG = DEFAULT_CADENCE_CONFIG;
const TODAY = '2026-08-17'; // a Monday

const proposeNextAction = (
  subject: CadenceContact,
  history: CadenceTouch[],
  today: string,
) => proposeForConfig(subject, history, today, CONFIG);

const isDue = (subject: CadenceContact, history: CadenceTouch[], today: string) =>
  isDueForConfig(subject, history, today, CONFIG);

const ACCEPTED_LADDER = [
  touch('2026-07-01', 'linkedinConnection'),
  touch('2026-07-03', 'linkedinConnection', 'inbound', 'accepted'),
  touch('2026-07-06', 'linkedinMessage'),
  touch('2026-07-09', 'linkedinMessage'),
];
const SEVEN_EMAILS = Array.from({ length: 7 }, (_, index) =>
  touch(`2026-07-${String(13 + index).padStart(2, '0')}`, 'email'),
);

describe('the running sequence — three business days', () => {
  it('puts an outbound touch three business days out', () => {
    const history = [...ACCEPTED_LADDER, touch('2026-08-17', 'email')];

    expect(proposeNextAction(contact(), history, TODAY)).toBe('2026-08-20');
  });

  it('skips the weekend', () => {
    const history = [...ACCEPTED_LADDER, touch('2026-08-21', 'email')];

    expect(proposeNextAction(contact(), history, '2026-08-21')).toBe(
      '2026-08-26',
    );
  });

  it('drips every 30 calendar days, not weekend-adjusted', () => {
    const history = [...ACCEPTED_LADDER, ...SEVEN_EMAILS];

    expect(proposeNextAction(contact(), history, TODAY)).toBe('2026-08-18');
  });

  it('proposes nothing when nothing has been sent — that contact is cold', () => {
    expect(proposeNextAction(contact(), [], TODAY)).toBeNull();
    expect(
      proposeNextAction(contact(), [touch('2026-08-01', 'follow')], TODAY),
    ).toBeNull();
  });

  it('ignores a social touch when counting from the last real one', () => {
    const history = [
      ...ACCEPTED_LADDER,
      touch('2026-08-17', 'email'),
      touch('2026-08-18', 'comment'),
    ];

    expect(proposeNextAction(contact(), history, TODAY)).toBe('2026-08-20');
  });
});

describe('§7 — what each stop schedules', () => {
  it('schedules nothing for opted out, dead or bounced', () => {
    expect(proposeNextAction(contact({ optedOut: true }), [], TODAY)).toBeNull();
    expect(proposeNextAction(contact({ health: 'dead' }), [], TODAY)).toBeNull();
    expect(proposeNextAction(contact({ stage: 'dead' }), [], TODAY)).toBeNull();

    const bounced = [
      ...ACCEPTED_LADDER,
      touch('2026-08-10', 'email', 'outbound', 'bounced'),
    ];

    expect(proposeNextAction(contact(), bounced, TODAY)).toBeNull();
  });

  it('puts an owed reply on today, and keeps it there', () => {
    const replied = [touch('2026-08-03', 'email', 'inbound')];

    expect(proposeNextAction(contact(), replied, TODAY)).toBe(TODAY);
    expect(proposeNextAction(contact(), replied, '2026-12-25')).toBe(
      '2026-12-25',
    );
  });

  it('uses the revisit date on hold, and nothing without one', () => {
    const held = contact({
      health: 'hold',
      revisitDate: new Date('2026-09-01T00:00:00Z'),
    });

    expect(proposeNextAction(held, [], TODAY)).toBe('2026-09-01');
    expect(proposeNextAction(contact({ health: 'hold' }), [], TODAY)).toBeNull();
  });

  it('uses the snooze date', () => {
    const snoozed = contact({ snoozeUntil: new Date('2026-09-04T00:00:00Z') });

    expect(proposeNextAction(snoozed, [], TODAY)).toBe('2026-09-04');
  });

  it('keeps a resume prompt on today until somebody clicks', () => {
    const decided = [
      touch('2026-08-03', 'email', 'inbound'),
      touch('2026-08-04', 'email'),
      touch('2026-08-07', 'email'),
      touch('2026-08-12', 'email'),
    ];

    expect(proposeNextAction(contact(), decided, TODAY)).toBe(TODAY);
    expect(proposeNextAction(contact(), decided, '2026-09-30')).toBe(
      '2026-09-30',
    );
  });

  it('chases three business days from our last message mid-conversation', () => {
    const answered = [
      touch('2026-08-03', 'email', 'inbound'),
      touch('2026-08-17', 'email'),
    ];

    expect(proposeNextAction(contact(), answered, TODAY)).toBe('2026-08-20');
  });
});

describe('isDue', () => {
  it('is due on and after the proposed date, not before', () => {
    const history = [...ACCEPTED_LADDER, touch('2026-08-17', 'email')];

    expect(isDue(contact(), history, '2026-08-19')).toBe(false);
    expect(isDue(contact(), history, '2026-08-20')).toBe(true);
    expect(isDue(contact(), history, '2026-08-21')).toBe(true);
  });

  it('is never due for anything §7 stops outright', () => {
    expect(isDue(contact({ health: 'dead' }), [], TODAY)).toBe(false);
    expect(isDue(contact({ optedOut: true }), [], TODAY)).toBe(false);
  });

  it('is due the day they reply', () => {
    expect(
      isDue(contact(), [touch('2026-08-17', 'email', 'inbound')], TODAY),
    ).toBe(true);
  });

  it('is not due while snoozed, and is again once it lapses', () => {
    const history = [...ACCEPTED_LADDER, touch('2026-08-17', 'email')];
    const snoozed = contact({ snoozeUntil: new Date('2026-08-20T00:00:00Z') });

    expect(isDue(snoozed, history, TODAY)).toBe(false);
    expect(isDue(snoozed, history, '2026-08-20')).toBe(true);
    expect(isDue(snoozed, history, '2026-08-21')).toBe(true);
  });

  it('lets a snoozed contact with no history fall to cold, not off the edge', () => {
    const snoozed = contact({ snoozeUntil: new Date('2026-08-20T00:00:00Z') });

    expect(proposeNextAction(snoozed, [], '2026-08-21')).toBeNull();
  });
});

describe('ADR-0032 §4 amendment — the last time we contacted them', () => {
  it('counts a call as our last contact, and schedules three business days from it', () => {
    const phoned = [
      touch('2026-08-03', 'email', 'inbound'),
      touch('2026-08-04', 'call'),
    ];

    expect(proposeNextAction(contact(), phoned, '2026-08-06')).toBe('2026-08-07');
  });
});
