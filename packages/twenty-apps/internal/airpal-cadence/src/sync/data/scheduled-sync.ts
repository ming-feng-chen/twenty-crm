import { type CoreApiClient, type CoreSchema } from 'twenty-client-sdk/core';
import { enqueueJobs, kv } from 'twenty-sdk/logic-function';

import {
  eventIdsStartingBetween,
  syncCalendarEvents,
  type CalendarSyncReport,
} from 'src/sync/data/calendar-sync';
import { syncMessages, type EmailSyncReport } from 'src/sync/data/email-sync';
import {
  chunk,
  loadSyncContext,
  pageArgs,
  readAllPages,
} from 'src/sync/data/sync-api';
import { convergeGroups } from 'src/sync/data/touch-writer';
import { SYNC_BACKFILL_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/sync/sync-identifiers';
import { toDateOnly } from 'src/utils/civil-date';

const HOUR_MS = 60 * 60 * 1000;

export const CALENDAR_CHECKED_THROUGH_KEY = 'sync.calendarCheckedThrough';

// First run, or after a long outage: how far back the hourly check looks.
// Older meetings are the backfill's job.
const FIRST_LOOKBACK_MS = 48 * HOUR_MS;
const MAX_LOOKBACK_MS = 14 * 24 * HOUR_MS;
// Overlap with the previous window: a delayed or slow run loses nothing.
const OVERLAP_MS = 2 * HOUR_MS;
// Touches created this long ago or less are re-checked for same-day copies
// (a manual "Did it" logged after the synced touch, which the manual route
// does not merge).
const CONVERGE_LOOKBACK_MS = 26 * HOUR_MS;
const EVENTS_PER_SYNC = 100;

// Hourly: meetings that began since the last check become touches (SPEC §5:
// created once the event day has come, never ahead), and recent same-day
// duplicates are settled.
export const runHourlySync = async (client: CoreApiClient, now: Date = new Date()) => {
  const context = await loadSyncContext(client, now);
  const checkedThrough = await kv.get<string>(CALENDAR_CHECKED_THROUGH_KEY);
  const last = checkedThrough === null ? Number.NaN : new Date(checkedThrough).getTime();
  const from = new Date(
    Number.isNaN(last)
      ? now.getTime() - FIRST_LOOKBACK_MS
      : Math.max(last - OVERLAP_MS, now.getTime() - MAX_LOOKBACK_MS),
  );
  const eventIds = await eventIdsStartingBetween(client, { from, to: now });
  const calendar: CalendarSyncReport[] = [];

  for (const ids of chunk(eventIds, EVENTS_PER_SYNC)) {
    calendar.push(await syncCalendarEvents(client, ids, context));
  }

  const recent = await readAllPages<{
    id: string;
    personId?: string | null;
    channel?: string | null;
    direction?: string | null;
    occurredOn?: unknown;
  }>(async (after) =>
    (
      await client.query({
        touches: {
          __args: {
            filter: {
              createdAt: { gte: new Date(now.getTime() - CONVERGE_LOOKBACK_MS).toISOString() },
            } as CoreSchema.TouchFilterInput,
            ...pageArgs(after),
          },
          pageInfo: { hasNextPage: true, endCursor: true },
          edges: {
            node: { id: true, personId: true, channel: true, direction: true, occurredOn: true },
          },
        },
      })
    ).touches as never,
  );
  const groups = recent.flatMap((touch) => {
    const occurredOn = toDateOnly(touch.occurredOn);

    return typeof touch.personId === 'string' &&
      typeof touch.channel === 'string' &&
      typeof touch.direction === 'string' &&
      occurredOn !== null
      ? [{ personId: touch.personId, channel: touch.channel, direction: touch.direction, occurredOn }]
      : [];
  });
  const converged = await convergeGroups(client, groups);
  const failures = calendar.flatMap((report) => [
    ...report.writes.failures,
    ...report.retireFailures,
  ]);

  if (failures.length === 0) {
    await kv.set(CALENDAR_CHECKED_THROUGH_KEY, now.toISOString());
  }

  return {
    window: { from: from.toISOString(), to: now.toISOString() },
    events: eventIds.length,
    calendar,
    convergedGroups: converged,
    failures,
  };
};

export type BackfillPhase = 'gmail' | 'calendar';

export type BackfillPayload = {
  phase?: BackfillPhase;
  after?: string;
  // Only messages received / meetings starting on or after this instant.
  since?: string;
  // Stop after the first phase instead of going on to the next.
  only?: BackfillPhase;
};

const BACKFILL_BUDGET_MS = 8 * 60 * 1000;
const BACKFILL_PAGE = 100;
const STABLE_ORDER = [{ createdAt: 'AscNullsFirst' }, { id: 'AscNullsFirst' }];

type ParticipantPage = {
  ids: string[];
  endCursor: string | undefined;
  hasNextPage: boolean;
};

const gmailPage = async (
  client: CoreApiClient,
  { after, since }: { after?: string; since?: string },
): Promise<ParticipantPage> => {
  const { messageParticipants } = await client.query({
    messageParticipants: {
      __args: {
        filter: {
          and: [
            { personId: { is: 'NOT_NULL' } },
            ...(since === undefined ? [] : [{ message: { receivedAt: { gte: since } } }]),
          ],
        } as CoreSchema.MessageParticipantFilterInput,
        orderBy: STABLE_ORDER as never,
        first: BACKFILL_PAGE,
        ...(after === undefined ? {} : { after }),
      },
      pageInfo: { hasNextPage: true, endCursor: true },
      edges: { node: { id: true, messageId: true } },
    },
  });

  return {
    ids: [
      ...new Set(
        (messageParticipants?.edges ?? [])
          .map(({ node }) => node.messageId)
          .filter((id): id is string => typeof id === 'string'),
      ),
    ],
    endCursor: messageParticipants?.pageInfo?.endCursor ?? undefined,
    hasNextPage: messageParticipants?.pageInfo?.hasNextPage === true,
  };
};

const calendarPage = async (
  client: CoreApiClient,
  { after, since, now }: { after?: string; since?: string; now: Date },
): Promise<ParticipantPage> => {
  const { calendarEventParticipants } = await client.query({
    calendarEventParticipants: {
      __args: {
        filter: {
          and: [
            { personId: { is: 'NOT_NULL' } },
            { calendarEvent: { startsAt: { lte: now.toISOString() } } },
            ...(since === undefined ? [] : [{ calendarEvent: { startsAt: { gte: since } } }]),
          ],
        } as CoreSchema.CalendarEventParticipantFilterInput,
        orderBy: STABLE_ORDER as never,
        first: BACKFILL_PAGE,
        ...(after === undefined ? {} : { after }),
      },
      pageInfo: { hasNextPage: true, endCursor: true },
      edges: { node: { id: true, calendarEventId: true } },
    },
  });

  return {
    ids: [
      ...new Set(
        (calendarEventParticipants?.edges ?? [])
          .map(({ node }) => node.calendarEventId)
          .filter((id): id is string => typeof id === 'string'),
      ),
    ],
    endCursor: calendarEventParticipants?.pageInfo?.endCursor ?? undefined,
    hasNextPage: calendarEventParticipants?.pageInfo?.hasNextPage === true,
  };
};

const sumInto = (total: Record<string, number>, part: Record<string, number>) => {
  for (const [key, value] of Object.entries(part)) {
    total[key] = (total[key] ?? 0) + value;
  }
};

// Touches for mail and meetings Twenty already holds (synced before this app
// was installed). Not run automatically: see README "Gmail and Calendar
// sync". One page at a time, paced by the API client; when the run's budget
// is spent it enqueues itself to resume from the same cursor. Idempotent, so
// running it twice, or over a range already synced, creates nothing new.
export const runSyncBackfill = async (
  client: CoreApiClient,
  payload: BackfillPayload,
  now: Date = new Date(),
) => {
  const deadline = Date.now() + BACKFILL_BUDGET_MS;
  const context = await loadSyncContext(client, now);
  let phase: BackfillPhase = payload.phase ?? payload.only ?? 'gmail';
  let after = payload.after;
  const classified: Record<string, number> = {};
  const totals = { pages: 0, records: 0, created: 0, enriched: 0, failures: 0, bounces: 0 };
  const failures: unknown[] = [];

  for (;;) {
    if (Date.now() >= deadline) {
      await enqueueJobs({
        logicFunctionUniversalIdentifier: SYNC_BACKFILL_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
        jobs: [{ payload: { ...payload, phase, after } }],
      });

      return { status: 'continuing' as const, phase, after, totals, classified, failures };
    }

    const page =
      phase === 'gmail'
        ? await gmailPage(client, { after, since: payload.since })
        : await calendarPage(client, { after, since: payload.since, now });

    totals.pages += 1;
    totals.records += page.ids.length;

    if (page.ids.length > 0) {
      const report: EmailSyncReport | CalendarSyncReport =
        phase === 'gmail'
          ? await syncMessages(client, page.ids, context)
          : await syncCalendarEvents(client, page.ids, context);

      sumInto(classified, report.classified);
      totals.created += report.writes.created.length;
      totals.enriched += report.writes.enriched.length;
      totals.failures += report.writes.failures.length;
      failures.push(...report.writes.failures);

      if ('bounces' in report) {
        totals.bounces += report.bounces.filter((bounce) => bounce.status === 'marked').length;
      }
    }

    if (page.hasNextPage && page.endCursor !== undefined && page.endCursor !== after) {
      after = page.endCursor;
      continue;
    }

    if (phase === 'gmail' && payload.only !== 'gmail') {
      phase = 'calendar';
      after = undefined;
      continue;
    }

    return { status: 'done' as const, totals, classified, failures };
  }
};

