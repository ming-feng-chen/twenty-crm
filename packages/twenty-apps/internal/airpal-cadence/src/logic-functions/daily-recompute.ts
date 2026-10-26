import { defineLogicFunction } from 'twenty-sdk/define';

import { DAILY_RECOMPUTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { withErrorLogging } from 'src/data/log-errors';
import { runDailyRecompute } from 'src/data/daily-recompute';
import { seedDefaultTags } from 'src/data/tags';

const handler = async (payload: { force?: unknown } | null | undefined) => {
  // Updating an installed app does not run post-install, so the starting tags
  // arrive with the first hourly run after the deploy that adds them.
  const tags = await seedDefaultTags();
  const result = await runDailyRecompute({ force: payload?.force === true });

  console.log(JSON.stringify({ trigger: 'cron', tags, ...result }));

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
