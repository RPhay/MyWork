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

## NOTHING EVER FALLS BACK TO `dbo`. EVER.

Every table, on **every** engine, lives in the `MyWork` schema/database and is
addressed there explicitly. On SQL Server that means `[MyWork].[thing]` in
every statement, without exception.

**This is not a style preference. An unqualified name does not fail - it
resolves against the login's default schema and silently succeeds somewhere
else.** So a statement that writes `dbo.entities` and another that reads
`[MyWork].entities` both "work", and the symptom is a row that saves, reports
success, and is never seen again. Nothing in the app reports it, no error is
logged, and no test catches it, because from SQL Server's point of view
nothing went wrong.

Three rules, all of them load-bearing:

- **Every pool qualifies.** `connectionPool.js` and `homePool.js` both run
  MSSQL, and both must pass every statement through
  `qualifyTablesForMssql()`. `homePool.js` did NOT until 2026-08-27, which
  meant every read and write of `users`, `contexts`, `context_folders`,
  `context_tab_settings` and `user_identities` went out unqualified. It
  appeared to work only because the login's default schema happened to be
  right - luck, not design.
- **A missing table list is a FAILURE, not a fallback.** If the `[MyWork]`
  table list cannot be read, qualification is impossible, and continuing
  means every statement in the process silently addresses `dbo`. It throws
  instead. Empty-set-so-qualify-nothing is how this stayed invisible.
- **The check is enforced, not trusted.** `assertNoUnqualifiedTables()` runs
  after the rewrites and throws if any known table name still appears
  unqualified. A rewrite that misses a case must break loudly the first time
  it runs, rather than writing to `dbo` for a month.

If you add a rewrite to `mssqlTranslation.js`, it runs BEFORE qualification,
and the qualifier sees its output - a rewrite that introduces a new table
reference (the upsert becomes a `MERGE` naming its target) must therefore be
qualifiable, and there is a unit test for exactly that.

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

## Profiles are a view, not a login

`activeUserService.js` decides who is using MyWork. Pick a user, see that
user's contexts and everything inside them; switch, and see somebody else's.
**There is no password and no attempt to look like there is one** - anyone can
become anyone. It separates *whose work is on screen*, not *who is allowed to
look*, which is why the section below still stands unchanged. Do not "finish"
it by adding a password box: that is real authentication and a different
decision (see `CLAUDE_CARRY_ON.md`).

**Why it is cheap: a context already IS a separate database.** Isolation is not
a `WHERE user_id = ?` on 131 query sites, it is which database the connection
points at. `contexts.user_id` records the owner, and `getActiveContextId()`
only resolves a context that the current user owns.

**The chosen user is SERVER-WIDE** (`data/active-user.json`), mirroring the
active context beside it, and this is load-bearing rather than lazy. The app
holds ONE pool and swaps it on context change, so a per-SESSION user would let
two browsers want two databases at the same instant and the pool would be wrong
for one of them. One server-wide value makes that unreachable. The cost, which
is not a bug to be fixed: **two tabs cannot be two users.**

Three rules that each came from getting it wrong:

- **Filter at the ROUTE, not inside `getAllContexts()`.** That function has a
  caller which must keep seeing every context - `schemaMigrationService` walks
  all of them to apply a schema change, and a silently user-filtered list there
  would skip databases and report success. `getContextsForUser()` is the opt-in.
- **Filtering the list is not enough.** `setActiveContextId()` refuses a context
  whose owner is not the current user. Without that the picker is decorative:
  the list is filtered, but the endpoint still accepts any id typed or
  remembered from before a switch.
- **A profile owning no contexts is redirected off the dashboard.** Rendering it
  anyway does not degrade, it hangs: every tab fires a fetch, each resolves the
  active context, each throws, and the page never finishes loading.

Per-profile too: the focus bar's monitors (keyed inside the existing file, so no
existing setup is lost) and browser view state, which is CLEARED on a change of
user rather than namespaced - many of the 39 `localStorage` keys are computed,
so a prefix scheme half-lands the moment one is missed, and a missed one looks
like a preference rather than a bug. The status digest schedule is deliberately
still global.

**The suite needs a profile chosen before it runs** - `tests/e2e/global-setup.js`
does it, and validates the stored id against the database rather than trusting
the file. Without it the picker's static backdrop blocks every spec, and only on
a clean checkout, which is where the failure is least explicable.

## Authentication is OFF by default and ON by machine

The app ships with **no authentication** — no login, no auth middleware doing
anything, and anyone who can reach the port has full read/write access to every
context. That is still true on any install that has not opted in, and it is
still the right trade for a single-user app on `localhost`.

What changed on 2026-08-27 is that opting IN is now possible, per machine,
without the two machines needing different code. **`SSO_MODE` in `.env.local`**
decides:

| value | effect |
|---|---|
| `off` | **Default.** No login, no gate. Byte-for-byte the old behaviour. |
| `on` | Entra ID sign-in required before any page or API call. |
| `auto` | Probe whether the tenant answers; enable if it does, else `off`. |

`.env.local` is the switch because it is **gitignored and per-machine** — the
same seam that already lets one machine run MySQL and the other MSSQL — so the
home checkout and the work checkout disagree without ever conflicting on merge
the way `.version` does.

