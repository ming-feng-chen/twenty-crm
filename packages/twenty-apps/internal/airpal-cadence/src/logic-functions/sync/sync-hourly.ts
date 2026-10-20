import { defineLogicFunction } from 'twenty-sdk/define';

import { createAppClient } from 'src/data/api';
import { withErrorLogging } from 'src/data/log-errors';
import { runHourlySync } from 'src/sync/data/scheduled-sync';
import { retryWhenRateLimited } from 'src/sync/data/sync-api';
import { SYNC_HOURLY_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/sync/sync-identifiers';

const handler = async () => {
  const result = await runHourlySync(createAppClient());

  console.log(JSON.stringify({ trigger: 'cron', sync: 'hourly', ...result }));

  if (result.failures.length > 0) {
    throw new Error(
      `Hourly sync could not apply ${result.failures.length} change(s): ${JSON.stringify(result.failures)}`,
    );
  }

  return result;
};

// At :25 past every hour (UTC), apart from the daily recompute at :10.
export default defineLogicFunction({
  universalIdentifier: SYNC_HOURLY_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'sync-hourly',
  description:
    'Calendar sync: turns meetings that began in the last hour into meeting touches, and merges same-day manual and synced copies of a touch.',
  timeoutSeconds: 600,
  cronTriggerSettings: {
    pattern: '25 * * * *',
  },
  handler: withErrorLogging('sync-hourly', retryWhenRateLimited(handler)),
});
