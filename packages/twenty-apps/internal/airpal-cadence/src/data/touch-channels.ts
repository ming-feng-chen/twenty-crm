import { pickDefaultCadence } from 'src/data/store';
import { normalizeCadenceRules, parseRulesSnapshot } from 'src/utils/cadence-rules';
import { validateManagedChannels } from 'src/utils/validate-managed-channels.util';
import { createAppClient, errorMessage } from 'src/data/api';
import {
  TOUCH_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import {
  BUILT_IN_TOUCH_CHANNEL_OPTIONS,
  type TouchChannelOption,
} from 'src/utils/touch-channels';

// Read each time so saving a channel makes it available in every function process.
export const loadTouchChannelOptions = async ({
  client = createAppClient(),
}: { client?: Pick<ReturnType<typeof createAppClient>, 'query'> } = {}): Promise<
  TouchChannelOption[]
> => {
  const { cadences } = await client.query({
    cadences: {
      __args: { first: 50 },
      edges: {
        node: {
          id: true,
          isDefault: true,
          createdAt: true,
          touchChannels: true,
          lastValidRules: true,
        },
      },
    },
  });
  const cadence = pickDefaultCadence((cadences?.edges ?? []).map(({ node }) => node));
  if (cadence === null) {
    return [...BUILT_IN_TOUCH_CHANNEL_OPTIONS];
  }
  const snapshot = parseRulesSnapshot(cadence.lastValidRules);
  const options = snapshot?.rules.touchChannels ??
    normalizeCadenceRules({ touchChannels: cadence.touchChannels }).touchChannels;
  const errors = validateManagedChannels(options);
  if (errors.length > 0) {
    throw new Error(errors.join(' '));
  }

  return options;
};

export const loadTouchChannelValues = async (): Promise<string[]> =>
  (await loadTouchChannelOptions()).map((option) => option.value);

export type TouchChannelList = {
  options: TouchChannelOption[];
  source: 'live' | 'builtIn';
  // Why the live list is not used.
  error: string | null;
};

// Built-in channels remain available if the managed list cannot be read.
export const loadTouchChannelsOrBuiltIn = async (): Promise<TouchChannelList> => {
  try {
    return {
      options: await loadTouchChannelOptions(),
      source: 'live',
      error: null,
    };
  } catch (error) {
    const message = errorMessage(error);

    console.warn(
      JSON.stringify({
        touchChannelOptions: 'builtIn',
        field: TOUCH_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
        error: message,
      }),
    );

    return {
      options: [...BUILT_IN_TOUCH_CHANNEL_OPTIONS],
      source: 'builtIn',
      error: message,
    };
  }
};
