import { defineLogicFunction, HTTPMethod } from 'twenty-sdk/define';

import { GET_RULES_ROUTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { createAppClient, errorMessage } from 'src/data/api';
import { routeHandler } from 'src/data/http';
import { isRulesLockActive, readStoredRules } from 'src/data/rules';
import { activeConfigFor, loadDefaultCadence } from 'src/data/store';
import { loadTouchChannelOptions } from 'src/data/touch-channels';
import {
  channelsOfRules,
  DEFAULT_CADENCE_RULES,
  parseRulesSnapshot,
} from 'src/utils/cadence-rules';
import { type TouchChannelOption } from 'src/utils/touch-channels';

// GET /s/cadence/rules — see README "Contracts for the UI".
const handler = routeHandler('get-rules', async () => {
  const stored = await loadDefaultCadence(createAppClient());
  const active = activeConfigFor(stored);
  let touchChannels: TouchChannelOption[] | null = null;
  let touchChannelsError: string | null = null;

  // The page still shows the rules if the options cannot be read; it says so.
  try {
    touchChannels = await loadTouchChannelOptions();
  } catch (error) {
    touchChannelsError = errorMessage(error);
  }

  const liveValues = touchChannels?.map((option) => option.value);

  if (stored === null) {
    return {
      cadenceId: null,
      storedRules: null,
      storedRulesErrors: [],
      activeRules: null,
      activeSource: active.source,
      problems: active.problems,
      isSaveInProgress: false,
      defaults: DEFAULT_CADENCE_RULES,
      touchChannels,
      touchChannelsError,
    };
  }

  const current = readStoredRules(stored);
  const activeRules =
    parseRulesSnapshot(stored.cadence.lastValidRules)?.rules ?? null;
  const missing =
    activeRules === null || liveValues === undefined
      ? []
      : channelsOfRules(activeRules).filter(
          (channel) => !liveValues.includes(channel),
        );

  return {
    cadenceId: stored.cadence.id,
    // What the records hold now, in run order.
    storedRules: current.rules,
    // Why they are not in use; empty when they are valid.
    storedRulesErrors: current.errors,
    // What the engine runs on (the last valid rules).
    activeRules,
    activeSource: active.source,
    problems: [
      ...active.problems,
      ...missing.map(
        (channel) =>
          `The rules in use name the channel "${channel}", which is missing from the saved outreach channel list, so no touch on it can be logged.`,
      ),
    ],
    isSaveInProgress: isRulesLockActive(stored.cadence.rulesSaveLockedUntil),
    defaults: DEFAULT_CADENCE_RULES,
    // The live options of the touch's Channel field, in order; null with
    // touchChannelsError when they could not be read.
    touchChannels,
    touchChannelsError,
  };
});

export default defineLogicFunction({
  universalIdentifier: GET_RULES_ROUTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'route-get-rules',
  description:
    'Returns the stored cadence rules, their validation errors, the rules in use and the defaults.',
  timeoutSeconds: 30,
  httpRouteTriggerSettings: {
    path: '/cadence/rules',
    httpMethod: HTTPMethod.GET,
    isAuthRequired: true,
  },
  handler,
});
