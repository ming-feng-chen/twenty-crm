import { type CoreApiClient, type CoreSchema } from 'twenty-client-sdk/core';

import { type TouchOutcomeValue } from 'src/constants/cadence-values';
import {
  TOUCH_CHANNEL_VALUES,
  TOUCH_DIRECTION_VALUES,
} from 'src/constants/touch-options';
import { errorMessage } from 'src/data/api';
import {
  chunk,
  IDS_PER_FILTER,
  isDuplicateEntryError,
  isRateLimitError,
  pageArgs,
  readAllPages,
} from 'src/sync/data/sync-api';
import {
  dayGroupKey,
  decideTouchAction,
  type ExistingTouch,
  isSyncedSource,
  planConvergence,
  retiredExternalId,
  SYNC_SOURCES,
  type SyncTouchCandidate,
  syncTouchId,
  type TouchAction,
} from 'src/sync/touch-plan';
import { personDisplayName, type PersonRecord } from 'src/utils/person-cadence';

const EXISTING_TOUCH_SELECTION = {
  id: true,
  personId: true,
  channel: true,
  direction: true,
  occurredOn: true,
  occurredAt: true,
  source: true,
  externalId: true,
  outcome: true,
  createdAt: true,
  deletedAt: true,
} as const;

// Twenty reads soft-deleted rows only when the filter names deletedAt.
const LIVE_OR_DELETED = {
  or: [{ deletedAt: { is: 'NULL' } }, { deletedAt: { is: 'NOT_NULL' } }],
};
const LIVE_ONLY = { deletedAt: { is: 'NULL' } };

const queryTouches = (
  client: CoreApiClient,
  filter: Record<string, unknown>,
): Promise<ExistingTouch[]> =>
  readAllPages<ExistingTouch>(async (after) =>
    (
      await client.query({
        touches: {
          __args: {
            filter: filter as CoreSchema.TouchFilterInput,
            ...pageArgs(after),
          },
          pageInfo: { hasNextPage: true, endCursor: true },
          edges: { node: EXISTING_TOUCH_SELECTION },
        },
      })
    ).touches as never,
  );

const unique = <TValue>(values: readonly TValue[]) => [...new Set(values)];

// Every touch, live or deleted, that a candidate could collide with: its own
// id, the same external id for the same person, or the same person and day.
const loadExistingFor = async (
  client: CoreApiClient,
  candidates: readonly SyncTouchCandidate[],
): Promise<ExistingTouch[]> => {
  const byId = new Map<string, ExistingTouch>();

  for (const part of chunk(candidates, IDS_PER_FILTER)) {
    const personIds = unique(part.map((candidate) => candidate.personId));
    const rows = await queryTouches(client, {
      and: [
        LIVE_OR_DELETED,
        {
          or: [
            { id: { in: part.map((candidate) => syncTouchId(candidate)) } },
            {
              and: [
                { personId: { in: personIds } },
                { externalId: { in: unique(part.map((candidate) => candidate.externalId)) } },
              ],
            },
            {
              and: [
                { personId: { in: personIds } },
                { occurredOn: { in: unique(part.map((candidate) => candidate.occurredOn)) } },
              ],
            },
          ],
        },
      ],
    });

    for (const row of rows) {
      byId.set(row.id, row);
    }
  }

  return [...byId.values()];
};

const loadPersonNames = async (
  client: CoreApiClient,
  personIds: readonly string[],
): Promise<Map<string, string>> => {
  const names = new Map<string, string>();

  for (const ids of chunk(unique(personIds), IDS_PER_FILTER)) {
    const people = await readAllPages<PersonRecord>(async (after) =>
      (
        await client.query({
          people: {
            __args: { filter: { id: { in: ids } }, ...pageArgs(after) },
            pageInfo: { hasNextPage: true, endCursor: true },
            edges: { node: { id: true, name: { firstName: true, lastName: true } } },
          },
        })
      ).people as never,
    );

    for (const person of people) {
      names.set(person.id, personDisplayName(person));
    }
  }

  return names;
};

// A label that never repeats the email subject or meeting title: those may be
// restricted by the channel's visibility, and every member sees touches.
export const syncTouchName = (candidate: SyncTouchCandidate, personName: string) => {
  if (candidate.source === SYNC_SOURCES.calendar) {
    return `Meeting (Calendar) — ${personName}`;
  }

  return candidate.direction === TOUCH_DIRECTION_VALUES.inbound
    ? `Email from them (Gmail) — ${personName}`
    : `Email to them (Gmail) — ${personName}`;
};

