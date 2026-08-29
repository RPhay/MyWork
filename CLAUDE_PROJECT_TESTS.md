# CLAUDE_PROJECT_TESTS.md

What is specific to THIS project about testing it: the commands, the tiers and
what is in them, the guard set, the measured baseline, and the incidents worth
remembering.

The generic practice — when to ask before a broad run, how to read a run, not
overlapping two runs, and how to clean up after one — is not here. It lives in
`.claude/skills/run-tests`, which reads this file for everything above and can
be carried to another project unchanged.

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

**Any run that creates rows must delete them again before you finish.** Not
optional tidiness — the database is the user's real working data, and test
rows are indistinguishable from real ones once sitting in a tab. (Written after
rows accumulated into the hundreds — history: the **Reference** half of this file.)

**The rules themselves are generic and live in `.claude/skills/run-tests`** —
teardown in a hook, prefix what you create, delete by ID and never by name,
back up before a bulk delete, leave rows older than the run alone. They were
moved there because none of them are about MyWork, and a skill can be carried
to another project. Read that file before deleting anything.

Two of them cost real data here, and the incidents are worth keeping where they
happened:

- **Delete by ID, never by NAME.** `dailies-root.spec.js` swept everything
  titled `New daily` on 2026-08-27 and hard-deleted a daily the USER had made.
  The app assigns that title, so their own unnamed rows carry it too — and the
  teardown did BOTH calls (`/api/dailies/:id` then `/api/trash/:id`), so it was
  not even left in the bin to restore.
- **A soft delete is not a delete.** `/api/entities/:type/:id` sets
  `deleted_at`; only `/api/trash/:id` removes the row.

What is specific to this app:

- **Clicking "+ <Type>" CREATES a row**, as of 2026-08-27 — it used to open the
  editor on an unsaved blank — so a spec that clicks it leaves a real
  `New <Type>` row behind even if it never saves. Those carry no `ZZZ` prefix,
  so `global-teardown.js` cannot identify them by name; it sweeps only
  placeholder-titled rows created AFTER the run started, stamped from the
  database clock in `global-setup.js`.
- **Back up to `data/entity-backup-<timestamp>.json`** — dump the affected
  `entities`, `entity_field_values` and `entity_relationships` rows first
  (`data/` is gitignored).

Specs already verified clean, the specs known to leak, and the two-step
delete order needed to clean up by hand: the **Reference** half of this file.

---

## The guard set

**Run this after any change you intend to commit, and the FULL SUITE before you
push.** Lives here and nowhere else - `CLAUDE.md` imports this file, and
`CLAUDE_CARRY_ON.md` points at it rather than restating it.

```bash
npm run test:unit          # the MSSQL translation layer
npx playwright test \
  tests/e2e/schema-fix.spec.js \
  tests/e2e/generic-entity-engine.spec.js \
  tests/e2e/entity-type-integrity.spec.js \
  tests/e2e/type-editor-roundtrip.spec.js \
  tests/e2e/retired-tables-drop.spec.js \
  tests/e2e/entity-field-types.spec.js \
  tests/e2e/entity-editor-behaviour.spec.js \
  tests/e2e/editable-types-comprehensive.spec.js \
  tests/e2e/rollup-depth.spec.js \
  tests/e2e/time-box.spec.js \
  tests/e2e/worked-time.spec.js \
  tests/e2e/priority-field.spec.js \
  tests/e2e/reporting.spec.js \
  tests/e2e/dailies-root.spec.js \
  tests/e2e/recently-deleted.spec.js \
  tests/e2e/search-palette.spec.js \
  tests/e2e/priorities-rail.spec.js \
  tests/e2e/rail-selection.spec.js \
  tests/e2e/column-fit.spec.js \
  tests/e2e/column-reorder-editor-sync.spec.js \
  tests/e2e/row-icon-sizing.spec.js \
  tests/e2e/drag-protocol.spec.js \
  tests/e2e/context-folder-drag.spec.js \
  tests/e2e/hover-help.spec.js \
  tests/e2e/debug.spec.js \
  tests/e2e/ui-check.spec.js
```

