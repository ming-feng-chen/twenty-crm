import { kv } from 'twenty-sdk/logic-function';

import { createAppClient } from 'src/data/api';
import { recomputeEveryone } from 'src/data/recompute';
import { reconcileRules, seedDefaultCadence } from 'src/data/rules';
import { loadSharedContext } from 'src/data/store';
import { localHourIn } from 'src/utils/civil-date';

export const LAST_DAILY_RUN_KEY = 'dailyRecompute.lastRunOn';

// SPEC §3: everyone at 00:10 Europe/London. The server's cron runs in UTC, so
// the trigger fires at ten past every hour and this acts on the first firing
// of each civil day in the cadence's time zone — 00:10 local in both GMT and
// BST, because London's offset is a whole number of hours. A day whose run
// failed is retried on the next firing. `force` runs regardless, for a manual
// re-run; running twice changes nothing the second time.
export const runDailyRecompute = async ({
  force = false,
  now = new Date(),
}: {
  force?: boolean;
  now?: Date;
} = {}) => {
  const client = createAppClient();
  const seed = await seedDefaultCadence(client);
  const rules =
    seed.status === 'exists'
      ? await reconcileRules({
          client,
          changedByWorkspaceMemberId: null,
          reason: 'Daily check found rules not yet applied',
        })
      : seed.apply;
  const shared = await loadSharedContext(client, now);
  const lastRunOn = await kv.get<string>(LAST_DAILY_RUN_KEY);
  const localHour = localHourIn(shared.active.config.timeZone, now);

  if (!force && lastRunOn === shared.today) {
    return {
      status: 'alreadyRanToday' as const,
      today: shared.today,
      localHour,
      rules: rules.status,
    };
  }

  const stats = await recomputeEveryone(client, shared);

  if (stats.failures.length === 0) {
    await kv.set(LAST_DAILY_RUN_KEY, shared.today);
  }

  return {
    status: 'ran' as const,
    today: shared.today,
    localHour,
    forced: force,
    rules: rules.status,
    activeRules: shared.active.source,
    contactsRecomputed: stats.contactsRecomputed,
    contactsWritten: stats.contactsWritten,
    contactsWhoseDateChanged: stats.contactsWhoseDateChanged,
    failures: stats.failures,
  };
};