export type WriteOutcome = {
  created: string[];
  enriched: string[];
  timingUpdated: string[];
  moved: string[];
  restored: string[];
  raced: string[];
  failures: { touchId: string; action: string; error: string }[];
  skipped: { personId: string; externalId: string; reason: string }[];
  converged: { survivorId: string; deleted: string[]; update: object | null }[];
};

const emptyOutcome = (): WriteOutcome => ({
  created: [],
  enriched: [],
  timingUpdated: [],
  moved: [],
  restored: [],
  raced: [],
  failures: [],
  skipped: [],
  converged: [],
});

// The effect of an action on the rows later candidates of the same run see,
// so two candidates never claim the same manual touch.
const applyToSnapshot = (
  snapshot: ExistingTouch[],
  candidate: SyncTouchCandidate,
  action: TouchAction,
  nowIso: string,
) => {
  const row = (id: string) => snapshot.find((touch) => touch.id === id);

  switch (action.kind) {
    case 'create':
      snapshot.push({
        id: action.id,
        personId: candidate.personId,
        channel: candidate.channel,
        direction: candidate.direction,
        occurredOn: candidate.occurredOn,
        occurredAt: candidate.occurredAt,
        source: candidate.source,
        externalId: candidate.externalId,
        outcome: null,
        createdAt: nowIso,
        deletedAt: null,
      });
      break;
    case 'enrich': {
      const target = row(action.touchId);

      if (target) {
        target.externalId = candidate.externalId;
        if (candidate.occurredAt !== undefined &&
          (target.occurredAt == null || Date.parse(candidate.occurredAt) > Date.parse(target.occurredAt))) {
          target.occurredAt = candidate.occurredAt;
        }
      }
      break;
    }
    case 'recordTime': {
      const target = row(action.touchId);

      if (target) {
        target.occurredAt = candidate.occurredAt;
      }
      break;
    }
    case 'move':
    case 'restore': {
      const target = row(action.touchId);

      if (target) {
        target.occurredOn = candidate.occurredOn;
        target.externalId = candidate.externalId;
        target.deletedAt = null;
      }
      break;
    }
    case 'none':
      break;
  }
};

const createOne = async (
  client: CoreApiClient,
  data: CoreSchema.TouchCreateInput,
): Promise<'created' | 'raced'> => {
  try {
    await client.mutation({ createTouch: { __args: { data }, id: true } });

    return 'created';
  } catch (error) {
    if (isDuplicateEntryError(error)) {
      return 'raced';
    }

    throw error;
  }
};

// Creates in bulk (one touch.created batch, so the engine recomputes each
// person once), falling back to one by one when a row collides: its id is
// taken, which means another run created the very same touch.
const createTouches = async (
  client: CoreApiClient,
  rows: CoreSchema.TouchCreateInput[],
  outcome: WriteOutcome,
) => {
  for (const part of chunk(rows, IDS_PER_FILTER)) {
    try {
      await client.mutation({ createTouches: { __args: { data: part }, id: true } });
      outcome.created.push(...part.map((row) => row.id as string));
    } catch (error) {
      if (!isDuplicateEntryError(error)) {
        throw error;
      }

      for (const row of part) {
        (await createOne(client, row)) === 'created'
          ? outcome.created.push(row.id as string)
          : outcome.raced.push(row.id as string);
      }
    }
  }
};

const updateTouch = (
  client: CoreApiClient,
  id: string,
  data: Record<string, unknown>,
) =>
  client.mutation({
    updateTouch: {
      __args: { id, data: data as CoreSchema.TouchUpdateInput },
      id: true,
    },
  });

const deleteTouches = async (client: CoreApiClient, ids: readonly string[]) => {
  for (const part of chunk(ids, IDS_PER_FILTER)) {
    await client.mutation({
      deleteTouches: { __args: { filter: { id: { in: [...part] } } }, id: true },
    });
  }
};

// The condition is evaluated by the database so a slower sync cannot replace
// a newer reply time with an older message's time.
const updateLatestTime = async (
  client: CoreApiClient,
  id: string,
  occurredAt: string | undefined,
) => {
  if (occurredAt === undefined) {
    return;
  }

  await client.mutation({
    updateTouches: {
      __args: {
        filter: {
          and: [
            { id: { eq: id } },
            { or: [{ occurredAt: { is: 'NULL' } }, { occurredAt: { lt: occurredAt } }] },
          ],
        } as CoreSchema.TouchFilterInput,
        data: { occurredAt } as CoreSchema.TouchUpdateInput,
      },
      id: true,
    },
  });
};

