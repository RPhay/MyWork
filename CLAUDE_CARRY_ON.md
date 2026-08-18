# Carry On: Generic Entity Engine bug fixes + UI Standards Convergence

Two threads of work this session. Plan file for the UI standards work: `/Users/aslynn/.claude/plans/gleaming-orbiting-yao.md`. `UI_STANDARDS.md` at repo root was rewritten by a separate parallel session (pulled in via `git pull`) to describe the new Generic Entity Engine architecture instead.

## Thread 1: UI Standards Convergence (Phases 1-2 done, Phase 3 partial, Phase 4 not started)

See the plan file for full detail. Summary: Phase 1 (shared change-tracker) and Phase 2 (CSS-only tree expand/collapse) are complete and verified. Phase 3 (Dailies child-item field-mapping centralization) has code written but was not fully re-verified after this session's Generic Entity Engine work landed on top - re-check it's still intact. Phase 4 (app.fetch adoption) not started.

## Thread 2: Generic Entity Engine bugs (this session, started from "creating a To Do doesn't work")

A large "Phase 10: Generic Entity Engine" rewrite arrived via `git pull` mid-session (dynamic entity types replacing per-type editors/renderers for Todos, Tasks, Tickets, Goals, Categories, Ideas - Dailies/Projects/Templates still use their own hand-written tabs). It shipped with several real, user-visible bugs. All fixed and covered by a new test file, `tests/e2e/generic-entity-crud.spec.js`, parameterized across all 6 generic types, covering create (click + Enter-to-submit), edit, delete, reorder, and reparent. **33/33 passing** as of this write-up.

**Bugs found and fixed, in the order they were uncovered:**
1. Save/delete/reparent/folder-create all did `location.reload()` on success - slow, jarring, and made a real success look like nothing happened. Replaced with in-place list refresh (`refreshEntities()` in `generic-entity-init.js`).
2. Edit/Delete row buttons never carried `data-entity-id` in `genericEntity.js#renderEntityRow` - delete requests were hitting `/api/entities/{type}/undefined` → 404, silently doing nothing.
3. `.entity-row` was never given `draggable="true"` - reorder/reparent drag-and-drop couldn't start at all, despite CSS already written for it (`.entity-row[draggable="true"]`).
4. **The hierarchy tree rendering and reparent logic were built against `entities.parent_entity_id`, a column that has never existed in the schema.** Hierarchy is stored entirely in a separate `entity_relationships` table (`parent_entity_id`/`child_entity_id`/`relationship_kind`). Rewrote `genericEntity.js#renderTree()` to build the tree from relationship data instead, added a new bulk endpoint (`GET /api/entities/:typeSlug/relationships?kind=hierarchy`, in `entities.js` + `entityRelationshipService.js#getRelationshipsForType`) since fetching per-entity would've been N+1, and rewrote the drop handler in `generic-entity-init.js` to use the real relationship endpoints (POST/DELETE `.../relationships`, PATCH `.../relationships/reorder`) for nesting, with a fallback to the flat `entities.order_index` reorder for top-level items.
5. `entityRelationshipService.js#validateRelationship` queried `entity_type_relationships.deleted_at`, a column that doesn't exist on that table (confirmed against schema) - every relationship write 500'd. Removed the clause.
6. **The `entity_type_relationships` seed data (self-nesting hierarchy rules for work_item/priority/area/to_do/task/ticket/idea, plus work_item's association rules) was never actually inserted into this dev DB**, even though `scripts/phase0-seed-entity-types.js` has the code to do it - the table had 0 rows. Inserted the missing rows directly (10 rows: 7 hierarchy self-nest + 3 work_item associations). If this dev DB ever gets rebuilt from scratch, re-running `phase0-seed-entity-types.js` should populate these correctly - the gap was in that script never completing this DB, not the script's logic.
7. **The one that actually matched the user's literal bug report**: `genericEntity.js#buildForm()`'s `<form>` had no submit handling. Pressing Enter in the title field (the normal way most people "hit save") triggered the browser's native form submission - a GET navigation to `/?title=...&status=...&notes=`, losing the tab entirely and never saving. Fixed with `onsubmit="return false;"` on the form plus a `keydown` listener that routes Enter to the real Save button, so Enter now behaves exactly like clicking Save. **This was the actual bug the user saw and described** ("ends up on I don't know what tab, none of them is selected") - everything else on this list was found while investigating and is real, but wasn't what was originally reported.

**Process note for next session**: the automated tests (click Save button, fill via `.fill()`) all passed while bug #7 was still live, because they never exercised pressing Enter. Added an explicit `creates a new item by pressing Enter in the title field` test per type specifically because of this gap - don't remove it as "redundant" with the click-Save test, it covers a genuinely different code path (native form submission vs. a button click handler).

## Also fixed: Projects tab position

`dashboard.ejs` had the Projects tab (entity type `priority`) hardcoded into a "fixed" left-aligned group next to Dailies, separate from the centered "editable types" tab cluster, despite being `type_category = 'editable'` in the DB like every other type. Removed the special-casing so only Dailies (`work_item`) stays pinned; Projects now renders in the centered group with the rest.

## Also disabled: rate limiting in local dev

`RATE_LIMIT_ENABLED` was `true` in `.env.local`, and this session's heavy automated test traffic repeatedly tripped it ("Too many requests from this IP"), at one point manifesting as a very confusing `window.APP_CONFIG` being undefined (rate-limited page load never got real HTML). Set to `false` locally. If this needs to go back to `true` for some local testing reason, expect that repeated Playwright runs will trip it again - consider raising `RATE_LIMIT_MAX_REQUESTS` instead of just leaving it off, if that matters for reproducing production behavior later.

## Next steps

1. Nothing currently known-broken. If picking this up cold, first run `npx playwright test tests/e2e/generic-entity-crud.spec.js` to confirm still green before doing anything else.
2. Continue UI Standards Convergence Phase 3 verification, then Phase 4, per the plan file - was interrupted by this session's detour into the Generic Entity Engine bugs.
3. Not investigated: whether the *other* ~5 new entity types added by the Phase 10 work beyond what's tested here (if any) have their own instances of bug classes #2-#7 above - the fixes are all in the shared `genericEntity.js`/`generic-entity-init.js` engine, so they should apply uniformly, but this wasn't independently re-verified per-type beyond what the 6 parameterized types in the test file cover.
4. Dev DB has real user data mixed with test runs from this session - all `ZZZ`-prefixed rows were cleaned up as they were created, confirmed clean as of this write-up, but double check before assuming a clean slate in a future session.
