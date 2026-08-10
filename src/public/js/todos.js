// Store state on window to survive multiple script loads
if (!window.todoState) {
  window.todoState = {
    expandedTodos: new Set(),
    allToDos: [],
    draggedTodoId: null
  };
}

function getState() {
  return window.todoState;
}

// Compute aggregated status for a todo based on its children
function computeToDoStatus(todo, todoMap) {
  const children = (todoMap[todo.id] || []);
  if (children.length === 0) return todo.status;

  const statuses = [todo.status, ...children.map(child => computeToDoStatus(child, todoMap))];
  if (statuses.includes('failed')) return 'failed';
  if (statuses.includes('incomplete')) return 'incomplete';
  if (statuses.includes('skipped')) return 'skipped';
  return 'complete';
}

// Build a map of parent_id -> [children]
function buildChildrenMap(toDos) {
  const map = {};
  toDos.forEach(t => {
    if (!map[t.id]) map[t.id] = [];
  });
  toDos.forEach(t => {
    if (t.parent_id) {
      if (!map[t.parent_id]) map[t.parent_id] = [];
      map[t.parent_id].push(t);
    }
  });
  return map;
}

// Get all root-level todos (those with no parent)
function getRootTodos(toDos) {
  return toDos.filter(t => !t.parent_id);
}

function renderToDoRow(toDo, depth, childrenMap, statusMap) {
  const children = childrenMap[toDo.id] || [];
  const hasChildren = children.length > 0;
  const isExpanded = getState().expandedTodos.has(String(toDo.id));
  const displayStatus = statusMap[toDo.id] || toDo.status;
  const statusIcon = app.statusIcon(displayStatus);
  const statusLabel = displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1);

  const childrenHtml = hasChildren && isExpanded
    ? `<div class="todo-node-children">
        ${children.map(c => renderToDoRow(c, depth + 1, childrenMap, statusMap)).join('')}
      </div>`
    : '';

  return `
    <div class="todo-node ${isExpanded ? 'expanded' : ''}" data-todo-id="${toDo.id}">
      <div class="todo-row" data-todo-id="${toDo.id}" data-type="todo" data-id="${toDo.id}" data-name="${app.escapeHtml(toDo.title)}" draggable="true" style="cursor: grab;">
        <span class="todo-name-cell">
          <span style="display:inline-block; width: ${depth * 18}px; flex: none;"></span>
          ${hasChildren
            ? '<i class="bi bi-chevron-right todo-folder-toggle" data-action="toggle-expand"></i>'
            : '<span class="todo-folder-toggle"></span>'}
          <button type="button" class="todo-item-checkbox ${displayStatus !== 'incomplete' ? 'status-' + displayStatus : ''}" data-action="toggle-complete" data-id="${toDo.id}" data-status="${toDo.status}" title="${statusLabel} — click to change" aria-label="${statusLabel} — click to change">
            ${statusIcon ? `<i class="bi ${statusIcon}"></i>` : ''}
          </button>
          <span class="todo-title" ${toDo.status === 'complete' ? 'style="text-decoration: line-through; opacity: 0.6;"' : ''}>${app.escapeHtml(toDo.title)}</span>
        </span>
        <span class="todo-notes text-muted">${app.escapeHtml(toDo.notes) || '-'}</span>
        <span class="todo-actions">
          <button class="btn btn-sm btn-danger" data-action="delete" data-id="${toDo.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
        </span>
      </div>
      ${childrenHtml}
    </div>
  `;
}

function renderToDosList() {
  const container = document.getElementById('toDosList');

  if (getState().allToDos.length === 0) {
    container.innerHTML = '<p class="text-center text-muted">No to dos yet</p>';
    return;
  }

  const childrenMap = buildChildrenMap(getState().allToDos);
  const rootTodos = getRootTodos(getState().allToDos);

  // Compute status map for all todos
  const statusMap = {};
  getState().allToDos.forEach(todo => {
    statusMap[todo.id] = computeToDoStatus(todo, childrenMap);
  });

  container.innerHTML = rootTodos
    .map(t => renderToDoRow(t, 0, childrenMap, statusMap))
    .join('');

  setupDragListeners();
}

async function loadToDos() {
  const container = document.getElementById('toDosList');
  container.innerHTML = '<p class="text-center text-muted">Loading...</p>';

  try {
    const response = await fetch('/api/to-dos');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();

    if (result.success) {
      getState().allToDos = result.data || [];
      renderToDosList();
    } else {
      console.error('API response failed', result);
      container.innerHTML = '<p class="text-center text-danger">Error loading to dos</p>';
    }
  } catch (error) {
    console.error('Error loading to dos:', error);
    container.innerHTML = `<p class="text-center text-danger">Error loading to dos: ${error.message}</p>`;
  }
}

