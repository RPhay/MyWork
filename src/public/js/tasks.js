// Store state on window to survive multiple script loads
if (!window.taskState) {
  window.taskState = {
    expandedFolders: new Set(),
    allFolders: [],
    allTasks: []
  };
}

// Helper to get current state
function getTaskState() {
  return window.taskState;
}

function groupTasksByFolder(tasks) {
  const byFolder = new Map();
  tasks.forEach(t => {
    const key = t.folder_id || null;
    if (!byFolder.has(key)) byFolder.set(key, []);
    byFolder.get(key).push(t);
  });
  return byFolder;
}

function renderTaskRow(task, depth) {
  const hasLinks = task.links && task.links.length > 0;
  const linksBadge = hasLinks
    ? `<span class="badge bg-info text-white" title="Has links">🔗</span>`
    : '';
  const status = task.status || 'incomplete';
  const statusIcon = app.statusIcon(status);
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

  return `
    <div class="task-row" data-task-id="${task.id}" data-type="task" data-id="${task.id}" data-name="${app.escapeHtml(task.title)}" draggable="true">
      <span class="task-name-cell">
        <span style="display:inline-block; width: ${depth * 18}px; flex: none;"></span>
        <span class="task-folder-toggle"></span>
        <button type="button" class="todo-item-checkbox ${status !== 'incomplete' ? 'status-' + status : ''}" data-action="toggle-complete" data-id="${task.id}" data-status="${status}" title="${statusLabel} — click to change" aria-label="${statusLabel} — click to change">
          ${statusIcon ? `<i class="bi ${statusIcon}"></i>` : ''}
        </button>
        <span class="task-title" ${status === 'complete' ? 'style="text-decoration: line-through; opacity: 0.6;"' : ''}>${app.escapeHtml(task.title)}</span>
        ${linksBadge}
      </span>
      <span class="task-notes text-muted">${app.escapeHtml(task.notes) || '-'}</span>
      <span class="task-actions">
        <button class="btn btn-sm btn-danger" data-action="delete" data-id="${task.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
      </span>
    </div>
  `;
}

function renderTaskFolderNode(folder, foldersByParent, tasksByFolder, depth) {
  const childFolders = foldersByParent.get(folder.id) || [];
  const childTasks = tasksByFolder.get(folder.id) || [];
  const hasChildren = childFolders.length > 0 || childTasks.length > 0;
  const isExpanded = getTaskState().expandedFolders.has(String(folder.id));

  const childrenHtml = hasChildren
    ? `<div class="task-folder-node-children">
        ${childFolders.map(f => renderTaskFolderNode(f, foldersByParent, tasksByFolder, depth + 1)).join('')}
        ${childTasks.map(t => renderTaskRow(t, depth + 1)).join('')}
      </div>`
    : '';

  return `
    <div class="task-folder-node ${isExpanded ? 'expanded' : ''}" data-folder-id="${folder.id}">
      <div class="task-folder-header" data-type="folder" data-id="${folder.id}" data-name="${app.escapeHtml(folder.name)}" draggable="true">
        <span class="task-name-cell">
          <span style="display:inline-block; width: ${depth * 18}px; flex: none;"></span>
          ${hasChildren
            ? '<i class="bi bi-chevron-right task-folder-toggle" data-action="toggle-expand"></i>'
            : '<span class="task-folder-toggle"></span>'}
          <i class="bi bi-folder-fill text-warning"></i>
          <span class="task-title">${app.escapeHtml(folder.name)}</span>
        </span>
        <span></span>
        <span class="task-actions">
          <button class="btn btn-sm btn-danger" data-action="delete-folder" data-id="${folder.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
        </span>
      </div>
      ${childrenHtml}
    </div>
  `;
}

function renderTasksList() {
  const container = document.getElementById('tasksList');

  if (getTaskState().allFolders.length === 0 && getTaskState().allTasks.length === 0) {
    container.innerHTML = '<p class="text-center text-muted">No tasks yet</p>';
    return;
  }

  const foldersByParent = app.groupByParent(getTaskState().allFolders);
  const tasksByFolder = groupTasksByFolder(getTaskState().allTasks);

  const topFolders = foldersByParent.get(null) || [];
  const topTasks = tasksByFolder.get(null) || [];

  container.innerHTML =
    topFolders.map(f => renderTaskFolderNode(f, foldersByParent, tasksByFolder, 0)).join('') +
    topTasks.map(t => renderTaskRow(t, 0)).join('');

  setupDragListeners();
}

