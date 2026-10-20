import type {
  CadenceRules,
  CadenceRuleStep,
} from 'src/utils/cadence-rules';

import { channelLabel, plural } from 'src/ui/labels';
import type { TouchChannelOption } from 'src/utils/touch-channels';

// The Cadence rules editor's form and its conversion to and from the rules
// routes' shape (README "Rules page"). Numbers are kept as the text the admin
// typed so a half-typed value is never silently turned into something else;
// a value that is not a whole number goes to the server as null and comes
// back as the engine validator's own error, next to the field.

export type StepDraft = {
  // Only for React keys; never sent.
  clientId: string;
  key: string;
  label: string;
  channel: string;
  isForever: boolean;
  repeat: string;
  gapBeforeAmount: string;
  gapBeforeUnit: string;
  occurrenceNoun: string;
  requiredData: string;
  whenDataMissing: string;
  waitsForAcceptance: boolean;
};

export type RulesDraft = {
  touchChannels: TouchChannelOption[];
  name: string;
  timeZone: string;
  skipWeekends: boolean;
  strikeSilenceGapAmount: string;
  strikeSilenceGapUnit: string;
  strikeLimit: string;
  acceptanceTimeoutAmount: string;
  acceptanceTimeoutUnit: string;
  nonAdvancingChannels: string[];
  // Shown, not edited here: carried through unchanged so a save keeps it.
  inMailChannel: string | null;
  steps: StepDraft[];
};

export const ACCEPTANCE_GATE = 'LINKEDIN_ACCEPTED';
export const LINKEDIN_URL = 'LINKEDIN_URL';
export const EMAIL_ADDRESS = 'EMAIL';
export const DEFAULT_GAP_UNIT = 'BUSINESS_DAYS';

let clientIdCounter = 0;

const nextClientId = () => {
  clientIdCounter += 1;

  return `step-${clientIdCounter}`;
};

const numberText = (value: number | null): string =>
  value === null ? '' : String(value);

export const stepToDraft = (step: CadenceRuleStep): StepDraft => ({
  clientId: nextClientId(),
  key: step.key ?? '',
  label: step.label ?? '',
  channel: step.channel ?? '',
  isForever: step.repeat === null,
  repeat: step.repeat === null ? '1' : numberText(step.repeat),
  gapBeforeAmount: numberText(step.gapBeforeAmount),
  gapBeforeUnit: step.gapBeforeUnit ?? DEFAULT_GAP_UNIT,
  occurrenceNoun: step.occurrenceNoun ?? '',
  requiredData: step.requiredData ?? '',
  whenDataMissing: step.whenDataMissing ?? '',
  waitsForAcceptance: step.gate === ACCEPTANCE_GATE,
});

export const rulesToDraft = (rules: CadenceRules): RulesDraft => ({
  touchChannels: rules.touchChannels.map((option) => ({ ...option })),
  name: rules.name ?? '',
  timeZone: rules.timeZone ?? '',
  skipWeekends: rules.skipWeekends === true,
  strikeSilenceGapAmount: numberText(rules.strikeSilenceGapAmount),
  strikeSilenceGapUnit: rules.strikeSilenceGapUnit ?? DEFAULT_GAP_UNIT,
  strikeLimit: numberText(rules.strikeLimit),
  acceptanceTimeoutAmount: numberText(rules.acceptanceTimeoutAmount),
  acceptanceTimeoutUnit: rules.acceptanceTimeoutUnit ?? 'CALENDAR_DAYS',
  nonAdvancingChannels: [...(rules.nonAdvancingChannels ?? [])],
  inMailChannel: rules.inMailChannel,
  steps: rules.steps.map(stepToDraft),
});

// "3" → 3; "", "2.5", "three" → null (the server then names the problem).
export const parseWholeNumber = (value: string): number | null => {
  const trimmed = value.trim();

  if (!/^-?\d+$/.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);

  return Number.isSafeInteger(parsed) ? parsed : null;
};

const textOrNull = (value: string): string | null =>
  value.trim().length === 0 ? null : value.trim();

