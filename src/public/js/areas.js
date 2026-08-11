let expandedAreas = new Set();
let allAreas = [];
let allToDos = [];
let allTickets = [];
let currentAreaId = null;
let areaEditorHasChanges = false;

const markAreaEditorChanged = () => {
  areaEditorHasChanges = true;
  const saveBtn = document.getElementById('saveAreaEditorBtn');
  if (saveBtn) saveBtn.disabled = false;
};

const trackAreaFormChanges = () => {
  const form = document.getElementById('areaEditorForm');
  if (!form) return;

  const inputs = form.querySelectorAll('input[type="text"], textarea');
  inputs.forEach(input => {
    input.addEventListener('change', markAreaEditorChanged);
    input.addEventListener('input', markAreaEditorChanged);
  });
};

const resetAreaEditorTracking = () => {
  areaEditorHasChanges = false;
  const saveBtn = document.getElementById('saveAreaEditorBtn');
  if (saveBtn) saveBtn.disabled = true;
};

function renderAssociatedTodo(todo) {
  return `
    <div class="associated-item todo-item" data-todo-id="${todo.id}" style="margin-left: 40px; padding: 6px 8px; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #eee;">
      <i class="bi bi-check2-square text-muted"></i>
      <span>${app.escapeHtml(todo.title)}</span>
      <button class="btn btn-sm btn-link text-danger p-0 ms-auto" data-action="unlink-todo" data-id="${todo.id}" title="Unlink" aria-label="Unlink"><i class="bi bi-x-circle"></i></button>
    </div>
  `;
}

function renderAssociatedTicket(ticket) {
  return `
    <div class="associated-item ticket-item" data-ticket-id="${ticket.id}" style="margin-left: 40px; padding: 6px 8px; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #eee;">
      <i class="bi bi-ticket text-muted"></i>
      <span>${app.escapeHtml(ticket.title)}</span>
      <button class="btn btn-sm btn-link text-danger p-0 ms-auto" data-action="unlink-ticket" data-id="${ticket.id}" title="Unlink" aria-label="Unlink"><i class="bi bi-x-circle"></i></button>
    </div>
  `;
}

