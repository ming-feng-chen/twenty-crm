# Handover to Astra: AirPal CRM (Twenty fork)

Written 2026-10-17 by the previous agent (Claude Code) for Astra, who picks up this work. Read it top to bottom before doing anything. No secrets are in this file; it only says where they live.

## Codex continuation, 2026-10-17

The original handover below is historical. The owner has since answered F1-F4,
G1-G4, H1 and the meeting-stage question; current decisions are in the cadence
app's `SPEC.md` §1 and the existing Claude project memory. F2 and F3 explicitly
reject the original recommendations: unowned contacts without LinkedIn start
at connection request, and Start fresh clears owed replies. Manual touches
dated on their logging day use logging time; backdated entries remain date-only.

The owner approved S1 staging migration and tests on 2026-10-17. The guarded
legacy-channel rename, final plan and staging apply succeeded. Restoration
verified all 33 touches (12 deleted), four steps and one cadence; 38 rows were
updated without changing deletion states. The active rules save returned
unchanged; forced recomputation processed 23 contacts with no failures.
Both Railway staging service redeploys succeeded. Staging verification:
- Cadence scenarios: 63 passed, zero failed.
- Email/calendar fixtures: 37/37 passed; historical backfill deliberately skipped.
- Channel scenarios: 30/30 passed after fixing three stale label assertions
  (the existing missing-LinkedIn suffix was omitted from their expectations).
- UI API: 23/24 passed initially; the remaining timing fixture generated its
  "later" timestamp 636ms before the server cutoff. It now waits until after
  that cutoff; its focused rerun passed. All 24 cases therefore passed across
  the full run and focused rerun. No app-code fix or redeploy was needed.
- Final read-only verification: active and stored rules match the snapshot
  with the new compatibility fields (four steps, 11 channels); all 33 original
  touch channels and deletion states still match. No further restore needed.

Local verification: 33 test files / 569 tests passed, nine migration-planning
and four final-state-planning tests passed, typecheck and lint passed, and
build `77f6419133af` succeeded. Typecheck also passed after deployment generated
the staging client. The existing command-panel widget-picker warning remains.

Windows staging Vitest fork workers stalled before results. The staging config
now selects threads on Windows; run through `node scripts/codex/cadence.mjs test
--config scripts/staging-scenarios/vitest.staging.config.mjs --maxWorkers 1`.
The initial cadence run used the old log-file check; its record stability checks
passed, but that file is not independent live-log evidence. Future runs explicitly
skip absent/stale logs. Separate CLI/Railway log captures found no unexpected
runtime errors in the inspected windows; stream disconnects and Railway startup
log drops limit coverage. Redacted reports and logs are in the app's ignored
`scripts/staging-scenarios` and `node_modules/.cache` directories.

The old SELECT Channel was renamed separately before app apply to avoid the
create-before-rename collision. Snapshot restoration also handles Twenty's empty
string default for new TEXT fields while rejecting nonempty conflicts. Private
snapshots and guarded migration/final-state helpers remain in the ignored local
directories. Capture a fresh snapshot before any later migration; the original
pre-migration snapshot is retained for this migration's audit.

Scoped browser QA completed after the owner signed in, using isolated Chrome
and the local Playwright/CDP helper because Codex browser tools still fail with
missing kernel assets. Three scenarios passed: owner filters plus Did it/Undo;
future-date rejection and a valid backdated touch; custom-channel Preview/Save.
Contact and touch timelines were verified. Save exposed a client crash (`not a
child of this node`) twice. Distinct loading/error/ready root keys in
`src/ui/components/rules-page.tsx` fixed it; the exact browser Save regression
passed twice afterward. The local unit harness did not reproduce the failure,
so it remains ignored debug material, not claimed regression coverage.

Typecheck and lint passed again. Staging build/apply `643cc5e76a70` updated only
the rules front component (one update, no schema changes). Two QA contacts and
two touches were removed and verified. Active/stored rules were restored exactly,
with zero dates moved; test rule audit entries remain. The owner's earlier
manual action was preserved. No unexpected backend errors appeared in captured
logs from 19:52:10 to 20:09:30 UTC; bounded logs do not prove full coverage.
Evidence is in the app's ignored `node_modules/.cache/browser-qa/report.md`,
`verdict.json`, screenshots and attestations.

