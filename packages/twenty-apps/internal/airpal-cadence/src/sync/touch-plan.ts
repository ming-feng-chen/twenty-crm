import { createHash } from 'crypto';

import {
  type TouchChannelValue,
  type TouchDirectionValue,
  type TouchOutcomeValue,
  type TouchSourceValue,
} from 'src/constants/cadence-values';
import { toDateOnly } from 'src/utils/civil-date';

// External ids make retries idempotent and preserve Undo. The day's survivor
// retains the latest email time without consuming another cadence step.
// Concurrent creates converge onto the same survivor after writing.

export const SYNC_SOURCES = {
  gmail: 'GMAIL',
  calendar: 'CALENDAR',
} as const satisfies Record<string, TouchSourceValue>;

export type SyncSource = (typeof SYNC_SOURCES)[keyof typeof SYNC_SOURCES];

const SYNCED_SOURCE_VALUES = new Set<string>(Object.values(SYNC_SOURCES));

export const isSyncedSource = (source: string | null | undefined): boolean =>
  SYNCED_SOURCE_VALUES.has(source ?? '');

// A calendar touch the sync withdrew (the meeting moved into the future or was
// cancelled) keeps its id; its external id is rewritten so it is never taken
// for an Undo, and it can be restored if the meeting comes back.
export const RETIRED_EXTERNAL_ID_PREFIX = 'retired:';

export const retiredExternalId = (externalId: string) =>
  `${RETIRED_EXTERNAL_ID_PREFIX}${externalId}`;

