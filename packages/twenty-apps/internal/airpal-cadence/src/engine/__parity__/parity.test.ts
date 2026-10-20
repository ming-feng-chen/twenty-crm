import { describe, expect, it } from 'vitest';

// The predecessor engine, imported read-only from its own repo. If that repo
// moves, this suite fails to load rather than silently passing.
import * as legacy from '../../../../../../../../crm/packages/core/src/cadence/index.ts';
import type {
  CadenceActivity as LegacyActivity,
  CadenceContact as LegacyContact,
  Channel as LegacyChannel,
  OutreachStatus as LegacyStatus,
  PositionResult as LegacyPositionResult,
  Stage as LegacyStage,
} from '../../../../../../../../crm/packages/core/src/cadence/types.ts';
import {
  positionLabel as legacyPositionLabel,
  statusLabel as legacyStatusLabel,
} from '../../../../../../../../crm/apps/web/lib/cadence-label.ts';
import { myDayActions as legacyActions } from '../../../../../../../../crm/apps/web/lib/my-day-actions.ts';

import { addCalendarDays } from '../business-days';
import { computeCadence } from '../compute-cadence';
import { DEFAULT_CADENCE_CONFIG } from '../default-cadence-config';
import type {
  CadenceAction,
  CadenceContact,
  CadenceStage,
  CadenceTouch,
} from '../types';
import {
  ACTION_FROM_LEGACY,
  LEGACY_CHANNELS,
  toLegacyResult,
  toLegacyStatus,
} from '../__tests__/legacy-view';

const CONFIG = DEFAULT_CADENCE_CONFIG;
const RANDOM_HISTORIES = 400;
const WALKED_HISTORIES = 300;

// mulberry32: small, fast and deterministic across runs and machines.
const createRandom = (seed: number) => {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;

    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);

    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };

  const integer = (minimum: number, maximum: number): number =>
    minimum + Math.floor(next() * (maximum - minimum + 1));

  const chance = (probability: number): boolean => next() < probability;

  const pick = <TItem>(items: readonly TItem[]): TItem =>
    items[Math.floor(next() * items.length)];

  const weighted = <TItem>(entries: readonly [TItem, number][]): TItem => {
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = next() * total;

    for (const [item, weight] of entries) {
      roll -= weight;

      if (roll < 0) {
        return item;
      }
    }

    return entries[entries.length - 1][0];
  };

  return { next, integer, chance, pick, weighted };
};

type Random = ReturnType<typeof createRandom>;

// The InMails the walk sends that the engine sees on its own InMail channel
// (E1: "Sent InMail" logs an InMail). The predecessor logged an InMail as a
// LinkedIn message, which is what it is shown; every other InMail stays a
// LinkedIn message for the engine too, as older histories logged it.
// Alternating keeps both kinds in every run without drawing on the random
// stream, so the histories themselves do not change.
const ENGINE_IN_MAILS = new WeakSet<LegacyActivity>();
let inMailsSent = 0;

const WINDOW_START = '2026-05-01';

const dayIn = (random: Random, from: string, span: number): string =>
  addCalendarDays(from, random.integer(0, span));

// Mostly midnight UTC, as the date column stores it, plus late-evening and
// random hours so the BST edge and same-day ordering are exercised.
const instantOn = (random: Random, day: string): Date => {
  const roll = random.next();

  if (roll < 0.75) {
    return new Date(`${day}T00:00:00Z`);
  }

  if (roll < 0.9) {
    return new Date(`${day}T23:30:00Z`);
  }

  const hour = String(random.integer(0, 23)).padStart(2, '0');

  return new Date(`${day}T${hour}:${String(random.integer(0, 59)).padStart(2, '0')}:00Z`);
};

const midnight = (day: string): Date => new Date(`${day}T00:00:00Z`);

const STAGES: readonly [LegacyStage, number][] = [
  ['not_contacted', 25],
  ['contacted_no_reply', 40],
  ['replied_in_conversation', 15],
  ['deck_sent', 8],
  ['pilot_discussion', 4],
  ['dead', 3],
];

const STAGE_TO_ENGINE: Record<LegacyStage, CadenceStage> = {
  not_contacted: 'notContacted',
  contacted_no_reply: 'contactedNoReply',
  replied_in_conversation: 'repliedInConversation',
  deck_sent: 'deckSent',
  meeting_scheduled: 'meetingScheduled',
  deck_reviewed_follow_up: 'deckReviewedFollowUp',
  pilot_discussion: 'pilotDiscussion',
  pilot_agreed: 'pilotAgreed',
  dead: 'dead',
};

