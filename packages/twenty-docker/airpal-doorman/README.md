# AirPal doorman

Small zero-dependency proxy that owns `crm.airpal.co.uk` on Railway and puts the Twenty `server` and `worker` services to sleep when nobody is using the CRM, to cut memory cost.

## Behaviour

- **Awake:** every request is proxied to `UPSTREAM_URL`. Page loads get `/__doorman/client.js` injected, which reports real input (clicks, keys, scroll, mouse) at most once a minute.
- **Goes to sleep** when there has been no user input for `USER_IDLE_MINUTES` (20), no API call for `API_IDLE_MINUTES` (5), and no active BullMQ job in Redis. It stops the worker, then the server, with Railway's `deploymentStop`.
- **Wakes** with `deploymentRestart`, which reuses the built image, so there is no rebuild:
  - a page load shows a "Starting the CRM" screen and reloads once `/healthz` answers;
  - an input in a tab that is already open shows an overlay and reloads;
  - an API client (no `sec-fetch-site` header but an `Authorization` header, e.g. the Grok bot) is held until the CRM is up, then proxied;
  - background requests from an idle tab, and anonymous non-browser traffic (internet scanners), get a 503 and never wake the CRM.
- A deploy or restart done in the dashboard is detected through `/healthz` and adopted as awake.

## Railway setup

Service `doorman` in project `airpal-twenty`, deployed with `railway up --service doorman` from this folder.

| Variable | Value |
|---|---|
| `UPSTREAM_URL` | `http://server.railway.internal:3000` |
| `RAILWAY_API_TOKEN` | project token for the production environment |
| `SERVER_SERVICE_ID` / `WORKER_SERVICE_ID` | Twenty service ids |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` |
| `USER_IDLE_MINUTES`, `API_IDLE_MINUTES`, `WAKE_TIMEOUT_MINUTES` | optional, default 20 / 5 / 5 |

`RAILWAY_ENVIRONMENT_ID` is injected by Railway. The custom domain `crm.airpal.co.uk` lives on `doorman`, not `server`.

## Rollback

Move the `crm.airpal.co.uk` custom domain back to `server` (port 3000), update the Wix CNAME to the target Railway shows, and restart `server` and `worker` if they are asleep. Then remove the `doorman` service.

## Tests

`node --test test/*.test.mjs`
