import { type CoreApiClient } from 'twenty-client-sdk/core';
import { type RoutePayload } from 'twenty-sdk/define';
import {
  type LogicFunctionExecutionContext,
  Response,
} from 'twenty-sdk/logic-function';

import { errorMessage } from 'src/data/api';
import { loadPersonState } from 'src/data/store';

// A refusal the caller can act on, answered with its HTTP status.
export class ActionError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details: object = {},
  ) {
    super(message);
  }
}

export const json = (status: number, body: unknown) =>
  new Response(body, {
    status,
    headers: { 'content-type': 'application/json' },
  });

const readBody = (payload: RoutePayload<unknown>): Record<string, unknown> => {
  const { body } = payload;

  if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }

  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body) as unknown;

      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  return {};
};

export const requireString = (
  body: Record<string, unknown>,
  key: string,
): string => {
  const value = body[key];

  if (typeof value !== 'string' || value.length === 0) {
    throw new ActionError(400, `"${key}" is required.`);
  }

  return value;
};

export const optionalString = (
  body: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = body[key];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new ActionError(400, `"${key}" must be a string.`);
  }

  return value;
};

export type RouteInput = {
  body: Record<string, unknown>;
  context: LogicFunctionExecutionContext;
};

// Every route answers JSON: { ok: true, ... } or { ok: false, error }, with
// the HTTP status of a refusal. Nothing is swallowed.
export const routeHandler =
  (name: string, run: (input: RouteInput) => Promise<object>) =>
  async (
    payload: RoutePayload<unknown>,
    context: LogicFunctionExecutionContext,
  ) => {
    try {
      const result = await run({ body: readBody(payload), context });

      return json(200, { ok: true, ...result });
    } catch (error) {
      if (error instanceof ActionError) {
        console.warn(
          JSON.stringify({ route: name, status: error.status, error: error.message }),
        );

        return json(error.status, {
          ok: false,
          error: error.message,
          ...error.details,
        });
      }

      console.error(JSON.stringify({ route: name, error: errorMessage(error) }));

      return json(500, { ok: false, error: errorMessage(error) });
    }
  };

// The person's cadence fields as a route returns them after an action.
export const personCadenceView = async (
  client: CoreApiClient,
  personId: string,
) => {
  const state = await loadPersonState(client, personId);

  if (state === null) {
    return null;
  }

  const { person } = state;

  return {
    personId: person.id,
    cadenceOwnerId: person.cadenceOwnerId ?? null,
    cadenceOwnerSince: person.cadenceOwnerSince ?? null,
    cadenceStage: person.cadenceStage ?? null,
    cadenceHealth: person.cadenceHealth ?? null,
    nextActionDate: person.nextActionDate ?? null,
    nextActionDateOverride: person.nextActionDateOverride ?? null,
    snoozeUntil: person.snoozeUntil ?? null,
    revisitDate: person.revisitDate ?? null,
    optedOut: person.optedOut ?? null,
    optOutReason: person.optOutReason ?? null,
    cadenceResumedAt: person.cadenceResumedAt ?? null,
    cadenceStep: person.cadenceStep ?? null,
    cadencePosition: person.cadencePosition ?? null,
    cadenceState: person.cadenceState ?? null,
    cadenceStrikes: person.cadenceStrikes ?? null,
    cadenceDue: person.cadenceDue ?? null,
    cadenceActions: person.cadenceActions ?? null,
    cadenceComputedOn: person.cadenceComputedOn ?? null,
    lastTouchOn: person.lastTouchOn ?? null,
  };
};
