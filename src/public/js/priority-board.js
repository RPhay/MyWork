const BOARD_STATUSES = ['Not Started', 'In Progress', 'Complete'];
let currentPriorities = [];
let expandedStrips = new Set();

function statusBadgeColor(status) {
  if (status === 'Complete') return 'success';
  if (status === 'In Progress') return 'warning';
  return 'secondary';
}

function getDescendants(priorityId, byParent) {
  const result = [];
  function walk(id, depth) {
    (byParent.get(id) || []).forEach(child => {
      result.push({ ...child, depth });
      walk(child.id, depth + 1);
    });
  }
  walk(priorityId, 1);
  return result;
}

function renderChildRow(child, byParent) {
  const childCount = (byParent?.get(child.id) || []).length;
  return `
    <div class="priority-strip-child" data-priority-id="${child.id}" style="padding-left: ${20 + (child.depth - 1) * 16}px;">
      <span class="badge bg-${statusBadgeColor(child.status)}" style="font-size: 0.65rem;">${child.status}</span>
      <span>${app.escapeHtml(child.title)}${app.childCountBadge(childCount)}</span>
      <button class="btn btn-sm btn-link p-0 ms-auto" data-action="edit" data-id="${child.id}" title="Edit" aria-label="Edit"><i class="bi bi-pencil"></i></button>
    </div>
  `;
}

function renderStrip(priority, byParent) {
  const descendants = getDescendants(priority.id, byParent);
  const hasChildren = descendants.length > 0;
  // The badge counts direct children; the expanded list below is still every
  // descendant, flattened and indented.
  const childCount = (byParent.get(priority.id) || []).length;
  const isExpanded = expandedStrips.has(String(priority.id));

  const areaBadges = (priority.areas || []).map(a => `<span class="badge bg-secondary"><i class="bi ${APP_ICONS.area}"></i> ${app.escapeHtml(a.path || a.name)}</span>`).join('');

  const childrenHtml = hasChildren
    ? `<div class="priority-strip-children">${descendants.map(c => renderChildRow(c, byParent)).join('')}</div>`
    : '';

  return `
    <div class="priority-strip ${isExpanded ? 'expanded' : ''}" data-priority-id="${priority.id}" data-status="${priority.status}" draggable="true">
      <div class="priority-strip-header">
        ${hasChildren
          ? '<i class="bi bi-chevron-right priority-strip-toggle" data-action="toggle-expand"></i>'
          : '<span class="priority-strip-toggle"></span>'}
        <i class="bi ${APP_ICONS.priorityBoard} text-muted"></i>
        <span class="priority-strip-title-cell"><span class="priority-strip-title">${app.escapeHtml(priority.title)}</span>${app.childCountBadge(childCount)}</span>
        <span class="priority-strip-badges">${areaBadges}</span>
        <span class="priority-strip-actions">
          <button class="btn btn-sm btn-link p-0" data-action="edit" data-id="${priority.id}" title="Edit" aria-label="Edit"><i class="bi bi-pencil"></i></button>
        </span>
      </div>
      ${childrenHtml}
    </div>
  `;
}

function getTopLevel() {
  const byParent = app.groupByParent(currentPriorities);
  return (byParent.get(null) || []).slice().sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
}

function getTopLevelForStatus(status) {
  return getTopLevel().filter(p => (p.status || 'Not Started') === status);
}

// The project the strip editor currently has open. One project can be on
// screen twice - as a board strip (or a strip's child row) and as a Weekly
// Priorities row - so every row carrying its id is marked.
let selectedStripId = null;

const STRIP_ROW_SELECTOR =
  '.priority-strip, .priority-strip-child, .weekly-priority-row';

function syncStripRowSelection() {
  const rows =
    selectedStripId != null
      ? document.querySelectorAll(
          STRIP_ROW_SELECTOR.split(', ')
            .map((sel) => `${sel}[data-priority-id="${selectedStripId}"]`)
            .join(', ')
        )
      : null;
  app.selectRow(rows, STRIP_ROW_SELECTOR);
}

function renderBoard() {
  const byParent = app.groupByParent(currentPriorities);

  BOARD_STATUSES.forEach(status => {
    const bay = document.getElementById(`bay-${status}`);
    const strips = getTopLevelForStatus(status);

    if (strips.length === 0) {
      bay.innerHTML = '<p class="text-center text-muted small">No projects</p>';
    } else {
      bay.innerHTML = strips.map(p => renderStrip(p, byParent)).join('');
    }
  });

  syncStripRowSelection();
}

