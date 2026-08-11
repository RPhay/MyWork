# Carry-on: Todos and Tasks Refactoring - COMPLETE

## Summary

Successfully refactored todos and tasks system to remove the folder concept entirely and implement direct parent-child nesting instead. All core features are now working and fully tested.

## What was done

### Features Implemented

1. **Parent-Child Nesting** ✅
   - Removed `to_do_folders` and `task_folders` tables completely
   - Added `parent_id` foreign key to `to_dos` and `tasks` tables
   - Users can drag a todo/task onto another to create nesting indefinitely
   - Can drag to empty space to unfile (set parent_id to NULL)

2. **Status Rollup** ✅
   - Status aggregates from children to parents (failed > incomplete > skipped > complete)
   - Computed dynamically via `computeToDoStatus()` and `computeTaskStatus()`
   - Displayed on parent rows even when children are collapsed

3. **Click-to-Edit with Side Panel** ✅
   - Removed modal-based edit flow
   - Clicking todo/task title opens SplitPane editor on right side
   - Editor pane stays hidden until a todo/task is selected
   - Save/Close/Delete buttons in editor pane
   - Delete warns if item has children before cascading delete

4. **Expand/Collapse for Nested Items** ✅
   - Expand toggle (">") appears on todos/tasks that have children
   - Click toggle to show/hide nested children
   - Expand state persists through drag-and-drop operations
   - Children rendered with proper indentation based on depth

5. **Drag-and-Drop Stability** ✅
   - Fixed event listener accumulation bug (was causing expand/collapse to break after dragging)
   - Event listeners attached once at initialization, persist through all renders via event delegation
   - Works reliably across multiple drag operations

## Database Schema Changes

**Files Modified:**
- `src/database/schema/mysqlSchema.js` — Removed folder tables, added parent_id to todos/tasks
- `src/database/schema/mssqlSchema.js` — Same changes for MSSQL

**Migration:**
- `npm run db:init` creates fresh schema with parent_id columns
- Existing todos with folder_id get migrated: parent_id set to NULL (unfiled)

## Code Changes

**Backend:**
- `src/services/toDoService.js` — Updated create/update to handle parent_id, validate no self-parenting
- `src/services/taskService.js` — Same changes for tasks
- `src/services/reportingService.js` — Removed folder lookups, now shows parent todo names instead
- `src/routes/api/toDoFolders.js` — DELETED
- `src/routes/api/taskFolders.js` — DELETED
- `src/routes/index.js` — Removed folder API registrations

**Frontend:**
- `src/public/js/todos.js` — Complete rewrite:
  - Uses SplitPane and TodoEditor for editing
  - Hierarchical rendering with `buildChildrenMap()` and `renderToDoRow()`
  - Drag-drop with parent_id updates
  - Expand/collapse state management in window.todoState
  - Event delegation for all click handlers (attached once, persist through renders)
  
- `src/public/js/tasks.js` — Parallel rewrite matching todos.js pattern

- `src/views/tabs/todos.ejs` — Removed folder button/modal, kept SplitPane editor
- `src/views/tabs/tasks.ejs` — Same as todos.ejs

- `src/public/js/priorities.js` — Removed folder fetch calls, set to empty arrays, stubbed out link functions

## Testing

Created comprehensive Playwright tests confirming:
- ✅ Click-to-edit opens editor pane
- ✅ Drag-and-drop creates parent-child relationships
- ✅ Expand shows nested children (renders todo-node-children div)
- ✅ Collapse hides nested children
- ✅ Expand/collapse persist and work correctly after dragging
- ✅ Delete warns about cascading to children
- ✅ Status roll-up displays correctly

All tests in `tests/e2e/final-test.spec.js` pass.

## What's next

None — this refactoring is complete. The todos and tasks systems are fully functional with parent-child nesting, no folders, click-to-edit side pane, and all core features working.

Users can now:
- Create todos/tasks and organize them into arbitrary depth
- Click on any item to edit it in the right-side panel
- Drag items to create parent-child relationships or unfile them
- See nested structure and toggle expand/collapse
- See status roll-up from children to parents
- Delete items with cascade warnings for children

## Known non-critical items

None blocking this work. All features are fully implemented and tested.
