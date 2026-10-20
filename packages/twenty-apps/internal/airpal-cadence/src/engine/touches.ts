import { toCadenceDate } from './business-days';
import { lastItem } from './last-item';
import type {
  CadenceConfig,
  CadenceContact,
  CadenceDate,
  CadenceDateInput,
  CadenceTouch,
  CadenceTouchTemplate,
} from './types';

export type DatedTouch = CadenceTouch & {
  date: CadenceDate;
  instant: number;
};

const datedTouch = (touch: CadenceTouch, timeZone: string): DatedTouch => ({
  ...touch,
  date: toCadenceDate(touch.occurredAt, timeZone),
  instant:
    touch.occurredAtInstant !== undefined && Number.isFinite(Date.parse(touch.occurredAtInstant))
      ? Date.parse(touch.occurredAtInstant)
      : typeof touch.occurredAt === 'string'
      ? Number.NEGATIVE_INFINITY
      : touch.occurredAt.getTime(),
});

// Stable, so touches on the same day keep the order they were given in.
const compareTouches = (first: DatedTouch, second: DatedTouch): number => {
  if (first.date !== second.date) {
    return first.date < second.date ? -1 : 1;
  }

  if (first.instant === second.instant) {
    return 0;
  }

  return first.instant < second.instant ? -1 : 1;
};

export const sortTouches = (
  touches: readonly CadenceTouch[],
  config: CadenceConfig,
): DatedTouch[] =>
  touches
    .map((touch) => datedTouch(touch, config.timeZone))
    .sort(compareTouches);

export const isTouchAtOrAfter = (touch: DatedTouch, reference: DatedTouch): boolean => {
  if (touch.date !== reference.date) {
    return touch.date > reference.date;
  }

  // Legacy and manual days carry no reliable ordering within the day.
  if (touch.occurredAtInstant === undefined || reference.occurredAtInstant === undefined) {
    return true;
  }

  const instant = Date.parse(touch.occurredAtInstant);
  const referenceInstant = Date.parse(reference.occurredAtInstant);

  return !Number.isFinite(instant) || !Number.isFinite(referenceInstant) || instant >= referenceInstant;
};

export const isReplyInCurrentRun = (
  touch: DatedTouch,
  contact: CadenceContact,
  config: CadenceConfig,
): boolean => {
  if (!isReply(touch, config)) {
    return false;
  }

  const resetInstant = contact.replyResetAt === undefined ? Number.NaN : Date.parse(contact.replyResetAt);

  if (!Number.isFinite(resetInstant)) {
    return true;
  }

  const resetDate = toCadenceDate(new Date(resetInstant), config.timeZone);

  if (touch.date !== resetDate) {
    return touch.date > resetDate;
  }

  const occurredAt = touch.occurredAtInstant ?? touch.recordedAtInstant;

  // A legacy day cannot establish that the reply arrived after the reset.
  return occurredAt !== undefined && Date.parse(occurredAt) > resetInstant;
};

// An acceptance is inbound and matters, but nobody owes an answer for it.
export const isAcceptance = (
  touch: CadenceTouchTemplate,
  config: CadenceConfig,
): boolean =>
  touch.outcome === config.connectionRequest.acceptedOutcome ||
  (touch.direction === 'inbound' &&
    touch.channel === config.connectionRequest.channel);

// A follow, comment, like or profile view from them is logged but is not a
// reply (E5): it does not stop the sequence, owe an answer or reset strikes.
export const isReply = (
  touch: CadenceTouchTemplate,
  config: CadenceConfig,
): boolean =>
  touch.direction === 'inbound' &&
  !isAcceptance(touch, config) &&
  !config.nonAdvancingChannels.includes(touch.channel);

export const isConnectionRequest = (
  touch: CadenceTouchTemplate,
  config: CadenceConfig,
): boolean =>
  touch.direction === 'outbound' &&
  touch.channel === config.connectionRequest.channel;

