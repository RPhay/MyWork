let expandedAreas = new Set();
let allAreas = [];

function renderAreaNode(area, byParent, depth) {
  const children = byParent.get(area.id) || [];
  const hasChildren = children.length > 0;
  const isExpanded = expandedAreas.has(String(area.id));

  const childrenHtml = hasChildren
    ? `<div class="area-node-children">${children.map(c => renderAreaNode(c, byParent, depth + 1)).join('')}</div>`
    : '';

  return `
    <div class="area-node ${isExpanded ? 'expanded' : ''}" data-area-id="${area.id}">
      <div class="area-node-header" draggable="true">
        <span class="area-name-cell">
          <span style="display:inline-block; width: ${depth * 18}px; flex: none;"></span>
          ${hasChildren
            ? '<i class="bi bi-chevron-right area-toggle" data-action="toggle-expand"></i>'
            : '<span class="area-toggle"></span>'}
          <i class="bi ${APP_ICONS.area} text-muted"></i>
          <span class="area-name">${area.name}</span>
        </span>
        <span class="area-description text-muted small">${area.description || ''}</span>
        <span class="area-actions">
          <button class="btn btn-sm btn-info" data-action="edit" data-id="${area.id}" title="Edit" aria-label="Edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-danger" data-action="delete" data-id="${area.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
        </span>
      </div>
      ${childrenHtml}
    </div>
  `;
}

function renderAreasList(areas) {
  const container = document.getElementById('areasList');

  if (!areas || areas.length === 0) {
    container.innerHTML = '<p class="text-center text-muted">No categories yet</p>';
    return;
  }

  const byParent = app.groupByParent(areas);
  const topLevel = byParent.get(null) || [];

  if (topLevel.length === 0) {
    container.innerHTML = '<p class="text-center text-muted">No categories yet</p>';
    return;
  }

  container.innerHTML = topLevel.map(a => renderAreaNode(a, byParent, 0)).join('');
}

async function loadAreas() {
  const container = document.getElementById('areasList');
  container.innerHTML = '<p class="text-center text-muted">Loading...</p>';

  try {
    const response = await fetch('/api/areas');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();

    if (result.success) {
      allAreas = result.data;
      renderAreasList(allAreas);
    } else {
      container.innerHTML = '<p class="text-center text-danger">Error loading categories</p>';
    }
  } catch (error) {
    console.error('Error loading areas:', error);
    container.innerHTML = '<p class="text-center text-danger">Error loading categories</p>';
  }
}

function getDescendantIds(areaId) {
  const descendants = new Set();
  const byParent = app.groupByParent(allAreas);
  const queue = [Number(areaId)];

  while (queue.length > 0) {
    const current = queue.pop();
    (byParent.get(current) || []).forEach(child => {
      if (!descendants.has(child.id)) {
        descendants.add(child.id);
        queue.push(child.id);
      }
    });
  }

  return descendants;
}

function openNewAreaForm(parentId) {
  document.getElementById('areaId').value = '';
  document.getElementById('areaForm').reset();
  document.getElementById('areaParentId').value = parentId || '';

  const hint = document.getElementById('areaParentHint');
  if (parentId) {
    const parent = allAreas.find(a => String(a.id) === String(parentId));
    hint.textContent = `Adding a subcategory under "${parent ? parent.name : 'this category'}".`;
    hint.classList.remove('d-none');
  } else {
    hint.classList.add('d-none');
  }
}

async function saveArea() {
  const areaId = document.getElementById('areaId').value;
  const parentId = document.getElementById('areaParentId').value;

  // parent_id is only sent when creating a new category as a subcategory (via the
  // right-click "Add Subcategory" action) - editing an existing category never
  // touches its parent through this form, that's only ever changed via drag-and-drop.
  const data = {
    name: document.getElementById('areaName').value,
    description: document.getElementById('areaDescription').value
  };
  if (!areaId && parentId) {
    data.parent_id = parentId;
  }

  try {
    const url = areaId ? `/api/areas/${areaId}` : '/api/areas';
    const method = areaId ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Category saved!', 'success');
      bootstrap.Modal.getInstance(document.getElementById('areaModal')).hide();
      loadAreas();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error saving category', 'danger');
  }
}