**~9 minutes** - measured 2026-08-28: 42 unit tests in 2.6s, then 130 e2e
passed and 4 skipped in 8.6m. This tier exists to be fast enough to run without
thinking about it, not to be a substitute for the suite (~29m).

That figure was written down twice and wrongly both times - `~8 minutes` here
and `~13m` in the tiers table - which is how it went unnoticed that neither had
been measured since the set was re-chosen. It is measured now, and it lives in
BOTH places only because the table is a summary; change one, change the other.

### Why this list and not the old one

The old set was chosen when everything outside it was noise, and it was never
re-examined after that stopped being true. Measured on 2026-08-26, it cost 13.8
of the suite's 26.1 minutes - 53% of the time for 50% of the tests, which is
close to no saving at all - and, more to the point, it did not catch things.

Nine specs found a REAL defect in the app on 2026-08-26. Eight of them were not
in the guard set:

| spec | was in the set? | what it found |
|---|---|---|
| `schema-fix` | no | four retired tables reported as MISSING |
| `rollup-depth` | no | all 130 fields had `rollup = NULL`; folders rolled up nothing |
| `dailies-root` | no | `dataset.dailyId` undefined across 14 call sites |
| `time-box` | no | a user-created type got none of the engine's fields |
| `worked-time` | no | Templates carrying a focus block they must not have |
| `hover-help` | no | a control shipped with no hover help |
| `priority-field` | no | a leaked test field gave every Ideas row two priority cells |
| `reporting` | no | (added after: the report was missing half its rows and passed) |
| `entity-type-integrity` | **yes** | field/type consistency |

They are cheap. All ten promotions together cost **2.9 minutes** - `schema-fix`
is one second, `generic-entity-engine` is three for eighteen tests.

**`generic-entity-crud` (5.1m) and `focus-bar` (4.3m) are deliberately NOT
here.** Between them they were 567 of the old set's 828 seconds - 89% of its
cost. They are good specs and they stay in the suite; they are simply too slow
to sit in a tier whose whole purpose is being run often. The full suite covers
them before every push.

| Spec | Guards |
|---|---|
| `schema-fix` | The three schema paths, and that no retired table is still expected |
| `generic-entity-engine` | The entity API itself: create, read, update, delete, relationships |
| `entity-type-integrity` | Every field type in use has a renderer, an editor option, a label and an ENUM entry |
| `type-editor-roundtrip` | Opening a type and pressing Save changes NOTHING that was already set |
| `retired-tables-drop` | "Drop Retired Tables" asks first, and REFUSES a table holding unmigrated rows |
| `entity-field-types` | `url` / `links` / `status` / `recurrence` behaviour |
| `entity-editor-behaviour` | Editor opens/stays open, save/revert enablement, legend alignment |
| `editable-types-comprehensive` | Every editable type through create, edit and expand/collapse (30 tests) |
| `rollup-depth` | A folder reflects its DESCENDANTS, and Failed dominates |
| `time-box` | Every type carries a Time Box, one ladder of six |
| `worked-time` | Worked Time on every type except Templates, and unremovable |
| `priority-field` | Every type has one priority control, and it cycles |
| `reporting` | The status report, and that Todos & Ideas contains both |
| `dailies-root` | Records on the day itself, and dropping onto a daily |
| `recently-deleted` | Soft delete, restore, purge |
| `search-palette` | ⌘K search over titles and field values |
| `priorities-rail` | Board membership, placement, ordering |
| `rail-selection` | Which panes may share the screen, and the click-to-collapse rule |
| `column-fit` | Columns drop rather than collapse when the pane is narrow |
| `column-reorder-editor-sync` | Column order and editor field order stay one value |
| `row-icon-sizing` | Row control sizing against the delete button reference |
| `drag-protocol` | `dragDropUtils.js`'s globals resolve on every page that drags |
| `context-folder-drag` | Context folders accept a drop |
| `hover-help` | Every control that needs an explanation has one |
| `debug` | CSP and console errors |
| `ui-check` | Tab structure |
| `editable-types.spec.js` | Per-type UI elements and folders (headed - see below) |