function renderToDoItemRow(text, isDone) {
  return `
    <div class="todo-item-row">
      <button type="button" class="todo-item-checkbox ${isDone ? 'checked' : ''}" data-action="toggle-item" title="${isDone ? 'Mark incomplete' : 'Mark complete'}" aria-label="${isDone ? 'Mark incomplete' : 'Mark complete'}">
        ${isDone ? '<i class="bi bi-check-lg"></i>' : ''}
      </button>
      <input type="text" class="form-control form-control-sm" value="${app.escapeHtml(text || '')}" placeholder="Item text" ${isDone ? 'style="text-decoration: line-through; opacity: 0.6;"' : ''}>
      <button type="button" class="btn btn-sm btn-link text-danger p-0" data-action="remove-item" title="Remove" aria-label="Remove"><i class="bi bi-x-lg"></i></button>
    </div>
  `;
}

function renderToDoItemsEditor(items, containerId = 'toDoItemsList') {
  document.getElementById(containerId).innerHTML = (items || [])
    .map(item => renderToDoItemRow(item.text, item.is_done))
    .join('');
}

function addToDoItemRow() {
  const container = document.getElementById('toDoItemsList');
  container.insertAdjacentHTML('beforeend', renderToDoItemRow('', false));
  const inputs = container.querySelectorAll('.todo-item-row input[type="text"]');
  inputs[inputs.length - 1]?.focus();
}

function collectToDoItemsFromEditor() {
  return Array.from(document.querySelectorAll('#toDoItemsList .todo-item-row'))
    .map(row => ({
      text: row.querySelector('input[type="text"]').value.trim(),
      is_done: row.querySelector('.todo-item-checkbox').classList.contains('checked')
    }))
    .filter(item => item.text);
}

function openNewToDoForm() {
  document.getElementById('toDoId').value = '';
  document.getElementById('toDoForm').reset();
  renderToDoItemsEditor([]);

  const modal = new bootstrap.Modal(document.getElementById('toDoModal'));
  modal.show();
}

function openToDoModalPrefilled(title, notes) {
  document.getElementById('toDoId').value = '';
  document.getElementById('toDoForm').reset();
  document.getElementById('toDoTitle').value = title || '';
  document.getElementById('toDoNotes').value = notes || '';
  renderToDoItemsEditor([]);

  const modal = new bootstrap.Modal(document.getElementById('toDoModal'));
  modal.show();
}
window.openToDoModalPrefilled = openToDoModalPrefilled;

async function saveToDo() {
  const toDoId = document.getElementById('toDoId').value;

  const data = {
    title: document.getElementById('toDoTitle').value,
    notes: document.getElementById('toDoNotes').value,
    items: collectToDoItemsFromEditor()
  };

  try {
    const url = toDoId ? `/api/to-dos/${toDoId}` : '/api/to-dos';
    const method = toDoId ? 'PUT' : 'POST';

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
      app.notify('To do saved!', 'success');
      const modalElement = document.getElementById('toDoModal');
      const modalInstance = bootstrap.Modal.getInstance(modalElement);
      if (modalInstance) {
        modalInstance.hide();
      } else {
        modalElement.classList.remove('show');
        document.querySelector('.modal-backdrop')?.remove();
      }
      loadToDos();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error saving to do', 'danger');
  }
}

async function editToDo(toDoId) {
  try {
    const response = await fetch(`/api/to-dos/${toDoId}`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const result = await response.json();
    if (!result.success || !result.data) {
      throw new Error(result.message || 'Failed to load to do');
    }
    const toDo = result.data;

    // Populate modal form
    document.getElementById('toDoId').value = toDo.id;
    document.getElementById('toDoTitle').value = toDo.title;
    document.getElementById('toDoNotes').value = toDo.notes || '';
    renderToDoItemsEditor(toDo.items || [], 'toDoItemsList');

    // Load and display links
    loadLinksForEntity('to-do', toDo.id, 'toDoLinksList');

    // Setup link input handlers
    const addLinkBtn = document.getElementById('addToDoLinkBtn');
    if (addLinkBtn) {
      addLinkBtn.onclick = async (e) => {
        e.preventDefault();
        const url = document.getElementById('toDoLinkUrl').value;
        const title = document.getElementById('toDoLinkTitle').value;
        if (await addLinkToEntity('to-do', toDo.id, url, title, 'toDoLinksList')) {
          document.getElementById('toDoLinkUrl').value = '';
          document.getElementById('toDoLinkTitle').value = '';
        }
      };
    }

    // Setup URL drag-drop
    setupURLDragDrop('to-do', 'toDoLinksList', () => toDo.id);

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('toDoModal'));
    modal.show();
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error loading to do', 'danger');
  }
}

