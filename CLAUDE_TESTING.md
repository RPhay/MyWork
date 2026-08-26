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

**Any run that creates rows must delete them again before you finish.** Not
optional tidiness — the database is the user's real working data, and test
rows are indistinguishable from real ones once sitting in a tab. (Written after
rows accumulated into the hundreds — history: `CLAUDE_TESTING_REFERENCE.md`.)

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

Specs already verified clean, the specs known to leak, and the two-step
delete order needed to clean up by hand: `CLAUDE_TESTING_REFERENCE.md`.

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

**~7 minutes.** The full suite is 26 and green, so this tier exists to be fast
enough to run without thinking about it - not to be a substitute for the suite.

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

## Choosing what to run — ask first

Two rules, covering different runs:

1. **Always run the specs covering an individual fix — without asking.** A fix
   is not finished until they have been run, and reporting it as done before
   that is reporting an unverified claim.
2. **Always ask before a BROAD run** — anything above the specs covering the
   change in hand. Show this table, name the tier, and wait for an answer.

Breadth is what costs the user: a broad run spends 6-12 minutes, and every e2e
run writes to the user's REAL database — never a read-only diagnostic.

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
| 6 | Guard set | The 15 specs above + `npm run test:unit` | **~13m** | Before a commit or push |
| 7 | Guard + headed | Tier 6 + `editable-types --headed` | ~8m (est.) | Editable type pages or their engine — see "Editable types" |
| 8 | Full suite | `npx playwright test` | **~27m** | It is GREEN and it is worth running. See the baseline below |

Tiers 4 and 5 deliberately overlap — a generic-engine change is usually both.

**Two runs must not overlap.** Every Playwright process shares the one
database (`workers: 1` exists for this reason); a second run beside one
already in flight collides the way parallel workers did.

**Do not edit files under `src/` or `server.js` while a run is in flight.**
Playwright starts `npm run dev`, so a save restarts nodemon underneath the
browser and the specs mid-flight fail for reasons that have nothing to do with
them. Four runs were thrown away to this before it was written down. Editing
`tests/` is safe - `nodemon.json` pins `watch` to `["server.js", "src"]` for
exactly this reason, so leave that list alone unless you mean to widen the
blast radius.

## Browser testing after changes

Test UI changes in a real browser before reporting done (already a standing
rule outside this repo). The project-specific command and what to fix on
failure: `CLAUDE_TESTING_REFERENCE.md`.

---

## Editable types (data types)

**ALWAYS run these in headed mode when modifying any editable type page**
(Categories, Goals, Todos, Tasks, Tickets, Ideas, Projects):

```bash
npx playwright test tests/e2e/editable-types.spec.js --headed
```

What it verifies, and the full file list that triggers it:
`CLAUDE_TESTING_REFERENCE.md`.

**Do not commit changes to editable type templates or code without running
these headed.**

---

## Reading a run

**Read both numbers before calling a run green.** The line reporter prints
`N failed` *above* `N passed`, so a truncated log shows only the pass count
and a badly failing run looks clean.

**A suite-wide pass/fail count means nothing without a baseline** — large
parts of the suite assert against UI that was deliberately removed, so a high
failure count is expected. To attribute a failure: stash the change, re-run
the same spec, compare — the comparison tells you whether it's yours, the raw
count doesn't.

Heavy runs can trip the rate limiter in a way that looks like an unrelated
config error: `CLAUDE_TESTING_REFERENCE.md`.

---

## Current state of the suite

The guard set above is the list to trust; everything else is triage against a
large stale baseline. Snapshot: `CLAUDE_TESTING_REFERENCE.md`.

### Baseline, measured 2026-08-26

**354 tests in 71 files, 26.5 minutes, exit 0: 353 passed, 0 failed, 1 skipped.**

The full suite is green. That is new, and it is the number to defend: any
failure now is something the change in hand did, which is exactly what the
count could never mean before.

How it got here, from the first full run that could execute at all
(2026-08-25: 453 tests in 101 files, 1.8h, exit 1, 271 passed / 168 failed):

| | 2026-08-25 | 2026-08-26 |
|---|---|---|
| passed | 271 | **353** |
| failed | **168** | **0** |
| duration | 1.8h | **26.5m** |
| files | 101 | 71 (+48 retired) |

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