async function loadTasks() {
  const container = document.getElementById('tasksList');
  container.innerHTML = '<p class="text-center text-muted">Loading...</p>';

  try {
    const [foldersResponse, tasksResponse] = await Promise.all([
      fetch('/api/task-folders'),
      fetch('/api/tasks'),
    ]);
    if (!foldersResponse.ok) throw new Error(`HTTP ${foldersResponse.status}`);
    if (!tasksResponse.ok) throw new Error(`HTTP ${tasksResponse.status}`);

    const foldersResult = await foldersResponse.json();
    const tasksResult = await tasksResponse.json();

    if (foldersResult.success && tasksResult.success) {
      getTaskState().allFolders = foldersResult.data || [];
      getTaskState().allTasks = tasksResult.data || [];
      window.allTasks = getTaskState().allTasks;
      renderTasksList();
    } else {
      container.innerHTML = '<p class="text-center text-danger">Error loading tasks</p>';
    }
  } catch (error) {
    console.error('Error loading tasks:', error);
    container.innerHTML = `<p class="text-center text-danger">Error loading tasks: ${error.message}</p>`;
  }
}

function openTaskForm(taskId = null) {
  if (taskId) {
    TaskEditor.populate(taskId);
    return;
  }
  openNewTaskFormWithFolder(null);
}

function openNewTaskFormWithFolder(folderId) {
  const form = document.getElementById('taskForm');
  document.getElementById('taskId').value = '';
  form.reset();
  renderTaskLinks([]);

  // Stash the target folder so saveTask() files the new task there; cleared
  // on a plain "+ Add Task" (no folder context) so it doesn't leak into the
  // next save.
  if (folderId) {
    form.dataset.newFolderId = folderId;
  } else {
    delete form.dataset.newFolderId;
  }

  const modal = new bootstrap.Modal(document.getElementById('taskModal'));
  modal.show();
}

function closeTaskEditor() {
  TaskEditor.close();
}

function renderTaskLinksEditor(links) {
  const linksList = document.getElementById('taskEditorLinksList');
  linksList.innerHTML = '';

  links.forEach((link, index) => {
    const linkEl = document.createElement('div');
    linkEl.className = 'mb-2 p-2 bg-light rounded d-flex justify-content-between align-items-center';
    linkEl.innerHTML = `
      <a href="${app.escapeHtml(link.url)}" target="_blank" class="text-decoration-none">${app.escapeHtml(link.title || link.url)}</a>
      <button type="button" class="btn btn-sm btn-outline-danger" data-action="remove-link" data-index="${index}">
        <i class="bi bi-x"></i>
      </button>
    `;
    linksList.appendChild(linkEl);
  });
}

function renderTaskLinks(links) {
  const linksList = document.getElementById('taskLinksList');
  linksList.innerHTML = '';

  links.forEach((link, index) => {
    const linkEl = document.createElement('div');
    linkEl.className = 'mb-2 p-2 bg-light rounded d-flex justify-content-between align-items-center';
    linkEl.innerHTML = `
      <a href="${app.escapeHtml(link.url)}" target="_blank" class="text-decoration-none">${app.escapeHtml(link.title || link.url)}</a>
      <button type="button" class="btn btn-sm btn-outline-danger" data-action="remove-link" data-index="${index}">
        <i class="bi bi-x"></i>
      </button>
    `;
    linksList.appendChild(linkEl);
  });
}

async function saveTask() {
  const editorPane = document.getElementById('taskEditorPane');
  const useSplitPane = editorPane && !editorPane.classList.contains('hidden');

  if (useSplitPane) {
    const success = await TaskEditor.save();
    if (success) {
      loadTasks();
    }
  } else {
    const taskId = document.getElementById('taskId').value;
    const title = document.getElementById('taskTitle').value;
    const notes = document.getElementById('taskNotes').value;

    if (!title.trim()) {
      app.notify('Title is required', 'warning');
      return;
    }

    const taskData = { title, notes };
    // Only set on brand-new tasks created via "Add Task Here" on a folder's
    // context menu - a plain edit must leave folder_id untouched.
    const newFolderId = document.getElementById('taskForm').dataset.newFolderId;
    if (!taskId && newFolderId) {
      taskData.folder_id = newFolderId;
    }

    try {
      const method = taskId ? 'PUT' : 'POST';
      const url = taskId ? `/api/tasks/${taskId}` : '/api/tasks';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.APP_CONFIG?.csrfToken
        },
        body: JSON.stringify(taskData)
      });

      const result = await response.json();
      if (result.success) {
        app.notify(taskId ? 'Task updated!' : 'Task created!', 'success');
        const modal = bootstrap.Modal.getInstance(document.getElementById('taskModal'));
        if (modal) modal.hide();
        loadTasks();
      } else {
        app.notify('Error: ' + result.message, 'danger');
      }
    } catch (error) {
      console.error('Error:', error);
      app.notify('Error saving task', 'danger');
    }
  }
}

