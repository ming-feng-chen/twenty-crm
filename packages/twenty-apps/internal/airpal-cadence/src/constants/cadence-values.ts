import type {
  CadenceHealth,
  CadenceRequiredData,
  CadenceStage,
  CadenceStepGate,
  CadenceTouchDirection,
  CadenceWhenDataMissing,
  GapUnit,
  OutreachStatus,
} from 'src/engine';

// The one place where Twenty's stored SELECT values (UPPER_SNAKE_CASE) meet the
// engine's literals (camelCase). Field definitions, loaders and writers all go
// through this module; nothing else spells either side of a mapping.

// A subset of Twenty's tag colours.
type TagColor =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'turquoise'
  | 'sky'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'gray';

type SelectOption<TValue extends string, TEngine extends string> = {
  value: TValue;
  engine: TEngine;
  label: string;
  color: TagColor;
  // Kept for options that already exist on a deployed workspace; the CLI
  // derives a stable id from the label for the others.
  id?: string;
};

// Twenty's own rule for a SELECT option value (isSnakeCaseString): every
// value an admin can add has this shape.
const OPTION_VALUE_PATTERN = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/;

export const isOptionValue = (value: unknown): value is string =>
  typeof value === 'string' && OPTION_VALUE_PATTERN.test(value);

// camelCase of an option value, made reversible: a part keeps its
// underscore instead of a capital where a capital could not be read back,
// that is when it starts with a digit (CHANNEL_2 -> channel_2) or follows a
// one-character part (PLAN_B_TEST -> planB_test, not planBTest, which would
// read back as PLAN_BTEST). camelToUpperSnake is then its exact inverse on
// every option value, and no two values share a key.
export const upperSnakeToCamel = (value: string): string => {
  const parts = value
    .toLowerCase()
    .split('_')
    .filter((part) => part.length > 0);

  return parts
    .map((part, index) => {
      if (index === 0) {
        return part;
      }

      return /^[0-9]/.test(part) || parts[index - 1].length === 1
        ? `_${part}`
        : `${part[0].toUpperCase()}${part.slice(1)}`;
    })
    .join('');
};

export const camelToUpperSnake = (value: string): string =>
  value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();

const toFieldOptions = <TValue extends string, TEngine extends string>(
  options: readonly SelectOption<TValue, TEngine>[],
) =>
  options.map(({ value, label, color, id }, position) => ({
    ...(id === undefined ? {} : { id }),
    value,
    label,
    color,
    position,
  }));

const buildLookups = <TValue extends string, TEngine extends string>(
  options: readonly SelectOption<TValue, TEngine>[],
) => {
  const engineByValue = new Map<string, TEngine>(
    options.map((option) => [option.value, option.engine]),
  );
  const valueByEngine = new Map<string, TValue>(
    options.map((option) => [option.engine, option.value]),
  );

  return {
    toEngine: (value: string | null | undefined): TEngine | null =>
      value === null || value === undefined
        ? null
        : (engineByValue.get(value) ?? null),
    fromEngine: (engine: string | null | undefined): TValue | null =>
      engine === null || engine === undefined
        ? null
        : (valueByEngine.get(engine) ?? null),
  };
};

// Built-in channel values. Admin-added channels live in the cadence rules;
// their values map reversibly to engine keys by the same naming convention.
export const TOUCH_CHANNEL_OPTIONS = [
  {
    value: 'LINKEDIN_CONNECTION',
    engine: 'linkedinConnection',
    label: 'LinkedIn connection',
    color: 'blue',
    id: 'cda889c2-65b5-41af-b122-3d51def38295',
  },
  {
    value: 'LINKEDIN_MESSAGE',
    engine: 'linkedinMessage',
    label: 'LinkedIn message',
    color: 'sky',
    id: 'a166364f-6e0e-435c-983f-6a44f527f4f5',
  },
  {
    value: 'INMAIL',
    engine: 'inmail',
    label: 'InMail',
    color: 'turquoise',
    id: 'f87db706-34ed-47a2-bb5b-893e800027b1',
  },
  {
    value: 'EMAIL',
    engine: 'email',
    label: 'Email',
    color: 'green',
    id: 'dd22870f-f7d1-4847-9040-e15f5b406e42',
  },
  {
    value: 'CALL',
    engine: 'call',
    label: 'Call',
    color: 'orange',
    id: 'f844829d-2869-4d41-ba3b-de9c0d1d7131',
  },
  {
    value: 'MEETING',
    engine: 'meeting',
    label: 'Meeting',
    color: 'purple',
    id: 'ed979251-d389-40d6-997a-160e2e10e945',
  },
  {
    value: 'FOLLOW',
    engine: 'follow',
    label: 'Follow',
    color: 'gray',
    id: 'c6e85956-b033-4f5b-9185-b5eaf9522afb',
  },
  {
    value: 'COMMENT',
    engine: 'comment',
    label: 'Comment',
    color: 'yellow',
    id: '18084b57-7f9c-41cc-91a5-74a9a3f128f3',
  },
  { value: 'LIKE', engine: 'like', label: 'Like', color: 'pink' },
  {
    value: 'PROFILE_VIEW',
    engine: 'profileView',
    label: 'Profile view',
    color: 'gray',
  },
  { value: 'WHATSAPP', engine: 'whatsapp', label: 'WhatsApp', color: 'green' },
] as const satisfies readonly SelectOption<string, string>[];

