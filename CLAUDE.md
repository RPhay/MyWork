# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Start of session

Check whether `CLAUDE_CARRY_ON.md` exists in the repo root. If it does, it means work was left mid-stream at the end of a prior session — read it, then ask the user whether they want to carry on with what it describes before starting anything else. Don't assume; the user may want to do something unrelated instead.

This existence check and read are pre-authorized: perform them at session start without asking first, notwithstanding the global "no unsolicited actions" instruction. Asking is still required before acting on the file's contents.

## Commands

```bash
npm run dev              # Start dev server with hot reload (nodemon), http://localhost:3000
npm start                # Start production server
npm run db:init          # Create the MySQL database and tables (scripts/initDatabase.js)
npm run lint              # ESLint over src (no .eslintrc is checked in)
npm run format            # Prettier --write src
```

`npm run db:migrate` (scripts/migrate.js) is a placeholder that just logs a message — there is no real migration runner. Schema changes go directly into `src/database/schema/mysqlSchema.js` / `mssqlSchema.js`, and `npm run db:init` re-applies the current schema.

## Bump the version on every change

**Increment the version every time you change anything.** Run:

```bash
npm run version:bump
```

`src/utils/version.js` derives `[yyyy].[mm].[dd].[rev]` and persists it to
`.version` (gitignored); `readVersion()` is what the dashboard and Settings
display. The revision resets when the date rolls over, so several changes on one
day give `.0`, `.1`, `.2`.

Nothing calls `updateVersion()` automatically — it only happens if you run it.
`.version` had sat at `2026.07.28.0` for three weeks because of that, so the
number on screen did not correspond to the code being run. Bump it as part of
making the change, not as a separate step you might forget.

## Database schema changes must cover every supported database type

Any change to the schema — a new/dropped column, table, index, or constraint — must be made in **both** `src/database/schema/mysqlSchema.js` (canonical) and `src/database/schema/mssqlSchema.js` (T-SQL translation), never just one. Each is idempotent and re-run on every "Fix Schema" / schema-update call, so a new column needs a matching `columnExists()` backfill block in both files (not just the `CREATE TABLE` body), or it will silently never reach installs whose tables predate that column — this is exactly how columns have gone missing on MSSQL after schema work done only against MySQL. `mssqlSchema.js`'s own header comment states this same rule; this entry exists so it isn't missed at the point a change is made in `mysqlSchema.js`.

When translating, don't assume a 1:1 mapping of referential actions: SQL Server rejects `ON DELETE CASCADE`/`SET NULL`/`SET DEFAULT` on a foreign key if it would form a cycle or multiple cascade path ("may cause cycles or multiple cascade paths") — MySQL has no such restriction. Where mirroring MySQL's action would hit this, use `ON DELETE NO ACTION` in `mssqlSchema.js` instead (see the `parent_id` self-references and the `to_dos`/`tickets`/`areas` cross-references for precedent) and leave a comment noting the behavioral difference.

Local config: copy `.env.example` to `.env.local` (not `.env`). `CONFIG_ENCRYPTION_KEY` (used to encrypt stored DB credentials in Settings) is optional — if left unset, `src/config/environment.js#getOrCreateConfigEncryptionKey` generates one on first boot and persists it to `data/.config-encryption-key`, mirroring how `SESSION_SECRET` is self-managed. Only set it explicitly for a multi-process/load-balanced deployment, where every process needs the same key. If a stored password ever fails to decrypt ("could not be decrypted... machine"), it means the key changed since that password was saved (e.g. `.env.local` was hand-edited, or the persisted file was deleted) — the fix is to re-enter and save the password, not to recover the old key.

## The shell: Dailies is a rail, not a page

`dashboard.ejs` renders Dailies once, as a resizable rail down the left of
whichever tab is showing - not as a tab pane. Its button in the tab bar carries
`data-rail-toggle` rather than `data-tab`, and `tabs.js` keys off that to show
and hide the rail instead of switching panes.

Consequences worth knowing before touching either file:

