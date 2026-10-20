# AirPal Cadence — build spec

The contract every part of this app is built against. Decisions here were made with the product owner (Ming-Feng) on 2026-10-16. If something below is ambiguous or wrong, stop and ask; do not improvise a behaviour.

Source of truth for cadence behaviour: the old CRM (`C:/Users/ming_/Desktop/Workk/crm`, docs `how-the-crm-works.md`, `outreach-cadence.md`, `adr/`), as ported into `src/engine/` and amended by §1.

## 1. Decisions

Product (Q1–Q11):

1. My Day is its own page (STANDALONE_PAGE + FRONT_COMPONENT) with per-row buttons.
2. A selector shows Me / each workspace member / Everyone (grouped by owner). Anyone may act on any row; the touch records who logged it (`loggedBy`) and still counts for that contact's sequence (the engine ignores the actor).
3. Steps are fully editable (add, remove, reorder, new channels, repeat counts, gaps and units). Defaults reproduce today's sequence.
4. One cadence now; the model must allow more later (a contact will reference a cadence).
5. Only Admins edit the rules; everyone can read them.
6. Saving rules recomputes every contact immediately and writes an audit record.
7. Gmail and Calendar sync create touches automatically for email both ways and for meetings; LinkedIn stays manual. A manually logged touch and a synced one for the same contact, channel, direction and day count once.
8. All old behaviours stay (Stage/Health/Step, Cold, ladder + drip, 14-day InMail/skip, three strikes + resume, stop order, snooze/hold/dead/opt-out with permanent "asked us to stop" suppression, handover start-fresh/keep, missing-data rules, no future-dated touches). Not built: Zippy dictation, "spread My Day".
9. Undo = delete the touch; the engine recomputes as if it never happened.
10. `LOGIC_FUNCTION_TYPE=LOCAL` on server and worker.
11. Airports/accounts wait for the data migration.

Engine amendments (E1–E6):

- E1. After "Sent InMail" (logs the InMail) or "Skip to email", the sequence moves on to the email steps; no repeated InMail.
- E2. A contact with no email address never gets "Skip to email"; it gets "Add email address" instead. Once an address exists, Skip appears.
- E3. "I replied" while the connection request is still pending logs a LinkedIn message.
- E4. The drip label counts drip touches sent: "Drip, email 1", "Drip, email 2", …
- E5. Inbound follows, comments and likes (`nonAdvancingChannels`, inbound) are logged but are not replies.
- E6. Deleting a touch does not restore an earlier hand-typed next action date (accepted).

Handover decisions approved on 2026-10-17:

- F1. Keep "They accepted" available while a LinkedIn connection request is pending, including after sending InMail or moving on to email.
- F2. An unowned contact with no LinkedIn URL starts at the connection-request step, not Email 1.
- F3. Choosing "Start fresh" during an owner change clears the owed-reply status. Implemented with an exact reset timestamp.
- F4. Use exact synced-email times to determine who replied last. An inbound reply at 2pm after our 9am email on the same day creates "Reply to them".
- Manual timing clarification, approved 2026-10-17: for a manual touch dated on its logging day, use the logging time as its action time. Earlier-date manual entries remain date-only. A manual "I replied" at 4pm clears a 2pm inbound reply, even when merged with an earlier synced email on the same day.
- G1. A calendar meeting counts as a touch only once its start time arrives.
- G2. A contact who declined a calendar meeting receives no meeting touch.
- G3. Our team's automatic out-of-office replies create no outbound outreach touch.
- G4. Defer historical email and meeting backfill until after the old CRM data migration. Agree a recent cutoff date with the owner before running it; no backfill is authorized now.
- H1. Manage custom outreach channels in the Cadence rules page and store `touch.channel` as TEXT, preserving custom values across deployments. The owner accepted losing coloured tags in native tables.
- Add a manually selectable "Meeting scheduled" stage. Booking a meeting does not automatically select this stage.

Verification as of 2026-10-18: F1-F4, G1-G3, H1 and the manual Meeting scheduled stage passed local tests and staging API scenarios. Browser checks passed for admin/member permissions, dark theme, contact actions and Undo, handover modes, record commands, native views, earlier-date validation, custom-channel Preview/Save, rules validation, draft step controls, reset and conflict recovery. Test fixtures were removed and original rules restored. See the Codex continuation in [HANDOVER-ASTRA.md](../../../../HANDOVER-ASTRA.md) for results and evidence limits. Production verification has not been performed; historical backfill remains deferred under G4.

