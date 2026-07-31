let expandedIdeaFolders = new Set();
let allIdeaFolders = [];
let allIdeas = [];

function groupIdeasByFolder(ideas) {
  const byFolder = new Map();
  ideas.forEach(i => {
    const key = i.folder_id || null;
    if (!byFolder.has(key)) byFolder.set(key, []);
    byFolder.get(key).push(i);
  });
  return byFolder;
}

function renderIdeaRow(idea, depth) {
  const items = idea.items || [];
  const doneCount = items.filter(i => i.is_done).length;
  const itemsBadge = items.length > 0
    ? `<span class="badge bg-light text-dark border" title="Items done">${doneCount}/${items.length}</span>`
    : '';

  return `
    <div class="idea-row" data-idea-id="${idea.id}" draggable="true">
      <span class="idea-name-cell">
        <span style="display:inline-block; width: ${depth * 18}px; flex: none;"></span>
        <span class="idea-folder-toggle"></span>
        <i class="bi ${APP_ICONS.idea} text-muted" title="Idea"></i>
        <span class="idea-title">${idea.title}</span>
        ${itemsBadge}
      </span>
      <span class="idea-notes text-muted">${idea.notes || '-'}</span>
      <span class="idea-actions">
        <button class="btn btn-sm btn-outline-primary" data-action="convert" data-id="${idea.id}" title="Convert" aria-label="Convert"><i class="bi bi-arrow-right-circle"></i></button>
        <button class="btn btn-sm btn-info" data-action="edit" data-id="${idea.id}" title="Edit" aria-label="Edit"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-danger" data-action="delete" data-id="${idea.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
      </span>
    </div>
  `;
}

function renderIdeaFolderNode(folder, foldersByParent, ideasByFolder, depth) {
  const childFolders = foldersByParent.get(folder.id) || [];
  const childIdeas = ideasByFolder.get(folder.id) || [];
  const hasChildren = childFolders.length > 0 || childIdeas.length > 0;
  const isExpanded = expandedIdeaFolders.has(String(folder.id));

  const childrenHtml = hasChildren
    ? `<div class="idea-folder-node-children">
        ${childFolders.map(f => renderIdeaFolderNode(f, foldersByParent, ideasByFolder, depth + 1)).join('')}
        ${childIdeas.map(i => renderIdeaRow(i, depth + 1)).join('')}
      </div>`
    : '';

  return `
    <div class="idea-folder-node ${isExpanded ? 'expanded' : ''}" data-folder-id="${folder.id}">
      <div class="idea-folder-header" draggable="true">
        <span class="idea-name-cell">
          <span style="display:inline-block; width: ${depth * 18}px; flex: none;"></span>
          ${hasChildren
            ? '<i class="bi bi-chevron-right idea-folder-toggle" data-action="toggle-expand"></i>'
            : '<span class="idea-folder-toggle"></span>'}
          <i class="bi bi-folder-fill text-warning"></i>
          <span class="idea-title">${folder.name}</span>
        </span>
        <span></span>
        <span class="idea-actions">
          <button class="btn btn-sm btn-info" data-action="edit-folder" data-id="${folder.id}" title="Edit" aria-label="Edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-danger" data-action="delete-folder" data-id="${folder.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
        </span>
      </div>
      ${childrenHtml}
    </div>
  `;
}

function renderIdeasList() {
  const container = document.getElementById('ideasList');

  if (allIdeaFolders.length === 0 && allIdeas.length === 0) {
    container.innerHTML = '<p class="text-center text-muted">No ideas yet</p>';
    return;
  }

  const foldersByParent = app.groupByParent(allIdeaFolders);
  const ideasByFolder = groupIdeasByFolder(allIdeas);

  const topFolders = foldersByParent.get(null) || [];
  const topIdeas = ideasByFolder.get(null) || [];

  container.innerHTML =
    topFolders.map(f => renderIdeaFolderNode(f, foldersByParent, ideasByFolder, 0)).join('') +
    topIdeas.map(i => renderIdeaRow(i, 0)).join('');
}

