# Carry-on notes — Home Pool / Default DB fix

## The problem

Switching the active context to one that has a custom DB configured calls
`applyContextDatabaseConnection` → `connectionPool.reconfigure()`. This
replaces the **single live pool** with the context's own DB. Because `contexts`
is a plain table in whatever the live DB is, the context list in Settings now
shows only what's in that secondary DB — the "home" contexts (e.g. CLEAResult)
disappear.

## The fix — two pools

Introduce a permanent **home pool** (`src/database/homePool.js`) that holds a
connection to the machine's primary DB (`.env.local` / first-run setup
credentials). It is **never reconfigured**. A separate **content pool**
(`connectionPool.js`, unchanged) is the switchable one that activates per
context.

**Services split by pool:**

| Uses home pool                 | Uses content pool                         |
| ------------------------------ | ----------------------------------------- |
| `contextService.js`            | `workItemService.js`                      |
| `contextFolderService.js`      | `priorityService.js`                      |
| `userService.js`               | `goalService.js`                          |
| `contextTabSettingsService.js` | `areaService.js`                          |
| `activeContextService.js`      | `sourceService.js`                        |
|                                | `toDoService.js` / `toDoFolderService.js` |
|                                | `ideaService.js` / `ideaFolderService.js` |
|                                | `workItemTemplateService.js`              |
|                                | `yearService.js`                          |
|                                | `backupService.js`                        |