export const draftToStep = (step: StepDraft): CadenceRuleStep => {
  const requiredData = textOrNull(step.requiredData);

  return {
    key: textOrNull(step.key),
    label: textOrNull(step.label),
    channel: textOrNull(step.channel),
    repeat: step.isForever ? null : parseWholeNumber(step.repeat),
    gapBeforeAmount: parseWholeNumber(step.gapBeforeAmount),
    gapBeforeUnit: textOrNull(step.gapBeforeUnit),
    // Only a for-ever step has an occurrence noun; only a step that needs
    // data says what happens without it.
    occurrenceNoun: step.isForever ? textOrNull(step.occurrenceNoun) : null,
    requiredData,
    whenDataMissing:
      requiredData === null ? null : textOrNull(step.whenDataMissing),
    gate: step.waitsForAcceptance ? ACCEPTANCE_GATE : null,
  };
};

export const draftToRules = (draft: RulesDraft): CadenceRules => ({
  touchChannels: draft.touchChannels.map((option) => ({ ...option })),
  name: textOrNull(draft.name),
  timeZone: textOrNull(draft.timeZone),
  skipWeekends: draft.skipWeekends,
  strikeSilenceGapAmount: parseWholeNumber(draft.strikeSilenceGapAmount),
  strikeSilenceGapUnit: textOrNull(draft.strikeSilenceGapUnit),
  strikeLimit: parseWholeNumber(draft.strikeLimit),
  acceptanceTimeoutAmount: parseWholeNumber(draft.acceptanceTimeoutAmount),
  acceptanceTimeoutUnit: textOrNull(draft.acceptanceTimeoutUnit),
  nonAdvancingChannels: [...draft.nonAdvancingChannels],
  inMailChannel: draft.inMailChannel,
  steps: draft.steps.map(draftToStep),
});

// A stable fingerprint: a preview is valid only for the exact rules it ran on.
export const rulesFingerprint = (rules: CadenceRules): string =>
  JSON.stringify(rules, (_key, value: unknown) =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
            a.localeCompare(b),
          ),
        )
      : value,
  );

export const isSameRules = (first: CadenceRules, second: CadenceRules) =>
  rulesFingerprint(first) === rulesFingerprint(second);

// Input problems the server would also report, shown while typing.
export const fieldInputProblem = (
  value: string,
  { minimum = 0, allowEmpty = false }: { minimum?: number; allowEmpty?: boolean } = {},
): string | null => {
  if (value.trim().length === 0) {
    return allowEmpty ? null : 'Required.';
  }

  const parsed = parseWholeNumber(value);

  if (parsed === null) {
    return 'Enter a whole number.';
  }

  return parsed < minimum ? `At least ${minimum}.` : null;
};

export type DraftInputProblems = {
  settings: Partial<Record<SettingsField, string>>;
  steps: Record<number, Partial<Record<'repeat' | 'gapBeforeAmount' | 'label', string>>>;
  count: number;
};

// Problems the form must stop before anything is sent. A repeat count that is
// not a whole number matters most: the rules routes read a non-number as
// null, and null repeat means "for ever".
export const draftInputProblems = (draft: RulesDraft): DraftInputProblems => {
  const problems: DraftInputProblems = { settings: {}, steps: {}, count: 0 };
  const setSetting = (field: SettingsField, problem: string | null) => {
    if (problem !== null) {
      problems.settings[field] = problem;
      problems.count += 1;
    }
  };

  setSetting('strikeSilenceGap', fieldInputProblem(draft.strikeSilenceGapAmount, { minimum: 1 }));
  setSetting('strikeLimit', fieldInputProblem(draft.strikeLimit, { minimum: 1 }));
  setSetting('acceptanceTimeout', fieldInputProblem(draft.acceptanceTimeoutAmount));

  draft.steps.forEach((step, index) => {
    const stepProblems: DraftInputProblems['steps'][number] = {};
    const repeat = step.isForever ? null : fieldInputProblem(step.repeat, { minimum: 1 });
    const gap = fieldInputProblem(step.gapBeforeAmount, {
      minimum: step.isForever ? 1 : 0,
    });
    const label = step.label.trim().length === 0 ? 'Give the step a name.' : null;

    if (repeat !== null) {
      stepProblems.repeat = repeat;
    }

    if (gap !== null) {
      stepProblems.gapBeforeAmount = gap;
    }

    if (label !== null) {
      stepProblems.label = label;
    }

    const count = Object.keys(stepProblems).length;

    if (count > 0) {
      problems.steps[index] = stepProblems;
      problems.count += count;
    }
  });

  return problems;
};