// Settles every day group a run touched (see planConvergence). Runs after
// the run's own writes, so of two racing runs the later writer always sees
// both rows.
export const convergeGroups = async (
  client: CoreApiClient,
  groups: readonly { personId: string; channel: string; direction: string; occurredOn: string; occurredAt?: string }[],
): Promise<WriteOutcome['converged']> => {
  const wanted = new Set(groups.map((group) => dayGroupKey(group)));
  const converged: WriteOutcome['converged'] = [];

  if (wanted.size === 0) {
    return converged;
  }

  const rows: ExistingTouch[] = [];

  for (const part of chunk(groups, IDS_PER_FILTER)) {
    rows.push(
      ...(await queryTouches(client, {
        and: [
          LIVE_ONLY,
          { personId: { in: unique(part.map((group) => group.personId)) } },
          { occurredOn: { in: unique(part.map((group) => group.occurredOn)) } },
          { channel: { in: unique(part.map((group) => group.channel)) } },
        ],
      })),
    );
  }

  const byGroup = new Map<string, Map<string, ExistingTouch>>();

  for (const row of rows) {
    const key = dayGroupKey(row);

    if (wanted.has(key)) {
      byGroup.set(key, (byGroup.get(key) ?? new Map()).set(row.id, row));
    }
  }

  for (const group of byGroup.values()) {
    const live = [...group.values()];
    const latestCandidateTime = groups
      .filter((candidate) => dayGroupKey(candidate) === dayGroupKey(live[0]))
      .flatMap((candidate) => candidate.occurredAt ? [candidate.occurredAt] : [])
      .sort((first, second) => Date.parse(second) - Date.parse(first))[0];
    const plan = planConvergence(live, latestCandidateTime);

    if (plan === null) {
      continue;
    }

    // The survivor takes the external id or outcome before the copies go, so
    // an interrupted run leaves a duplicate (fixed next time), never a loss.
    if (plan.update !== null) {
      const { occurredAt, ...otherFields } = plan.update;

      if (Object.keys(otherFields).length > 0) {
        await updateTouch(client, plan.survivorId, otherFields);
      }

      await updateLatestTime(client, plan.survivorId, occurredAt);
    }

    await deleteTouches(client, plan.deleteIds);
    converged.push({ survivorId: plan.survivorId, deleted: plan.deleteIds, update: plan.update });
  }

  return converged;
};

// SPEC §5 dedupe for a batch of synced touch candidates; see touch-plan.ts.
export const writeSyncTouches = async (
  client: CoreApiClient,
  candidates: readonly SyncTouchCandidate[],
  now: Date = new Date(),
): Promise<WriteOutcome> => {
  const outcome = emptyOutcome();
  const distinct = [
    ...new Map(candidates.map((candidate) => [syncTouchId(candidate), candidate])).values(),
  ];

  if (distinct.length === 0) {
    return outcome;
  }

  const snapshot = await loadExistingFor(client, distinct);
  const nowIso = now.toISOString();
  const decided = distinct.map((candidate) => {
    const action = decideTouchAction(candidate, snapshot);

    applyToSnapshot(snapshot, candidate, action, nowIso);

    return { candidate, action };
  });
  const toCreate = decided.filter(({ action }) => action.kind === 'create');
  const names = await loadPersonNames(
    client,
    toCreate.map(({ candidate }) => candidate.personId),
  );

  await createTouches(
    client,
    toCreate.map(({ candidate, action }) => ({
      id: (action as { id: string }).id,
      name: syncTouchName(candidate, names.get(candidate.personId) ?? 'Unnamed person'),
      personId: candidate.personId,
      channel: candidate.channel,
      direction: candidate.direction,
      occurredOn: candidate.occurredOn,
      occurredAt: candidate.occurredAt,
      source: candidate.source,
      externalId: candidate.externalId,
    }) as CoreSchema.TouchCreateInput),
    outcome,
  );

  for (const { candidate, action } of decided) {
    try {
      switch (action.kind) {
        case 'enrich':
          await updateTouch(client, action.touchId, { externalId: candidate.externalId });
          await updateLatestTime(client, action.touchId, candidate.occurredAt);
          outcome.enriched.push(action.touchId);
          break;
        case 'recordTime':
          await updateLatestTime(client, action.touchId, candidate.occurredAt);
          outcome.timingUpdated.push(action.touchId);
          break;
        case 'move':
          await updateTouch(client, action.touchId, { occurredOn: candidate.occurredOn });
          outcome.moved.push(action.touchId);
          break;
        case 'restore':
          await client.mutation({ restoreTouch: { __args: { id: action.touchId }, id: true } });
          await updateTouch(client, action.touchId, {
            externalId: candidate.externalId,
            occurredOn: candidate.occurredOn,
          });
          outcome.restored.push(action.touchId);
          break;
        case 'none':
          outcome.skipped.push({
            personId: candidate.personId,
            externalId: candidate.externalId,
            reason: action.reason,
          });
          break;
        case 'create':
          break;
      }
    } catch (error) {
      // A touch deleted meanwhile, say. Recorded and reported by the caller;
      // a rate limit stops the run so the whole batch is retried.
      if (isRateLimitError(error)) {
        throw error;
      }

      outcome.failures.push({
        touchId: 'touchId' in action ? action.touchId : '',
        action: action.kind,
        error: errorMessage(error),
      });
    }
  }

  const changed = decided.filter(({ action }) => action.kind !== 'none');

  outcome.converged = await convergeGroups(
    client,
    changed.map(({ candidate }) => candidate),
  );

  return outcome;
};

