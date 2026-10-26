import { CoreApiClient } from 'twenty-client-sdk/core';

// Application tokens share a request budget per minute, so calls are spaced
// and a 429 answer is retried after a growing wait.
const MIN_CALL_INTERVAL_MS = 130;
const RATE_LIMIT_RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 20_000];

let lastCallAt = 0;

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const pacedFetch: typeof globalThis.fetch = async (input, init) => {
  for (let attempt = 0; ; attempt += 1) {
    const wait = lastCallAt + MIN_CALL_INTERVAL_MS - Date.now();

    if (wait > 0) {
      await sleep(wait);
    }

    lastCallAt = Date.now();

    const response = await globalThis.fetch(input, init);
    const delay = RATE_LIMIT_RETRY_DELAYS_MS[attempt];

    if (response.status !== 429 || delay === undefined) {
      return response;
    }

    console.warn(`Rate limited (429); retrying in ${delay} ms`);
    await sleep(delay);
  }
};

// Two ways to call the API from a logic function:
// - the app's own role (runAs 'application'): every engine read and write, so
//   it never depends on what the acting member may edit;
// - the acting member's token (intersected with the app role): writes a
//   member asks for in a route, so their permissions still apply.
export const createAppClient = () =>
  new CoreApiClient({ runAs: 'application', fetch: pacedFetch });

export const createActorClient = () =>
  new CoreApiClient({ fetch: pacedFetch });

// For objects added in the same deploy as the code that uses them (tags): the
// typed client only learns them after that deploy, so this call is untyped.
export const appGraphql = async <TData>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<TData> => {
  const response = await pacedFetch(`${process.env.TWENTY_API_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.TWENTY_APP_APPLICATION_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await response.json()) as {
    data?: TData;
    errors?: { message: string }[];
  };

  if (body.errors !== undefined && body.errors.length > 0) {
    throw new Error(body.errors.map((error) => error.message).join('; '));
  }

  if (body.data === undefined) {
    throw new Error(`GraphQL request failed (${response.status})`);
  }

  return body.data;
};

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