const randomContact = (random: Random): LegacyContact => {
  const health = random.weighted<LegacyContact['health']>([
    ['active', 85],
    ['hold', 10],
    ['dead', 5],
  ]);

  return {
    stage: random.weighted(STAGES),
    health,
    ownerId: random.chance(0.92) ? 'owner' : null,
    ownerSince: random.chance(0.15)
      ? instantOn(random, dayIn(random, WINDOW_START, 150))
      : null,
    email: random.chance(0.6) ? 'someone@example.com' : null,
    linkedinUrl: random.chance(0.8) ? 'https://linkedin.com/in/someone' : null,
    outreachSuspendedAt: random.chance(0.03) ? midnight(WINDOW_START) : null,
    cadenceResumedAt: random.chance(0.2)
      ? instantOn(random, dayIn(random, WINDOW_START, 150))
      : null,
    snoozeUntil: random.chance(0.12)
      ? midnight(dayIn(random, WINDOW_START, 200))
      : null,
    revisitDate: random.chance(health === 'hold' ? 0.6 : 0.05)
      ? midnight(dayIn(random, WINDOW_START, 200))
      : null,
    nextActionAt: null,
  };
};

const randomActivity = (random: Random, day: string): LegacyActivity => {
  const channel = random.weighted<LegacyChannel>([
    ['linkedin_connection', 15],
    ['linkedin_message', 20],
    ['email', 35],
    ['social', 15],
    ['other', 15],
  ]);
  const direction = random.chance(0.75) ? 'outbound' : 'inbound';
  const outcome = random.weighted<LegacyActivity['outcome']>([
    [null, 80],
    ['accepted', 7],
    ['bounced', channel === 'email' ? 5 : 1],
    ['replied', 3],
    ['sent', 3],
    ['ignored', 2],
  ]);

  return { channel, direction, outcome, occurredAt: instantOn(random, day) };
};

const randomHistory = (random: Random): LegacyActivity[] => {
  const start = dayIn(random, WINDOW_START, 60);

  return Array.from({ length: random.integer(0, 14) }, () =>
    randomActivity(random, dayIn(random, start, 120)),
  );
};

// Follows the legacy engine's own prescriptions, so long ladders, the drip,
// the InMail choice, resumes and strike loops all actually occur.
const walkedHistory = (
  random: Random,
  contact: LegacyContact,
): LegacyActivity[] => {
  const activities: LegacyActivity[] = [];
  let day = dayIn(random, WINDOW_START, 40);

  const log = (
    channel: LegacyChannel,
    direction: 'outbound' | 'inbound',
    outcome: LegacyActivity['outcome'] = null,
    on: string = day,
  ) => activities.push({ channel, direction, outcome, occurredAt: instantOn(random, on) });

  for (let move = 0; move < random.integer(4, 30); move += 1) {
    const status = legacy.outreachStatus(contact, activities, day);

    switch (status.state) {
      case 'opted_out':
      case 'dead':
      case 'bounced':
      case 'hold':
      case 'snoozed':
        if (random.chance(0.3)) {
          log(random.pick<LegacyChannel>(['email', 'other', 'social']), 'outbound');
        }
        break;
      case 'reply_owed':
        if (random.chance(0.8)) {
          log(random.pick<LegacyChannel>(['email', 'other', 'linkedin_message']), 'outbound');
        }
        break;
      case 'in_conversation':
        if (random.chance(0.25)) {
          log(random.pick<LegacyChannel>(['email', 'other']), 'inbound');
        } else if (random.chance(0.6)) {
          log('email', 'outbound');
        }
        break;
      case 'awaiting_resume':
        if (random.chance(0.6)) {
          contact.cadenceResumedAt = instantOn(random, day);
        } else if (random.chance(0.3)) {
          log('email', 'inbound');
        }
        break;
      case 'running': {
        const result = status.result;
        const prescribed = legacy.prescribedTouch(result);

        if (result.inMailAvailable === true) {
          const choice = random.weighted<'inmail' | 'skip' | 'accept'>([
            ['inmail', 40],
            ['skip', 40],
            ['accept', 20],
          ]);

          if (choice === 'inmail') {
            log('linkedin_message', 'outbound');
            inMailsSent += 1;

            if (inMailsSent % 2 === 1) {
              ENGINE_IN_MAILS.add(activities[activities.length - 1]);
            }
          } else if (choice === 'skip') {
            log('email', 'outbound');
          } else {
            log('linkedin_connection', 'inbound', 'accepted');
          }
        } else if (result.position.kind === 'connection_sent') {
          if (random.chance(0.35)) {
            log('linkedin_connection', 'inbound', random.chance(0.8) ? 'accepted' : null);
          }
        } else if (prescribed !== null) {
          const roll = random.next();

          if (roll < 0.78) {
            log(prescribed, 'outbound', prescribed === 'email' && random.chance(0.04) ? 'bounced' : null);
          } else if (roll < 0.88) {
            log(prescribed, 'inbound');
          } else if (roll < 0.94) {
            log(random.pick<LegacyChannel>(['social', 'other']), 'outbound');
          } else if (result.position.kind === 'linkedin_inmail' && roll < 0.97) {
            log('linkedin_connection', 'inbound', 'accepted');
          }
        }
        break;
      }
    }

    const proposed = legacy.proposeNextAction(contact, activities, day);
    const next = proposed !== null && proposed > day ? proposed : addCalendarDays(day, random.integer(1, 9));

    day = random.chance(0.3) ? addCalendarDays(next, random.integer(0, 4)) : next;
  }

  return activities;
};