export type TouchChannelValue = (typeof TOUCH_CHANNEL_OPTIONS)[number]['value'];

const channelLookups = buildLookups(TOUCH_CHANNEL_OPTIONS);

// A touch channel value to its engine key: the built-in mapping, else the
// naming rule. Null for nothing, or for a value Twenty could not hold.
export const toEngineChannel = (
  value: string | null | undefined,
): string | null => {
  if (value === null || value === undefined || value.length === 0) {
    return null;
  }

  const known = channelLookups.toEngine(value);

  if (known !== null) {
    return known;
  }

  return isOptionValue(value) ? upperSnakeToCamel(value) : null;
};

// The reverse. Null unless the key maps back to that same key, so a value
// never silently becomes a different channel.
export const fromEngineChannel = (
  engine: string | null | undefined,
): string | null => {
  if (engine === null || engine === undefined || engine.length === 0) {
    return null;
  }

  const known = channelLookups.fromEngine(engine);

  if (known !== null) {
    return known;
  }

  const value = camelToUpperSnake(engine);

  return isOptionValue(value) && toEngineChannel(value) === engine
    ? value
    : null;
};

// What "Sent InMail" logs on a new cadence (SPEC §1 E1).
export const DEFAULT_IN_MAIL_CHANNEL_VALUE: TouchChannelValue = 'INMAIL';

export const TOUCH_DIRECTION_OPTIONS = [
  {
    value: 'OUTBOUND',
    engine: 'outbound',
    label: 'Outbound',
    color: 'blue',
    id: '14df2ef0-d7cf-4f53-a0a4-f3b7f0d4debd',
  },
  {
    value: 'INBOUND',
    engine: 'inbound',
    label: 'Inbound',
    color: 'green',
    id: 'f9d906c6-1b52-430f-aad6-723e8d80b7ef',
  },
] as const satisfies readonly SelectOption<string, CadenceTouchDirection>[];

export type TouchDirectionValue =
  (typeof TOUCH_DIRECTION_OPTIONS)[number]['value'];

export const touchDirection = buildLookups(TOUCH_DIRECTION_OPTIONS);

// Outcomes are free strings to the engine; it compares them with the
// cadence's acceptedOutcome and bounce outcome ('accepted', 'bounced').
export const TOUCH_OUTCOME_OPTIONS = [
  { value: 'SENT', engine: 'sent', label: 'Sent', color: 'blue' },
  { value: 'DELIVERED', engine: 'delivered', label: 'Delivered', color: 'sky' },
  { value: 'REPLIED', engine: 'replied', label: 'Replied', color: 'green' },
  { value: 'IGNORED', engine: 'ignored', label: 'Ignored', color: 'gray' },
  { value: 'BOUNCED', engine: 'bounced', label: 'Bounced', color: 'red' },
  { value: 'ACCEPTED', engine: 'accepted', label: 'Accepted', color: 'turquoise' },
] as const satisfies readonly SelectOption<string, string>[];

export type TouchOutcomeValue = (typeof TOUCH_OUTCOME_OPTIONS)[number]['value'];

export const touchOutcome = buildLookups(TOUCH_OUTCOME_OPTIONS);

