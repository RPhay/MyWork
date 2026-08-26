# Carry On

What is in flight and what is planned next. **Not** a place for specification,
standards, or architecture — those belong in `CLAUDE.md`, `UI_STANDARDS.md`,
`CLAUDE_TESTING.md`, and code comments next to the thing they describe.

Last updated: 2026-08-26.

## Read this first if you are picking the work up

Everything is committed and pushed to **`main`**. `npm run dev` ->
http://localhost:3000, after copying `.env.example` to `.env.local`.

**Testing rules are in `CLAUDE_TESTING.md`.** The one that matters most: e2e
runs write to the user's REAL database, so they leave rows in the app the user
is looking at. The baseline is **340 entities** - anything above that after a
run is residue. `global-teardown.js` sweeps leftover `ZZZ` rows AND leftover
`zzz_` field DEFINITIONS, but it is a backstop, not a licence.

### Where the work stands (2026-08-26)

**The full suite is green: 353 tests in 69 files, 26 minutes, exit 0.** That is
new. It could not run AT ALL the previous morning, and the first run that could
reported 168 failures. `CLAUDE_TESTING.md` carries the baseline and, more
usefully, the four shapes those 168 turned out to be.

The guard set was rebuilt around what actually catches defects: 24 specs, 121
tests, **7.1 minutes**. Guard set before a commit, **full suite before a push** -
the second half of that rule is only affordable because the suite is green.

### Closed since the last update

- **The narrow-pane column problem is decided and shipped.** The rule that bends
  is: columns DROP rather than collapse, lowest-value first, title last
  (`genericEntity.fitColumns`). `column-fit.spec.js` guards it.
- **A clean full-suite run is no longer owed.** It has been run, and it is green.
- **`priorities` is gone**, and so are `tasks`, `to_dos` and `to_do_items`. All
  four were fully migrated and unread; see `RETIRED_TABLES` in both schema
  files. The bridge junctions that survive - `priority_areas`, `priority_goals`,
  `template_areas`, `template_goals`, `template_priorities` - now point at
  `entities` on BOTH columns, which is what they always meant.
- **`toDoService.js` is deleted.** Its last caller was the Todos & Ideas report,
  which had been returning every Idea and not one Todo.

### Open

- **The legacy Templates stack is the last migration left.**
  `work_item_templates` and its junctions (`template_areas`, `template_goals`,
  `template_priorities`) plus `dailyTemplateService.js` are what remain of the
  pre-entity world. The Templates RAIL already renders from `entities`, so the
  two halves coexist: Dailies' template picker, child editor, drag-drop and
  emoji endpoint are on the legacy side. The three junctions were repointed at
  `entities` on 2026-08-26, so only the template row itself is still legacy.
  The old names (`priority_areas`, `template_areas`, `work_item_templates`) go
  with it - renaming them before that is work done twice.
- **A small unexplained thing, if anyone wants it.** Setting
  `messageEl.style.whiteSpace` from `app._dialog` did not take effect, although
  the assignment was in the served file and `app._dialog.toString()` contained
  it. Worked around in `modals.css`, which is the better place for it anyway.
  Nothing depends on the answer.

### Closed on 2026-08-26 (was open)

- **Column-fit reachability - NOT a defect.** Measured rather than argued:
  editor CLOSED, nothing drops at 1280/1440/1920; editor OPEN at 1280, only
  `priority` drops, and its control is in the editor pane taking that width. At
  1440+ nothing drops at all. This file previously called it "unreachable in
  the app", which was an overstatement - the specs needed wider viewports
  because they click the CELL, which is a test constraint.
- **The type editor save path is audited, and clean.** All eight seeded types
  round-trip a save unchanged, as does a type carrying one field of every
  renderable type. `type-editor-roundtrip.spec.js` guards it, and encodes the
  one real behaviour found: an under-specified status field gets its roll-up
  and doneValues FILLED IN, never overwritten.

### Risks worth carrying forward

