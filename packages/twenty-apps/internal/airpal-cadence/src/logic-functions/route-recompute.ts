import { defineLogicFunction, HTTPMethod } from 'twenty-sdk/define';

import { RECOMPUTE_ROUTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { createAppClient } from 'src/data/api';
import { personCadenceView, requireString, routeHandler } from 'src/data/http';
import { recomputePerson } from 'src/data/recompute';
import { loadSharedContext } from 'src/data/store';

// POST /s/cadence/recompute — see README "Contracts for the UI".
const handler = routeHandler('recompute', async ({ body }) => {
  const appClient = createAppClient();
  const personId = requireString(body, 'personId');
  const recompute = await recomputePerson(
    appClient,
    personId,
    await loadSharedContext(appClient),
  );

  return { recompute, person: await personCadenceView(appClient, personId) };
});

export default defineLogicFunction({
  universalIdentifier: RECOMPUTE_ROUTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'route-recompute',
  description:
    "Recomputes one person's cadence now and returns the result; writes only if something changed.",
  timeoutSeconds: 60,
  httpRouteTriggerSettings: {
    path: '/cadence/recompute',
    httpMethod: HTTPMethod.POST,
    isAuthRequired: true,
  },
  handler,
});
