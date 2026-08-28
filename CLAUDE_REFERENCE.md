# CLAUDE_REFERENCE.md

On-demand detail split out of `CLAUDE.md` by `claude-md-audit --split` on
2026-08-23, because `CLAUDE.md` was flagged as an oversized node (18,316 B,
over the 8,000 B threshold in `graph.py`). Nothing here is `@`-imported —
that would just reload it every turn and undo the point of moving it. Read
the relevant section below when the task it names comes up; otherwise it
costs nothing.

## Version tracking: why `.version` is committed, and merge conflicts

From "Bump the version on every change" in `CLAUDE.md`.

**`.version` is tracked in git, deliberately.** This file claimed it was
gitignored until 2026-08-21; `.gitignore` has never contained an entry for it,
and the decision on that date was to keep it tracked so the committed version
always names the code in that commit.

The cost of that choice: every bump is a committed change, and the two
development machines are separate checkouts, so both will edit the same line and
**conflict on merge**. Resolve it by taking either side and re-running
`npm run version:bump` — the value is derived, so no information is lost. Do not
"fix" the conflicts by gitignoring the file; that has been decided against.

## Database schema: foreign key referential actions

From "Database schema changes must cover every supported database type" in
`CLAUDE.md`. Read when adding or changing a foreign key.

When translating, don't assume a 1:1 mapping of referential actions: SQL Server rejects `ON DELETE CASCADE`/`SET NULL`/`SET DEFAULT` on a foreign key if it would form a cycle or multiple cascade path ("may cause cycles or multiple cascade paths") — MySQL has no such restriction. Where mirroring MySQL's action would hit this, use `ON DELETE NO ACTION` in `mssqlSchema.js` instead (see the `parent_id` self-references for precedent) and leave a comment noting the behavioral difference.

## Verifying MSSQL: run it, do not read it

From "Database schema changes must cover every supported database type" in
`CLAUDE.md`. Read before or while verifying a schema change against MSSQL.

`mssqlSchema.js` accumulated four separate build-stopping faults while looking
correct in review, because it was dual-maintained by editing and never once
executed end to end: MySQL-only DDL, a backfill placed 950 lines above the
`CREATE TABLE` it altered, six calls to a `columnExistsAsync()` that does not
exist, and two cascading FKs SQL Server rejects. Each one hid the next. **The
dual-schema rule above asks for the change to be MADE in both files; it does
not, on its own, mean the T-SQL parses.** Run it:

```bash
docker run -d --name mssql-probe -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD='<pw>' \
  -e MSSQL_PID=Developer -p 14333:1433 mcr.microsoft.com/mssql/server:2022-latest
```

Then build the schema into a scratch database with `createMssqlSchema(pool)`,
and compare the resulting `INFORMATION_SCHEMA.COLUMNS` against a fresh
`createMysqlSchema()` build. At the time of writing that comparison is clean:
**30 tables on both, no table or column drift.** Anything else is drift to fix
before shipping.

Two things that test will only reveal if it is set up like the real thing:

- **Never connect as `dbo`/`sa`.** Every object lives in the `[MyWork]` schema,
  and the app's runtime SQL is unqualified (`SELECT * FROM entities`), which
  resolves against the caller's `DEFAULT_SCHEMA` and then `dbo` — never
  `[MyWork]`. `createMssqlSchema` sets `DEFAULT_SCHEMA = [MyWork]` on the
  connecting user, but **`dbo` cannot be altered** (error 15150). Connect as a
  dedicated login and it works; connect as `sa` and you build a perfect schema
  that every query then fails to see with "Invalid object name".
- **TLS defaults target Azure SQL** (`encrypt: true`,
  `trustServerCertificate: false`). An on-prem server with a self-signed or
  internal-CA certificate needs `DB_MSSQL_ENCRYPT` / `DB_MSSQL_TRUST_SERVER_CERT`
  (see `.env.example`). Only relax the second on a network you trust.

## Which database each machine actually talks to

From "Database schema changes must cover every supported database type" in
`CLAUDE.md`. Read when reasoning about whether a schema/data change reaches
both databases, or before running the guard set on a specific machine.

There are three machines, two databases, and it is not one-per-machine:

- **Both development machines point at the same MySQL database.** They are two
  working copies over one shared dataset, not two independent installs. So a
  schema change applied by hand on one machine is *already applied* for the
  other, and a `DROP` run from either is gone for both — there is no second
  MySQL copy to fall back on. Conversely, if a table still exists after a commit
  claims to have dropped it, the drop did not run, rather than "it ran somewhere
  else".
- **The work machine points at MSSQL**, and is used for manual testing, with
  little to no active development happening on it.

Two consequences worth holding onto:

