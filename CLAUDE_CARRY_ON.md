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

## 2. Templates rail

Same pattern as the Dailies rail: Templates becomes a rail rather than a page,
its tab sits to the right of Dailies, and when both are open they are the only
two rails shown — Dailies left, Templates right. Not started.

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

The guard set stands at **105 passed / 2 failed** (one is item 3; the other was
a stale assertion, now fixed). The wider suite was 162 failed / 192 passed at the
last full run and is mostly stale specs asserting against deliberately removed
UI — see `CLAUDE_TESTING.md` for the breakdown and which specs to trust.

## 5. Smaller open items

- **`app.fetch` adoption** — `UI_STANDARDS.md` §6 is aspirational;
  `generic-entity-init.js` still uses raw `fetch` with hand-rolled CSRF headers.
- **Retire the legacy ↔ entity bridge** — seven junction tables, documented in
  place in `mysqlSchema.js`. `priorities` are entities already, so
  `priority_areas` / `priority_goals` may be collapsible; unverified.
- **Dailies and the Priority Board** have no column header, sorting, filtering or
  column chooser — they sit outside the generic engine.
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
