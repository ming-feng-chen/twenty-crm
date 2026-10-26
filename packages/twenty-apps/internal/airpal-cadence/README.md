# AirPal Cadence

Twenty app for AirPal's outreach cadence (contract: `SPEC.md`). A `touch`
object, cadence fields on `person`, the rules in `cadence` + `cadenceStep`, an
audit trail in `cadenceChange` and a permanent `suppression` list. Logic
functions run the pure engine in `src/engine/` (owned separately) whenever an
input changes, once a day, and behind HTTP routes the UI calls. The UI is
described under "UI" below.

## Remotes

| Remote    | Server                                             | Use                          |
| --------- | -------------------------------------------------- | ---------------------------- |
| `staging` | the AirPal staging server (Twenty 2.49, self-hosted) | all spike deploys            |
| —         | `https://crm.airpal.co.uk` (production)            | **never** deploy from here   |

Remotes live in `~/.twenty/config.json` (owner-only). Always pass
`--remote staging` explicitly; do not rely on the default remote.

## Prerequisites

- Node 24.5+, Yarn 4 (`corepack enable`).
- The CLI is the repo's `packages/twenty-cli` (the `twenty-sdk` bundled CLI is
  deprecated in 2.49). Build it once from the repo root:

  ```bash
  cd packages/twenty-cli && npx vite build
  ```

- The app uses the repo's 2.49 SDK packed into `.local-sdk/` (git-ignored;
  2.49 is not on npm yet). Rebuild and pack when the SDK changes:

  ```bash
  # twenty-client-sdk
  cd packages/twenty-client-sdk
  npx rimraf dist && NODE_ENV=production npx vite build \
    && NODE_ENV=production npx vite build -c vite.metadata.config.ts \
    && npx tsgo -p tsconfig.lib.json --declaration --emitDeclarationOnly --noEmit false --outDir dist --rootDir src \
    && npx tsc-alias -p tsconfig.lib.json --outDir dist
  yarn pack --out ../twenty-apps/internal/airpal-cadence/.local-sdk/twenty-client-sdk-2.49.0.tgz

  # twenty-sdk (only the authoring entry points are needed; vite.config.node.ts
  # fails on Windows, see below)
  cd ../twenty-sdk
  for c in define billing front-component logic-function utils browser; do npx vite build -c vite.config.$c.ts; done
  npx tsgo -p tsconfig.lib.json --declaration --emitDeclarationOnly --noEmit false --outDir dist --rootDir src
  npx tsc-alias -p tsconfig.lib.json --outDir dist && npx rimraf dist/sdk
  npx rollup -c <windows copy of rollup.config.sdk-dts.mjs>   # see Windows notes
  yarn pack --out ../twenty-apps/internal/airpal-cadence/.local-sdk/twenty-sdk-2.49.0.tgz
  ```

  Then `yarn install` in this folder.

## Connect, build, deploy (Git Bash on Windows)

```bash
cd packages/twenty-apps/internal/airpal-cadence
TWENTY="node ../../../twenty-cli/dist/cli.cjs"
# Windows only, see notes below
export NODE_OPTIONS="--require \"$(cygpath -m "$PWD/scripts/windows-posix-relative-paths.cjs")\""

# once: save the staging connection (API key read from the environment, never typed)
printf '%s' "$STAGING_API_TOKEN" | $TWENTY auth login --with-token --url "$STAGING_URL" --name staging

$TWENTY app build                                   # local build + typecheck, uploads nothing
$TWENTY app plan  --remote staging                  # preview metadata changes
$TWENTY app apply --remote staging --create         # first deploy (registers + installs)
$TWENTY app apply --remote staging                  # later deploys
$TWENTY app logs  --remote staging                  # stream logic function output
```

`app apply` deletes entities missing from source by default; pass
`--no-delete` when in doubt. Object/field deletions also need `--yes`.

## Windows notes

- `twenty-cli` 2.49 writes manifest and upload paths with backslashes and the
  server rejects them (`Resource path must not contain backslashes`).
  `scripts/windows-posix-relative-paths.cjs` patches `path.relative` and must be
  preloaded through `NODE_OPTIONS` so the build worker gets it too.
