import { addDuration, toCadenceDate } from './business-days';
import { lastItem } from './last-item';
import { computePosition } from './position';
import {
  hasBounced,
  isOurContact,
  isReplyInCurrentRun,
  isTouchAtOrAfter,
  sortTouches,
  touchesUnderCurrentOwner,
  type DatedTouch,
} from './touches';
import type {
  CadenceConfig,
  CadenceContact,
  CadenceDate,
  CadenceDateInput,
  CadenceTouch,
  OutreachStatus,
} from './types';

// The checks run in a fixed order and the order is the answer to "why is this
// contact showing this". "They spoke last" deliberately outranks hold and snooze.

const countStrikes = (
  repliedOn: CadenceDate,
  run: readonly DatedTouch[],
  today: CadenceDate,
  config: CadenceConfig,
  reply?: DatedTouch,
): number => {
  const aged = run.filter(
    (touch) =>
      isOurContact(touch, config) &&
      touch.date >= repliedOn &&
      (reply === undefined || isTouchAtOrAfter(touch, reply)) &&
      addDuration(touch.date, config.strikeSilenceGap, config) <= today,
  );

  return Math.min(aged.length, config.strikeLimit);
};

// A strike is one of our messages gone unanswered for the silence gap, counted
// from their last reply. Off-rhythm extras count; yesterday's does not yet.
export const strikesSince = (
  repliedOn: CadenceDateInput,
  touches: readonly CadenceTouch[],
  today: CadenceDateInput,
  config: CadenceConfig,
): number =>
  countStrikes(
    toCadenceDate(repliedOn, config.timeZone),
    sortTouches(touches, config),
    toCadenceDate(today, config.timeZone),
    config,
  );

export const computeOutreachStatus = (
  contact: CadenceContact,
  touches: readonly CadenceTouch[],
  today: CadenceDateInput,
  config: CadenceConfig,
): OutreachStatus => {
  const todayDate = toCadenceDate(today, config.timeZone);
  const run = touchesUnderCurrentOwner(contact, touches, config);

  if (contact.optedOut) {
    return { state: 'optedOut' };
  }

  if (contact.health === 'dead' || contact.stage === 'dead') {
    return { state: 'dead' };
  }

  if (hasBounced(run, config)) {
    return { state: 'bounced' };
  }

  const reply = lastItem(run.filter((touch) => isReplyInCurrentRun(touch, contact, config)));
  const repliedOn = reply?.date ?? null;
  const resumedOn =
    contact.cadenceResumedAt === null
      ? null
      : toCadenceDate(contact.cadenceResumedAt, config.timeZone);
  const isStopped =
    repliedOn !== null && (resumedOn === null || repliedOn > resumedOn);

  // Never expires: if we never answer, strike 1 never begins.
  if (isStopped) {
    const isAnswered = run.some(
      (touch) => isOurContact(touch, config) && reply !== undefined && isTouchAtOrAfter(touch, reply),
    );

    if (!isAnswered) {
      return { state: 'replyOwed', since: repliedOn };
    }
  }

  if (contact.health === 'hold') {
    return {
      state: 'hold',
      revisitOn:
        contact.revisitDate === null
          ? null
          : toCadenceDate(contact.revisitDate, config.timeZone),
    };
  }

  if (contact.snoozeUntil !== null) {
    const until = toCadenceDate(contact.snoozeUntil, config.timeZone);

    if (todayDate <= until) {
      return { state: 'snoozed', until };
    }
  }

  if (isStopped) {
    const strikes = countStrikes(repliedOn, run, todayDate, config, reply);

    if (strikes >= config.strikeLimit) {
      return { state: 'awaitingResume', repliedOn };
    }

    return { state: 'inConversation', strikes, repliedOn };
  }

  return {
    state: 'running',
    result: computePosition(contact, touches, todayDate, config),
  };
};

const STOPPED_STATES: Record<OutreachStatus['state'], boolean> = {
  optedOut: true,
  dead: true,
  bounced: true,
  hold: true,
  snoozed: true,
  replyOwed: false,
  awaitingResume: false,
  inConversation: false,
  running: false,
};

export const isStoppedState = (status: OutreachStatus): boolean =>
  STOPPED_STATES[status.state];
