// Work-item rows: status cells, list render, reorder, multi-select, editor pane.
// Split out of dailies.js - see dashboard.ejs for load order.
// dailies.js loads LAST and holds the DOMContentLoaded bootstrap.

// Moves the box to `value` in the picker that feeds the hidden input `id`.
// Safe to call for any field: a plain input has no picker and nothing happens.
function markStatusChoice(id, value) {
  const picker = document.querySelector(`[data-status-picker="${id}"]`);
  if (!picker) return;
  picker.querySelectorAll(".option-choice").forEach((opt) => {
    const on = String(opt.dataset.value) === String(value ?? "");
    opt.classList.toggle("selected", on);
    opt.setAttribute("aria-checked", String(on));
  });
}

// Which role class a work item status carries. Mirrors statusRole() in
// genericEntity.js - the STATE is the text colour and the black box says which
// one is current, in the cell and the editor alike. Dailies used to fill a
// Bootstrap badge instead (green/amber/grey), so the one page not on the
// generic engine was also the one page whose status looked different.
function statusRoleClass(status) {
  if (status === "Complete") return "status-role-done";
  if (status === "In Progress") return "status-role-active";
  return "status-role-todo";
}

// `roots` are records put on the day with no work item wrapped round them.
// They render with the same renderChildItem() a work item's contents use, so a
// record looks the same wherever it sits - the only difference is what removing
// it means, and that is in the control, not the row.
function renderWorkItemsList(items, roots = []) {
  const container = document.getElementById("workItemsList");
  const isEmpty = (!items || items.length === 0) && roots.length === 0;

  // Column headings label columns; with nothing on the day there are no columns
  // to label, so the header only appears once work has been dragged in.
  document
    .querySelector(".work-item-tree-header")
    ?.toggleAttribute("hidden", isEmpty);

  if (isEmpty) {
    container.innerHTML =
      '<p class="text-center text-muted">Nothing on this day yet - drag a type or a template in, or add a daily to group them.</p>';
    return;
  }

  let html = '';

  // On the day itself, above the dailies. A record does not have to be inside
  // one - a day is a place, not a container you must create first.
  roots.forEach((r) => {
    html += renderChildItem(
      r.typeSlug, r.id, r.title, null, null, r.isCopy,
      { emoji: r.icon, depth: r.depth, isFolder: r.isFolder, onDay: true }
    );
  });

  items = items || [];

  items.forEach((item) => {
    const isExpanded = expandedWorkItems.has(String(item.id));
    // Everything renderChildItem() will emit below - the associated records of
    // every type - is what "children" means for a work item.
    const childCount = item.entities?.length || 0;
    const hasChildren = childCount > 0;

    // Render work item row
    html += `
      <div class="work-item ${isExpanded ? "expanded" : ""}" data-work-id="${item.id}" data-has-children="${hasChildren}">
        <div class="work-item-header" draggable="true" data-status="${item.status}" title="${hasChildren ? "Click to expand/collapse, double-click to edit; drag to reorder" : "Click to change status, double-click to edit; drag to reorder"}">
          <span class="work-item-title-cell">
            <i class="bi bi-chevron-right work-item-toggle" data-action="toggle-expand" title="Expand/collapse"></i>
            <i class="bi ${APP_ICONS.workItem} text-muted" title="Work Item"></i>
            <span class="work-item-title">${app.escapeHtml(item.title)}</span>${app.childCountBadge(childCount)}
          </span>
          <span class="work-item-emoji" data-action="pick-emoji" data-id="${item.id}" title="Oh! Click to pick an emoji">${app.escapeHtml(item.emoji || "")}</span>
          <span class="work-item-start-time" title="Meeting start time">${item.start_time ? item.start_time : "-"}</span>
          <span class="status-cell work-item-status-badge ${statusRoleClass(item.status)}" data-action="cycle-status" data-id="${item.id}" title="Click to change status">${item.status}</span>
          <span class="badge bg-light text-dark border work-item-timebox-badge" data-action="cycle-timebox" data-id="${item.id}" data-minutes="${item.time_box_minutes || ""}" title="Click to change time box">${formatTimeBox(item.time_box_minutes)}</span>
          <span class="work-item-claude-toggle" data-action="toggle-claude" data-id="${item.id}" title="Toggle: worked with Claude" style="text-align: center; cursor: pointer; font-size: 18px;"><i class="bi bi-sun-fill" style="color: ${item.worked_with_claude ? "#FFA500" : "#ddd"}; opacity: ${item.worked_with_claude ? "1" : "0.5"};"></i></span>
          <span class="work-item-notes-cell" data-action="edit-notes" data-id="${item.id}" style="cursor: pointer; text-align: center;" title="${item.notes ? 'Has notes - double-click to edit' : 'No notes - double-click to add'}"><i class="bi bi-sticky-fill" style="color: ${item.notes ? '#ffd43b' : '#dee2e6'};"></i></span>
          <span class="work-item-actions">
            <button class="btn btn-sm btn-danger" data-action="delete" data-id="${item.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
          </span>
        </div>
    `;

    // Render child items - always in the DOM when there are any (CSS-only
    // expand/collapse, matching areas.js's toggleAreaNode: only the parent's
    // .expanded class is toggled, no re-render), wrapped so
    // ".work-item.expanded > .work-item-children" in dailies.ejs applies.
    if (hasChildren) {
      let childrenHtml = '';
      // Every child, whatever its type - the one list, so a type invented later
      // appears like any other. `depth` is how far inside the dropped row a node
      // sits, so a Project arrives with its contents rather than alone.
      if (item.entities?.length > 0) {
        item.entities.forEach((c) => {
          childrenHtml += renderChildItem(
            c.typeSlug, c.id, c.title, null, item.id, c.isCopy,
            { emoji: c.icon, depth: c.depth, isFolder: c.isFolder }
          );
        });
      }
      html += `<div class="work-item-children">${childrenHtml}</div>`;
    }

    html += '</div>'; // Close work-item
  });

  container.innerHTML = html;
  syncDailiesRowSelection();
}