// Withdraws calendar touches that no longer stand for a meeting that took
// place (moved into the future, cancelled, the person declined or left). Only
// touches the Calendar sync created; a manual touch it enriched is never
// changed. The external id is rewritten first so the deleted row reads as
// withdrawn, not undone, and the meeting can bring it back.
export const retireCalendarTouches = async (
  client: CoreApiClient,
  {
    eventIds,
    keep,
  }: {
    eventIds: readonly string[];
    keep: (touch: ExistingTouch) => boolean;
  },
): Promise<{ retired: string[]; failures: { touchId: string; error: string }[] }> => {
  const retired: string[] = [];
  const failures: { touchId: string; error: string }[] = [];

  for (const ids of chunk(unique(eventIds), IDS_PER_FILTER)) {
    const rows = await queryTouches(client, {
      and: [
        LIVE_ONLY,
        { source: { eq: SYNC_SOURCES.calendar } },
        { externalId: { in: ids } },
      ],
    });

    for (const row of rows) {
      if (!isSyncedSource(row.source) || keep(row) || typeof row.externalId !== 'string') {
        continue;
      }

      try {
        await updateTouch(client, row.id, { externalId: retiredExternalId(row.externalId) });
        await client.mutation({ deleteTouch: { __args: { id: row.id }, id: true } });
        retired.push(row.id);
      } catch (error) {
        failures.push({ touchId: row.id, error: errorMessage(error) });
      }
    }
  }

  return { retired, failures };
};

// Live touches for a bounce: the email's own touch, else the touch standing
// for that person's outbound email that day.
export const findEmailTouch = async (
  client: CoreApiClient,
  {
    personId,
    messageId,
    occurredOn,
  }: { personId: string; messageId: string; occurredOn: string },
): Promise<ExistingTouch | null> => {
  const rows = await queryTouches(client, {
    and: [
      LIVE_ONLY,
      { personId: { eq: personId } },
      {
        or: [
          { externalId: { eq: messageId } },
          {
            and: [
              { channel: { eq: TOUCH_CHANNEL_VALUES.email } },
              { direction: { eq: TOUCH_DIRECTION_VALUES.outbound } },
              { occurredOn: { eq: occurredOn } },
            ],
          },
        ],
      },
    ],
  });
  const own = rows.find((row) => row.externalId === messageId);

  if (own !== undefined) {
    return own;
  }

  return (
    rows
      .filter(
        (row) =>
          row.channel === TOUCH_CHANNEL_VALUES.email &&
          row.direction === TOUCH_DIRECTION_VALUES.outbound,
      )
      .sort(
        (first, second) =>
          String(first.createdAt ?? '').localeCompare(String(second.createdAt ?? '')) ||
          first.id.localeCompare(second.id),
      )[0] ?? null
  );
};

export const BOUNCED: TouchOutcomeValue = 'BOUNCED';

export const markBounced = (client: CoreApiClient, touchId: string) =>
  updateTouch(client, touchId, { outcome: BOUNCED });
