import { addDuration, toCadenceDate } from './business-days';
import { lastItem } from './last-item';
import { findStep } from './position';
import { computeOutreachStatus, isStoppedState } from './stops';
import {
  isOurContact,
  sequenceTouches,
  touchesUnderCurrentOwner,
} from './touches';
import type {
  CadenceConfig,
  CadenceContact,
  CadenceDate,
  CadenceDateInput,
  CadenceTouch,
} from './types';

// What the engine would set the next action date to. Null means nothing is
// scheduled, which is Cold rather than a gap.
export const proposeNextAction = (
  contact: CadenceContact,
  touches: readonly CadenceTouch[],
  today: CadenceDateInput,
  config: CadenceConfig,
): CadenceDate | null => {
  const todayDate = toCadenceDate(today, config.timeZone);
  const status = computeOutreachStatus(contact, touches, todayDate, config);

  switch (status.state) {
    case 'optedOut':
    case 'dead':
    case 'bounced':
      return null;
    // An owed reply never expires; it ages at the top of My Day instead.
    case 'replyOwed':
      return todayDate;
    case 'hold':
      return status.revisitOn;
    case 'snoozed':
      return status.until;
    case 'awaitingResume':
      return todayDate;
    case 'inConversation': {
      const lastOurs = lastItem(
        touchesUnderCurrentOwner(contact, touches, config).filter((touch) =>
          isOurContact(touch, config),
        ),
      );

      return lastOurs === undefined
        ? todayDate
        : addDuration(lastOurs.date, config.strikeSilenceGap, config);
    }
    case 'running': {
      const lastSequenceTouch = lastItem(
        sequenceTouches(contact, touches, config),
      );
      const { position } = status.result;

      // Nothing sent yet: the contact is work to start, not overdue.
      if (
        lastSequenceTouch === undefined ||
        position.kind === 'sequenceComplete'
      ) {
        return null;
      }

      return addDuration(
        lastSequenceTouch.date,
        findStep(config, position.stepKey).gapBefore,
        config,
      );
    }
  }
};

// Derived from the proposal so the two can never disagree.
export const isDue = (
  contact: CadenceContact,
  touches: readonly CadenceTouch[],
  today: CadenceDateInput,
  config: CadenceConfig,
): boolean => {
  const due = proposeNextAction(contact, touches, today, config);

  return due !== null && due <= toCadenceDate(today, config.timeZone);
};

export const resolveNextActionDate = (
  contact: CadenceContact,
  proposedNextActionDate: CadenceDate | null,
  config: CadenceConfig,
): CadenceDate | null =>
  contact.nextActionDateOverride === null
    ? proposedNextActionDate
    : toCadenceDate(contact.nextActionDateOverride, config.timeZone);

type ScheduleEdit = {
  before: CadenceContact;
  after: CadenceContact;
  touches: readonly CadenceTouch[];
  today: CadenceDateInput;
  config: CadenceConfig;
};

const sameDate = (
  first: CadenceDateInput | null,
  second: CadenceDateInput | null,
  config: CadenceConfig,
): boolean =>
  (first === null ? null : toCadenceDate(first, config.timeZone)) ===
  (second === null ? null : toCadenceDate(second, config.timeZone));

// An edit to a stop check that starts or ends a stop moves the schedule, so a
// typed next action date must then be cleared, unless that same edit typed it.
// Every other edit, and an ordinary stage move on a running contact, leaves it.
export const doesEditMoveSchedule = ({
  before,
  after,
  touches,
  today,
  config,
}: ScheduleEdit): boolean => {
  const isStopCheckEdit =
    before.stage !== after.stage ||
    before.health !== after.health ||
    before.optedOut !== after.optedOut ||
    !sameDate(before.snoozeUntil, after.snoozeUntil, config);

  if (!isStopCheckEdit) {
    return false;
  }

  return (
    isStoppedState(computeOutreachStatus(before, touches, today, config)) ||
    isStoppedState(computeOutreachStatus(after, touches, today, config))
  );
};