- `twenty-sdk`'s `rollup.config.sdk-dts.mjs` treats `C:\...` paths as external,
  so the published `.d.ts` re-export absolute source paths. Use a copy whose
  `external()` also returns `false` for `path.isAbsolute(id)`.
- `twenty-sdk`'s `vite.config.node.ts` (the deprecated bundled CLI) fails on
  Windows in `vite.bundled-source-plugin.ts` for the same reason.
- **Channel storage migration (H1).** Channels are now text values managed in
  the Cadence rules page. Deployments do not reset the saved channel list.
  The previous SELECT is retained as `legacyChannel`; its old options can
  still be reset during this transition. Before the first staging apply,
  snapshot all live and deleted touches, step channels, cadence settings and
  channel metadata with `scripts/staging-scenarios/schema-migration.mjs`.
  Review the plan and get owner approval before applying or restoring.
  Twenty validates creates before renames: rename the old SELECT channel
  separately before planning the final apply, or the new `channel` name is
  rejected. Pause staging use during this short schema transition. If the
  final plan fails, roll the rename back before resuming staging use.
  `rename-legacy-channel.mjs plan --remote staging --snapshot <file>
  --sha256 <hash>` prepares a receipt after checking the snapshot still
  matches staging. Its guarded rename and rollback modes require the receipt
  checksum and explicit confirmation flags. No interim app bundle is needed.
  Restore saved channel values into the new TEXT fields, verify deletion
  states, then save active rules, recompute and run the staging suites.
  Historical backfill remains deferred until after data migration (G4).
- **Stale SDK layer on the worker.** After an apply that changes objects or
  fields, Twenty regenerates the app's typed client and marks it stale once
  for the workspace. The server and the worker each keep their own unpacked
  copy; whichever runs a function first refreshes its copy and clears the
  flag, so the other keeps the old client (`type Query does not have a field
  ...` in the logs). After such an apply, restart the worker (and the server
  if routes fail), or make the first execution happen on the other container.
- `twenty app exec` refuses API-key remotes. `scripts/staging-scenarios/
  run-fn.mjs <name> '<payload>'` runs a function with an admin session
  instead (same `executeOneLogicFunction` mutation).

## Layout

- `src/constants/cadence-values.ts`: the only mapping between Twenty SELECT
  values (UPPER_SNAKE_CASE) and engine literals (camelCase), and the SELECT
  option lists the field definitions use. A touch channel with no built-in
  entry (one an admin added) maps by a reversible naming rule:
  `WHATSAPP_GROUP` <-> `whatsappGroup`; a part that starts with a digit or
  follows a one-letter part keeps its underscore (`CHANNEL_2` <->
  `channel_2`), so every value Twenty accepts has its own key and maps back. `trigger-fields.ts`: the
  `updatedFields` each trigger listens to.
- `src/objects`, `src/fields`: the data model of SPEC §2.
- `src/utils`: pure code, unit-tested in `src/utils/__tests__`: rules and
  engine config (`cadence-rules.ts`), which config the engine runs on
  (`active-config.ts`), person and touches to engine and the write diff
  (`person-cadence.ts`), what an edit means (`edit-decisions.ts`), suppression
  matching (`normalize-identity.ts`).
- `src/data`: API access. `recompute.ts` is the one recompute routine;
  `rules.ts` validates, applies, saves, seeds and previews rules;
  `actions.ts` backs the action routes; `touch-channels.ts` reads the saved
  outreach channel list (below).
- `src/logic-functions`: triggers, the cron, the post-install hook and the
  HTTP routes below.
- `src/sync`, `src/logic-functions/sync`: Gmail and Calendar sync (below).
- `src/roles`: the app role (`default-function.role.ts`) and the assignable
  **Cadence Member** role. Members must be given Cadence Member (or a role at
  least as strict): Twenty's default Member role can edit everything.
- `scripts/staging-scenarios/` (git-ignored): the staging scenario test.

## How the engine is wired

- **One recompute routine** (`recomputePerson`): person, live touches, the
  active rules and today in the cadence time zone go to `computeCadence`; one
  `updatePerson` writes only the fields that changed, or nothing. It re-reads
  the person and touches just before writing and starts over if either moved.
  Every engine write carries `cadenceActions` (with a fresh `writtenAt`),
  which is how `on-person-updated` recognises and skips the engine's own
  writes.