Remaining browser checks completed on 2026-10-18 (Europe/London), at 1280x720.
Rita's rules page was read-only; dark My Day and rules were readable, and her
original System theme was restored. Something else, Snooze, Hold, Dead and
non-permanent opt-out saved and undid correctly. The permanent opt-out warning
and second confirmation were checked then cancelled. A reply logged by Rita on
an admin-owned contact retained Rita as actor. Keep position preserved reply
debt; Start fresh cleared it. Cold and My Day (table), record Did it/Undo,
Recompute and Change owner passed, with API attestations.

Admin rules checks passed for numeric and time-zone validation, draft step
add/reorder/remove, Reset to defaults with preview, and conflicting saves.
The stale save was rejected and the draft recovered. The temporary concurrent
edit changed only the cadence name; it and restoration moved zero dates.
One setup save returned 423 during the scheduled reconciliation window; the
lock cleared, rules were unchanged, and the retry passed. Cron logs and code
support that explanation, but logs do not identify the function conclusively.

All three dedicated contacts, five touches (including two undone), and their
newly created company were removed and verified. Active and stored rules match
the baseline exactly; test audit entries remain. The browser was left on the
admin's My Day. Evidence is in the ignored
`node_modules/.cache/browser-qa-remaining/` report, verdict, screenshots and
attestations. No app-code changes or redeploy were needed for these remaining
checks. Production, commits and historical email/meeting backfill remain
untouched. Production rollout still requires the owner's explicit go-ahead.
No unexpected backend errors appeared in the bounded 22:50:37 to 23:12:37 UTC
captures on 2026-10-17; both staging deployments remained successful. These
captures do not prove complete log delivery. Step controls/reset were exercised
as drafts, and permanent suppression was cancelled; earlier API suites cover
their persisted behavior. Real mailbox production verification remains a
separate go-live requirement.

## Production rollout preparation, 2026-10-18

Owner asked to proceed after staging verification. Local rebuild matches the
tested hash `643cc5e76a70`. Production server/worker deployments are successful;
both still lack `LOGIC_FUNCTION_TYPE`. Existing company records were observed,
so the historical claim of no real data must not guide installation. Four
database backups exist; the latest object is dated 2026-10-18 02:01:10 UTC and
is 1,510,038 bytes. Full restore verification remains outstanding.

Owner manually signed into production in visible Chrome and approved temporary
SSH access and a temporary Admin API key with 15-day expiry. SSH key
`airpal-rollout-temporary-20261018` is registered. After automatic approval review
requested explicit consent, the owner approved the presented Railway SSH host
fingerprint and regeneration of only the newly created temporary API key.
Both operations succeeded. The key is saved privately as CLI remote `production`;
`staging` remains the default. The temporary key expires 2026-11-01 08:00:50 UTC.
The CLI browser authorization alternative fails because the HTTPS server
identifies its OAuth issuer as HTTP.

Initial production inventory confirmed 102 contacts, 52 companies, no cadence
application or registration, and no existing cadence objects. Read-only database inspection
found 31 populated encrypted values, all versioned envelopes matching the current
primary key; no legacy or unknown-key values were found. Deployed fallback and
rotation implementations are present. This format check alone does not prove
authenticated decryption. No S3 database overrides were found. The initial
48-hour calendar window contains zero visible events. Romy and Ilesh currently
have the standard Member role; their production Cadence Member assignment is
still outstanding. Both server and worker authenticated all 31 encrypted values
successfully; eight compared code artifacts match. SSH-process settings were
checked, but the running PID 1 environment is permission-restricted and was not
read. All three connected accounts and their mail/calendar channels are active,
without observed authentication or throttling failures. Channels currently use
metadata sharing. Source inspection suggests the app's participant-root reads
can still obtain classification fields; live controlled-fixture verification
remains necessary. Sharing settings have not been changed.

The 02:01 UTC database archive restored into an isolated local PostgreSQL 18
cluster: 114 tables, one workspace, zero invalid indexes. The cluster was stopped.
This verifies schema/data restoration, not production ownership/grants, app
startup, S3 files or Redis. A Windows inherited-pipe issue stalled the first
launcher; that exact test process and cluster were stopped, the launcher fixed,
and a fresh isolated retry passed. Production was unaffected. Current raw and
resolved production settings are retained in a private DPAPI-encrypted recovery
file; decryptability was checked. Worker and backup S3 settings reference server
values, as do worker APP_SECRET and ENCRYPTION_KEY.

