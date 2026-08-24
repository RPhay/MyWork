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
`.version`; `readVersion()` is what the dashboard and Settings display. The
revision resets when the date rolls over, so several changes on one day give
`.0`, `.1`, `.2`.

Nothing calls `updateVersion()` automatically — it only happens if you run it.
`.version` had sat at `2026.07.28.0` for three weeks because of that, so the
number on screen did not correspond to the code being run. Bump it as part of
making the change, not as a separate step you might forget.

`.version` is tracked in git deliberately, which means it can conflict on
merge between the two development machines. Why, and how to resolve it:
`CLAUDE_REFERENCE.md`.

## Database schema changes must cover every supported database type

Any change to the schema — a new/dropped column, table, index, or constraint — must be made in **both** `src/database/schema/mysqlSchema.js` (canonical) and `src/database/schema/mssqlSchema.js` (T-SQL translation), never just one. Each is idempotent and re-run on every "Fix Schema" / schema-update call, so a new column needs a matching `columnExists()` backfill block in both files (not just the `CREATE TABLE` body), or it will silently never reach installs whose tables predate that column — this is exactly how columns have gone missing on MSSQL after schema work done only against MySQL. `mssqlSchema.js`'s own header comment states this same rule; this entry exists so it isn't missed at the point a change is made in `mysqlSchema.js`.

Foreign keys need care with referential actions (SQL Server rejects some
cascades MySQL allows), and **verify MSSQL by running it, not reading it** — a
T-SQL translation that looked correct in review has shipped four separate
build-stopping faults before. Procedures, machine/database topology, and env
setup: `CLAUDE_REFERENCE.md`.

## The shell: Dailies is a rail, not a page

`dashboard.ejs` renders Dailies once, as a resizable rail down the left of
whichever tab is showing, not as a tab pane. **There is no `#tab-work_item`,
and Dailies cannot be the landing tab.** Full consequences before touching
`dashboard.ejs` or `tabs.js`: `CLAUDE_REFERENCE.md`.

## Testing

All testing guidance — the guard set, commands, the headed-mode requirement,
how to read a run, and the rule that you delete the rows your testing creates —
lives in `CLAUDE_TESTING.md` and is imported here. Do not restate any of it in
this file: two copies is how the guard set came to be listed twice, in two
places, with two different sets of specs.

@CLAUDE_TESTING.md

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

**Two separate notions of "database"**: `connectionPool.js` runs MSSQL live,
not just via schema creation; Settings → Database Configuration only swaps the
live pool for MySQL/MariaDB. Full detail: `CLAUDE_REFERENCE.md`.

**The constraint that matters day to day:** every service writes MySQL-flavoured SQL, and anything MSSQL cannot parse is translated in `src/database/mssqlTranslation.js` — nowhere else. That file is a few dozen lines standing between the whole app and a second dialect, so **any MySQL-specific syntax you add to a service must have a rewrite there and a unit test in `tests/unit/mssqlTranslation.test.js`.** Currently covered: `INSERT IGNORE`, `ON DUPLICATE KEY UPDATE` (→ `MERGE`), `NOW()`, `JSON_EXTRACT`, `LIMIT` (→ `OFFSET/FETCH`), and `?` → `@p` placeholders.

**Data model / tab-based frontend**: core entities are `work_items`,
`priorities`, `goals`, `areas` (priorities/areas self-reference via
`parent_id`); tabs render upfront, switch client-side, no router. Full detail:
`CLAUDE_REFERENCE.md`.

**Request pipeline** (`src/app.js`): helmet → session → CSRF → rate limiter →
routes → error handler. Full order: `CLAUDE_REFERENCE.md`.

**Versioning**: `src/utils/version.js` derives a `[yyyy].[mm].[dd].[rev]` version string, persisted to `.version` (tracked in git — see "Bump the version on every change") and bumped via `updateVersion()`; `readVersion()` is what's passed into dashboard/settings views.

## Rows, editors and the focus bar

Behaviour that is easy to undo by accident, because each rule came from a
specific failure — **one click expands a row, two open the editor**; **a
folder's cells are roll-ups**, not controls; **status is one vocabulary for
every type**; **Worked Time is on every type and cannot be removed**. Full
list before touching row rendering, the editor, or the focus bar:
`CLAUDE_REFERENCE.md`.

## Recurring Todos/Tasks

Todos and tasks can have a recurring schedule that causes them to automatically appear as work items in the Dailies tab; completing one in Dailies generates the next occurrence. Mechanism, JSON schema, `POST` example: `CLAUDE_REFERENCE.md`.

**Bug fixes:**
- Fixed `getAllToDos()` query: removed `OR context_id IS NULL` to prevent todos from appearing in wrong contexts after deletion