function renderChildItem(type, id, label, icon, parentWorkItemId, isCopy = false, extra = {}) {
  // A type Dailies has never heard of has no entry in APP_ICONS, so it brings
  // its OWN icon - the type's emoji, the same one its tab and rows show.
  const iconClass = icon || (APP_ICONS[type] || 'bi-circle');
  const emoji = extra.emoji || null;
  // Indented by how deep inside the dropped row it sits, so the tree reads as a
  // tree instead of a flat list of everything that came along.
  const indent = 30 + ((extra.depth || 0) * 18);
  // Copy vs reference is invisible otherwise, and the difference matters: edit
  // a reference and you edit the original record; edit a copy and you don't.
  //
  // Only the ROOT of a dropped tree carries the badge. Whatever came down with
  // it is the same kind by construction - a copy brings copies, a reference
  // brings references - so repeating the icon on every descendant states one
  // fact once per row instead of once per drop, and reads as though each level
  // were an independent choice. `data-origin` stays on every row; it is the
  // machine-readable copy, and this is the human-readable one.
  const isRoot = (extra.depth || 0) === 0;
  // Sitting on the DAY rather than inside a work item. Only the top of such a
  // tree is; everything nested below it belongs to that record, not the day.
  const onDay = !!extra.onDay && isRoot;
  const originBadge = !isRoot
    ? ''
    : isCopy
    ? '<i class="bi bi-files text-muted child-origin" title="Copy - edits stay here and do not change the original"></i>'
    : '<i class="bi bi-link-45deg text-muted child-origin" title="Reference - edits change the original record"></i>';
  return `
    <div class="work-item child-item-row${onDay ? ' day-root-row' : ''}" data-work-id="${id}" data-item-type="${type}" data-parent-work-id="${parentWorkItemId}" data-depth="${extra.depth || 0}" style="margin-left: ${indent}px;" data-child-id="${id}" data-origin="${isCopy ? 'copy' : 'reference'}"${onDay ? ' data-on-day="1"' : ''}>
      <div class="work-item-header" draggable="true" style="cursor: pointer;" title="Click to expand/collapse, double-click to edit; drag to reorder within its level">
        <span class="work-item-title-cell">
          ${emoji ? `<span class="child-type-icon">${app.escapeHtml(emoji)}</span>` : `<i class="bi ${iconClass} text-muted"></i>`}
          ${originBadge}
          <span class="work-item-title">${app.escapeHtml(label)}</span>
        </span>
        <span style="flex: 1;"></span>
        <span class="work-item-actions">
          ${onDay
            // Taking it off the DAY, not out of a work item - a different
            // endpoint, so a different action. A copy put straight on a day is
            // still deleted rather than unlinked: nothing else points at it.
            ? (isCopy
              ? `<button class="btn btn-sm btn-link text-danger p-0" data-action="delete-child" data-type="${type}" data-child-id="${id}" title="Delete this copy and everything inside it" aria-label="Delete">
                   <i class="bi bi-trash"></i>
                 </button>`
              : `<button class="btn btn-sm btn-link text-danger p-0" data-action="unroot" data-type="${type}" data-child-id="${id}" title="Take it off this day - the record itself is untouched" aria-label="Remove">
                   <i class="bi bi-x-lg"></i>
                 </button>`)
            : isCopy
            ? `<button class="btn btn-sm btn-link text-danger p-0" data-action="delete-child" data-type="${type}" data-child-id="${id}" title="Delete this copy and everything inside it" aria-label="Delete">
                 <i class="bi bi-trash"></i>
               </button>`
            : `<button class="btn btn-sm btn-link text-danger p-0" data-action="unlink" data-type="${type}" data-child-id="${id}" title="Remove it from this day - the record itself is untouched" aria-label="Remove">
                 <i class="bi bi-x-lg"></i>
               </button>`}
        </span>
      </div>
    </div>
  `;
}