**`homePool.js`** — mirrors `connectionPool.js`'s `query / queryOne / insert /
update / deleteRecord` API but reads `config.database.*` once at startup and
never calls `reconfigure`. It always targets the home DB.

**`activeContextService.applyContextDatabaseConnection`** — continues to
reconfigure `connectionPool.js` (content pool) only. Does NOT touch homePool.

**`applyCachedConnectionAtBoot`** — continues to restore the content pool
from `data/active-context.json`. If the file is absent, content pool defaults
to the home DB (same connection) — no setup required.

## "Default" context badge

A context is "default" (home-pool context) when it has **no custom DB host
saved** (`db_host IS NULL`). Show a `bi-house-fill` icon badge on such rows in
the contexts list. The text title stays the same; the icon appears in
`contextRowHtml()` in `contexts.js` alongside the owner badge.

## Files to create/modify

- **Create** `src/database/homePool.js` — permanent pool, reads `config.database.*`
- **Modify** `src/services/contextService.js` — import from homePool
- **Modify** `src/services/contextFolderService.js` — import from homePool
- **Modify** `src/services/userService.js` — import from homePool
- **Modify** `src/services/contextTabSettingsService.js` — import from homePool
- **Modify** `src/services/activeContextService.js` — import homePool for
  structural reads; content pool reconfigure unchanged
- **Modify** `src/public/js/contexts.js` — add home-badge icon in `contextRowHtml()`

## Current status

Design complete. Not yet implemented. Start with `homePool.js`, then update
the service imports one by one, test that contexts remain visible after
switching to a context with a different DB, then add the badge.

## The feature, as scoped

Started from: "introduce the idea of areas (Work vs Life)" → renamed to
**Contexts** to avoid colliding with the existing `areas` table (which backs
the unrelated Categories tab). Requirements gathered over the session, in
order:

1. A `Contexts` settings tab to define contexts (flat list, e.g. Work/Life/
   Hobbies), same table/list style as other entities. **Done, shipped.**
2. Every content entity (work items, categories/areas, projects/priorities,
   goals, templates, to-dos+folders, ideas+folders, data sources) belongs to
   exactly one context via a `context_id` column. Switching the active context
   (navbar dropdown) filters everything to just that context's rows. **Done,
   shipped, tested against the live 192.168.0.112 database.**
3. A "Default" context is always seeded and can't be deleted if it's the last
   one remaining (rename instead). **Done, shipped.**
4. **Tonight's unfinished piece:** each context should be able to define its
   own **database connection** (contexts can point at _entirely different
   physical databases_, not just filter rows within one shared DB), plus its
   own **Data Sources**, **Backup & Restore**, and **which main-app tabs are
   visible/in what order** (Dailies always shown first, can't be hidden).
   The Settings page becomes: Contexts is the only top-level tab, split into
   a left panel (context list) and a right panel (tabbed sub-panel scoped to
   whichever context is selected: Tabs / Database / Data Sources / Backup).
5. Any tabbed control (main app tabs, the new per-context sub-tabs) should be
   drag-to-reorder capable.
6. Context rows in the left list get the same interaction pattern as other
   entity lists: click-pause-click inline rename, drag-to-reorder, double-
   click/Edit button opens it (here: selects it into the right panel).

## Key architectural decisions (already made, don't re-litigate)

- **Contexts can have independent databases.** This was an explicit user
  choice over "just filter rows in one shared DB." Both mechanisms coexist:
  `context_id` filtering still applies to whatever DB is currently connected;
  _additionally_, each context can have its own DB connection profile, and
  switching to it can switch the live physical connection entirely.
- **Split-pane layout, not a modal.** Left column = context list, right
  column = tabbed panel for the selected context.
- **Drag-reorder scope:** main app tabs (per-context) + the new per-context
  sub-tab panel. **Not** Settings' own top-level tab bar (it's not part of
  the per-context system and stays fixed).
- **MSSQL dropped from the per-context DB config**, deliberately. It was
  never actually functional (no query path anywhere in the app, confirmed
  earlier this session) even as a _global_ option — replicating that
  non-functional option per-context would add pure complexity for nothing.
  MySQL/MariaDB only, per context.
- **Data Sources and Backup & Restore inside the per-context panel operate on
  whichever context is currently _active_ (navbar switcher), not necessarily
  the one merely _selected_ in the left list.** This was a scope call to
  avoid rewriting those two features to accept an arbitrary context_id
  end-to-end (see "Not done yet" below — this is the main compromise worth
  revisiting). The UI says this explicitly in both sub-panels.
- **Boot-time database resolution.** Because contexts can point at different
  databases, there's a chicken-and-egg problem: figuring out which context is
  active requires a DB query, but which DB to query depends on which context
  is active. Solved by caching the last successfully-applied connection's
  details in `data/active-context.json` (`lastLiveConfig`, password
  encrypted) and reconnecting to _that_ directly at every process boot,
  before ever querying anything. `.env.local` is only the fallback the very
  first time, before any context has ever gone live. See
  `activeContextService.applyCachedConnectionAtBoot()` and how `server.js`
  calls it.

## What's built and verified working

- **Schema** (`mysqlSchema.js` + `mssqlSchema.js`): `contexts` table has
  `db_host`, `db_port`, `db_name`, `db_user`, `db_password_enc`,
  `subtab_order`. New `context_tab_settings` table (context_id, tab_key,
  visible, order_index). Applied and confirmed on **both** local and
  `192.168.0.112` — including the existing global DB config (from the old
  `data/db-connections.enc.json`) migrated into every existing context as its
  initial DB config, so nothing broke when this went live.
- **`contextDatabaseConfigService.js`** — per-context get/save/test/
  create-schema, mirroring the old (now-deleted) global
  `databaseConfigService.js` but scoped to a context row instead of a global
  file. MySQL-only.
- **`contextTabSettingsService.js`** — per-context main-tab visibility/order,
  with `CONFIGURABLE_TABS` as the canonical list (everything except Dailies).
- **`activeContextService.js`** — rewritten: `setActiveContextId()` now also
  calls `applyContextDatabaseConnection()`, which reconfigures the live pool
  to the target context's own DB config (if it has one) and caches the
  resolved config for the next boot. New `applyCachedConnectionAtBoot()`
  used by `server.js` instead of the old global-profile boot logic.
- **Security fix applied:** `contextService.js`'s `getAllContexts`/
  `getContextById` were initially returning the raw `db_password_enc`
  encrypted blob straight to the browser via `/api/contexts` and
  `/api/active-context`. Fixed with a `maskContext()` helper (same pattern as
  the old `maskProfile()`) — now returns `hasDbPassword: true/false` instead.
  **If you touch these two functions again, keep the masking.**
  `contextDatabaseConfigService.js` has its _own_ separate raw query
  (`getContextRow`) that legitimately needs the real blob for
  encrypt/decrypt — that one is correctly unmasked, don't "fix" it.
- **Real bug found and fixed in `mysqlSchema.js`:** old pre-context
  "backfill uniqueness" blocks for `priorities.title` and
  `goals.unique_year_name` unconditionally re-added the old single-column
  unique index whenever they didn't see it — which fought with the newer
  widening logic that converts those to composite `(context_id, ...)`
  constraints, causing `ER_DUP_KEYNAME` on repeated `db:init` runs. Removed
  the obsolete blocks entirely (the widening logic at the end of
  `createMysqlSchema` now owns this fully, works for both fresh installs and
  migrations). **Confirmed idempotent** — `db:init` now runs clean
  back-to-back multiple times in a row.
- **`main.js`**: generic `app.bindTabDragReorder(navEl, itemSelector,
onReorder)` — reusable drag-to-reorder for any tab strip. Reads/writes
  `data-tab` (or whatever attribute the selector implies) on each item.
- **`dashboard.ejs` + `tabs.js`**: main app tabs (except Dailies) are now
  `draggable="true"` `<li data-tab="...">`, reordered/hidden per the active
  context's `context_tab_settings` on load (`TabManager.applyContextTabConfig
()`), with drag-reorder wired to persist back via
  `PUT /api/context-tab-settings/:contextId`. Gated so this only runs on the
  dashboard page (checks for `#dailies-tab`), not Settings.
