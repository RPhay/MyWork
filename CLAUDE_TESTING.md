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

**This is the list. Run it to check a clean checkout, and after any change you
intend to commit.** Lives here and nowhere else — `CLAUDE.md` imports this
file, `CLAUDE_CARRY_ON.md` points at it rather than restating it.

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
  tests/e2e/ui-check.spec.js \
  tests/e2e/rail-selection.spec.js \
  tests/e2e/column-fit.spec.js
```

Plus, **headed**, whenever an editable type page or its engine is touched —
see "Editable types" below for the command and file list.

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
| `rail-selection.spec.js` | Which panes may share the screen, and the click-to-toggle rule |
| `column-fit.spec.js` | Columns drop rather than collapse when the pane is narrow |
| `editable-types.spec.js` | Per-type UI elements and folders (headed) |

Why it's a merged list, and the traps it's caught in itself (read before
writing a new spec, or when a result looks surprising): `CLAUDE_TESTING_REFERENCE.md`.

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
