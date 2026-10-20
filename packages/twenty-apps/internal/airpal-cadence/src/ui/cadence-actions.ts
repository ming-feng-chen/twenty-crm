import { toCivilDate } from 'src/ui/dates';

// person.cadenceActions as the UI reads it (README "Contracts for the UI",
// version 1). The JSON comes from the database, so every field is checked;
// a value the UI does not understand is reported, never guessed at.

export const SUPPORTED_CADENCE_ACTIONS_VERSION = 1;

export type TouchTemplate = {
  channel: string | null;
  direction: string | null;
  outcome: string | null;
};

export type CadenceActionEntry = {
  action: string;
  touch: TouchTemplate | null;
};

export type CadenceActionsView = {
  state: string | null;
  stepLabel: string | null;
  positionLabel: string | null;
  nextActionDate: string | null;
  isNextActionDateTyped: boolean;
  isDue: boolean;
  strikes: number;
  replyOwedSince: string | null;
  blockedReason: string | null;
  inMailAvailable: boolean;
  isLinkedInPosition: boolean;
  isSuppressed: boolean;
  actions: CadenceActionEntry[];
  overflowActions: string[];
  problems: string[];
  ignoredTouches: { touchId: string; reason: string }[];
  writtenAt: string | null;
};

export type ParsedCadenceActions =
  | { ok: true; value: CadenceActionsView }
  | { ok: false; reason: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];

const parseTouch = (value: unknown): TouchTemplate | null =>
  isRecord(value)
    ? {
        channel: text(value.channel),
        direction: text(value.direction),
        outcome: text(value.outcome),
      }
    : null;

export const parseCadenceActions = (raw: unknown): ParsedCadenceActions => {
  let value = raw;

  // RAW_JSON can come back as a string from some API paths.
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return { ok: false, reason: 'The cadence data on this person is not valid JSON.' };
    }
  }

  if (value === null || value === undefined) {
    return {
      ok: false,
      reason: 'The cadence has not been worked out for this person yet.',
    };
  }

  if (!isRecord(value)) {
    return { ok: false, reason: 'The cadence data on this person is not readable.' };
  }

  if (value.version !== SUPPORTED_CADENCE_ACTIONS_VERSION) {
    return {
      ok: false,
      reason: `The cadence data is version ${String(value.version)}, which this page does not know (it reads version ${SUPPORTED_CADENCE_ACTIONS_VERSION}). Reload the page; if it persists, the app needs updating.`,
    };
  }

  const actions = Array.isArray(value.actions)
    ? value.actions
        .filter(isRecord)
        .filter((entry) => typeof entry.action === 'string')
        .map((entry) => ({
          action: entry.action as string,
          touch: parseTouch(entry.touch),
        }))
    : [];

  return {
    ok: true,
    value: {
      state: text(value.state),
      stepLabel: text(value.stepLabel),
      positionLabel: text(value.positionLabel),
      nextActionDate: toCivilDate(value.nextActionDate),
      isNextActionDateTyped: value.isNextActionDateTyped === true,
      isDue: value.isDue === true,
      strikes: typeof value.strikes === 'number' ? value.strikes : 0,
      replyOwedSince: toCivilDate(value.replyOwedSince),
      blockedReason: text(value.blockedReason),
      inMailAvailable: value.inMailAvailable === true,
      isLinkedInPosition: value.isLinkedInPosition === true,
      isSuppressed: value.isSuppressed === true,
      actions,
      overflowActions: strings(value.overflowActions),
      problems: strings(value.problems),
      ignoredTouches: Array.isArray(value.ignoredTouches)
        ? value.ignoredTouches.filter(isRecord).map((entry) => ({
            touchId: String(entry.touchId ?? ''),
            reason: String(entry.reason ?? ''),
          }))
        : [],
      writtenAt: text(value.writtenAt),
    },
  };
};