## 2. Data model

SELECT option values are UPPER_SNAKE_CASE in Twenty; `src/constants/` maps them to the engine's camelCase literals. Map in one place only.

### `touch` (custom object)

| Field | Type | Notes |
|---|---|---|
| `name` | TEXT | display label, e.g. "Email 3 of 7 — Aditi Rajvanshi" |
| `person` | MANY_TO_ONE → person | required |
| `channel` | TEXT | Built-ins: LINKEDIN_CONNECTION, LINKEDIN_MESSAGE, INMAIL, EMAIL, CALL, MEETING, FOLLOW, COMMENT, LIKE, PROFILE_VIEW, WHATSAPP. Admins manage additional channels in the Cadence rules page. |
| `direction` | SELECT | OUTBOUND, INBOUND |
| `outcome` | SELECT, nullable | SENT, DELIVERED, REPLIED, IGNORED, BOUNCED, ACCEPTED |
| `occurredOn` | DATE | civil date in the cadence time zone; never in the future |
| `occurredAt` | DATE_TIME, nullable | exact synced event time; used for same-day reply ordering (F4) |
| `legacyChannel` | SELECT, nullable | old channel field retained for the transition; snapshot and copy old values into `channel` |
| `loggedBy` | MANY_TO_ONE → workspaceMember, nullable | null for synced touches |
| `source` | SELECT | MANUAL, GMAIL, CALENDAR |
| `externalId` | TEXT, nullable | message or calendar event id for synced touches (dedupe key) |
| `note` | TEXT, nullable | |

### `person` (standard object) — added fields

| Field | Type | Written by | UI-editable |
|---|---|---|---|
| `cadenceOwner` | MANY_TO_ONE → workspaceMember | people | yes (owner change = handover, §4) |
| `cadenceOwnerSince` | DATE, nullable | engine/handover | no |
| `cadenceReplyResetAt` | DATE_TIME, nullable | start-fresh handover clears earlier reply debt | no |
| `cadenceStage` | SELECT: NOT_CONTACTED, CONTACTED_NO_REPLY, REPLIED_IN_CONVERSATION, MEETING_SCHEDULED, DECK_SENT, DECK_REVIEWED_FOLLOW_UP, PILOT_DISCUSSION, PILOT_AGREED, DEAD | people + engine (§1 Q8 auto moves) | yes |
| `cadenceHealth` | SELECT: ACTIVE, HOLD, DEAD | people | yes |
| `nextActionDate` | DATE, nullable | engine; people may type one (override) | yes |
| `nextActionDateOverride` | DATE, nullable | app (set when a person types `nextActionDate`, cleared per engine rules) | no |
| `snoozeUntil` | DATE, nullable | people | yes |
| `revisitDate` | DATE, nullable | people (Hold) | yes |
| `optedOut` | BOOLEAN | people | yes |
| `optOutReason` | SELECT, nullable: NOT_INTERESTED, WRONG_PERSON, NO_LONGER_THERE, ASKED_US_TO_STOP, OTHER | people | yes |
| `cadenceResumedAt` | DATE, nullable | "Resume cadence" action | no |
| `cadenceStep` | TEXT | engine (`stepLabel`) | no |
| `cadencePosition` | TEXT | engine (`positionLabel`) | no |
| `cadenceState` | SELECT: OPTED_OUT, DEAD, BOUNCED, REPLY_OWED, HOLD, SNOOZED, AWAITING_RESUME, IN_CONVERSATION, RUNNING | engine | no |
| `cadenceStrikes` | NUMBER | engine | no |
| `cadenceDue` | BOOLEAN | engine | no |
| `cadenceActions` | RAW_JSON | engine (`actions` + prescribed touch template), read by My Day | no |
| `cadenceComputedOn` | DATE | engine (the `today` used) | no |
| `lastTouchOn` | DATE, nullable | engine (most recent touch date) | no |
| `touches` | ONE_TO_MANY ← touch.person | | |

"UI-editable: no" means `isUIEditable: false`. Do NOT use field-level read-only role permissions on engine-written fields: the spike proved logic functions run with the acting user's permissions, so that blocks the engine (spike gotcha).

