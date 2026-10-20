import {
  cadenceHealth,
  cadenceStage,
  cadenceState,
  fromEngineChannel,
  touchDirection,
  touchOutcome,
  toEngineChannel,
  upperSnakeToCamel,
} from 'src/constants/cadence-values';
import {
  CADENCE_OVERFLOW_ACTIONS,
  type CadenceAction,
  type CadenceConfig,
  type CadenceContact,
  type CadenceResult,
  type CadenceTouch,
  type CadenceTouchTemplate,
  computeCadence,
  isLinkedInPosition,
  isTouchInFuture,
  touchForAction,
} from 'src/engine';
import { toDateOnly, todayIn } from 'src/utils/civil-date';
import { type PersonIdentitySource } from 'src/utils/normalize-identity';
import { stableStringify } from 'src/utils/stable-json';

// The person fields the engine reads or writes, as the API returns them.
export type PersonRecord = PersonIdentitySource & {
  id: string;
  updatedAt?: string | null;
  name?: { firstName?: string | null; lastName?: string | null } | null;
  cadenceOwnerId?: string | null;
  cadenceOwnerSince?: unknown;
  cadenceReplyResetAt?: string | null;
  cadenceStage?: string | null;
  cadenceHealth?: string | null;
  nextActionDate?: unknown;
  nextActionDateOverride?: unknown;
  snoozeUntil?: unknown;
  revisitDate?: unknown;
  optedOut?: boolean | null;
  optOutReason?: string | null;
  cadenceResumedAt?: unknown;
  cadenceStep?: string | null;
  cadencePosition?: string | null;
  cadenceState?: string | null;
  cadenceStrikes?: number | null;
  cadenceDue?: boolean | null;
  cadenceActions?: unknown;
  cadenceComputedOn?: unknown;
  cadenceOwnerChangeRequest?: unknown;
  lastTouchOn?: unknown;
};

export type TouchRecord = {
  id: string;
  personId?: string | null;
  channel?: string | null;
  direction?: string | null;
  outcome?: string | null;
  occurredOn?: unknown;
  occurredAt?: string | null;
  source?: string | null;
  createdAt?: string | null;
  deletedAt?: string | null;
};

const SYNCED_SOURCES = new Set(['GMAIL', 'CALENDAR']);

export type IgnoredTouch = { touchId: string; reason: string };

export const personDisplayName = (person: PersonRecord): string =>
  [person.name?.firstName, person.name?.lastName]
    .filter((part) => typeof part === 'string' && part.trim().length > 0)
    .join(' ') || 'Unnamed person';

// SPEC §2: email presence = primaryEmail non-empty, LinkedIn presence =
// primaryLinkUrl non-empty; a suppression match is an opt-out.
export const toCadenceContact = (
  person: PersonRecord,
  { suppressed }: { suppressed: boolean },
): { contact: CadenceContact; problems: string[] } => {
  const problems: string[] = [];
  const stage = cadenceStage.toEngine(person.cadenceStage);
  const health = cadenceHealth.toEngine(person.cadenceHealth);

  if (stage === null) {
    problems.push(
      `Stage "${String(person.cadenceStage)}" is not known; treated as Not contacted.`,
    );
  }

  if (health === null) {
    problems.push(
      `Health "${String(person.cadenceHealth)}" is not known; treated as Active.`,
    );
  }

  return {
    contact: {
      stage: stage ?? 'notContacted',
      health: health ?? 'active',
      hasOwner:
        typeof person.cadenceOwnerId === 'string' &&
        person.cadenceOwnerId.length > 0,
      ownerSince: toDateOnly(person.cadenceOwnerSince),
      ...(typeof person.cadenceReplyResetAt === 'string' &&
      Number.isFinite(Date.parse(person.cadenceReplyResetAt))
        ? { replyResetAt: person.cadenceReplyResetAt }
        : {}),
      hasEmail:
        typeof person.emails?.primaryEmail === 'string' &&
        person.emails.primaryEmail.trim().length > 0,
      hasLinkedinUrl:
        typeof person.linkedinLink?.primaryLinkUrl === 'string' &&
        person.linkedinLink.primaryLinkUrl.trim().length > 0,
      optedOut: person.optedOut === true || suppressed,
      cadenceResumedAt: toDateOnly(person.cadenceResumedAt),
      snoozeUntil: toDateOnly(person.snoozeUntil),
      revisitDate: toDateOnly(person.revisitDate),
      nextActionDateOverride: toDateOnly(person.nextActionDateOverride),
    },
    problems,
  };
};