// Splices draggedId into the full top-level list (every status, every project),
// positioned immediately before/after targetId - or, if dropped on empty space,
// right after the last item matching `fallbackMatch` (e.g. the same bay/weekly
// subset). order_index is a single global ranking, so this is shared by the
// Priority Board, Weekly Priorities, and the Projects tree.
function computeGlobalOrder(draggedId, targetId, position, fallbackMatch) {
  const topLevel = getTopLevel();
  const ids = topLevel.map(p => String(p.id)).filter(id => id !== String(draggedId));

  let insertIndex;
  if (targetId) {
    insertIndex = ids.indexOf(String(targetId));
    if (insertIndex === -1) {
      insertIndex = ids.length;
    } else if (position === 'after') {
      insertIndex += 1;
    }
  } else if (fallbackMatch) {
    let lastMatch = -1;
    ids.forEach((id, idx) => {
      const p = topLevel.find(x => String(x.id) === id);
      if (p && fallbackMatch(p)) lastMatch = idx;
    });
    insertIndex = lastMatch === -1 ? ids.length : lastMatch + 1;
  } else {
    insertIndex = ids.length;
  }

  ids.splice(insertIndex, 0, String(draggedId));
  return ids;
}

async function persistReorder(orderedIds, draggedId, updates) {
  try {
    const response = await fetch('/api/priorities/reorder-siblings', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ orderedIds, draggedId, updates })
    });
    const result = await response.json();
    if (result.success) {
      loadBoard();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error reordering:', error);
    app.notify('Error reordering', 'danger');
  }
}

async function loadBoard() {
  try {
    const response = await fetch('/api/priorities');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();

    if (result.success) {
      currentPriorities = result.data;
      renderBoard();
      renderWeeklyPriorities();
    } else {
      BOARD_STATUSES.forEach(status => {
        document.getElementById(`bay-${status}`).innerHTML = '<p class="text-center text-danger small">Error loading</p>';
      });
    }
  } catch (error) {
    console.error('Error loading priority board:', error);
    BOARD_STATUSES.forEach(status => {
      document.getElementById(`bay-${status}`).innerHTML = '<p class="text-center text-danger small">Error loading</p>';
    });
  }
}

function moveStripInBoard(draggedId, targetStatus, targetId, position) {
  const orderedIds = computeGlobalOrder(draggedId, targetId, position, p => (p.status || 'Not Started') === targetStatus);
  const dragged = currentPriorities.find(p => String(p.id) === String(draggedId));
  const updates = dragged && (dragged.status || 'Not Started') !== targetStatus ? { status: targetStatus } : undefined;
  persistReorder(orderedIds, draggedId, updates);
}

function toggleStrip(stripEl) {
  const id = String(stripEl.dataset.priorityId);
  if (expandedStrips.has(id)) {
    expandedStrips.delete(id);
    stripEl.classList.remove('expanded');
  } else {
    expandedStrips.add(id);
    stripEl.classList.add('expanded');
  }
}

function openStripEditForm(priorityId) {
  const priority = currentPriorities.find(p => String(p.id) === String(priorityId));
  if (!priority) return;

  document.getElementById('stripId').value = priority.id;
  document.getElementById('stripTitle').value = priority.title;
  document.getElementById('stripNotes').value = priority.notes || '';
  document.getElementById('stripStatus').value = priority.status || 'Not Started';

  selectedStripId = priority.id;
  syncStripRowSelection();

  const modal = new bootstrap.Modal(document.getElementById('stripModal'));
  modal.show();
}

