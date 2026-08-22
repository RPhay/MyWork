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

## The guard set

**This is the list. Run it to check a clean checkout, and after any change you
intend to commit.** It lives here and nowhere else — `CLAUDE.md` imports this
file, and `CLAUDE_CARRY_ON.md` points at it rather than restating it.

```bash
npm run test:unit          # the MSSQL translation layer
npx playwright test \
  tests/e2e/generic-entity-crud.spec.js \
  tests/e2e/entity-editor-behaviour.spec.js \
  tests/e2e/entity-type-integrity.spec.js \
  tests/e2e/entity-field-types.spec.js \
  tests/e2e/focus-bar.spec.js \
  tests/e2e/search-palette.spec.js \
  tests/e2e/recently-deleted.spec.js \
  tests/e2e/priorities-rail.spec.js \
  tests/e2e/row-icon-sizing.spec.js \
  tests/e2e/drag-protocol.spec.js \
  tests/e2e/column-reorder-editor-sync.spec.js \
  tests/e2e/debug.spec.js \
  tests/e2e/ui-check.spec.js
```

Plus, **headed**, whenever an editable type page or its engine is touched — see
the file list in "Editable types" below:

```bash
npx playwright test tests/e2e/editable-types.spec.js --headed
```

| Spec | Guards |
|---|---|
| `generic-entity-crud.spec.js` | All typed pages through the one code path |
| `entity-editor-behaviour.spec.js` | Editor opens/stays open, save/revert enablement, legend aligns with its switches |
| `entity-type-integrity.spec.js` | Every field type in use has a renderer, an editor option, a display label and an ENUM entry |
| `entity-field-types.spec.js` | `url` / `links` / `status` / `recurrence` behaviour |
| `focus-bar.spec.js` | Pinning, the three-item cap, the timer |
| `search-palette.spec.js` | ⌘K search over titles and field values |
| `recently-deleted.spec.js` | Soft delete, restore, purge |
| `priorities-rail.spec.js` | Board membership, placement, ordering |
| `row-icon-sizing.spec.js` | Row control sizing against the delete button reference |
| `drag-protocol.spec.js` | `dragDropUtils.js`'s globals resolve on every page that drags |
| `column-reorder-editor-sync.spec.js` | Column order and editor field order stay one value |
| `debug.spec.js` | CSP and console errors |
| `ui-check.spec.js` | Tab structure |
| `editable-types.spec.js` | Per-type UI elements and folders (headed) |

### Why this list is the list

It was previously written down twice — once in this file as a table of "specs
worth trusting", once in `CLAUDE_CARRY_ON.md` §4 as "the guard set" — and the
two overlapped on exactly one spec. Neither was wrong so much as partial, and
having two meant a change could be checked against whichever list happened to
be read. They are merged above.

### Traps this set has caught, in itself

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

---

## Choosing what to run — ask first

Two rules, covering different runs:

1. **Always run the specs covering an individual fix — without asking.** A fix
   is not finished until they have been run, and reporting it as done before
   that is reporting an unverified claim.
2. **Always ask before a BROAD run** — anything above the specs covering the
   change in hand. Show this table, name the tier, and wait for an answer.

Breadth is what costs the user: a broad run spends 6-12 minutes of session
time, and every e2e run writes to the user's REAL database, so it is never a
read-only diagnostic.

Times are wall-clock on this machine. **Measured** ones were observed in a real
run; **est.** ones are derived from the specs' measured neighbours.

| # | Tier | What it runs | Time | Use it when |
|---|---|---|---|---|
| 0 | Static | `node --check` on changed JS, `npm run lint` | ~5s (est.) | After any JS edit. Catches syntax, nothing else |
| 1 | Unit | `npm run test:unit` | **0.4s** | Touching `mssqlTranslation.js`. 12 tests |
| 2 | Smoke | `debug` + `ui-check` + `drag-protocol` | ~20s (est.) | "Did I break the page load?" CSP, console errors, tab structure, drag globals |
| 3 | Targeted | The 1-3 specs covering the change | 5-30s | **The default while working.** `column-reorder-editor-sync` alone is 7s |
| 4 | Editor / engine | `entity-editor-behaviour`, `entity-type-integrity`, `entity-field-types`, `column-reorder-editor-sync`, `row-icon-sizing` | ~1m (est.) | Editor, field types, row rendering, the generic engine |
| 5 | Drag | `drag-protocol`, `real-drag-drop`, `template-drops`, `dailies-drop`, `dailies-any-type`, `priorities-rail` | **~1.2m** | Anything touching drag sources, drop targets or `dragDropUtils.js` |
| 6 | Guard set | The 13 specs above + `npm run test:unit` | **6.2m** | Before a commit or push |
| 7 | Guard + headed | Tier 6 + `editable-types --headed` | ~8m (est.) | Editable type pages or their engine — see "Editable types" |
| 8 | Full suite | `npx playwright test` | **~12.3m** | Rarely. Mostly stale specs; the number needs a baseline to mean anything |

Tiers 4 and 5 overlap deliberately — a change to the generic engine is usually
both.

**Two runs must not overlap.** Every Playwright process shares the one database,
which is why `workers: 1` exists; starting a second run beside one already in
flight collides the same way parallel workers did.

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

The guard set above is the list to trust; everything else in the suite is
triage.

Deciding which of the stale specs to retire and which to rewrite is tracked as
open work in `CLAUDE_CARRY_ON.md`.
