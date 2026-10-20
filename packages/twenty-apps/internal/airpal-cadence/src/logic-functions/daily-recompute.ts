import { defineLogicFunction } from 'twenty-sdk/define';

import { DAILY_RECOMPUTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { withErrorLogging } from 'src/data/log-errors';
import { runDailyRecompute } from 'src/data/daily-recompute';

const handler = async (payload: { force?: unknown } | null | undefined) => {
  const result = await runDailyRecompute({ force: payload?.force === true });

  console.log(JSON.stringify({ trigger: 'cron', ...result }));

  return result;
};

// Hourly at :10 in UTC; acts once per civil day in the cadence time zone (see
// runDailyRecompute). Labels and due-ness depend on today: the 14-day
// acceptance timeout, strikes, drip periods.
export default defineLogicFunction({
  universalIdentifier: DAILY_RECOMPUTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'daily-recompute',
  description:
    'Recomputes every contact once per day just after midnight in the cadence time zone, and applies any rules not yet applied.',
  timeoutSeconds: 900,
  cronTriggerSettings: {
    pattern: '10 * * * *',
  },
  handler: withErrorLogging('daily-recompute', handler),
});
