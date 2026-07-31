let expandedFolders = new Set();
let allFolders = [];
let allToDos = [];

function groupToDosByFolder(toDos) {
  const byFolder = new Map();
  toDos.forEach(t => {
    const key = t.folder_id || null;
    if (!byFolder.has(key)) byFolder.set(key, []);
    byFolder.get(key).push(t);
  });
  return byFolder;
}

function renderToDoRow(toDo, depth) {
  const items = toDo.items || [];
  const doneCount = items.filter(i => i.is_done).length;
  const itemsBadge = items.length > 0
    ? `<span class="badge bg-light text-dark border" title="Items done">${doneCount}/${items.length}</span>`
    : '';

  return `
    <div class="todo-row" data-todo-id="${toDo.id}" draggable="true">
      <span class="todo-name-cell">
        <span style="display:inline-block; width: ${depth * 18}px; flex: none;"></span>
        <span class="todo-folder-toggle"></span>
        <i class="bi ${APP_ICONS.todo} text-muted" title="To Do"></i>
        <span class="todo-title">${app.escapeHtml(toDo.title)}</span>
        ${itemsBadge}
      </span>
      <span class="todo-notes text-muted">${app.escapeHtml(toDo.notes) || '-'}</span>
      <span class="todo-actions">
        <button class="btn btn-sm btn-outline-primary" data-action="convert" data-id="${toDo.id}" title="Convert" aria-label="Convert"><i class="bi bi-arrow-right-circle"></i></button>
        <button class="btn btn-sm btn-info" data-action="edit" data-id="${toDo.id}" title="Edit" aria-label="Edit"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-danger" data-action="delete" data-id="${toDo.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
      </span>
    </div>
  `;
}

function renderFolderNode(folder, foldersByParent, toDosByFolder, depth) {
  const childFolders = foldersByParent.get(folder.id) || [];
  const childToDos = toDosByFolder.get(folder.id) || [];
  const hasChildren = childFolders.length > 0 || childToDos.length > 0;
  const isExpanded = expandedFolders.has(String(folder.id));

  const childrenHtml = hasChildren
    ? `<div class="todo-folder-node-children">
        ${childFolders.map(f => renderFolderNode(f, foldersByParent, toDosByFolder, depth + 1)).join('')}
        ${childToDos.map(t => renderToDoRow(t, depth + 1)).join('')}
      </div>`
    : '';

  return `
    <div class="todo-folder-node ${isExpanded ? 'expanded' : ''}" data-folder-id="${folder.id}">
      <div class="todo-folder-header" draggable="true">
        <span class="todo-name-cell">
          <span style="display:inline-block; width: ${depth * 18}px; flex: none;"></span>
          ${hasChildren
            ? '<i class="bi bi-chevron-right todo-folder-toggle" data-action="toggle-expand"></i>'
            : '<span class="todo-folder-toggle"></span>'}
          <i class="bi bi-folder-fill text-warning"></i>
          <span class="todo-title">${app.escapeHtml(folder.name)}</span>
        </span>
        <span></span>
        <span class="todo-actions">
          <button class="btn btn-sm btn-info" data-action="edit-folder" data-id="${folder.id}" title="Edit" aria-label="Edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-danger" data-action="delete-folder" data-id="${folder.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
        </span>
      </div>
      ${childrenHtml}
    </div>
  `;
}

function renderToDosList() {
  const container = document.getElementById('toDosList');

  if (allFolders.length === 0 && allToDos.length === 0) {
    container.innerHTML = '<p class="text-center text-muted">No to dos yet</p>';
    return;
  }

  const foldersByParent = app.groupByParent(allFolders);
  const toDosByFolder = groupToDosByFolder(allToDos);

  const topFolders = foldersByParent.get(null) || [];
  const topToDos = toDosByFolder.get(null) || [];

  container.innerHTML =
    topFolders.map(f => renderFolderNode(f, foldersByParent, toDosByFolder, 0)).join('') +
    topToDos.map(t => renderToDoRow(t, 0)).join('');
}