- **The type editor has corrupted data twice.** It rebuilt `field_options` from
  its visible inputs and destroyed the status roles (`doneValues` became
  `['Ignored']`, so every folder roll-up was wrong); and `supports_hierarchy`
  was `0` on the template type while the seed said `true`, so templates silently
  never nested. Both fixed and guarded, but the save path still rebuilds a type
  from what is on screen. **An audit of that path is unclaimed.**
- **A leaked test FIELD is worse than a leaked row, and looks like an app bug.**
  Six `zzz_` field definitions sat on the Ideas type for weeks; one of them was
  a `priority` field, so every Ideas row rendered TWO priority cells - in the
  app, not just under test - and `priority-field.spec` reported it as the engine
  duplicating a cell. Cleanup that runs through `page.evaluate` dies with the
  page when a test times out, which is how they survived a correct `finally`.
- **A soft delete is not a delete.** `DELETE /api/entities/:type/:id` stamps
  `deleted_at`; only `DELETE /api/trash/:id` removes the row. Several specs
  "cleaned up" with the first call alone and quietly filled the user's trash.
- **SSO login cannot work, by design of the `users` table.** See "The SSO code
  is scaffolding, and does not run" in `CLAUDE.md`. `findOrCreateSsoUser` is
  deliberately left failing, because fixing it means deciding what a user IS
  here. Do not "fix" it without that decision.
- **`typeDefaults.json` is what "Revert to defaults" restores.** Re-capture it
  whenever type configuration changes, and sweep test rows FIRST so a snapshot
  never carries `ZZZ` data. Note that types now receive an engine block on
  create AND on update (`ensureEngineFields`), so the defaults move when that
  list does.

## 1. Dailies-as-a-type refactor — DONE (2026-08-25), kept as the record

**This section is history, not a to-do list.** It shipped: the rows moved into
`entities` as type `daily`, the slug and label were renamed, and `work_items`
was dropped. What follows is the plan as it was written, left in place because
the counts and the file-by-file survey are still the best account of what the
migration actually had to touch.

The agreed direction: **a daily is just a list of typed items associated with a
calendar day**, each either *copied* or *referenced*, with `daily` becoming an
uneditable type that handles it.

### The contradiction is SETTLED (2026-08-21)

"Clone" meant **Copy** in one message and **Reference** in the other. There are
**two modes**, matching the vocabulary the rest of the app already uses — the
drag dialog offers Copy or Reference, and Templates and the Priorities board
both work that way. No new vocabulary is being invented.

- Dragging a row from a typed page onto the Dailies rail asks: copy or reference?
- Each daily row carries an icon showing which it is.
- A **reference** passes edits, reordering and deletion through to the original.
- A **copy** is independent of it.

**Still design-only. No code, no schema change, by decision on 2026-08-21.**

### The migration is smaller than this file has been claiming

"Its nine association tables" is out of date: finding 07 already dropped the
eight per-type `work_*` junctions. What is actually left, with live row counts:

| Table | Rows |
|---|---|
| `work_items` | 35 |
| `work_entity_associations` | 2 |
| `work_source_associations` | 0 |
| `work_item_templates` | 1 |
| `priorities` | 5 |

So the collapse is `work_items` + **two** association tables, not nine.

### Every consumer, swept 2026-08-21

The trap this file names — "a forgotten consumer fails silently rather than
erroring" — with the sweep already done. **Re-run it before starting; this list
is a snapshot.**

**Real code that reads or writes `work_items`:**

| File | Refs | Note |
|---|---|---|
| `services/workItemService.js` | 16 | the main surface |
| `services/recurrenceService.js` | 4 | still reads legacy `to_dos`/`tasks` too |
| `services/workItemTemplateService.js` | 222, 226 | `MAX(order_index)` + INSERT when a template lands on a day |
| `services/entityService.js` | 685 | **INSERTs into `work_items` directly** — the easiest one to miss, because it is the entity service |
| `services/schemaMigrationService.js` | 57, 542 | table list + an id lookup |
| `services/systemDatabaseService.js` | 33 | table list for the system-DB copy |

**Comments only, not code** — do not "fix" these:
`reportingService.js:8`, `portfolioReportService.js:11`, `dailies.js:190`,
`routes/api/reporting.js:85`.

