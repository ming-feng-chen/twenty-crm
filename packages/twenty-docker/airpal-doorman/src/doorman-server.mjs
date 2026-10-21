import http from 'node:http';
import net from 'node:net';

import {
  CLIENT_SCRIPT,
  DOORMAN_PATH_PREFIX,
  LOADING_PAGE_HTML,
  injectClientScript,
} from './pages.mjs';

const MAX_HELD_BODY_BYTES = 20 * 1024 * 1024;

// Keyed on sec-fetch-site: Node's fetch also sends sec-fetch-mode, which would make bots look like idle tabs.
// Non-browser traffic without credentials is internet scanners; it must never wake or hold the CRM up.
export const classifyRequest = (headers) => {
  if (headers['sec-fetch-site'] === undefined) {
    return headers.authorization === undefined ? 'anonymous' : 'api';
  }
  if (headers['sec-fetch-mode'] === 'navigate') return 'navigation';

  return 'browser';
};

const sendJson = (response, statusCode, body, extraHeaders = {}) => {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  response.end(JSON.stringify(body));
};

const readBody = (request) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    request.on('data', (chunk) => {
      size += chunk.length;

      if (size > MAX_HELD_BODY_BYTES) {
        request.destroy();
        reject(new Error('Request body too large to hold while waking'));

        return;
      }

      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });

const withTimeout = (promise, milliseconds) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timed out')), milliseconds),
    ),
  ]);

export const createDoormanServer = ({ controller, upstream, wakeTimeoutMs, log = console.log }) => {
  const proxy = (request, response, { heldBody, injectScript }) => {
    const headers = { ...request.headers };

    if (injectScript) headers['accept-encoding'] = 'identity';

    if (heldBody) {
      delete headers['transfer-encoding'];
      headers['content-length'] = String(heldBody.length);
    }

    const upstreamRequest = http.request(
      {
        hostname: upstream.hostname,
        port: upstream.port,
        method: request.method,
        path: request.url,
        headers,
      },
      (upstreamResponse) => {
        const isHtml = /text\/html/i.test(
          upstreamResponse.headers['content-type'] ?? '',
        );

        if (!injectScript || !isHtml) {
          response.writeHead(upstreamResponse.statusCode, upstreamResponse.headers);
          upstreamResponse.pipe(response);

          return;
        }

        const chunks = [];

        upstreamResponse.on('data', (chunk) => chunks.push(chunk));
        upstreamResponse.on('end', () => {
          const html = injectClientScript(Buffer.concat(chunks).toString('utf8'));
          const responseHeaders = { ...upstreamResponse.headers };

          delete responseHeaders['transfer-encoding'];
          responseHeaders['content-length'] = String(Buffer.byteLength(html));
          response.writeHead(upstreamResponse.statusCode, responseHeaders);
          response.end(html);
        });
      },
    );

    upstreamRequest.on('error', (error) => {
      log(`upstream error on ${request.method} ${request.url}: ${error.message}`);

      if (!response.headersSent) {
        sendJson(response, 502, { error: 'CRM unreachable' });
      } else {
        response.destroy();
      }
    });
    response.on('close', () => {
      if (!response.writableFinished) upstreamRequest.destroy();
    });

    if (heldBody) {
      upstreamRequest.end(heldBody);
    } else {
      request.pipe(upstreamRequest);
    }
  };

  const startWake = () => controller.wake().catch(() => {});

  const handleDoormanRoute = (request, response) => {
    const route = request.url.slice(DOORMAN_PATH_PREFIX.length).split('?')[0];

    if (route === 'client.js') {
      response.writeHead(200, {
        'Content-Type': 'text/javascript',
        'Cache-Control': 'no-cache',
      });
      response.end(CLIENT_SCRIPT);

      return;
    }

    if (route === 'status') {
      sendJson(response, 200, { state: controller.getState() });

      return;
    }

    if (request.method === 'POST' && (route === 'activity' || route === 'wake')) {
      request.resume();
      controller.recordUserActivity();

      if (controller.getState() !== 'awake') startWake();

      sendJson(response, 200, { state: controller.getState() });

      return;
    }

    sendJson(response, 404, { error: 'Not found' });
  };

  const handleRequest = async (request, response) => {
    if (request.url.startsWith(DOORMAN_PATH_PREFIX)) {
      handleDoormanRoute(request, response);

      return;
    }

    const requestKind = classifyRequest(request.headers);

    if (requestKind === 'navigation') controller.recordUserActivity();
    if (requestKind === 'api') controller.recordApiActivity();

    if (controller.getState() === 'awake') {
      proxy(request, response, { injectScript: requestKind === 'navigation' });

      return;
    }

    if (requestKind === 'navigation') {
      startWake();
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      response.end(LOADING_PAGE_HTML);

      return;
    }

    // An idle tab's background polling must not wake the CRM; its next real input does, via the client script.
    if (requestKind === 'browser' || requestKind === 'anonymous') {
      sendJson(response, 503, { error: 'CRM is asleep' }, { 'Retry-After': '60' });

      return;
    }

    try {
      const heldBody = await readBody(request);

      await withTimeout(controller.wake(), wakeTimeoutMs);
      controller.recordApiActivity();
      proxy(request, response, { heldBody });
    } catch (error) {
      log(`API request held while waking failed: ${error.message}`);
      sendJson(
        response,
        503,
        { error: 'CRM is starting, retry in a minute' },
        { 'Retry-After': '60' },
      );
    }
  };

  const handleUpgrade = (request, socket, head) => {
    if (controller.getState() !== 'awake') {
      socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');

      return;
    }

    const upstreamSocket = net.connect(upstream.port, upstream.hostname, () => {
      const headerLines = [];

      for (let index = 0; index < request.rawHeaders.length; index += 2) {
        headerLines.push(`${request.rawHeaders[index]}: ${request.rawHeaders[index + 1]}`);
      }

      upstreamSocket.write(
        `${request.method} ${request.url} HTTP/1.1\r\n${headerLines.join('\r\n')}\r\n\r\n`,
      );
      upstreamSocket.write(head);
      socket.pipe(upstreamSocket).pipe(socket);
    });

    const destroyBoth = () => {
      socket.destroy();
      upstreamSocket.destroy();
    };

    upstreamSocket.on('error', destroyBoth);
    socket.on('error', destroyBoth);
  };

  const server = http.createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
      log(`request failed: ${error.message}`);

      if (!response.headersSent) sendJson(response, 500, { error: 'Doorman error' });
    });
  });

  // Live-update streams stay open for minutes; Node's default 5-minute request timeout would cut them.
  server.requestTimeout = 0;
  server.keepAliveTimeout = 65_000;
  server.on('upgrade', handleUpgrade);

  return server;
};