---

## Choosing what to run

**When to ask, and when to just run it, is generic and lives in
`.claude/skills/run-tests`**: run the specs covering an individual fix without
asking; ask before anything broader. What follows is the part that is ours —
which tiers exist, what is in them, and what they cost here.

Times are wall-clock on this machine. **Measured** = observed in a real run;
**est.** = derived from measured neighbours.

| # | Tier | What it runs | Time | Use it when |
|---|---|---|---|---|
| 0 | Static | `node --check` on changed JS, `npm run lint` | **~4s** | After any JS edit. A clean tree reports NOTHING, so any output is yours |
| 1 | Unit | `npm run test:unit` | **0.4s** | Touching `mssqlTranslation.js`. 12 tests |
| 2 | Smoke | `debug` + `ui-check` + `drag-protocol` | ~20s (est.) | "Did I break the page load?" CSP, console errors, tab structure, drag globals |
| 3 | Targeted | The 1-3 specs covering the change | 5-30s | **The default while working.** `column-reorder-editor-sync` alone is 7s |
| 4 | Editor / engine | `entity-editor-behaviour`, `entity-type-integrity`, `entity-field-types`, `column-reorder-editor-sync`, `row-icon-sizing` | ~1m (est.) | Editor, field types, row rendering, the generic engine |
| 5 | Drag | `drag-protocol`, `real-drag-drop`, `template-drops`, `dailies-drop`, `dailies-any-type`, `priorities-rail` | **~1.2m** | Anything touching drag sources, drop targets or `dragDropUtils.js` |
| 6 | Guard set | The 26 specs above + `npm run test:unit` | **~9m** | Before a commit or push |
| 7 | Guard + headed | Tier 6 + `editable-types --headed` | **~9.5m** | Editable type pages or their engine — see "Editable types" |
| 8 | Full suite | `npx playwright test` | **~29m** | It is GREEN and it is worth running. See the baseline below |

Tiers 4 and 5 deliberately overlap — a generic-engine change is usually both.

**Two runs must not overlap, and source must not be edited under a run** —
both generic, both in `.claude/skills/run-tests`, which checks for a live run
before starting one. The MyWork specifics: `workers: 1` is what makes the
first true, and `nodemon.json` pins `watch` to `["server.js", "src"]`, which is
what makes editing `tests/` safe. Leave that list alone unless you mean to
widen the blast radius.

## Browser testing after changes

Test UI changes in a real browser before reporting done — a standing rule
outside this repo, so it sits in `.claude/skills/run-tests` too. The
project-specific command and what to fix on failure:
the **Reference** half of this file.

---

## Editable types (data types)

**ALWAYS run these in headed mode when modifying any editable type page**
(Categories, Goals, Todos, Tasks, Tickets, Ideas, Projects):

```bash
npx playwright test tests/e2e/editable-types.spec.js --headed
```

What it verifies, and the full file list that triggers it:
the **Reference** half of this file.

**Do not commit changes to editable type templates or code without running
these headed.**

---

## Reading a run

**How to read one is generic** — read both numbers (the line reporter prints
`N failed` ABOVE `N passed`), and attribute a failure by re-running it on a
clean tree before blaming the change in hand. Both are in
`.claude/skills/run-tests`.

One thing here is not generic: heavy runs can trip this app's rate limiter in
a way that looks like an unrelated config error. What it looks like and what
to do: the **Reference** half of this file.

---

## Current state of the suite