**Schema:** `mysqlSchema.js` (27) and `mssqlSchema.js` (35). Both must change
together — see the dual-schema rule in `CLAUDE.md`, and run the MSSQL build
rather than reading it.

**Historical one-off scripts** (`scripts/phase*.js`): leave alone, they describe
migrations already performed.

### Shape of the work, when it is authorised

1. `daily` becomes an uneditable entity type.
2. Each daily row becomes an `entity_relationships` edge from the day to the
   item, carrying the mode (copy vs reference) — a copy additionally records
   what it came from, per the "every copied node records its origin" fix.
3. `work_items` rows migrate to `entities` of type `daily`.
4. The six real consumers above move to the entity services.
5. Only then drop `work_items` and the two junctions, in both schema files.

Same migration shape as Projects (Thread 1d).

## 2. Priorities board — SHIPPED, one thing to watch

The board is a rail holding rows of **any** type, dragged in from a typed tab or
from Dailies. Everything below is built and covered by `priorities-rail.spec.js`.

**The bay is not the record's status.** It was forced by the data at the time -
the types did not share a status vocabulary (Ideas ran Raw/Developing/Ready) -
and it still holds for a simpler reason: Categories and Templates have no status
field at all, so a bay that wrote status could not place one. Ideas were moved
onto the shared ladder on 2026-08-19, so that half of the original argument no
longer applies; the design does not change.
Placement lives in `board_bay`, ordering in `board_order`, both per-record field
values. `entities.order_index` is deliberately NOT reused — that is a row's
position on its own page, and sharing it would mean arranging the board silently
rearranged Ideas and Todos elsewhere.

A card is a **reference**, never a copy: membership is a field on the one
record, so there is nothing to duplicate and edits made anywhere show up here.
The board can only write placement, order, and membership.

To watch: `board_bay` / `board_order` are seeded onto every editable type via
`systemEntityTypes.js`. A type invented after this change gets them from the
seeder; a type created before it and never re-seeded will not appear on the
board until it does.

## 3. The Goals drag-to-nest "regression" was the test - CLOSED

Two faults, both in `generic-entity-crud.spec.js`, neither in the app:

- `page.locator('.entity-row', { hasText })` matched the ANCESTOR row. A
  folder's `.entity-row` contains its nested rows once something is inside it,
  so after the first nest `.first()` picked the outer folder and the second
  drop was aimed at the wrong target.
- On the widest types a row is **hundreds of pixels tall** in a narrow pane, so
  a pointer drag could not reach the band it aimed for.

Rows are addressed by id now and the nest is driven by drag events. All seven
types pass. The drop handler was instrumented first, as this file asked: it
returned `nest` every time.

**What that turned up, and is still open:** those row heights are real. Goals
renders `90px 4.39px 90px 88px 4.4px 120px 4.4px 4.4px 4.4px 78px` - several
columns collapsed to about four pixels, their content wrapping into a 500px
row. It follows from two rules that are individually right (never scroll
horizontally, never truncate) meeting more columns than the width can hold.
Needs a decision: drop columns when the pane is too narrow, or allow one of
those rules to bend.

## 4. Test suite triage

**The guard set lives in `CLAUDE_TESTING.md`** — it is not repeated here. It
used to be, which is how the project ended up with two different guard lists
that overlapped on one spec. This file tracks what is in flight; the standing
list of what to run is testing documentation.

**There is no trustworthy suite-wide number right now.** The last full run was
149 passed / ~42 failed / 84 not run over 1.3 hours, and it is void: files were
being edited throughout it, so early and late specs tested different code. 18
of the noisiest specs have since been retired. Getting a clean number is open
work, not a formality.

**The suite is serial now, deliberately.** `playwright.config.js` sets
`workers: 1` / `fullyParallel: false`, and the comment there carries the
measurement that forced it: the same seven spec files gave **49 passed in
parallel and 104 passed, zero failed, serially**, with no change to the app in
between. Every worker shares one database, so parallel runs collide over each
other's rows. The real fix is per-worker data isolation (a context per worker —
contexts are already first-class here); until that exists, this stays 1.

