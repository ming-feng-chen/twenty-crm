# Fast Contacts: spreadsheet editing spec

The contract for the Contacts page (`/contacts`, code in `packages/twenty-front/src/modules/fast-contacts/`). Decisions were made with the product owner (Ming-Feng) on 2026-10-25 and 2026-10-26. If something here is ambiguous or wrong, ask; do not improvise.

The page is a Google Sheets-like grid of people. It loads every person at once, scrolls virtually and updates live from server events. Before this work it was read-only.

## 1. Sheets (tabs at the bottom)

| Sheet | Rows |
|---|---|
| All | every person |
| Partner | person's company `group` = PARTNER |
| Airport | person's company `group` = AIRPORT |
| Cold | `nextActionDate` empty AND `cadenceStage` not PILOT_AGREED or DEAD (same rule as the Cold view, cadence SPEC §6) |
| Deleted | deleted contacts, read-only; see §10 |

Each sheet keeps its own search, filters and sort.

## 2. Columns

| Column | Field | Editing |
|---|---|---|
| Name | `name` (first, last) | First and Last boxes; typed or pasted text splits at the first space |
| Company | `company` | searchable dropdown of companies, plus "Create company" when nothing matches |
| Tags | `tags` (personTag records) | tick list of tags, plus "Create tag" when nothing matches; see §8 |
| Job title | `jobTitle` | text |
| Owner | `cadenceOwner` | searchable dropdown of workspace members; handover rules in §5 |
| Stage | `cadenceStage` | dropdown, pipeline order |
| Step | `cadenceStep` | read-only (engine) |
| Next action date | `nextActionDate` | date; a typed date becomes the override, as in a record |
| Last touch | `lastTouchOn` | read-only (engine) |
| LinkedIn | `linkedinLink` | primary link only; secondary links untouched and still shown |
| Email | `emails` | primary email only; additional emails untouched and still shown |
| Connection note | `linkedinConnectionNote` | text |
| Phone | `phones` | primary phone only, typed with its country code (+44 …); additional phones untouched and still shown |
| City | `city` | text |
| Health | `cadenceHealth` | dropdown |
| Snooze until | `snoozeUntil` | date |
| Revisit on | `revisitDate` | date |
| Opted out | `optedOut` | checkbox, Space toggles |
| Opt-out reason | `optOutReason` | dropdown |
| Created on | `createdAt` | read-only |

Read-only cells look muted; typing in them does nothing. The first 12 are shown by default, the rest are hidden until added from Columns.

## 3. Layout, sort and filter

- Saved per user in that browser (local storage), per sheet: column order, hidden columns, frozen columns, sort, filters. Column widths stay shared across sheets.
- Name is always first, always visible, always frozen. Every other column can be moved (drag the header), hidden, or frozen with "Freeze up to here"; "Unfreeze" returns to Name only.
- Header menu (▾ button or right-click): Sort A to Z, Sort Z to A, Filter, Hide column, Freeze up to here, Unfreeze.
- Toolbar "Columns" button: tick boxes to show or hide every column, and "Reset layout".
- Sort: clicking a header cycles A to Z, Z to A, off. One column at a time. Blanks last in both directions. Stage and other dropdowns sort by option order. Off = the default order (position, then id).
- Filters combine across columns (AND) and with search:
  - dropdown, Owner, Company and Tags columns: tick-box list of values including "(Blank)"; on Tags a row matches when it has any ticked tag, and "(Blank)" means no tags;
  - text columns: contains;
  - date columns: before, after, between, is empty;
  - checkbox columns: Yes or No.
- A visible "Filtered" indicator shows how many rows are hidden, with "Clear filters".
- Rows do not jump while editing: after an edit, a row keeps its place and stays visible even if it no longer matches the filters. Order and filters are reapplied when the sort or filters change, the sheet changes, or the page reloads.

## 4. Editing, selection, clipboard, undo