An empty production app registration/installation was created solely to obtain
the server's dry-run plan. The shell has zero objects, functions or components,
and no default role at that point. The exact tested build planned 478 creates,
zero updates and zero deletions. The first read-only lookup
failed because findManyApplications does not load nested relations; the helper
now reads those through findOneApplication. No write occurred on that failed
attempt. Development app apply does not invoke post-install automatically;
initialization must use the guarded daily reconciliation or its scheduled run.

Production rollout is underway with the owner's explicit approval. A fresh full
database archive was captured at 07:30 UTC on 2026-10-18 and checked; its hash
and restricted recovery location are in the access ledger. Server and worker
were paused before rotating S3 credentials, APP_SECRET and ENCRYPTION_KEY.
FALLBACK_ENCRYPTION_KEY preserves access to existing encrypted records. Runtime
configuration and references were verified at 07:51 UTC, including LOCAL logic
execution. The server restarted successfully on the existing image; the worker
remains paused pending initialization. The first final plan stopped before
mutation because generated index identifiers changed. All 30 index definitions
were semantically identical; source confirms random identifiers for generated
relation indexes. The corrected guard preserves all index properties and checks
embedded references. The guarded apply then succeeded at approximately 07:59
UTC: build `643cc5e76a70`, 478 creates, zero updates/deletes, 54 uploaded files.
The final server and worker restarts succeeded. Initialization processed all
102 contacts with zero failures; all 102 have computed cadence state. Live
counts remained 102 people and 52 companies, with one default cadence, four
steps and 11 channels. Romy and Ilesh were assigned Cadence Member and verified;
Ming-Feng remains Admin. Postrotation authenticated decryption passed for all
31 stored encrypted values on both server and worker; all three accounts remain active.
Running-process environment access was denied, so that check used the SSH
execution environment. All three mailboxes synced after the worker restart.
The backup deployment was refreshed successfully and resolves the rotated S3
credentials; its next scheduled run is 2026-10-19 02:00 UTC. A new backup upload
has not yet been observed, since redeploying this cron service does not run it.
Production My Day, Cold and Cadence rules rendered correctly. An isolated QA
person was made due today using a non-deliverable address; Did it created the
expected manual EMAIL touch and Undo removed it. The person was then soft-deleted
and zero active fixture people/touches were verified. The undone touch and
soft-deleted person remain audit history. The automatic company created from
the QA address was identified by its exact creation time and fixture linkage,
checked for zero active business references, and soft-deleted. Counts returned
to 102 people, 52 companies and zero live touches before the approved live test.
Temporary Railway SSH access was revoked and all four local key files removed.
The temporary production API key was revoked and removed from local CLI
credentials; staging remains the default and other settings were preserved.
Remaining browser checks use the owner's existing session.
The owner explicitly approved one controlled email between their AirPal mailbox
and existing personal Outlook contact. It was sent at 08:21 UTC and produced
one GMAIL/EMAIL/OUTBOUND touch with exact message timestamp and no duplicate.
The existing contact remains unowned; its history is preserved. The owner was
initially misunderstood the reply step, then sent the actual Outlook reply at
08:46:44 UTC. Gmail showed the reply in Inbox and the CRM imported it at
08:47:01 UTC. One GMAIL/EMAIL/INBOUND touch was created at 08:47:02 UTC with
the exact message time, no missing or duplicate touches. The contact changed
to REPLY_OWED, "Reply to them — owed since 18 Oct 2026", due 18 October.
This controlled outgoing/incoming exchange passed; no sync defect was found.
The contact remains unowned, so this does not attest visibility in Ming-Feng's
personal My Day list. Live calendar, out-of-office and bounce checks remain
outstanding. Staging is retained.
No data migration or
historical sync backfill has run. Track temporary access and cleanup in the ignored
app `node_modules/.cache/production-rollout/access-ledger.json`. That directory
also contains the prepared rollout, real-mailbox checklist, readiness queries,
backup/config evidence and recovery/rotation notes. Remove temporary access
after the rollout; retain staging until production acceptance.
Historical sync backfill remains deferred.