const toEngineContact = (contact: LegacyContact): CadenceContact => ({
  stage: STAGE_TO_ENGINE[contact.stage],
  health: contact.health,
  hasOwner: contact.ownerId !== null,
  ownerSince: contact.ownerSince,
  hasEmail: contact.email !== null,
  hasLinkedinUrl: contact.linkedinUrl !== null,
  optedOut: contact.outreachSuspendedAt !== null,
  cadenceResumedAt: contact.cadenceResumedAt,
  snoozeUntil: contact.snoozeUntil,
  revisitDate: contact.revisitDate,
  nextActionDateOverride: null,
});

// Each legacy catch-all channel fans out over the channels it covered, plus an
// unknown one, which must behave exactly as the legacy "other" did.
const toEngineTouch = (activity: LegacyActivity, random: Random): CadenceTouch => {
  const channel = ENGINE_IN_MAILS.has(activity)
    ? 'inmail'
    : activity.channel === 'social'
      ? random.pick(['follow', 'comment', 'like', 'profileView'])
      : activity.channel === 'other'
        ? random.pick(['call', 'meeting', 'whatsappCall'])
        : Object.keys(LEGACY_CHANNELS).find(
            (engineChannel) => LEGACY_CHANNELS[engineChannel] === activity.channel,
          );

  if (channel === undefined) {
    throw new Error(`Unmapped legacy channel ${activity.channel}`);
  }

  return {
    channel,
    direction: activity.direction,
    outcome: activity.outcome,
    occurredAt: activity.occurredAt,
  };
};

const todaysFor = (random: Random, activities: readonly LegacyActivity[]): string[] => {
  const days = new Set<string>();
  const touchDays = activities.map((activity) => legacy.toLondonDate(activity.occurredAt));

  for (const day of touchDays.slice(-4)) {
    for (const offset of [0, 1, 3, 14, 15, 31]) {
      days.add(addCalendarDays(day, offset));
    }
  }

  for (let extra = 0; extra < 4; extra += 1) {
    days.add(dayIn(random, WINDOW_START, 330));
  }

  return [...days];
};

type Comparison = {
  history: number;
  today: string;
  field: string;
  legacy: unknown;
  engine: unknown;
};

// Each allowed divergence from the predecessor, by the SPEC §1 amendment that
// causes it. E3 changes only what "I replied" logs, which the predecessor's
// engine never computed, so it has no counterpart here; its tests are in
// amendments.test.ts.
type Divergence = 'E1' | 'E2' | 'E4' | 'E5' | 'F1';

type Tally = {
  comparisons: number;
  // Comparisons on an InMail logged on the engine's InMail channel.
  inMailChannelHistories: number;
  // Of those, the ones the predecessor counted as a LinkedIn message.
  inMailAccepted: number;
  divergences: Record<Divergence, number>;
  states: Map<string, number>;
  positions: Map<string, number>;
};