// Source has no engine meaning; the engine literal is unused.
export const TOUCH_SOURCE_OPTIONS = [
  { value: 'MANUAL', engine: 'manual', label: 'Manual', color: 'gray' },
  { value: 'GMAIL', engine: 'gmail', label: 'Gmail', color: 'red' },
  { value: 'CALENDAR', engine: 'calendar', label: 'Calendar', color: 'blue' },
] as const satisfies readonly SelectOption<string, string>[];

export type TouchSourceValue = (typeof TOUCH_SOURCE_OPTIONS)[number]['value'];

export const CADENCE_STAGE_OPTIONS = [
  {
    value: 'NOT_CONTACTED',
    engine: 'notContacted',
    label: 'Not contacted',
    color: 'gray',
  },
  {
    value: 'CONTACTED_NO_REPLY',
    engine: 'contactedNoReply',
    label: 'Contacted - no reply',
    color: 'sky',
  },
  {
    value: 'REPLIED_IN_CONVERSATION',
    engine: 'repliedInConversation',
    label: 'Replied - in conversation',
    color: 'blue',
  },
  {
    value: 'MEETING_SCHEDULED',
    engine: 'meetingScheduled',
    label: 'Meeting scheduled',
    color: 'turquoise',
  },
  { value: 'DECK_SENT', engine: 'deckSent', label: 'Deck sent', color: 'purple' },
  {
    value: 'DECK_REVIEWED_FOLLOW_UP',
    engine: 'deckReviewedFollowUp',
    label: 'Deck reviewed - follow up',
    color: 'pink',
  },
  {
    value: 'PILOT_DISCUSSION',
    engine: 'pilotDiscussion',
    label: 'Pilot discussion',
    color: 'orange',
  },
  {
    value: 'PILOT_AGREED',
    engine: 'pilotAgreed',
    label: 'Pilot agreed',
    color: 'green',
  },
  { value: 'DEAD', engine: 'dead', label: 'Dead', color: 'red' },
] as const satisfies readonly SelectOption<string, CadenceStage>[];

export type CadenceStageValue = (typeof CADENCE_STAGE_OPTIONS)[number]['value'];

export const cadenceStage = buildLookups(CADENCE_STAGE_OPTIONS);

export const CADENCE_HEALTH_OPTIONS = [
  { value: 'ACTIVE', engine: 'active', label: 'Active', color: 'green' },
  { value: 'HOLD', engine: 'hold', label: 'Hold', color: 'yellow' },
  { value: 'DEAD', engine: 'dead', label: 'Dead', color: 'red' },
] as const satisfies readonly SelectOption<string, CadenceHealth>[];

export type CadenceHealthValue =
  (typeof CADENCE_HEALTH_OPTIONS)[number]['value'];

export const cadenceHealth = buildLookups(CADENCE_HEALTH_OPTIONS);

export const OPT_OUT_REASON_OPTIONS = [
  {
    value: 'NOT_INTERESTED',
    engine: 'notInterested',
    label: 'Not interested',
    color: 'gray',
  },
  {
    value: 'WRONG_PERSON',
    engine: 'wrongPerson',
    label: 'Wrong person',
    color: 'orange',
  },
  {
    value: 'NO_LONGER_THERE',
    engine: 'noLongerThere',
    label: 'No longer there',
    color: 'yellow',
  },
  {
    value: 'ASKED_US_TO_STOP',
    engine: 'askedUsToStop',
    label: 'Asked us to stop',
    color: 'red',
  },
  { value: 'OTHER', engine: 'other', label: 'Other', color: 'gray' },
] as const satisfies readonly SelectOption<string, string>[];

export type OptOutReasonValue =
  (typeof OPT_OUT_REASON_OPTIONS)[number]['value'];

// The only reason with a consequence beyond opting out: a permanent suppression.
export const SUPPRESSING_OPT_OUT_REASON: OptOutReasonValue = 'ASKED_US_TO_STOP';