## 1. Who, what, and how to work with the owner

- **Product owner:** Ming-Feng Chen (`ming-feng.chen@airpal.co.uk`). Team: Romy (`romy-levy@airpal.co.uk`) and Ilesh (`ilesh-vora@airpal.co.uk`). Some teammates work from Thailand.
- **Goal:** replace the old in-house CRM (`crmoffice.airpal.co.uk`) with a fork of Twenty CRM that AirPal owns and extends, hosted cheaply and reliably, used daily by the team.
- **How the owner wants you to work** (follow these exactly):
  - Assume nothing. If anything is unclear, ask. "Make no mistakes" was said repeatedly.
  - Ask **one question at a time** when a decision is needed, explain it in plain English with a concrete example, and give a recommendation. "Yes" should accept your recommendation.
  - Use agents for parallel work, and verify their results yourself before reporting (re-run tests, check facts).
  - Never touch production without the owner's go-ahead. Test on staging first.
  - Be honest about failures and incidents.
- **Repo conventions:** read `CLAUDE.md` (the repo's own rules). The repo's `.claude/settings.json` SessionStart hook says: no co-author or "Generated with" lines in commits or PRs, no em dashes, concise human tone, minimal code comments.

## 2. Where everything is

| Thing | Location |
|---|---|
| This repo (the fork) | `C:\Users\ming_\Desktop\Workk\AirPal CRM`, GitHub `ming-feng-chen/twenty-crm` (public fork of `twentyhq/twenty`), branch `main` |
| Old CRM (reference, do not modify) | `C:\Users\ming_\Desktop\Workk\crm` (GitHub `ming-feng-chen/crm`). Docs: `docs/how-the-crm-works.md`, `docs/outreach-cadence.md`, `docs/adr/`. Engine: `packages/core/src/cadence/`. Its data is in **Supabase** (eu-west-1), its web app on Railway project `airpal-crm` |
| The new cadence app (main work in progress) | `packages/twenty-apps/internal/airpal-cadence/` (read its `SPEC.md` and `README.md`) |
| Persistent agent memory | `C:\Users\ming_\.claude\projects\C--Users-ming--Desktop-Workk-AirPal-CRM\memory\` (`twenty-deployment.md`, `my-day-cadence-design.md`) |
| Staging credentials | `C:\Users\ming_\AppData\Local\Temp\claude\C--Users-ming--Desktop-Workk-AirPal-CRM\20eb3034-4452-43b0-882d-1aae30be31fb\scratchpad\` files `staging-credentials.env` (admin login + API token), `rep-credentials.env` (non-admin test user "Rita Rep"), plus short-lived session token files. This is a temp folder and may be cleaned up; if it is gone, create a new API key from the staging admin account (see §5). |
| Twenty app CLI auth | `~/.twenty/config.json` (remote named `staging`) |
| Wix API key (DNS for airpal.co.uk) | `C:\Users\ming_\Desktop\Workk\AirPal\wix-api-key.txt` (account id `84fb35b9-a2f7-4627-8abf-275ff1cc55b6`) |

Never print secrets. Redact any value whose key contains SECRET/KEY/PASSWORD/TOKEN or whose value contains `@` or `://`.

## 3. Production (live, the team uses it)

- **URL:** https://crm.airpal.co.uk. DNS is on **Wix** (not Cloudflare): CNAME `crm` to `mjg7ollp.up.railway.app` plus a `_railway-verify.crm` TXT record, managed through the Wix DNS zone API (`https://www.wixapis.com/domains/v1/dns-zones/airpal.co.uk`, header `wix-account-id`).
- **Railway** project `airpal-twenty` (id `4c268686-22c5-42dd-aca8-c802bd010098`), environment `production` (`e7b0408f-ba9c-4bd4-b098-5182d62b1943`), region EU West (`europe-west4-drams3a`). Workspace plan is **Hobby**.
  - `server` (`975d5865-51e4-4d4c-a45f-1140998c5ae7`) and `worker` (`edf9d0ba-12a0-4ac9-9717-97b6cce264cf`, start command `yarn worker:prod`). Worker variables reference the server (`${{server.X}}`).
  - `Postgres` (postgres-ssl:18), `Redis`, bucket `twenty-files` (S3, `STORAGE_TYPE=S_3`), cron service `db-backup` (`7730b9b8-c738-4096-8006-b0e2aec1c553`, 02:00 UTC daily `pg_dump` to `db-backups/` in the bucket, 14-day retention, hardened against empty settings).
  - Postgres and Redis have no public TCP proxies.
- **Code running:** `2.49.0+airpal.fe7267804c` (commit `fe7267804c`). GitHub `main` is at `9b0bedc720` (two extra commits: agent skills and a dev compose port change, neither touches the app).
- **How production is deployed:** the image is built by Railway from a source upload, not from GitHub (GitHub Actions are disabled on the fork). From the repo root: `railway up --service server --detach`, wait for SUCCESS, then the same for `worker` (the server runs DB upgrades, so it goes first). Dockerfile: `packages/twenty-docker/twenty/Dockerfile.railway`, generated from upstream's Dockerfile by `node packages/twenty-docker/twenty/generate-railway-dockerfile.js` (upstream's last stage is a dev image and declares a VOLUME that Railway rejects). `.railwayignore` limits the upload. Builds take about 16 minutes each.
- **Auth:** Google login only (`AUTH_PASSWORD_ENABLED=false`), Google OAuth client in GCP project `airpal-pdr` (Audience: Internal, confirmed by owner). `IS_EMAIL_VERIFICATION_REQUIRED=true` (required for approved-domain auto-join). Approved access domain `airpal.co.uk` is validated: anyone with an @airpal.co.uk Google account can join. All three team members are in.
- **Gmail and Calendar sync:** enabled (`MESSAGING_PROVIDER_GMAIL_ENABLED`, `CALENDAR_PROVIDER_GOOGLE_ENABLED`); 3 mailboxes are connected and syncing.
- **Email sending:** `EMAIL_DRIVER=LOGGER` by the owner's choice. Railway Hobby blocks outbound SMTP. SMTP settings for `ming-feng.chen@airpal.co.uk` (smtp.gmail.com:587, app password stored on the server) are staged; switching `EMAIL_DRIVER=SMTP` would only work on Railway Pro. Emails the CRM "sends" (invites, validations) appear in the **worker** logs; find them with `railway logs --service worker <deploymentId> --filter "LoggerDriver"`.
- **Branding:** all Twenty logos and user-facing product name replaced with AirPal CRM (icons, favicon, manifest, emails, AI assistant prompt). Vendor and legal references to Twenty (DPA, billing, marketplace vetting) were deliberately left.
- **Cost:** Railway soft usage alert at $40/month, no hard limit (a hard limit would shut production down). Expected about $25 to $35/month for this project.
- **Not set yet on production** (needed for the cadence app at go-live): `LOGIC_FUNCTION_TYPE=LOCAL` on server and worker.

