import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createSleepController } from '../src/sleep-controller.mjs';

const MINUTE = 60_000;

const setup = ({ healthy = true, activeJobs = 0 } = {}) => {
  let currentTime = 0;
  const world = { healthy, activeJobs, stopped: new Set(), calls: [] };

  const railway = {
    startService: async (serviceId) => {
      world.calls.push(`start:${serviceId}`);
      world.stopped.delete(serviceId);
      world.healthy = true;
    },
    stopService: async (serviceId) => {
      world.calls.push(`stop:${serviceId}`);
      world.stopped.add(serviceId);
      if (serviceId === 'server') world.healthy = false;
    },
    isServiceStopped: async (serviceId) => world.stopped.has(serviceId),
  };

  const controller = createSleepController({
    railway,
    serverServiceId: 'server',
    workerServiceId: 'worker',
    isUpstreamHealthy: async () => world.healthy,
    countActiveJobs: async () => world.activeJobs,
    userIdleMs: 20 * MINUTE,
    apiIdleMs: 5 * MINUTE,
    wakeTimeoutMs: 5 * MINUTE,
    now: () => currentTime,
    log: () => {},
  });

  return {
    controller,
    world,
    advance: (milliseconds) => {
      currentTime += milliseconds;
    },
  };
};

test('a running CRM is adopted as awake on first tick', async () => {
  const { controller } = setup();

  await controller.tick();

  assert.equal(controller.getState(), 'awake');
});

test('sleeps after 20 minutes without user activity', async () => {
  const { controller, world, advance } = setup();

  await controller.tick();
  advance(19 * MINUTE);
  await controller.tick();
  assert.equal(controller.getState(), 'awake');

  advance(2 * MINUTE);
  await controller.tick();

  assert.equal(controller.getState(), 'asleep');
  assert.deepEqual(world.calls, ['stop:worker', 'stop:server']);
});

test('user activity postpones sleep', async () => {
  const { controller, advance } = setup();

  await controller.tick();
  advance(15 * MINUTE);
  controller.recordUserActivity();
  advance(15 * MINUTE);
  await controller.tick();

  assert.equal(controller.getState(), 'awake');
});

test('api activity only keeps the CRM awake for 5 minutes', async () => {
  const { controller, advance } = setup();

  await controller.tick();
  advance(21 * MINUTE);
  controller.recordApiActivity();
  advance(4 * MINUTE);
  await controller.tick();
  assert.equal(controller.getState(), 'awake');

  advance(2 * MINUTE);
  await controller.tick();
  assert.equal(controller.getState(), 'asleep');
});

test('stays awake while the worker has active jobs', async () => {
  const { controller, world, advance } = setup({ activeJobs: 2 });

  await controller.tick();
  advance(30 * MINUTE);
  await controller.tick();
  assert.equal(controller.getState(), 'awake');

  world.activeJobs = 0;
  await controller.tick();
  assert.equal(controller.getState(), 'asleep');
});

test('wake starts both services and becomes awake once healthy', async () => {
  const { controller, world, advance } = setup();

  await controller.tick();
  advance(21 * MINUTE);
  await controller.tick();
  world.calls.length = 0;

  await controller.wake();

  assert.equal(controller.getState(), 'awake');
  assert.deepEqual(world.calls.sort(), ['start:server', 'start:worker']);
});

test('concurrent wake calls share one start', async () => {
  const { controller, world, advance } = setup();

  await controller.tick();
  advance(21 * MINUTE);
  await controller.tick();
  world.calls.length = 0;

  await Promise.all([controller.wake(), controller.wake(), controller.wake()]);

  assert.equal(world.calls.length, 2);
});

test('a CRM started outside the doorman is picked up while asleep', async () => {
  const { controller, world, advance } = setup();

  await controller.tick();
  advance(21 * MINUTE);
  await controller.tick();
  assert.equal(controller.getState(), 'asleep');

  world.healthy = true;
  await controller.tick();

  assert.equal(controller.getState(), 'awake');
});

test('an unhealthy but stopped CRM is detected as asleep on first tick', async () => {
  const { controller, world } = setup({ healthy: false });

  world.stopped.add('server');
  await controller.tick();

  assert.equal(controller.getState(), 'asleep');
});
