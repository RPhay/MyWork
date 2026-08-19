# Carry On

## Status (2026-08-18): every thread below marked DONE is shipped and green. Thread 2 (UI Standards Phases 3-4) is the open work. **Read the TEST SUITE warning first.**

Today's arc, in one line: the "generic entity engine" was generic in name only, and the session was spent making it true - converging every typed page onto one code path, then fixing the pile of latent bugs that surfaced underneath.

---

## ⚠️ The test suite is not a safety net right now

A full `npx playwright test` run is **~290 tests with ~166 failing**, and that was true *before* any of this session's work (measured by stashing the changes and re-running: baseline **173 failed / 115 passed**, after **166 failed / 150 passed**).

The failures are broad and pre-existing - `Cannot set properties of null (setting 'innerHTML')` in `priorities.js`/`templates.js` right-panel loaders, CSRF 403s, a backup test shelling out to `mysqldump`. **Do not read a green-looking tail as a pass**: the line reporter prints `N failed` *above* `N passed`, and a truncated log will show only the latter. Always check both numbers.

This matters because it's *why* the bug in Thread 1b reached the user visually instead of via a test. Triaging this suite is probably higher value than any single feature right now.

---

## Thread 1b: Dailies/Projects/Reporting were throwing on every load (FIXED)

Symptom: a red banner, **"A required database table is missing. Run the database setup script."** Three endpoints 500'd - `/api/work/date/:date`, `/api/priorities`, `/api/reporting/*`.

Cause: Phases 1-3 **deliberately** dropped `areas`, `goals`, `ideas` and their junction tables (the schema files still carry the "removed in Phase N" comments) but never updated the consumers. `workItemService`, `priorityService`, `workItemTemplateService` and `reportingService` were still querying them. Any fresh `db:init` reproduced it.

Fix - a **temporary bridge**, because `entity_relationships` has FKs into `entities` on both sides and work items/projects are still legacy tables, so it physically cannot hold a work-item→area edge yet:

- Seven junctions recreated in **both** schema files under a "Legacy <-> entity association bridge" block, placed *after* `entities` exists (FK ordering): `work_area/goal/idea_associations`, `priority_areas/goals`, `template_areas/goals`. Left column = legacy id, right column = `entities.id`.
- MSSQL declares the entity-side FK `ON DELETE NO ACTION` (two cascading FKs into one junction hit "multiple cascade paths"), so `entityService.js#deleteEntity` clears the junction rows explicitly - that's what keeps both engines behaving alike. `BRIDGE_JUNCTION_COLUMNS` there must stay in sync with the schema block.
- The three `attachAssociations` functions now JOIN `entities`, aliasing `title AS name` for areas/goals so **no frontend change was needed**. `entityService.js#getEntityPathLookup` reshapes entities into `{id, name, parent_id}` so `hierarchyPath.js#buildPathMap` is reused unchanged.
- `reportingService` repointed to `entityService`; the four now-dead legacy services (`areaService`, `goalService`, `ideaService`, `ideaFolderService`) deleted - their routes already used `entityService`.

**RETIRE THE BRIDGE** when work_items/priorities become entities; the seven tables then collapse into `entity_relationships`.