## 4. Security incident you must know about

On 2026-10-16 a subagent's redaction bug printed production secrets in plain text into the session transcript on this PC (APP_SECRET, ENCRYPTION_KEY, Google client secret, Gmail app password, S3 keys, Postgres and Redis passwords). Nothing was published. Agreed plan with the owner:

- Rotate the **S3 keys** and **APP_SECRET / ENCRYPTION_KEY** at the moment the cadence app goes live (one restart, everyone signs in once). When rotating ENCRYPTION_KEY, set `FALLBACK_ENCRYPTION_KEY` to the old value so stored Gmail tokens stay decryptable.
- The owner will regenerate the Google client secret and revoke the Gmail app password themselves when convenient (the owner said the app password in chat does not bother them).
- Postgres and Redis passwords are not reachable from outside Railway; no action needed.

## 5. Staging (temporary test copy)

- Railway environment `staging` (`70fd82cd-6ae4-4fc5-873a-0b1e754ca6ee`) in the same project, with its **own** Postgres, Redis, bucket `twenty-files-staging`, secrets, no `db-backup`, no Google auth (password login), `LOGIC_FUNCTION_TYPE=LOCAL`, `EMAIL_DRIVER=LOGGER`.
- URL: https://server-staging-8aee.up.railway.app, workspace "AirPal Staging", admin `admin@staging.local`, non-admin test user `rep@staging.local` ("Rita Rep", role Cadence Member).
- **The repo folder is linked to production in the Railway CLI.** Every staging command must pass `--environment staging` (and ideally explicit project/service ids).
- Costs about $1/day. Delete it after go-live: delete the `staging` environment and its bucket.