The guard set above is the list to trust; everything else is triage against a
large stale baseline. Snapshot: the **Reference** half of this file.

### Baseline, measured 2026-08-28

**378 tests in 73 files, 30.3 minutes: 372 passed, 2 failed, 4 skipped, 0 did
not run.** Re-measured later the same day; the run below it is kept because the
two records together are the evidence that the flake fix worked.

**`did not run` is 0, and that is the result to read first.** The previous run
ended 371 passed / 1 failed / **2 did not run**: `dailies-drop.spec.js:58`
(`task`) failed, and because that describe is `mode: 'serial'` one failure
abandoned the rest of the file. It was NOT a defect - it passed 9/9 on its own
against the same commit - and the shape recurs: a fixed `waitForTimeout` is long
enough on an idle machine and short enough under 378 tests. Replacing it with an
`expect.poll` on the assertion itself both fixed it and let its two siblings
execute, which is exactly the +1 passed and -2 did-not-run above.

The two failures in THIS run were environmental, not defects, and both passed on
re-run within the minute: the machine briefly lost connectivity, so the Chart.js
CDN script behind `reporting.ejs` never arrived and the page threw
`ReferenceError: Chart is not defined`. `debug-errors.spec.js` timed out from the
same stall. Both specs now stand down instead of failing when a network outage is
observed - see `consoleErrors.js` - so this pair should not recur.

So the number to defend is still zero REAL failures. Read `did not run`
alongside `failed`; `.claude/skills/run-tests/report.sh` prints both, which is
why it exists.

How it got here, from the first full run that could execute at all
(2026-08-25: 453 tests in 101 files, 1.8h, exit 1, 271 passed / 168 failed):

| | 2026-08-25 | 2026-08-26 | 2026-08-28 | 2026-08-28 (later) |
|---|---|---|---|---|
| passed | 271 | **353** | 371 | **372** |
| failed | **168** | **0** | 1 (a flake, since fixed) | 2 (both network) |
| did not run | - | - | 2 | **0** |
| duration | 1.8h | **26.5m** | 29.2m | 30.3m |
| files | 101 | 71 (+48 retired) | 73 | 73 |

Most of the 1.8h was failures waiting out a 30-second timeout, so fixing them
took two thirds off the clock. `editable-types-comprehensive` alone went 8.8m
to 57s, `field-sync-matrix` 180s to 19s.

Almost none of the 168 was a defect in the app. The recurring shapes, worth
recognising before reading any new failure as a bug:

1. **A rename that stopped at the suite's door.** Areas became Categories in
   the app and left 42 `/api/entities/area` call sites, five element ids and a
   `data-tab` behind. Separately, 48 failures - a third of the total - were
   `#addCategoryBtn` where the template renders `add<typeSlug>Btn`
   uncapitalised.
2. **Specs asserting behaviour that was deliberately removed** - one click
   opening the editor, native `confirm()`/`prompt()` dialogs, a type-editor
   modal that is a pane now, a bespoke Priorities page.
3. **Files that assert nothing.** 17 of the retired specs contain zero
   `expect(`; one has 34 log lines and no assertion. They could not pass or
   fail, and each cost 30 seconds to time out.
4. **The app being right and the spec being old** - the type editor's blank
   title is deliberate, and the checkbox cell's attribute is `data-value`, not
   the `data-checked` a spec read.

What WAS real, and is fixed: three junctions foreign-keyed to a dead table;
user-created types getting no engine block; roll-ups declared everywhere and
stored nowhere (all 130 fields had `rollup = NULL`); a leaked test field giving
every Ideas row two priority cells; `dataset.dailyId` reading undefined across
14 call sites; the Todos & Ideas report returning no Todos; and the schema check
reporting four retired tables as missing.

**Leaks are the maintenance cost to watch.** A spec that creates rows must
prefix them `ZZZ` and delete them with BOTH calls - `/api/entities/:type/:id`
is a soft delete and only `/api/trash/:id` removes the row. `global-teardown.js`
is the backstop for what a torn-down page cannot finish, and it sweeps leftover
field DEFINITIONS as well as rows, because those change what every row of a type
renders.