**A bare `.entity-row` selector matches hidden tab panes.** `dashboard.ejs`
renders every tab's rows into the DOM upfront — 342 in the DOM against 36 on
screen in one measured case. Every spec now scopes to
`#tab-<slug> .entity-row:visible`. **Write new specs that way.**

**Specs must clean up after themselves in `beforeEach`, not just at the end.**
A run that dies before its cleanup leaves rows behind, and the next run then
fails for reasons that look like a broken feature — the focus bar's three-item
cap made this vivid. `focus-bar.spec.js` and `recently-deleted.spec.js` show
the pattern.

## 5. Smaller open items

- ~~`templates.js` and `templates.ejs` are dead code~~ - both deleted.
  Kept here only as the shape of the problem:
  found while doing #05, verified against the rendered page, not inferred:
  `templates.ejs` is included nowhere (`customTemplateMap` is now `{}` and the
  Templates rail renders `generic-entity-tab.ejs`), and it was the only thing
  that loaded `templates.js`. The rendered dashboard contains **zero**
  references to either `templates.js` or `#templatesList`. The three surviving
  `loadTemplates()` calls are all `typeof`-guarded, which is why nothing ever
  errored. **Recommend deleting both**; that also retires 8 of the drag handlers
  #05 counted. Not deleted yet — the user has not been asked.
- **`template-drops.spec.js` and `real-drag-drop.spec.js:89` fail against the
  removed bespoke templates UI** (`getElementById('templatesList')` → null), not
  against a bug. They go with the deletion above, as part of #09.

- **`app.fetch` adoption** — `UI_STANDARDS.md` §6 is aspirational;
  `generic-entity-init.js` still uses raw `fetch` with hand-rolled CSRF headers.
- **Retire the legacy ↔ entity bridge** — seven junction tables, documented in
  place in `mysqlSchema.js`. `priorities` are entities already, so
  `priority_areas` / `priority_goals` may be collapsible; unverified.
- **Dailies and the priorities board** have no column header, sorting, filtering
  or column chooser — they sit outside the generic engine. For the board this is
  deliberate: its cards are references to rows owned elsewhere, and it can only
  write placement and order.
- ~~Empty tables in the schema~~ - the four per-type `*_links` tables and
  `context_tab_settings` are gone from both schema files, the health check and
  the database (backed up first; `ticket_links` held one row). So is
  `priorities.is_weekly`.
- **`openNewWorkForm`** in `dailies.js` is now unreferenced — the "+ Add" button
  it served was removed in favour of dragging work in from a typed page.
- **Dailies still has no column header, sorting, filtering or column chooser.**
  It is the one page not on the generic engine, which is finding 06.
- **`to_dos` (258 rows), `tasks` (161), `ideas` (26), `areas` (6)** are legacy
  tables still holding the pre-migration copies. They are not read by the typed
  pages, which run on `entities`. `recurrenceService` still reads `to_dos` and
  `tasks`, which is why the recurrence engine is effectively orphaned.
- **Empty is not the same as unread.** `sources`, `quotes`, `day_highlights`,
  `sso_identities`, `source_auth` and `to_do_items` are empty because nothing
  has used them yet - they were deliberately NOT dropped in the finding 07 pass.


## 6. The audit — what is done and what is left

Source of truth for the reasoning:
**https://claude.ai/code/artifact/ba20de4f-f4e1-4f66-976f-aef567635e49**

The user's instruction was to implement every fix and feature in it. Numbering
matches the artifact.

### Done and pushed

