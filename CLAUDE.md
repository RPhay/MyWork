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
npm run lint              # ESLint over src; clean tree = zero findings
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
whichever tab is showing, not as a tab pane. **There is no `#tab-daily`,
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

### The SSO code is scaffolding, and does not run

There IS an Entra ID / SSO subsystem — `routes/api/sso.js`,
`routes/api/contextSso.js`, `services/contextSsoService.js`,
`services/ssoUserService.js`, `auth/entraId.js` — and the routes are registered,
which makes it look like the paragraph above is out of date. It is not.

`ssoUserService.findOrCreateSsoUser()` reads and writes `users.username` and
`users.email`. **This project's `users` table is `(id, name, created_at)`** — see
`mysqlSchema.js`. Every one of those statements fails on an unknown column, so
signing in cannot work and never has. Deliberately left failing rather than
patched into something that half-works: giving SSO a real user record means
deciding what a user IS here, which is the same decision this section defers.

What WAS fixed (2026-08-25) is the storage side, which is independent of that:
`contextSsoService.js` called `connectionPool.query(...)` — an identifier it
never imported — so every read/save/disable of an SSO *config* threw
`ReferenceError`. Those now use the repo's `queryOne`/`update` helpers and work.
The per-identity functions in `ssoUserService.js` (everything except
`findOrCreateSsoUser`) touch only `sso_identities`, which does exist, and were
destructuring `[rows]` mysql2-style when this repo's `query()` returns rows
directly; they are correct now too.

So: config storage works, identity mapping works, **login does not**.

## Credentials

Never paste, print, or otherwise reproduce credential values (`.env.local` contents, `DB_PASSWORD`, API keys, tokens, connection strings, etc.) in conversation or command output. They stay local to the machine/file only, 100% of the time. When verifying or testing credentials, check presence/validity without echoing the value — e.g., attempt the actual connection and report success/failure by exit code, or mask the value if a file's structure needs to be shown.

## Architecture

**Layering**: `routes/api/*.js` → `services/*.js` → `database/connectionPool.js`. Routes only parse the request, call a service function, and shape the JSON response (`{ success, data|message }`); all query logic and validation lives in services. Services throw `ValidationError` / `NotFoundError` / etc. from `src/config/errors.js`, which routes catch and map to `error.statusCode`. Follow this pattern (see `src/routes/api/dailies.js` + `src/services/dailyService.js`) when adding endpoints rather than querying the DB from a route.

**Two separate notions of "database"**: `connectionPool.js` runs MSSQL live,
not just via schema creation; Settings → Database Configuration only swaps the
live pool for MySQL/MariaDB. Full detail: `CLAUDE_REFERENCE.md`.

**The constraint that matters day to day:** every service writes MySQL-flavoured SQL, and anything MSSQL cannot parse is translated in `src/database/mssqlTranslation.js` — nowhere else. That file is a few dozen lines standing between the whole app and a second dialect, so **any MySQL-specific syntax you add to a service must have a rewrite there and a unit test in `tests/unit/mssqlTranslation.test.js`.** Currently covered: `INSERT IGNORE`, `ON DUPLICATE KEY UPDATE` (→ `MERGE`), `NOW()`, `JSON_EXTRACT`, `LIMIT` (→ `OFFSET/FETCH`), and `?` → `@p` placeholders.

**Data model / tab-based frontend**: every editable type is a row in
`entity_types` and its records live in `entities` - Dailies (`daily`),
Projects (`priority`), Categories (`category`), Goals, Todos, Tasks, Tickets,
Ideas, Templates. A slug is the SINGULAR of the label. Tabs render upfront,
switch client-side, no router. Full detail: `CLAUDE_REFERENCE.md`.

**Request pipeline** (`src/app.js`): helmet → session → CSRF → rate limiter →
routes → error handler. Full order: `CLAUDE_REFERENCE.md`.

**Versioning**: `src/utils/version.js` derives a `[yyyy].[mm].[dd].[rev]` version string, persisted to `.version` (tracked in git — see "Bump the version on every change") and bumped via `updateVersion()`; `readVersion()` is what's passed into dashboard/settings views.

## Rows, editors and the focus bar

Behaviour that is easy to undo by accident, because each rule came from a
specific failure — **one click expands a row, two open the editor**; **a
folder's cells are roll-ups**, not controls; **status is one vocabulary for
every type**; **Worked Time is on every type except Templates, and cannot be removed**. Full
list before touching row rendering, the editor, or the focus bar:
`CLAUDE_REFERENCE.md`.

## Recurrence was withdrawn — do not rebuild it from these docs

Todos and tasks once had a recurring schedule that made them appear as work
items in Dailies. **It was withdrawn on 2026-08-19 at the user's instruction**,
and the removal was finished on 2026-08-25: `recurrenceService.js` is deleted,
along with its call sites in `dailyService`, `toDoService` and `entityService`,
the `recurring_from_todo_id` / `recurring_from_task_id` fields on `daily`, and
the two `to_do -> daily` / `task -> daily` relationship rules.

It is written down because the half-removed state was actively misleading. For
seven days the engine was still wired into `dailyService.js` and ran on every
date you opened, querying `to_dos` (0 rows) and `tasks` (a frozen legacy copy)
and finding nothing — while this file still described recurrence as a feature.
Anyone reading the docs would have concluded it was broken and "fixed" it.

If recurrence is ever wanted again it is a NEW design against `entities`, not a
restoration: the `recurrence` field definitions were deleted from Todos and
Tasks, and the audit's suggestion to extend recurrence was explicitly not
followed. The schema files keep `'recurrence'` in the `field_type` and
`relationship_kind` ENUMs — a permitted value nothing uses — because removing
an ENUM member across both dialects costs more than it saves.

**Bug fixes:**
- Fixed `getAllToDos()` query: removed `OR context_id IS NULL` to prevent todos from appearing in wrong contexts after deletion

## Lint is a real signal, so keep it at zero

`npm run lint` reports nothing on a clean tree. That is the whole value of it:
any output is something the change in hand introduced, so it is worth reading
rather than scrolling past. It stayed useless for a long time because no config
was checked in at all — `eslint src` simply errored — and 491 findings had
accumulated behind that by the time one was added.

Two things about `eslint.config.js` that are not obvious and should not be
"tidied up":

**It is code, not data, because `src/public/js/**` are 35 CLASSIC scripts.**
No `import`/`export`, no `<script type="module">` — they share one global
namespace and call each other's top-level functions. ESLint cannot see the load
order (it is in the EJS templates), so every cross-file call reads as undefined:
324 phantom `no-undef`s. The config DERIVES the globals by scanning column-0
declarations in those files, so adding a function does not mean editing a list.
`no-unused-vars` has the same blind spot from the other side — a function called
only from a sibling file or an `onclick=` looks unused — which is why those
files use `vars: 'local'`.

**ESLint must stay on 9+.** espree 9 cannot parse import attributes
(`with { type: 'json' }`), and it does not warn — it silently skips the whole
file. `entityTypeService.js` was never linted once under ESLint 8.

The rule this earns: **a finding is a defect until proven otherwise.** The first
run of the working config turned up `connectionPool` being called in
`contextSsoService.js` with no import (every SSO endpoint threw), a live pool
left pointing at the wrong context's database after a migration, and a
`schema/update` route shadowed by a duplicate it could never beat.