- **There is no `#tab-work_item`.** Anything looking for a Dailies *page* will
  find nothing.
- **Dailies cannot be the landing tab.** The default resolves to the first tab
  button that actually exists.
- **Dailies initialises on every page load**, since the rail is always in the
  DOM - not when a tab is opened.
- Rail width, rail open/closed and calendar open/closed are per-browser view
  state in `localStorage`.

## Testing

**All testing guidance lives in `CLAUDE_TESTING.md`** — commands, when to run
what, the headed-mode requirement for editable type pages, how to read a run,
and the rule that you must delete the rows your testing creates. Read it before
running or writing tests; do not duplicate any of it back into this file.

Two things from it that are easy to get wrong and expensive when you do:

- **Clean up test data.** Any run that creates rows must delete them again. The
  database is the user's real working data.
- **Read both numbers.** The Playwright line reporter prints `N failed` *above*
  `N passed`, so a truncated log makes a badly failing run look clean.

## There is no authentication

The app has sessions, CSRF, helmet and rate limiting, which makes it *look*
secured. It has **no authentication of any kind** — no login, no user model, no
auth middleware on any route. Anyone who can reach the port has full read/write
access to every context.

That is a reasonable trade for a single-user app on `localhost`, and it is not a
bug to be fixed in place. It is written down here so that **putting this on a
network is recognised as a change that needs an auth layer first**, rather than
as a deployment detail.

## Credentials

Never paste, print, or otherwise reproduce credential values (`.env.local` contents, `DB_PASSWORD`, API keys, tokens, connection strings, etc.) in conversation or command output. They stay local to the machine/file only, 100% of the time. When verifying or testing credentials, check presence/validity without echoing the value — e.g., attempt the actual connection and report success/failure by exit code, or mask the value if a file's structure needs to be shown.

## Architecture

**Layering**: `routes/api/*.js` → `services/*.js` → `database/connectionPool.js`. Routes only parse the request, call a service function, and shape the JSON response (`{ success, data|message }`); all query logic and validation lives in services. Services throw `ValidationError` / `NotFoundError` / etc. from `src/config/errors.js`, which routes catch and map to `error.statusCode`. Follow this pattern (see `src/routes/api/work.js` + `src/services/workItemService.js`) when adding endpoints rather than querying the DB from a route.

**Two separate notions of "database"**:
- `src/database/connectionPool.js` is the pool the app actually queries against at runtime. It **does** branch on `type === 'mssql'` and build a real `mssql.ConnectionPool` (see `getPool`), so MSSQL is a live runtime target, not just a schema-creation flow. Since `mysql2` speaks the MySQL wire protocol, the MySQL path works against either MySQL or MariaDB with no branching — there is no separate "mariadb" type anywhere in the codebase, and none should be added; `mysqlSchema.js` uses only standard DDL/SQL that both engines support identically.

  **The constraint that follows, and it is the one that matters:** every service writes MySQL-flavoured SQL, and anything MSSQL cannot parse is translated in `src/database/mssqlTranslation.js` — nowhere else. That file is a few dozen lines standing between the whole app and a second dialect, so **any MySQL-specific syntax you add to a service must have a rewrite there and a unit test in `tests/unit/mssqlTranslation.test.js`.** Currently covered: `INSERT IGNORE`, `ON DUPLICATE KEY UPDATE` (→ `MERGE`), `NOW()`, `JSON_EXTRACT`, `LIMIT` (→ `OFFSET/FETCH`), and `?` → `@p` placeholders. This section previously claimed the pool ignored mssql entirely, which is how the generic engine's only field-write path came to emit an un-translated `ON DUPLICATE KEY UPDATE` — MSSQL connected, created its schema, then threw on every single field save.
