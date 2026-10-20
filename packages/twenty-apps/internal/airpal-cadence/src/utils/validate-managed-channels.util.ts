import { isOptionValue } from 'src/constants/cadence-values';
import { BUILT_IN_TOUCH_CHANNEL_OPTIONS, type TouchChannelOption } from 'src/utils/touch-channels';

export const validateManagedChannels = (channels: readonly TouchChannelOption[]): string[] => {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const channel of channels) {
    if (!isOptionValue(channel.value)) {
      errors.push('Channel codes must use uppercase letters, numbers and underscores, starting with a letter.');
    }
    if (channel.label.trim().length === 0) {
      errors.push(`Channel "${channel.value}" needs a name.`);
    }
    if (seen.has(channel.value)) {
      errors.push(`Channel "${channel.value}" is listed more than once.`);
    }
    seen.add(channel.value);
  }

  for (const { value } of BUILT_IN_TOUCH_CHANNEL_OPTIONS) {
    if (!seen.has(value)) {
      errors.push(`Built-in channel "${value}" must be kept.`);
    }
  }

  return errors;
};