| # | Finding | What shipped |
|---|---|---|
| 01 | MSSQL could not save a field | `ON DUPLICATE KEY UPDATE` → `MERGE`, `LIMIT` → `OFFSET/FETCH`, in `mssqlTranslation.js`, with 12 unit tests |
| 02 | `CLAUDE.md` described an architecture the code no longer had | Corrected, plus the rule that actually holds: MySQL-specific syntax needs a rewrite **and a test** |
| 03 | Board/reports loaded the whole dataset | `entityService.getEntitiesByFieldKey` — one indexed lookup via `idx_field_key_text` |
| 04 | 173 raw `fetch`, 126 hand-rolled CSRF headers | `app.fetch` / `fetchData` / `fetchRaw`; **128 call sites migrated, 126 → 0 hand-rolled headers** |
| 08 | Suite unreadable | `workers: 1`; measurement recorded in the config |
| 10 | No search | `/api/search` + ⌘K palette, searches titles and field values, says why a row matched |
| 11 | Nothing could be undone | `deleted_at` + `deleted_batch` soft delete, Recently Deleted panel, restore and purge |
| 12 | Everything drag-only | Palette `Tab` actions call the same endpoints as the drop handlers |
| 14 | Looked protected, had no auth | Documented in `CLAUDE.md` as an explicit assumption |
| 05 | Drag-and-drop implemented nine times | Negotiation, indicators **and the drop-zone geometry** in `dragDropUtils.js`; surfaces pass a `nesting` flag. `showDropZone()` paints the indicator that matches a zone, so the two cannot disagree |
| 07 | 25 of 42 tables empty | The eight per-type `work_*` junctions, the four `*_links` and `context_tab_settings` are gone from both schema files, the health check and the database. **45 tables -> 37.** Backed up first; `ticket_links` was not actually empty |
| 09 | 45 of 92 specs debug-named | 18 retired to `tests/e2e/retired/` (out of the run, not deleted), each with a written reason. 111 -> 96 live |
| 13 | No multi-select or bulk operations | Click / cmd / shift selection, bulk delete, bulk move (refuses a row into itself or its own subtree), and a value menu opened inside a selection sets that field on every selected row |
| 07 | 25 of 42 tables empty | The four per-type `*_links` tables and `context_tab_settings` dropped from both schema files, the health check and the database - backed up first, since `ticket_links` was not actually empty |
| 13 | No multi-select or bulk operations | Multi-select (click / cmd / shift) with a selection bar and bulk delete; a value menu opened inside a selection now sets that field on **every** selected row and says how many |
| 05 | Drag handlers spread across 9 files; `dragDropUtils.js` held 2 | One protocol in `dragDropUtils.js` — `DRAG_EFFECT_ALLOWED` / `beginDrag` / `acceptDrop` / `showDropIndicator` / `clearDropIndicators`. **0 hand-written `effectAllowed` or `dropEffect` left** in live files; indicator clearing has one implementation. Guarded by `drag-protocol.spec.js` |

Plus two features the user asked for directly, neither in the artifact:
**the priorities board as a rail** (any type, as references, board-local bays)
and **the focus bar** (three pinned records, RAG dot, stop-the-clock timer,
drag-to-pin).

### Not started

| # | Finding | Note |
|---|---|---|
| 06 | Dailies outside the generic engine, 3,666 lines | Blocked - see the two decisions at the top. Half the reason for it is already gone |

**Features built:** global search + palette (10, 12), Recently Deleted (11),
saved views per type, time worked vs planned on board cards, and the scheduled
status digest.

**Feature not built:** recurrence beyond Dailies - it contradicts a direct
instruction, see the decisions at the top.

**The digest sends nothing, and that is the design.** The app holds no mail
credentials and no mail dependency; it writes the update on a schedule, keeps
it, and hands it to the mail client with `mailto:`. Real SMTP delivery would be
a dependency plus credentials - the user's call, not an oversight.

### Traps hit while doing the above — do not rediscover these

- **A type's flags can disagree with the seed, and the app just behaves
  strangely.** `template.supports_hierarchy` was 0 in the database while the
  seed said true. The renderer took its FLAT branch and the client never
  fetched the edges, so anything dropped into a template arrived with its tree
  stripped. Nothing errored. There is a guard now: a type that allows children
  must support hierarchy.
- **"A template may contain any editable type" is enumerated per child type**,
  so it could only ever list the types that existed when it was written. A type
  created afterwards was refused silently. `createEntityType` adds the row now.
- **Deleting a type is a SOFT delete that permanently reserves its slug.** The
  row stays and the UNIQUE index still blocks reuse, so a type named "Tests"
  can never be recreated once deleted. Do not create types in tests.
