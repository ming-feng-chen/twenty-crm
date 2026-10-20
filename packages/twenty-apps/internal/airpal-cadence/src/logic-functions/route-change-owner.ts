import { defineLogicFunction, HTTPMethod } from 'twenty-sdk/define';

import { CHANGE_OWNER_ROUTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { changeOwner } from 'src/data/actions';
import { createActorClient, createAppClient } from 'src/data/api';
import {
  ActionError,
  personCadenceView,
  requireString,
  routeHandler,
} from 'src/data/http';
import {
  OWNER_CHANGE_MODES,
  type OwnerChangeMode,
} from 'src/utils/edit-decisions';

// POST /s/cadence/change-owner — see README "Contracts for the UI".
const handler = routeHandler('change-owner', async ({ body, context }) => {
  const appClient = createAppClient();
  const personId = requireString(body, 'personId');
  const ownerId = body.ownerId;
  const mode = body.mode ?? 'START_FRESH';

  if (ownerId !== null && (typeof ownerId !== 'string' || ownerId.length === 0)) {
    throw new ActionError(
      400,
      '"ownerId" must be a workspace member id, or null to remove the owner.',
    );
  }

  if (!OWNER_CHANGE_MODES.includes(mode as OwnerChangeMode)) {
    throw new ActionError(
      400,
      `"mode" must be one of ${OWNER_CHANGE_MODES.join(', ')}.`,
    );
  }

  const result = await changeOwner({
    appClient,
    actorClient: createActorClient(),
    personId,
    ownerId,
    mode: mode as OwnerChangeMode,
    requestedByWorkspaceMemberId: context.workspaceMemberId,
  });

  return { ...result, person: await personCadenceView(appClient, personId) };
});

export default defineLogicFunction({
  universalIdentifier: CHANGE_OWNER_ROUTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'route-change-owner',
  description:
    'Change owner…: hands a person over with Start fresh (default) or Keep position, as the caller, and returns the recomputed person.',
  timeoutSeconds: 60,
  httpRouteTriggerSettings: {
    path: '/cadence/change-owner',
    httpMethod: HTTPMethod.POST,
    isAuthRequired: true,
  },
  handler,
});
