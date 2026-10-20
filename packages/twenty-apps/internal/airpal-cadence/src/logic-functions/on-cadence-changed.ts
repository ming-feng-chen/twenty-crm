import { defineLogicFunction } from 'twenty-sdk/define';

import { CADENCE_RULE_FIELDS } from 'src/constants/trigger-fields';
import { ON_CADENCE_CHANGED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { withErrorLogging } from 'src/data/log-errors';
import { handleRulesEvents } from 'src/data/rules-trigger';

// A cadence's settings edited outside the rules page (Twenty's record view or
// the API): validate, and if valid recompute everyone and audit (SPEC §3).
export default defineLogicFunction({
  universalIdentifier: ON_CADENCE_CHANGED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'on-cadence-changed',
  description:
    'Validates edited cadence settings; when valid, recomputes every contact and records a cadence change.',
  timeoutSeconds: 900,
  databaseEventTriggerSettings: {
    eventName: 'cadence.*',
    updatedFields: CADENCE_RULE_FIELDS,
    batchMode: true,
  },
  handler: withErrorLogging('on-cadence-changed', handleRulesEvents),
});
