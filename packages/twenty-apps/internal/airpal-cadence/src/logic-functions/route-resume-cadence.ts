import { defineLogicFunction, HTTPMethod } from 'twenty-sdk/define';

import { RESUME_CADENCE_ROUTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { resumeCadence } from 'src/data/actions';
import { createActorClient, createAppClient } from 'src/data/api';
import { personCadenceView, requireString, routeHandler } from 'src/data/http';

// POST /s/cadence/resume — see README "Contracts for the UI".
const handler = routeHandler('resume-cadence', async ({ body }) => {
  const appClient = createAppClient();
  const personId = requireString(body, 'personId');
  const { outcome } = await resumeCadence({
    appClient,
    actorClient: createActorClient(),
    personId,
  });

  return {
    recompute: outcome,
    person: await personCadenceView(appClient, personId),
  };
});

export default defineLogicFunction({
  universalIdentifier: RESUME_CADENCE_ROUTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'route-resume-cadence',
  description:
    'Resume cadence: sets cadenceResumedAt to today when the engine offers it, and returns the recomputed person.',
  timeoutSeconds: 60,
  httpRouteTriggerSettings: {
    path: '/cadence/resume',
    httpMethod: HTTPMethod.POST,
    isAuthRequired: true,
  },
  handler,
});
