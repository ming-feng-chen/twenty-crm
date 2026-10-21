export const DOORMAN_PATH_PREFIX = '/__doorman/';

export const CLIENT_SCRIPT_TAG = `<script src="${DOORMAN_PATH_PREFIX}client.js" defer></script>`;

export const injectClientScript = (html) =>
  html.includes('</head>')
    ? html.replace('</head>', `${CLIENT_SCRIPT_TAG}</head>`)
    : `${html}${CLIENT_SCRIPT_TAG}`;

export const LOADING_PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Starting AirPal CRM</title>
<style>
  :root { color-scheme: light dark; --bg: #f7f7f8; --fg: #1f2023; --muted: #6b6f76; --accent: #1961ed; }
  @media (prefers-color-scheme: dark) { :root { --bg: #151517; --fg: #ececee; --muted: #9a9ca3; } }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--fg);
    font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { text-align: center; padding: 0 16px; }
  .spinner { width: 32px; height: 32px; margin: 0 auto 20px; border: 3px solid color-mix(in srgb, var(--accent) 20%, transparent);
    border-top-color: var(--accent); border-radius: 50%; animation: spin 0.9s linear infinite; }
  h1 { font-size: 18px; font-weight: 600; margin: 0 0 6px; }
  p { margin: 0; color: var(--muted); }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<main>
  <div class="spinner"></div>
  <h1>Starting the CRM</h1>
  <p id="message">It was asleep to save costs. This usually takes 1 to 2 minutes.</p>
</main>
<script>
  const message = document.getElementById('message');
  const startedAt = Date.now();
  const check = async () => {
    try {
      const response = await fetch('${DOORMAN_PATH_PREFIX}wake', { method: 'POST', cache: 'no-store' });
      const { state } = await response.json();
      if (state === 'awake') return location.reload();
      if (state === 'asleep' && Date.now() - startedAt > 10000) {
        message.textContent = 'Startup failed. Retrying...';
      }
    } catch {}
    setTimeout(check, 3000);
  };
  check();
</script>
</body>
</html>`;

// Runs inside the CRM page: reports real user input so background polling from an idle tab never keeps the CRM awake.
export const CLIENT_SCRIPT = `(() => {
  const THROTTLE_MS = 60000;
  let lastReportAt = 0;
  let isWaiting = false;

  const waitForWake = () => {
    if (isWaiting) return;
    isWaiting = true;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;' +
      'background:rgba(0,0,0,0.45);color:#fff;font:600 16px system-ui,sans-serif;text-align:center;padding:16px';
    overlay.textContent = 'The CRM went to sleep. Starting it again, this takes 1 to 2 minutes...';
    document.body.appendChild(overlay);
    const poll = async () => {
      try {
        const response = await fetch('${DOORMAN_PATH_PREFIX}wake', { method: 'POST', cache: 'no-store' });
        const { state } = await response.json();
        if (state === 'awake') return location.reload();
      } catch {}
      setTimeout(poll, 3000);
    };
    poll();
  };

  const report = async () => {
    const reportAt = Date.now();
    if (reportAt - lastReportAt < THROTTLE_MS) return;
    lastReportAt = reportAt;
    try {
      const response = await fetch('${DOORMAN_PATH_PREFIX}activity', { method: 'POST', cache: 'no-store', keepalive: true });
      const { state } = await response.json();
      if (state !== 'awake') waitForWake();
    } catch {}
  };

  for (const eventName of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart']) {
    window.addEventListener(eventName, report, { passive: true, capture: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') report();
  });
  report();
})();
`;