async function loadToDos() {
  const container = document.getElementById('toDosList');
  container.innerHTML = '<p class="text-center text-muted">Loading...</p>';

  try {
    const [foldersResponse, toDosResponse] = await Promise.all([
      fetch('/api/to-do-folders'),
      fetch('/api/to-dos'),
    ]);
    if (!foldersResponse.ok) throw new Error(`HTTP ${foldersResponse.status}`);
    if (!toDosResponse.ok) throw new Error(`HTTP ${toDosResponse.status}`);

    const foldersResult = await foldersResponse.json();
    const toDosResult = await toDosResponse.json();

    if (foldersResult.success && toDosResult.success) {
      allFolders = foldersResult.data;
      allToDos = toDosResult.data;
      renderToDosList();
    } else {
      container.innerHTML = '<p class="text-center text-danger">Error loading to dos</p>';
    }
  } catch (error) {
    console.error('Error loading to dos:', error);
    container.innerHTML = '<p class="text-center text-danger">Error loading to dos</p>';
  }
}

function renderToDoItemRow(text, isDone) {
  return `
    <div class="todo-item-row">
      <input type="checkbox" class="form-check-input" ${isDone ? 'checked' : ''}>
      <input type="text" class="form-control form-control-sm" value="${app.escapeHtml(text || '')}" placeholder="Item text">
      <button type="button" class="btn btn-sm btn-link text-danger p-0" data-action="remove-item" title="Remove" aria-label="Remove"><i class="bi bi-x-lg"></i></button>
    </div>
  `;
}

function renderToDoItemsEditor(items) {
  document.getElementById('toDoItemsList').innerHTML = (items || [])
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
      is_done: row.querySelector('input[type="checkbox"]').checked
    }))
    .filter(item => item.text);
}

function openNewToDoForm() {
  document.getElementById('toDoId').value = '';
  document.getElementById('toDoForm').reset();
  renderToDoItemsEditor([]);
}

// Open the To Do modal pre-filled with a title/notes pair from another source (e.g.
// right-clicking a work item in Dailies) instead of creating the to-do immediately,
// so the user can review/edit before saving. Exposed globally since all tab scripts
// share one global scope.
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

  // folder_id is intentionally omitted here - it's only ever changed via drag-and-drop,
  // never through this form, so a plain title/notes edit must leave it untouched.
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
      bootstrap.Modal.getInstance(document.getElementById('toDoModal')).hide();
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
    const response = await fetch(`/api/to-dos/${toDoId}`);
    const result = await response.json();
    const toDo = result.data;

    document.getElementById('toDoId').value = toDo.id;
    document.getElementById('toDoTitle').value = toDo.title;
    document.getElementById('toDoNotes').value = toDo.notes || '';
    renderToDoItemsEditor(toDo.items || []);

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

function openNewFolderForm() {
  document.getElementById('folderId').value = '';
  document.getElementById('folderForm').reset();
}

async function saveFolder() {
  const folderId = document.getElementById('folderId').value;

  const data = {
    name: document.getElementById('folderName').value
  };

  try {
    const url = folderId ? `/api/to-do-folders/${folderId}` : '/api/to-do-folders';
    const method = folderId ? 'PUT' : 'POST';

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
      app.notify('Folder saved!', 'success');
      bootstrap.Modal.getInstance(document.getElementById('folderModal')).hide();
      loadToDos();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error saving folder', 'danger');
  }
}

async function editFolder(folderId) {
  try {
    const response = await fetch(`/api/to-do-folders/${folderId}`);
    const result = await response.json();
    const folder = result.data;

    document.getElementById('folderId').value = folder.id;
    document.getElementById('folderName').value = folder.name;

    const modal = new bootstrap.Modal(document.getElementById('folderModal'));
    modal.show();
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error loading folder', 'danger');
  }
}

