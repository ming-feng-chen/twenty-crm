import {
  type AirPalIdentity,
  isAirPalParticipant,
} from 'src/sync/airpal-identity';
import { eventDateOf, hasEventStarted } from 'src/sync/sync-dates';

export type SyncEventParticipant = {
  handle?: string | null;
  personId?: string | null;
  workspaceMemberId?: string | null;
  responseStatus?: string | null;
};

export type SyncCalendarEvent = {
  id: string;
  startsAt?: string | null;
  isFullDay?: boolean | null;
  isCanceled?: boolean | null;
  deletedAt?: string | null;
  participants: readonly SyncEventParticipant[];
};

export type MeetingTouchCandidate = {
  personId: string;
  occurredOn: string;
  calendarEventId: string;
};

export type CalendarEventClassification =
  // The meeting has begun: one touch per CRM person in it.
  | { kind: 'touches'; occurredOn: string; touches: MeetingTouchCandidate[] }
  // Not begun yet, cancelled, deleted or undated: no touch may stand for it.
  | {
      kind: 'noTouch';
      reason: 'notStarted' | 'cancelled' | 'deleted' | 'noDate' | 'noCrmPerson';
      occurredOn: string | null;
    };

// SPEC §5 for one calendar event: a MEETING touch for each CRM person taking
// part (not a member, and not one who declined), dated the event's day, once
// the meeting has begun. A person who declined did not meet us.
export const classifyCalendarEvent = (
  event: SyncCalendarEvent,
  {
    identity,
    timeZone,
    today,
    now,
  }: { identity: AirPalIdentity; timeZone: string; today: string; now: Date },
): CalendarEventClassification => {
  const occurredOn = eventDateOf(
    { startsAt: event.startsAt, isFullDay: event.isFullDay },
    timeZone,
  );

  if (typeof event.deletedAt === 'string' && event.deletedAt.length > 0) {
    return { kind: 'noTouch', reason: 'deleted', occurredOn };
  }

  if (event.isCanceled === true) {
    return { kind: 'noTouch', reason: 'cancelled', occurredOn };
  }

  if (occurredOn === null) {
    return { kind: 'noTouch', reason: 'noDate', occurredOn };
  }

  if (
    occurredOn > today ||
    !hasEventStarted(
      { startsAt: event.startsAt, isFullDay: event.isFullDay },
      { now, today, timeZone },
    )
  ) {
    return { kind: 'noTouch', reason: 'notStarted', occurredOn };
  }

  const personIds = new Set<string>();

  for (const participant of event.participants) {
    if (
      typeof participant.personId === 'string' &&
      participant.personId.length > 0 &&
      participant.responseStatus !== 'DECLINED' &&
      !isAirPalParticipant(participant, identity)
    ) {
      personIds.add(participant.personId);
    }
  }

  if (personIds.size === 0) {
    return { kind: 'noTouch', reason: 'noCrmPerson', occurredOn };
  }

  return {
    kind: 'touches',
    occurredOn,
    touches: [...personIds].map((personId) => ({
      personId,
      occurredOn,
      calendarEventId: event.id,
    })),
  };
};
