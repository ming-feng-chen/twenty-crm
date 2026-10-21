const HEALTH_POLL_INTERVAL_MS = 3000;

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export const createSleepController = ({
  railway,
  serverServiceId,
  workerServiceId,
  isUpstreamHealthy,
  countActiveJobs,
  userIdleMs,
  apiIdleMs,
  wakeTimeoutMs,
  now = Date.now,
  log = console.log,
}) => {
  let state = 'unknown';
  let lastUserActivityAt = now();
  let lastApiActivityAt = now();
  let wakePromise;
  let stopPromise;

  const markAwake = () => {
    state = 'awake';
    lastApiActivityAt = now();
  };

  const waitUntilHealthy = async () => {
    const deadline = now() + wakeTimeoutMs;

    while (now() < deadline) {
      if (await isUpstreamHealthy()) return;
      await delay(HEALTH_POLL_INTERVAL_MS);
    }

    throw new Error(`CRM not healthy after ${wakeTimeoutMs}ms`);
  };

  const wake = () => {
    if (state === 'awake') return Promise.resolve();
    if (wakePromise) return wakePromise;

    const startedAt = now();

    wakePromise = (async () => {
      if (stopPromise) await stopPromise.catch(() => {});

      state = 'waking';
      log('waking CRM');
      await Promise.all([
        railway.startService(serverServiceId),
        railway.startService(workerServiceId),
      ]);
      await waitUntilHealthy();
      markAwake();
      log(`CRM awake after ${Math.round((now() - startedAt) / 1000)}s`);
    })()
      .catch((error) => {
        state = 'asleep';
        log(`wake failed: ${error.message}`);
        throw error;
      })
      .finally(() => {
        wakePromise = undefined;
      });

    return wakePromise;
  };

  const sleep = () => {
    state = 'stopping';
    log('putting CRM to sleep');

    stopPromise = (async () => {
      await railway.stopService(workerServiceId);
      await railway.stopService(serverServiceId);
      state = 'asleep';
      log('CRM asleep');
    })()
      .catch(async (error) => {
        log(`sleep failed, retrying after the idle window: ${error.message}`);
        await Promise.allSettled([
          railway.startService(workerServiceId),
          railway.startService(serverServiceId),
        ]);
        markAwake();
        lastUserActivityAt = now();
      })
      .finally(() => {
        stopPromise = undefined;
      });

    return stopPromise;
  };

  const isIdle = () =>
    now() - lastUserActivityAt >= userIdleMs &&
    now() - lastApiActivityAt >= apiIdleMs;

  // Reconciles with reality so manual deploys or restarts in the dashboard are picked up.
  const sync = async () => {
    if (wakePromise || stopPromise) return;

    const healthy = await isUpstreamHealthy();

    if (healthy && state !== 'awake') {
      log(`CRM found running while ${state}`);
      markAwake();
      lastUserActivityAt = now();

      return;
    }

    if (!healthy && state !== 'asleep') {
      const stopped = await railway.isServiceStopped(serverServiceId);

      if (stopped) {
        state = 'asleep';
      } else if (state === 'unknown') {
        await wake().catch(() => {});
      }
    }
  };

  const tick = async () => {
    await sync();

    if (state !== 'awake' || !isIdle()) return;

    const activeJobs = await countActiveJobs().catch((error) => {
      log(`active job check failed, staying awake: ${error.message}`);

      return Infinity;
    });

    if (activeJobs > 0) return;

    await sleep();
  };

  return {
    getState: () => state,
    recordUserActivity: () => {
      lastUserActivityAt = now();
    },
    recordApiActivity: () => {
      lastApiActivityAt = now();
    },
    wake,
    tick,
  };
};