Email presence = person `emails.primaryEmail` non-empty. LinkedIn presence = person `linkedinLink.primaryLinkUrl` non-empty.

### `cadence` (custom object; one record now)

Scalar settings: `name`, `timeZone` (TEXT, default Europe/London), `skipWeekends` (BOOLEAN), `strikeSilenceGapAmount` + `strikeSilenceGapUnit`, `strikeLimit`, `acceptanceTimeoutAmount` + `acceptanceTimeoutUnit`, `nonAdvancingChannels` (ARRAY of channel values), `inMailChannel` (TEXT, default INMAIL), `touchChannels` (RAW_JSON array of `{ value, label }`, managed with the rules), `isDefault` (BOOLEAN). Relation: `steps` ONE_TO_MANY ← `cadenceStep.cadence`.

### `cadenceStep` (custom object)

`cadence` (MANY_TO_ONE), `position` (NUMBER, ordering), `key` (TEXT, stable), `label`, `channel` (TEXT, value from the managed channel list), `repeat` (NUMBER; null = forever), `gapBeforeAmount` (NUMBER), `gapBeforeUnit` (SELECT BUSINESS_DAYS, CALENDAR_DAYS), `occurrenceNoun` (TEXT, forever steps only; default drip value `email` → "Drip, email 3"), `requiredData` (SELECT LINKEDIN_URL, EMAIL, nullable), `whenDataMissing` (SELECT SKIP, BLOCK, nullable), `gate` (SELECT LINKEDIN_ACCEPTED, nullable).

The app seeds the default cadence + steps equal to `DEFAULT_CADENCE_CONFIG` on install if none exists. Loading builds a `CadenceConfig` and runs `validateCadenceConfig`; an invalid stored config must never be used — fall back to the last valid config and surface the error on the rules page.

### `cadenceChange` (custom object, audit)

`changedBy` (→ workspaceMember), `changedAt` (DATE_TIME), `before` (RAW_JSON), `after` (RAW_JSON), `contactsRecomputed` (NUMBER), `contactsWhoseDateChanged` (NUMBER), `summary` (TEXT).

### `suppression` (custom object, permanent)

`email` (TEXT, nullable), `linkedinUrl` (TEXT, nullable), `reason` (TEXT), `createdBy`. Created when `optOutReason` = ASKED_US_TO_STOP. Members cannot update or delete it (role). A person matching a suppression entry (normalised lower-case email or LinkedIn URL) is treated as opted out regardless of later edits.

## 3. Engine wiring (logic functions)

One recompute routine: load person + its non-deleted touches + config + today (civil date in the cadence time zone) → `computeCadence` → write the engine-owned fields **only if any value changed** (prevents event loops). All writes for a person happen in one update.

Triggers:

- `touch.created` / `touch.updated` / `touch.deleted` / `touch.destroyed` / `touch.restored` → recompute that person. On `touch.created` also: apply `stageAfterTouch` (auto stage moves) and clear `nextActionDateOverride`.
- `person.updated` with `updatedFields` limited to people-written inputs: `cadenceOwnerId`, `cadenceStage`, `cadenceHealth`, `snoozeUntil`, `revisitDate`, `optedOut`, `optOutReason`, `nextActionDate`, `emails`, `linkedinLink`. Never list engine-written fields.
  - If `nextActionDate` changed and it differs from the engine's last computed value, it is a hand-typed date: store it in `nextActionDateOverride`.
  - Apply `doesEditMoveSchedule` exactly as the engine documents (snooze/hold/dead move the date; a date typed in the same edit wins).
  - `optOutReason` = ASKED_US_TO_STOP → create a `suppression` entry if none exists.
- `cadence.*` / `cadenceStep.*` changes → validate; if valid, recompute all people and write a `cadenceChange` record.
- Cron, daily at 00:10 Europe/London: recompute everyone (labels and due-ness depend on today: 14-day acceptance timeout, strikes).
- Future-dated touches are refused: My Day/UI never offers a future date; a synced or API-created touch dated after today is ignored by the recompute and logged as a warning.

## 4. Handover