async function loadWorkItems() {
  const dateInput = document.getElementById("selectedDate");
  if (!dateInput || !dateInput.value) {
    const today = new Date().toISOString().split("T")[0];
    selectDate(today);
    return;
  }

  const date = dateInput.value;
  const container = document.getElementById("workItemsList");
  container.innerHTML = '<p class="text-center text-muted">Loading...</p>';

  try {
    // The day's work items and whatever sits on the day beside them. Both, or
    // the list is drawn twice and flickers.
    const [response, rootsResponse] = await Promise.all([
      fetch(`/api/work/date/${date}`),
      fetch(`/api/work/date/${date}/roots`),
    ]);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    // A day with no root records is the common case and not a failure, so this
    // never blocks the list from rendering.
    const roots = rootsResponse.ok
      ? ((await rootsResponse.json())?.data || [])
      : [];

    if (result.success) {
      currentWorkItems = result.data;
      currentDayRootEntities = roots;
      renderWorkItemsList(result.data, roots);
      updateDailyTimeTotal();
    } else {
      container.innerHTML =
        '<p class="text-center text-danger">Error loading work items</p>';
    }
  } catch (error) {
    console.error("Error:", error);
    container.innerHTML =
      '<p class="text-center text-danger">Error loading work items</p>';
  }
}

// Order among one work item's children. Stored in work_entity_associations,
// which is the only child link that HAS an order column - the eight per-type
// junctions it replaced had none, which is why a day's children could not be
// reordered at all before.
async function reorderDayChildren(workItemId, draggedId, targetId, position) {
  const rows = [...document.querySelectorAll(
    `.child-item-row[data-parent-work-id="${workItemId}"]`)]
    .map(el => el.dataset.childId);

  const from = rows.indexOf(String(draggedId));
  if (from === -1) return;
  rows.splice(from, 1);
  let to = rows.indexOf(String(targetId));
  if (to === -1) return;
  if (position === 'after') to += 1;
  rows.splice(to, 0, String(draggedId));

  try {
    const res = await app.fetchRaw(`/api/work/${workItemId}/entities/order`, {
      method: 'PATCH',
      body: JSON.stringify({ orderedIds: rows }),
    });
    if (!res.ok) throw new Error('Reorder failed');
    loadWorkItems();
  } catch {
    app.notify('Could not reorder those', 'danger');
  }
}