async function editArea(areaId) {
  try {
    const response = await fetch(`/api/areas/${areaId}`);
    const result = await response.json();
    const area = result.data;

    document.getElementById('areaId').value = area.id;
    document.getElementById('areaName').value = area.name;
    document.getElementById('areaDescription').value = area.description || '';
    document.getElementById('areaParentId').value = '';
    document.getElementById('areaParentHint').classList.add('d-none');

    const modal = new bootstrap.Modal(document.getElementById('areaModal'));
    modal.show();
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error loading category', 'danger');
  }
}

async function deleteArea(areaId) {
  const hasChildren = getDescendantIds(areaId).size > 0;
  const message = hasChildren
    ? 'This category has sub-categories that will also be deleted. Delete anyway?'
    : 'Delete this category?';

  if (!await app.confirm(message)) return;

  try {
    const response = await fetch(`/api/areas/${areaId}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Category deleted', 'success');
      loadAreas();
    } else {
      app.notify('Error deleting category', 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error deleting category', 'danger');
  }
}

function toggleAreaNode(nodeEl) {
  const id = String(nodeEl.dataset.areaId);
  if (expandedAreas.has(id)) {
    expandedAreas.delete(id);
    nodeEl.classList.remove('expanded');
  } else {
    expandedAreas.add(id);
    nodeEl.classList.add('expanded');
  }
}

async function reparentArea(areaId, newParentId) {
  const area = allAreas.find(a => String(a.id) === String(areaId));
  if (!area) return;

  try {
    const response = await fetch(`/api/areas/${areaId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ name: area.name, description: area.description, parent_id: newParentId })
    });

    const result = await response.json();
    if (result.success) {
      if (newParentId) expandedAreas.add(String(newParentId));
      loadAreas();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error moving area:', error);
    app.notify('Error moving category', 'danger');
  }
}

function clearDropTargets(container) {
  container.querySelectorAll('.area-drop-target').forEach(el => el.classList.remove('area-drop-target'));
  container.querySelectorAll('.drop-indicator-before, .drop-indicator-after').forEach(el => {
    el.classList.remove('drop-indicator-before', 'drop-indicator-after');
  });
  container.classList.remove('area-drop-target-root');
}

