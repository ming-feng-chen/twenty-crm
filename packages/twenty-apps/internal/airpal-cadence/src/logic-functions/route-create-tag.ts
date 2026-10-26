import { defineLogicFunction, HTTPMethod } from 'twenty-sdk/define';

import { CREATE_TAG_ROUTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/tags-identifiers';
import { requireString, routeHandler } from 'src/data/http';
import { createTag } from 'src/data/tags';

// POST /s/cadence/create-tag — see README "Contracts for the UI". Runs with
// the app's role, so members can add tags without being able to rename them.
const handler = routeHandler('create-tag', async ({ body }) =>
  createTag(requireString(body, 'name')),
);

export default defineLogicFunction({
  universalIdentifier: CREATE_TAG_ROUTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'route-create-tag',
  description:
    'Creates a contact tag, or returns the existing one with the same name, with an automatic colour.',
  timeoutSeconds: 30,
  httpRouteTriggerSettings: {
    path: '/cadence/create-tag',
    httpMethod: HTTPMethod.POST,
    isAuthRequired: true,
  },
  handler,
});
