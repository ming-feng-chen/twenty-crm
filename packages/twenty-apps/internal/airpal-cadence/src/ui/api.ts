// HTTP access from a front component: the app's routes (/s/cadence/...) and
// the metadata API, with the token the host gives the component
// (process.env.TWENTY_APP_ACCESS_TOKEN, refreshed through the host on a 401).
// Every failure becomes a RequestError with a message fit to show a person;
// nothing here swallows an error.

type HostApi = {
  requestAccessTokenRefresh?: () => Promise<string>;
};

type ProcessLike = { env?: Record<string, string | undefined> };

const environment = (): Record<string, string | undefined> => {
  const processObject = (globalThis as { process?: ProcessLike }).process;

  return processObject?.env ?? {};
};

const setEnvironmentToken = (token: string) => {
  const globalObject = globalThis as { process?: ProcessLike };
  const processObject = globalObject.process ?? {};

  processObject.env = { ...(processObject.env ?? {}), TWENTY_APP_ACCESS_TOKEN: token };
  globalObject.process = processObject;
};

const trimSlash = (value: string) => value.replace(/\/+$/, '');

export const apiBaseUrl = (): string => {
  const url = environment().TWENTY_API_URL;

  if (url === undefined || url.length === 0) {
    throw new RequestError(0, 'This page does not know the server address (TWENTY_API_URL is missing). Reload the page.');
  }

  return trimSlash(url);
};

// Routes live at {functions base}/<path>; the base is {api}/s unless the
// workspace has a public function domain (what Twenty's own UI does).
export const routeUrl = (path: string): string => {
  const functionsUrl = environment().TWENTY_FUNCTIONS_URL;
  const base =
    functionsUrl !== undefined && functionsUrl.length > 0
      ? trimSlash(functionsUrl)
      : `${apiBaseUrl()}/s`;

  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
};

export class RequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.name = 'RequestError';
  }
}

export const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const currentToken = (): string | null => {
  const token = environment().TWENTY_APP_ACCESS_TOKEN;

  return token === undefined || token.length === 0 ? null : token;
};

const refreshToken = async (): Promise<string | null> => {
  const host = (globalThis as { frontComponentHostCommunicationApi?: HostApi })
    .frontComponentHostCommunicationApi;

  if (typeof host?.requestAccessTokenRefresh !== 'function') {
    return null;
  }

  try {
    const token = await host.requestAccessTokenRefresh();

    if (typeof token !== 'string' || token.length === 0) {
      return null;
    }

    setEnvironmentToken(token);

    return token;
  } catch {
    return null;
  }
};

const send = async (
  url: string,
  init: { method: string; body?: string },
  token: string | null,
): Promise<Response> => {
  try {
    return await fetch(url, {
      method: init.method,
      headers: {
        'Content-Type': 'application/json',
        ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
      },
      ...(init.body === undefined ? {} : { body: init.body }),
    });
  } catch (error) {
    throw new RequestError(
      0,
      `Could not reach the server, or its answer was lost (${errorText(error)}). Refresh to see whether it was saved before trying again.`,
    );
  }
};

// One retry after a token refresh, for a 401.
const sendWithAuth = async (
  url: string,
  init: { method: string; body?: string },
): Promise<Response> => {
  const response = await send(url, init, currentToken());

  if (response.status !== 401) {
    return response;
  }

  const refreshed = await refreshToken();

  return refreshed === null ? response : send(url, init, refreshed);
};

const readJson = async (
  response: Response,
): Promise<Record<string, unknown> | null> => {
  const text = await response.text();

  if (text.length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(text) as unknown;

    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const statusMessage = (
  status: number,
  body: Record<string, unknown> | null,
): string => {
  const serverMessage = typeof body?.error === 'string' ? body.error : null;

  switch (status) {
    case 401:
      return 'Your session has expired. Reload the page and try again.';
    case 403:
      return serverMessage ?? 'You are not allowed to do that.';
    case 404:
      return serverMessage ?? 'Not found. It may have been deleted; refresh the page.';
    default:
      if (status >= 500) {
        return `The server failed${serverMessage === null ? '' : `: ${serverMessage}`}. Refresh to see what was saved before trying again.`;
      }

      return serverMessage ?? `The server refused the request (HTTP ${status}).`;
  }
};

export type RouteMethod = 'GET' | 'POST';

// Calls an app route. Resolves with the JSON body when the route says
// { ok: true }; anything else rejects with the route's own error.
export const callRoute = async <TResult extends object>(
  method: RouteMethod,
  path: string,
  body?: object,
): Promise<TResult> => {
  const response = await sendWithAuth(routeUrl(path), {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = await readJson(response);

  if (!response.ok || json === null || json.ok !== true) {
    if (response.ok && json === null) {
      throw new RequestError(
        response.status,
        'The server sent an answer this page cannot read. Refresh to see what was saved.',
      );
    }

    throw new RequestError(
      response.ok ? 500 : response.status,
      statusMessage(response.ok ? 500 : response.status, json),
      json,
    );
  }

  return json as TResult;
};

// A query on the metadata API (who is viewing, what they may edit, the
// touch channel options).
export const metadataQuery = async <TData>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<TData> => {
  const response = await sendWithAuth(`${apiBaseUrl()}/metadata`, {
    method: 'POST',
    body: JSON.stringify(variables === undefined ? { query } : { query, variables }),
  });
  const json = await readJson(response);

  if (!response.ok || json === null) {
    throw new RequestError(response.status, statusMessage(response.status, json), json);
  }

  const errors = Array.isArray(json.errors) ? json.errors : [];

  if (errors.length > 0) {
    const messages = errors
      .map((error) =>
        typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : String(error),
      )
      .join('; ');

    throw new RequestError(response.status, messages, json);
  }

  return json.data as TData;
};
