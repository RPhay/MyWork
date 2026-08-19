# Carry On

What is in flight and what is planned next. **Not** a place for specification,
standards, or architecture — those belong in `CLAUDE.md`, `UI_STANDARDS.md`,
`CLAUDE_TESTING.md`, and code comments next to the thing they describe.

Last updated: 2026-08-19.

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

- Only Goals fails; Categories and Ideas pass the identical test.
- Goals has the most columns (8), so its rows wrap to **66px** against **49px**
  elsewhere.
- With the rail open the tab content is **609px**; closed it is 1256px.
- The first nest (folder → folder) succeeds; the second (item → inner folder)
  never writes its edge.

Not established: whether the drop lands in the wrong band, the target row moves
after the first nest re-renders, or the inner folder is not where the test
expects. **Instrument the drop handler before adjusting any geometry.**

## 4. Test suite triage

The wider suite is mostly stale specs asserting against deliberately removed UI
— see `CLAUDE_TESTING.md` for the breakdown and which specs to trust.

One failure mode was costing real time and is now fixed everywhere: a bare
`.entity-row` selector matches rows in **hidden tab panes**, because
`dashboard.ejs` renders every tab's content into the DOM upfront. In one
measured case that was 342 rows in the DOM against 36 on screen, so
`.first()` drove a row the user could not see. Every spec now scopes to
`#tab-<slug> .entity-row:visible`. **Write new specs that way.**

## 5. Smaller open items

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

## 6. Decisions made — do not re-litigate

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
