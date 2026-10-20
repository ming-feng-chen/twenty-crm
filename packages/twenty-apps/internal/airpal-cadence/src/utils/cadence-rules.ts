import {
  camelToUpperSnake,
  DEFAULT_IN_MAIL_CHANNEL_VALUE,
  fromEngineChannel,
  gapUnit,
  isOptionValue,
  requiredData,
  stepGate,
  toEngineChannel,
  whenDataMissing,
} from 'src/constants/cadence-values';
import {
  type CadenceConfig,
  type CadenceDuration,
  type CadenceStepDefinition,
  DEFAULT_CADENCE_CONFIG,
  validateCadenceConfig,
} from 'src/engine';
import { BUILT_IN_TOUCH_CHANNEL_OPTIONS, type TouchChannelOption } from 'src/utils/touch-channels';
import { validateManagedChannels } from 'src/utils/validate-managed-channels.util';

// The rules as Twenty stores them: the cadence record's settings and its steps
// in run order, with SELECT values as stored (UPPER_SNAKE_CASE). This is the
// shape of the `lastValidRules` snapshot, of cadenceChange before/after, and
// of what the rules routes accept, so the engine's own types can change
// without invalidating anything stored.
export type CadenceRuleStep = {
  key: string | null;
  label: string | null;
  channel: string | null;
  // null means for ever.
  repeat: number | null;
  gapBeforeAmount: number | null;
  gapBeforeUnit: string | null;
  occurrenceNoun: string | null;
  requiredData: string | null;
  whenDataMissing: string | null;
  gate: string | null;
};

export type CadenceRules = {
  touchChannels: TouchChannelOption[];
  name: string | null;
  timeZone: string | null;
  skipWeekends: boolean | null;
  strikeSilenceGapAmount: number | null;
  strikeSilenceGapUnit: string | null;
  strikeLimit: number | null;
  acceptanceTimeoutAmount: number | null;
  acceptanceTimeoutUnit: string | null;
  nonAdvancingChannels: string[] | null;
  // What "Sent InMail" logs (E1).
  inMailChannel: string | null;
  steps: CadenceRuleStep[];
};

export const CADENCE_RULES_SNAPSHOT_VERSION = 1;

export type CadenceRulesSnapshot = {
  version: typeof CADENCE_RULES_SNAPSHOT_VERSION;
  cadenceId: string;
  rules: CadenceRules;
};