1. **MSSQL is exercised by hand, on a different machine, on the user's
   schedule** — so a break in the T-SQL path is found late and away from the
   code that caused it. This is the practical reason the dual-schema rule above
   is strict: there is no MSSQL run in the dev loop to catch drift.
2. **The two databases drift independently.** `db:init` only *creates*, never
   drops, so a table removed from `mysqlSchema.js`/`mssqlSchema.js` keeps
   existing on any database that already had it. Code referencing a
   "retired" table can therefore keep working on MySQL while failing on MSSQL,
   or vice versa. **Check the live database before trusting the schema files to
   describe it.**

Local config: copy `.env.example` to `.env.local` (not `.env`). `CONFIG_ENCRYPTION_KEY` (used to encrypt stored DB credentials in Settings) is optional — if left unset, `src/config/environment.js#getOrCreateConfigEncryptionKey` generates one on first boot and persists it to `data/.config-encryption-key`, mirroring how `SESSION_SECRET` is self-managed. Only set it explicitly for a multi-process/load-balanced deployment, where every process needs the same key. If a stored password ever fails to decrypt ("could not be decrypted... machine"), it means the key changed since that password was saved (e.g. `.env.local` was hand-edited, or the persisted file was deleted) — the fix is to re-enter and save the password, not to recover the old key.

## Architecture: MySQL/MariaDB pool detail and Database Configuration (Settings)

From "Architecture" → `Two separate notions of "database"` in `CLAUDE.md`.
Read when touching `connectionPool.js`'s type branching, or the Settings →
Database Configuration flow (`databaseConfigService.js`).

- `src/database/connectionPool.js` is the pool the app actually queries against at runtime. It **does** branch on `type === 'mssql'` and build a real `mssql.ConnectionPool` (see `getPool`), so MSSQL is a live runtime target, not just a schema-creation flow. Since `mysql2` speaks the MySQL wire protocol, the MySQL path works against either MySQL or MariaDB with no branching — there is no separate "mariadb" type anywhere in the codebase, and none should be added; `mysqlSchema.js` uses only standard DDL/SQL that both engines support identically.
- `src/services/databaseConfigService.js` (behind Settings → Database Configuration) lets a user test connections and create schema against either MySQL/MariaDB (`type: 'mysql'`) or MSSQL, storing profiles encrypted at `data/db-connections.enc.json` via `src/utils/credentialCrypto.js`. Setting the MySQL/MariaDB profile active (`setActiveType`) tests it, then calls `connectionPool.reconfigure()` to actually swap the live pool — the running app really does start querying that target, no restart needed. MSSQL has no such path: `mssqlSchema.js` exists only for the create-schema flow, and every service (`dailyService.js`, etc.) queries exclusively through `connectionPool.js`'s `mysql2` pool, so setting MSSQL active only records intent.

**History, for context, not action:** the "constraint that follows" note in
`CLAUDE.md`'s Architecture section previously claimed the pool ignored mssql
entirely, which is how the generic engine's only field-write path came to emit
an un-translated `ON DUPLICATE KEY UPDATE` — MSSQL connected, created its
schema, then threw on every single field save.

## Architecture: data model and tab-based frontend

From "Architecture" in `CLAUDE.md`. Read when touching the core entity tables
or join tables, or the tab-switching frontend.

**Data model**: every editable type is a row in `entity_types`, and every record of every type is a row in `entities` with its values in `entity_field_values` and its nesting in `entity_relationships`. The per-type tables this file used to describe (`work_items`, `areas`, `goals`, `ideas`, `to_dos`, `tasks`, `tickets`) are gone. `priorities` is the last legacy table still standing, bridged to entities by `priority_areas`/`priority_goals`. `src/utils/hierarchyPath.js#buildPathMap` walks a `parent_id` list into a flat `id -> "Parent\Child"` path map, used whenever a hierarchical label needs to be shown flat. A day links to a row of ANY type through the single `work_entity_associations` junction; `dailyService.js#attachAssociations` batch-loads and stitches these onto items after every read.

**Tab-based frontend**: `src/views/pages/dashboard.ejs` and `settings.ejs` render all tabs' content into the DOM upfront (`src/views/tabs/*.ejs`); `src/public/js/tabs.js` handles switching between them client-side and syncing the `?tab=` query param, so there's no client-side router. Each tab generally has a matching `src/public/js/<tab>.js` file that owns its fetch calls against `/api/<resource>` and DOM updates.

## Architecture: request pipeline detail

From "Architecture" in `CLAUDE.md`. Read when adding or reordering
middleware in `src/app.js`, or debugging why a request behaves unexpectedly
early in the pipeline.

