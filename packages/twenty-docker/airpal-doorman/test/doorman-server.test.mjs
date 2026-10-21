import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, test } from 'node:test';

import { parseRedisReply } from '../src/active-jobs.mjs';
import { classifyRequest, createDoormanServer } from '../src/doorman-server.mjs';
import { CLIENT_SCRIPT_TAG } from '../src/pages.mjs';

const listen = (server) =>
  new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve(server.address().port)),
  );

const createFakeController = () => {
  const controller = {
    state: 'awake',
    userActivity: 0,
    apiActivity: 0,
    wakeCalls: 0,
    getState: () => controller.state,
    recordUserActivity: () => controller.userActivity++,
    recordApiActivity: () => controller.apiActivity++,
    wake: async () => {
      controller.wakeCalls++;
      controller.state = 'awake';
    },
  };

  return controller;
};

let upstreamServer;
let doormanServer;
let doormanPort;
const controller = createFakeController();

before(async () => {
  upstreamServer = http.createServer((request, response) => {
    if (request.url === '/') {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end('<html><head><title>Twenty</title></head><body></body></html>');

      return;
    }

    const chunks = [];

    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(
        JSON.stringify({
          path: request.url,
          body: Buffer.concat(chunks).toString(),
          forwardedFor: request.headers['x-forwarded-for'] ?? null,
        }),
      );
    });
  });

  const upstreamPort = await listen(upstreamServer);

  doormanServer = createDoormanServer({
    controller,
    upstream: { hostname: '127.0.0.1', port: upstreamPort },
    wakeTimeoutMs: 1000,
    log: () => {},
  });
  doormanPort = await listen(doormanServer);
});

after(() => {
  doormanServer.close();
  upstreamServer.close();
});

// Raw http.request because fetch overwrites sec-fetch-mode with its own value.
const request = (path, { method = 'GET', headers = {}, body } = {}) =>
  new Promise((resolve, reject) => {
    const outgoing = http.request(
      { hostname: '127.0.0.1', port: doormanPort, path, method, headers },
      (response) => {
        const chunks = [];

        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString();

          resolve({
            status: response.statusCode,
            text: async () => text,
            json: async () => JSON.parse(text),
          });
        });
      },
    );

    outgoing.on('error', reject);
    outgoing.end(body);
  });

const NAVIGATION_HEADERS = { 'sec-fetch-site': 'none', 'sec-fetch-mode': 'navigate' };
const BROWSER_FETCH_HEADERS = { 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors' };

test('classifies navigations, browser fetches and API clients', () => {
  assert.equal(classifyRequest(NAVIGATION_HEADERS), 'navigation');
  assert.equal(classifyRequest(BROWSER_FETCH_HEADERS), 'browser');
  assert.equal(
    classifyRequest({ 'sec-fetch-mode': 'cors', 'user-agent': 'node', authorization: 'Bearer key' }),
    'api',
  );
  assert.equal(classifyRequest({ authorization: 'Bearer key' }), 'api');
  assert.equal(classifyRequest({ 'user-agent': 'l9scan/2.0' }), 'anonymous');
});

test('awake: page loads are proxied with the activity script injected', async () => {
  controller.state = 'awake';

  const response = await request('/', { headers: NAVIGATION_HEADERS });
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.ok(html.includes(`${CLIENT_SCRIPT_TAG}</head>`));
});

test('awake: API calls pass through unchanged, keeping X-Forwarded-For', async () => {
  controller.state = 'awake';

  const response = await request('/rest/companies', {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.7' },
    body: 'payload',
  });

  assert.deepEqual(await response.json(), {
    path: '/rest/companies',
    body: 'payload',
    forwardedFor: '203.0.113.7',
  });
});

test('asleep: a page load shows the loading screen and starts waking', async () => {
  controller.state = 'asleep';
  controller.wakeCalls = 0;

  const response = await request('/objects/companies', { headers: NAVIGATION_HEADERS });

  assert.equal(response.status, 200);
  assert.match(await response.text(), /Starting the CRM/);
  assert.equal(controller.wakeCalls, 1);
});

test('asleep: background requests from an open tab do not wake the CRM', async () => {
  controller.state = 'asleep';
  controller.wakeCalls = 0;

  const response = await request('/graphql', { method: 'POST', headers: BROWSER_FETCH_HEADERS });

  assert.equal(response.status, 503);
  assert.equal(controller.wakeCalls, 0);
});

test('asleep: API calls are held, the CRM woken, then the call proxied', async () => {
  controller.state = 'asleep';
  controller.wakeCalls = 0;

  const response = await request('/graphql', {
    method: 'POST',
    headers: { authorization: 'Bearer key' },
    body: '{"query":"{ me }"}',
  });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).body, '{"query":"{ me }"}');
  assert.equal(controller.wakeCalls, 1);
});

test('asleep: anonymous scanner requests do not wake the CRM', async () => {
  controller.state = 'asleep';
  controller.wakeCalls = 0;

  const response = await request('/.env', { headers: { 'user-agent': 'l9scan/2.0' } });

  assert.equal(response.status, 503);
  assert.equal(controller.wakeCalls, 0);
});

test('awake: anonymous requests are proxied without counting as activity', async () => {
  controller.state = 'awake';
  controller.apiActivity = 0;

  const response = await request('/healthz');

  assert.equal(response.status, 200);
  assert.equal(controller.apiActivity, 0);
});

test('activity pings from the page start a wake when asleep', async () => {
  controller.state = 'asleep';
  controller.wakeCalls = 0;

  const response = await request('/__doorman/activity', { method: 'POST' });

  assert.equal(response.status, 200);
  assert.equal(controller.wakeCalls, 1);
});

test('parses Redis array and integer replies', () => {
  const reply = parseRedisReply(Buffer.from('*2\r\n$17\r\nbull:email:active\r\n:3\r\n'));

  assert.deepEqual(reply.value, ['bull:email:active', 3]);
});
