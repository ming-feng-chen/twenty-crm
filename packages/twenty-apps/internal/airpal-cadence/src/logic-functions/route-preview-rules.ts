import { defineLogicFunction, HTTPMethod } from 'twenty-sdk/define';

import { PREVIEW_RULES_ROUTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { createAppClient } from 'src/data/api';
import { ActionError, routeHandler } from 'src/data/http';
import { previewRules } from 'src/data/rules';
import { normalizeCadenceRules } from 'src/utils/cadence-rules';

// POST /s/cadence/rules/preview — see README "Contracts for the UI".
const handler = routeHandler('preview-rules', async ({ body }) => {
  if (typeof body.rules !== 'object' || body.rules === null) {
    throw new ActionError(400, '"rules" is required.');
  }

  const preview = await previewRules(
    createAppClient(),
    normalizeCadenceRules(body.rules),
  );

  if (!preview.valid) {
    throw new ActionError(422, 'The rules are not valid.', {
      errors: preview.errors,
    });
  }

  return preview;
});

export default defineLogicFunction({
  universalIdentifier: PREVIEW_RULES_ROUTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'route-preview-rules',
  description:
    "Validates candidate cadence rules and counts the contacts whose next action date they would move, without saving.",
  timeoutSeconds: 300,
  httpRouteTriggerSettings: {
    path: '/cadence/rules/preview',
    httpMethod: HTTPMethod.POST,
    isAuthRequired: true,
  },
  handler,
});