function getFolderDescendantIds(folderId) {
  const descendants = new Set();
  const byParent = app.groupByParent(allFolders);
  const queue = [Number(folderId)];

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

function countToDosInFolders(folderIds) {
  return allToDos.filter(t => t.folder_id && folderIds.has(Number(t.folder_id))).length;
}

async function deleteFolder(folderId) {
  const descendants = getFolderDescendantIds(folderId);
  const allIds = new Set([Number(folderId), ...descendants]);
  const toDoCount = countToDosInFolders(allIds);

  let message = 'Delete this folder?';
  if (descendants.size > 0 && toDoCount > 0) {
    message = 'This folder has sub-folders and to dos in it. The sub-folders will be deleted and the to dos will become unfiled. Delete anyway?';
  } else if (descendants.size > 0) {
    message = 'This folder has sub-folders that will also be deleted. Delete anyway?';
  } else if (toDoCount > 0) {
    message = 'This folder has to dos in it that will become unfiled. Delete anyway?';
  }

  if (!await app.confirm(message)) return;

  try {
    const response = await fetch(`/api/to-do-folders/${folderId}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Folder deleted', 'success');
      loadToDos();
    } else {
      app.notify('Error deleting folder', 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error deleting folder', 'danger');
  }
}

function toggleFolderNode(nodeEl) {
  const id = String(nodeEl.dataset.folderId);
  if (expandedFolders.has(id)) {
    expandedFolders.delete(id);
    nodeEl.classList.remove('expanded');
  } else {
    expandedFolders.add(id);
    nodeEl.classList.add('expanded');
  }
}

async function reparentFolder(folderId, newParentId) {
  const folder = allFolders.find(f => String(f.id) === String(folderId));
  if (!folder) return;

  try {
    const response = await fetch(`/api/to-do-folders/${folderId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ name: folder.name, parent_id: newParentId })
    });

    const result = await response.json();
    if (result.success) {
      if (newParentId) expandedFolders.add(String(newParentId));
      loadToDos();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error moving folder:', error);
    app.notify('Error moving folder', 'danger');
  }
}

async function fileToDoIntoFolder(toDoId, folderId) {
  const toDo = allToDos.find(t => String(t.id) === String(toDoId));
  if (!toDo) return;

  try {
    const response = await fetch(`/api/to-dos/${toDoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ title: toDo.title, notes: toDo.notes, folder_id: folderId })
    });

    const result = await response.json();
    if (result.success) {
      if (folderId) expandedFolders.add(String(folderId));
      loadToDos();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error filing to do:', error);
    app.notify('Error filing to do', 'danger');
  }
}

let convertingToDoData = null;

async function loadConvertParentOptions(type) {
  const select = document.getElementById('convertParent');
  const endpoint = type === 'sub-project' ? '/api/priorities' : '/api/areas';
  const labelField = type === 'sub-project' ? 'title' : 'name';

  try {
    const response = await fetch(endpoint);
    const result = await response.json();
    const records = (result.success && result.data) || [];

    select.innerHTML = app.flattenTree(records)
      .map(r => `<option value="${r.id}">${'— '.repeat(r.depth)}${r[labelField]}</option>`)
      .join('');
  } catch (error) {
    console.error('Error loading parent options:', error);
  }
}

function updateConvertFormVisibility() {
  const type = document.getElementById('convertType').value;
  const parentGroup = document.getElementById('convertParentGroup');
  const dateGroup = document.getElementById('convertDateGroup');

  parentGroup.classList.add('d-none');
  dateGroup.classList.add('d-none');

  if (type === 'sub-project' || type === 'sub-area') {
    parentGroup.classList.remove('d-none');
    loadConvertParentOptions(type);
  } else if (type === 'work-item') {
    dateGroup.classList.remove('d-none');
  }
}

async function openConvertToDoForm(toDoId, presetType) {
  try {
    const response = await fetch(`/api/to-dos/${toDoId}`);
    const result = await response.json();
    convertingToDoData = result.data;

    document.getElementById('convertToDoTitle').textContent = convertingToDoData.title;
    document.getElementById('convertType').value = presetType || 'project';
    document.getElementById('convertDate').value = new Date().toISOString().split('T')[0];
    updateConvertFormVisibility();

    const modal = new bootstrap.Modal(document.getElementById('convertToDoModal'));
    modal.show();
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error loading to do', 'danger');
  }
}

async function doConvertToDo() {
  if (!convertingToDoData) return;

  const type = document.getElementById('convertType').value;
  const { title, notes } = convertingToDoData;
  let endpoint;
  let payload;

  if (type === 'project') {
    endpoint = '/api/priorities';
    payload = { title, notes };
  } else if (type === 'sub-project') {
    endpoint = '/api/priorities';
    payload = { title, notes, parent_id: document.getElementById('convertParent').value || null };
  } else if (type === 'area') {
    endpoint = '/api/areas';
    payload = { name: title, description: notes };
  } else if (type === 'sub-area') {
    endpoint = '/api/areas';
    payload = { name: title, description: notes, parent_id: document.getElementById('convertParent').value || null };
  } else if (type === 'work-item') {
    const date = document.getElementById('convertDate').value;
    if (!date) {
      app.notify('Pick a date', 'warning');
      return;
    }
    endpoint = '/api/work';
    payload = { date, title, description: notes };
  } else {
    return;
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!result.success) {
      app.notify('Error: ' + result.message, 'danger');
      return;
    }

    // The to-do has now become the new item, so remove the original
    await fetch(`/api/to-dos/${convertingToDoData.id}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });

    app.notify('Converted!', 'success');
    bootstrap.Modal.getInstance(document.getElementById('convertToDoModal')).hide();
    convertingToDoData = null;
    loadToDos();
  } catch (error) {
    console.error('Error converting to do:', error);
    app.notify('Error converting to do', 'danger');
  }
}