---

## Context menus: what covers them now

Two hand-written documents used to describe this - `TEST_PLAN_CONTEXT_MENU.md`
(a manual checklist) and `CONTEXT_MENU_TEST_RESULTS.md` (its results, dated
2026-08-14). Both were deleted on 2026-08-28: they reported a 6/7 and an 0/7
against a UI that has since been rebuilt, and they cited
`context-menu-comprehensive.spec.js` and `test-add-operations.spec.js`, neither
of which still exists. A checklist naming deleted specs is worse than no
checklist - it reads as coverage.

Context menus are covered by SPECS now:

| spec | covers |
|---|---|
| `entity-context-menu.spec.js` | the row menu on a typed tab |
| `row-context-behaviour.spec.js` | what a row's own gestures do |
| `cell-context-menu.spec.js` | the per-cell menu |
| `tab-context-menus.spec.js` | the tab strip's menu, and "New Folder" |
| `context-folder-drag.spec.js` | context folders as drop targets |

Two things from those documents are still TRUE and worth keeping:

- **`buildTreeHTML()` in `dailies-associations.js` carries cycle detection and
  a `MAX_DEPTH` of 50** - added after associating a category froze the menu
  with "Maximum call stack size exceeded". The hierarchy can contain cycles
  (A→B→A, or a self-reference); the guard is why that no longer hangs the page.
  Do not remove it as dead defensive code.
- **The association calls check `result.success`, not just `response.ok`.**
  They did not, once, and seven of the menu's actions failed silently while
  appearing to work.

`tests/e2e/setup-test-data.js` survives from that era and is still referenced;
the two spec files those documents named do not.

---

# Reference

Detail that would drown the sections above: the specs verified clean, the known
leaks, how to delete by hand, what each guard-set trap actually caught, and the
measured baselines. This was the **Reference** half of this file until 2026-08-28.

## Specs already verified clean

From "Clean up your test data" in `CLAUDE_PROJECT_TESTS.md`. These already clean up
after themselves — running them leaves zero rows behind, verified:
`generic-entity-crud.spec.js`, `editable-types.spec.js`,
`entity-field-types.spec.js`, `entity-type-integrity.spec.js`, `debug.spec.js`.

## The known leaks, by name

From "Clean up your test data" in `CLAUDE_PROJECT_TESTS.md`. Read before writing a
new spec that creates rows, or when deciding whether an existing spec needs a
teardown added.

At the time the cleanup rule was written, accumulated test rows had reached
**229** across Projects, Categories, Goals, Todos, Tasks, Tickets and Ideas —
83 `Test Project for Context Menu`, 125 `Test Idea for Context Menu`, and
assorted `New Area Test` / `New Goal Test` / `Test Folder <timestamp>` rows,
built up over many sessions because each one left its rows behind.

- **`tests/e2e/setup-test-data.js`** is the main one. Its `setupTestData()`
  creates `Test Project for Context Menu` and `Test Idea for Context Menu` (plus
  goals, categories, todos, tasks, tickets) on **every call**, exports no teardown,
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

From "Clean up your test data" in `CLAUDE_PROJECT_TESTS.md`. Read before deleting
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

Templates need no separate pass. They are entities of type `template`, like
everything else, so clearing entity rows clears them too. Dailies are the same:
entities of type `daily`, with `work_items` dropped on 2026-08-25.

This paragraph used to say Templates still lived in a legacy
`work_item_templates` table that a sweep would miss. **That table does not
exist** - checked on 2026-08-28, `ER_NO_SUCH_TABLE` - so the warning sent you
looking for a second pass there is nothing to do, and worse, implied a sweep of
`entities` was incomplete when it is not. The tables that actually reference
`entities`, and therefore the order a delete has to follow, are the five above:
`entity_relationships` (both `parent_entity_id` and `child_entity_id`),
`daily_entities`, `work_entity_associations`, then `entity_field_values`, then
`entities`.

