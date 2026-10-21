import http from 'node:http';

import { createActiveJobsCounter } from './active-jobs.mjs';
import { createDoormanServer } from './doorman-server.mjs';
import { createRailwayApi } from './railway-api.mjs';
import { createSleepController } from './sleep-controller.mjs';

const TICK_INTERVAL_MS = 30_000;

const requireEnv = (name) => {
  const value = process.env[name];

  if (!value) throw new Error(`Missing environment variable ${name}`);

  return value;
};

const minutes = (name, fallback) =>
  Number(process.env[name] ?? fallback) * 60_000;

const upstream = new URL(requireEnv('UPSTREAM_URL'));
const log = (message) => console.log(`[doorman] ${message}`);

const isUpstreamHealthy = () =>
  new Promise((resolve) => {
    const request = http.get(
      {
        hostname: upstream.hostname,
        port: upstream.port,
        path: '/healthz',
        timeout: 2000,
      },
      (response) => {
        response.resume();
        resolve(response.statusCode === 200);
      },
    );

    request.on('timeout', () => request.destroy());
    request.on('error', () => resolve(false));
  });

const wakeTimeoutMs = minutes('WAKE_TIMEOUT_MINUTES', 5);

const controller = createSleepController({
  railway: createRailwayApi({
    token: requireEnv('RAILWAY_API_TOKEN'),
    environmentId: requireEnv('RAILWAY_ENVIRONMENT_ID'),
  }),
  serverServiceId: requireEnv('SERVER_SERVICE_ID'),
  workerServiceId: requireEnv('WORKER_SERVICE_ID'),
  isUpstreamHealthy,
  countActiveJobs: createActiveJobsCounter({
    redisUrl: requireEnv('REDIS_URL'),
    queuePrefix: process.env.REDIS_QUEUE_PREFIX ?? 'bull',
  }).countActiveJobs,
  userIdleMs: minutes('USER_IDLE_MINUTES', 20),
  apiIdleMs: minutes('API_IDLE_MINUTES', 5),
  wakeTimeoutMs,
  log,
});

const port = Number(process.env.PORT ?? 8080);

createDoormanServer({ controller, upstream, wakeTimeoutMs, log }).listen(
  port,
  '::',
  () => log(`listening on ${port}, proxying to ${upstream.host}`),
);

const runTick = () =>
  controller.tick().catch((error) => log(`tick failed: ${error.message}`));

runTick();
setInterval(runTick, TICK_INTERVAL_MS);