async function loadIdeas() {
  const container = document.getElementById('ideasList');
  container.innerHTML = '<p class="text-center text-muted">Loading...</p>';

  try {
    const [foldersResponse, ideasResponse] = await Promise.all([
      fetch('/api/idea-folders'),
      fetch('/api/ideas'),
    ]);
    if (!foldersResponse.ok) throw new Error(`HTTP ${foldersResponse.status}`);
    if (!ideasResponse.ok) throw new Error(`HTTP ${ideasResponse.status}`);

    const foldersResult = await foldersResponse.json();
    const ideasResult = await ideasResponse.json();

    if (foldersResult.success && ideasResult.success) {
      allIdeaFolders = foldersResult.data;
      allIdeas = ideasResult.data;
      renderIdeasList();
    } else {
      container.innerHTML = '<p class="text-center text-danger">Error loading ideas</p>';
    }
  } catch (error) {
    console.error('Error loading ideas:', error);
    container.innerHTML = '<p class="text-center text-danger">Error loading ideas</p>';
  }
}

function renderIdeaItemRow(text, isDone) {
  return `
    <div class="idea-item-row">
      <input type="checkbox" class="form-check-input" ${isDone ? 'checked' : ''}>
      <input type="text" class="form-control form-control-sm" value="${app.escapeHtml(text || '')}" placeholder="Item text">
      <button type="button" class="btn btn-sm btn-link text-danger p-0" data-action="remove-item" title="Remove" aria-label="Remove"><i class="bi bi-x-lg"></i></button>
    </div>
  `;
}

function renderIdeaItemsEditor(items) {
  document.getElementById('ideaItemsList').innerHTML = (items || [])
    .map(item => renderIdeaItemRow(item.text, item.is_done))
    .join('');
}

function addIdeaItemRow() {
  const container = document.getElementById('ideaItemsList');
  container.insertAdjacentHTML('beforeend', renderIdeaItemRow('', false));
  const inputs = container.querySelectorAll('.idea-item-row input[type="text"]');
  inputs[inputs.length - 1]?.focus();
}

function collectIdeaItemsFromEditor() {
  return Array.from(document.querySelectorAll('#ideaItemsList .idea-item-row'))
    .map(row => ({
      text: row.querySelector('input[type="text"]').value.trim(),
      is_done: row.querySelector('input[type="checkbox"]').checked
    }))
    .filter(item => item.text);
}

function openNewIdeaForm() {
  document.getElementById('ideaId').value = '';
  document.getElementById('ideaForm').reset();
  renderIdeaItemsEditor([]);
}

async function saveIdea() {
  const ideaId = document.getElementById('ideaId').value;

  // folder_id is intentionally omitted here - it's only ever changed via drag-and-drop,
  // never through this form, so a plain title/notes edit must leave it untouched.
  const data = {
    title: document.getElementById('ideaTitle').value,
    notes: document.getElementById('ideaNotes').value,
    items: collectIdeaItemsFromEditor()
  };

  try {
    const url = ideaId ? `/api/ideas/${ideaId}` : '/api/ideas';
    const method = ideaId ? 'PUT' : 'POST';

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
      app.notify('Idea saved!', 'success');
      bootstrap.Modal.getInstance(document.getElementById('ideaModal')).hide();
      loadIdeas();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error saving idea', 'danger');
  }
}

async function editIdea(ideaId) {
  try {
    const response = await fetch(`/api/ideas/${ideaId}`);
    const result = await response.json();
    const idea = result.data;

    document.getElementById('ideaId').value = idea.id;
    document.getElementById('ideaTitle').value = idea.title;
    document.getElementById('ideaNotes').value = idea.notes || '';
    renderIdeaItemsEditor(idea.items || []);

    const modal = new bootstrap.Modal(document.getElementById('ideaModal'));
    modal.show();
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error loading idea', 'danger');
  }
}