- Typing replaces the active cell; Enter, F2 or double-click edits it. Enter saves and moves down, Tab saves and moves right, Escape cancels.
- Opening a contact: the open arrow shown on hover in the Name cell, or Ctrl+Enter (Cmd+Enter on Mac), opens it in the right-hand panel beside the grid (the full record: fields, touches, notes, tasks, emails, commands). While the panel shows a contact, moving to another row shows that row's contact. Clicking a cell never opens the panel by itself.
- Delete or Backspace clears the selected cells, except Name.
- Invalid values (bad email, unreadable date) are not saved; the cell flashes and a message says why.
- Range selection: drag, Shift+click, Shift+arrows. Ctrl+C copies the range as tab-separated text, without headers.
- Paste: a block fills down and right from the active cell; a single value pasted onto a selected range fills every cell. Dropdown, Owner, Company and Tags values must match an existing option, member, company or tag name (case-insensitive); several tags are separated by commas or semicolons, and copying a Tags cell gives the same form. Paste never creates companies, tags or contacts. Rows beyond the end are ignored. Read-only columns are skipped. Good cells save, bad ones are skipped and listed.
- Row numbers on the far left: click selects a row, Shift+click a range, Ctrl+click adds, the corner selects every shown row. With rows selected the toolbar shows "N selected" and "Change…" for Owner, Stage, Health, Company, Next action date, Snooze until, Revisit on, Opted out, Opt-out reason, plus "Add tag" and "Remove tag" (other tags on each contact are kept). Text columns are bulk-changed by pasting.
- Deleting, importing and merging contacts: §10.
- Ctrl+Z undoes the viewer's own changes from this page visit, one step at a time; a paste or bulk change is one step. It skips any cell a teammate changed since, and says so. Undoing a handover restores the owner but not a reply that Start fresh cleared (accepted).
- No confirmation dialogs except the handover choice in §5 and deleting contacts (§10).
- Concurrent edits: last save wins, as in the rest of the CRM.
- Permissions: whatever the viewer's role allows elsewhere.

## 5. Owner changes

Changing an owner from one member to another is a handover (cadence SPEC §4). The grid asks Start fresh (preselected) or Keep position, once per edit, paste or bulk change, and warns when a contact is owed a reply, like My Day's Change owner. Assigning an owner to an unowned contact, or clearing an owner, asks nothing.

## 6. New contacts

- "+ New contact" adds an empty row at the top with the cursor in Name. The person is created once a name is entered; the cursor then moves to Company.
- Owner defaults to the viewer.
- The new row stays visible until the next refresh even if it does not match the sheet or filters.
- When a typed LinkedIn matches an existing person, a warning names them with a link; saving is still allowed.
- Email is unique in Twenty (the database refuses a second person with the same email), so a duplicate email is skipped with a reason naming the person who has it. Changed from "allowed with a warning" after testing, 2026-10-26.

## 7. Export

"Export" downloads a CSV of the selected rows, or every shown row when none are selected (after sheet, search and filters), with the visible columns in their current order. Dates as YYYY-MM-DD, UTF-8 with BOM so Excel keeps accents. File name: `AirPal contacts - <Sheet> - <YYYY-MM-DD>.csv`. Everyone can export.

## 8. Tags

Decided 2026-10-26. Tags group people by role and live in the Cadence app (`packages/twenty-apps/internal/airpal-cadence`).

- `tag` object (name, colour) and a `personTag` junction, so a person can have many tags. Shown on the person record page, in native People views and in export.
- Starting tags: Partnership & innovation, Marketing & customer, Digital tech, Commercial & retail, Leadership. Seeded once, by post-install on a fresh install or by the hourly cron after an update; never re-seeded after that.
- Everyone can create a tag from the grid ("Create tag"). It goes through `POST /s/cadence/create-tag`, which runs with the app's role, so members never need Data model permission. A name matching an existing tag (ignoring case and spaces) reuses it. Colours are assigned automatically in turn.
- Only Admins rename or delete tags, from "All Tags". Cadence Member has the tag object read-only; tagging people (personTag) is allowed for anyone who can edit people.

## 9. Rollout

Tags and the editable grid went live on 2026-10-26 (image 4d52242589), Cadence app first because the grid asks for `tags`. Decided the same day: Contacts is the one place for contacts. The Cadence app adds a "Contacts" sidebar link (first in Workspace) and no longer adds Cold, Partner contacts or Airport contacts; People is removed from the sidebar. The views stay in the CRM.

## 10. Delete, import, merge

Decided 2026-10-26 (owner: "1 universal space", features chosen by Claude).

- Delete: with rows selected, "Delete" asks "Delete N contacts?" naming them, then soft-deletes them as People does. Ctrl+Z restores them (one step, like an edit). Needs the role's delete right.
- Deleted sheet: the deleted contacts, read-only. With rows selected, "Restore" brings them back; Ctrl+Z undoes a restore. There is no permanent delete.
- Import: "Import" opens Twenty's CSV import (upload, match columns, review), the same as People. Rows whose email already exists update that contact instead of adding a second one. The grid reloads when the import ends. Needs the create right.
- Merge: with 2 or more rows selected, "Merge" opens Twenty's merge screen in the right-hand panel (choose the values to keep). The other contacts are deleted and the merged one opens in the panel; the grid stays. Needs edit and delete rights.
