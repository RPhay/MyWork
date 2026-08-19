# CLAUDE_TESTING.md

Everything about testing this project: how to run it, what to run when, how to
read the results, and how to leave the database as you found it.

`CLAUDE.md` points here rather than duplicating any of it.

---

## Commands

```bash
npm test                 # Jest (no unit tests exist yet; the suite is empty)
npm run test:watch       # Jest watch mode
npx playwright test      # Full e2e suite (tests/e2e/*.spec.js); auto-starts `npm run dev`
npx playwright test tests/e2e/dailies.spec.js          # A single spec
npx playwright test tests/e2e/debug.spec.js            # Quick CSP / console-error check
npx playwright test tests/e2e/editable-types.spec.js --headed
```

---

## Clean up your test data

**Any run that creates rows must delete them again before you finish.** This is
not optional tidiness — the database is the user's real working data, and test
rows are indistinguishable from real ones once they are sitting in a tab.

At the time of writing this rule, accumulated test rows had reached **229**
across Projects, Categories, Goals, Todos, Tasks, Tickets and Ideas — 83
`Test Project for Context Menu`, 125 `Test Idea for Context Menu`, and assorted
`New Area Test` / `New Goal Test` / `Test Folder <timestamp>` rows, built up over
many sessions because each one left its rows behind.

Rules:

1. **Put teardown in an `afterEach`/`afterAll` hook, never at the end of the
   test body.** A spec that deletes its rows on the last line still leaks every
   time an assertion fails earlier — which is most of how this accumulated.
2. **Prefix every created record with `ZZZ`** so leftovers are identifiable and
   sort to the bottom.
3. **After any manual or ad-hoc browser verification, delete the rows you
   created.** Check each typed tab, not just the one you were working in.
4. **Back up before a bulk delete.** Dump the affected `entities`,
   `entity_field_values` and `entity_relationships` rows to
   `data/entity-backup-<timestamp>.json` first (`data/` is gitignored).

These already clean up after themselves — running them leaves zero rows behind,
verified: `generic-entity-crud.spec.js`, `editable-types.spec.js`,
`entity-field-types.spec.js`, `entity-type-integrity.spec.js`, `debug.spec.js`.

### The known leaks, by name

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

### How to delete

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

---

## Browser testing after changes

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

---

## Editable types (data types)

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

---

## Reading a run

**Read both numbers before calling a run green.** The line reporter prints
`N failed` *above* `N passed`, so a tailed or truncated log shows only the pass
count and a badly failing run looks clean. Check the failure count explicitly.

**A suite-wide pass/fail count means nothing without a baseline.** Large parts
of the suite assert against UI that was deliberately removed, so a high failure
count is expected and is *not* evidence that your change broke something. To
attribute a failure: stash the change, re-run the same spec, compare. That
comparison — not the raw number — tells you whether it is yours.

**Heavy runs trip the rate limiter**, which surfaces confusingly as
`window.APP_CONFIG` being undefined: a rate-limited page load never returns real
HTML, so every test fails on missing config rather than on anything real.
`RATE_LIMIT_ENABLED` is `false` in `.env.local` for this reason. If it needs to
go back on locally, raise `RATE_LIMIT_MAX_REQUESTS` rather than flipping the flag.

---

## Current state of the suite

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

These specs pass and are the ones worth trusting as guards:

| Spec | Guards |
|---|---|
| `generic-entity-crud.spec.js` | 77 tests, all 7 typed pages through one code path |
| `editable-types.spec.js` | 19, headed; per-type UI elements and folders |
| `entity-type-integrity.spec.js` | Field types have renderers/options/ENUM entries; hierarchy types have self-nesting rules |
| `entity-field-types.spec.js` | `url` / `links` / `status` / `recurrence` field types |
| `debug.spec.js` | CSP and console errors |
| `ui-check.spec.js` | Tab structure, derived from the rendered tabs |

Deciding which of the stale specs to retire and which to rewrite is tracked as
open work in `CLAUDE_CARRY_ON.md`.
