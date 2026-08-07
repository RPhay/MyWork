let expandedIdeaFolders = new Set();
let allIdeaFolders = [];
let allIdeas = [];

// Parse email data from drag event
function parseEmailData(text) {
  // Outlook typically sends email in format:
  // Subject line
  // From: sender@example.com
  // Sent: date/time
  // Body content...

  const lines = text.split(/[\r\n]+/);
  const email = {
    subject: '',
    from: '',
    body: ''
  };

  let bodyStartIndex = 0;

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i].trim();

    // First non-empty line is usually the subject
    if (!email.subject && line && !line.startsWith('From:') && !line.startsWith('Sent:')) {
      email.subject = line;
      bodyStartIndex = i + 1;
    } else if (line.startsWith('From:')) {
      email.from = line.substring(5).trim();
    }
  }

  // Everything after metadata is body
  if (bodyStartIndex < lines.length) {
    email.body = lines.slice(bodyStartIndex)
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('Sent:'))
      .join('\n')
      .trim();
  }

  return email;
}

async function createIdeaFromEmail(emailData, folderId = null) {
  const title = emailData.subject || 'Email Idea';
  const description = emailData.body || '';

  const ideaData = {
    title: title,
    description: description,
    folder_id: folderId || null
  };

  try {
    const response = await fetch('/api/ideas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify(ideaData)
    });

    const result = await response.json();
    if (result.success) {
      app.notify(`Idea created from email: "${title}"`, 'success');
      loadIdeas();
      // Open the edit modal so user can add more details
      editIdea(result.data.id);
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error creating idea from email:', error);
    app.notify('Error creating idea from email', 'danger');
  }
}

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
  const hasLinks = idea.hasLinks || false;
  const linksBadge = hasLinks
    ? `<span class="badge bg-info text-white" title="Has links">🔗</span>`
    : '';

  return `
    <div class="idea-row" data-idea-id="${idea.id}" data-type="idea" data-id="${idea.id}" data-name="${app.escapeHtml(idea.title)}" draggable="true">
      <span class="idea-name-cell">
        <span style="display:inline-block; width: ${depth * 18}px; flex: none;"></span>
        <span class="idea-folder-toggle"></span>
        <i class="bi ${APP_ICONS.idea} text-muted" title="Idea"></i>
        <span class="idea-title">${app.escapeHtml(idea.title)}</span>
        ${itemsBadge}
        ${linksBadge}
      </span>
      <span class="idea-notes text-muted">${app.escapeHtml(idea.notes) || '-'}</span>
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
      <div class="idea-folder-header" data-type="folder" data-id="${folder.id}" data-name="${app.escapeHtml(folder.name)}" draggable="true">
        <span class="idea-name-cell">
          <span style="display:inline-block; width: ${depth * 18}px; flex: none;"></span>
          ${hasChildren
            ? '<i class="bi bi-chevron-right idea-folder-toggle" data-action="toggle-expand"></i>'
            : '<span class="idea-folder-toggle"></span>'}
          <i class="bi bi-folder-fill text-warning"></i>
          <span class="idea-title">${app.escapeHtml(folder.name)}</span>
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

  setupDragListeners();
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

function openNewIdeaForm(presetFolderId) {
  document.getElementById('ideaId').value = '';
  document.getElementById('ideaForm').reset();
  document.getElementById('ideaPresetFolderId').value = presetFolderId || '';
  renderIdeaItemsEditor([]);
}

async function saveIdea() {
  const ideaId = document.getElementById('ideaId').value;
  const presetFolderId = document.getElementById('ideaPresetFolderId').value;

  // folder_id is intentionally omitted on edit - it's only ever changed via
  // drag-and-drop there, never through this form. On create, a preset folder
  // (e.g. from a folder's "Add Idea Here" context menu) is included so the new
  // idea lands directly in that folder instead of unfiled.
  const data = {
    title: document.getElementById('ideaTitle').value,
    notes: document.getElementById('ideaNotes').value,
    items: collectIdeaItemsFromEditor()
  };
  if (!ideaId && presetFolderId) {
    data.folder_id = presetFolderId;
  }

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
      if (!ideaId && presetFolderId) expandedIdeaFolders.add(String(presetFolderId));
      loadIdeas();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error saving idea', 'danger');
  }
}

function closeIdeaEditor() {
  const editorPane = document.getElementById('ideaEditorPane');
  if (editorPane) {
    editorPane.classList.add('hidden');
    document.getElementById('ideaEditorForm').style.display = 'none';
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

    // Load and display links
    loadLinksForEntity('idea', idea.id, 'ideaLinksList');

    // Setup link input handlers
    const addLinkBtn = document.getElementById('addIdeaLinkBtn');
    if (addLinkBtn) {
      addLinkBtn.onclick = async (e) => {
        e.preventDefault();
        const url = document.getElementById('ideaLinkUrl').value;
        const title = document.getElementById('ideaLinkTitle').value;
        if (await addLinkToEntity('idea', idea.id, url, title, 'ideaLinksList')) {
          document.getElementById('ideaLinkUrl').value = '';
          document.getElementById('ideaLinkTitle').value = '';
        }
      };
    }

    // Setup URL drag-drop
    setupURLDragDrop('idea', 'ideaLinksList', () => idea.id);

    // Show side-panel editor if split pane exists, otherwise use modal
    const editorPane = document.getElementById('ideaEditorPane');
    if (editorPane && window.ideaSplitPane) {
      editorPane.classList.remove('hidden');
      document.getElementById('ideaEditorForm').style.display = 'block';
      document.getElementById('editorTitle').textContent = idea.title;
    } else {
      const modal = new bootstrap.Modal(document.getElementById('ideaModal'));
      modal.show();
    }
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

async function openConvertIdeaForm(ideaId, presetType) {
  try {
    const response = await fetch(`/api/ideas/${ideaId}`);
    const result = await response.json();
    convertingIdeaData = result.data;

    document.getElementById('convertIdeaTitle').textContent = convertingIdeaData.title;
    document.getElementById('convertIdeaType').value = presetType || 'project';
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

let ideaContextMenuId = null;

function showIdeaContextMenu(x, y, ideaId) {
  ideaContextMenuId = ideaId;
  const menu = document.getElementById('ideaContextMenu');
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.classList.remove('d-none');
}

function hideIdeaContextMenu() {
  ideaContextMenuId = null;
  document.getElementById('ideaContextMenu').classList.add('d-none');
}

function initIdeaContextMenu() {
  const menu = document.getElementById('ideaContextMenu');

  menu.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-convert-type]');
    if (!btn || !ideaContextMenuId) {
      hideIdeaContextMenu();
      return;
    }

    const ideaId = ideaContextMenuId;
    const type = btn.dataset.convertType;
    hideIdeaContextMenu();
    openConvertIdeaForm(ideaId, type);
  });

  document.addEventListener('click', (e) => {
    if (!menu.classList.contains('d-none') && !menu.contains(e.target)) {
      hideIdeaContextMenu();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideIdeaContextMenu();
  });
}

let ideaFolderContextMenuId = null;

function showIdeaFolderContextMenu(x, y, folderId) {
  ideaFolderContextMenuId = folderId;
  const menu = document.getElementById('ideaFolderContextMenu');
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.classList.remove('d-none');
}

function hideIdeaFolderContextMenu() {
  ideaFolderContextMenuId = null;
  document.getElementById('ideaFolderContextMenu').classList.add('d-none');
}

function initIdeaFolderContextMenu() {
  const menu = document.getElementById('ideaFolderContextMenu');

  menu.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-menu-action]');
    if (!btn || !ideaFolderContextMenuId) {
      hideIdeaFolderContextMenu();
      return;
    }

    const folderId = ideaFolderContextMenuId;
    hideIdeaFolderContextMenu();

    if (btn.dataset.menuAction === 'add-idea') {
      openNewIdeaForm(folderId);
      const modal = new bootstrap.Modal(document.getElementById('ideaModal'));
      modal.show();
    }
  });

  document.addEventListener('click', (e) => {
    if (!menu.classList.contains('d-none') && !menu.contains(e.target)) {
      hideIdeaFolderContextMenu();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideIdeaFolderContextMenu();
  });
}

function clearIdeaDropTargets(container) {
  container.querySelectorAll('.idea-drop-target').forEach(el => el.classList.remove('idea-drop-target'));
  container.classList.remove('idea-drop-target-root');
}

function initBrainstormingEventListeners() {
  document.getElementById('addIdeaBtn').addEventListener('click', () => openNewIdeaForm());
  document.getElementById('saveIdeaBtn').addEventListener('click', saveIdea);
  document.getElementById('addIdeaFolderBtn').addEventListener('click', openNewIdeaFolderForm);
  document.getElementById('saveIdeaFolderBtn').addEventListener('click', saveIdeaFolder);
  document.getElementById('convertIdeaType').addEventListener('change', updateConvertIdeaFormVisibility);
  document.getElementById('doConvertIdeaBtn').addEventListener('click', doConvertIdea);

  // Side-panel editor buttons
  const saveEditorBtn = document.getElementById('saveIdeaEditorBtn');
  const closeEditorBtn = document.getElementById('closeIdeaEditorBtn');
  if (saveEditorBtn) {
    saveEditorBtn.addEventListener('click', async () => {
      await saveIdea();
      closeIdeaEditor();
    });
  }
  if (closeEditorBtn) {
    closeEditorBtn.addEventListener('click', closeIdeaEditor);
  }

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

  // dragstart doesn't bubble, so we rely on setupDragListeners() to attach
  // handlers directly to individual items

  container.addEventListener('dragover', (e) => {
    const types = Array.from(e.dataTransfer.types || []);
    // Accept any text data - emails, calendar events, etc
    const hasTextData = types.length > 0 && !types.every(t => t.startsWith('application/'));
    // Check if this is an internal drag (has custom 'type' data from dragstart)
    const hasInternalDrag = !!e.dataTransfer.getData('type');

    if (!hasTextData && !hasInternalDrag) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = hasInternalDrag ? 'move' : 'copy';
    const folderHeader = e.target.closest('.idea-folder-header');
    clearIdeaDropTargets(container);
    if (folderHeader) {
      folderHeader.classList.add('idea-drop-target');
    } else {
      container.classList.add('idea-drop-target-root');
    }
  });

  container.addEventListener('drop', async (e) => {
    e.preventDefault();
    clearIdeaDropTargets(container);

    const type = e.dataTransfer.getData('type');
    const draggedId = e.dataTransfer.getData('id');
    const folderHeader = e.target.closest('.idea-folder-header');
    const targetFolderId = folderHeader ? folderHeader.closest('.idea-folder-node').dataset.folderId : null;

    console.log('[brainstorming drop] type:', type, 'draggedId:', draggedId, 'targetFolderId:', targetFolderId);

    // Handle internal drag-drop (folder/idea reordering)
    if (type && draggedId) {
      if (type === 'folder') {
        console.log('[brainstorming drop] Moving folder');
        if (targetFolderId && String(targetFolderId) === String(draggedId)) return;
        reparentIdeaFolder(draggedId, targetFolderId);
      } else if (type === 'idea') {
        console.log('[brainstorming drop] Moving idea to folder:', targetFolderId);
        fileIdeaIntoFolder(draggedId, targetFolderId);
      }
      return;
    }

    // Handle external email/calendar drag-drop
    const types = Array.from(e.dataTransfer.types || []);
    let dropText = null;

    if (e.dataTransfer.types.includes('text/calendar')) {
      dropText = e.dataTransfer.getData('text/calendar');
    } else if (e.dataTransfer.types.includes('text/plain')) {
      dropText = e.dataTransfer.getData('text/plain');
    } else if (e.dataTransfer.types.includes('text/html')) {
      dropText = e.dataTransfer.getData('text/html');
    }

    if (dropText && dropText.trim().length > 0) {
      console.log('[Brainstorming] Item dropped. Text length:', dropText.length);

      // Check if this is an email
      if (isEmailData(dropText)) {
        const emailData = parseOutlookEmail(dropText);
        console.log('[Brainstorming] Parsed email:', emailData);
        if (emailData.subject) {
          // createIdeaFromEmail expects emailData.body, parseOutlookEmail provides it
          await createIdeaFromEmail(emailData, targetFolderId);
        }
      }
      // Check if this is a calendar event
      else if (dropText.includes('BEGIN:VEVENT') || dropText.includes('DTSTART') || dropText.includes('When:') || dropText.includes('Location:')) {
        const calendarEvent = parseCalendarEvent(dropText);
        console.log('[Brainstorming] Parsed calendar event:', calendarEvent);
        if (calendarEvent.title) {
          await createIdeaFromCalendarEvent(calendarEvent);
        }
      }
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

  container.addEventListener('contextmenu', (e) => {
    const ideaRow = e.target.closest('.idea-row');
    if (ideaRow) {
      e.preventDefault();
      showIdeaContextMenu(e.clientX, e.clientY, ideaRow.dataset.ideaId);
      return;
    }
    const folderHeader = e.target.closest('.idea-folder-header');
    if (folderHeader) {
      e.preventDefault();
      showIdeaFolderContextMenu(e.clientX, e.clientY, folderHeader.closest('.idea-folder-node').dataset.folderId);
    }
  });

  initIdeaContextMenu();
  initIdeaFolderContextMenu();
}

function initBrainstorming() {
  // #ideaModal can be opened from other tabs in the future, same reasoning as
  // #toDoModal - move it to the body so a hidden ancestor tab pane never blocks it.
  document.body.appendChild(document.getElementById('ideaModal'));

  // Initialize split pane for side-panel editing
  if (document.getElementById('ideaSplitPane')) {
    window.ideaSplitPane = new SplitPane('ideaSplitPane', 'ideaListPane', 'ideaDivider', 'ideaEditorPane', 66.66);
  }

  initBrainstormingEventListeners();
  loadIdeas();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBrainstorming);
} else {
  initBrainstorming();
}
