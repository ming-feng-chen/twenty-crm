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

Each sheet keeps its own search, filters and sort.

## 2. Columns

| Column | Field | Editing |
|---|---|---|
| Name | `name` (first, last) | First and Last boxes; typed or pasted text splits at the first space |
| Company | `company` | searchable dropdown of companies, plus "Create company" when nothing matches |
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

Read-only cells look muted; typing in them does nothing. The first 11 are shown by default, the rest are hidden until added from Columns.

## 3. Layout, sort and filter

- Saved per user in that browser (local storage), per sheet: column order, hidden columns, frozen columns, sort, filters. Column widths stay shared across sheets.
- Name is always first, always visible, always frozen. Every other column can be moved (drag the header), hidden, or frozen with "Freeze up to here"; "Unfreeze" returns to Name only.
- Header menu (▾ button or right-click): Sort A to Z, Sort Z to A, Filter, Hide column, Freeze up to here, Unfreeze.
- Toolbar "Columns" button: tick boxes to show or hide every column, and "Reset layout".
- Sort: clicking a header cycles A to Z, Z to A, off. One column at a time. Blanks last in both directions. Stage and other dropdowns sort by option order. Off = the default order (position, then id).
- Filters combine across columns (AND) and with search:
  - dropdown, Owner and Company columns: tick-box list of values including "(Blank)";
  - text columns: contains;
  - date columns: before, after, between, is empty;
  - checkbox columns: Yes or No.
- A visible "Filtered" indicator shows how many rows are hidden, with "Clear filters".
- Rows do not jump while editing: after an edit, a row keeps its place and stays visible even if it no longer matches the filters. Order and filters are reapplied when the sort or filters change, the sheet changes, or the page reloads.

## 4. Editing, selection, clipboard, undo

- Typing replaces the active cell; Enter, F2 or double-click edits it. Enter saves and moves down, Tab saves and moves right, Escape cancels.
- Opening a contact: the open arrow shown on hover in the Name cell, or Ctrl+Enter (Cmd+Enter on Mac).
- Delete or Backspace clears the selected cells, except Name.
- Invalid values (bad email, unreadable date) are not saved; the cell flashes and a message says why.
- Range selection: drag, Shift+click, Shift+arrows. Ctrl+C copies the range as tab-separated text, without headers.
- Paste: a block fills down and right from the active cell; a single value pasted onto a selected range fills every cell. Dropdown, Owner and Company values must match an existing option, member or company name (case-insensitive). Paste never creates companies or contacts. Rows beyond the end are ignored. Read-only columns are skipped. Good cells save, bad ones are skipped and listed.
- Row numbers on the far left: click selects a row, Shift+click a range, Ctrl+click adds, the corner selects every shown row. With rows selected the toolbar shows "N selected" and "Change…" for Owner, Stage, Health, Company, Next action date, Snooze until, Revisit on, Opted out, Opt-out reason. Text columns are bulk-changed by pasting.
- No delete-contact action in the grid.
- Ctrl+Z undoes the viewer's own changes from this page visit, one step at a time; a paste or bulk change is one step. It skips any cell a teammate changed since, and says so. Undoing a handover restores the owner but not a reply that Start fresh cleared (accepted).
- No confirmation dialogs except the handover choice in §5.
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

## 8. Rollout

Not yet deployed (2026-10-26). Built and tested locally, then tried on staging before production. Once the team uses Contacts, the owner adds a "Contacts" link to the sidebar and removes Partner contacts, Airport contacts and Cold from it; see `AIRPAL-BACKLOG.md`.
