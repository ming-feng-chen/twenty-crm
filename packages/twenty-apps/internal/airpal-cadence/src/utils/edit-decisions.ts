import { cadenceStage } from 'src/constants/cadence-values';
import {
  type CadenceConfig,
  type CadenceStage,
  doesEditMoveSchedule,
  stageAfterTouch,
} from 'src/engine';
import { toDateOnly, todayIn } from 'src/utils/civil-date';
import {
  engineNextActionDate,
  type PersonInputPatch,
  type PersonRecord,
  prepareTouches,
  toCadenceContact,
  type TouchRecord,
} from 'src/utils/person-cadence';

// Pure decisions the triggers take from an edit, before the engine runs. They
// return the input fields to change; the recompute writes them together with
// the engine's outputs.

export const OWNER_CHANGE_MODES = ['START_FRESH', 'KEEP_POSITION'] as const;

export type OwnerChangeMode = (typeof OWNER_CHANGE_MODES)[number];

// Written by the change-owner route in the same update as the new owner, so
// the person.updated trigger knows the handover kind was chosen explicitly.
export type OwnerChangeRequest = {
  toOwnerId: string | null;
  mode: OwnerChangeMode;
  requestedAt: string;
  requestedByWorkspaceMemberId: string | null;
};

export const parseOwnerChangeRequest = (
  value: unknown,
): OwnerChangeRequest | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const request = value as Record<string, unknown>;

  if (
    !OWNER_CHANGE_MODES.includes(request.mode as OwnerChangeMode) ||
    typeof request.requestedAt !== 'string'
  ) {
    return null;
  }

  return {
    toOwnerId:
      typeof request.toOwnerId === 'string' ? request.toOwnerId : null,
    mode: request.mode as OwnerChangeMode,
    requestedAt: request.requestedAt,
    requestedByWorkspaceMemberId:
      typeof request.requestedByWorkspaceMemberId === 'string'
        ? request.requestedByWorkspaceMemberId
        : null,
  };
};

const ownerIdOf = (person: Partial<PersonRecord> | undefined) =>
  typeof person?.cadenceOwnerId === 'string' && person.cadenceOwnerId.length > 0
    ? person.cadenceOwnerId
    : null;

// An update the engine made itself: every engine write carries cadenceActions.
export const isEngineWrite = (updatedFields: readonly string[]): boolean =>
  updatedFields.includes('cadenceActions');

export type PersonEdit = {
  before: PersonRecord;
  after: PersonRecord;
  updatedFields: readonly string[];
};

export type EditDecision = {
  patch: PersonInputPatch;
  notes: string[];
};

// SPEC §3 and §4 for one person.updated event that a person (not the engine)
// made: handover, hand-typed next action date, and stop-check edits that move
// the schedule.
export const decidePersonEdit = ({
  edit,
  touches,
  config,
  today,
  suppressed,
  now = new Date(),
  currentPerson,
}: {
  edit: PersonEdit;
  touches: readonly TouchRecord[];
  config: CadenceConfig;
  today: string;
  suppressed: boolean;
  now?: Date;
  currentPerson?: PersonRecord;
}): EditDecision => {
  const { before, after, updatedFields } = edit;
  const patch: PersonInputPatch = {};
  const notes: string[] = [];

  const ownerBefore = ownerIdOf(before);
  const ownerAfter = ownerIdOf(after);

  if (ownerBefore !== ownerAfter) {
    const request = parseOwnerChangeRequest(after.cadenceOwnerChangeRequest);
    const isExplicit =
      updatedFields.includes('cadenceOwnerChangeRequest') &&
      request !== null &&
      request.toOwnerId === ownerAfter;

    if (isExplicit) {
      // The change-owner route already wrote cadenceOwnerSince as asked.
      notes.push(`owner change with explicit mode ${request.mode}`);
    } else if (ownerBefore !== null && ownerAfter !== null) {
      // A queued event must reset at the edit time, not when its worker runs.
      const resetAt =
        typeof after.updatedAt === 'string' && Number.isFinite(Date.parse(after.updatedAt))
          ? new Date(after.updatedAt)
          : now;

      const current = currentPerson ?? after;
      const currentReset = Date.parse(current.cadenceReplyResetAt ?? '');
      const currentRequest = parseOwnerChangeRequest(current.cadenceOwnerChangeRequest);
      const newerExplicitChange =
        currentRequest !== null &&
        currentRequest.toOwnerId === ownerIdOf(current) &&
        Date.parse(currentRequest.requestedAt) >= resetAt.getTime();

      // Events can arrive out of order, including after an owner changes back.
      if (
        ownerIdOf(current) !== ownerAfter ||
        currentReset >= resetAt.getTime() ||
        newerExplicitChange
      ) {
        notes.push('native handover already applied or superseded');
      } else {
        patch.cadenceOwnerSince = todayIn(config.timeZone, resetAt);
        patch.cadenceReplyResetAt = resetAt.toISOString();
        notes.push('handover from a native edit: start fresh');
      }
    } else {
      notes.push(
        ownerBefore === null
          ? 'first assignment: not a handover'
          : 'owner removed: not a handover',
      );
    }
  }

  let isDateTypedInThisEdit = false;

  if (updatedFields.includes('nextActionDate')) {
    const typed = toDateOnly(after.nextActionDate);
    const engineValue = engineNextActionDate(after.cadenceActions);

    if (typed !== engineValue) {
      patch.nextActionDateOverride = typed;
      isDateTypedInThisEdit = true;
      notes.push(
        typed === null
          ? 'next action date cleared by hand: typed date removed'
          : `next action date typed by hand: ${typed}`,
      );
    }
  }

  if (!isDateTypedInThisEdit) {
    const preparedTouches = prepareTouches(touches, today, config).touches;
    const moves = doesEditMoveSchedule({
      before: toCadenceContact(before, { suppressed }).contact,
      after: toCadenceContact(after, { suppressed }).contact,
      touches: preparedTouches,
      today,
      config,
    });

    if (moves) {
      patch.nextActionDateOverride = null;
      notes.push('the edit starts or ends a stop: any typed date cleared');
    }
  }

  return { patch, notes };
};

// SPEC §3 on touch.created: the automatic stage moves, in the order the
// touches happened, and the end of any hand-typed date. Touches the engine
// ignores (future-dated, undated) change nothing.
export const decideTouchesCreated = ({
  person,
  createdTouches,
  config,
  today,
}: {
  person: PersonRecord;
  createdTouches: readonly TouchRecord[];
  config: CadenceConfig;
  today: string;
}): EditDecision => {
  const { touches } = prepareTouches(createdTouches, today, config);
  const patch: PersonInputPatch = {};
  const notes: string[] = [];

  if (touches.length === 0) {
    return { patch, notes: ['no usable new touch'] };
  }

  const startStage: CadenceStage =
    cadenceStage.toEngine(person.cadenceStage) ?? 'notContacted';
  let stage: CadenceStage = startStage;

  for (const touch of touches) {
    stage = stageAfterTouch(stage, touch, config).stage;
  }

  if (stage !== startStage) {
    const value = cadenceStage.fromEngine(stage);

    if (value === null) {
      notes.push(`stage ${stage} has no Stage option; left unchanged`);
    } else {
      patch.cadenceStage = value;
      notes.push(`stage moved to ${value}`);
    }
  }

  patch.nextActionDateOverride = null;

  return { patch, notes };
};