- **Engine writes use the app role's own token** (`runAs: 'application'`), so
  a member's permissions never block the engine. Writes a member asks for in
  a route use the member's token.
- **Touches the engine ignores**: deleted, without channel or date, and dated
  after today (reported in `cadenceActions.ignoredTouches`). A manual touch
  and a Gmail/Calendar touch with the same channel, direction and day count
  once.
- **Triggers**: `touch.*` (create, update of engine inputs, delete, destroy,
  restore) recomputes the person (and the one a touch moved away from); a new
  touch also makes the automatic stage move and ends a typed date.
  `person.created` computes a new person (a date typed on create is a typed
  date). `person.updated` on `PERSON_INPUT_FIELDS` handles handover (a native
  edit is start fresh), a hand-typed next action date (any value other than
  the one the engine last wrote, kept in `nextActionDateOverride`),
  `doesEditMoveSchedule`, and "asked us to stop" (a `suppression` per email
  and LinkedIn URL). `cadence.*` and `cadenceStep.*` on the rule fields
  validate and, if valid, apply the rules.
- **Rules**: the engine runs on `cadence.lastValidRules`, a snapshot in Twenty
  values written only when the stored rules pass validation. Applying writes
  the new snapshot, recomputes everyone, then writes one `cadenceChange`
  (before, after, counts, who, plain-words summary). Invalid stored rules are
  never used; their errors go to `cadence.rulesErrors`. A save holds
  `rulesSaveLockedUntil` while it writes several records, so the triggers
  stand aside and the save applies once.
- **Daily**: `daily-recompute` fires at :10 past every hour (the server runs
  cron in UTC) and recomputes everyone on the first firing of each civil day
  in the cadence time zone: 00:10 London in both GMT and BST. A failed day is
  retried the next hour; `{ "force": true }` re-runs it. Each run also seeds a
  missing cadence and applies stored rules not yet applied.
  `cadenceComputedOn` is the day of the engine's last write to the person (an
  unchanged person is not rewritten just to bump it).
- **Seeding**: `post-install` (and the cron) create the default cadence equal
  to `DEFAULT_CADENCE_CONFIG` only if no cadence exists.
- **Touch channels** (H1): admins add channels and edit their labels on the
  Cadence rules page, through the existing Preview/Save/audit workflow.
  `cadence.touchChannels` stores the list; `lastValidRules` carries the applied
  list so readers do not use a half-finished save. Channel codes are stable;
  built-ins remain available for automatic sync and fixed engine rules.
  `touch.channel` and `cadenceStep.channel` are TEXT,
  `cadence.nonAdvancingChannels` is ARRAY and `cadence.inMailChannel` is TEXT.
  Rules and touch logging reject unlisted channels. If the list cannot be
  read, manual logging accepts only built-ins and reports the problem.
  Removing a custom channel does not erase historical touches; rules still
  referring to it must be changed before the removal can be saved.
- **"Sent InMail"** (E1) logs a touch on `cadence.inMailChannel` (default
  `INMAIL`, shown read-only on the rules page). An outbound touch on that
  channel, dated on or after the first connection request while the request
  is unaccepted, closes the gated LinkedIn steps, so the sequence moves on to
  email; the schedule runs from it, but it consumes no step. A LinkedIn
  message sent while unaccepted still counts as the InMail, for histories
  logged that way. No step may use the InMail channel.
- **`lastTouchOn`** (person, DATE, not UI-editable): the day of the most
  recent touch of any kind (any channel, direction or source, a synced copy
  included) that is not deleted and not dated after today. Written by the
  recompute with the other engine fields, only when it changes; a column on
  Cold and My Day (table).

## Gmail and Calendar sync (SPEC §5)

Code: `src/sync/` (pure rules, unit-tested in `src/sync/__tests__`),
`src/sync/data/` (API access) and `src/logic-functions/sync/`. Synced
touches are created with the app role's token, so `touch.created` reaches
`on-touch-event` and the recompute, stage move and end of a typed date run
exactly as for a manual touch. Synced touches have `loggedBy` null, `outcome`
null (BOUNCED when a bounce is matched) and a name that never repeats the
subject or meeting title (those may be restricted by channel visibility).

