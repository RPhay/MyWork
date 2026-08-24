# CLAUDE_TESTING_REFERENCE.md

On-demand detail split out of `CLAUDE_TESTING.md` by `claude-md-audit --split`
on 2026-08-23, because `CLAUDE_TESTING.md` was flagged as an oversized node
(15,712 B, over the 8,000 B threshold in `graph.py`). It is imported into
`CLAUDE.md` (`@CLAUDE_TESTING.md`), so its own size counts every turn; this
file is not imported by anything, so it costs nothing until read. Read the
relevant section below when the task it names comes up.

## Specs already verified clean

From "Clean up your test data" in `CLAUDE_TESTING.md`. These already clean up
after themselves — running them leaves zero rows behind, verified:
`generic-entity-crud.spec.js`, `editable-types.spec.js`,
`entity-field-types.spec.js`, `entity-type-integrity.spec.js`, `debug.spec.js`.

## The known leaks, by name

From "Clean up your test data" in `CLAUDE_TESTING.md`. Read before writing a
new spec that creates rows, or when deciding whether an existing spec needs a
teardown added.

At the time the cleanup rule was written, accumulated test rows had reached
**229** across Projects, Categories, Goals, Todos, Tasks, Tickets and Ideas —
83 `Test Project for Context Menu`, 125 `Test Idea for Context Menu`, and
assorted `New Area Test` / `New Goal Test` / `Test Folder <timestamp>` rows,
built up over many sessions because each one left its rows behind.

- **`tests/e2e/setup-test-data.js`** is the main one. Its `setupTestData()`
  creates `Test Project for Context Menu` and `Test Idea for Context Menu` (plus
  goals, areas, todos, tasks, tickets) on **every call**, exports no teardown,
  and is imported by six specs: `context-menu-comprehensive`,
  `test-add-operations`, `verify-associations`, `debug-goal`,
  `debug-association-data`, `debug-failing-associations`. It accounted for 208
  of the 229 rows purged on 2026-08-18. **Fix: return the created ids and export
  a `teardownTestData()`, then call it from `afterAll` in all six specs.**
- **`test-create-item.spec.js`** creates `New Area Test` / `New Goal Test` and
  never removes them.
- **`folder-creation.spec.js`** and **`editable-types-comprehensive.spec.js`**
  create `Test Folder <timestamp>` rows.

None of those has an `afterEach` or `afterAll`.

## How to delete

From "Clean up your test data" in `CLAUDE_TESTING.md`. Read before deleting
any entity row, by hand or from a script.

Deleting an entity takes **two** steps, in this order — the same order
`DELETE /api/entities/:typeSlug/:id` uses:

```js
await entityRelationshipService.cascadeDeleteEntity(id, contextId); // edges first
await entityService.deleteEntity(id, contextId);                     // then the row
```

Calling `deleteEntity` alone fails for any nested row with
`ER_ROW_IS_REFERENCED_2`, because `entity_relationships` declares its foreign
keys `ON DELETE NO ACTION`. `deleteEntity` clears the legacy↔entity bridge
junctions but not the relationship edges.

Note that Dailies work items and Templates live in **legacy tables**
(`work_items`, `work_item_templates`), not in `entities`, so clearing the entity
types does not touch them — and clearing them needs its own pass.

## Why the guard set is the list

From "The guard set" in `CLAUDE_TESTING.md`. Context, not action.

It was previously written down twice — once in this file as a table of "specs
worth trusting", once in `CLAUDE_CARRY_ON.md` §4 as "the guard set" — and the
two overlapped on exactly one spec. Neither was wrong so much as partial, and
having two meant a change could be checked against whichever list happened to
be read. They are merged into the one list in `CLAUDE_TESTING.md`.

## Traps the guard set has caught, in itself

From "The guard set" in `CLAUDE_TESTING.md`. Read before writing a new
Playwright spec, or when a result looks surprising — most of these read as an
app bug on first sight and are not one.

- **A spec that clicks `.entity-row` first gets a folder.** Folders have
  title-only editors with no field rows, so anything asserting about fields,
  legends or toggles fails on a row that was never in scope. Scope to
  `.entity-row:not([data-is-folder="1"])`. This accounted for two long-standing
  "failures" that were never app bugs.
- **A spec that asserts before init has run measures nothing.** `ui-check`
  required a "+ Folder" button on *every* type, but `generic-entity-init.js`
  REMOVES it for flat types (`supports_hierarchy = 0`, e.g. Templates). So it
  passed only when it beat init to the DOM and failed once the page was warm -
  looking for all the world like whatever change happened to be in the tree.
  Two separate stash-and-compare attempts "attributed" it to unrelated edits
  before the race was spotted. If a result flips on run order, suspect the
  spec's timing before you suspect the diff.
- **A row locator built from TEXT can match an ancestor.** A folder's
  `.entity-row` contains its nested rows once something is inside it, so
  `.entity-row` + `hasText` matches the outer folder as well as the row you
  meant - and `.first()` picks the outer one. Address rows by
  `[data-entity-id="..."]`. This single mistake was reported as a Goals
  drag-and-drop regression for several sessions.
- **A pointer drag cannot always reach its target.** On the widest types a row
  is hundreds of pixels tall in a narrow pane, so the band being aimed for can
  sit past the fold. Drive nesting with drag EVENTS; the drop handler receives
  the same thing either way.