async function deleteTask(taskId) {
  if (!await app.confirm('Delete this task?')) return;

  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Task deleted', 'success');
      loadTasks();
    } else {
      app.notify('Error deleting task', 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error deleting task', 'danger');
  }
}

async function cycleTaskStatus(taskId, currentStatus) {
  const result = await app.cycleStatus(`/api/tasks/${taskId}`, currentStatus);
  if (result.success) {
    loadTasks();
  } else {
    app.notify('Error: ' + result.message, 'danger');
  }
}

function addTaskLink(isEditor = false) {
  const prefix = isEditor ? 'taskEditor' : 'task';
  const url = document.getElementById(`${prefix}LinkUrl`).value.trim();
  const title = document.getElementById(`${prefix}LinkTitle`).value.trim();

  if (!url) {
    app.notify('URL is required', 'warning');
    return;
  }

  const linkListId = isEditor ? 'taskEditorLinksList' : 'taskLinksList';
  const currentLinks = Array.from(document.querySelectorAll(`#${linkListId} a`)).map(a => ({
    url: a.href,
    title: a.textContent
  }));

  currentLinks.push({ url, title: title || url });

  if (isEditor) {
    TaskEditor.renderLinks(currentLinks);
  } else {
    renderTaskLinks(currentLinks);
  }

  document.getElementById(`${prefix}LinkUrl`).value = '';
  document.getElementById(`${prefix}LinkTitle`).value = '';
}

function openNewTaskFolderForm() {
  document.getElementById('taskFolderId').value = '';
  document.getElementById('taskFolderForm').reset();
}

async function saveTaskFolder() {
  const folderId = document.getElementById('taskFolderId').value;
  const name = document.getElementById('taskFolderName').value;

  if (!name.trim()) {
    app.notify('Folder name is required', 'danger');
    return;
  }

  const data = { name };

  try {
    const url = folderId ? `/api/task-folders/${folderId}` : '/api/task-folders';
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
      const modal = bootstrap.Modal.getInstance(document.getElementById('taskFolderModal'));
      if (modal) modal.hide();
      loadTasks();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error saving folder', 'danger');
  }
}

async function renameTaskFolder(folderId, newName) {
  try {
    const response = await fetch(`/api/task-folders/${folderId}`, {
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
    loadTasks();
    return true;
  } catch (error) {
    console.error('Error renaming folder:', error);
    app.notify('Error renaming folder', 'danger');
    return false;
  }
}

function getTaskFolderDescendantIds(folderId) {
  const descendants = new Set();
  const byParent = app.groupByParent(getTaskState().allFolders);
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

function countTasksInFolders(folderIds) {
  return getTaskState().allTasks.filter(t => t.folder_id && folderIds.has(Number(t.folder_id))).length;
}

async function deleteTaskFolder(folderId) {
  const descendants = getTaskFolderDescendantIds(folderId);
  const allIds = new Set([Number(folderId), ...descendants]);
  const taskCount = countTasksInFolders(allIds);

  let message = 'Delete this folder?';
  if (descendants.size > 0 && taskCount > 0) {
    message = 'This folder has sub-folders and tasks in it. The sub-folders will be deleted and the tasks will become unfiled. Delete anyway?';
  } else if (descendants.size > 0) {
    message = 'This folder has sub-folders that will also be deleted. Delete anyway?';
  } else if (taskCount > 0) {
    message = 'This folder has tasks in it that will become unfiled. Delete anyway?';
  }

  if (!await app.confirm(message)) return;

  try {
    const response = await fetch(`/api/task-folders/${folderId}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Folder deleted', 'success');
      loadTasks();
    } else {
      app.notify('Error deleting folder', 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error deleting folder', 'danger');
  }
}

function toggleTaskFolderNode(nodeEl) {
  const id = String(nodeEl.dataset.folderId);
  if (getTaskState().expandedFolders.has(id)) {
    getTaskState().expandedFolders.delete(id);
    nodeEl.classList.remove('expanded');
  } else {
    getTaskState().expandedFolders.add(id);
    nodeEl.classList.add('expanded');
  }
}

async function reparentTaskFolder(folderId, newParentId) {
  const folder = getTaskState().allFolders.find(f => String(f.id) === String(folderId));
  if (!folder) return;

  try {
    const response = await fetch(`/api/task-folders/${folderId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ name: folder.name, parent_id: newParentId })
    });

    const result = await response.json();
    if (result.success) {
      if (newParentId) getTaskState().expandedFolders.add(String(newParentId));
      loadTasks();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error moving folder:', error);
    app.notify('Error moving folder', 'danger');
  }
}

async function fileTaskIntoFolder(taskId, folderId) {
  const task = getTaskState().allTasks.find(t => String(t.id) === String(taskId));
  if (!task) return;

  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ title: task.title, notes: task.notes, folder_id: folderId })
    });

    const result = await response.json();
    if (result.success) {
      if (folderId) getTaskState().expandedFolders.add(String(folderId));
      loadTasks();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error filing task:', error);
    app.notify('Error filing task', 'danger');
  }
}

