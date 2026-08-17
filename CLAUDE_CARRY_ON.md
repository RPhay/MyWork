# Carry On: UI Standards Convergence

Working from the approved plan at `/Users/aslynn/.claude/plans/gleaming-orbiting-yao.md` (also see `UI_STANDARDS.md` at repo root for the underlying conventions doc). This replaces the previous carry-on note (child item editor / expand toggle bug) — that work is now folded in below, since the expand-toggle bug appears resolved as a side effect of Phase 2 (see below).

## COMPLETED ✅

**Phase 1 — shared change-tracker utility.** New `src/public/js/changeTracker.js`; all 6 `editors/*.js` files plus `areas.js` and `dailies.js` migrated onto it. Verified via the full Playwright e2e suite (multiple clean passes) and targeted browser smoke tests.

**Real pre-existing bugs found and fixed along the way** (all confirmed present on unmodified code via `git stash` before touching anything — not caused by this refactor):
- `dashboard.ejs` doesn't use `layouts/main.ejs` (that file is dead — no route renders it). `changeTracker.js` had to be loaded from `dashboard.ejs` directly, first thing in `<body>`, since tab partials load their own editor scripts inline before `dashboard.ejs`'s own trailing scripts.
- `TaskEditor.js`: `populate()` compared a string DOM id against numeric cached ids with `===`, always failing — fixed with `String()` comparison.
- **Global function name collisions**: this app has no module system, so every `<script>` shares one scope. `dailies.js` declared its own `editArea`/`editPriority`/`editTemplate`/`editTicket`/`editIdea`/`editGoal`/`setupDragListeners`, silently shadowing the real same-named functions in `areas.js`/`priorities.js`/`templates.js`/`tickets.js`/`brainstorming.js`/`goals.js`/`tasks.js` because `dailies.js` loads last. Renamed `dailies.js`'s versions to `editChild*`/`setupTaskDragListeners`.
- A follow-up sweep for ALL duplicate top-level function names turned up 14 more pairs; audited each (see prior chat turn for the full table). **7 were real bugs**, now fixed:
  - `renderToDoInTree`, `renderGoalInTree`, `getDescendantIds`, `clearDropTargets` in `priorities.js` renamed to `renderPriority*`/`getPriorityDescendantIds`/`clearPriorityDropTargets` (were being shadowed by `tickets.js`/`areas.js`).
  - Dead vestigial `createTemplateFromEmail`/`createTemplateFromCalendarEvent` in `dailies.js` deleted (were shadowing `templates.js`'s/`dragDropUtils.js`'s actively-used versions; `dailies.js` never called its own).
  - Dead `createIdeaFromEmail` in `dragDropUtils.js` deleted (was shadowing `brainstorming.js`'s actively-used version).
  - 7 other pairs were judged harmless (identical implementations or already-dead code) and left alone.
- `priorities.js`: the `if (!PriorityEditor.toggleOnSameRow(id)) editPriority(id)` click-handler pattern couldn't distinguish "different row" from "same row with unsaved changes," so re-clicking a dirty row silently clobbered the draft instead of leaving it alone. Fixed by exposing `PriorityEditor.currentPriorityId` and checking it explicitly.

**Phase 2 — tree expand/collapse convergence.** `tasks.js` and `dailies.js` migrated to the CSS-only expand/collapse pattern (`areas.js`'s: children always in the DOM, only `.expanded` class toggles, no re-render). Verified via e2e suite (30 passed) and smoke tests — parent/child expand works correctly, **including on non-first items**, which is notable: the previously-documented "Dailies expand only works on the first work item" bug (from the prior carry-on note) appears to have been resolved as a side effect of removing the full re-render from `toggleWorkItem()`. This wasn't a fix I set out to make — worth an independent re-check before fully trusting it fixed.

## IN PROGRESS — Phase 3 (Dailies field-mapping centralization)

Code is written: added `CHILD_ITEM_FIELD_MAP` / `CHILD_ITEM_FIELD_TO_GROUP_ID` to `dailies.js`, refactored both `loadChildItemForEditing()` and the child-item save handler to read from that one table instead of two independently-maintained if/else chains. Syntax-checked (`node --check` passes) and self-reviewed line-by-line against the plan — the two original branches agreed with each other (no drift to reconcile), matching the plan's first-pass field table exactly.

**NOT YET BROWSER-VERIFIED.** Mid-way through a smoke test (open each of the 8 child-item types in Dailies, confirm right fields show, save round-trip works), `window.APP_CONFIG` came back `undefined` in a fresh Playwright session, and API calls started failing with `403 CSRF Error`. Right as this note was being written, a direct `curl` against the dev API turned up **"Too many requests from this IP, please try again later"** — the app's own global rate limiter (`src/app.js`, `express-rate-limit`, default 2000 requests / 15-minute window, `src/config/environment.js`). This session ran dozens of Playwright scripts plus 3-4 full e2e suite passes, easily enough requests to trip it. **This almost certainly explains the `APP_CONFIG`-undefined symptom too** (a rate-limited page load would serve an error response instead of the real HTML, so `document.body.dataset.csrfToken` was never set) — not a real bug, just this session's own test traffic. Not independently re-confirmed after the fact (interrupted to write this note), but treat this as the likely explanation rather than a mystery: **wait for the 15-minute window to clear (or restart the dev server, since the limiter's counts are in-memory) before resuming Phase 3 verification**, and it should resolve itself.

## NOT STARTED — Phase 4 (app.fetch adoption)

Per the plan: `app.fetch` (`main.js`) needs a fix first (it throws on non-2xx before parsing the JSON body, which loses the server's real error message — see plan for the exact diagnosis and fix), then ~27 call sites across the app get migrated onto it. Not started at all.

## Next steps, in order

1. Confirm the rate limiter has cleared (retry a `curl localhost:3000/api/tasks` — if it returns JSON instead of "Too many requests," it's clear) before doing any more browser testing.
2. Finish Phase 3 verification: open each of the 8 child-item types (todo, task, ticket, idea, priority, goal, area, template) in the Dailies child-item editor, confirm the right fields show/hide, edit, save, confirm only the expected fields were sent.
3. Proceed to Phase 4 per the plan.
4. Clean up any test data (`ZZZ`-prefixed rows) left in the dev DB from smoke testing — check tasks/priorities/areas/goals/work items via the API before considering the session's data state clean. (Note: `Test Task for Context Menu` × ~10 rows already present in `tasks` before/independent of this session — appear to be e2e fixture data the suite itself creates without cleaning up; left alone, not this session's mess.)

## Test hygiene note for next session

Playwright e2e runs are slow (~5-7 min) — prefer small targeted Playwright scripts (a few seconds) for iterative verification during development, and save full `npx playwright test` runs for checkpoints rather than after every edit.