const bump = (counts: Map<string, number>, key: string) =>
  counts.set(key, (counts.get(key) ?? 0) + 1);

// What the predecessor says, with the amendments applied to its decisions one
// by one. Everything the engine returns is then compared with this exactly.
type Expected = {
  status: LegacyStatus;
  position: LegacyPositionResult;
  stepLabel: string;
  positionLabel: string;
  actions: CadenceAction[];
  prescribed: string | null;
  proposed: string | null;
  isDue: boolean;
};

// Everything the predecessor derives from a position, re-derived from it.
const withPosition = (
  expected: Pick<Expected, 'status' | 'proposed' | 'isDue'>,
  position: LegacyPositionResult,
): Expected => {
  const status: LegacyStatus =
    expected.status.state === 'running' ? { state: 'running', result: position } : expected.status;

  return {
    ...expected,
    status,
    position,
    stepLabel: legacyStatusLabel(status),
    positionLabel: legacyPositionLabel(position),
    actions: legacyActions(status).map((action) => ACTION_FROM_LEGACY[action.kind]),
    prescribed: legacy.prescribedTouch(position),
  };
};

const legacyExpectation = (
  contact: LegacyContact,
  activities: readonly LegacyActivity[],
  today: string,
): Expected =>
  withPosition(
    {
      status: legacy.outreachStatus(contact, activities, today),
      proposed: legacy.proposeNextAction(contact, activities, today),
      isDue: legacy.isDue(contact, activities, today),
    },
    legacy.computePosition(contact, activities, today),
  );

const sequenceEmails = (contact: LegacyContact, activities: readonly LegacyActivity[]): number =>
  legacy.sequenceTouches(contact, activities).filter((activity) => activity.channel === 'email').length;

// E5: the predecessor read an inbound follow or comment ("social") as a reply.
// The engine logs it and nothing more, which is what an outbound social touch
// already was to the predecessor, so that is the history it is shown.
const isInboundSocialReply = (activity: LegacyActivity): boolean =>
  activity.channel === 'social' && legacy.isReply(activity);

const withoutSocialReplies = (activities: readonly LegacyActivity[]): LegacyActivity[] =>
  activities.map((activity) =>
    isInboundSocialReply(activity) ? { ...activity, direction: 'outbound' as const } : activity,
  );

// E1: the predecessor stayed on "InMail" after an InMail, prescribing another,
// and on "Connection request" after Skip to email. The engine moves on to the
// next email, which the predecessor would have shown as this. Either way the
// InMail closes the gate, however it was logged.
const isE1 = (expected: Expected, emails: number): boolean => {
  const { kind } = expected.position.position;

  return kind === 'linkedin_inmail' || (kind === 'connection_sent' && emails >= 1);
};

// E1 too: an InMail on the engine's InMail channel is no LinkedIn message.
// The predecessor counted it as one of the two once the request was accepted
// after all; the engine still owes both. Their dates agree: every LinkedIn
// message and email step is three business days after the last touch.
const inMailsCounted = (contact: LegacyContact, activities: readonly LegacyActivity[]): number =>
  legacy.sequenceTouches(contact, activities).filter((activity) => ENGINE_IN_MAILS.has(activity))
    .length;

const e1AcceptedPosition = (
  contact: LegacyContact,
  activities: readonly LegacyActivity[],
  expected: Expected,
  inMails: number,
): LegacyPositionResult | null => {
  const { kind } = expected.position.position;
  const isAccepted = legacy.touchesUnderCurrentOwner(contact, activities).some(legacy.isAcceptance);

  if (inMails === 0 || !isAccepted || (kind !== 'linkedin_message' && kind !== 'email')) {
    return null;
  }

  const messages =
    legacy
      .sequenceTouches(contact, activities)
      .filter((activity) => activity.channel === 'linkedin_message').length - inMails;

  if (messages >= 2) {
    return null;
  }

  return {
    position: { kind: 'linkedin_message', n: messages + 1 },
    ...(contact.ownerId === null ? { blockedReason: 'unowned' as const } : {}),
  };
};

const e1Position = (contact: LegacyContact, emails: number): LegacyPositionResult => {
  const blockedReason =
    contact.ownerId === null ? 'unowned' : contact.email === null ? 'no_email_address' : undefined;

  return {
    position: { kind: 'email', n: emails + 1 },
    ...(blockedReason === undefined ? {} : { blockedReason }),
  };
};