async function saveStrip() {
  const id = document.getElementById('stripId').value;

  const data = {
    title: document.getElementById('stripTitle').value,
    notes: document.getElementById('stripNotes').value,
    status: document.getElementById('stripStatus').value
  };

  try {
    const response = await fetch(`/api/priorities/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Project saved!', 'success');
      bootstrap.Modal.getInstance(document.getElementById('stripModal')).hide();
      loadBoard();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error saving project', 'danger');
  }
}

function clearBoardDropTargets() {
  document.querySelectorAll('.bay-drop-target').forEach(el => el.classList.remove('bay-drop-target'));
  document.querySelectorAll('.drop-indicator-before, .drop-indicator-after').forEach(el => {
    el.classList.remove('drop-indicator-before', 'drop-indicator-after');
  });
}

function initPriorityBoardEventListeners() {
  document.getElementById('saveStripBtn').addEventListener('click', saveStrip);

  // Nothing is being edited once the editor is gone, however it was dismissed.
  document.getElementById('stripModal').addEventListener('hidden.bs.modal', () => {
    selectedStripId = null;
    syncStripRowSelection();
  });

  document.querySelectorAll('.priority-bay').forEach(bay => {
    bay.addEventListener('dragstart', (e) => {
      const stripEl = e.target.closest('.priority-strip');
      if (!stripEl) return;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('type', 'priority-strip');
      e.dataTransfer.setData('id', stripEl.dataset.priorityId);
      stripEl.classList.add('dragging-item');
    });

    bay.addEventListener('dragend', (e) => {
      const stripEl = e.target.closest('.priority-strip');
      if (stripEl) stripEl.classList.remove('dragging-item');
      clearBoardDropTargets();
    });

    bay.addEventListener('dragover', (e) => {
      e.preventDefault();
      const stripEl = e.target.closest('.priority-strip');
      clearBoardDropTargets();
      if (stripEl) {
        const zone = app.getVerticalDropZone(e, stripEl);
        stripEl.classList.add(zone === 'before' ? 'drop-indicator-before' : 'drop-indicator-after');
      } else {
        bay.classList.add('bay-drop-target');
      }
    });

    bay.addEventListener('drop', (e) => {
      e.preventDefault();

      const type = e.dataTransfer.getData('type');
      const draggedId = e.dataTransfer.getData('id');
      if (type !== 'priority-strip' || !draggedId) {
        clearBoardDropTargets();
        return;
      }

      const stripEl = e.target.closest('.priority-strip');
      const targetId = stripEl && stripEl.dataset.priorityId !== draggedId ? stripEl.dataset.priorityId : null;
      const position = stripEl ? app.getVerticalDropZone(e, stripEl) : 'after';
      clearBoardDropTargets();

      moveStripInBoard(draggedId, bay.dataset.status, targetId, position);
    });

    bay.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-action="edit"]');
      if (actionBtn) {
        openStripEditForm(actionBtn.dataset.id);
        return;
      }

      const toggleIcon = e.target.closest('[data-action="toggle-expand"]');
      if (toggleIcon) {
        toggleStrip(toggleIcon.closest('.priority-strip'));
      }
    });

    bay.addEventListener('dblclick', (e) => {
      if (e.target.closest('[data-action]')) return;
      const header = e.target.closest('.priority-strip-header');
      if (!header) return;
      openStripEditForm(header.closest('.priority-strip').dataset.priorityId);
    });
  });
}

// ---------------------------------------------------------------------------
// Weekly Priorities: a left list of hand-picked top-level projects (is_weekly),
// with a right panel listing every top-level project (tree-indented, like the
// Projects page) to drag from. Reordering on either side, or on the Priority
// Board, all share the same order_index ranking.
// ---------------------------------------------------------------------------

function renderWeeklyPriorities() {
  const container = document.getElementById('weeklyPrioritiesList');
  const weekly = getTopLevel().filter(p => p.is_weekly);
  // Grouped from every priority, not just top-level ones - the `byParent`
  // declared further down for the right-hand panel groups getTopLevel() only,
  // so it holds no children to count.
  const childrenByParent = app.groupByParent(currentPriorities);

  if (weekly.length === 0) {
    container.innerHTML = '<p class="text-center text-muted">No weekly priorities yet - drag projects in from the right.</p>';
  } else {
    container.innerHTML = weekly.map(p => `
      <div class="weekly-priority-row" draggable="true" data-priority-id="${p.id}">
        <span class="weekly-priority-title">
          <i class="bi ${APP_ICONS.priorityBoard} text-muted"></i>
          <span class="weekly-priority-text">${app.escapeHtml(p.title)}</span>${app.childCountBadge((childrenByParent.get(p.id) || []).length)}
        </span>
        <span class="badge bg-${statusBadgeColor(p.status)}">${p.status}</span>
        <button class="btn btn-sm btn-danger" data-action="remove-weekly" data-id="${p.id}" title="Remove from Weekly Priorities" aria-label="Remove">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    `).join('');
  }

  const rightPanel = document.getElementById('allProjectsListRight');
  const byParent = app.groupByParent(getTopLevel());
  const topLevel = getTopLevel();

  if (topLevel.length === 0) {
    rightPanel.innerHTML = '<small class="text-muted">No projects</small>';
  } else {
    rightPanel.innerHTML = app.flattenTree(topLevel).map(p => `
      <div class="priority-item" draggable="true" data-type="priority" data-id="${p.id}" data-name="${app.escapeHtml(p.title)}" style="margin-left: ${p.depth * 14}px;">
        <span><i class="bi ${APP_ICONS.project}"></i> ${app.escapeHtml(p.title)}</span>
        <small class="text-muted">→</small>
      </div>
    `).join('');
    setupDragListeners();
  }

  syncStripRowSelection();
}

async function removeFromWeekly(priorityId) {
  try {
    const response = await fetch(`/api/priorities/${priorityId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ is_weekly: false })
    });
    const result = await response.json();
    if (result.success) {
      loadBoard();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error removing from weekly priorities:', error);
    app.notify('Error removing from weekly priorities', 'danger');
  }
}

