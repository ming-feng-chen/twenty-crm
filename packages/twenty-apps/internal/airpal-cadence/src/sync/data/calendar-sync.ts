import { type CoreApiClient, type CoreSchema } from 'twenty-client-sdk/core';

import {
  TOUCH_CHANNEL_VALUES,
  TOUCH_DIRECTION_VALUES,
} from 'src/constants/touch-options';
import {
  type CalendarEventClassification,
  classifyCalendarEvent,
  type SyncCalendarEvent,
  type SyncEventParticipant,
} from 'src/sync/classify-calendar-event';
import {
  chunk,
  IDS_PER_FILTER,
  pageArgs,
  readAllPages,
  type SyncContext,
} from 'src/sync/data/sync-api';
import {
  retireCalendarTouches,
  writeSyncTouches,
  type WriteOutcome,
} from 'src/sync/data/touch-writer';
import { SYNC_SOURCES, type SyncTouchCandidate } from 'src/sync/touch-plan';

type EventNode = {
  id: string;
  startsAt?: string | null;
  isFullDay?: boolean | null;
  isCanceled?: boolean | null;
  deletedAt?: string | null;
};

type EventParticipantNode = SyncEventParticipant & {
  id: string;
  calendarEventId?: string | null;
  calendarEvent?: EventNode | null;
};

// Read through the participants, like messages: Twenty's calendar visibility
// hook drops an event without a sync association from root queries.
const PARTICIPANT_SELECTION = {
  id: true,
  handle: true,
  personId: true,
  workspaceMemberId: true,
  responseStatus: true,
  calendarEventId: true,
  calendarEvent: {
    id: true,
    startsAt: true,
    isFullDay: true,
    isCanceled: true,
    deletedAt: true,
  },
} as const;

export const loadEventParticipants = (
  client: CoreApiClient,
  filter: CoreSchema.CalendarEventParticipantFilterInput,
): Promise<EventParticipantNode[]> =>
  readAllPages<EventParticipantNode>(async (after) =>
    (
      await client.query({
        calendarEventParticipants: {
          __args: { filter, ...pageArgs(after) },
          pageInfo: { hasNextPage: true, endCursor: true },
          edges: { node: PARTICIPANT_SELECTION },
        },
      })
    ).calendarEventParticipants as never,
  );

const toSyncEvents = (participants: readonly EventParticipantNode[]): SyncCalendarEvent[] => {
  const byEvent = new Map<string, { event: EventNode; participants: EventParticipantNode[] }>();

  for (const participant of participants) {
    const event = participant.calendarEvent;

    if (event === null || event === undefined || typeof event.id !== 'string') {
      continue;
    }

    const entry = byEvent.get(event.id) ?? { event, participants: [] };

    entry.participants.push(participant);
    byEvent.set(event.id, entry);
  }

  return [...byEvent.values()].map(({ event, participants: rows }) => ({
    id: event.id,
    startsAt: event.startsAt ?? null,
    isFullDay: event.isFullDay ?? null,
    isCanceled: event.isCanceled ?? null,
    deletedAt: event.deletedAt ?? null,
    participants: rows.map(({ handle, personId, workspaceMemberId, responseStatus }) => ({
      handle,
      personId,
      workspaceMemberId,
      responseStatus,
    })),
  }));
};

export type CalendarSyncReport = {
  events: number;
  classified: Record<string, number>;
  writes: WriteOutcome;
  retired: string[];
  retireFailures: { touchId: string; error: string }[];
};

// People whose every participant row in the event says they declined.
const declinedPersonIds = (event: SyncCalendarEvent): string[] => {
  const answers = new Map<string, boolean>();

  for (const participant of event.participants) {
    if (typeof participant.personId === 'string' && participant.personId.length > 0) {
      const declined = participant.responseStatus === 'DECLINED';

      answers.set(participant.personId, (answers.get(participant.personId) ?? true) && declined);
    }
  }

  return [...answers].filter(([, declined]) => declined).map(([personId]) => personId);
};

const countKind = (classification: CalendarEventClassification) =>
  classification.kind === 'touches' ? 'touches' : `noTouch:${classification.reason}`;

// SPEC §5 Calendar sync for a set of events: each meeting that has begun
// gets a MEETING touch per CRM person; a calendar touch that no longer stands
// for a meeting that took place (moved into the future, cancelled, the
// person declined or left) is withdrawn. Idempotent.
export const syncCalendarEvents = async (
  client: CoreApiClient,
  eventIds: readonly string[],
  context: SyncContext,
): Promise<CalendarSyncReport> => {
  const participants: EventParticipantNode[] = [];

  for (const part of chunk([...new Set(eventIds)], IDS_PER_FILTER)) {
    participants.push(
      ...(await loadEventParticipants(client, { calendarEventId: { in: part } })),
    );
  }

  const events = toSyncEvents(participants);
  const classified: Record<string, number> = {};
  const candidates: SyncTouchCandidate[] = [];
  // Touches to withdraw: every touch of a meeting that has not taken place,
  // and a person's touch once they declined. A person merely no longer
  // linked (their email was edited, say) keeps theirs: it happened.
  const withdrawAll = new Set<string>();
  const withdrawPerson = new Set<string>();

  for (const event of events) {
    const classification = classifyCalendarEvent(event, context);
    const kind = countKind(classification);

    classified[kind] = (classified[kind] ?? 0) + 1;

    if (classification.kind === 'noTouch' && classification.reason !== 'noCrmPerson') {
      withdrawAll.add(event.id);
    } else {
      for (const personId of declinedPersonIds(event)) {
        withdrawPerson.add(`${personId}|${event.id}`);
      }
    }

    if (classification.kind === 'touches') {
      for (const touch of classification.touches) {
        candidates.push({
          source: SYNC_SOURCES.calendar,
          personId: touch.personId,
          channel: TOUCH_CHANNEL_VALUES.meeting,
          direction: TOUCH_DIRECTION_VALUES.outbound,
          occurredOn: touch.occurredOn,
          externalId: touch.calendarEventId,
        });
      }
    }
  }

  // Only events read just now are judged; one that could not be read (its
  // record is gone) keeps its touches: deletion also happens when an account
  // is disconnected, and history must not vanish with it.
  const { retired, failures } = await retireCalendarTouches(client, {
    eventIds: events.map((event) => event.id),
    keep: (touch) =>
      !withdrawAll.has(touch.externalId ?? '') &&
      !withdrawPerson.has(`${touch.personId ?? ''}|${touch.externalId ?? ''}`),
  });
  const writes = await writeSyncTouches(client, candidates, context.now);

  return {
    events: events.length,
    classified,
    writes,
    retired,
    retireFailures: failures,
  };
};

// Events with a CRM participant whose start falls in (from, to]: the hourly
// check that turns a meeting into a touch on its day.
export const eventIdsStartingBetween = async (
  client: CoreApiClient,
  { from, to }: { from: Date; to: Date },
): Promise<string[]> => {
  const rows = await loadEventParticipants(client, {
    and: [
      { personId: { is: 'NOT_NULL' } },
      { calendarEvent: { startsAt: { gt: from.toISOString() } } },
      { calendarEvent: { startsAt: { lte: to.toISOString() } } },
    ],
  });

  return [
    ...new Set(
      rows
        .map((row) => row.calendarEventId ?? row.calendarEvent?.id)
        .filter((id): id is string => typeof id === 'string'),
    ),
  ];
};