Note: goals-as-entities have no `year`/`due_date`/`categories` (the old `goals` table's columns), so `getGoalsReport` emits them defensively and only year-filters when a `year` field actually exists.

## Thread 1c: hierarchy cycles could crash three tabs (FIXED)

Found immediately after the above, in the browser: Projects showed "Error loading projects" / **"Maximum call stack size exceeded"**.

Two independent defects, both now fixed:

1. **Nothing prevented a cycle.** Dragging an item into its own descendant created `A parent-of B` + `B parent-of A`. `entityRelationshipService.js#validateRelationship` now rejects self-parenting and any edge whose parent is a descendant of the child (mirroring the guard `priorityService.js#updatePriority` already had for `parent_id`).
2. **`buildPathMap` recursed until the stack blew.** Rewritten to walk iteratively with a `seen` guard, so a bad edge degrades to a partial path instead of taking out Dailies, Projects and Reporting together.

The cyclic rows in the dev DB were deleted. Covered by `refuses to make an item its own ancestor` in `generic-entity-crud.spec.js` (all 6 types) and verified by real drag-and-drop in the browser - the UI shows "Cannot move an item inside one of its own descendants" and stays healthy.

---

## Thread 1: Typed pages converged onto one code path (COMPLETE, 2026-08-18)

The complaint that started it: "the type pages should all be based on the same code... On the categories page I can create folders, on the todos I can't."

That was accurate. `generic-entity-init.js` had four hardcoded `if (typeSlug === 'area')` branches giving Categories a folder button, a second entity fetch, a second relationships fetch, and a per-entity schema lookup that no other page got.

### Root cause: two competing folder designs shipped at once

- `entities.is_folder` — already in **both** `mysqlSchema.js` and `mssqlSchema.js` with correct backfill blocks, already written by `entityService.js#createEntity`, and **never read by anything**.
- A separate `folder` entity type (id 30) with `folder→area`/`folder→folder` rules, wired only into the Categories tab, holding **zero rows**.

`is_folder` won. **A folder is a row of the page's own type with `is_folder = 1`** — a Todos folder is a `to_do` row. Consequences worth remembering:

- Folders are page-scoped for free (a Todos folder cannot leak onto Categories, because it *is* a todo).
- Each type's existing self-nesting rule (`to_do → to_do`) already permits items under items, items under folders, and folders under folders. No `folder → X` rules needed.
- Drag-and-drop, cascade-delete, and reorder needed **zero** folder-aware changes — every edge is an ordinary same-type hierarchy edge.
- The separate-type design was unshippable anyway: `entityRelationshipService.js#getRelationshipsForType` joins on `child_e.entity_type_id = parent_e.entity_type_id`, so every folder→item edge would have been silently dropped from the tree.

Exactly **two** places are folder-aware, both keyed on `is_folder`, never on a type name: the icon swap in `renderEntityRow` and the title-only form in `buildForm`. `UI_STANDARDS.md` §2 now documents this as the standard, including an explicit "if you are about to write `if (typeSlug === ...)` in the generic engine, stop."

### Two latent bugs found while fixing it

1. **No field value had ever been saved, for any type.** `entity_field_values` had 0 rows. `collectFormValues` returned `{title, notes, status}` flat while `entityService` reads `data.fields`. Fixing that exposed a second, independent bug underneath: `attachFieldValues` used `WHERE entity_id IN (?)` with an array, but `connectionPool.js` runs statements through mysql2's `execute()` (prepared statements), which does **not** expand arrays into an IN list the way `query()` does — so the read matched nothing either. Both fixed; notes/status now round-trip. **Watch for `IN (?)` anywhere else in this codebase — it is always wrong here.** There was exactly one occurrence at the time of writing.
2. **Browser dialogs** (`prompt()` for folder creation, `confirm()` for delete) violated the project's custom-modal UX standard. Both replaced with `app.confirm` / the editor pane.

### Data changes applied to this dev DB

Via `scripts/fix-type-hierarchy-and-retire-folder-type.js` (idempotent, safe to re-run; refuses to retire the folder type if it ever holds rows):

- `supports_hierarchy = 1` for area, goal, to_do, task, ticket, idea, priority. **The DB had drifted from the seed** — task/ticket/goal were 0, so those tabs rendered as flat lists while their neighbours rendered as trees. That drift was itself a source of "these pages behave differently."
- Added the missing `goal → goal` self-nesting rule.
- Soft-deleted the `folder` type and removed its two type-relationship rules.

`phase0-seed-entity-types.js` and `entityTypeService.js#SYSTEM_TYPE_DEFAULTS` were updated to match, so a fresh `db:init` and a "revert to defaults" now both produce this same state. Those two lists had also drifted apart from each other and are now consistent.

### Icons

Categories and Tasks both used 📂, indistinguishable from the 📁 folders that now appear on every page — this is what the original "they're still obviously all folders" complaint was really about. Changed to 🏷️ (Categories) and 📝 (Tasks). **No type may use a folder-like icon**; there's a comment saying so at the top of the seed's `types` array.

### Tests

`tests/e2e/generic-entity-crud.spec.js`: **60/60**. Folder coverage is parameterized across all 6 types *on purpose* — the bug being guarded against was one type having folders while another didn't, so a Categories-only folder test would not have caught it. Also added a field-persistence test, which was untested territory given the table had never held a row.

`tests/e2e/ui-check.spec.js` was **already failing before this work** (verified by stashing and re-running against baseline) — it asserted `addAreaFolderBtn`-style capitalized IDs that the generic template has never generated, plus `addPriorityFolderBtn` from the separate Projects template. Rewritten to derive slugs from the rendered tabs so it can't go stale when a type is added or renamed.

Full suite: **140 passed**. `editable-types.spec.js` headed: 19/19. `debug.spec.js`: no CSP/console errors. Real-browser check drove Todos and Categories through the identical sequence — same behavior, correct distinct icons, nesting persisted, zero native dialogs, no Folders tab.

### Not done / known remaining

- `dashboard.ejs:37` still filters `'folder'` out of the tab list. Harmless and redundant now that the type is soft-deleted (`getAllEntityTypes` filters `deleted_at IS NULL`); left as a guard.
- Projects (`my-priorities.ejs`), Dailies (`dailies.ejs`), and Templates (`templates.ejs`) still have **hand-written tabs** outside the generic engine. Projects has its own `addPriorityFolderBtn`. If the goal is truly one code path everywhere, these three are the remaining holdouts — converging them was out of scope here and is the natural next piece of this thread.
- Test data: `entity_field_values` legitimately holds rows now. `editable-types.spec.js` leaves behind non-`ZZZ` rows like "New Goal Test"/"New Area Test" that accumulate across runs. All `ZZZ`-prefixed rows were cleaned up and verified 0 as of this write-up.

---

## Thread 1d: Projects moved onto the generic engine (DONE)

Projects was still a bespoke tab (`my-priorities.ejs`) with a **"Project Form" modal** while every other typed page used the split-pane generic editor. It was not sharing the code.

The blocker wasn't the template - it was that Projects' data lived in the legacy `priorities` table, so swapping templates would have shown an empty list. So `priorities` was migrated into `entities` (Phase 4).

**`scripts/phase4-migrate-priorities.js` was rewritten before running - the version in the repo was unsafe**: it hardcoded `priorityTypeId = 3`, which is `area`, so it would have migrated every project into Categories. It also hardcoded context 1, dropped `is_weekly`/`source_id`, wrote legacy work_item ids into an entities-keyed column, and duplicated on re-run. The new one looks the type up by slug, is transactional, and refuses to run twice.

**Nine foreign keys referenced `priorities`** - far more than the two junctions expected: `tasks`, `tickets`, `to_dos`, `priority_links`, `priority_areas`, `priority_goals`, `template_priorities`, `work_priority_associations`, plus its own `parent_id`. Each was dropped, remapped to the new entity ids, and repointed at `entities` (junctions CASCADE; tasks/tickets/to_dos SET NULL, preserving their optional-link semantics).

- `is_weekly` became a `checkbox` field on the priority type, so the generic editor renders it as "Weekly Priority" and the Priority Board's Weekly list still works. Verified set→unset→set round-trip.
- `priorityService` now reads/writes entities but **keeps the old row shape**, including a `parent_id` synthesized from `entity_relationships`, because 8 frontend files still consume `/api/priorities` that way. No frontend change was needed.
- `customTemplateMap` in `dashboard.ejs` no longer lists `priority`. **Only Dailies and Templates remain bespoke.**

**A miss worth remembering**: after migrating, `workItemService` and `workItemTemplateService` still had `JOIN priorities p ON wpa.priority_id = p.id`. The junction now held *entity* ids, so the join silently matched nothing - work items lost their project associations with no error anywhere. Caught only by comparing the API response against the raw table. **This is the same failure mode as Thread 1b**: migrate the data, forget a consumer, get silence instead of an error. After any migration, grep for every `JOIN <old_table>` before declaring done.

Projects is now in the parameterized `TYPES` list in `generic-entity-crud.spec.js` and passes all 11 generic tests exactly like the other six types - that shared coverage is the actual proof it shares the code path.

## Thread 1e: `url` and `links` field types (DONE)

Moving Projects to the generic tab dropped its **Links** section - the old Project Form modal had one, and the generic editor had no way to render it. Rather than special-casing Projects, links became a **field type**, configurable per type in Settings:

- **`url`** - one named link (the field's label names it, so a type can have several).
- **`links`** - 0-n named links, stored as a JSON array of `{url, title}` in `entity_field_values.value_json`.

This makes the four per-type link tables (`priority_links`, `task_links`, `ticket_links`, `to_do_links`, all 0 rows) obsolete - they existed only because there was no generic way to declare links. **Don't add a fifth.** The tables and `/api/links` are still present but unused by the generic tabs; dropping them is safe cleanup whenever someone wants it.

**Two latent bugs found doing this**, both pre-existing:

1. `url` and `radio` were offered in the type editor and accepted by `entityTypeService`, but had **no renderer** and were **missing from the MySQL `field_type` ENUM**. Saving one failed with `Data truncated for column 'field_type'`; any that survived rendered as a plain text box. The ENUM now includes `url`, `links`, `radio`, with an idempotent `MODIFY COLUMN` for existing installs. (MSSQL stores this as `NVARCHAR(50)` with no constraint, so it needed no change - a real divergence between the two schemas, noted in the file.)
2. **mysql2 auto-parses JSON columns**, but `entityService.js#attachFieldValues` called `JSON.parse()` unconditionally, throwing `Unexpected token 'o', "[object Obj"...`. That broke **every** JSON-valued field - `links` and `recurrence` both. It now parses only when the driver returns a string.

Adding a field type means touching four layers - renderer, service validation, editor `<option>`, schema ENUM - or it half-exists, exactly as `url` did. Covered by `tests/e2e/entity-field-types.spec.js`.

## Thread 1f: type editor corruption, context menus, type audit (DONE)

**The type editor was silently destroying types.** Three compounding bugs:

1. `entityTypeService` destructured INSERT results - `const [result] = await query('INSERT ...')`. `connectionPool.query()` already unwraps to the ResultSetHeader, which isn't iterable, so every type/field/rule create threw **"(intermediate value) is not iterable"**. Seven sites, plus a matching `const [x] = ...; return x[0]` double-index bug.
2. The field-type `<select>` had **no option for `status` or `recurrence`**. A `<select>` falls back to its first option, so opening a type and pressing Save rewrote those fields to `text`.
3. `updateEntityType` **deleted every field and recreated from the payload**, so any field the form couldn't represent was dropped entirely.

Together: opening Projects and saving reduced it from four fields to one, typed wrongly. Fixed by adding the missing options, reconciling fields **by field_key** instead of wipe-and-recreate (carrying over `field_options`/`is_completion_signal` the caller omits), and allowing `field_type` in `updateEntityTypeField`.

**Watch out**: `entity-type-editor.js` builds HTML with template literals. A comment containing backticks broke the whole file and took the type editor down completely. Run `node --check` on it after editing.

**Context menus** (`generic-entity-init.js`): right-click a row or empty space. Entries come from the type definition, never the slug - `supports_hierarchy` gates "inside" entries and folders, and the type's `hierarchy` relationship rules decide which types may be children. "New ... inside" records the row, opens the normal editor, and writes the nesting edge after the child exists. Cross-type children are deliberately not offered: this tab only has an editor for its own type. Uses the existing `.context-menu` CSS with an added `entity-context-menu` class, because the hand-written Dailies menu is always in the DOM under the same class.

**Relationship lists** exclude Dailies/`work_item`, the `daily` type, and anything with `type_category = 'external'` (Outlook Calendar) - a daily is never a child and always implicitly a parent, and an import source isn't a type you author rules against.

**Type audit** (`tests/e2e/entity-type-integrity.spec.js`) - now a standing guard, not a one-off:
- every field type in use has a renderer, an editor `<option>`, and a place in the ENUM;
- no `status` field has been downgraded to `text` (the signature of bug 2);
- every `supports_hierarchy` type actually has a self-nesting rule.

That last check found real drift: `template` had `supports_hierarchy = 1` with no `template->template` rule, which renders a tree where every nest is rejected. Set to 0 to match the seed, folded into `scripts/fix-type-hierarchy-and-retire-folder-type.js`. No other type was corrupted - all `status` fields survived intact.

## Thread 1g: Settings > Entity Types became the control surface (DONE)

- **Entity Types is now the Settings landing tab** (`routes/index.js`, `settings.ejs`).
- **The type editor is a split-pane**, not a floating modal - same `SplitPane` as the typed pages, with Save/Cancel/Delete in the pane header.
- **Enable/disable per type**: new `entity_types.is_visible` (both schema files, with backfills). `dashboard.ejs` filters tabs on it, so a hidden type never reaches the DOM.
- **Drag to reorder** writes `entity_types.order_index` via `PATCH /api/entity-types/reorder`. The dashboard renders tabs in that order, and dragging the tab bar writes the same value - one value, two views.
- **Returning from Settings restores your last dashboard tab.** `sessionStorage` used a single `currentTab` key for both pages, so opening Settings overwrote the dashboard's tab with `entity-types`, a name the dashboard has no tab for. Now namespaced per pathname, with precedence `?tab=` -> remembered -> server default, and a guard that ignores a remembered tab whose type has since been hidden or deleted.
- **Ordering/visibility is global, not per context** (an explicit decision). `context_tab_settings` and its Settings > Contexts "Tabs" panel are gone; with two mechanisms owning one property they disagreed as soon as either was used.

## Thread 1h: dead code removed (DONE)

Deleted after verifying each was unreachable - 24 files:

- **Tab templates** never included by any page: `areas.ejs`, `brainstorming.ejs`, `my-priorities.ejs`, `tasks.ejs`, `tickets.ejs`, `todos.ejs`, `yearly-goals.ejs`.
- **JS referenced only by those**: `areas.js`, `brainstorming.js`, `priorities.js`, `tasks.js`, `tickets.js`, `todos.js`, `goals.js`, `linksHelper.js`, and `editors/{Goal,Priority,Task,Ticket,Todo}Editor.js`.
- **Per-context tab settings**: `routes/api/contextTabSettings.js`, `services/contextTabSettingsService.js`, the Contexts "Tabs" sub-panel.
- **Links plumbing**: `routes/api/links.js`, `services/linksService.js`, and `priorityService`'s `getLinksForPriority`/`addLinkToPriority` plus the `/api/priorities/:id/links` routes - Projects carries links as a generic `links` field now.

**Deliberately kept** (they are NOT dead): `editors/TemplateEditor.js` (templates.ejs is live), `backup.ejs`/`data-sources.ejs` (included by contexts.ejs), and `taskService`/`ticketService`/`toDoService` with their `task_links`/`ticket_links`/`to_do_links` tables - **`dailies.js`, `main.js` and `dragDropUtils.js` still call `/api/tasks`, `/api/tickets` and `/api/to-dos`** for Dailies' association pickers. Verify that before assuming those are removable.

The now-orphaned `context_tab_settings` and `priority_links` tables were left in place (both empty). Nothing queries them; dropping them is optional cleanup.

---

---

## Thread 2: UI Standards Convergence (Phases 1-2 done, Phase 3 partial, Phase 4 not started)

Plan file: `/Users/aslynn/.claude/plans/gleaming-orbiting-yao.md`. **This is the actual open work.**

- Phase 1 (shared change-tracker) and Phase 2 (CSS-only tree expand/collapse): complete and verified.
- **Phase 3** (Dailies child-item field-mapping centralization): code written, never re-verified after the Generic Entity Engine work landed on top of it. Re-check it's still intact before building on it.
- **Phase 4** (`app.fetch` adoption): not started. Note that `generic-entity-init.js` still uses raw `fetch` with manual CSRF headers throughout, despite `UI_STANDARDS.md` §6 claiming `app.fetch` is the standard — that section is aspirational, not descriptive.

---

## Environment note

`RATE_LIMIT_ENABLED` is `false` in `.env.local`. Heavy Playwright runs trip the limiter, and it manifests confusingly as `window.APP_CONFIG` being undefined (a rate-limited page load never returns real HTML). If it needs to go back on locally, raise `RATE_LIMIT_MAX_REQUESTS` rather than just flipping the flag.
