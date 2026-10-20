import { defineLogicFunction } from 'twenty-sdk/define';

import { CADENCE_STEP_RULE_FIELDS } from 'src/constants/trigger-fields';
import { ON_CADENCE_STEP_CHANGED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { withErrorLogging } from 'src/data/log-errors';
import { handleRulesEvents } from 'src/data/rules-trigger';

// A step added, edited, removed or restored outside the rules page: validate,
// and if valid recompute everyone and audit (SPEC §3).
export default defineLogicFunction({
  universalIdentifier: ON_CADENCE_STEP_CHANGED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'on-cadence-step-changed',
  description:
    'Validates edited cadence steps; when valid, recomputes every contact and records a cadence change.',
  timeoutSeconds: 900,
  databaseEventTriggerSettings: {
    eventName: 'cadenceStep.*',
    updatedFields: CADENCE_STEP_RULE_FIELDS,
    batchMode: true,
  },
  handler: withErrorLogging('on-cadence-step-changed', handleRulesEvents),
});
