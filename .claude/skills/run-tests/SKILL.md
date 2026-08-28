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

**Do not rebuild that table by hand.** `report.sh`, beside this file, prints
it. Point a `Monitor` at its `watch` mode and each event IS the table, already
formatted — it exits on its own when the run ends:

```bash
.claude/skills/run-tests/report.sh watch <scratchpad>/run.log <start-epoch> 180
```

Or print one on demand:

```bash
.claude/skills/run-tests/report.sh sitrep <scratchpad>/run.log <start-epoch>
```

Set `RUN_TESTS_SLOW_SPECS` to the slow files `CLAUDE_PROJECT_TESTS.md` names,
and the estimate says which one is in flight instead of just reading long.

### The status line carries it too

`watch` also ARMS a third status-line row, so progress is visible between
sitreps without waiting three minutes for the next message:

```
tests ▏ worked-time.spec.js · 130/134 · ~1m ████████████████████████░ 97%
```

The spec in flight, N of M, minutes remaining, and a bar sized to whatever is
left of the terminal width. `statusline.sh` beside this file renders it, and
`.claude/settings.json` points the `statusLine` command at it.

Three properties it must keep:

- **It prints NOTHING when no run is armed.** A status line that grew a
  permanent empty row would be worse than not having the feature. `watch` arms
  it, and disarms on ANY exit via a trap — a stale pointer file would leave a
  finished run on screen for the rest of the session.
- **It DELEGATES rather than replaces.** Whatever `statusLine` was already
  configured (`$RUN_TESTS_STATUSLINE_DELEGATE`, else
  `~/.claude/statusline-command.sh`) still runs, gets the JSON payload on
  stdin, and keeps its own rows; ours is appended below.
- **It reads the log, not a cached figure**, so it is current on every render
  rather than 3 minutes stale — but only `tail -n 400`, because a full-suite
  log is hundreds of KB and this runs on every status-line repaint.

To drive it without `watch`: `report.sh arm <log> <start-epoch>`, and
`report.sh disarm` when done.

**Do not edit `report.sh` or `statusline.sh` while a run is being watched.**
Bash reads a script incrementally by byte offset, so editing one that is
already executing shifts the file underneath the running process and it dies
mid-line — this happened on 2026-08-28 and the watcher exited 2 looking for all
the world like a bug in the parser. It is the same rule as not editing
application source under a run, one level up.

The estimate is `elapsed / completed * (total - completed)` and the script
says so is an estimate, because it reads long early and on a slow file. Always
present it as one.

**Report a failure the moment it appears; do not save it for the end.** The
count comes from the runner's numbered failure lines — grepping for the word
"failed" instead catches it inside test NAMES and cries wolf, which is why the
script anchors on `^  N)` and you should not "simplify" that.

## 5. Final results, as a table

`report.sh` prints both tables from the log — one call per tier, so the shape
is the same every run:

```bash
.claude/skills/run-tests/report.sh final "Guard set" <scratchpad>/run.log
```

```
| Tier | Result | Time |
|---|---|---|
| Unit | 42 passed | 3.2s |
| Guard set | 128 passed, 2 failed, 4 skipped | 8.7m |
```

Then one row per failure, which it also prints:

```
| Spec | Error | Verdict |
|---|---|---|
| `row-icon-sizing.spec.js:10` | timeout waiting for a row | tab is empty - spec assumes data exists |
```

**It leaves the Verdict cell blank, and that is deliberate** — whether a failure
is the change in hand or a stale spec comes from re-running it, not from the
log. Fill the column in yourself; do not delete it.

Two things it will not do, because both are how a bad run gets read as a good
one: it never prints a pass count without the failure count beside it, and a log
with no summary line reports `run did not complete` rather than a total.

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