const toEngineOutcome = (value: string | null | undefined): string | null =>
  value === null || value === undefined || value.length === 0
    ? null
    : (touchOutcome.toEngine(value) ?? upperSnakeToCamel(value));

type PreparedTouch = CadenceTouch & {
  touchId: string;
  isSynced: boolean;
  createdAt: string;
};

export const toCadenceTouchTemplate = (
  touch: Pick<TouchRecord, 'channel' | 'direction' | 'outcome'>,
): CadenceTouchTemplate | null => {
  const channel = toEngineChannel(touch.channel);
  const direction = touchDirection.toEngine(touch.direction);

  return channel === null || direction === null
    ? null
    : { channel, direction, outcome: toEngineOutcome(touch.outcome) };
};

// A manual touch and a synced one for the same channel, direction and day are
// one interaction (SPEC §1 Q7): each synced touch pairs off with one unpaired
// manual twin and drops out, lending it its outcome (a bounce, say).
const dedupeManualAndSynced = (
  touches: PreparedTouch[],
  ignored: IgnoredTouch[],
): PreparedTouch[] => {
  const unpairedManual = new Map<string, PreparedTouch[]>();
  const keyOf = (touch: PreparedTouch) =>
    `${touch.channel}|${touch.direction}|${String(touch.occurredAt)}`;

  for (const touch of touches) {
    if (!touch.isSynced) {
      const key = keyOf(touch);

      unpairedManual.set(key, [...(unpairedManual.get(key) ?? []), touch]);
    }
  }

  const dropped = new Set<string>();

  for (const touch of touches) {
    if (!touch.isSynced) {
      continue;
    }

    const twins = unpairedManual.get(keyOf(touch)) ?? [];
    const twin = twins.shift();

    if (twin === undefined) {
      continue;
    }

    if (twin.outcome === null && touch.outcome !== null) {
      twin.outcome = touch.outcome;
    }

    if (
      touch.occurredAtInstant !== undefined &&
      (twin.occurredAtInstant === undefined ||
        Date.parse(touch.occurredAtInstant) > Date.parse(twin.occurredAtInstant))
    ) {
      twin.occurredAtInstant = touch.occurredAtInstant;
    }

    dropped.add(touch.touchId);
    ignored.push({
      touchId: touch.touchId,
      reason: `duplicate of manual touch ${twin.touchId}`,
    });
  }

  return touches.filter((touch) => !dropped.has(touch.touchId));
};

// The engine's touches for one person: deleted, undated, unknown and
// future-dated touches are left out and reported, never fed to the engine.
export const prepareTouches = (
  records: readonly TouchRecord[],
  today: string,
  config: CadenceConfig,
  replyResetAt?: string | null,
): { touches: CadenceTouch[]; ignored: IgnoredTouch[] } => {
  const ignored: IgnoredTouch[] = [];
  const prepared: PreparedTouch[] = [];

  for (const record of records) {
    if (typeof record.deletedAt === 'string' && record.deletedAt.length > 0) {
      continue;
    }

    const template = toCadenceTouchTemplate(record);
    const occurredOn = toDateOnly(record.occurredOn);

    if (template === null) {
      ignored.push({
        touchId: record.id,
        reason: `no usable channel or direction (${String(record.channel)}, ${String(record.direction)})`,
      });
      continue;
    }

    if (occurredOn === null) {
      ignored.push({ touchId: record.id, reason: 'no occurredOn date' });
      continue;
    }

    const preciseTime = typeof record.occurredAt === 'string' &&
      Number.isFinite(Date.parse(record.occurredAt))
      ? new Date(record.occurredAt).toISOString()
      : undefined;
    const manualLoggingTime = !SYNCED_SOURCES.has(record.source ?? '') &&
      typeof record.createdAt === 'string' && Number.isFinite(Date.parse(record.createdAt))
      && todayIn(config.timeZone, new Date(record.createdAt)) === occurredOn
      ? new Date(record.createdAt).toISOString()
      : undefined;
    const occurredAtInstant = preciseTime === undefined ? manualLoggingTime
      : manualLoggingTime !== undefined && Date.parse(manualLoggingTime) > Date.parse(preciseTime)
        ? manualLoggingTime : preciseTime;
    const recordedTime = replyResetAt ? manualLoggingTime : undefined;
    const touch: CadenceTouch = {
      ...template,
      occurredAt: occurredOn,
      ...(occurredAtInstant === undefined ? {} : { occurredAtInstant }),
      ...(recordedTime === undefined ? {} : { recordedAtInstant: recordedTime }),
    };

    if (isTouchInFuture(touch, today, config)) {
      ignored.push({
        touchId: record.id,
        reason: `dated ${occurredOn}, which is in the future`,
      });
      continue;
    }

    prepared.push({
      ...touch,
      touchId: record.id,
      isSynced: SYNCED_SOURCES.has(record.source ?? ''),
      createdAt: record.createdAt ?? '',
    });
  }

  // Same-day touches keep the order they were logged in.
  prepared.sort(
    (first, second) =>
      String(first.occurredAt).localeCompare(String(second.occurredAt)) ||
      first.createdAt.localeCompare(second.createdAt) ||
      first.touchId.localeCompare(second.touchId),
  );

  return {
    touches: dedupeManualAndSynced(prepared, ignored).map(
      ({ channel, direction, outcome, occurredAt, occurredAtInstant, recordedAtInstant }) => ({
        channel,
        direction,
        outcome,
        occurredAt,
        ...(occurredAtInstant === undefined ? {} : { occurredAtInstant }),
        ...(recordedAtInstant === undefined ? {} : { recordedAtInstant }),
      }),
    ),
    ignored,
  };
};