let todoContextMenuId = null;

function showTodoContextMenu(x, y, toDoId) {
  todoContextMenuId = toDoId;
  const menu = document.getElementById('todoContextMenu');
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.classList.remove('d-none');
}

function hideTodoContextMenu() {
  todoContextMenuId = null;
  document.getElementById('todoContextMenu').classList.add('d-none');
}

function initTodoContextMenu() {
  const menu = document.getElementById('todoContextMenu');

  menu.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-convert-type]');
    if (!btn || !todoContextMenuId) {
      hideTodoContextMenu();
      return;
    }

    const toDoId = todoContextMenuId;
    const type = btn.dataset.convertType;
    hideTodoContextMenu();
    openConvertToDoForm(toDoId, type);
  });

  document.addEventListener('click', (e) => {
    if (!menu.classList.contains('d-none') && !menu.contains(e.target)) {
      hideTodoContextMenu();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideTodoContextMenu();
  });
}

function clearToDoDropTargets(container) {
  container.querySelectorAll('.todo-drop-target').forEach(el => el.classList.remove('todo-drop-target'));
  container.classList.remove('todo-drop-target-root');
}

function initToDosEventListeners() {
  document.getElementById('addToDoBtn').addEventListener('click', openNewToDoForm);
  document.getElementById('saveToDoBtn').addEventListener('click', saveToDo);
  document.getElementById('addFolderBtn').addEventListener('click', openNewFolderForm);
  document.getElementById('saveFolderBtn').addEventListener('click', saveFolder);
  document.getElementById('convertType').addEventListener('change', updateConvertFormVisibility);
  document.getElementById('doConvertBtn').addEventListener('click', doConvertToDo);

  document.getElementById('addToDoItemBtn').addEventListener('click', addToDoItemRow);
  document.getElementById('toDoItemsList').addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-action="remove-item"]');
    if (removeBtn) removeBtn.closest('.todo-item-row').remove();
  });

  const container = document.getElementById('toDosList');

  app.bindInlineRename(container, '.todo-row .todo-title', async (newTitle, titleEl) => {
    const toDoId = titleEl.closest('.todo-row').dataset.todoId;
    try {
      const response = await fetch(`/api/to-dos/${toDoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.APP_CONFIG?.csrfToken
        },
        body: JSON.stringify({ title: newTitle })
      });
      const result = await response.json();
      if (!result.success) {
        app.notify('Error: ' + result.message, 'danger');
        return false;
      }
      loadToDos();
      return true;
    } catch (error) {
      console.error('Error renaming to do:', error);
      app.notify('Error renaming to do', 'danger');
      return false;
    }
  });

  app.bindInlineRename(container, '.todo-folder-header .todo-title', async (newName, titleEl) => {
    const folderId = titleEl.closest('.todo-folder-node').dataset.folderId;
    try {
      const response = await fetch(`/api/to-do-folders/${folderId}`, {
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
      loadToDos();
      return true;
    } catch (error) {
      console.error('Error renaming folder:', error);
      app.notify('Error renaming folder', 'danger');
      return false;
    }
  });

  container.addEventListener('dragstart', (e) => {
    const folderHeader = e.target.closest('.todo-folder-header');
    const todoRow = e.target.closest('.todo-row');

    if (folderHeader) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('type', 'folder');
      e.dataTransfer.setData('id', folderHeader.closest('.todo-folder-node').dataset.folderId);
      folderHeader.classList.add('dragging-item');
    } else if (todoRow) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('type', 'todo');
      e.dataTransfer.setData('id', todoRow.dataset.todoId);
      todoRow.classList.add('dragging-item');
    }
  });

  container.addEventListener('dragend', (e) => {
    const folderHeader = e.target.closest('.todo-folder-header');
    const todoRow = e.target.closest('.todo-row');
    if (folderHeader) folderHeader.classList.remove('dragging-item');
    if (todoRow) todoRow.classList.remove('dragging-item');
    clearToDoDropTargets(container);
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    const folderHeader = e.target.closest('.todo-folder-header');
    clearToDoDropTargets(container);
    if (folderHeader) {
      folderHeader.classList.add('todo-drop-target');
    } else {
      container.classList.add('todo-drop-target-root');
    }
  });

  container.addEventListener('drop', (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('type');
    const draggedId = e.dataTransfer.getData('id');
    clearToDoDropTargets(container);
    if (!type || !draggedId) return;

    const folderHeader = e.target.closest('.todo-folder-header');
    const targetFolderId = folderHeader ? folderHeader.closest('.todo-folder-node').dataset.folderId : null;

    if (type === 'folder') {
      if (targetFolderId && String(targetFolderId) === String(draggedId)) return;
      reparentFolder(draggedId, targetFolderId);
    } else if (type === 'todo') {
      fileToDoIntoFolder(draggedId, targetFolderId);
    }
  });

  container.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      const action = actionBtn.dataset.action;
      const id = actionBtn.dataset.id;
      if (action === 'edit') editToDo(id);
      else if (action === 'delete') deleteToDo(id);
      else if (action === 'convert') openConvertToDoForm(id);
      else if (action === 'edit-folder') editFolder(id);
      else if (action === 'delete-folder') deleteFolder(id);
      else if (action === 'toggle-expand') toggleFolderNode(actionBtn.closest('.todo-folder-node'));
      return;
    }
  });

  container.addEventListener('dblclick', (e) => {
    if (e.target.closest('[data-action]')) return;
    const todoRow = e.target.closest('.todo-row');
    if (todoRow) {
      editToDo(todoRow.dataset.todoId);
      return;
    }
    const folderHeader = e.target.closest('.todo-folder-header');
    if (folderHeader) {
      editFolder(folderHeader.closest('.todo-folder-node').dataset.folderId);
    }
  });

  container.addEventListener('contextmenu', (e) => {
    const todoRow = e.target.closest('.todo-row');
    if (!todoRow) return;
    e.preventDefault();
    showTodoContextMenu(e.clientX, e.clientY, todoRow.dataset.todoId);
  });

  initTodoContextMenu();
}

function initToDos() {
  // #toDoModal can be opened from other tabs (e.g. the Dailies right-click menu).
  // Left inside the #tab-todos pane, it's a descendant of a display:none ancestor
  // whenever that tab isn't active, so Bootstrap's backdrop would show but the
  // dialog itself never could - move it to the body so it always renders.
  document.body.appendChild(document.getElementById('toDoModal'));

  initToDosEventListeners();
  loadToDos();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initToDos);
} else {
  initToDos();
}