// E4: the drip counts drip emails sent, not 30-day periods gone by. Its dates
// are untouched. The engine's drip number travels in the legacy `month` field.
const e4Labels = (expected: Expected, occurrence: number): Expected => {
  const amended = withPosition(expected, {
    ...expected.position,
    position: { kind: 'drip_month', month: occurrence },
  });
  const rename = (label: string) => label.replace(/^Drip, month /, 'Drip, email ');

  return { ...amended, stepLabel: rename(amended.stepLabel), positionLabel: rename(amended.positionLabel) };
};

// E2: nothing logs an email for a contact with no address. "Add email address"
// replaces the button that would have: Did it on an email (also when unowned or
// not started), Skip to email, and, with no LinkedIn URL to answer on instead,
// I replied, I followed up and They replied.
const e2Actions = (contact: LegacyContact, expected: Expected): CadenceAction[] => {
  if (contact.email !== null) {
    return expected.actions;
  }

  if (expected.status.state === 'running' && expected.prescribed === 'email') {
    return ['addEmailAddress'];
  }

  const emailOnly: readonly CadenceAction[] =
    expected.status.state === 'running'
      ? ['skipToNextStep']
      : contact.linkedinUrl === null
        ? ['iReplied', 'iFollowedUp', 'theyReplied']
        : [];
  const actions = expected.actions.map((action) =>
    emailOnly.includes(action) ? 'addEmailAddress' : action,
  );

  return actions.filter((action, index) => actions.indexOf(action) === index);
};

const amendedExpectation = (
  legacyContact: LegacyContact,
  activities: readonly LegacyActivity[],
  today: string,
  tally: Tally,
): Expected => {
  const counted = (divergence: Divergence, before: unknown, after: unknown) => {
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      tally.divergences[divergence] += 1;
    }
  };

  const shown = withoutSocialReplies(activities);
  let expected = legacyExpectation(legacyContact, shown, today);

  if (activities.some(isInboundSocialReply)) {
    counted('E5', legacyExpectation(legacyContact, activities, today), expected);
  }

  const emails = sequenceEmails(legacyContact, shown);

  if (isE1(expected, emails)) {
    const before = expected;

    expected = withPosition(expected, e1Position(legacyContact, emails));
    counted('E1', before, expected);
  }

  const accepted = e1AcceptedPosition(legacyContact, shown, expected, inMailsCounted(legacyContact, shown));

  if (accepted !== null) {
    const before = expected;

    expected = withPosition(expected, accepted);
    counted('E1', before, expected);
    tally.inMailAccepted += 1;
  }

  if (expected.position.position.kind === 'drip_month') {
    const before = expected;

    expected = e4Labels(expected, emails - 7 + 1);
    counted('E4', before, expected);
  }

  const actions = e2Actions(legacyContact, expected);

  counted('E2', expected.actions, actions);

  const run = legacy.touchesUnderCurrentOwner(legacyContact, shown);
  const pending = run.some((activity) => activity.channel === 'linkedin_connection' && activity.direction === 'outbound') &&
    !run.some(legacy.isAcceptance);

  if (expected.status.state !== 'opted_out' && pending && !actions.includes('theyAccepted')) {
    tally.divergences.F1 += 1;
    actions.push('theyAccepted');
  }

  return { ...expected, actions };
};

const compareOne = (
  history: number,
  legacyContact: LegacyContact,
  activities: LegacyActivity[],
  touches: CadenceTouch[],
  today: string,
  mismatches: Comparison[],
  tally: Tally,
) => {
  const engineContact = toEngineContact(legacyContact);
  const engine = computeCadence({ contact: engineContact, touches, config: CONFIG, today });
  const legacyStatus = legacy.outreachStatus(legacyContact, activities, today);
  const expected = amendedExpectation(legacyContact, activities, today, tally);

  tally.comparisons += 1;

  if (touches.some((touch) => touch.channel === 'inmail')) {
    tally.inMailChannelHistories += 1;
  }

  bump(tally.states, legacyStatus.state);
  bump(tally.positions, legacy.computePosition(legacyContact, activities, today).position.kind);

  const check = (field: string, expectedValue: unknown, engineValue: unknown) => {
    if (JSON.stringify(expectedValue) !== JSON.stringify(engineValue)) {
      mismatches.push({ history, today, field, legacy: expectedValue, engine: engineValue });
    }
  };

  check('proposedNextActionDate', expected.proposed, engine.proposedNextActionDate);
  check('nextActionDate', expected.proposed, engine.nextActionDate);
  check('isDue', expected.isDue, engine.isDue);
  check('status', expected.status, toLegacyStatus(engine.status));
  check('position', expected.position, toLegacyResult(engine.position));
  check('stepLabel', expected.stepLabel, engine.stepLabel);
  check('positionLabel', expected.positionLabel, engine.positionLabel);
  check('actions', expected.actions, engine.actions);
  check(
    'prescribedTouch',
    expected.prescribed,
    engine.prescribedTouch === null ? null : LEGACY_CHANNELS[engine.prescribedTouch],
  );
};