// person.lastTouchOn: the day of the most recent touch of any kind (any
// channel, direction or source, a synced copy included) that is not deleted.
// A touch dated after today is left out, as it is from the engine: it has
// not happened yet. Null when there is none.
export const lastTouchOn = (
  records: readonly TouchRecord[],
  today: string,
): string | null => {
  let latest: string | null = null;

  for (const record of records) {
    if (typeof record.deletedAt === 'string' && record.deletedAt.length > 0) {
      continue;
    }

    const day = toDateOnly(record.occurredOn);

    if (day !== null && day <= today && (latest === null || day > latest)) {
      latest = day;
    }
  }

  return latest;
};

// A touch template in Twenty's values, ready for createTouch.
export type TwentyTouchTemplate = {
  channel: string | null;
  direction: string | null;
  outcome: string | null;
};

export const toTwentyTouchTemplate = (
  template: CadenceTouchTemplate | null,
): TwentyTouchTemplate | null =>
  template === null
    ? null
    : {
        channel: fromEngineChannel(template.channel),
        direction: touchDirection.fromEngine(template.direction),
        outcome:
          template.outcome === null
            ? null
            : (touchOutcome.fromEngine(template.outcome) ??
              template.outcome.toUpperCase()),
      };

export const CADENCE_ACTIONS_VERSION = 1;

// What My Day reads instead of running the engine (person.cadenceActions).
export type CadenceActionsJson = {
  version: typeof CADENCE_ACTIONS_VERSION;
  cadenceId: string;
  state: string | null;
  stepLabel: string;
  positionLabel: string;
  // What the engine wrote to nextActionDate; a different value in that field
  // means a person typed it.
  nextActionDate: string | null;
  proposedNextActionDate: string | null;
  isNextActionDateTyped: boolean;
  isDue: boolean;
  strikes: number;
  replyOwedSince: string | null;
  blockedReason: string | null;
  inMailAvailable: boolean;
  isLinkedInPosition: boolean;
  isSuppressed: boolean;
  actions: { action: CadenceAction; touch: TwentyTouchTemplate | null }[];
  overflowActions: string[];
  ignoredTouches: IgnoredTouch[];
  problems: string[];
  writtenAt?: string;
};

export type EngineFields = {
  nextActionDate: string | null;
  lastTouchOn: string | null;
  cadenceStep: string;
  cadencePosition: string;
  cadenceState: string | null;
  cadenceStrikes: number;
  cadenceDue: boolean;
  cadenceActions: CadenceActionsJson;
};

export type PersonCadenceComputation = {
  contact: CadenceContact;
  result: CadenceResult;
  fields: EngineFields;
};