- **`toHaveClass(/selected/)` also matches `multi-selected`.** Two different
  states, one substring. Use `classList.contains('selected')`.
- **A stale allow-list reports a working feature as broken.** `RENDERED_TYPES`
  in `entity-type-integrity.spec.js` omitted `priority`, which has had a
  renderer all along, so the spec claimed there wasn't one.
- **`dblclick()` is not reliably a double-click.** It sends two clicks and
  leaves it to the BROWSER to decide whether they were close enough together to
  also be a `dblclick`. Under load - and a full guard run is exactly that - they
  can fall outside that threshold, no `dblclick` event fires at all, and
  whatever the app opens on `dblclick` never opens. The assertion after it then
  reports an app bug that is not there. This produced a failure that went red
  three runs in a row, green the next twenty-two, and could not be reproduced
  afterwards. Splitting a `dblclick()` into two `click()` calls reproduces it on
  demand. **Use `tests/e2e/dblclick.js`, which dispatches the event** - the same
  reasoning as driving nesting with drag EVENTS, two traps above. It fires no
  clicks of its own, so where a test depends on the click's side effects
  (selection, or scheduling the deferred expand that the double-click cancels),
  click first and say so.

## Browser testing after changes

From `CLAUDE_TESTING.md`. The general "test UI changes in a browser before
reporting done" rule is already standing instruction outside this repo; kept
here is the project-specific part: which command to run and what to fix.

**Always test UI changes in a real browser before pushing.** Start the dev
server (`npm run dev`) and verify the feature works end to end. Type checking
and tests verify code correctness, not feature correctness.

After any significant change (new features, bug fixes, security updates), also
run Playwright to check for browser errors:

```bash
npx playwright test tests/e2e/debug.spec.js  # Quick check for CSP and JS errors
npx playwright test                          # Full suite (slower but catches more)
```

Fix any console errors (CSP violations, unhandled exceptions, etc.) before
committing. CSP violations in particular indicate security policy conflicts that
need resolution.

## Editable types (data types): what the headed run verifies

From "Editable types (data types)" in `CLAUDE_TESTING.md`. Read when
modifying `generic-entity-tab.ejs`, `genericEntity.js`,
`generic-entity-init.js`, `entityService.js`, or `systemEntityTypes.js`.

**ALWAYS run these in headed mode when modifying any editable type page**
(Categories, Goals, Todos, Tasks, Tickets, Ideas, Projects):

```bash
npx playwright test tests/e2e/editable-types.spec.js --headed
```

They verify: UI elements present (add button, folder button, expand/collapse);
expand/collapse tree navigation; folder creation; and tab layout centring.

**Do not commit changes to editable type templates or code without running
these headed.** They catch duplicate IDs, missing event handlers and broken form
rendering that static analysis misses.

Files that require this testing when touched:

- `src/views/tabs/generic-entity-tab.ejs` — generic template for all editable types
- `src/public/js/genericEntity.js` — generic renderer and editor
- `src/public/js/generic-entity-init.js` — per-tab wiring
- `src/services/entityService.js` — entity CRUD
- `src/database/systemEntityTypes.js` — the canonical type definitions
- `tests/e2e/editable-types.spec.js` — the tests themselves

## Reading a run: the rate limiter gotcha

From "Reading a run" in `CLAUDE_TESTING.md`. Read when a heavy run fails with
`window.APP_CONFIG` undefined or similar missing-config errors.

**Heavy runs trip the rate limiter**, which surfaces confusingly as
`window.APP_CONFIG` being undefined: a rate-limited page load never returns real
HTML, so every test fails on missing config rather than on anything real.
`RATE_LIMIT_ENABLED` is `false` in `.env.local` for this reason. If it needs to
go back on locally, raise `RATE_LIMIT_MAX_REQUESTS` rather than flipping the flag.

## Current state of the suite (snapshot, 2026-08-18)

From `CLAUDE_TESTING.md`. A point-in-time snapshot, not a live status — read
when triaging a suite-wide run to judge whether a failure count looks like the
known baseline or something new.

As of 2026-08-18: **162 failed / 192 passed / 2 did not run** (356 results,
~12 min).

The failures are overwhelmingly **stale specs asserting against UI that was
deliberately deleted**, not app bugs:

| Stale locator | Failures | Why it no longer exists |
|---|---|---|
| `#addAreaBtn`, `#addGoalBtn`, `#addTaskBtn`, `#addTicketBtn`, `#addIdeaBtn` | 35 | Capitalized ids the generic template has never generated |
| `[data-tab="todos"]` / `[data-tab="todo"]` | 24 | The tab is `to_do`; the bespoke tab was deleted |
| `.draggable-modal` | 19 | The type editor is a split-pane now |

`editable-types-comprehensive.spec.js` alone accounts for 48 — about a third —
and is the same class throughout.

Genuine app-level errors left: **5 CSRF 403s** and **5 scattered
`Cannot read properties of undefined` reads**.

The guard set above is the list to trust; everything else in the suite is
triage.

Deciding which of the stale specs to retire and which to rewrite is tracked as
open work in `CLAUDE_CARRY_ON.md`.
