# Carry-on: Association management — schema parity + modal enhancements

## Uncommitted changes on disk right now

None of this is committed yet:

- `src/database/schema/mssqlSchema.js` — added the eight FK columns that existed
  in `mysqlSchema.js` but were missing from the MSSQL translation (`ideas.priority_id`,
  `tickets.priority_id`, and the six hierarchical-association columns:
  `to_dos.ticket_id`, `goals.ticket_id`, `areas.todo_id`, `tickets.todo_id`,
  `tickets.category_id`, `to_dos.category_id`). This is why "Fix Schema" wasn't
  fully updating the work-machine MSSQL install after schema work done against
  MySQL at home. Four of the eight use `ON DELETE NO ACTION` instead of MySQL's
  `SET NULL` (`to_dos.ticket_id`, `tickets.todo_id`, `areas.todo_id`,
  `to_dos.category_id`) because they form two mutual FK pairs and SQL Server
  rejects a cascading action that creates a cycle.
- `CLAUDE.md` — added a "Database schema changes must cover every supported
  database type" section: schema changes must land in both `mysqlSchema.js` and
  `mssqlSchema.js`, and notes the MSSQL cascade/cycle restriction.
- `tickets.js`/`tickets.ejs`, `todos.js`/`todos.ejs`, `areas.js`/`areas.ejs` — each
  "Manage Associations" modal now has an "Add association" picker (type select +
  item select + Add button) that links an existing item without drag-and-drop,
  and the associated-items list is grouped by type with a header per group
  instead of a flat concatenated list. `areas.js`'s `showManageAreaAssociationsModal`
  was also fixed to read its own local `allToDos`/`allTickets` instead of
  `window.todoState`/`window.ticketState` — the latter never actually held ticket
  data (`tickets.js` never sets `window.ticketState`), so associated tickets never
  rendered in that modal before this fix.
- No database schema change was needed for the modal/picker work — it only calls
  the existing `PUT /api/to-dos/:id`, `/api/tickets/:id`, `/api/areas/:id`
  endpoints with `ticket_id`/`category_id`/`todo_id`, same as the existing
  drag-and-drop association code already did.

Explicitly out of scope for this pass, by request: drag-and-drop reordering of
associated items within the modal (would need a new persisted `order_index`
column per relationship — not started).

## Still to do

1. **Manual browser verification** — none of the above has been exercised in a
   browser yet. Check on Tickets, Todos, and Categories pages:
   - Existing view/unlink flow in "Manage Associations" still works and now
     renders as grouped sections instead of a flat list.
   - New "Add association" picker: switching the type dropdown repopulates the
     item dropdown with only *unassociated* candidates, and clicking Add links
     the item and refreshes the modal.
   - Categories page specifically: confirm associated tickets now actually show
     up in the modal (previously silently empty due to the `window.ticketState`
     bug above).
2. **Run the schema fix against a real MSSQL server** to confirm the eight new
   backfill blocks apply cleanly — no MSSQL instance is reachable from the dev
   environment this was written in, so this has only been syntax-checked
   (`node --check`), not executed.
3. **Playwright pass** (`npx playwright test tests/e2e/debug.spec.js` at least)
   per this repo's own CLAUDE.md guidance, before committing.
4. **Commit** — nothing above is committed yet.