// Not stored on the cadence (SPEC §2 lists no field for them), so they stay
// the engine defaults: the connection request channel and its "accepted"
// outcome, the bounce rule and the conversational channels. The InMail
// channel is stored (cadence.inMailChannel).
const FIXED_RULES = {
  connectionRequest: {
    channel: DEFAULT_CADENCE_CONFIG.connectionRequest.channel,
    acceptedOutcome: DEFAULT_CADENCE_CONFIG.connectionRequest.acceptedOutcome,
  },
  bounce: DEFAULT_CADENCE_CONFIG.bounce,
  conversationalChannels: DEFAULT_CADENCE_CONFIG.conversationalChannels,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const textOrNull = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

const numberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const booleanOrNull = (value: unknown): boolean | null =>
  typeof value === 'boolean' ? value : null;

const blankToNull = (value: string | null): string | null =>
  value === null || value.trim().length === 0 ? null : value;

const normalizeRuleStep = (value: unknown): CadenceRuleStep => {
  const step = isRecord(value) ? value : {};

  return {
    key: textOrNull(step.key),
    label: textOrNull(step.label),
    channel: textOrNull(step.channel),
    repeat: numberOrNull(step.repeat),
    gapBeforeAmount: numberOrNull(step.gapBeforeAmount),
    gapBeforeUnit: textOrNull(step.gapBeforeUnit),
    occurrenceNoun: blankToNull(textOrNull(step.occurrenceNoun)),
    requiredData: textOrNull(step.requiredData),
    whenDataMissing: textOrNull(step.whenDataMissing),
    gate: textOrNull(step.gate),
  };
};

// Accepts anything (a route body, a stored snapshot, a record) and keeps only
// the known keys with the right primitive types. It never throws.
export const normalizeCadenceRules = (value: unknown): CadenceRules => {
  const rules = isRecord(value) ? value : {};

  return {
    name: textOrNull(rules.name),
    touchChannels: Array.isArray(rules.touchChannels)
      ? rules.touchChannels.map((option) => ({
          value: isRecord(option) && typeof option.value === 'string' ? option.value : '',
          label: isRecord(option) && typeof option.label === 'string' ? option.label : '',
        }))
      : [...BUILT_IN_TOUCH_CHANNEL_OPTIONS],
    timeZone: textOrNull(rules.timeZone),
    skipWeekends: booleanOrNull(rules.skipWeekends),
    strikeSilenceGapAmount: numberOrNull(rules.strikeSilenceGapAmount),
    strikeSilenceGapUnit: textOrNull(rules.strikeSilenceGapUnit),
    strikeLimit: numberOrNull(rules.strikeLimit),
    acceptanceTimeoutAmount: numberOrNull(rules.acceptanceTimeoutAmount),
    acceptanceTimeoutUnit: textOrNull(rules.acceptanceTimeoutUnit),
    nonAdvancingChannels: Array.isArray(rules.nonAdvancingChannels)
      ? rules.nonAdvancingChannels.filter(
          (channel): channel is string => typeof channel === 'string',
        )
      : null,
    // Rules written before the InMail had its own channel (a snapshot, an
    // audit record) do not name it; they meant the default.
    inMailChannel:
      rules.inMailChannel === undefined
        ? DEFAULT_IN_MAIL_CHANNEL_VALUE
        : blankToNull(textOrNull(rules.inMailChannel)),
    steps: Array.isArray(rules.steps) ? rules.steps.map(normalizeRuleStep) : [],
  };
};

export type CadenceStepRecordLike = Partial<
  Record<keyof CadenceRuleStep, unknown>
> & { id?: string; position?: unknown };

// Steps run in ascending position. Two steps on the same position, or one
// without a position, would make the order a guess, so that is an error.
export const rulesFromRecords = (
  cadence: Partial<Record<keyof Omit<CadenceRules, 'steps'>, unknown>>,
  steps: readonly CadenceStepRecordLike[],
): { rules: CadenceRules; errors: string[] } => {
  const errors: string[] = [];
  const positioned = steps.map((step, index) => ({
    step,
    index,
    position: numberOrNull(step.position),
  }));

  for (const { step, position } of positioned) {
    if (position === null) {
      errors.push(
        `The step "${String(step.label ?? step.key ?? step.id)}" has no position, so its place in the order is unknown.`,
      );
    }
  }

  const positions = positioned
    .map(({ position }) => position)
    .filter((position): position is number => position !== null);

  for (const position of new Set(positions)) {
    if (positions.filter((candidate) => candidate === position).length > 1) {
      errors.push(
        `Two steps share position ${position}, so their order is ambiguous.`,
      );
    }
  }

  const ordered = [...positioned].sort(
    (first, second) =>
      (first.position ?? Number.POSITIVE_INFINITY) -
        (second.position ?? Number.POSITIVE_INFINITY) ||
      first.index - second.index,
  );

  return {
    rules: normalizeCadenceRules({
      ...cadence,
      steps: ordered.map(({ step }) => step),
    }),
    errors,
  };
};

const subjectOf = (step: CadenceRuleStep, index: number) =>
  `Step ${index + 1}${step.label === null ? '' : ` ("${step.label}")`}`;

const toDuration = (
  amount: number | null,
  unit: string | null,
  subject: string,
  errors: string[],
): CadenceDuration => {
  const engineUnit = gapUnit.toEngine(unit);

  if (unit !== null && engineUnit === null) {
    errors.push(`${subject} has an unknown unit "${unit}".`);
  }

  // Missing values are passed through so the engine's validator words the
  // error ("must be a whole number of days", "unknown unit").
  return { amount, unit: engineUnit } as unknown as CadenceDuration;
};

const optionalLiteral = <TEngine extends string>(
  value: string | null,
  lookup: { toEngine: (value: string | null) => TEngine | null },
  subject: string,
  description: string,
  errors: string[],
): TEngine | undefined => {
  if (value === null) {
    return undefined;
  }

  const engine = lookup.toEngine(value);

  if (engine === null) {
    errors.push(`${subject} has an unknown ${description} "${value}".`);

    return undefined;
  }

  return engine;
};

// Channel codes must remain stable and belong to the managed list. Returns the engine key (the raw value when there is none,
// so the engine's own checks still run on it).
const checkChannel = (
  value: string,
  subject: string,
  touchChannels: readonly string[] | undefined,
  errors: string[],
): string => {
  if (!isOptionValue(value)) {
    errors.push(
      `${subject}: "${value}" is not a channel value (UPPER_SNAKE_CASE, as the touch's Channel field stores it).`,
    );

    return value;
  }

  if (touchChannels !== undefined && !touchChannels.includes(value)) {
    errors.push(
      `${subject}: "${value}" is not in the outreach channel list. Add it on the Cadence rules page first.`,
    );
  }

  return toEngineChannel(value) ?? value;
};

const toEngineStep = (
  step: CadenceRuleStep,
  index: number,
  errors: string[],
  touchChannels: readonly string[] | undefined,
): CadenceStepDefinition => {
  const subject = subjectOf(step, index);
  const definition: Record<string, unknown> = {
    key: step.key,
    label: step.label,
    channel:
      step.channel === null
        ? null
        : checkChannel(step.channel, subject, touchChannels, errors),
    repeat: step.repeat === null ? 'forever' : step.repeat,
    gapBefore: toDuration(
      step.gapBeforeAmount,
      step.gapBeforeUnit,
      `${subject}: the gap before it`,
      errors,
    ),
  };

  const assignOptional = (key: string, value: unknown) => {
    if (value !== undefined) {
      definition[key] = value;
    }
  };

  assignOptional('occurrenceNoun', step.occurrenceNoun ?? undefined);
  assignOptional(
    'requiredData',
    optionalLiteral(step.requiredData, requiredData, subject, 'required data', errors),
  );
  assignOptional(
    'whenDataMissing',
    optionalLiteral(
      step.whenDataMissing,
      whenDataMissing,
      subject,
      'missing-data rule',
      errors,
    ),
  );
  assignOptional(
    'gate',
    optionalLiteral(step.gate, stepGate, subject, 'gate', errors),
  );

  return definition as unknown as CadenceStepDefinition;
};

export type CadenceConfigResult =
  | { config: CadenceConfig; errors: [] }
  | { config: null; errors: string[] };

// Builds the engine's config and validates it with the engine's own rules. A
// config is returned only when there is nothing wrong with it. With
// Every referenced channel must exist in the managed list.
export const configFromRules = (
  rules: CadenceRules,
  cadenceId: string,
  extraErrors: readonly string[] = [],
  touchChannels?: readonly string[],
): CadenceConfigResult => {
  const errors = [...extraErrors, ...validateManagedChannels(rules.touchChannels)];
  const availableChannels = touchChannels ?? rules.touchChannels.map((option) => option.value);

  const candidate = {
    id: cadenceId,
    name: rules.name,
    timeZone: rules.timeZone,
    skipWeekends: rules.skipWeekends,
    steps: rules.steps.map((step, index) =>
      toEngineStep(step, index, errors, availableChannels),
    ),
    connectionRequest: {
      ...FIXED_RULES.connectionRequest,
      acceptanceTimeout: toDuration(
        rules.acceptanceTimeoutAmount,
        rules.acceptanceTimeoutUnit,
        'The wait for acceptance',
        errors,
      ),
      // Missing, the engine's validator names it.
      inMailChannel:
        rules.inMailChannel === null
          ? null
          : checkChannel(
              rules.inMailChannel,
              'The InMail channel',
              availableChannels,
              errors,
            ),
    },
    bounce: FIXED_RULES.bounce,
    strikeSilenceGap: toDuration(
      rules.strikeSilenceGapAmount,
      rules.strikeSilenceGapUnit,
      'The silence before a strike',
      errors,
    ),
    strikeLimit: rules.strikeLimit,
    nonAdvancingChannels: (rules.nonAdvancingChannels ?? []).map((channel) =>
      checkChannel(channel, 'Non-advancing channels', availableChannels, errors),
    ),
    conversationalChannels: FIXED_RULES.conversationalChannels,
  };

  errors.push(...validateCadenceConfig(candidate));

  return errors.length === 0
    ? { config: candidate as unknown as CadenceConfig, errors: [] }
    : { config: null, errors };
};

const toRuleUnit = (duration: CadenceDuration): string =>
  gapUnit.fromEngine(duration.unit) ?? camelToUpperSnake(duration.unit);

// The reverse, for seeding and "Reset to defaults".
export const rulesFromConfig = (config: CadenceConfig): CadenceRules => ({
  touchChannels: [...BUILT_IN_TOUCH_CHANNEL_OPTIONS],
  name: config.name,
  timeZone: config.timeZone,
  skipWeekends: config.skipWeekends,
  strikeSilenceGapAmount: config.strikeSilenceGap.amount,
  strikeSilenceGapUnit: toRuleUnit(config.strikeSilenceGap),
  strikeLimit: config.strikeLimit,
  acceptanceTimeoutAmount: config.connectionRequest.acceptanceTimeout.amount,
  acceptanceTimeoutUnit: toRuleUnit(config.connectionRequest.acceptanceTimeout),
  nonAdvancingChannels: config.nonAdvancingChannels.map(
    (channel) => fromEngineChannel(channel) ?? channel,
  ),
  inMailChannel: fromEngineChannel(config.connectionRequest.inMailChannel),
  steps: config.steps.map((step) => ({
    key: step.key,
    label: step.label,
    channel: fromEngineChannel(step.channel),
    repeat: step.repeat === 'forever' ? null : step.repeat,
    gapBeforeAmount: step.gapBefore.amount,
    gapBeforeUnit: toRuleUnit(step.gapBefore),
    occurrenceNoun: step.occurrenceNoun ?? null,
    requiredData:
      step.requiredData === undefined
        ? null
        : requiredData.fromEngine(step.requiredData),
    whenDataMissing:
      step.whenDataMissing === undefined
        ? null
        : whenDataMissing.fromEngine(step.whenDataMissing),
    gate: step.gate === undefined ? null : stepGate.fromEngine(step.gate),
  })),
});

export const DEFAULT_CADENCE_RULES: CadenceRules = rulesFromConfig(
  DEFAULT_CADENCE_CONFIG,
);

export const parseRulesSnapshot = (
  value: unknown,
): CadenceRulesSnapshot | null => {
  if (
    !isRecord(value) ||
    value.version !== CADENCE_RULES_SNAPSHOT_VERSION ||
    typeof value.cadenceId !== 'string'
  ) {
    return null;
  }

  return {
    version: CADENCE_RULES_SNAPSHOT_VERSION,
    cadenceId: value.cadenceId,
    rules: normalizeCadenceRules(value.rules),
  };
};

export const buildRulesSnapshot = (
  cadenceId: string,
  rules: CadenceRules,
): CadenceRulesSnapshot => ({
  version: CADENCE_RULES_SNAPSHOT_VERSION,
  cadenceId,
  rules,
});

// Every channel the rules name, once each: the steps', the non-advancing
// ones and the InMail channel.
export const channelsOfRules = (rules: CadenceRules): string[] => [
  ...new Set(
    [
      ...rules.steps.map((step) => step.channel),
      ...(rules.nonAdvancingChannels ?? []),
      rules.inMailChannel,
    ].filter((channel): channel is string => channel !== null),
  ),
];