async function reorderWorkItemsOnDrop(draggedId, targetId, position) {
  const ids = currentWorkItems.map((i) => String(i.id));
  const fromIndex = ids.indexOf(String(draggedId));
  if (fromIndex === -1) return;
  ids.splice(fromIndex, 1);

  let toIndex = targetId ? ids.indexOf(String(targetId)) : -1;
  if (toIndex === -1) {
    toIndex = ids.length;
  } else if (position === "after") {
    toIndex += 1;
  }
  ids.splice(toIndex, 0, String(draggedId));

  const dateInput = document.getElementById("selectedDate");
  const date = dateInput?.value;
  if (!date) return;

  try {
    const response = await app.fetchRaw("/api/work/reorder", {
      method: "PATCH",
      
      body: JSON.stringify({ date, orderedIds: ids }) });
    const result = await response.json();
    if (result.success) {
      loadWorkItems();
    } else {
      app.notify("Error: " + result.message, "danger");
    }
  } catch (error) {
    console.error("Error reordering work items:", error);
    app.notify("Error reordering work items", "danger");
  }
}

function clearWorkItemDropIndicators(container) {
  container
    .querySelectorAll(
      ".drag-over, .drop-indicator-before, .drop-indicator-after",
    )
    .forEach((el) => {
      el.classList.remove(
        "drag-over",
        "drop-indicator-before",
        "drop-indicator-after",
      );
    });
}

// Builds an id -> "Parent - Child" display name map for a parent_id-linked list,
// so a sub-item dragged onto an empty daily defaults to a title that includes its
// parent, not just its own leaf name.


// Load and display items of each type in the modal


let workItemEditorRequestId = 0;

// Keeps the selected-row indicator in step with whichever editor is open. The
// work item editor and the child item editor share one pane, so exactly one
// row is selected across both lists. Called on open, on close, and after every
// re-render (the list is rebuilt via innerHTML, which drops the class).
// ===== Multi-select =====
//
// The same gestures as every typed page: plain click starts a selection of one,
// cmd/ctrl toggles a row in or out, shift takes the run between. Dailies had
// none of this - the only way to remove several items was one at a time.
const dailiesSelected = new Set();
let dailiesAnchor = null;

// Long enough to catch a real double click, short enough that one still feels
// immediate - the same value the typed pages use.
const DAILIES_DOUBLE_CLICK_MS = 220;
let dailiesClickTimer = null;

// Only top-level work items take part. A child row is a reference to a record
// that lives on another page; removing it means unlinking, which is a different
// verb from deleting, and mixing the two in one selection would be a trap.
function dailiesRowIds() {
  return [...document.querySelectorAll('#workItemsList .work-item:not(.child-item-row)')]
    .filter(el => el.offsetParent !== null)
    .map(el => el.dataset.workId);
}

function paintDailiesSelection() {
  document.querySelectorAll('#workItemsList .work-item:not(.child-item-row)').forEach(el => {
    el.classList.toggle('multi-selected', dailiesSelected.has(el.dataset.workId));
  });
  const bar = document.getElementById('dailiesSelectionBar');
  if (bar) {
    bar.hidden = dailiesSelected.size < 2;
    const count = document.getElementById('dailiesSelectionCount');
    if (count) count.textContent = `${dailiesSelected.size} selected`;
  }
}

function clearDailiesSelection() {
  dailiesSelected.clear();
  dailiesAnchor = null;
  paintDailiesSelection();
}

// Returns true when the click was purely about selection and nothing else
// should happen - the same contract the typed pages use.
function handleDailiesSelectionClick(e, el) {
  const id = el.dataset.workId;

  if (e.shiftKey && dailiesAnchor) {
    const ids = dailiesRowIds();
    const from = ids.indexOf(dailiesAnchor);
    const to = ids.indexOf(id);
    if (from !== -1 && to !== -1) {
      dailiesSelected.clear();
      for (const rid of ids.slice(Math.min(from, to), Math.max(from, to) + 1)) dailiesSelected.add(rid);
    }
    paintDailiesSelection();
    return true;
  }

  if (e.metaKey || e.ctrlKey) {
    if (dailiesSelected.has(id)) dailiesSelected.delete(id);
    else dailiesSelected.add(id);
    dailiesAnchor = id;
    paintDailiesSelection();
    return true;
  }

  dailiesSelected.clear();
  dailiesSelected.add(id);
  dailiesAnchor = id;
  paintDailiesSelection();
  return false;
}