**Three states, not a boolean, and this is the load-bearing part.** A boolean
cannot distinguish *off because I am at home* from *off because it is broken*,
and that ambiguity is exactly how the previous SSO subsystem sat looking like a
working feature for months while being unreachable. So every resolution carries
a `reason`, and `GET /auth/status` reports it. If SSO ever appears not to be
working, read that endpoint before reading any code.

Three rules that the implementation depends on:

- **`off` must be a total no-op.** The gate in `app.js` returns `next()` before
  touching anything, and `/auth/*` returns 404 rather than rendering a sign-in
  page. A login page reachable on the home machine is a page someone will
  eventually be stuck on.
- **The gate fails OPEN.** If `resolveSsoState()` throws, the request continues
  unauthenticated. That is the correct direction *here*: the alternative is
  bricking a local single-user app that had no authentication yesterday. It
  would be the wrong direction on a public network, and that is the line to
  reconsider before this is ever exposed.
- **`on` with missing credentials does not enable.** It reports
  `misconfigured: true` and names the absent variables. Half-configured SSO
  redirects to an authorize URL built from `undefined`, which locks you out of
  your own app.

### Signing in SELECTS a profile; it does not invent a user

`users` is still `(id, name, created_at)` and is **not** extended. An Entra
identity is a row in **`user_identities`** (`provider`, `subject`, `email`,
`display_name`) pointing at a `users` row.

This is the whole lesson of the SSO subsystem that was deleted on 2026-08-26:
`findOrCreateSsoUser()` wrote `users.username` and `users.email` against a table
with neither column, so every login threw on an unknown column. Given a second
notion of "user", the two drift; given one, signing in is just an authenticated
way to choose a Profile, which is what Profiles already were.

Resolution order on callback, and step 2 is the one that matters:

1. An existing `user_identities` row for that Entra subject — the normal path.
2. **A profile whose `name` matches the Entra display name** — adopts the
   profile you already use. Without it, the first work-machine login creates a
   *second* profile and lands you in an empty app with every context still
   owned by the old one.
3. Failing both, a new profile named after the display name.

Sign-in then calls `setActiveUserId()`, because **the active profile is
server-wide** (`data/active-user.json`) for the pool reason in the Profiles
section above. A per-session user would reintroduce exactly the two-browsers-
two-databases race that one server-wide value makes unreachable. The documented
cost stands unchanged: **two tabs cannot be two users**, signed in or not.

The table is **not** named `sso_identities`. That name is in `RETIRED_TABLES`,
and reusing it would leave one name meaning both "dropped, unread" and "live".

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
every type that has one** - Ideas is the exception, running
Raw/Developing/Ready, and Categories have no status at all; **Worked Time is on every type except Templates, and cannot be removed**. Full
list before touching row rendering, the editor, or the focus bar:
`CLAUDE_REFERENCE.md`.

## Read-only types, and what may hold a Template

Three types cannot be edited in Settings. **One predicate decides it** -
`type_category` set to anything other than `'editable'` - and both the editor
(`entity-type-editor.js`, which disables every control and adds a note) and the
Settings lists (`settings-entity-types.js`, which splits them into two lists)
read that same rule. Do not add a second test.

- **Outlook Calendar** and **Azure DevOps Work Items** (`type_category:
  'external'`) mirror a shape another system owns. Editing them here would only
  let the two disagree. `canBeRelated()` also keeps `'external'` types out of
  the hand-authored parent/child lists.
- **Templates** (`type_category: 'template'`) must stay in step with Dailies,
  because dropping a template on a day produces a **daily** carrying whatever
  the template held - so a property added to one and not the other is a property
  lost in the transfer.

Templates does not have to be kept in step by hand: saving Dailies calls
`syncTemplateFieldsFromDaily()` in `entityTypeService.js`, which is the moment
the two would otherwise drift. **Add a field to Dailies and Templates gets it.**

Read-only describes editing the **type**. Template ROWS are created, edited and
deleted as normal on the Templates rail.

**Nothing may hold a Template.** No type declares `template` as a hierarchy
child, and `SELF_NESTING_SLUGS` excludes it by name so the
every-hierarchical-type rule cannot hand it one back. A template is dragged onto
Dailies and becomes a new daily; it is never filed underneath something.
**Azure DevOps Work Items are the exact opposite** - they go under every type,
because the point of dropping one is to say "this ADO item belongs to that goal
/ project / day".

## Retiring a table is not the same as dropping it

`src/database/retiredTables.js` is the ONE list of tables the app no longer
reads, imported by both schema files and by `retiredTablesService.js`. It lived
in three places before, which is exactly how such lists come to disagree with
the schema they describe.

A table earns its place there by being **migrated and unread**: its rows exist
as entities, and nothing in `src/` queries it. Settings -> **Drop Retired
Tables** then drops it without a full schema run - but `inspectRetiredTables()`
**refuses any table holding rows with no matching entity**, and that refusal is
the guard working. Do not force it; migrate the rows first.

That refusal is how the MSSQL install's unmigrated rows were found, and
**`scripts/migrate-legacy-to-entities.js` is the one migration script that runs
on either engine** - every `scripts/phaseN-migrate-*.js` is MySQL-only. Dry run
by default; `--apply` writes. Why it exists and what it does differently:
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