let taskFolderContextMenuId = null;

function showTaskFolderContextMenu(x, y, folderId) {
  taskFolderContextMenuId = folderId;
  const menu = document.getElementById('taskFolderContextMenu');
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.classList.remove('d-none');
}

function hideTaskFolderContextMenu() {
  taskFolderContextMenuId = null;
  document.getElementById('taskFolderContextMenu').classList.add('d-none');
}

function initTaskFolderContextMenu() {
  const menu = document.getElementById('taskFolderContextMenu');

  menu.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-menu-action]');
    if (!btn || !taskFolderContextMenuId) {
      hideTaskFolderContextMenu();
      return;
    }

    if (btn.dataset.menuAction === 'add-task') {
      const folderId = taskFolderContextMenuId;
      hideTaskFolderContextMenu();
      openNewTaskFormWithFolder(folderId);
      return;
    }

    hideTaskFolderContextMenu();
  });

  document.addEventListener('click', (e) => {
    if (!menu.classList.contains('d-none') && !menu.contains(e.target)) {
      hideTaskFolderContextMenu();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideTaskFolderContextMenu();
  });
}

function clearTaskDropTargets(container) {
  container.querySelectorAll('.task-drop-target').forEach(el => el.classList.remove('task-drop-target'));
  container.classList.remove('task-drop-target-root');
}