export const CADENCE_STATE_OPTIONS = [
  { value: 'OPTED_OUT', engine: 'optedOut', label: 'Opted out', color: 'red' },
  { value: 'DEAD', engine: 'dead', label: 'Dead', color: 'red' },
  { value: 'BOUNCED', engine: 'bounced', label: 'Bounced', color: 'orange' },
  {
    value: 'REPLY_OWED',
    engine: 'replyOwed',
    label: 'Reply owed',
    color: 'pink',
  },
  { value: 'HOLD', engine: 'hold', label: 'Hold', color: 'yellow' },
  { value: 'SNOOZED', engine: 'snoozed', label: 'Snoozed', color: 'gray' },
  {
    value: 'AWAITING_RESUME',
    engine: 'awaitingResume',
    label: 'Awaiting resume',
    color: 'purple',
  },
  {
    value: 'IN_CONVERSATION',
    engine: 'inConversation',
    label: 'In conversation',
    color: 'blue',
  },
  { value: 'RUNNING', engine: 'running', label: 'Running', color: 'green' },
] as const satisfies readonly SelectOption<string, OutreachStatus['state']>[];

export type CadenceStateValue = (typeof CADENCE_STATE_OPTIONS)[number]['value'];

export const cadenceState = buildLookups(CADENCE_STATE_OPTIONS);

export const GAP_UNIT_OPTIONS = [
  {
    value: 'BUSINESS_DAYS',
    engine: 'businessDays',
    label: 'Business days',
    color: 'blue',
  },
  {
    value: 'CALENDAR_DAYS',
    engine: 'calendarDays',
    label: 'Calendar days',
    color: 'purple',
  },
] as const satisfies readonly SelectOption<string, GapUnit>[];

export type GapUnitValue = (typeof GAP_UNIT_OPTIONS)[number]['value'];

export const gapUnit = buildLookups(GAP_UNIT_OPTIONS);

export const REQUIRED_DATA_OPTIONS = [
  {
    value: 'LINKEDIN_URL',
    engine: 'linkedinUrl',
    label: 'LinkedIn URL',
    color: 'blue',
  },
  { value: 'EMAIL', engine: 'email', label: 'Email address', color: 'green' },
] as const satisfies readonly SelectOption<string, CadenceRequiredData>[];

export type RequiredDataValue = (typeof REQUIRED_DATA_OPTIONS)[number]['value'];

export const requiredData = buildLookups(REQUIRED_DATA_OPTIONS);

export const WHEN_DATA_MISSING_OPTIONS = [
  { value: 'SKIP', engine: 'skip', label: 'Skip the step', color: 'gray' },
  { value: 'BLOCK', engine: 'block', label: 'Block until added', color: 'red' },
] as const satisfies readonly SelectOption<string, CadenceWhenDataMissing>[];

export type WhenDataMissingValue =
  (typeof WHEN_DATA_MISSING_OPTIONS)[number]['value'];

export const whenDataMissing = buildLookups(WHEN_DATA_MISSING_OPTIONS);

export const STEP_GATE_OPTIONS = [
  {
    value: 'LINKEDIN_ACCEPTED',
    engine: 'linkedinAccepted',
    label: 'LinkedIn accepted',
    color: 'blue',
  },
] as const satisfies readonly SelectOption<string, CadenceStepGate>[];

export type StepGateValue = (typeof STEP_GATE_OPTIONS)[number]['value'];

export const stepGate = buildLookups(STEP_GATE_OPTIONS);

// SELECT field option lists, in the shape defineField expects.
export const FIELD_OPTIONS = {
  touchChannel: toFieldOptions(TOUCH_CHANNEL_OPTIONS),
  touchDirection: toFieldOptions(TOUCH_DIRECTION_OPTIONS),
  touchOutcome: toFieldOptions(TOUCH_OUTCOME_OPTIONS),
  touchSource: toFieldOptions(TOUCH_SOURCE_OPTIONS),
  cadenceStage: toFieldOptions(CADENCE_STAGE_OPTIONS),
  cadenceHealth: toFieldOptions(CADENCE_HEALTH_OPTIONS),
  optOutReason: toFieldOptions(OPT_OUT_REASON_OPTIONS),
  cadenceState: toFieldOptions(CADENCE_STATE_OPTIONS),
  gapUnit: toFieldOptions(GAP_UNIT_OPTIONS),
  requiredData: toFieldOptions(REQUIRED_DATA_OPTIONS),
  whenDataMissing: toFieldOptions(WHEN_DATA_MISSING_OPTIONS),
  stepGate: toFieldOptions(STEP_GATE_OPTIONS),
};

// Quoted, as Twenty stores SELECT default values.
export const quotedSelectDefault = (value: string) => `'${value}'`;
