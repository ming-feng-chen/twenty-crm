import type { CadenceRules } from 'src/utils/cadence-rules';
import type { TouchChannelOption } from 'src/utils/touch-channels';

import { callRoute } from 'src/ui/api';
import { type TouchTemplate } from 'src/ui/cadence-actions';
import { type RoutePersonView } from 'src/ui/my-day';

// The app's HTTP routes, exactly as README "Contracts for the UI" describes
// them. Each call acts as the viewer; a refusal rejects with its message.

type PersonAnswer = { person: RoutePersonView | null };

export type LogTouchRequest = {
  personId: string;
  action?: string;
  touch?: Pick<TouchTemplate, 'channel' | 'direction'> & {
    outcome?: string | null;
  };
  occurredOn?: string;
  note?: string;
};

export type LogTouchAnswer = PersonAnswer & { touchId: string };

export const logTouchRoute = (request: LogTouchRequest) =>
  callRoute<LogTouchAnswer>('POST', '/cadence/log-touch', request);

export type UndoTouchAnswer = PersonAnswer & { personId: string | null };

export const undoTouchRoute = (touchId: string) =>
  callRoute<UndoTouchAnswer>('POST', '/cadence/undo-touch', { touchId });

export type OwnerChangeMode = 'START_FRESH' | 'KEEP_POSITION';

export type ChangeOwnerAnswer = PersonAnswer & {
  changed: boolean;
  isHandover: boolean;
  mode?: OwnerChangeMode;
  warnings?: string[];
};

export const changeOwnerRoute = (request: {
  personId: string;
  ownerId: string | null;
  mode: OwnerChangeMode;
}) => callRoute<ChangeOwnerAnswer>('POST', '/cadence/change-owner', request);

export const resumeRoute = (personId: string) =>
  callRoute<PersonAnswer>('POST', '/cadence/resume', { personId });

export const recomputeRoute = (personId: string) =>
  callRoute<PersonAnswer>('POST', '/cadence/recompute', { personId });

export type RulesAnswer = {
  cadenceId: string | null;
  storedRules: CadenceRules | null;
  storedRulesErrors: string[];
  activeRules: CadenceRules | null;
  activeSource: string;
  problems: string[];
  isSaveInProgress: boolean;
  defaults: CadenceRules;
  // The saved outreach channel list; null with
  // touchChannelsError when the server could not read them.
  touchChannels: TouchChannelOption[] | null;
  touchChannelsError: string | null;
};

export const getRulesRoute = () =>
  callRoute<RulesAnswer>('GET', '/cadence/rules');

export type PreviewAnswer = {
  contactsRecomputed: number;
  contactsWhoseDateChanged: number;
  changes: {
    personId: string;
    name: string;
    ownerId: string | null;
    from: string | null;
    to: string | null;
  }[];
};

export const previewRulesRoute = (rules: CadenceRules) =>
  callRoute<PreviewAnswer>('POST', '/cadence/rules/preview', { rules });

export type SaveAnswer =
  | {
      status: 'applied';
      cadenceChangeId: string;
      summary: string;
      contactsRecomputed: number;
      contactsWhoseDateChanged: number;
      failures: { personId: string; error: string }[];
    }
  | { status: 'unchanged' };

export const saveRulesRoute = (
  rules: CadenceRules,
  baseRules: CadenceRules | null,
) =>
  callRoute<SaveAnswer>('POST', '/cadence/rules/save', {
    rules,
    ...(baseRules === null ? {} : { baseRules }),
  });

// The validator's errors in a 422 answer.
export const errorsOf = (body: Record<string, unknown> | null): string[] =>
  Array.isArray(body?.errors)
    ? body.errors.filter((error): error is string => typeof error === 'string')
    : [];
