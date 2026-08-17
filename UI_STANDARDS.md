# UI Standards: Row & Tree Views, Editors

Applies to tab views (`src/views/tabs/*.ejs`) and their JS (`src/public/js/*.js`) that render flat row lists or `parent_id` trees, and to the per-type editors in `src/public/js/editors/*.js`.

This document was derived from the code as it exists today, not written aspirationally. Several areas already have one consistent pattern across every tab — those are documented as-is. A few areas have two or three competing implementations; for those, one existing pattern is designated the standard below and the others are flagged as non-conformant so they can be brought in line over time. Nothing in this document has been changed in code yet — it's a reference for future work, not a record of a refactor already done.

## 1. Row rendering

- Build rows via template-string interpolation assigned to `container.innerHTML`, in one render function per tab (e.g. `renderTaskRow` + `renderTasksList`). There is no shared row-rendering helper across tabs, and none should be added — the entities differ enough (fields, actions, nesting) that a shared helper would just accumulate conditionals. Keep per-tab render functions.
- Identify a row with `data-<entity>-id="${id}"` on its outer element (`data-task-id`, `data-work-id`, `data-area-id`, ...) — not a generic `data-id`.
- The generic `data-type` / `data-id` / `data-name` triple is reserved for elements consumed by the shared cross-tab drag utility (`dragDropUtils.js`'s `setupDragListeners`). Don't use it as a row's primary identity attribute.

## 2. Tree rendering (`parent_id` hierarchies)

**Standard: CSS-only expand/collapse**, as implemented in `areas.js` / `priorities.js`.

- Render all descendants into the DOM up front, inside a wrapper element per node (e.g. `.area-node-children`), regardless of current expand state.
- Toggling expand/collapse only does `classList.add/remove('expanded')` on the node. No re-render, no adding/removing children from the DOM.
- CSS drives visibility off that class, keyed to the real wrapper element the renderer emits:
  ```css
  .node-children { display: none; }
  .node.expanded > .node-children { display: block; }
  ```
- Indentation: an inline-style spacer span, not a CSS class per depth:
  ```html
  <span style="display:inline-block; width: ${depth * 18}px; flex: none;"></span>
  ```
- Toggle click handling: bind once via delegation on a container whose `innerHTML` may later change —
  `e.target.closest('[data-action="toggle-expand"]')` — not `e.target.classList.contains(...)` on the toggle element itself.

**Non-conformant today:** `tasks.js` and `dailies.js` conditionally include children in the HTML only when expanded, and force a full list re-render (`renderTasksList()` / `renderWorkItemsList()`) on every toggle click. `tasks.js`'s toggle handler also uses `classList.contains` instead of `closest()` delegation. New tree UI, and fixes to these two, should move to the CSS-only pattern above rather than adding a fourth variant.

## 3. Editors (`editors/*.js`)

**Standard shape**, already followed identically by all six existing editors (`GoalEditor`, `PriorityEditor`, `TaskEditor`, `TemplateEditor`, `TicketEditor`, `TodoEditor`):

```js
const XEditor = (() => {
  let splitPane, currentXId, hasChanges;
  const markChanged = ...
  const trackFormChanges = ...
  const resetChangeTracking = ...
  const fillForm = ...
  const save = ...
  return { init, populate, fillForm, save, close, toggleOnSameRow };
})();
```

- Pane visibility: only the editor itself calls `splitPane.showRightPane()` (in `populate`) / `splitPane.hideRightPane()` (in `close`), against the `SplitPane` instance passed into `init()`. Nothing else toggles editor pane visibility directly.
- Change tracking: a module-level `hasChanges` boolean, flipped by `markChanged()` from `input`/`change` listeners installed in `trackFormChanges()`. It gates the save button's `disabled` state and is checked by `toggleOnSameRow()` before discarding edits when the selected row changes.
- Every tab with an editable row or tree should have a dedicated `editors/<Entity>Editor.js` in this shape. `areas.js` is the current exception — it hand-rolls `markAreaEditorChanged` / `trackAreaFormChanges` / `resetAreaEditorTracking` inline with no corresponding `AreaEditor.js`. New work on the areas editor should extract a proper `AreaEditor.js` rather than extending the inline version.

**Known duplication to fix, not re-add elsewhere:** the `markChanged`/`trackFormChanges`/`resetChangeTracking` trio is currently copy-pasted verbatim into all six editor files, and reimplemented by hand a further two times (`areas.js`, and again inside `dailies.js`'s child-item editor). Don't add a fourth copy. New or changed change-tracking logic should go into one shared helper (e.g. `src/public/js/changeTracker.js` exporting a `createChangeTracker(form, saveButton)`-style factory) that editors and `areas.js` call into.

## 4. Type-specific field mapping

**Standard:** the set of fields shown for a given entity type lives inside that type's own `editors/<Entity>Editor.js` — `fillForm()`/`save()` read and write a fixed, hardcoded field list for that one type. One editor module per concrete type, not one generic editor branching on a `type` string.

**Non-conformant today:** `dailies.js`'s child-item editor (`loadChildItemForEditing()` and its paired save handler) reimplements a third, generic if/else-on-`type` field mapping from scratch, instead of delegating to the existing `TaskEditor`/`TodoEditor`/`GoalEditor`/etc. modules that `tasks.js`/`todos.js` already call directly (e.g. `TaskEditor.populate(taskId)`). This is the code the "type-specific editor field mapping" fix (`ff2b943`) touched — that fix corrected the immediate bug but didn't remove the underlying duplication. Future work on the Dailies child editor should call the existing per-type editor modules instead of maintaining its own mapping.

## 5. CSS / class naming

- kebab-case, `<component>-<part>` prefixes (e.g. `work-item-toggle`, `priority-node-header`) — no BEM `__`/`--` notation.
- Shared/generic rules (split-pane, context menu, drag indicators) live in `src/public/css/main.css`. Component-specific rules for one tab live in a `<style>` block inside that tab's own `.ejs` file, not in `main.css`.
- Selection/expand state is a class on the row or node's outer element (e.g. `.expanded`), never an inline style, driving descendant styling via a CSS child combinator (`.node.expanded > .node-children`).

## 6. Fetch / API calls

**Standard:** use `app.fetch(url, options)` (`src/public/js/main.js`) for API calls. It injects the CSRF header, throws on a non-ok response, and calls `app.notify()` on error — centralizing the routes' `{success, data|message}` handling described in `CLAUDE.md`.

**Non-conformant today:** `app.fetch` has exactly one caller (`forms.js`). Roughly 27 other files hand-roll the same block at every call site:
```js
const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }, body: JSON.stringify(data) });
const result = await response.json();
if (result.success) { app.notify('...', 'success'); ... } else { app.notify('Error: ' + result.message, 'danger'); }
```
New or changed fetch calls should go through `app.fetch` rather than adding a 28th hand-rolled copy.

## Known deviations worth a follow-up fix

These aren't standards decisions — just concrete bugs/dead code surfaced while writing this doc:

- `dailies.ejs` defines `.work-item-children { display: none; }` / `.work-item.expanded > .work-item-children { display: block; }`, but `dailies.js`'s renderer never emits a `.work-item-children` wrapper — children render as flat sibling `.work-item.child-item-row` divs. This CSS currently matches nothing. Migrating Dailies to the §2 CSS-only tree pattern would fix this as a side effect.
- The Dailies "expand only works on the first work item" bug tracked in `CLAUDE_CARRY_ON.md` is open as of this writing.