## "The count went down" - how to tell a lost row from a swept one

A falling entity count is not evidence of loss, and eyeballing it is not a
check. Two runs of the suite legitimately move it by dozens, and hard deletes
leave nothing behind to read - which is why the question cannot be answered
from the database alone.

Answer it from the BACKUPS instead. `data/entity-backup-*.json` is written
before every bulk delete (rule 5 in `CLAUDE_PROJECT_TESTS.md`), so the union of ids
they record is the set of rows that existed and are now gone. Diff that against
`SELECT id FROM entities` and read the titles: a machine-shaped title
(`ZZZ...`, `DEBUG_`/`SAVEPERFECT_`/`TOGGLE_`, a trailing epoch, `Parent Item`,
`New <Type>`) is a test artifact; anything else is worth chasing.

Then confirm from the other side - nothing may point at a row that is gone:

```sql
SELECT COUNT(*) FROM entity_field_values v
  LEFT JOIN entities e ON e.id = v.entity_id WHERE e.id IS NULL;
-- and the same for entity_relationships (parent AND child),
-- daily_entities, work_entity_associations.
```

All five must be zero. A non-zero one names the missing id directly.

Done on 2026-08-27 over 22 backup files: 757 recorded ids were absent, every one
of them test residue, and all five dangling counts were zero. The 36 rows purged
from Projects that day were 33 `Test Project for Context Menu` plus `test`,
`Test` and `T2` - which is why Projects is empty and that is not a loss.

## Why the guard set is the list

From "The guard set" in `CLAUDE_PROJECT_TESTS.md`. Context, not action.

It was previously written down twice — once in this file as a table of "specs
worth trusting", once in `CLAUDE_CARRY_ON.md` §4 as "the guard set" — and the
two overlapped on exactly one spec. Neither was wrong so much as partial, and
having two meant a change could be checked against whichever list happened to
be read. They are merged into the one list in `CLAUDE_PROJECT_TESTS.md`.

## Traps the guard set has caught, in itself

From "The guard set" in `CLAUDE_PROJECT_TESTS.md`. Read before writing a new
Playwright spec, or when a result looks surprising — most of these read as an
app bug on first sight and are not one.

- **A spec that asserts NOTHING cannot fail, and reads as coverage anyway.**
  `debug.spec.js` sat in the guard set with the table claiming it guarded "CSP
  and console errors" while containing zero `expect(` - it collected errors,
  printed them, and ended. `debug-errors.spec.js` was the same. Neither could
  fail however badly the page broke; the only failure either could produce was a
  timeout, which is how one of them reported a network outage as a defect on
  2026-08-28. Both assert now. When triaging, `grep -c 'expect(' <spec>` before
  trusting a green tick - the count is the coverage.
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

From `CLAUDE_PROJECT_TESTS.md`. The general "test UI changes in a browser before
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

From "Editable types (data types)" in `CLAUDE_PROJECT_TESTS.md`. Read when
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

From "Reading a run" in `CLAUDE_PROJECT_TESTS.md`. Read when a heavy run fails with
`window.APP_CONFIG` undefined or similar missing-config errors.

**Heavy runs trip the rate limiter**, which surfaces confusingly as
`window.APP_CONFIG` being undefined: a rate-limited page load never returns real
HTML, so every test fails on missing config rather than on anything real.
`RATE_LIMIT_ENABLED` is `false` in `.env.local` for this reason. If it needs to
go back on locally, raise `RATE_LIMIT_MAX_REQUESTS` rather than flipping the flag.

## Current state of the suite (snapshot, 2026-08-18)

From `CLAUDE_PROJECT_TESTS.md`. A point-in-time snapshot, not a live status — read
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
