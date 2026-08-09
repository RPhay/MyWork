# Carry-on: Mirror the To-Dos folder/status/associate system onto Tasks

## Where this came from

This session built, in order:
1. A clickable 4-state status checkbox (incomplete → complete → failed →
   skipped) for To Dos, on both the Todos tab and the Projects tab.
2. Separated a to-do's Projects-tab association (`to_dos.priority_id`,
   new column) from its Todos-tab folder (`to_dos.folder_id`) — they used
   to share `folder_id`, which meant removing a to-do from a project also
   silently un-filed it on the Todos tab.
3. A live folder-to-project link: dragging a whole Todos-tab folder onto a
   project makes that folder (and whatever's currently in it) show up as
   an expandable child of the project, via `to_do_folders.priority_id`.
4. A folder's status checkbox in the project tree shows an aggregate of
   its to-dos (failed > incomplete > skipped > complete), read-only.

The user then asked to mirror *all* of that onto Tasks (which had none of
it — flat list, no folders, no status, no Projects association), with two
explicit exclusions: no "Convert to Project/Category/Work Item" context
menu, and no drag-and-drop task creation from a dropped email/calendar
event. Nested task folders and full Todos-tab-style folder management
(not just a read-only view) were both explicitly confirmed as in scope.

**Full plan, including exact code snippets for what's left, is at**
`/Users/aslynn/.claude/plans/vast-launching-neumann.md` — read that before
continuing, this file is the status summary, that file is the spec.

## Status: 6 of 8 planned steps done, 1 in progress, 1 not started

Done:
1. ✅ Generalized `main.js`'s status-cycle helpers (`TODO_STATUS_CYCLE` →
   `STATUS_CYCLE`, `app.todoStatusIcon` → `app.statusIcon`,
   `app.cycleToDoStatus(id, status)` → `app.cycleStatus(endpoint, status)`)
   so both to-dos and tasks can use them. Call sites in `todos.js` and
   `priorities.js` updated to match.
2. ✅ Schema: new `task_folders` table (mirrors `to_do_folders`, nested via
   `parent_id`, linkable to a project via `priority_id`) in both
   `mysqlSchema.js` and `mssqlSchema.js`. `tasks` table got `folder_id`,
   `priority_id`, `status` columns + backfill blocks. `task_folders` added
   to both files' `contextTables` array. **Not yet applied to the dev
   DB** — see "Before doing anything else" below.
3. ✅ New `src/services/taskFolderService.js` (mirrors
   `toDoFolderService.js`). `src/services/taskService.js` extended with
   `folder_id`/`priority_id`/`status` handling.
4. ✅ New `src/routes/api/taskFolders.js`, registered at `/api/task-folders`
   in `src/routes/index.js`.
5. ✅ `src/views/tabs/tasks.ejs` rebuilt with the folder-tree markup (Add
   Folder button, folder modal, folder context menu with just "Add Task
   Here" — no convert options). Reuses the existing global
   `.todo-item-checkbox` CSS rather than duplicating it.
6. ✅ `src/public/js/tasks.js` rebuilt to mirror `todos.js`: folder tree
   rendering, drag-to-file/drag-to-reparent, the status checkbox,
   folder CRUD, inline rename. Deliberately excludes convert-to-X and
   email/calendar drop handling.

In progress (7 of 8):
- `src/public/js/priorities.js` is **done**: `allTasks`/`allTaskFolders`
  state, `renderTaskInTree`/`renderTaskFolderInProjectTree` (reusing the
  existing `computeFolderStatus` aggregation as-is — it was already
  generic, no extraction needed), `renderPriorityNode` extended with a
  4th/5th child group (linked task folders, direct tasks), link/unlink
  functions for tasks and task-folders, click-handler dispatch extended
  (with `.closest('.task-node')` / `.closest('.project-task-folder-node')`
  checks to disambiguate from the to-do equivalents), drop handler
  extended for `type === 'task'` / `'task-folder'`. Also fixed a bug this
  work would otherwise have introduced: the tree's internal `dragstart`
  handler didn't know about `.task-node` and would have mis-set
  `priority-id` to the string `"undefined"` when dragging a task row —
  fixed with an explicit `.task-node` branch alongside the existing
  `.todo-node` one.
- **What's left for this step**: `src/views/tabs/my-priorities.ejs` needs
  a new "Tasks" associate-drawer section, copy-pasted from the existing
  "To Dos" block right above where I stopped (search for `<!-- To Dos
  Folder -->`, the block ends around line 48 with
  `id="projToDosListRight"`). New block needs `data-folder="tasks"`,
  icon `bi-card-checklist` (matches what `renderTaskRow` /
  `loadPriorityRightPanel`'s new Tasks section already use), heading
  "Tasks", and `id="projTasksListRight"` — that exact id is already
  referenced by the Tasks section I already wrote in
  `loadPriorityRightPanel()` in `priorities.js`, so this is the one
  missing piece connecting them. Until this div exists,
  `document.getElementById('projTasksListRight')` returns null and that
  one code path in `loadPriorityRightPanel()` throws — caught by its own
  try/catch (confirmed safe: logs a console error, doesn't break the rest
  of the Projects page), so the app is not currently broken by this gap.

Not started (8 of 8):
- Apply the schema (`npm run db:init`) and run the full verification list
  at the bottom of the plan file (create a task folder/sub-folder, drag a
  task into it, cycle its status through all four states, rename via
  double-click, drag a task folder onto a project and confirm it shows up
  live, add a task to a linked folder from the Tasks tab and confirm it
  appears under the project without re-dragging, remove the folder from
  the project and confirm the Tasks tab is unaffected, check browser
  console on both tabs for errors — especially watching for any
  duplicate-ID/duplicate-global-declaration issue like the ones found and
  fixed earlier this session between `todos.ejs`/`my-priorities.ejs`,
  since `tasks.ejs` is now a third template sharing the same page).

## Before doing anything else

**The dev DB does not yet have `task_folders` or the new `tasks` columns.**
All the code (services, routes) already assumes they exist. Run
`npm run db:init` before testing anything task-related, or `/api/tasks`
and `/api/task-folders` will throw SQL errors (missing table/columns).
The dev server (nodemon) is already running with all the new code loaded
— confirmed it's still up and serving other tabs fine (Dailies etc.) with
no crash, since nothing has exercised the new task/task-folder code paths
against the unmigrated DB yet.

## Known pre-existing issue, not caused by this work

`SyntaxError: Identifier 'TodoEditor' has already been declared` appears
in the browser console on every page load — `TodoEditor.js` is
`<script>`-included by both `todos.ejs` and `my-priorities.ejs`. Flagged
repeatedly this session, never fixed (out of scope each time it came up).
Worth fixing at some point, same root cause as the `editToDo` global
collision that *was* fixed this session.
