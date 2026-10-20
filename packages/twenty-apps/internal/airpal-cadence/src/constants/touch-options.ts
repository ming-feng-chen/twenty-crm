import {
  TOUCH_CHANNEL_OPTIONS,
  TOUCH_DIRECTION_OPTIONS,
  type TouchChannelValue,
  type TouchDirectionValue,
} from 'src/constants/cadence-values';

// Convenience lookups keyed by the engine literal, derived from
// cadence-values.ts so the mapping still lives in one place.
type EngineKeyed<
  TOptions extends readonly { value: string; engine: string }[],
> = {
  [TOption in TOptions[number] as TOption['engine']]: TOption['value'];
};

const keyByEngine = <
  TOptions extends readonly { value: string; engine: string }[],
>(
  options: TOptions,
) =>
  Object.fromEntries(
    options.map((option) => [option.engine, option.value]),
  ) as EngineKeyed<TOptions>;

export const TOUCH_CHANNEL_VALUES = keyByEngine(TOUCH_CHANNEL_OPTIONS);

export type TouchChannelKey = keyof typeof TOUCH_CHANNEL_VALUES;
export type { TouchChannelValue, TouchDirectionValue };

export const TOUCH_DIRECTION_VALUES = keyByEngine(TOUCH_DIRECTION_OPTIONS);