function initTasksEventListeners() {
  document.getElementById('addTaskBtn').addEventListener('click', () => openTaskForm());
  document.getElementById('saveTaskBtn').addEventListener('click', saveTask);
  document.getElementById('addTaskLinkBtn').addEventListener('click', () => addTaskLink(false));
  document.getElementById('addTaskFolderBtn').addEventListener('click', openNewTaskFolderForm);
  document.getElementById('saveTaskFolderBtn').addEventListener('click', saveTaskFolder);

  // Modal form link removal
  document.getElementById('taskModal').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn?.dataset.action === 'remove-link' && btn.closest('#taskLinksList')) {
      const links = Array.from(document.querySelectorAll('#taskLinksList a')).map(a => ({
        url: a.href,
        title: a.textContent
      }));
      links.splice(parseInt(btn.dataset.index), 1);
      renderTaskLinks(links);
    }
  });

  // Side-panel editor buttons
  const saveEditorBtn = document.getElementById('saveTaskEditorBtn');
  const closeEditorBtn = document.getElementById('closeTaskEditorBtn');
  const editorLinkBtn = document.getElementById('taskEditorAddLinkBtn');

  if (saveEditorBtn) {
    saveEditorBtn.addEventListener('click', async () => {
      await saveTask();
      closeTaskEditor();
    });
  }
  if (closeEditorBtn) {
    closeEditorBtn.addEventListener('click', closeTaskEditor);
  }
  if (editorLinkBtn) {
    editorLinkBtn.addEventListener('click', () => addTaskLink(true));
  }

  // Side-panel editor link removal
  const editorPane = document.getElementById('taskEditorPane');
  if (editorPane) {
    editorPane.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn?.dataset.action === 'remove-link' && btn.closest('#taskEditorLinksList')) {
        const links = Array.from(document.querySelectorAll('#taskEditorLinksList a')).map(a => ({
          url: a.href,
          title: a.textContent
        }));
        links.splice(parseInt(btn.dataset.index), 1);
        TaskEditor.renderLinks(links);
      }
    });
  }

  const container = document.getElementById('tasksList');

  app.bindInlineRename(container, '.task-row .task-title', async (newTitle, titleEl) => {
    const taskId = titleEl.closest('.task-row').dataset.taskId;
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
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
      loadTasks();
      return true;
    } catch (error) {
      console.error('Error renaming task:', error);
      app.notify('Error renaming task', 'danger');
      return false;
    }
  });

  app.bindInlineRename(container, '.task-folder-header .task-title', async (newName, titleEl) => {
    const folderId = titleEl.closest('.task-folder-node').dataset.folderId;
    return renameTaskFolder(folderId, newName);
  });

  // dragstart doesn't bubble, so we rely on setupDragListeners() to attach
  // handlers directly to individual items

  container.addEventListener('dragover', (e) => {
    const dragType = e.dataTransfer.getData('type');
    if (!dragType) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const folderHeader = e.target.closest('.task-folder-header');
    clearTaskDropTargets(container);
    if (folderHeader) {
      folderHeader.classList.add('task-drop-target');
    } else {
      container.classList.add('task-drop-target-root');
    }
  });

  container.addEventListener('drop', (e) => {
    e.preventDefault();
    clearTaskDropTargets(container);

    const type = e.dataTransfer.getData('type');
    const draggedId = e.dataTransfer.getData('id');
    if (!type || !draggedId) return;

    const folderHeader = e.target.closest('.task-folder-header');
    const targetFolderId = folderHeader ? folderHeader.closest('.task-folder-node').dataset.folderId : null;

    if (type === 'folder') {
      if (targetFolderId && String(targetFolderId) === String(draggedId)) return;
      reparentTaskFolder(draggedId, targetFolderId);
    } else if (type === 'task') {
      fileTaskIntoFolder(draggedId, targetFolderId);
    }
  });

  container.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      const action = actionBtn.dataset.action;
      const id = actionBtn.dataset.id;
      if (action === 'delete') deleteTask(id);
      else if (action === 'delete-folder') deleteTaskFolder(id);
      else if (action === 'toggle-expand') toggleTaskFolderNode(actionBtn.closest('.task-folder-node'));
      else if (action === 'toggle-complete') cycleTaskStatus(id, actionBtn.dataset.status);
      return;
    }

    // Single-click on task row to open editor
    const taskRow = e.target.closest('.task-row');
    if (taskRow && !e.target.closest('.task-actions') && taskRow.dataset.taskId) {
      openTaskForm(parseInt(taskRow.dataset.taskId));
      return;
    }

    // Single-click on folder header (but not if inside a task-row) - no-op for
    // now, matching how a plain click on a Todos-tab folder header opens its
    // editor; task folders don't have their own editor form, so this is
    // intentionally inert.
  });

  container.addEventListener('dblclick', (e) => {
    if (e.target.closest('[data-action]')) return;
    const taskRow = e.target.closest('.task-row');
    if (taskRow) {
      openTaskForm(parseInt(taskRow.dataset.taskId));
    }
  });

  container.addEventListener('contextmenu', (e) => {
    const folderHeader = e.target.closest('.task-folder-header');
    if (folderHeader) {
      e.preventDefault();
      showTaskFolderContextMenu(e.clientX, e.clientY, folderHeader.closest('.task-folder-node').dataset.folderId);
    }
  });

  initTaskFolderContextMenu();
}

function initTasks() {
  // #taskModal can be opened from other tabs. Left inside the #tab-tasks pane,
  // it's a descendant of a display:none ancestor whenever that tab isn't
  // active, so Bootstrap's backdrop would show but the dialog itself never
  // could - move it to the body so it always renders.
  const modal = document.getElementById('taskModal');
  if (modal && modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }

  // Initialize split pane for side-panel editing
  window.taskSplitPane = new SplitPane('taskSplitPane', 'taskListPane', 'taskDivider', 'taskEditorPane', 66.66);
  TaskEditor.init(window.taskSplitPane);

  initTasksEventListeners();
  loadTasks();
}

// Only initialize once
if (!window.tasksInitialized) {
  window.tasksInitialized = true;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTasks);
  } else {
    initTasks();
  }
}
