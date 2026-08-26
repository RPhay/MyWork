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
| 8 | Full suite | `npx playwright test` | **~1.8h** | Rarely. Mostly stale specs; see the baseline below for what the number means |

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

### Baseline, measured 2026-08-25

**453 tests in 101 files, 1.8h, exit 1: 271 passed, 168 failed, 2 skipped,
12 did not run.** The number to compare against is not the total - it is this:

| | passed | failed |
|---|---|---|
| Guard set (17 files) | **178** | **0** |
| Everything else (84 files) | 93 | 168 |

**The guard set is green inside a full run.** Every failure in the suite is
outside it. That is what makes the guard set worth trusting and the total
worth ignoring.

Before this, `npx playwright test` **could not run at all** - see the note on
`testIgnore` in `playwright.config.js`. The "~12.3m" this table used to claim
for tier 8 was not measurable against the tree it described.

Three causes account for nearly every failure, and only the third is a defect:

1. **Stale selectors** - the app changed, the spec did not. `dailies.spec.js`
   (12), `comprehensive-test.spec.js` (10) and `editable-types-comprehensive.spec.js`
   (48, a third of all failures) are the bulk of it. Retirement candidates.
2. **A missing fixture type.** `dailies-any-type`, `reference-sync` and
   `template-drops` POST to `/api/entities/tests`, a user-created type with
   slug `tests` that DOES NOT EXIST in the database. The create returns no
   `data`, so the spec throws `Cannot read properties of undefined (reading
   'id')` - 12 failures across 5 files, all from one absent row. They cannot
   create it themselves and delete it after, because deleting a TYPE is a soft
   delete that reserves the slug permanently.
3. **Genuine assertion failures worth reading** - `rollup-depth` ("a failed
   grandchild must surface on the folder"), `time-box` ("all types carry one"),
   `work-item-associations` ("associating a category should succeed"). These
   state app behaviour, not selectors.

**The run leaked 83 rows** (49 `ZZZ`, 34 named by stale specs that predate the
convention). Six of the leakers - `template-drops`, `row-context-behaviour`,
`rollup-depth`, `board-time`, `worked-time`, `time-box` - have a correct
`afterEach` AND a hard delete, and leaked anyway: their cleanup runs through
`page.evaluate`, so a test that times out takes the page and the teardown with
it. That is why `global-teardown.js` exists, and why it talks to the database
rather than the browser.
