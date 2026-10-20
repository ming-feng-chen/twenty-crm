import { defineLogicFunction, HTTPMethod } from 'twenty-sdk/define';

import { UNDO_TOUCH_ROUTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { undoTouch } from 'src/data/actions';
import { createActorClient, createAppClient } from 'src/data/api';
import { personCadenceView, requireString, routeHandler } from 'src/data/http';

// POST /s/cadence/undo-touch — see README "Contracts for the UI".
const handler = routeHandler('undo-touch', async ({ body }) => {
  const appClient = createAppClient();
  const { personId, outcome } = await undoTouch({
    appClient,
    actorClient: createActorClient(),
    touchId: requireString(body, 'touchId'),
  });

  return {
    personId,
    recompute: outcome,
    person:
      personId === null ? null : await personCadenceView(appClient, personId),
  };
});

export default defineLogicFunction({
  universalIdentifier: UNDO_TOUCH_ROUTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'route-undo-touch',
  description:
    'Undo: deletes a touch as the caller and returns the person recomputed as if it never happened.',
  timeoutSeconds: 60,
  httpRouteTriggerSettings: {
    path: '/cadence/undo-touch',
    httpMethod: HTTPMethod.POST,
    isAuthRequired: true,
  },
  handler,
});
