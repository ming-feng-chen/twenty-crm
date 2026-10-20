import { useEffect, useState } from 'react';

import {
  BUILT_IN_TOUCH_CHANNEL_OPTIONS,
  type TouchChannelOption,
} from 'src/utils/touch-channels';
import { errorText } from 'src/ui/api';
import { loadTouchChannelOptions } from 'src/ui/data';
import { rememberChannelLabels } from 'src/ui/labels';

// The channel pickers use the saved rules list, read
// once per page. Until it arrives, and if it cannot be read, the built-in
// channels stand in, and `error` says why so the page can show it.
export type TouchChannelsState = {
  options: readonly TouchChannelOption[];
  isLive: boolean;
  error: string | null;
};

let pending: Promise<TouchChannelOption[]> | null = null;
const listeners = new Set<(options: TouchChannelOption[]) => void>();

export const refreshTouchChannels = async (): Promise<void> => {
  pending = null;
  const options = await loadOnce();
  for (const listener of listeners) listener(options);
};

const loadOnce = (): Promise<TouchChannelOption[]> => {
  pending ??= loadTouchChannelOptions().then(
    (options) => {
      rememberChannelLabels(options);

      return options;
    },
    (error: unknown) => {
      // A later mount tries again.
      pending = null;
      throw error;
    },
  );

  return pending;
};

export const useTouchChannels = (): TouchChannelsState => {
  const [state, setState] = useState<TouchChannelsState>({
    options: BUILT_IN_TOUCH_CHANNEL_OPTIONS,
    isLive: false,
    error: null,
  });

  useEffect(() => {
    let isCurrent = true;
    const listener = (options: TouchChannelOption[]) => setState({ options, isLive: true, error: null });
    listeners.add(listener);
    pending = null;

    loadOnce().then(
      (options) => {
        if (isCurrent) {
          setState({ options, isLive: true, error: null });
        }
      },
      (error: unknown) => {
        if (isCurrent) {
          setState({
            options: BUILT_IN_TOUCH_CHANNEL_OPTIONS,
            isLive: false,
            error: `The channel list could not be loaded, so only the built-in channels are shown: ${errorText(error)}`,
          });
        }
      },
    );

    return () => {
      isCurrent = false;
      listeners.delete(listener);
    };
  }, []);

  return state;
};

// The options, plus the current value when the list lacks it (a channel
// since removed from the field), so a picker never shows a blank.
export const channelChoicesWith = (
  options: readonly TouchChannelOption[],
  current: string,
  labelFor: (value: string) => string,
): TouchChannelOption[] =>
  current === '' || options.some((option) => option.value === current)
    ? [...options]
    : [...options, { value: current, label: `${labelFor(current)} (not offered any more)` }];