## 6. The main project: My Day and a configurable cadence

### 6.1 What the owner asked for

A "My Day" in the new CRM where each person sees their own day **and** can see everyone else's, working together with the existing setup; and the outreach **cadence integrated and configurable by the owner inside the CRM** (no need to ask an agent to change rules). Data migration from the old CRM comes **last**, after this.

### 6.2 Approved decisions (do not re-litigate)

Q1 to Q11 (2026-10-16, "yes to all"):

1. My Day is its own page (STANDALONE_PAGE + front component) with per-row buttons.
2. Selector Me / each member / Everyone (grouped by owner). Anyone may act on anyone's rows; touch records who logged it and still counts for the contact.
3. Fully editable steps (add, remove, reorder, new channels); defaults reproduce today's sequence.
4. One cadence now, model allows more later.
5. Only admins edit rules.
6. Saving rules recomputes everyone immediately, with an audit record.
7. Gmail/Calendar create touches automatically (email both ways, meetings); LinkedIn stays manual (owner: "for updates that are not in our vision, like Ilesh's LinkedIn, we update manually, but emails should see all our inboxes"). Each person connects their own Gmail and should share "everything".
8. Keep all old behaviours (Stage/Health/Step, Cold, ladder + drip, 14-day InMail/skip, three strikes + resume, stop order, snooze/hold/dead/opt-out with permanent "asked us to stop" suppression, handover, missing-data rules, no future touches). Not built: Zippy dictation, spread My Day.
9. Undo = delete the touch.
10. `LOGIC_FUNCTION_TYPE=LOCAL` is approved.
11. Airports/accounts wait for the migration.

E1 to E6 (engine behaviour, approved):

- E1 Option A: "Sent InMail" logs an InMail and the sequence moves on to the emails ("Skip to email" too). No repeated InMails.
- E2: no email address means "Add email address" instead of "Skip to email".
- E3: "I replied" while the connection request is pending logs a LinkedIn message.
- E4: drip label counts drip emails sent ("Drip, email 3").
- E5: inbound likes, comments, follows are logged but are not replies.
- E6: deleting a touch does not restore an earlier hand-typed date (accepted).

### 6.3 Decisions still waiting for the owner (ask one at a time, give the recommendation)

| # | Question | Recommendation |
|---|---|---|
| F1 | Keep "They accepted" available whenever the connection request is pending, even after InMail or skip (today it disappears after the row moves to email) | Yes |
| F2 | Unowned contact with no LinkedIn URL: first step is Email 1, not an impossible connection request (differs from old engine) | Yes, keep |
| F3 | Start-fresh handover while a reply is owed: carry the owed reply to the new owner (docs promise this; old code and current engine drop it) | Yes |
| F4 | Use exact times for synced emails so a same-day reply after our email still creates "Reply to them" (touches are day-granular today) | Yes |
| G1 | A meeting is logged when it starts (not at the start of its day) | Yes |
| G2 | A contact who declined the meeting gets no meeting touch | Yes |
| G3 | Our own out-of-office reply to a contact is not logged as outreach | Yes |
| G4 | Run `sync-backfill` to turn past synced emails into touches | Not now; after the data migration, starting from a recent date |
| H1 | Where admin-added channels live. Twenty resets SELECT options on every app deploy, wiping admin-added `touch.channel` options and nulling those touches. Option A: manage the channel list inside the Cadence rules page and store `touch.channel` as text (safe, loses coloured tags in native tables). Option B: keep the SELECT and copy every admin-added option into source before each deploy (fragile) | A |
| S1 | Approve applying the latest build to **staging**: `twenty app apply --remote staging --yes` drops two old staging columns (`cadenceStep.channel` SELECT, `cadence.nonAdvancingChannels` MULTI_SELECT, replaced by text/array fields). The auto-mode classifier blocked it, correctly, pending human approval. Do not work around that block. | Approve |

Also outstanding: the engine treats meetings and stages per the old CRM, but the old docs mention a planned "Meeting scheduled" stage that was never in the database; the engine type has `meetingScheduled` but no Stage option exists. Ask the owner if they want it.