async function deleteIdea(ideaId) {
  if (!await app.confirm('Delete this idea?')) return;

  try {
    const response = await fetch(`/api/ideas/${ideaId}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Idea deleted', 'success');
      loadIdeas();
    } else {
      app.notify('Error deleting idea', 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error deleting idea', 'danger');
  }
}

function openNewIdeaFolderForm() {
  document.getElementById('ideaFolderId').value = '';
  document.getElementById('ideaFolderForm').reset();
}

async function saveIdeaFolder() {
  const folderId = document.getElementById('ideaFolderId').value;

  const data = {
    name: document.getElementById('ideaFolderName').value
  };

  try {
    const url = folderId ? `/api/idea-folders/${folderId}` : '/api/idea-folders';
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
      bootstrap.Modal.getInstance(document.getElementById('ideaFolderModal')).hide();
      loadIdeas();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error saving folder', 'danger');
  }
}

async function editIdeaFolder(folderId) {
  try {
    const response = await fetch(`/api/idea-folders/${folderId}`);
    const result = await response.json();
    const folder = result.data;

    document.getElementById('ideaFolderId').value = folder.id;
    document.getElementById('ideaFolderName').value = folder.name;

    const modal = new bootstrap.Modal(document.getElementById('ideaFolderModal'));
    modal.show();
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error loading folder', 'danger');
  }
}

function getIdeaFolderDescendantIds(folderId) {
  const descendants = new Set();
  const byParent = app.groupByParent(allIdeaFolders);
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

function countIdeasInFolders(folderIds) {
  return allIdeas.filter(i => i.folder_id && folderIds.has(Number(i.folder_id))).length;
}

async function deleteIdeaFolder(folderId) {
  const descendants = getIdeaFolderDescendantIds(folderId);
  const allIds = new Set([Number(folderId), ...descendants]);
  const ideaCount = countIdeasInFolders(allIds);

  let message = 'Delete this folder?';
  if (descendants.size > 0 && ideaCount > 0) {
    message = 'This folder has sub-folders and ideas in it. The sub-folders will be deleted and the ideas will become unfiled. Delete anyway?';
  } else if (descendants.size > 0) {
    message = 'This folder has sub-folders that will also be deleted. Delete anyway?';
  } else if (ideaCount > 0) {
    message = 'This folder has ideas in it that will become unfiled. Delete anyway?';
  }

  if (!await app.confirm(message)) return;

  try {
    const response = await fetch(`/api/idea-folders/${folderId}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Folder deleted', 'success');
      loadIdeas();
    } else {
      app.notify('Error deleting folder', 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error deleting folder', 'danger');
  }
}

function toggleIdeaFolderNode(nodeEl) {
  const id = String(nodeEl.dataset.folderId);
  if (expandedIdeaFolders.has(id)) {
    expandedIdeaFolders.delete(id);
    nodeEl.classList.remove('expanded');
  } else {
    expandedIdeaFolders.add(id);
    nodeEl.classList.add('expanded');
  }
}

async function reparentIdeaFolder(folderId, newParentId) {
  const folder = allIdeaFolders.find(f => String(f.id) === String(folderId));
  if (!folder) return;

  try {
    const response = await fetch(`/api/idea-folders/${folderId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ name: folder.name, parent_id: newParentId })
    });

    const result = await response.json();
    if (result.success) {
      if (newParentId) expandedIdeaFolders.add(String(newParentId));
      loadIdeas();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error moving folder:', error);
    app.notify('Error moving folder', 'danger');
  }
}

async function fileIdeaIntoFolder(ideaId, folderId) {
  const idea = allIdeas.find(i => String(i.id) === String(ideaId));
  if (!idea) return;

  try {
    const response = await fetch(`/api/ideas/${ideaId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ title: idea.title, notes: idea.notes, folder_id: folderId })
    });

    const result = await response.json();
    if (result.success) {
      if (folderId) expandedIdeaFolders.add(String(folderId));
      loadIdeas();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error filing idea:', error);
    app.notify('Error filing idea', 'danger');
  }
}

let convertingIdeaData = null;

async function loadConvertIdeaParentOptions(type) {
  const select = document.getElementById('convertIdeaParent');
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

function updateConvertIdeaFormVisibility() {
  const type = document.getElementById('convertIdeaType').value;
  const parentGroup = document.getElementById('convertIdeaParentGroup');
  const dateGroup = document.getElementById('convertIdeaDateGroup');

  parentGroup.classList.add('d-none');
  dateGroup.classList.add('d-none');

  if (type === 'sub-project' || type === 'sub-area') {
    parentGroup.classList.remove('d-none');
    loadConvertIdeaParentOptions(type);
  } else if (type === 'work-item') {
    dateGroup.classList.remove('d-none');
  }
}

async function openConvertIdeaForm(ideaId) {
  try {
    const response = await fetch(`/api/ideas/${ideaId}`);
    const result = await response.json();
    convertingIdeaData = result.data;

    document.getElementById('convertIdeaTitle').textContent = convertingIdeaData.title;
    document.getElementById('convertIdeaType').value = 'project';
    document.getElementById('convertIdeaDate').value = new Date().toISOString().split('T')[0];
    updateConvertIdeaFormVisibility();

    const modal = new bootstrap.Modal(document.getElementById('convertIdeaModal'));
    modal.show();
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error loading idea', 'danger');
  }
}

async function doConvertIdea() {
  if (!convertingIdeaData) return;

  const type = document.getElementById('convertIdeaType').value;
  const { title, notes } = convertingIdeaData;
  let endpoint;
  let payload;

  if (type === 'project') {
    endpoint = '/api/priorities';
    payload = { title, notes };
  } else if (type === 'sub-project') {
    endpoint = '/api/priorities';
    payload = { title, notes, parent_id: document.getElementById('convertIdeaParent').value || null };
  } else if (type === 'area') {
    endpoint = '/api/areas';
    payload = { name: title, description: notes };
  } else if (type === 'sub-area') {
    endpoint = '/api/areas';
    payload = { name: title, description: notes, parent_id: document.getElementById('convertIdeaParent').value || null };
  } else if (type === 'work-item') {
    const date = document.getElementById('convertIdeaDate').value;
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

    // The idea has now become the new item, so remove the original
    await fetch(`/api/ideas/${convertingIdeaData.id}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });

    app.notify('Converted!', 'success');
    bootstrap.Modal.getInstance(document.getElementById('convertIdeaModal')).hide();
    convertingIdeaData = null;
    loadIdeas();
  } catch (error) {
    console.error('Error converting idea:', error);
    app.notify('Error converting idea', 'danger');
  }
}

function clearIdeaDropTargets(container) {
  container.querySelectorAll('.idea-drop-target').forEach(el => el.classList.remove('idea-drop-target'));
  container.classList.remove('idea-drop-target-root');
}

function initBrainstormingEventListeners() {
  document.getElementById('addIdeaBtn').addEventListener('click', openNewIdeaForm);
  document.getElementById('saveIdeaBtn').addEventListener('click', saveIdea);
  document.getElementById('addIdeaFolderBtn').addEventListener('click', openNewIdeaFolderForm);
  document.getElementById('saveIdeaFolderBtn').addEventListener('click', saveIdeaFolder);
  document.getElementById('convertIdeaType').addEventListener('change', updateConvertIdeaFormVisibility);
  document.getElementById('doConvertIdeaBtn').addEventListener('click', doConvertIdea);

  document.getElementById('addIdeaItemBtn').addEventListener('click', addIdeaItemRow);
  document.getElementById('ideaItemsList').addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-action="remove-item"]');
    if (removeBtn) removeBtn.closest('.idea-item-row').remove();
  });

  const container = document.getElementById('ideasList');

  app.bindInlineRename(container, '.idea-row .idea-title', async (newTitle, titleEl) => {
    const ideaId = titleEl.closest('.idea-row').dataset.ideaId;
    try {
      const response = await fetch(`/api/ideas/${ideaId}`, {
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
      loadIdeas();
      return true;
    } catch (error) {
      console.error('Error renaming idea:', error);
      app.notify('Error renaming idea', 'danger');
      return false;
    }
  });

  app.bindInlineRename(container, '.idea-folder-header .idea-title', async (newName, titleEl) => {
    const folderId = titleEl.closest('.idea-folder-node').dataset.folderId;
    try {
      const response = await fetch(`/api/idea-folders/${folderId}`, {
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
      loadIdeas();
      return true;
    } catch (error) {
      console.error('Error renaming folder:', error);
      app.notify('Error renaming folder', 'danger');
      return false;
    }
  });

  container.addEventListener('dragstart', (e) => {
    const folderHeader = e.target.closest('.idea-folder-header');
    const ideaRow = e.target.closest('.idea-row');

    if (folderHeader) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('type', 'folder');
      e.dataTransfer.setData('id', folderHeader.closest('.idea-folder-node').dataset.folderId);
      folderHeader.classList.add('dragging-item');
    } else if (ideaRow) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('type', 'idea');
      e.dataTransfer.setData('id', ideaRow.dataset.ideaId);
      ideaRow.classList.add('dragging-item');
    }
  });

  container.addEventListener('dragend', (e) => {
    const folderHeader = e.target.closest('.idea-folder-header');
    const ideaRow = e.target.closest('.idea-row');
    if (folderHeader) folderHeader.classList.remove('dragging-item');
    if (ideaRow) ideaRow.classList.remove('dragging-item');
    clearIdeaDropTargets(container);
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    const folderHeader = e.target.closest('.idea-folder-header');
    clearIdeaDropTargets(container);
    if (folderHeader) {
      folderHeader.classList.add('idea-drop-target');
    } else {
      container.classList.add('idea-drop-target-root');
    }
  });

  container.addEventListener('drop', (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('type');
    const draggedId = e.dataTransfer.getData('id');
    clearIdeaDropTargets(container);
    if (!type || !draggedId) return;

    const folderHeader = e.target.closest('.idea-folder-header');
    const targetFolderId = folderHeader ? folderHeader.closest('.idea-folder-node').dataset.folderId : null;

    if (type === 'folder') {
      if (targetFolderId && String(targetFolderId) === String(draggedId)) return;
      reparentIdeaFolder(draggedId, targetFolderId);
    } else if (type === 'idea') {
      fileIdeaIntoFolder(draggedId, targetFolderId);
    }
  });

  container.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      const action = actionBtn.dataset.action;
      const id = actionBtn.dataset.id;
      if (action === 'edit') editIdea(id);
      else if (action === 'delete') deleteIdea(id);
      else if (action === 'convert') openConvertIdeaForm(id);
      else if (action === 'edit-folder') editIdeaFolder(id);
      else if (action === 'delete-folder') deleteIdeaFolder(id);
      else if (action === 'toggle-expand') toggleIdeaFolderNode(actionBtn.closest('.idea-folder-node'));
      return;
    }
  });

  container.addEventListener('dblclick', (e) => {
    if (e.target.closest('[data-action]')) return;
    const ideaRow = e.target.closest('.idea-row');
    if (ideaRow) {
      editIdea(ideaRow.dataset.ideaId);
      return;
    }
    const folderHeader = e.target.closest('.idea-folder-header');
    if (folderHeader) {
      editIdeaFolder(folderHeader.closest('.idea-folder-node').dataset.folderId);
    }
  });
}

function initBrainstorming() {
  // #ideaModal can be opened from other tabs in the future, same reasoning as
  // #toDoModal - move it to the body so a hidden ancestor tab pane never blocks it.
  document.body.appendChild(document.getElementById('ideaModal'));

  initBrainstormingEventListeners();
  loadIdeas();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBrainstorming);
} else {
  initBrainstorming();
}
