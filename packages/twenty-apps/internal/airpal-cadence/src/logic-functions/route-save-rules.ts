import { defineLogicFunction, HTTPMethod } from 'twenty-sdk/define';

import { SAVE_RULES_ROUTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { createActorClient, createAppClient } from 'src/data/api';
import { ActionError, routeHandler } from 'src/data/http';
import { saveRules } from 'src/data/rules';
import { normalizeCadenceRules } from 'src/utils/cadence-rules';

const STATUS_BY_OUTCOME = {
  invalid: 422,
  noCadence: 404,
  locked: 423,
  forbidden: 403,
  conflict: 409,
} as const;

// POST /s/cadence/rules/save — see README "Contracts for the UI".
const handler = routeHandler('save-rules', async ({ body, context }) => {
  if (typeof body.rules !== 'object' || body.rules === null) {
    throw new ActionError(400, '"rules" is required.');
  }

  const outcome = await saveRules({
    actorClient: createActorClient(),
    appClient: createAppClient(),
    rules: normalizeCadenceRules(body.rules),
    baseRules:
      typeof body.baseRules === 'object' && body.baseRules !== null
        ? normalizeCadenceRules(body.baseRules)
        : null,
    changedByWorkspaceMemberId: context.workspaceMemberId,
  });

  if (outcome.status in STATUS_BY_OUTCOME) {
    throw new ActionError(
      STATUS_BY_OUTCOME[outcome.status as keyof typeof STATUS_BY_OUTCOME],
      `Rules not saved: ${outcome.status}`,
      outcome,
    );
  }

  return outcome.status === 'applied'
    ? {
        status: outcome.status,
        cadenceChangeId: outcome.cadenceChangeId,
        summary: outcome.summary,
        contactsRecomputed: outcome.stats.contactsRecomputed,
        contactsWhoseDateChanged: outcome.stats.contactsWhoseDateChanged,
        failures: outcome.stats.failures,
      }
    : outcome;
});

export default defineLogicFunction({
  universalIdentifier: SAVE_RULES_ROUTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'route-save-rules',
  description:
    'Validates and saves cadence rules with the caller’s permissions (Admins only), recomputes every contact and records one cadence change.',
  timeoutSeconds: 900,
  httpRouteTriggerSettings: {
    path: '/cadence/rules/save',
    httpMethod: HTTPMethod.POST,
    isAuthRequired: true,
  },
  handler,
});
