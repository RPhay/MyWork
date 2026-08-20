# Carry On

What is in flight and what is planned next. **Not** a place for specification,
standards, or architecture — those belong in `CLAUDE.md`, `UI_STANDARDS.md`,
`CLAUDE_TESTING.md`, and code comments next to the thing they describe.

Last updated: 2026-08-19.

## Read this first if you are picking the work up

Everything is committed and pushed to **`row-controls-and-priorities-rail`**
(branched from `main`, not merged). `git pull` that branch and you have the lot.

The current work is **implementing a full code/product audit of MyWork**:

> **https://claude.ai/code/artifact/ba20de4f-f4e1-4f66-976f-aef567635e49**

Fourteen numbered findings plus six feature suggestions, each measured against
the running app rather than inferred. The user asked for **all of it** to be
implemented. Section 6 below tracks exactly which are done and which are not —
that is the to-do list; the artifact is the reasoning behind each item.

**Run the app**: `npm run dev` → http://localhost:3000. Copy `.env.example` to
`.env.local` first. **Verify a clean checkout** with the guard set in §4.

---

## 1. Dailies-as-a-type refactor — DESIGN NEEDED BEFORE CODE

The agreed direction: **a daily is just a list of typed items associated with a
calendar day**, each either *copied* or *referenced*, with `daily` becoming an
uneditable type that handles it.

Nothing has been built. Before it can be, one contradiction in the brief has to
be settled — these two statements cannot both hold:

> "a copy/clone can be edited or deleted without affecting the originals
> (lives on its own outside the typed tab)"

> "if a clone, any changes to that clone are automatically made to the original
> including edits, reordering children, or deletions"

One mode is independent, the other is linked, and "clone" is used for both.
**Ask which word means which before writing any of it.**

Once settled, the shape is:

- Dragging a row from a typed page onto the Dailies rail asks: copy or reference?
- Each daily row carries an icon showing which it is.
- A **reference** passes edits, reordering and deletion through to the original.
- A **copy** is independent of it.
- `daily` becomes an uneditable entity type; the legacy `work_items` table and
  its nine association tables collapse into `entities` + `entity_relationships`.
  Same migration shape as Projects (Thread 1d), and the same trap: **grep for
  every `JOIN work_items` before declaring it done** — a forgotten consumer
  fails silently rather than erroring.

## 2. Priorities board — SHIPPED, one thing to watch

The board is a rail holding rows of **any** type, dragged in from a typed tab or
from Dailies. Everything below is built and covered by `priorities-rail.spec.js`.

**The bay is not the record's status**, and that was forced by the data rather
than chosen: the types do not share a status vocabulary (Ideas run
Raw/Developing/Ready; Categories and Templates have no status field at all), so
a bay that wrote status would corrupt an Idea and could not place a Category.
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

## 3. Known regression: drag-to-nest fails on Goals while the rail is open

`generic-entity-crud.spec.js` → "items nest into folders and folders nest into
folders", Goals only, reproducible (not a flake).

What is established:

- **Todos now fails it too** (measured 2026-08-19). The earlier "Goals only"
  finding is out of date — do not start from it. Categories and Ideas still pass.
- Goals has the most columns (8), so its rows wrap to **66px** against **49px**
  elsewhere.
- With the rail open the tab content is **609px**; closed it is 1256px.
- The first nest (folder → folder) succeeds; the second (item → inner folder)
  never writes its edge.

Not established: whether the drop lands in the wrong band, the target row moves
after the first nest re-renders, or the inner folder is not where the test
expects. **Instrument the drop handler before adjusting any geometry.**

## 4. Test suite triage

**The guard set — run this to check a clean checkout.** 104 e2e + 12 unit,
all passing as of the last commit:

```bash
npm run test:unit          # 12 - the MSSQL translation layer
npx playwright test \
  tests/e2e/generic-entity-crud.spec.js \
  tests/e2e/entity-editor-behaviour.spec.js \
  tests/e2e/focus-bar.spec.js \
  tests/e2e/search-palette.spec.js \
  tests/e2e/recently-deleted.spec.js \
  tests/e2e/priorities-rail.spec.js \
  tests/e2e/row-icon-sizing.spec.js
```

The wider suite was **188 failed / 213 passed of 401** at the last full run and
is mostly stale specs asserting against deliberately removed UI. Do not read
that number as 188 bugs — see `CLAUDE_TESTING.md`.

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

- **`templates.js` (987 lines) and `templates.ejs` (293 lines) are dead code** —
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
- **Empty tables** still in the schema: `priority_links`, `task_links`,
  `ticket_links`, `to_do_links`, `context_tab_settings`.
- **`openNewWorkForm`** in `dailies.js` is now unreferenced — the "+ Add" button
  it served was removed in favour of dragging work in from a typed page.


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
| 05 | Drag handlers spread across 9 files; `dragDropUtils.js` held 2 | One protocol in `dragDropUtils.js` — `DRAG_EFFECT_ALLOWED` / `beginDrag` / `acceptDrop` / `showDropIndicator` / `clearDropIndicators`. **0 hand-written `effectAllowed` or `dropEffect` left** in live files; indicator clearing has one implementation. Guarded by `drag-protocol.spec.js` |

Plus two features the user asked for directly, neither in the artifact:
**the priorities board as a rail** (any type, as references, board-local bays)
and **the focus bar** (three pinned records, RAG dot, stop-the-clock timer,
drag-to-pin).

### Not started

| # | Finding | Note |
|---|---|---|
| 06 | Dailies outside the generic engine, 3,666 lines | Blocked on §1's naming contradiction |
| 07 | 25 of 42 tables empty | Dual-schema deletion pass |
| 09 | 45 of 92 specs are debug-named | Keep / fix / delete triage |
| 13 | No multi-select or bulk operations | Pairs with 11 |

Features still open: saved views per type, scheduled status email
(`buildEmailDraft` already composes it and deliberately never sends),
recurrence beyond Dailies, time tracking on the board.

### Traps hit while doing the above — do not rediscover these

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
  wrap and the row grows taller.
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