// Name-based, formatted with v4 version and variant bits so Twenty's UUID
// validation accepts it (the same scheme as Twenty's call-recorder app).
export const syncTouchId = ({
  source,
  personId,
  externalId,
}: {
  source: SyncSource;
  personId: string;
  externalId: string;
}): string => {
  const bytes = createHash('sha256')
    .update(`airpal-cadence:sync-touch:${source}:${personId}:${externalId}`)
    .digest();

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.subarray(0, 16).toString('hex');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export type SyncTouchCandidate = {
  source: SyncSource;
  personId: string;
  channel: TouchChannelValue;
  direction: TouchDirectionValue;
  occurredOn: string;
  occurredAt?: string;
  externalId: string;
};

// A touch as read back for dedupe (live and deleted).
export type ExistingTouch = {
  id: string;
  personId?: string | null;
  channel?: string | null;
  direction?: string | null;
  occurredOn?: unknown;
  occurredAt?: string | null;
  source?: string | null;
  externalId?: string | null;
  outcome?: string | null;
  createdAt?: string | null;
  deletedAt?: string | null;
};

export const isDeletedTouch = (touch: ExistingTouch): boolean =>
  typeof touch.deletedAt === 'string' && touch.deletedAt.length > 0;

export const dayGroupKey = (touch: {
  personId?: string | null;
  channel?: string | null;
  direction?: string | null;
  occurredOn?: unknown;
}): string =>
  [
    touch.personId ?? '',
    touch.channel ?? '',
    touch.direction ?? '',
    toDateOnly(touch.occurredOn) ?? '',
  ].join('|');

const byAge = (first: ExistingTouch, second: ExistingTouch) =>
  String(first.createdAt ?? '').localeCompare(String(second.createdAt ?? '')) ||
  first.id.localeCompare(second.id);

export type TouchAction =
  | { kind: 'create'; id: string }
  | { kind: 'enrich'; touchId: string; reason: string }
  | { kind: 'recordTime'; touchId: string }
  | { kind: 'move'; touchId: string; from: string | null }
  | { kind: 'restore'; touchId: string }
  | { kind: 'none'; reason: string };

// What to do for one candidate, given every touch of that person that has its
// id, its external id, or its channel, direction and day.
export const decideTouchAction = (
  candidate: SyncTouchCandidate,
  existing: readonly ExistingTouch[],
): TouchAction => {
  const id = syncTouchId(candidate);
  const own = existing.find((touch) => touch.id === id);
  const hasLaterTime = (touch: ExistingTouch) =>
    candidate.occurredAt !== undefined &&
    (touch.occurredAt == null ||
      Date.parse(candidate.occurredAt) > Date.parse(touch.occurredAt));

  if (own !== undefined) {
    if (isDeletedTouch(own)) {
      return own.externalId === retiredExternalId(candidate.externalId)
        ? { kind: 'restore', touchId: own.id }
        : { kind: 'none', reason: 'deleted (undone or merged into another touch)' };
    }

    const day = toDateOnly(own.occurredOn);

    // Only a meeting moves. An email's day is fixed once synced (a later
    // change of the cadence time zone does not rewrite history).
    if (day !== candidate.occurredOn && candidate.source === SYNC_SOURCES.calendar) {
      return { kind: 'move', touchId: own.id, from: day };
    }

    return hasLaterTime(own)
      ? { kind: 'recordTime', touchId: own.id }
      : { kind: 'none', reason: 'already synced' };
  }

  const sameExternalId = existing.find(
    (touch) =>
      touch.personId === candidate.personId &&
      touch.externalId === candidate.externalId,
  );

  if (sameExternalId !== undefined) {
    if (!isDeletedTouch(sameExternalId) && hasLaterTime(sameExternalId)) {
      return { kind: 'recordTime', touchId: sameExternalId.id };
    }

    return {
      kind: 'none',
      reason: isDeletedTouch(sameExternalId)
        ? `touch ${sameExternalId.id} with this external id was deleted`
        : `touch ${sameExternalId.id} already has this external id`,
    };
  }

  const key = dayGroupKey(candidate);
  const sameDay = existing
    .filter((touch) => !isDeletedTouch(touch) && dayGroupKey(touch) === key)
    .sort(byAge);

  if (sameDay.length === 0) {
    return { kind: 'create', id };
  }

  const manualTwin = sameDay.find(
    (touch) =>
      !isSyncedSource(touch.source) &&
      (touch.externalId === null ||
        touch.externalId === undefined ||
        touch.externalId.length === 0),
  );

  if (manualTwin !== undefined) {
    return {
      kind: 'enrich',
      touchId: manualTwin.id,
      reason: 'manual touch the same day',
    };
  }

  const survivor = sameDay.find((touch) => !isSyncedSource(touch.source)) ?? sameDay[0];

  if (hasLaterTime(survivor)) {
    return { kind: 'recordTime', touchId: survivor.id };
  }

  return {
    kind: 'none',
    reason: `touch ${sameDay[0].id} exists for the same channel, direction and day`,
  };
};

export type ConvergencePlan = {
  survivorId: string;
  deleteIds: string[];
  update: { externalId?: string; outcome?: TouchOutcomeValue; occurredAt?: string } | null;
};

// One day's group (same person, channel, direction and day), live touches
// only. Manual touches are never deleted. If there is one, the oldest manual
// touch stands for the group: every synced touch in it is deleted and the
// survivor takes the oldest synced touch's external id when it has none. If
// all are synced, the oldest stands. A deleted copy's outcome (a bounce)
// passes to the survivor when it has none. Every run computes the same
// survivor from the same rows, and the oldest touch of a group is never
// deleted unless a manual touch outranks it, so racing runs never delete the
// whole group.
export const planConvergence = (
  group: readonly ExistingTouch[],
  latestCandidateTime?: string,
): ConvergencePlan | null => {
  const live = group.filter((touch) => !isDeletedTouch(touch)).sort(byAge);
  const synced = live.filter((touch) => isSyncedSource(touch.source));
  const manual = live.filter((touch) => !isSyncedSource(touch.source));

  if (live.length === 0) {
    return null;
  }

  const survivor = manual[0] ?? synced[0];
  const deleted = synced.filter((touch) => touch.id !== survivor.id);

  if (deleted.length === 0 && latestCandidateTime === undefined) {
    return null;
  }

  const update: NonNullable<ConvergencePlan['update']> = {};
  const latestTime = [
    ...live.flatMap((touch) => touch.occurredAt ? [touch.occurredAt] : []),
    ...(latestCandidateTime === undefined ? [] : [latestCandidateTime]),
  ]
    .sort((first, second) => Date.parse(second) - Date.parse(first))[0];

  if (latestTime && latestTime !== survivor.occurredAt) {
    update.occurredAt = latestTime;
  }

  if (deleted.length === 0 && update.occurredAt === undefined) {
    return null;
  }
  const survivorHasExternalId =
    typeof survivor.externalId === 'string' && survivor.externalId.length > 0;
  const lender = deleted.find(
    (touch) => typeof touch.externalId === 'string' && touch.externalId.length > 0,
  );

  if (!survivorHasExternalId && lender?.externalId) {
    update.externalId = lender.externalId;
  }

  const outcomeLender = deleted.find(
    (touch) => typeof touch.outcome === 'string' && touch.outcome.length > 0,
  );

  if (
    (survivor.outcome === null || survivor.outcome === undefined) &&
    outcomeLender?.outcome
  ) {
    update.outcome = outcomeLender.outcome as TouchOutcomeValue;
  }

  return {
    survivorId: survivor.id,
    deleteIds: deleted.map((touch) => touch.id),
    update: Object.keys(update).length === 0 ? null : update,
  };
};