- `src/services/databaseConfigService.js` (behind Settings → Database Configuration) lets a user test connections and create schema against either MySQL/MariaDB (`type: 'mysql'`) or MSSQL, storing profiles encrypted at `data/db-connections.enc.json` via `src/utils/credentialCrypto.js`. Setting the MySQL/MariaDB profile active (`setActiveType`) tests it, then calls `connectionPool.reconfigure()` to actually swap the live pool — the running app really does start querying that target, no restart needed. MSSQL has no such path: `mssqlSchema.js` exists only for the create-schema flow, and every service (`workItemService.js`, etc.) queries exclusively through `connectionPool.js`'s `mysql2` pool, so setting MSSQL active only records intent.

**Data model**: work items, priorities, goals, and areas are the core entities (`work_items`, `priorities`, `goals`, `areas` tables). Priorities and areas are self-referencing hierarchies (`parent_id`); `src/utils/hierarchyPath.js#buildPathMap` walks that into a flat `id -> "Parent\Child"` path map, used whenever a hierarchical label needs to be shown flat. Work items relate to priorities/goals/areas/sources through join tables (`work_*_associations`); `workItemService.js#attachAssociations` batch-loads and stitches these onto items after every read.

**Tab-based frontend**: `src/views/pages/dashboard.ejs` and `settings.ejs` render all tabs' content into the DOM upfront (`src/views/tabs/*.ejs`); `src/public/js/tabs.js` handles switching between them client-side and syncing the `?tab=` query param, so there's no client-side router. Each tab generally has a matching `src/public/js/<tab>.js` file that owns its fetch calls against `/api/<resource>` and DOM updates.

**Request pipeline** (`src/app.js`): helmet → morgan logging → body parsing → static → session → CSRF (`csurf`, session-based, gated by `CSRF_ENABLED`) → global rate limiter (skips `/health` and `/public`) → CSRF token exposed to views via `res.locals.csrfToken` → centralized error handler that renders `views/error.ejs`, special-casing `ValidationError`/`AppError`/CSRF failures.

**Versioning**: `src/utils/version.js` derives a `[yyyy].[mm].[dd].[rev]` version string, persisted to `.version` (gitignored) and bumped via `updateVersion()`; `readVersion()` is what's passed into dashboard/settings views.

## Recurring Todos/Tasks

Todos and tasks can have a recurring schedule that causes them to automatically appear as work items in the Dailies tab. When a recurring item is marked complete in Dailies, the next occurrence is automatically generated.

**How it works:**
- Store recurrence pattern as JSON in `to_dos.recurrence` or `tasks.recurrence` columns
- When fetching work items for a date, `recurrenceService.generateWorkItemsForDate()` checks all recurring todos/tasks and creates work items for those due on that date
- When a work item linked to a recurring source is marked "Complete", `generateNextRecurrenceForCompletedItem()` creates the next occurrence
- Work items track their source via `recurring_from_todo_id` or `recurring_from_task_id`

**Recurrence JSON format:**
```javascript
{
  enabled: true,
  type: "daily" | "weekly" | "monthly" | "interval",
  startDate: "2026-08-11",           // Optional, default today
  endDate: "2026-12-31",              // Optional, no end if omitted
  maxOccurrences: 10,                 // Optional, no limit if omitted
  
  // For weekly:
  daysOfWeek: [0, 2, 4],              // 0=Sunday, 6=Saturday
  
  // For monthly:
  dateOfMonth: 15,                    // Specific date (1-31)
  // OR
  weekday: 3,                         // 0=Sunday
  weekOfMonth: 2,                     // 1=first, 2=second, etc
  // OR
  lastDay: true,                      // Last day of month
  
  // For interval:
  intervalDays: 3                     // Repeat every N days
}
```

**API**: POST/PUT to `/api/to-dos` and `/api/tasks` with `recurrence` field:
```javascript
POST /api/to-dos
{
  "title": "Daily standup",
  "recurrence": {
    "enabled": true,
    "type": "weekly",
    "daysOfWeek": [1, 2, 3, 4, 5],  // Mon-Fri
    "startDate": "2026-08-11"
  }
}
```

**Bug fixes:**
- Fixed `getAllToDos()` query: removed `OR context_id IS NULL` to prevent todos from appearing in wrong contexts after deletion