- **New split-pane `contexts.ejs` + `contexts.js`** — left panel (context
  list: click-pause-click rename via `app.bindInlineRename`, drag-reorder,
  click/dblclick/Edit selects into right panel), right panel (4 sub-tabs:
  Tabs / Database / Data Sources / Backup & Restore, drag-reorderable via
  `app.bindTabDragReorder`, order persisted to `contexts.subtab_order`).
  Data Sources and Backup panels literally embed the existing
  `data-sources.ejs` / `backup.ejs` partials (moved, not duplicated) —
  their existing `sources.js` / `backup.js` still work untouched.
- **`settings.ejs`** — now has exactly one top-level tab (Contexts). The old
  Data Sources / Database Configuration / Backup & Restore top-level tabs and
  their nav entries are gone (relocated into the Contexts panel). Default
  Settings tab changed from `data-sources` to `contexts`.
- **Old global DB config fully removed**: deleted
  `src/services/databaseConfigService.js`, `src/routes/api/databaseConfig.js`,
  `src/views/tabs/database-config.ejs`, `src/public/js/databaseConfig.js`.
  Confirmed nothing else references them.
- **Cold-restart tested**: killed the server entirely, restarted, confirmed
  it reconnects directly to `192.168.0.112/MyWork` via the boot cache with no
  manual steps, and that `/api/active-context` + `/api/areas` resolve
  correctly afterward.
- Server is currently stable (verified: `/` and `/settings?tab=contexts` both
  return 200, no crash loops, all new/touched JS files pass `node --check`).

## What's NOT done yet — pick up here

1. **`backupService.js`** — was mid-edit when we stopped. It currently still
   works exactly as it did before tonight (untouched), but has two known
   problems to fix:
   - Its `TABLES` list predates several features added _this session_ and is
     missing: `idea_folders`, `ideas`, `idea_items`, `contexts`,
     `context_tab_settings`. Export/import silently skip these tables right
     now. This bug is independent of the context work — worth fixing either
     way.
   - Per the "Data Sources/Backup operate on the active context" decision
     above, `exportDatabase()`/`importDatabase()` should ideally scope to the
     active context's rows rather than exporting/replacing the _entire_
     database (which is what they do today — a backup import right now still
     nukes every context's data, not just the active one). Tables with a
     `context_id` column can filter directly; join/child tables (e.g.
     `to_do_items`, `work_*_associations`, `template_*`, `priority_areas`,
     `priority_goals`, `goal_categories`) need to filter by their parent's
     membership in the exported set; `years`/`categories` are global
     reference data and probably shouldn't be scoped at all; whether
     `contexts` itself and `context_tab_settings` get included is an open
     question worth a quick decision before implementing (probably: yes,
     just the one row/rows for this context, so a context is fully portable
     via its own backup file).
2. **No real browser testing of the new split-pane UI yet.** Everything so
   far is verified via `curl`/direct API calls and `node --check` (syntax),
   consistent with how this whole session has been tested since there's no
   computer-use/screenshot tool available. The actual interactive bits —
   drag-reorder on context rows, drag-reorder on the new sub-tabs, the
   inline-rename-on-context-row gesture, the Database sub-panel's test/save
   flow end-to-end from a real click, checkbox toggling in the Tabs
   sub-panel — have **not** been clicked through in an actual browser.
   Do that first thing before building more on top.
3. Haven't re-verified the full backfill/filtering system (from earlier
   tonight, before the DB-config work started) still behaves correctly now
   that `activeContextService.js` was substantially rewritten — the context-
   filtering itself shouldn't have changed, but worth a quick smoke test
   (switch context in the navbar, confirm work items/areas/etc. still filter
   correctly) since `setActiveContextId()`'s internals changed.
4. ~~Git status has NOT been checked/committed yet~~ — done: committed as
   `db7a46f` ("WIP: Per-context database config, tab visibility, and
   split-pane Settings") and pushed to `origin/main`. Pull this down on the
   other machine before continuing.

## Gotchas worth remembering

- **`.env.local` is not the source of truth anymore for which DB is live** —
  `data/active-context.json`'s cached `lastLiveConfig` is, once anything has
  ever gone through `applyContextDatabaseConnection`. `.env.local` is now
  purely the first-ever bootstrap fallback.
- **nodemon does NOT watch `data/*`** (fixed earlier this session via
  `nodemon.json`) — editing files under `data/` never triggers a restart,
  which is what makes the boot-cache approach safe to rely on (writes to
  `active-context.json` won't cause a self-defeating restart the way the old
  global DB config once did before that fix).
- **Two different "areas" concepts exist in this codebase** — the `areas`
  table (Categories tab, unrelated) vs `contexts` (this feature). Don't
  conflate them; this naming collision is exactly why "Contexts" was chosen
  over reusing the word "Areas."
- **`db:init` needs to be run against _both_ local and remote** after any
  schema change — there's no automatic sync between them.