async function reorderAreaSibling(draggedId, targetId, position) {
  const dragged = allAreas.find(a => String(a.id) === String(draggedId));
  const target = allAreas.find(a => String(a.id) === String(targetId));
  if (!dragged || !target) return;

  const parentKey = target.parent_id || null;
  const byParent = app.groupByParent(allAreas);
  const siblingIds = (byParent.get(parentKey) || [])
    .map(a => String(a.id))
    .filter(id => id !== String(draggedId));

  let insertIndex = siblingIds.indexOf(String(targetId));
  if (position === 'after') insertIndex += 1;
  siblingIds.splice(insertIndex, 0, String(draggedId));

  try {
    // Dropping between siblings under a different parent than the dragged
    // item's current one also reparents it, same as dropping directly onto a category.
    if ((dragged.parent_id || null) !== parentKey) {
      await fetch(`/api/areas/${draggedId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.APP_CONFIG?.csrfToken
        },
        body: JSON.stringify({ name: dragged.name, description: dragged.description, parent_id: parentKey })
      });
    }

    const response = await fetch('/api/areas/reorder-siblings', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ orderedIds: siblingIds })
    });
    const result = await response.json();
    if (result.success) {
      loadAreas();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error reordering category:', error);
    app.notify('Error reordering category', 'danger');
  }
}

let contextMenuAreaId = null;

function showAreaContextMenu(x, y, areaId) {
  contextMenuAreaId = areaId;
  const menu = document.getElementById('areaContextMenu');
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.classList.remove('d-none');
}

function hideAreaContextMenu() {
  contextMenuAreaId = null;
  document.getElementById('areaContextMenu').classList.add('d-none');
}

function initAreaContextMenu() {
  const menu = document.getElementById('areaContextMenu');

  menu.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-menu-action]');
    if (!btn || !contextMenuAreaId) {
      hideAreaContextMenu();
      return;
    }

    const areaId = contextMenuAreaId;
    hideAreaContextMenu();

    if (btn.dataset.menuAction === 'add-subcategory') {
      openNewAreaForm(areaId);
      const modal = new bootstrap.Modal(document.getElementById('areaModal'));
      modal.show();
    }
  });

  document.addEventListener('click', (e) => {
    if (!menu.classList.contains('d-none') && !menu.contains(e.target)) {
      hideAreaContextMenu();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideAreaContextMenu();
  });
}

function initAreasEventListeners() {
  document.getElementById('addAreaBtn').addEventListener('click', () => openNewAreaForm());
  document.getElementById('saveAreaBtn').addEventListener('click', saveArea);
  initAreaContextMenu();

  const container = document.getElementById('areasList');

  app.bindInlineRename(container, '.area-name', async (newName, titleEl) => {
    const areaId = titleEl.closest('.area-node').dataset.areaId;
    try {
      const response = await fetch(`/api/areas/${areaId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.APP_CONFIG?.csrfToken
        },
        body: JSON.stringify({ name: newName })
      });
      const result = await response.json();
      if (!result.success) {
        app.notify('Error: ' + result.message, 'danger');
        return false;
      }
      loadAreas();
      return true;
    } catch (error) {
      console.error('Error renaming category:', error);
      app.notify('Error renaming category', 'danger');
      return false;
    }
  });

  container.addEventListener('contextmenu', (e) => {
    const header = e.target.closest('.area-node-header');
    if (!header) return;
    e.preventDefault();
    showAreaContextMenu(e.clientX, e.clientY, header.closest('.area-node').dataset.areaId);
  });

  container.addEventListener('dragstart', (e) => {
    const header = e.target.closest('.area-node-header');
    if (!header) return;
    const node = header.closest('.area-node');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('area-id', node.dataset.areaId);
    header.classList.add('dragging-item');
  });

  container.addEventListener('dragend', (e) => {
    const header = e.target.closest('.area-node-header');
    if (header) header.classList.remove('dragging-item');
    clearDropTargets(container);
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    const header = e.target.closest('.area-node-header');
    clearDropTargets(container);
    if (header) {
      const zone = app.getTreeDropZone(e, header);
      if (zone === 'nest') {
        header.classList.add('area-drop-target');
      } else {
        header.classList.add(zone === 'before' ? 'drop-indicator-before' : 'drop-indicator-after');
      }
    } else {
      container.classList.add('area-drop-target-root');
    }
  });

  container.addEventListener('drop', (e) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('area-id');
    const header = e.target.closest('.area-node-header');
    const zone = header ? app.getTreeDropZone(e, header) : null;
    clearDropTargets(container);
    if (!draggedId) return;

    const targetId = header ? header.closest('.area-node').dataset.areaId : null;

    if (targetId && String(targetId) === String(draggedId)) return;

    if (!targetId) {
      reparentArea(draggedId, null);
    } else if (zone === 'nest') {
      reparentArea(draggedId, targetId);
    } else {
      reorderAreaSibling(draggedId, targetId, zone);
    }
  });

  container.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action="edit"], [data-action="delete"]');
    if (actionBtn) {
      if (actionBtn.dataset.action === 'edit') editArea(actionBtn.dataset.id);
      else if (actionBtn.dataset.action === 'delete') deleteArea(actionBtn.dataset.id);
      return;
    }

    const toggleIcon = e.target.closest('[data-action="toggle-expand"]');
    if (toggleIcon) {
      toggleAreaNode(toggleIcon.closest('.area-node'));
    }
  });

  container.addEventListener('dblclick', (e) => {
    if (e.target.closest('[data-action]')) return;
    const header = e.target.closest('.area-node-header');
    if (!header) return;
    editArea(header.closest('.area-node').dataset.areaId);
  });
}

function initAreas() {
  // #areaModal can be opened from other tabs (e.g. the Dailies right panel). Left
  // inside the #tab-areas pane, it's a descendant of a display:none ancestor
  // whenever that tab isn't active, so Bootstrap's backdrop would show but the
  // dialog itself never could - move it to the body so it always renders.
  document.body.appendChild(document.getElementById('areaModal'));

  initAreasEventListeners();
  loadAreas();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAreas);
} else {
  initAreas();
}