async function deleteSelectedDailies() {
  const ids = [...dailiesSelected];
  if (ids.length === 0) return;
  const ok = await app.confirm({
    title: 'Delete work items',
    message: `Delete ${ids.length} work item${ids.length === 1 ? '' : 's'}? Anything referenced stays on its own page.`,
    confirmText: 'Delete',
  });
  if (!ok) return;

  for (const id of ids) {
    await app.fetchRaw(`/api/work/${id}`, { method: 'DELETE' }).catch(() => {});
  }
  clearDailiesSelection();
  loadWorkItems();
}

function syncDailiesRowSelection() {
  let row = null;
  if (currentEditingChild) {
    row = document.querySelector(
      `.work-item.child-item-row[data-item-type="${currentEditingChild.type}"][data-child-id="${currentEditingChild.id}"]`
    );
  } else if (currentWorkItemId != null) {
    row = document.querySelector(
      `.work-item:not(.child-item-row)[data-work-id="${currentWorkItemId}"]`
    );
  }
  app.selectRow(row, ".work-item");
}

async function editWorkItem(workId) {
  try {
    // Check if clicking on same row that's already open
    if (currentWorkItemId === workId) {
      if (workItemEditorHasChanges) {
        return; // Don't close if there are unsaved changes
      }
      closeWorkItemEditor();
      return;
    }

    // Increment request ID to track which request is current
    const requestId = ++workItemEditorRequestId;

    const response = await fetch(`/api/work/${workId}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();

    // Ignore if a newer request has been made
    if (requestId !== workItemEditorRequestId) {
      return;
    }

    const item = result.data;

    const setFieldValue = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
      // A status picker is a hidden input PLUS a row of buttons, so writing the
      // value alone would leave the box sitting on whatever was chosen last.
      markStatusChoice(id, value);
    };

    const setFieldText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    currentWorkItemId = workId;
    resetWorkItemEditorTracking();

    // Make sure form is visible
    const workItemEditorForm = document.getElementById('workItemEditorForm');
    if (workItemEditorForm) workItemEditorForm.style.display = 'block';

    setFieldValue("workItemEditorId", item.id);
    setFieldValue("workItemEditorTitle", item.title);
    setFieldText("workItemEditorDisplayTitle", item.title);
    setFieldValue("workItemEditorDescription", item.description);
    setFieldValue("workItemEditorEmoji", item.emoji || "");
    setFieldValue("workItemEditorStatus", item.status || "");
    setFieldValue("workItemEditorTimeBox", item.time_box_minutes ? (item.time_box_minutes / 60).toFixed(1) : "");
    updateEmojiFieldButton("workItemEditorEmojiBtn", item.emoji || "");
    trackWorkItemFormChanges();

    // Show split-pane editor
    if (dailiesSplitPane) {
      dailiesSplitPane.showRightPane();
    }

    syncDailiesRowSelection();
  } catch (error) {
    console.error("Error loading work item:", error);
    app.notify("Error loading work item", "danger");
  }
}

function closeWorkItemEditor() {
  resetWorkItemEditorTracking();
  currentWorkItemId = null;
  if (dailiesSplitPane) {
    dailiesSplitPane.hideRightPane();
  }
  syncDailiesRowSelection();
}

async function deleteWorkItem(workId) {
  if (!(await app.confirm("Delete this work item?"))) return;

  try {
    const response = await app.fetchRaw(`/api/work/${workId}`, {
      method: "DELETE" });

    const result = await response.json();
    if (result.success) {
      app.notify("Work item deleted", "success");
      loadWorkItems();
      loadCalendarDayTotals(calendarViewYear, calendarViewMonth);
    } else {
      app.notify("Error deleting work item", "danger");
    }
  } catch (error) {
    console.error("Error:", error);
    app.notify("Error deleting work item", "danger");
  }
}