const toCamelKey = (label: string): string => {
  const words = label
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (words.length === 0) {
    return 'step';
  }

  const key = words
    .map((word, index) =>
      index === 0
        ? word.toLowerCase()
        : `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}`,
    )
    .join('');

  return /^[0-9]/.test(key) ? `step${key}` : key;
};

// A key no other step uses. Keys are internal and never change once saved.
export const uniqueStepKey = (
  label: string,
  existingKeys: readonly string[],
): string => {
  const base = toCamelKey(label);
  let candidate = base;
  let suffix = 2;

  while (existingKeys.includes(candidate)) {
    candidate = `${base}${suffix}`;
    suffix += 1;
  }

  return candidate;
};

export const newStepDraft = (existingKeys: readonly string[]): StepDraft => ({
  clientId: nextClientId(),
  key: uniqueStepKey('New step', existingKeys),
  label: 'New step',
  channel: 'EMAIL',
  isForever: false,
  repeat: '1',
  gapBeforeAmount: '3',
  gapBeforeUnit: DEFAULT_GAP_UNIT,
  occurrenceNoun: '',
  requiredData: EMAIL_ADDRESS,
  whenDataMissing: 'BLOCK',
  waitsForAcceptance: false,
});

// New steps go before a for-ever step, which must stay last.
export const addStep = (steps: readonly StepDraft[]): StepDraft[] => {
  const step = newStepDraft(steps.map((existing) => existing.key));
  const last = steps[steps.length - 1];

  return last !== undefined && last.isForever
    ? [...steps.slice(0, -1), step, last]
    : [...steps, step];
};

export const moveStep = (
  steps: readonly StepDraft[],
  index: number,
  offset: -1 | 1,
): StepDraft[] => {
  const target = index + offset;

  if (index < 0 || index >= steps.length || target < 0 || target >= steps.length) {
    return [...steps];
  }

  const next = [...steps];

  [next[index], next[target]] = [next[target], next[index]];

  return next;
};

export const removeStep = (
  steps: readonly StepDraft[],
  index: number,
): StepDraft[] => steps.filter((_step, position) => position !== index);

export const updateStep = (
  steps: readonly StepDraft[],
  index: number,
  patch: Partial<StepDraft>,
): StepDraft[] =>
  steps.map((step, position) => {
    if (position !== index) {
      return step;
    }

    const next = { ...step, ...patch };

    // Sensible defaults when what a step needs changes; the admin can still
    // change them, and the server validator has the last word.
    if (patch.requiredData !== undefined && patch.requiredData !== step.requiredData) {
      next.whenDataMissing =
        patch.requiredData === ''
          ? ''
          : patch.requiredData === LINKEDIN_URL
            ? 'SKIP'
            : next.whenDataMissing === ''
              ? 'BLOCK'
              : next.whenDataMissing;
    }

    return next;
  });

// --- Plain English ---------------------------------------------------------

export const describeGap = (
  amount: number | null,
  unit: string | null,
): string => {
  if (amount === null) {
    return 'an unset gap';
  }

  if (amount === 0) {
    return 'no wait';
  }

  return unit === 'CALENDAR_DAYS'
    ? plural(amount, 'calendar day')
    : unit === 'BUSINESS_DAYS'
      ? plural(amount, 'business day')
      : `${amount} ${String(unit).toLowerCase()}`;
};

const describeNeeds = (step: CadenceRuleStep): string | null => {
  if (step.requiredData === null) {
    return null;
  }

  const data =
    step.requiredData === LINKEDIN_URL ? 'a LinkedIn URL' : 'an email address';
  const otherwise =
    step.whenDataMissing === 'SKIP'
      ? 'skipped when missing'
      : step.whenDataMissing === 'BLOCK'
        ? 'waits until one is added'
        : 'no rule for when it is missing';

  return `Needs ${data}; ${otherwise}.`;
};