export const computePersonCadence = ({
  person,
  touches,
  config,
  today,
  suppressed,
}: {
  person: PersonRecord;
  touches: readonly TouchRecord[];
  config: CadenceConfig;
  today: string;
  suppressed: boolean;
}): PersonCadenceComputation => {
  const { contact, problems } = toCadenceContact(person, { suppressed });
  const prepared = prepareTouches(touches, today, config, contact.replyResetAt);
  const result = computeCadence({
    contact,
    touches: prepared.touches,
    config,
    today,
  });
  const state = cadenceState.fromEngine(result.status.state);

  const actions = result.actions.map((action) => ({
    action,
    touch: toTwentyTouchTemplate(
      touchForAction({ action, result: result.position, contact, config }),
    ),
  }));

  return {
    contact,
    result,
    fields: {
      nextActionDate: result.nextActionDate,
      lastTouchOn: lastTouchOn(touches, today),
      cadenceStep: result.stepLabel,
      cadencePosition: result.positionLabel,
      cadenceState: state,
      cadenceStrikes: result.strikes,
      cadenceDue: result.isDue,
      cadenceActions: {
        version: CADENCE_ACTIONS_VERSION,
        cadenceId: config.id,
        state,
        stepLabel: result.stepLabel,
        positionLabel: result.positionLabel,
        nextActionDate: result.nextActionDate,
        proposedNextActionDate: result.proposedNextActionDate,
        isNextActionDateTyped: contact.nextActionDateOverride !== null,
        isDue: result.isDue,
        strikes: result.strikes,
        replyOwedSince:
          result.status.state === 'replyOwed' ? result.status.since : null,
        blockedReason: result.position.blockedReason ?? null,
        inMailAvailable: result.position.inMailAvailable === true,
        isLinkedInPosition: isLinkedInPosition(result.position, config),
        isSuppressed: suppressed,
        actions,
        overflowActions: [...CADENCE_OVERFLOW_ACTIONS],
        ignoredTouches: prepared.ignored,
        problems,
      },
    },
  };
};

// Fields a trigger decided from the edit itself, written together with the
// engine's outputs in the one update.
export type PersonInputPatch = {
  cadenceStage?: string;
  nextActionDateOverride?: string | null;
  cadenceOwnerSince?: string | null;
  cadenceReplyResetAt?: string | null;
  cadenceOwnerChangeRequest?: null;
  cadenceResumedAt?: string | null;
};

export const applyInputPatch = (
  person: PersonRecord,
  patch: PersonInputPatch,
): PersonRecord => ({ ...person, ...patch });

const DATE_FIELDS = new Set([
  'nextActionDate',
  'lastTouchOn',
  'nextActionDateOverride',
  'cadenceOwnerSince',
  'cadenceResumedAt',
]);

const comparable = (field: string, value: unknown): string => {
  if (DATE_FIELDS.has(field)) {
    return String(toDateOnly(value));
  }

  if (field === 'cadenceActions') {
    if (typeof value !== 'object' || value === null) {
      return 'null';
    }

    return stableStringify({
      ...(value as Record<string, unknown>),
      writtenAt: undefined,
    });
  }

  if (field === 'cadenceOwnerChangeRequest') {
    return stableStringify(value ?? null);
  }

  return stableStringify(value ?? null);
};

export type PersonUpdate = Record<string, unknown>;

// The single update for a person, or null when nothing would change. Writing
// only real changes is what keeps the triggers from looping. When anything is
// written, cadenceActions (with a fresh writtenAt) and cadenceComputedOn go
// with it, so every engine write names cadenceActions in updatedFields.
export const diffPersonUpdate = ({
  current,
  patch,
  fields,
  today,
  now = new Date(),
}: {
  current: PersonRecord;
  patch: PersonInputPatch;
  fields: EngineFields;
  today: string;
  now?: Date;
}): PersonUpdate | null => {
  const wanted: Record<string, unknown> = { ...patch, ...fields };
  const changed = Object.entries(wanted).filter(
    ([field, value]) =>
      comparable(field, value) !==
      comparable(field, (current as Record<string, unknown>)[field]),
  );

  if (changed.length === 0) {
    return null;
  }

  return {
    ...Object.fromEntries(changed),
    cadenceActions: { ...fields.cadenceActions, writtenAt: now.toISOString() },
    cadenceComputedOn: today,
  };
};

// The engine's last value for nextActionDate, as recorded with its write.
export const engineNextActionDate = (
  cadenceActions: unknown,
): string | null | undefined => {
  if (
    typeof cadenceActions !== 'object' ||
    cadenceActions === null ||
    !('nextActionDate' in cadenceActions)
  ) {
    return undefined;
  }

  return toDateOnly((cadenceActions as { nextActionDate?: unknown }).nextActionDate);
};