Changing `cadenceOwner` from someone to someone else is a handover. Default when edited in Twenty's native UI: **start fresh** (`cadenceOwnerSince` = today). My Day and the person command menu offer **Change owner…**, which asks Start fresh (default) or Keep position (`cadenceOwnerSince` unchanged). A first assignment (null → someone) is not a handover and leaves `cadenceOwnerSince` null. Start fresh clears the owed-reply status (F3); Keep position preserves it.

## 5. Gmail and Calendar sync → touches

- Trigger on `messageParticipant` changes that set `personId` (as in `twenty-apps/public/last-contact`). For each message linked to a person in the CRM: direction = INBOUND if that person is the FROM participant, OUTBOUND if the FROM participant is an AirPal workspace member's handle. Channel EMAIL, source GMAIL, `externalId` = message id, `occurredOn` = message date in the cadence time zone.
- Out-of-office/auto-replies are not replies: detect via headers or subject patterns available on the message record (e.g. `Auto-Submitted`, "Automatic reply", "Out of office") and skip them. Bounces: a delivery-failure message for an outbound email marks that email touch's outcome BOUNCED if detectable; otherwise leave it.
- Calendar: a calendar event with a person as participant → touch channel MEETING, direction OUTBOUND, source CALENDAR, dated the event day, created only once its start time arrives (G1). Exclude contacts who declined (G2).
- Dedupe: each person + channel + direction + `occurredOn` counts once. Preserve the latest exact synced timestamp for reply ordering, including when a later same-day message updates the surviving touch. The same `externalId` is not recreated; deleting a synced touch remains Undo. Historical touches without exact times retain date-only behavior.
- Messages between AirPal members only, or with people not in the CRM, create nothing.
- Our team's automatic out-of-office replies create no outbound touch (G3).
- As built: exact rules, what is and is not detectable, dedupe and backfill are in README "Gmail and Calendar sync". Historical backfill through `sync-backfill` waits until after the old CRM data migration and requires an agreed recent cutoff date (G4). Each backfilled touch clears a typed next action date (SPEC §3).

## 6. UI

### My Day page

- Selector: Me (default) / each member / Everyone (grouped by owner, owner name as group header; unowned contacts never appear, per the old rules).
- Rows: people where `cadenceDue` is true (next action date ≤ today), split **Overdue** and **Due today**, oldest first; "Reply to them" rows first (they outrank everything).
- Row shows: name (links to the person record), company, Stage · Step, owner (in Everyone/other-member views), next action date, and the buttons from `cadenceActions`: Did it · They accepted · They replied · Sent InMail · Skip to email · I replied · I followed up · Resume cadence · Add email address · Something else; overflow "…": Snooze (date), Hold (revisit date), Dead, Opt out (reason), Change owner…, View.
- "Did it" logs exactly the prescribed touch, dated today, `loggedBy` = viewer. A secondary control allows an earlier date and a note. Future dates are refused.
- No confirmation dialogs; every logged touch shows an "Undo" snackbar that deletes it.
- Empty state and loading state; errors shown, never swallowed.

### Cold

A Person view (sidebar item "Cold"): contacts with no next action date — `nextActionDate` empty AND `cadenceStage` not in (PILOT_AGREED, DEAD), exactly as the old CRM's Cold. Not limited to the viewer. My Day + Cold together cover every live contact.

### Cadence rules (settings tab, workspace scope)

- Shows the current cadence as an ordered step list plus the scalar settings, in plain English ("Email ×7, 3 business days apart").
- Admins: edit, add, remove, reorder steps; edit settings; **Preview** shows how many contacts' next action dates would change before saving; Save runs `validateCadenceConfig` and shows its errors; Reset to defaults (with preview).
- Members: read-only.
- History list from `cadenceChange`.

## 7. Roles

- Admin (workspace Admin role): full access, edits rules.
- Members: a `Cadence Member` role (or the default member role amended by the app) — read/write people and touches, read-only `cadence`, `cadenceStep`, `cadenceChange`; read + create `suppression`, no update/delete.
- The app's function role needs read/write on everything the engine writes and on `cadence*` (so the Admin settings UI can save through the app).

## 8. Rules of work

- Build and test against the **staging** remote only (`https://server-staging-8aee.up.railway.app`). Never apply to production without the product owner's go-ahead.
- Engine changes need tests; keep the parity test, asserting divergence only for approved amendments in §1.
- Follow the repo `CLAUDE.md` style. No secrets in the repo. Do not commit unless told.