- **`DELETE /api/entities/...` is a soft delete too.** A spec that "cleans up"
  with it leaves its rows in Recently Deleted forever. `DELETE /api/trash/:id`
  is the only hard delete; real cleanup is both calls.
- **A copy recorded what it came FROM only for the root**, so a deep copy
  arrived looking like one copy holding a pile of references - the opposite of
  what had happened. Every copied node records its origin now.
- **Scroll events are delivered asynchronously.** Bringing a row into view and
  right-clicking it delivers that scroll AFTER the menu opens, so the menu was
  dismissed the instant it appeared - for any row far enough down to need
  scrolling. The same shape killed a chip mid-drag: the focus bar's timer
  rebuilt every chip and deleted the element under the cursor.
- **The editor is a SINGLETON.** Remembering an open editor per TYPE made every
  tab restore its own on load: several visible panes, several elements sharing
  `id="entity-editor-form"`, and clicking a row could not resolve a form.

- **`setEntityFieldValue` picks its storage column from the SHAPE of the value,
  not the field's declared type.** An ISO timestamp was routed into
  `value_date` and MySQL rejected it. The focus clock stores epoch
  milliseconds. Any future string-shaped field will hit this.
- **Engine-written fields render as editable controls unless excluded.**
  `board_bay` / `board_order` appeared as a text box and a number box on every
  record's editor, and six unrelated test records got placed on the board that
  way. See `INTERNAL_FIELD_KEYS` in `genericEntity.js` — add to it, and to the
  matching list in `searchService.js`, whenever the engine adds a field.
- **Anything revealed mid-drag must not take part in document flow.** The focus
  bar's landing strip pushed every row down 40px on `dragstart`, so drops
  landed above their target — it broke reordering across the whole app.
- **A soft delete must not destroy relationship edges.** The delete route
  called `cascadeDeleteEntity` first, which removed them, so the soft delete
  found no children to stamp and a restore had no tree to rebuild.
- **`LIMIT ?` fails under mysql2's `execute()`** ("Incorrect arguments to
  mysqld_stmt_execute"), same family as the `IN (?)` note in
  `attachFieldValues`. Inline a bounded integer.
- **A codemod that rewrites `fetch(` will rewrite the one inside `app.fetchRaw`
  itself** and produce infinite recursion. Those two call sites in `main.js`
  must call `window.fetch`.

## 7. Decisions made — do not re-litigate

- Dailies is a **rail**, not a page. Its tab button toggles it; the rail is
  resizable and its width persists across close/reopen and reload. The landing
  tab is the first real tab.
- Saving never closes an editor. **Revert** (not Cancel) reloads the stored
  record and also leaves it open. Both buttons stay disabled until something
  changes. An editor is closed by clicking its row again.
- Columns never scroll horizontally and text is never truncated — long values
  wrap and the row grows taller. **Amended 2026-08-25:** those two could not
  both hold once a pane held more columns than width, and what broke instead was
  legibility (Goals rendered several columns at about four pixels). Both rules
  still stand; what bends is "every column is always shown" — see "Columns drop
  when the pane is too narrow" in `CLAUDE_REFERENCE.md`.
- One value, many views: `show_in_row`, `show_column_label` and `display_order`
  are edited from both the header and the row editor and always write the same
  field record.
- All work-item data was deleted on 2026-08-19 at the user's request (250 rows
  across 44 dates). Backup: `data/dailies-backup-20260819-004350.json`.
- **Row control sizing.** The delete button is the row's declared size reference
  (32x24). Everything else in a row is built to it, including the priority
  meter, which occupies exactly that box. Do **not** let the button size itself
  from its own glyph again: while it did, enlarging the row icons enlarged the
  trash, which enlarged the button, which moved the reference everything else
  was matched against.
- **Row icons stay the type's own emoji**, matching the tab bar. Emoji cannot be
  made one size — measured on canvas, a pushpin inks 7px wide against a folder's
  13.3px at an identical font-size — and matching the tab strip is worth more
  than shaving that difference. Swapping them for icon-font glyphs was tried and
  rejected.
- **Weekly Priorities is retired**, along with `is_weekly` everywhere including
  both schema files.