// "Sent InMail" (E1). Never a step's own channel (the validator refuses it),
// so it is told apart from every step touch by its channel alone.
export const isInMail = (
  touch: CadenceTouchTemplate,
  config: CadenceConfig,
): boolean =>
  touch.direction === 'outbound' &&
  touch.channel === config.connectionRequest.inMailChannel;

// A step's own channel consumes a step. The InMail is a sequence touch too:
// the schedule runs from it and it closes the gated steps, but it consumes no
// step. Calls, meetings and unknown channels are logged but never advance the
// sequence.
export const advancesSequence = (
  touch: CadenceTouchTemplate,
  config: CadenceConfig,
): boolean =>
  touch.direction === 'outbound' &&
  (isInMail(touch, config) ||
    config.steps.some((step) => step.channel === touch.channel));

// "Did we reach out at all", for strikes and answering a reply. Everything
// outbound counts except the non-advancing channels (follow, comment, like).
export const isOurContact = (
  touch: CadenceTouchTemplate,
  config: CadenceConfig,
): boolean =>
  touch.direction === 'outbound' &&
  !config.nonAdvancingChannels.includes(touch.channel);

// A start-fresh handover: the previous owner's touches stay but stop counting.
export const touchesUnderCurrentOwner = (
  contact: CadenceContact,
  touches: readonly CadenceTouch[],
  config: CadenceConfig,
): DatedTouch[] => {
  const sorted = sortTouches(touches, config);

  if (contact.ownerSince === null) {
    return sorted;
  }

  const ownerSince = toCadenceDate(contact.ownerSince, config.timeZone);

  return sorted.filter((touch) => touch.date >= ownerSince);
};

// Evaluated as at `on`, so a touch sent while stopped never counts, even after
// a later resume. Sequence steps are still counted by day, including deduped
// days containing more than one outbound email.
const wasRunningOn = (
  on: CadenceDate,
  replies: readonly DatedTouch[],
  resumedOn: CadenceDate | null,
): boolean => {
  const lastReply = lastItem(replies.filter((reply) => reply.date <= on));

  if (lastReply === undefined) {
    return true;
  }

  const resumeInEffect =
    resumedOn !== null && resumedOn <= on ? resumedOn : null;

  return resumeInEffect !== null && lastReply.date <= resumeInEffect;
};

export const sequenceTouchesFromRun = (
  run: readonly DatedTouch[],
  contact: CadenceContact,
  config: CadenceConfig,
): DatedTouch[] => {
  const replies = run.filter((touch) => isReplyInCurrentRun(touch, contact, config));
  const resumedOn =
    contact.cadenceResumedAt === null
      ? null
      : toCadenceDate(contact.cadenceResumedAt, config.timeZone);

  return run.filter(
    (touch) =>
      advancesSequence(touch, config) &&
      wasRunningOn(touch.date, replies, resumedOn),
  );
};

export const sequenceTouches = (
  contact: CadenceContact,
  touches: readonly CadenceTouch[],
  config: CadenceConfig,
): DatedTouch[] =>
  sequenceTouchesFromRun(
    touchesUnderCurrentOwner(contact, touches, config),
    contact,
    config,
  );

export const hasBounced = (
  touches: readonly CadenceTouch[],
  config: CadenceConfig,
): boolean =>
  lastItem(
    sortTouches(touches, config).filter(
      (touch) =>
        touch.direction === 'outbound' &&
        touch.channel === config.bounce.channel,
    ),
  )?.outcome === config.bounce.outcome;

export const isConnectionPending = (
  touches: readonly CadenceTouch[],
  config: CadenceConfig,
): boolean =>
  touches.some((touch) => isConnectionRequest(touch, config)) &&
  !touches.some((touch) => isAcceptance(touch, config));

// A future-dated touch would make a contact permanently "too soon"; refuse it.
export const isTouchInFuture = (
  touch: CadenceTouch,
  today: CadenceDateInput,
  config: CadenceConfig,
): boolean =>
  toCadenceDate(touch.occurredAt, config.timeZone) >
  toCadenceDate(today, config.timeZone);
