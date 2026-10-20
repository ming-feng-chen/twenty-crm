import { defineLogicFunction, HTTPMethod } from 'twenty-sdk/define';

import { LOG_TOUCH_ROUTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { logTouch } from 'src/data/actions';
import { createActorClient, createAppClient } from 'src/data/api';
import {
  ActionError,
  optionalString,
  personCadenceView,
  requireString,
  routeHandler,
} from 'src/data/http';
import { type CadenceAction } from 'src/engine';
import { type TwentyTouchTemplate } from 'src/utils/person-cadence';

const parseTouch = (value: unknown): TwentyTouchTemplate | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'object') {
    throw new ActionError(400, '"touch" must be an object.');
  }

  const touch = value as Record<string, unknown>;
  const text = (key: string) =>
    typeof touch[key] === 'string' ? (touch[key] as string) : null;

  return {
    channel: text('channel'),
    direction: text('direction'),
    outcome: text('outcome'),
  };
};

// POST /s/cadence/log-touch — see README "Contracts for the UI".
const handler = routeHandler('log-touch', async ({ body, context }) => {
  const appClient = createAppClient();
  const personId = requireString(body, 'personId');
  const { touchId, outcome } = await logTouch({
    appClient,
    actorClient: createActorClient(),
    input: {
      personId,
      action: optionalString(body, 'action') as CadenceAction | undefined,
      touch: parseTouch(body.touch),
      occurredOn: optionalString(body, 'occurredOn'),
      note: optionalString(body, 'note'),
      name: optionalString(body, 'name'),
    },
    loggedByWorkspaceMemberId: context.workspaceMemberId,
  });

  return {
    touchId,
    recompute: outcome,
    person: await personCadenceView(appClient, personId),
  };
});

export default defineLogicFunction({
  universalIdentifier: LOG_TOUCH_ROUTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'route-log-touch',
  description:
    'Logs the touch a My Day button prescribes (or an explicit one) as the caller, refusing future dates, and returns the recomputed person.',
  timeoutSeconds: 60,
  httpRouteTriggerSettings: {
    path: '/cadence/log-touch',
    httpMethod: HTTPMethod.POST,
    isAuthRequired: true,
  },
  handler,
});