// "Email ×7, 3 business days apart." and friends.
export const describeStep = (step: CadenceRuleStep): string => {
  const label = step.label ?? 'Unnamed step';
  const channel = channelLabel(step.channel);
  const named =
    channel.toLowerCase() === label.toLowerCase() ? label : `${label} (${channel})`;
  const gap = describeGap(step.gapBeforeAmount, step.gapBeforeUnit);
  let sentence: string;

  if (step.repeat === null) {
    const noun = step.occurrenceNoun ?? null;

    sentence = `${named}, for ever: one every ${gap}${
      noun === null ? '' : `, shown as "${label}, ${noun} 1", "${label}, ${noun} 2" and so on`
    }.`;
  } else if (step.repeat === 1) {
    sentence =
      step.gapBeforeAmount === 0
        ? `${named}, once, straight away.`
        : `${named}, once, ${gap} after the previous touch.`;
  } else {
    sentence = `${named} ×${step.repeat}, ${gap} apart.`;
  }

  const notes = [
    sentence,
    step.gate === ACCEPTANCE_GATE
      ? 'Only once they accept the connection request.'
      : null,
    describeNeeds(step),
  ].filter((note): note is string => note !== null);

  return notes.join(' ');
};

export const describeSettings = (rules: CadenceRules): string[] => {
  const silence = describeGap(rules.strikeSilenceGapAmount, rules.strikeSilenceGapUnit);
  const acceptance = describeGap(
    rules.acceptanceTimeoutAmount,
    rules.acceptanceTimeoutUnit,
  );
  const nonAdvancing = (rules.nonAdvancingChannels ?? []).map((channel) =>
    channelLabel(channel).toLowerCase(),
  );

  return [
    `Dates are worked out in the ${rules.timeZone ?? '(unset)'} time zone${
      rules.skipWeekends === true ? ', and weekends are skipped' : ', weekends included'
    }.`,
    `After we reply, ${silence} of silence counts as a strike; after ${
      rules.strikeLimit === null ? '(unset)' : plural(rules.strikeLimit, 'strike')
    } the cadence stops until someone presses "Resume cadence".`,
    `If a connection request is not accepted within ${acceptance}, the row offers "Sent InMail" and "Skip to email". "Sent InMail" logs ${
      rules.inMailChannel === null
        ? 'a touch on an unset channel'
        : `a touch on the ${channelLabel(rules.inMailChannel)} channel`
    }, and the sequence moves on.`,
    nonAdvancing.length === 0
      ? 'Every inbound touch counts as a reply.'
      : `Inbound ${nonAdvancing.join(', ')} are logged but do not count as replies.`,
  ];
};

// --- Server validation errors next to the fields ---------------------------

export type SettingsField =
  | 'name'
  | 'timeZone'
  | 'skipWeekends'
  | 'strikeSilenceGap'
  | 'strikeLimit'
  | 'acceptanceTimeout'
  | 'nonAdvancingChannels'
  | 'inMailChannel'
  | 'steps';

export type MappedErrors = {
  general: string[];
  settings: Partial<Record<SettingsField, string[]>>;
  steps: Record<number, string[]>;
};

const SETTINGS_PATTERNS: [RegExp, SettingsField][] = [
  [/^The silence before a strike/, 'strikeSilenceGap'],
  [/^The strike limit/, 'strikeLimit'],
  [/^The wait for acceptance/, 'acceptanceTimeout'],
  [/time zone/i, 'timeZone'],
  [/^The cadence needs a name/, 'name'],
  [/skipWeekends|weekends/i, 'skipWeekends'],
  [/InMail channel/, 'inMailChannel'],
  [/non-advancing/i, 'nonAdvancingChannels'],
  [
    /^(Two steps use the key|The cadence needs at least one step|Only one step can send)/,
    'steps',
  ],
];

// The engine validator names a step "Step 3" or 'Step 3 ("Email")', counted
// in the order the steps were sent, which is the form's order.
export const mapServerErrors = (errors: readonly string[]): MappedErrors => {
  const mapped: MappedErrors = { general: [], settings: {}, steps: {} };

  for (const error of errors) {
    const stepMatch = /^Step (\d+)\b/.exec(error);

    if (stepMatch !== null) {
      const index = Number(stepMatch[1]) - 1;

      mapped.steps[index] = [...(mapped.steps[index] ?? []), error];
      continue;
    }

    const setting = SETTINGS_PATTERNS.find(([pattern]) => pattern.test(error))?.[1];

    if (setting === undefined) {
      mapped.general.push(error);
    } else {
      mapped.settings[setting] = [...(mapped.settings[setting] ?? []), error];
    }
  }

  return mapped;
};

export const hasMappedErrors = (mapped: MappedErrors): boolean =>
  mapped.general.length > 0 ||
  Object.keys(mapped.settings).length > 0 ||
  Object.keys(mapped.steps).length > 0;