function renderAreaNode(area, byParent, depth) {
  const children = byParent.get(area.id) || [];
  const associatedTodos = allToDos.filter(t => t.category_id === area.id);
  const associatedTickets = allTickets.filter(tick => tick.category_id === area.id);
  const hasChildren = children.length > 0 || associatedTodos.length > 0 || associatedTickets.length > 0;
  const isExpanded = expandedAreas.has(String(area.id));

  const childrenHtml = hasChildren
    ? `<div class="area-node-children">
        ${children.map(c => renderAreaNode(c, byParent, depth + 1)).join('')}
        ${associatedTodos.map(todo => renderAssociatedTodo(todo)).join('')}
        ${associatedTickets.map(ticket => renderAssociatedTicket(ticket)).join('')}
      </div>`
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
          <span class="area-name">${app.escapeHtml(area.name)}</span>
        </span>
        <span class="area-description text-muted small">${app.escapeHtml(area.description || '')}</span>
        <span class="area-actions">
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
    const [areasRes, todosRes, ticketsRes] = await Promise.all([
      fetch('/api/areas'),
      fetch('/api/to-dos'),
      fetch('/api/tickets')
    ]);

    if (!areasRes.ok || !todosRes.ok || !ticketsRes.ok) {
      throw new Error(`HTTP error`);
    }

    const areasResult = await areasRes.json();
    const todosResult = await todosRes.json();
    const ticketsResult = await ticketsRes.json();

    if (areasResult.success) {
      allAreas = areasResult.data;
      allToDos = todosResult.success ? (todosResult.data || []) : [];
      allTickets = ticketsResult.success ? (ticketsResult.data || []) : [];
      renderAreasList(allAreas);

      // Handle pending area edit (from clicking category node in priorities)
      if (window.pendingAreaEdit) {
        const areaId = window.pendingAreaEdit;
        delete window.pendingAreaEdit;
        setTimeout(() => editArea(areaId), 300);
      }
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

async function saveAreaEditor() {
  const areaId = document.getElementById('areaEditorId').value;
  const parentId = document.getElementById('areaEditorParentId').value;

  const data = {
    name: document.getElementById('areaEditorName').value,
    description: document.getElementById('areaEditorDescription').value
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
      loadAreas();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error saving category', 'danger');
  }
}

function closeAreaEditor() {
  resetAreaEditorTracking();
  currentAreaId = null;
  if (window.areaSplitPane) {
    window.areaSplitPane.hideRightPane();
  }
  const editorForm = document.getElementById('areaEditorForm');
  if (editorForm) {
    editorForm.style.display = 'none';
  }
}

async function editArea(areaId) {
  try {
    // Check if clicking on same row that's already open
    if (currentAreaId === areaId) {
      if (areaEditorHasChanges) {
        return; // Don't close if there are unsaved changes
      }
      closeAreaEditor();
      return;
    }

    const response = await fetch(`/api/areas/${areaId}`);
    const result = await response.json();
    const area = result.data;

    currentAreaId = areaId;
    resetAreaEditorTracking();

    // Make sure form is visible
    const editorForm = document.getElementById('areaEditorForm');
    if (editorForm) editorForm.style.display = 'block';

    document.getElementById('areaEditorId').value = area.id;
    document.getElementById('areaEditorName').value = area.name;
    document.getElementById('areaEditorDescription').value = area.description || '';
    document.getElementById('areaEditorParentId').value = '';
    document.getElementById('areaEditorParentHint').classList.add('d-none');
    document.getElementById('areaEditorTitle').textContent = area.name;
    trackAreaFormChanges();

    // Show split-pane editor
    if (window.areaSplitPane) {
      window.areaSplitPane.showRightPane();
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error loading category', 'danger');
  }
}

async function deleteArea(areaId) {
  const descendants = getDescendantIds(areaId);
  const hasChildren = descendants.size > 0;
  const message = hasChildren
    ? `This category and its ${descendants.size} sub-categor${descendants.size === 1 ? 'y' : 'ies'} will be permanently deleted. This cannot be undone.`
    : 'This category will be permanently deleted. This cannot be undone.';

  if (!await app.confirm(message, 'Delete Category')) return;

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

async function unlinkTodoFromArea(todoId) {
  try {
    const response = await fetch(`/api/to-dos/${todoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ category_id: null })
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Todo unlinked', 'success');
      loadAreas();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error unlinking todo:', error);
    app.notify('Error unlinking todo', 'danger');
  }
}

async function unlinkTicketFromArea(ticketId) {
  try {
    const response = await fetch(`/api/tickets/${ticketId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ category_id: null })
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Ticket unlinked', 'success');
      loadAreas();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error unlinking ticket:', error);
    app.notify('Error unlinking ticket', 'danger');
  }
}

async function deleteArea(areaId) {
  const area = allAreas.find(a => String(a.id) === String(areaId));
  const name = area ? area.name : 'this category';

  if (!await app.confirm(`Delete "${name}"?`)) return;

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

async function associateTodoWithArea(todoId, areaId) {
  try {
    const response = await fetch(`/api/to-dos/${todoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ category_id: areaId })
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Todo associated with category', 'success');
      loadAreas();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error associating todo:', error);
    app.notify('Error associating todo', 'danger');
  }
}

async function associateTicketWithArea(ticketId, areaId) {
  try {
    const response = await fetch(`/api/tickets/${ticketId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ category_id: areaId })
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Ticket associated with category', 'success');
      loadAreas();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error associating ticket:', error);
    app.notify('Error associating ticket', 'danger');
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

async function createTemplateFromArea(areaId) {
  const area = allAreas.find(a => String(a.id) === String(areaId));
  if (!area) return;

  try {
    const response = await fetch('/api/work-item-templates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ title: area.name, status: 'In Progress' })
    });
    const result = await response.json();
    if (!result.success) {
      app.notify('Error: ' + result.message, 'danger');
      return;
    }

    await fetch(`/api/work-item-templates/${result.data.id}/areas/${areaId}`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });

    app.notify(`Template "${area.name}" created - see the Templates tab`, 'success');
  } catch (error) {
    console.error('Error creating template from category:', error);
    app.notify('Error creating template', 'danger');
  }
}

function initAreaContextMenu() {
  const menu = document.getElementById('areaContextMenu');
  const container = document.getElementById('areasList');

  // Handle unlink actions
  if (container) {
    container.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="unlink-todo"]')) {
        const btn = e.target.closest('[data-action="unlink-todo"]');
        const todoId = btn.dataset.id;
        unlinkTodoFromArea(todoId);
      } else if (e.target.closest('[data-action="unlink-ticket"]')) {
        const btn = e.target.closest('[data-action="unlink-ticket"]');
        const ticketId = btn.dataset.id;
        unlinkTicketFromArea(ticketId);
      }
    });

    // Drag-and-drop for associated todos and tickets
    container.addEventListener('dragstart', (e) => {
      const node = e.target.closest('.todo-item, .ticket-item');
      if (!node) return;

      const todoId = node.dataset.todoId;
      const ticketId = node.dataset.ticketId;

      if (todoId || ticketId) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('itemType', todoId ? 'todo' : 'ticket');
        e.dataTransfer.setData('itemId', todoId || ticketId);
        node.style.opacity = '0.5';
      }
    });

    container.addEventListener('dragend', (e) => {
      const node = e.target.closest('.todo-item, .ticket-item');
      if (node) node.style.opacity = '1';
      document.querySelectorAll('.area-node-header').forEach(n => n.style.borderTop = '');
    });

    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      const itemType = e.dataTransfer.getData('itemType');
      if (!itemType || (itemType !== 'todo' && itemType !== 'ticket')) return;

      const header = e.target.closest('.area-node-header');
      if (header) {
        header.style.borderTop = '3px solid #0d6efd';
        e.dataTransfer.dropEffect = 'move';
      }
    });

    container.addEventListener('dragleave', (e) => {
      const header = e.target.closest('.area-node-header');
      if (header) header.style.borderTop = '';
    });

    container.addEventListener('drop', async (e) => {
      e.preventDefault();
      document.querySelectorAll('.area-node-header').forEach(n => n.style.borderTop = '');

      const itemType = e.dataTransfer.getData('itemType');
      const itemId = e.dataTransfer.getData('itemId');
      const targetHeader = e.target.closest('.area-node-header');

      if (!itemType || !itemId || !targetHeader) return;

      const targetAreaNode = targetHeader.closest('.area-node');
      const targetAreaId = parseInt(targetAreaNode?.dataset.areaId);

      if (!targetAreaId) return;

      if (itemType === 'todo') {
        await associateTodoWithArea(parseInt(itemId), targetAreaId);
      } else if (itemType === 'ticket') {
        await associateTicketWithArea(parseInt(itemId), targetAreaId);
      }
    });
  }

    // Collapse all submenus on context menu open
    container.addEventListener('contextmenu', () => {
      menu.querySelectorAll('.context-menu-submenu').forEach(m => m.classList.add('d-none'));
    });
  }

  menu.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]') || e.target.closest('[data-menu-action]');
    if (!btn || !contextMenuAreaId) {
      hideAreaContextMenu();
      return;
    }

    const areaId = contextMenuAreaId;

    const action = btn.dataset.action || btn.dataset.menuAction;
    if (action === 'create-subcategory') {
      hideAreaContextMenu();
      openNewAreaForm(areaId);
      const modal = new bootstrap.Modal(document.getElementById('areaModal'));
      modal.show();
    } else if (action === 'associate-ticket') {
      app.notify('Associate ticket feature coming soon', 'info');
    } else if (action === 'associate-todo') {
      app.notify('Associate todo feature coming soon', 'info');
    } else if (action === 'create-ticket') {
      app.notify('Create ticket feature coming soon', 'info');
    } else if (action === 'create-todo') {
      app.notify('Create todo feature coming soon', 'info');
    } else if (action === 'delete-area') {
      hideAreaContextMenu();
      deleteArea(areaId);
      return;
    }
    hideAreaContextMenu();
  });

  // Toggle submenus
  menu.addEventListener('click', (e) => {
    const submenuBtn = e.target.closest('.has-submenu');
    if (submenuBtn) {
      e.stopPropagation();
      const submenuId = submenuBtn.dataset.submenu;
      const submenu = menu.querySelector(`#${submenuId}`);
      if (submenu) {
        submenu.classList.toggle('d-none');
      }
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

  // Side-panel editor buttons
  const saveEditorBtn = document.getElementById('saveAreaEditorBtn');
  const closeEditorBtn = document.getElementById('closeAreaEditorBtn');
  if (saveEditorBtn) {
    saveEditorBtn.addEventListener('click', async () => {
      await saveAreaEditor();
      closeAreaEditor();
    });
  }
  if (closeEditorBtn) {
    closeEditorBtn.addEventListener('click', closeAreaEditor);
  }

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
      return;
    }

    // Click on row itself to edit
    const header = e.target.closest('.area-node-header');
    if (header && !e.target.closest('[data-action]')) {
      editArea(header.closest('.area-node').dataset.areaId);
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

  // Initialize split pane for side-panel editing
  if (document.getElementById('areaSplitPane')) {
    window.areaSplitPane = new SplitPane('areaSplitPane', 'areaListPane', 'areaDivider', 'areaEditorPane', 66.66);
  }

  initAreasEventListeners();
  loadAreas();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAreas);
} else {
  initAreas();
}