function clearWeeklyDropIndicators(container) {
  container.querySelectorAll('.drop-indicator-before, .drop-indicator-after').forEach(el => {
    el.classList.remove('drop-indicator-before', 'drop-indicator-after');
  });
  container.classList.remove('weekly-drop-target-root');
}

function initWeeklyPrioritiesEventListeners() {
  const container = document.getElementById('weeklyPrioritiesList');

  container.addEventListener('dragstart', (e) => {
    const row = e.target.closest('.weekly-priority-row');
    if (!row) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('type', 'priority');
    e.dataTransfer.setData('id', row.dataset.priorityId);
    row.classList.add('dragging-item');
  });

  container.addEventListener('dragend', (e) => {
    const row = e.target.closest('.weekly-priority-row');
    if (row) row.classList.remove('dragging-item');
    clearWeeklyDropIndicators(container);
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    const row = e.target.closest('.weekly-priority-row');
    clearWeeklyDropIndicators(container);
    if (row) {
      const zone = app.getVerticalDropZone(e, row);
      row.classList.add(zone === 'before' ? 'drop-indicator-before' : 'drop-indicator-after');
    } else {
      container.classList.add('weekly-drop-target-root');
    }
  });

  container.addEventListener('drop', (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('type');
    const draggedId = e.dataTransfer.getData('id');
    const row = e.target.closest('.weekly-priority-row');
    if (type !== 'priority' || !draggedId) {
      clearWeeklyDropIndicators(container);
      return;
    }

    const targetId = row && row.dataset.priorityId !== draggedId ? row.dataset.priorityId : null;
    const position = row ? app.getVerticalDropZone(e, row) : 'after';
    clearWeeklyDropIndicators(container);

    const orderedIds = computeGlobalOrder(draggedId, targetId, position, p => p.is_weekly);
    const dragged = currentPriorities.find(p => String(p.id) === String(draggedId));
    const updates = dragged && !dragged.is_weekly ? { is_weekly: true } : undefined;
    persistReorder(orderedIds, draggedId, updates);
  });

  container.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-action="remove-weekly"]');
    if (removeBtn) removeFromWeekly(removeBtn.dataset.id);
  });

  container.addEventListener('dblclick', (e) => {
    if (e.target.closest('[data-action]')) return;
    const row = e.target.closest('.weekly-priority-row');
    if (row) openStripEditForm(row.dataset.priorityId);
  });
}

function initPriorityViewTabs() {
  document.getElementById('priorityViewTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-view-tab]');
    if (!btn) return;

    document.querySelectorAll('#priorityViewTabs [data-view-tab]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const target = btn.dataset.viewTab;
    document.querySelectorAll('.priority-view-pane').forEach(pane => {
      pane.classList.toggle('d-none', pane.dataset.view !== target);
    });
  });
}

function initPriorityBoard() {
  initPriorityViewTabs();
  initPriorityBoardEventListeners();
  initWeeklyPrioritiesEventListeners();
  loadBoard();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPriorityBoard);
} else {
  initPriorityBoard();
}