**Request pipeline** (`src/app.js`): helmet → morgan logging → body parsing → static → session → CSRF (`csurf`, session-based, gated by `CSRF_ENABLED`) → global rate limiter (skips `/health` and `/public`) → CSRF token exposed to views via `res.locals.csrfToken` → centralized error handler that renders `views/error.ejs`, special-casing `ValidationError`/`AppError`/CSRF failures.

## The shell: Dailies is a rail, not a page

From `CLAUDE.md`. Read before touching `dashboard.ejs` or `tabs.js`.

`dashboard.ejs` renders Dailies once, as a resizable rail down the left of
whichever tab is showing - not as a tab pane. Its button in the tab bar carries
`data-rail-toggle` rather than `data-tab`, and `tabs.js` keys off that to show
and hide the rail instead of switching panes.

Consequences worth knowing before touching either file:

- **There is no `#tab-daily`.** Anything looking for a Dailies *page* will
  find nothing.
- **Dailies cannot be the landing tab.** The default resolves to the first tab
  button that actually exists.
- **Dailies initialises on every page load**, since the rail is always in the
  DOM - not when a tab is opened.
- Rail width, rail open/closed and calendar open/closed are per-browser view
  state in `localStorage`.

**Which panes share the screen, and the one click rule.** Four panes exist -
three rails (Dailies, Templates, Priorities) and the type pane, holding
whichever type tab is current. TWO show at a time, in the fixed left-to-right
order `Dailies | Templates | Priorities | type`. Every pair is legal EXCEPT
Templates + Priorities. `showPane()` in `tabs.js` is the single place that
decides, from one rule applied to whichever tab was clicked:

| The clicked tab is | What happens |
|---|---|
| not showing | it joins what is on screen, if the two may share; otherwise it takes the screen alone |
| showing beside another pane | it takes the screen alone |
| showing on its own | the pane that stepped aside comes back |

The last two rows make ONE tab a toggle between a pair and that pane on its
own - `Dailies -> Dailies | Categories -> Categories -> Dailies | Categories`
by clicking Categories each time - while clicking the OTHER tab of a pair
collapses to that half instead. Either tab of a pair is a way in and out of it,
no click leaves a blank screen, and there is no modifier key: cmd/alt-click
used to be how you paired two rails, and pairing is now what a plain click
does.

Two riders on the rule, each of which was a bug before it was written down:

- **Clicking a type tab OTHER than the one showing is a switch, not a toggle.**
  The pane stays where it is and changes which type it holds, so moving between
  types never closes the rail beside it.
- **A full-width view (Reporting) shares with nothing**, so its tab bypasses the
  rule entirely. "Already showing" for it means the full-width view is actually
  up - not merely that its slug is still `currentTab`, which it is after you
  leave it by asking for a rail.

`paneRecency` in `localStorage` is what makes both halves of that work: when an
incoming pane could join either of the two on screen, the one asked for less
recently steps out; and when a lone pane is clicked, the most recent pane that
is NOT showing (and may share with it) is the one that comes back - after a
collapse, exactly the half that just left. `showPane()` touches the clicked
pane AFTER choosing, and never touches the partner, which is what keeps the
alternation stable instead of drifting after a few clicks.

## Rows, editors and the focus bar

From `CLAUDE.md`. Read before touching row rendering, the entity editor, or
the focus bar — each rule below came from a specific regression.

- **A row's chevron expands it; a click selects it and, if an editor is
  already open on something, redirects that editor to it.** Expand and select
  used to share the same click, disambiguated from opening the editor by a
  double-click and a timer - removed because a genuine double click (open one
  row, then the next) was landing inconsistently. A click never opens a
  CLOSED editor by itself, only redirects one already open - the pencil icon
  is what opens one from nothing, so a click on the list stays safe to make
  without committing to editing something.
- **A folder's cells are ROLL-UPS of what is inside it**, at any depth, and
  failed dominates. They are summaries, not controls: clicking one does nothing
  to the editor. A folder shows Worked Time in its editor and nothing else it
  does not own.
- **Right-clicking a row selects it**; right-clicking a cell that cycles offers
  every value instead, in the state's own colour - and with rows multi-selected,
  sets it on all of them.
- **Status is one vocabulary for every type**: Not Started / In Progress /
  Complete / Failed / Ignored, coloured black / blue / green / red / grey in the
  cell and the editor alike, from one set of CSS classes. The box round a status
  is always black; in the editor it marks which one is current.
- **Worked Time is on every type and cannot be removed.** It is the value the
  focus clock accumulates AND a property you can correct by hand, stored in
  seconds and typed as "1h 30m". The type editor locks it, along with the other
  fields the engine writes.
