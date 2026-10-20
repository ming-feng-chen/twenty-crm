import {
  isOptionValue,
  TOUCH_CHANNEL_OPTIONS,
} from 'src/constants/cadence-values';
export type TouchChannelOption = { value: string; label: string };

// The options the app ships, for when the live list cannot be read.
export const BUILT_IN_TOUCH_CHANNEL_OPTIONS: readonly TouchChannelOption[] =
  TOUCH_CHANNEL_OPTIONS.map(({ value, label }) => ({ value, label }));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// The field's options in their order, each value once. An option whose value
// Twenty could not hold is left out rather than guessed at.
export const parseTouchChannelOptions = (
  options: unknown,
): TouchChannelOption[] => {
  if (!Array.isArray(options)) {
    return [];
  }

  const seen = new Set<string>();

  return options
    .map((option, index) => ({ option, index }))
    .filter(
      (entry): entry is { option: Record<string, unknown>; index: number } =>
        isRecord(entry.option) && isOptionValue(entry.option.value),
    )
    .sort(
      (first, second) =>
        (typeof first.option.position === 'number'
          ? first.option.position
          : first.index) -
          (typeof second.option.position === 'number'
            ? second.option.position
            : second.index) || first.index - second.index,
    )
    .map(({ option }) => {
      const value = option.value as string;
      const label =
        typeof option.label === 'string' && option.label.trim().length > 0
          ? option.label
          : value;

      return { value, label };
    })
    .filter(({ value }) => {
      if (seen.has(value)) {
        return false;
      }

      seen.add(value);

      return true;
    });
};

export const touchChannelLabel = (
  options: readonly TouchChannelOption[],
  value: string | null | undefined,
): string | null =>
  value === null || value === undefined
    ? null
    : (options.find((option) => option.value === value)?.label ?? null);
