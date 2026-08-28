---
name: run-tests
description: Run a project's test tiers. Asks which tiers to run as checkboxes, reports progress as a table every 3 minutes for long runs, and always ends in a results table. Use when the user asks to run tests, run the guard set, run the full suite, or verify a change.
---

# /run-tests

Run the test tiers the user picks, report in tables, leave the data as you
found it.

Nothing here is specific to one project. The tier names, spec lists, commands
and measured times come from **`CLAUDE_PROJECT_TESTS.md` in the repo root**;
everything below is the practice around them. Copying this file into another
repo should need no edits — only that repo's own `CLAUDE_PROJECT_TESTS.md`.

**Read `CLAUDE_PROJECT_TESTS.md` first, every time.** If it is missing, say so
and ask the user what the project's tiers and commands are rather than guessing
at spec names; offer to write one from what you find (`package.json` scripts,
the test directory, any CI config). Never copy its lists into this file — a
second copy of a guard set is how one came to be listed twice, in two places,
with two different sets of specs.

## 1. Refuse to start on top of another run

**Always, before anything else**, check whether a run is already going:

```bash
ps aux | grep -E "playwright (test|.*workerProcessEntry)|jest" | grep -v grep
```

If anything is running, **stop and say so.** An e2e suite usually shares one
database and runs single-worker for that reason; a second run beside it
corrupts both. On 2026-08-28 a single spec started beside a full suite swept 65
fixture rows out from under it and made four healthy specs fail — an hour lost
to failures that were never real.

Same rule in reverse: **do not edit application source while a run is in
flight.** The runner starts the dev server, so a save restarts it underneath
the browser and specs fail for reasons unrelated to them. Editing test files is
safe; `CLAUDE_PROJECT_TESTS.md` names which paths are watched.

## 2. Ask which tiers, as checkboxes

Use `AskUserQuestion` with `multiSelect: true`. Two questions, because a
question takes at most four options. Take the tiers, what each covers and its
measured time from `CLAUDE_PROJECT_TESTS.md` — do not invent them.

Shape the questions like this, filling in real names and times:

- **"Which tiers?"** — the whole-project ones: the pre-commit guard tier, a
  smoke tier, static analysis plus unit tests, and the full suite.
- **"Anything targeted?"** — the narrow ones: specs covering the change in
  hand (work them out from `git diff --name-only`), plus whichever subsystem
  tiers the project defines.

Two standing rules about breadth:

1. **Run the specs covering an individual fix without asking.** A fix is not
   finished until they have run, and calling it done before that reports an
   unverified claim.
2. **Ask before a BROAD run.** Anything wider than the change in hand costs
   real minutes, and an e2e run writes to the user's REAL data — it is never a
   read-only diagnostic.

Skip the asking only when the user already named exactly what to run.

## 3. Run it

Send anything over ~2 minutes to the background, writing to a log:

```bash
npx playwright test <specs> --reporter=line > <scratchpad>/run.log 2>&1
```

## 4. Sitrep every 3 minutes, as a table

For any run expected to take more than 3 minutes, arm a `Monitor` that emits a
line every 180s, and answer each one with this table — nothing else:

| | |
|---|---|
| **Progress** | 120 / 249 |
| **Failures** | 0 |
| **Now running** | `generic-entity-crud.spec.js` |
| **Elapsed** | 6m |
| **Est. remaining** | ~7m |

Read them from the log:

```bash
grep -oE '^\[[0-9]+/[0-9]+\]' run.log | tail -1        # progress
grep -cE '^  [0-9]+\) \[chromium\]' run.log            # failures so far
grep -E '^\[[0-9]+/[0-9]+\]' run.log | tail -1         # what is running
```

Estimate remaining as `elapsed / completed * (total - completed)`, and say it
is an estimate. It reads long near the start and whenever the queue reaches a
known-slow file — `CLAUDE_PROJECT_TESTS.md` names those; put the file in the
row rather than letting the number look wrong.

Report a failure the moment it appears; do not save it for the end. Anchor the
match on the runner's numbered failure lines (`^  N) [chromium]`) — matching
the word "failed" catches it inside test NAMES and cries wolf.

## 5. Final results, as a table

```
| Tier | Result | Time |
|---|---|---|
| Unit | 42 passed | 3.2s |
| Guard set | 128 passed, 2 failed, 4 skipped | 8.7m |
```

Then one row per failure:

```
| Spec | Error | Verdict |
|---|---|---|
| `row-icon-sizing.spec.js:10` | timeout waiting for a row | tab is empty - spec assumes data exists |
```

**Read both numbers before calling a run green.** The line reporter prints
`N failed` ABOVE `N passed`, so a truncated log shows only the pass count and a
badly failing run reads clean.

**A suite-wide count means nothing without attribution.** Before blaming the
change in hand, re-run the failing spec on a clean tree — `git stash`, or check
the file out at the previous commit — and say which side it fell on. Parts of a
long-lived suite often assert against behaviour that was deliberately removed.

## 6. Leave the data as you found it

Every e2e run writes to the user's REAL data, and test records are
indistinguishable from real ones once they are sitting in the UI.

- **Teardown belongs in an `afterEach`/`afterAll` hook, never at the end of the
  test body.** A spec that tidies up on its last line leaks every time an
  assertion fails earlier — which is how leaks mostly accumulate.
- **Prefix every record a test creates** (`ZZZ` works well) so leftovers are
  identifiable and sort to the bottom.
- **Delete by ID, never by NAME.** This one costs real user data when ignored:
  sweeping everything titled `New <Type>` destroyed a record the user had made,
  because the app assigns that title and their own unnamed rows carried it too.
  Record the ids you create — diff the list before and after — and delete only
  those.
- **A soft delete is not a delete.** If the app has a bin, removing the row
  usually takes a second call; `CLAUDE_PROJECT_TESTS.md` names the two.
- **Back up before any bulk delete**, to a gitignored directory.
- **Rows older than the run are not yours.** Report them; do not sweep them.
- **After ad-hoc browser verification, delete what you created** — check every
  place a record can appear, not just the one you were working in.

Where a test clicks a control that creates a record the APP names, no prefix
can identify it. Snapshot the ids before, diff after, and delete the difference.

## 7. Two traps that make a passing assertion meaningless

**`response.ok` is not success.** An API that answers `200 {"success": false}`
satisfies every naive check. Assert on the parsed body, and make the UI report
the failure — a silent one is worse than a thrown error, because the test and
the user both believe it worked. Seven context-menu actions in this project's
history "passed" for exactly this reason: the calls were failing and nothing,
in the app or the spec, said so.

**Native `prompt()` / `confirm()` dialogs are a testing dead end.** They block
the page, they need dialog interception the runner only partly controls, and a
suite that intercepts them tends to fail as a block for reasons unrelated to
the feature. If a flow under test uses them, the fix is usually in the app —
an in-page modal — not in more elaborate interception.

## 8. Manual checklists rot; specs do not

A hand-written test plan with pass/fail ticks records what was true on one
afternoon, and it keeps saying so long after the feature is rebuilt. Prefer a
spec. When you find such a document:

- carry anything still TRUE into the project's testing doc or a spec,
- delete the rest rather than leaving statuses no one has re-checked,
- and check the files it cites still exist — a plan that names specs which were
  deleted is actively misleading about what is covered.