- **Columns drop when the pane is too narrow** rather than collapsing. Two
  rules were each right alone and could not both hold with more columns than
  width — never scroll horizontally, never truncate — so the pane produced
  `90px 4.39px 90px 88px 4.4px ...`, several columns about four pixels wide with
  their content wrapping. Both rules still stand; the one that bends is "every
  column is always shown". `fittedColumnKeys()` in `genericEntity.js` drops in
  three tiers: ordinary columns first and **from the right**, so dropping
  follows the arranged column order rather than a separate priority nobody set;
  then **status**; and **never the title**. Status is droppable rather than
  untouchable on purpose — a rail dragged very narrow can leave less room than
  title and status together need, and an undroppable column would overflow,
  bringing back the sideways scroll this avoids. Measured on the real DOM after
  render (the width belongs to the container, and the markup is a string before
  it has one) and re-fitted by a `ResizeObserver`, because the Dailies rail is
  draggable and that is the case that caused it. Nothing is lost: values stay in
  the row editor and widening brings the columns straight back.
  **Key on `field_type === 'status'`, not `is_completion_signal`** — only 3 of
  the 7 status fields carry that flag, so protecting on it silently did nothing
  for Goals, Ideas, Projects and Tickets.
- **The focus bar lives in the navbar** and holds as many items as you pin.
  Only the clock starts and stops the clock. Its redraws are suspended while a
  chip is being dragged, or the timer's refresh deletes the element under the
  cursor mid-gesture.
- **Monitors run 0 to n, and 0 means the bar is not drawn at all.** Pins are
  kept when the count drops, not discarded — set a monitor back and they return
  where they were. `MAX_MONITORS` in `focusMonitorsService.js` exists only so a
  nonsense count cannot allocate an absurd array; it is not a product limit, it
  is exported, it ships with every settings read as `maxMonitors`, and the
  browser and routes both take the bound from there rather than repeating it.
  Raise it freely. What must NOT come back is a literal: the cap was written out
  as `6` in seven places across the service, the route, `focus-bar.js` and a
  hardcoded `<select>` in `settings-misc.ejs`, so "0 to n" was really "1 to 6".
- **`Number(count) || 1` is always wrong here**, because `Number(0)` is falsy
  and 0 is the one value that hides the bar. It has been reintroduced twice —
  once in the service, once in the Settings pane, where a saved 0 displayed as
  1 — so the coercion tests `Number.isFinite` instead, and null/undefined/''
  are what count as unset.

## Retired tables: the evidence check, and the MSSQL migration

Detail behind "Retiring a table is not the same as dropping it" in `CLAUDE.md`.

`inspectRetiredTables()` refuses to drop a table whose rows have no matching
entity, matched on **title** via `LEGACY_TABLE_TYPE` in
`src/database/retiredTables.js`. Title is weaker evidence than a legacy id
column - only Dailies left one behind (`entities.legacy_daily_id`) - which is
why it is used ONLY for tables no code reads at all. A stale row nobody queries
costs nothing; dropping an unmigrated one cannot be undone.

That refusal fired on the MSSQL machine and was correct:

```
MyWork.work_items - 29 row(s) have no matching entity
```

`work_items`, `tasks`, `priorities` and `to_dos` on that install never became
entities, because every `scripts/phaseN-migrate-*.js` uses the mysql2 pool's own
transaction API, which the `mssql` package does not mirror. Since every service
reads `entities` now, those records sit in the database and are invisible in the
app. They are data, not a stale copy.

`scripts/migrate-legacy-to-entities.js` exists to make that refusal go away
honestly - by moving the rows, not by destroying them. Four deliberate
differences from the phase scripts:

- goes through `connectionPool.query`, which both engines share, so it runs
  unchanged on MySQL and SQL Server;
- **discovers each table's columns from INFORMATION_SCHEMA** instead of
  hardcoding them - a column list written on this machine would be a guess about
  a database it cannot see;
- matches every column against the target type's field keys and **reports what
  it cannot carry** rather than silently dropping it;
- skips a row that already has a same-titled entity of that type - the same test
  the drop guard applies - so a second run is a no-op, not a duplicate.

Dry run by default. Back up before `--apply`; there is no undo.

## The MyWork icon

`src/public/favicon.svg` - a day's list with the top line ticked, on an
indigo-to-violet rounded tile. A letter mark was the obvious alternative and was
rejected: the app is one idea, typed rows gathered onto a day, and a checked
list says that at **16px**, which is the size that actually has to work in a
browser tab. The two undone rules get shorter down the stack so the shape still
reads as a list once the strokes blur together at that size. Verified at 16, 32,
64 and 128px.

## Recurrence: removed, not documented here any more

This section used to carry the mechanism, the JSON schema and a `POST` example.
Recurrence was withdrawn on 2026-08-19 and fully removed on 2026-08-25 - see
"Recurrence was withdrawn" in `CLAUDE.md`. The detail is deliberately NOT kept
here: a working spec for a feature that no longer exists is what let the
half-removed engine survive seven days of reading these files.
