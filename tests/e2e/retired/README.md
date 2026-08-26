# Retired specs

These are not run, because `playwright.config.js` sets
`testIgnore: '**/retired/**'`. Moving a file here takes it out of the suite
without deleting the record of what it once checked.

That line was added on 2026-08-25. Until then this file claimed retirement
worked because "the config matches `tests/e2e/*.spec.js`, and this directory is
one level down" - which was never true. There was no `testMatch`, only
`testDir`, whose default pattern recurses, so every spec in here was still
being collected. Five of them import a `./setup-test-data.js` that stayed
behind in `tests/e2e/` when they moved, so collection threw and `npx playwright
test` could not run AT ALL. Nobody noticed for as long as they did because the
guard set names its specs explicitly and never collects this directory.

## Why each is here

**Asserts against UI that was deliberately removed** — these can never pass
again, so a failure from them means nothing:

- `test-entity-type-editor`, `test-entity-type-workflow`, `test-modal-maximize`,
  `real-test`, `context-menu-comprehensive` — the type editor was a
  `.draggable-modal`; it is a split pane now.
- `todos-test`, `test-todos-debug`, `test-todos-only`, `visual-test`,
  `visual-expand-test`, `visual-confirmation` — `[data-tab="todos"]` and the
  bespoke Todos page. The tab is `to_do` and runs on the generic engine.
- `test-entity-type-sections`, `test-field-types` — capitalised ids
  (`#addAreaBtn`) the generic template has never generated.

**Superseded, and a source of leaked rows** — `verify-associations`,
`test-add-operations`, `debug-goal`, `debug-association-data`,
`debug-failing-associations` all import `setup-test-data.js`, which creates
records on every call and exports no teardown. It accounted for 208 of the 229
rows purged on 2026-08-18. What they covered is covered by
`generic-entity-crud`, `dailies-any-type` and `dailies-drop`, which clean up
after themselves.

## Before restoring one

Read it against the app as it is now, not as it was. Most of these fail on a
selector, not on a defect — the app changed and they did not.

## The convention worth keeping

Fixtures are prefixed `ZZZ` so leftovers are identifiable and sort to the
bottom, and every spec that creates rows removes them again (see
`helpers/cleanup.js` — the API delete is a SOFT delete, so real cleanup is two
calls). A spec that cannot clean up after itself belongs here, not in the suite.