### Triggers

- `messageParticipant.updated` on `personId` or `workspaceMemberId`
  (`sync-on-message-participant-linked`). Twenty inserts a synced message's
  participants unlinked and links them to people and members afterwards; the
  whole message is judged each time, so the last link decides and repeats
  change nothing.
- `calendarEventParticipant.updated` on `personId`, `workspaceMemberId`,
  `responseStatus`, and `calendarEvent.updated` on `startsAt`, `isCanceled`,
  `isFullDay` (`sync-on-calendar-participant-linked`,
  `sync-on-calendar-event-changed`).
- `sync-hourly`, cron at :25 every hour (UTC): meetings whose start passed
  since the last check (kv `sync.calendarCheckedThrough`, 2 h overlap, 48 h
  on the first run, 14 days at most) become touches; touches created in the
  last 26 h have their day group settled (a manual "Did it" logged after the
  synced copy).
- `sync-backfill`, run by hand (see Backfill).

### Email rules

For each message, read through its participants (see "What the app can
read"):

1. Skipped: deleted, a draft (`isDraft`), no `receivedAt`, or dated after
   today. The day is the civil date of `receivedAt` in the cadence time zone.
2. Exactly one sender (FROM) is required.
3. From `mailer-daemon@`, `mailerdaemon@`, `mail-daemon@` or `postmaster@`:
   a failure subject makes it a bounce (below); anything else is skipped.
4. AirPal sent it when the sender is linked to a member, or its handle is a
   member's login email (case-insensitive), or a sync association has
   direction OUTGOING (Twenty sets that when the sender is the connected
   account's handle or one of its aliases). Then: OUTBOUND, one touch per CRM
   person among To, Cc and Bcc who is not AirPal (Reply-To is not a
   recipient). No such person: skipped (internal only, or nobody in the CRM).
5. Otherwise INBOUND for the sender, if the sender is a CRM person who is not
   AirPal. A CRM "person" with a no-reply style address (`noreply`,
   `no-reply`, `donotreply`, `bounce…`) is skipped. Copied CRM people get
   nothing: the email is not from them and not from us.
6. An automatic or out-of-office reply (subject test below) is skipped in
   both directions: a member's own out-of-office reply is not outreach.

### Calendar rules

A MEETING / OUTBOUND / CALENDAR touch per CRM person in the event who is not
AirPal and did not decline, dated the event's day (timed: the start's civil
date in the cadence time zone; all-day: its date), created once the meeting
has begun (timed: start ≤ now; all-day: its day ≤ today). Not begun,
cancelled or undated: no touch, and an existing calendar touch for it is
withdrawn (its `externalId` becomes `retired:<event id>`, then it is
deleted; it is restored if the meeting comes back into the past). A meeting
moved to another past day moves its touch. A person who declines loses
theirs. A person merely unlinked from the event (their email edited) keeps
theirs. Touches are never removed because an event record disappeared:
Twenty deletes events both when they are cancelled at Google and when an
account is disconnected, and the two cannot be told apart.

### Dedupe and races

- A synced touch's id is derived from (source, person, external id), so the
  same touch created twice at once (a retry, two participants of one message
  in two jobs, the hourly check and a trigger) collides on the primary key:
  one create wins, the other is counted as `raced`.
- Skipped when that person already has a touch, live or deleted, with this id
  or this external id. Deleted counts: deleting a synced touch is an Undo and
  the sync never brings it back.
- Same person + channel + direction + day: a manual touch without an external
  id is enriched with it (no new touch); any other touch already stands for
  the day. The latest exact synced timestamp is retained for reply ordering
  without increasing the daily cadence count (F4).
- After writing, the run settles every day group it touched: manual touches
  are never deleted; the oldest manual touch stands for the group and every
  synced copy is deleted (it lends its external id, and a BOUNCED outcome,
  first); with only synced touches, the oldest stands. Every run computes the
  same survivor, the oldest touch is never deleted unless a manual one
  outranks it, and of two racing runs the later writer always sees both rows.
- A manual touch logged after the synced copy (the log-touch route does not
  merge) counts once for the engine already (`prepareTouches`), and the
  hourly check merges the two rows within the hour.

### What is and is not detectable

Twenty stores no headers on a message: only subject, text, `receivedAt`,
participants (role, handle, links) and sync associations (direction).

- **Automatic replies.** The strongest signal is applied by Twenty at
  import: with the channel's "exclude group emails" on (the default), an
  incoming message with `Auto-Submitted` (other than `no`), `Precedence:
  bulk/list/junk`, `List-Id` or `List-Unsubscribe` is never imported. Gmail's
  vacation responder and Outlook's automatic replies set `Auto-Submitted`, so
  with that setting most never reach the app. The app adds a subject test:
  the subject must *start* with an automatic-reply prefix ("Automatic reply",
  "Auto-Reply", "Out of office", "OOO", "Abwesenheitsnotiz", "Automatische
  Antwort", "Réponse automatique", "Respuesta automática", "Risposta
  automatica", "Automatisch antwoord", "Autosvar", "Автоматический ответ",
  "自动回复" and about 80 more in `src/sync/automated-mail.ts`). "Re: out of
  office cover" is a person and is kept. Not detectable: an automatic reply
  with an ordinary subject (a Gmail vacation reply whose subject is "Re: …")
  on a channel with "exclude group emails" off.
- **Bounces.** Detected only when all hold: the message is from a
  delivery-status sender, its subject is a permanent failure ("Delivery Status
  Notification (Failure)", "Undeliverable:", "Undelivered Mail Returned to
  Sender", "Mail delivery failed", "Returned mail:", "failure notice", …; never
  "Delay" or "warning"), it is in the same thread as an email AirPal sent, the
  text names the address that email went to (lines quoting the original's
  To/Cc/From are ignored), and the email was sent before the notice. Then the
  latest such email's touch (or the touch standing for that day) gets
  BOUNCED. Likely limits on production: Gmail's notices carry
  `Auto-Submitted: auto-replied`, so with "exclude group emails" on they are
  probably never imported; a notice imported before the email it bounced
  marks nothing.
- **Restricted subjects.** On a channel shared as "metadata" (the default when
  an account connects through onboarding), Twenty replaces the subject and
  text with `FIELD_RESTRICTED_ADDITIONAL_PERMISSIONS_REQUIRED` in root
  `messages` queries. The app reads messages through `messageParticipants
  { message { … } }`, which the visibility hook does not touch, so it sees
  them. If Twenty ever extends the redaction there, the subject test stops
  working; the run then logs a warning ("restricted subject").

### What the app can read

The visibility hooks run on root `messages` and `calendarEvents` queries only:
they drop a record that has no sync association and redact by channel
visibility. Sync associations cannot be written through the API, so on
staging a simulated message is invisible to a root query. Both syncs read
through the participants instead (as `last-contact` does).

### Backfill

New history is synced as it arrives: when an account first connects, Twenty
imports its history and links participants, which fires the trigger, so the
history becomes touches (real contact history), at the import's pace. Each
run creates its touches in one `createTouches` call, so the engine
recomputes each person once per batch; the API client spaces calls and
retries 429s, and a run still rate limited is handed back to Twenty as
retryable (up to 3 times; the whole batch is idempotent).

Mail and meetings imported **before this app was installed** are not synced
automatically. `sync-backfill` does it (payload `{ only?: "gmail" |
"calendar", since?: ISO date-time }`), 100 participants a page, resuming
itself every 8 minutes until done. Before running it on production, note
that every created touch also makes the automatic stage move and **clears a
hand-typed next action date** (`on-touch-event`, SPEC §3), even for an email
from last year. Running it is the product owner's decision.

### Known limits

- A person re-linked from A to B (an email moved between people) keeps A's
  old email touch.
- Two meetings with the same person on the same day: if the surviving touch's
  meeting is later cancelled, the other meeting's (merged) touch is not
  brought back.
- A manual meeting touch enriched with an event id is never moved or
  withdrawn with the event.

## UI

Front components in `src/front-components/` render `src/ui/components/`;
`src/ui/*.ts` is pure, unit-tested logic (labels, dates, the My Day rows,
the rules form).

- **My Day** (sidebar item, a standalone page): two tabs. *Today* lists the
  due contacts (Overdue, Due today, "Reply to them" first) for Me, any
  member or Everyone, with the engine's buttons per row, the overflow menu
  (Snooze, Hold, Dead, Opt out, Change owner…, View), inline forms for an
  earlier date, Something else and Add email address, and an Undo after
  every logged touch. *Cadence rules* is the rules page below. The channel
  pickers list the saved outreach channels.
- **Cadence rules** (Settings > Applications > AirPal Cadence, and the My Day
  tab): the steps and settings in plain English and the change history for
  everyone; admins edit, preview, save and reset to defaults. The rules are
  also a My Day tab because members cannot open Settings > Applications and
  SPEC §1 Q5 says everyone can read them.
- **Admin detection**: saving writes `cadence` and `cadenceStep` with the
  viewer's own permissions, so the page offers editing when the viewer's role
  may update `cadence` and update and soft-delete `cadenceStep` (read from
  the metadata API's `currentUserWorkspace.objectsPermissions`). If that
  cannot be read the page still offers editing and the save route's 403 has
  the last word; the editor then turns read-only.
- **Views**: Cold (no next action date, not Pilot agreed or Dead, any
  owner), My Day (table) (the viewer's due contacts, a native fallback) and
  All Touches.
- **Person commands**: Did it (logs the prescribed step and opens the logged
  touch panel with Undo), Change owner… and Recompute cadence.

## Contracts for the UI

Routes are HTTP-route logic functions at `{TWENTY_API_URL}/s/<path>` with
`Authorization: Bearer <token>`; in a front component, the token the SDK
gives it (`process.env.TWENTY_APP_ACCESS_TOKEN`). They act as the caller, so
the caller's role applies. Every answer is JSON: `{ ok: true, ... }`, or
`{ ok: false, error, ... }` with the HTTP status of the refusal. Actions that
change a person return `person` (its cadence fields) and `recompute`.

### Reading a person (My Day, Cold)

- My Day rows: people with `cadenceDue = true` and the viewer as
  `cadenceOwnerId` (or any owner, for Everyone). Cold: `nextActionDate` empty
  and `cadenceStage` not `PILOT_AGREED` or `DEAD`.
- Show `cadenceStage` and `cadenceStep`. `cadenceActions` (JSON, version 1)
  holds everything a row needs without running the engine: `actions`, the
  buttons in order, each `{ action, touch }` where `touch` is
  `{ channel, direction, outcome }` in Twenty values, or null for
  `resumeCadence`, `addEmailAddress` and `somethingElse`; `overflowActions`
  (`snooze`, `hold`, `markDead`); `state`, `stepLabel`, `positionLabel`,
  `nextActionDate` (the engine's own value), `proposedNextActionDate`,
  `isNextActionDateTyped`, `isDue`, `strikes`, `replyOwedSince`,
  `blockedReason`, `inMailAvailable`, `isLinkedInPosition` (warn on a kept
  handover), `isSuppressed`, `ignoredTouches`, `problems`, `writtenAt`.
- `lastTouchOn` is the day of the person's last touch (see "How the engine
  is wired").
- Action names: `didIt`, `theyAccepted`, `theyReplied`, `sentInMail`,
  `skipToNextStep` ("Skip to email"), `iReplied`, `iFollowedUp`,
  `resumeCadence`, `addEmailAddress`, `somethingElse`.

### Logging a touch: `POST /s/cadence/log-touch`

`{ personId, action?, touch?, occurredOn?, note?, name? }`. Send `action`
for a button: the server logs exactly the touch the engine prescribes for it
now (409 if that action is not offered); `sentInMail` logs the cadence's
InMail channel (`INMAIL`). Send `touch: { channel, direction, outcome? }` for
"Something else": `channel` may be any saved outreach channel,
admin-added ones included (400 otherwise). `occurredOn` defaults to today in the
cadence time zone; a future date is refused (400). The touch is logged as the
caller (`loggedBy`) with `source` MANUAL, and the person is recomputed before
the answer: `{ touchId, recompute, person }`. Creating a `touch` record
directly also works (the trigger recomputes within seconds), but then the UI
must refuse future dates itself.

### Undo: `POST /s/cadence/undo-touch`

`{ touchId }` deletes the touch as the caller and returns the recomputed
person. Deleting the record directly does the same asynchronously. Neither
restores a typed date the touch had cleared (E6) nor reverts an automatic
stage move.

### Change owner: `POST /s/cadence/change-owner`

`{ personId, ownerId: <workspaceMemberId> | null, mode: "START_FRESH" |
"KEEP_POSITION" }`, mode defaulting to START_FRESH. Someone to someone else is
a handover: START_FRESH sets `cadenceOwnerSince` to today and records an
exact `cadenceReplyResetAt` cutoff, clearing earlier reply debt (F3).
KEEP_POSITION leaves both unchanged. A first assignment or an unassignment changes nothing else.
Returns `{ changed, isHandover, mode, warnings, person }`; `warnings` names
an owed reply and, on KEEP_POSITION, a LinkedIn step. Editing the owner field
directly is always START_FRESH.

### Create tag: `POST /s/cadence/create-tag`

`{ name }` creates a contact tag with the next palette colour, or returns the
live tag with the same name (ignoring case and spacing). Returns
`{ tag: { id, name, color }, created }`. It runs with the app's role because
members may not create or rename tags themselves; tagging a contact is a
normal `personTag` create or delete. `post-install` and the hourly cron seed
the five starting tags when the workspace has never had a tag.

### Resume cadence: `POST /s/cadence/resume`

`{ personId }` sets `cadenceResumedAt` to today, only when the engine offers
`resumeCadence` (else 409).

### Snooze, Hold, Dead, Opt out, typed date, Add email address

Plain field edits on the person: `snoozeUntil`; `cadenceHealth` HOLD with
`revisitDate`; `cadenceHealth` or `cadenceStage` DEAD; `optedOut` with
`optOutReason`; `nextActionDate`; `emails`. The `person.updated` trigger does
the rest; `POST /s/cadence/recompute { personId }` returns the recomputed
person straight away.

### Rules page

- `GET /s/cadence/rules` returns `{ cadenceId, storedRules,
  storedRulesErrors, activeRules, activeSource, problems, isSaveInProgress,
  defaults }`. Rules are `{ name, timeZone, skipWeekends,
  strikeSilenceGapAmount, strikeSilenceGapUnit, strikeLimit,
  acceptanceTimeoutAmount, acceptanceTimeoutUnit, nonAdvancingChannels,
  inMailChannel, touchChannels: [{ value, label }], steps: [{ key, label, channel, repeat (null = for ever),
  gapBeforeAmount, gapBeforeUnit, occurrenceNoun, requiredData,
  whenDataMissing, gate }] }` in run order, with Twenty SELECT values
  (channels are `touch.channel` values). Rules without `inMailChannel` (older
  snapshots and audit records) mean `INMAIL`. Show `storedRulesErrors` when
  not empty: the engine is then still on `activeRules`. The answer also has
  `touchChannels` (the saved outreach channel list, `[{ value, label }]` in
  order) or, if they could not be read, `touchChannels: null` and
  `touchChannelsError`.
- `POST /s/cadence/rules/preview { rules }` returns `{ contactsRecomputed,
  contactsWhoseDateChanged, changes: [{ personId, name, ownerId, from, to }]
  }` (first 200), compared with the rules in use. Nothing is written. 422 with
  `errors` if the candidate is invalid.
- `POST /s/cadence/rules/save { rules, baseRules }` validates (422 with
  `errors`), writes the records as the caller (403 for members), recomputes
  everyone and writes one `cadenceChange`: `{ status: "applied" |
  "unchanged", cadenceChangeId, summary, contactsRecomputed,
  contactsWhoseDateChanged, failures }`. Pass the `activeRules` you loaded as
  `baseRules`; if someone saved since, the answer is 409. 423 while another
  save runs. Reset to defaults: preview, then save, `defaults`.
- History: the `cadenceChange` records (`summary`, `changedAt`, `changedBy`,
  `before`, `after`, counts).

