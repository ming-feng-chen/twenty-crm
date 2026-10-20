import { defineLogicFunction } from 'twenty-sdk/define';

import { createAppClient } from 'src/data/api';
import { withErrorLogging } from 'src/data/log-errors';
import { type BackfillPayload, runSyncBackfill } from 'src/sync/data/scheduled-sync';
import { retryWhenRateLimited } from 'src/sync/data/sync-api';
import { SYNC_BACKFILL_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/sync/sync-identifiers';

const text = (value: unknown) =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const phase = (value: unknown) =>
  value === 'gmail' || value === 'calendar' ? value : undefined;

const handler = async (payload: Record<string, unknown> | null | undefined) => {
  const input: BackfillPayload = {
    phase: phase(payload?.phase),
    only: phase(payload?.only),
    after: text(payload?.after),
    since: text(payload?.since),
  };
  const result = await runSyncBackfill(createAppClient(), input);

  console.log(JSON.stringify({ sync: 'backfill', input, ...result }));

  return result;
};

// Run by hand (see README). Payload: { only?: "gmail" | "calendar", since?:
// ISO date-time }. Continues itself until done.
export default defineLogicFunction({
  universalIdentifier: SYNC_BACKFILL_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'sync-backfill',
  description:
    'Gmail and Calendar sync backfill: logs touches for emails and past meetings Twenty already holds, page by page, resuming itself until done. Run by hand.',
  timeoutSeconds: 900,
  handler: withErrorLogging('sync-backfill', retryWhenRateLimited(handler)),
});