const runParity = (seed: number, histories: number, walked: boolean) => {
  const random = createRandom(seed);

  inMailsSent = 0;
  const mismatches: Comparison[] = [];
  const tally: Tally = {
    comparisons: 0,
    inMailChannelHistories: 0,
    inMailAccepted: 0,
    divergences: { E1: 0, E2: 0, E4: 0, E5: 0, F1: 0 },
    states: new Map(),
    positions: new Map(),
  };

  for (let history = 0; history < histories; history += 1) {
    const legacyContact = randomContact(random);
    const activities = walked
      ? walkedHistory(random, legacyContact)
      : randomHistory(random);
    const touches = activities.map((activity) => toEngineTouch(activity, random));

    for (const today of todaysFor(random, activities)) {
      compareOne(history, legacyContact, activities, touches, today, mismatches, tally);
    }
  }

  return { mismatches, tally };
};

const summarize = (tally: Tally) => ({
  comparisons: tally.comparisons,
  inMailChannelHistories: tally.inMailChannelHistories,
  inMailAccepted: tally.inMailAccepted,
  divergences: tally.divergences,
  states: Object.fromEntries(tally.states),
  positions: Object.fromEntries(tally.positions),
});

// Slow on a loaded machine: thousands of comparisons, each running both engines.
const PARITY_TIMEOUT_MS = 600_000;

describe('parity with the predecessor engine on the default cadence', () => {
  it(`agrees on ${RANDOM_HISTORIES} random touch histories, but for E1, E2, E4 and E5`, () => {
    const { mismatches, tally } = runParity(20_260_816, RANDOM_HISTORIES, false);

    console.log('random parity', JSON.stringify(summarize(tally)));

    expect(mismatches.slice(0, 10)).toEqual([]);
    expect(tally.comparisons).toBeGreaterThan(3_000);

    // Random histories carry inbound social touches, which walked ones never do.
    for (const divergence of ['E1', 'E2', 'E5'] as const) {
      expect(tally.divergences[divergence], divergence).toBeGreaterThan(0);
    }
  }, PARITY_TIMEOUT_MS);

  it(`agrees on ${WALKED_HISTORIES} histories that follow the prescribed steps, but for E1, E2 and E4`, () => {
    const { mismatches, tally } = runParity(20_261_016, WALKED_HISTORIES, true);

    console.log('walked parity', JSON.stringify(summarize(tally)));

    expect(mismatches.slice(0, 10)).toEqual([]);

    // The walk must actually reach every state and position, or parity on it
    // proves little.
    for (const state of [
      'opted_out',
      'dead',
      'bounced',
      'reply_owed',
      'hold',
      'snoozed',
      'awaiting_resume',
      'in_conversation',
      'running',
    ]) {
      expect(tally.states.get(state) ?? 0, state).toBeGreaterThan(5);
    }

    for (const kind of [
      'not_started',
      'warmed_up',
      'connection_sent',
      'linkedin_message',
      'linkedin_inmail',
      'email',
      'drip_month',
    ]) {
      expect(tally.positions.get(kind) ?? 0, kind).toBeGreaterThan(5);
    }

    for (const divergence of ['E1', 'E2', 'E4'] as const) {
      expect(tally.divergences[divergence], divergence).toBeGreaterThan(0);
    }

    // Both ways of logging the InMail are exercised, and the case where they
    // differ (accepted after the InMail) actually occurs.
    expect(tally.inMailChannelHistories).toBeGreaterThan(100);
    expect(tally.inMailAccepted).toBeGreaterThan(0);
    expect(tally.positions.get('linkedin_inmail') ?? 0).toBeGreaterThan(5);
  }, PARITY_TIMEOUT_MS);
});