### 6.4 What is built (all on staging only, nothing committed)

Everything is in `packages/twenty-apps/internal/airpal-cadence/` (untracked in git). Read `SPEC.md` (the contract; note §2 is slightly out of date, see below) and `README.md` (build/deploy commands, backend design, UI contracts, sync rules, gotchas).

- **Engine** `src/engine/`: pure, config-driven port of the old engine. 234 tests including a parity test that imports the old engine from `C:\Users\ming_\Desktop\Workk\crm` and compares about 16,000 cases; divergences are allowed only for the approved E-cases and one documented unowned/no-LinkedIn case (F2). Keep the old repo in place or the parity test fails to load.
- **Backend** (`src/objects`, `src/fields`, `src/logic-functions`, `src/data`, `src/utils`, `src/constants`, `src/roles`): objects `touch`, `cadence`, `cadenceStep`, `cadenceChange` (audit), `suppression`; person fields (owner, owner since, stage, health, next action date + override, snooze, revisit, opt-out + reason, resumed at, step, position, state, strikes, due, actions JSON, computed on, last touch on); one recompute routine that writes only when values change (prevents trigger loops); triggers on touch and person changes and on rules changes; hourly cron that acts once per London day; HTTP routes under `/s/cadence/` (log-touch, undo-touch, change-owner, resume, recompute, rules get/preview/save); roles: app role and **Cadence Member** (members read-only on rules). 14 staging scenarios passed.
- **Gmail/Calendar sync** (`src/sync/`, `src/logic-functions/sync/`): classification, auto-reply detection by subject prefixes (Twenty stores no headers), bounce detection, deterministic ids for dedupe and races, calendar touch once a meeting starts, manual `sync-backfill` function. 30 staging checks passed. A production checklist with a real mailbox is in the sync agent's notes in `README.md`.
- **UI** (`src/ui/`, `src/front-components/`, page layout, views, nav items, settings item, command menu items): My Day page (selector, sections Reply to them / Overdue / Due today, buttons from `cadenceActions`, overflow menu, inline forms, Undo tray), Cold view, My Day (table) fallback view, Cadence rules editor (admin edit with mandatory Preview before Save, members read-only, history; also a tab on My Day because members cannot open Settings > Applications), Change owner dialog, person commands Did it / Change owner / Recompute. 20 API-level checks passed on staging.
- **Latest fixes (built and tested locally, NOT yet deployed to staging, waiting for S1):** "Sent InMail" records channel INMAIL (`connectionRequest.inMailChannel`), admin-added channels accepted (live `touch.channel` options; `cadenceStep.channel` and `nonAdvancingChannels` became text/array), `lastTouchOn` field shown on Cold and My Day (table). Whole app: **25 files, 517 tests pass** (`cd packages/twenty-apps/internal/airpal-cadence && npx vitest run`). Typecheck, lint and build are clean.

**SPEC.md §2 needs updating** to the as-built model: `cadenceStep.channel` is TEXT, `cadence.nonAdvancingChannels` is ARRAY, `cadence.inMailChannel` TEXT (default INMAIL), person `lastTouchOn` DATE, `touch.channel` has 11 built-in options. If H1 = A, `touch.channel` also becomes text with a managed channel list.

### 6.5 Nobody has seen the UI in a browser yet

