import { type CoreApiClient } from 'twenty-client-sdk/core';
import { RetryableLogicFunctionError } from 'twenty-sdk/logic-function';

import { errorMessage } from 'src/data/api';
import { activeConfigFor, loadDefaultCadence } from 'src/data/store';
import {
  type AirPalIdentity,
  buildAirPalIdentity,
} from 'src/sync/airpal-identity';
import { todayIn } from 'src/utils/civil-date';

export const PAGE_SIZE = 200;
// Ids per `in` filter, so a filter stays well within request limits.
export const IDS_PER_FILTER = 50;

export const chunk = <TItem>(items: readonly TItem[], size: number): TItem[][] => {
  const chunks: TItem[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

type Connection<TNode> = {
  edges?: { node: TNode }[] | null;
  pageInfo?: { hasNextPage?: boolean | null; endCursor?: string | null } | null;
} | null | undefined;

// Every page of a connection query. `read` runs one page from a cursor.
export const readAllPages = async <TNode>(
  read: (after: string | undefined) => Promise<Connection<TNode>>,
): Promise<TNode[]> => {
  const nodes: TNode[] = [];
  let after: string | undefined;

  for (;;) {
    const connection = await read(after);

    nodes.push(...(connection?.edges ?? []).map(({ node }) => node));

    const next =
      connection?.pageInfo?.hasNextPage === true
        ? (connection.pageInfo.endCursor ?? undefined)
        : undefined;

    if (next === undefined || next === after) {
      return nodes;
    }

    after = next;
  }
};

export const pageArgs = (after: string | undefined) => ({
  first: PAGE_SIZE,
  ...(after === undefined ? {} : { after }),
});

export type SyncContext = {
  identity: AirPalIdentity;
  timeZone: string;
  today: string;
  now: Date;
};

// The members (who is AirPal) and the cadence's time zone and today.
export const loadSyncContext = async (
  client: CoreApiClient,
  now: Date = new Date(),
): Promise<SyncContext> => {
  const members = await readAllPages<{ id: string; userEmail?: string | null }>(
    async (after) =>
      (
        await client.query({
          workspaceMembers: {
            __args: pageArgs(after),
            pageInfo: { hasNextPage: true, endCursor: true },
            edges: { node: { id: true, userEmail: true } },
          },
        })
      ).workspaceMembers,
  );
  const { timeZone } = activeConfigFor(await loadDefaultCadence(client)).config;

  return {
    identity: buildAirPalIdentity(members),
    timeZone,
    today: todayIn(timeZone, now),
    now,
  };
};

const RATE_LIMITED =
  /\b(429|too many requests|rate[ -]?limit\w*|RATE_LIMITED|throttl\w*)\b/i;

export const isRateLimitError = (error: unknown): boolean => {
  const codes = (
    (error as { errors?: { extensions?: { code?: string } }[] } | null)?.errors ?? []
  ).map((entry) => entry?.extensions?.code);

  return codes.includes('RATE_LIMITED') || RATE_LIMITED.test(errorMessage(error));
};

export const isDuplicateEntryError = (error: unknown): boolean =>
  /duplicate entry|already exists|duplicate key/i.test(errorMessage(error));

// A run that is still rate limited after the client's own retries is handed
// back to Twenty as retryable, so the queue runs the whole batch again later
// (every step is idempotent) instead of dropping it.
export const retryWhenRateLimited =
  <TArgs extends unknown[], TResult>(handler: (...args: TArgs) => Promise<TResult>) =>
  async (...args: TArgs): Promise<TResult> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (isRateLimitError(error)) {
        throw new RetryableLogicFunctionError(
          `Rate limited; the batch will be retried: ${errorMessage(error)}`,
        );
      }

      throw error;
    }
  };