async function deleteToDo(toDoId) {
  if (!await app.confirm('Delete this to do?')) return;

  try {
    const response = await fetch(`/api/to-dos/${toDoId}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });

    const result = await response.json();
    if (result.success) {
      app.notify('To do deleted', 'success');
      loadToDos();
    } else {
      app.notify('Error deleting to do', 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error deleting to do', 'danger');
  }
}

async function cycleToDoStatus(toDoId, currentStatus) {
  const result = await app.cycleStatus(`/api/to-dos/${toDoId}`, currentStatus);
  if (result.success) {
    loadToDos();
  } else {
    app.notify('Error: ' + result.message, 'danger');
  }
}


function setupDragListeners() {
  const container = document.getElementById('toDosList');

  container.addEventListener('dragstart', (e) => {
    const row = e.target.closest('.todo-row');
    if (!row) return;

    const toDoId = row.getAttribute('data-id');
    const name = row.getAttribute('data-name');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${toDoId}|${name}`);
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const row = e.target.closest('.todo-row');
    if (row) {
      row.classList.add('todo-drop-target');
    } else if (e.target === container || e.target.closest('#toDosList')) {
      container.classList.add('todo-drop-target-root');
    }
  });

  container.addEventListener('dragleave', (e) => {
    if (!e.relatedTarget?.closest('.todo-row')) {
      document.querySelectorAll('.todo-row').forEach(r => r.classList.remove('todo-drop-target'));
    }
    if (!e.relatedTarget?.closest('#toDosList')) {
      container.classList.remove('todo-drop-target-root');
    }
  });

  container.addEventListener('drop', async (e) => {
    e.preventDefault();
    container.classList.remove('todo-drop-target-root');
    document.querySelectorAll('.todo-row').forEach(r => r.classList.remove('todo-drop-target'));

    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;

    const [toDoId] = data.split('|');
    const dropTarget = e.target.closest('.todo-row');

    if (dropTarget) {
      const parentId = dropTarget.getAttribute('data-id');
      if (Number(parentId) === Number(toDoId)) return;

      await updateToDoParent(toDoId, parentId);
    } else {
      await updateToDoParent(toDoId, null);
    }
  });

  // Toggle expand/collapse
  container.addEventListener('click', (e) => {
    if (e.target.classList.contains('todo-folder-toggle')) {
      const row = e.target.closest('.todo-row');
      const node = row?.closest('.todo-node');
      if (node) {
        const toDoId = node.getAttribute('data-todo-id');
        if (getState().expandedTodos.has(toDoId)) {
          getState().expandedTodos.delete(toDoId);
        } else {
          getState().expandedTodos.add(toDoId);
        }
        renderToDosList();
      }
    }
  });

  // Status toggle
  container.addEventListener('click', (e) => {
    if (e.target.closest('.todo-item-checkbox[data-action="toggle-complete"]')) {
      const btn = e.target.closest('.todo-item-checkbox[data-action="toggle-complete"]');
      const toDoId = btn.getAttribute('data-id');
      const status = btn.getAttribute('data-status');
      cycleToDoStatus(toDoId, status);
    }
  });

  // Delete
  container.addEventListener('click', (e) => {
    if (e.target.closest('button[data-action="delete"]')) {
      const btn = e.target.closest('button[data-action="delete"]');
      const toDoId = btn.getAttribute('data-id');
      deleteToDo(toDoId);
    }
  });

  // Edit
  container.addEventListener('click', (e) => {
    if (e.target.closest('.todo-title')) {
      const row = e.target.closest('.todo-row');
      const toDoId = row.getAttribute('data-id');
      editToDo(toDoId);
    }
  });
}

async function updateToDoParent(toDoId, parentId) {
  const data = { parent_id: parentId };

  try {
    const response = await fetch(`/api/to-dos/${toDoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (result.success) {
      loadToDos();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error updating to do', 'danger');
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadToDos();

  const addBtn = document.getElementById('addToDoBtn');
  if (addBtn) {
    addBtn.addEventListener('click', openNewToDoForm);
  }

  const saveBtn = document.getElementById('saveToDoBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveToDo);
  }

  const addItemBtn = document.getElementById('addToDoItemBtn');
  if (addItemBtn) {
    addItemBtn.addEventListener('click', addToDoItemRow);
  }
});
