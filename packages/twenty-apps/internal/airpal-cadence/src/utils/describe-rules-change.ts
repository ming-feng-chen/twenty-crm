import {
  type CadenceRules,
  type CadenceRuleStep,
} from 'src/utils/cadence-rules';
import { stableStringify } from 'src/utils/stable-json';

const SETTING_LABELS: Record<keyof Omit<CadenceRules, 'steps'>, string> = {
  touchChannels: 'outreach channels',
  name: 'name',
  timeZone: 'time zone',
  skipWeekends: 'skip weekends',
  strikeSilenceGapAmount: 'strike silence gap',
  strikeSilenceGapUnit: 'strike silence gap unit',
  strikeLimit: 'strike limit',
  acceptanceTimeoutAmount: 'acceptance timeout',
  acceptanceTimeoutUnit: 'acceptance timeout unit',
  nonAdvancingChannels: 'non-advancing channels',
  inMailChannel: 'InMail channel',
};

const STEP_FIELD_LABELS: Record<keyof CadenceRuleStep, string> = {
  key: 'key',
  label: 'label',
  channel: 'channel',
  repeat: 'repeat',
  gapBeforeAmount: 'gap',
  gapBeforeUnit: 'gap unit',
  occurrenceNoun: 'occurrence noun',
  requiredData: 'required data',
  whenDataMissing: 'when data is missing',
  gate: 'gate',
};

const show = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '(none)';
  }

  return Array.isArray(value)
    ? `[${value.map((entry: unknown) =>
        typeof entry === 'object' && entry !== null && 'label' in entry
          ? String(entry.label)
          : String(entry),
      ).join(', ')}]`
    : String(value);
};

const differs = (first: unknown, second: unknown) =>
  stableStringify(first ?? null) !== stableStringify(second ?? null);

const stepName = (step: CadenceRuleStep) =>
  `"${step.label ?? step.key ?? 'unnamed'}"`;

// Plain words for the audit record: what moved between two sets of rules.
export const describeRulesChange = (
  before: CadenceRules | null,
  after: CadenceRules,
): string[] => {
  if (before === null) {
    return [
      `Rules set: ${after.steps.map(stepName).join(', ') || 'no steps'}.`,
    ];
  }

  const lines: string[] = [];

  for (const [field, label] of Object.entries(SETTING_LABELS) as [
    keyof typeof SETTING_LABELS,
    string,
  ][]) {
    if (differs(before[field], after[field])) {
      lines.push(`${label}: ${show(before[field])} → ${show(after[field])}`);
    }
  }

  const beforeByKey = new Map(before.steps.map((step) => [step.key, step]));
  const afterKeys = new Set(after.steps.map((step) => step.key));

  for (const step of before.steps) {
    if (!afterKeys.has(step.key)) {
      lines.push(`step ${stepName(step)} removed`);
    }
  }

  after.steps.forEach((step, index) => {
    const previous = beforeByKey.get(step.key);

    if (previous === undefined) {
      lines.push(`step ${stepName(step)} added at position ${index + 1}`);

      return;
    }

    const previousIndex = before.steps.indexOf(previous);

    if (previousIndex !== index) {
      lines.push(
        `step ${stepName(step)} moved from position ${previousIndex + 1} to ${index + 1}`,
      );
    }

    for (const [field, label] of Object.entries(STEP_FIELD_LABELS) as [
      keyof CadenceRuleStep,
      string,
    ][]) {
      if (field !== 'key' && differs(previous[field], step[field])) {
        lines.push(
          `step ${stepName(step)} ${label}: ${show(previous[field])} → ${show(step[field])}`,
        );
      }
    }
  });

  return lines;
};