This is the biggest unproven item. The owner must log in to staging in Chrome (the agent may not type passwords into websites). Then either the owner connects the Claude in Chrome extension and you click through and screenshot, or the owner follows the 25-step checklist the UI agent wrote (it is in the UI section of `README.md`; if not, it is reproduced in the UI agent's report summary: selector, sections, Did it + Undo, earlier-date form refusing future dates, Something else, Snooze/Hold/Dead/Opt out with Undo, "asked us to stop" permanence warning, Change owner modes, record commands, Cold and My Day (table) views, rules page read-only for Rita and editable for admin with Preview before Save, validation errors, reset to defaults, conflict handling, dark mode).

## 7. What to do next, in order

1. Ask the owner F1 to H1 and S1 (one at a time). Record answers in `SPEC.md` §1 and in the memory file `my-day-cadence-design.md`.
2. On S1 approval: `twenty app apply --remote staging --yes`, restart staging worker and server (`railway service redeploy --service worker --environment staging -y`, same for server), save the rules once with the active rules as both `rules` and `baseRules`, run `run-fn.mjs daily-recompute '{"force":true}'`, then rerun all staging suites: `scripts/staging-scenarios/scenarios.mjs`, `sync-scenarios.mjs`, `channel-scenarios.mjs`, `node_modules/.bin/vitest run --config scripts/staging-scenarios/vitest.staging.config.mjs`.
3. Implement the answered decisions (engine changes need tests and an updated parity predicate), redeploy to staging, rerun the suites.
4. Browser check with the owner (§6.5). Fix what they find.
5. Go-live, only with the owner's explicit go-ahead:
   - set `LOGIC_FUNCTION_TYPE=LOCAL` on production server and worker;
   - add a `production` remote to the Twenty CLI (needs a production API key created by the owner or with their approval) and `twenty app apply --remote production`;
   - restart worker and server after the schema deploy (stale SDK client gotcha);
   - assign the **Cadence Member** role to Romy and Ilesh (the default Member role can edit rules otherwise); the owner stays Admin;
   - set `cadenceOwner` on contacts as needed (there is no real contact data yet; that arrives with the migration);
   - rotate keys per §4 in the same restart window;
   - run the Gmail production checklist with a real mailbox;
   - verify My Day, Cold and rules on production, then delete staging.
6. Commit the app to git and push (`main`), no attribution lines. Only commit when the owner agrees.
7. Data migration from Supabase (last): Airport/Account objects, contacts, touches, notes; map old schema (`crm` repo `docs/schema-mapping.md`); then switch off `crmoffice` (keep Supabase as the archive; never delete it).

## 8. Backlog (not urgent, owner aware)

- Enable GitHub Actions on the fork (owner clicks "enable" on the Actions tab), then automate deploys.
- WSL2 Ubuntu on the PC if Twenty core code ever needs local builds (native Windows cannot build Twenty: POSIX shell syntax in Nx targets). The app work does not need it.
- A routine for merging upstream Twenty releases (re-run `generate-railway-dockerfile.js`, re-run Lingui extract/compile, expect `.po` conflicts, re-apply branding strings).
- Optional upgrades, owner's call: Railway Pro (real email sending and native volume backups), an off-Railway backup copy.
- Skills: Matt Pocock's engineering skills and an adapted thermo-nuclear code review are installed in `.claude/skills/` and committed. Still queued: porting useful parts of the "pstack" Cursor plugin (a trimmed router with playbooks, create-verification-skill to produce `verify-airpal`, blast-radius, correct, show-me-your-work), with its autonomy and auto-merge rules rewritten to require the owner's confirmation.
- Owner housekeeping: delete the Google client-secret JSON from Downloads.

## 9. Gotchas that cost time

- **Windows:** the Twenty CLI and SDK need workarounds (preload `scripts/windows-posix-relative-paths.cjs`, repo-built 2.49 SDK tarballs in the app's `.local-sdk/`). Exact commands are in the app `README.md`.
- **`railway logs` without a deployment id shows the newest deployment, which may be a build with no logs.** Pass the active deployment id. `-n` returns the oldest lines; use `--filter`.
- Twenty logs about 1,000 lines at boot and Railway drops lines over 500/s.
- After a schema-changing `app apply`, restart worker and server or one keeps a stale SDK client (`type Query does not have a field ...`).
- Logic functions run with the acting user's permissions intersected with the app role. Do not put field-level read-only permissions on engine-written fields; use `isUIEditable: false`.
- A person update by the app fires `person.updated`; only `updatedFields` filtering plus write-only-on-change prevents loops.
- API key rate limit about 100 requests/min, app tokens 500/min; the app paces and retries on 429.
- Twenty SELECT values must be UPPER_SNAKE_CASE; deploys reset SELECT options to source (see H1).
- The front-component sandbox has no modals, popovers, stylesheets or hover; `useUserId` returns the core user id (map to workspaceMember via `userId`).
- Front-component token cannot read roles; admin detection uses object permissions plus a 403 from save.
- The auto-mode classifier blocks production database reads and destructive deploys. Do not work around it; ask the owner.
- Use literal paths with `rm` (the safety check blocks `rm -rf "$VAR/..."`).
