// Store state on window to survive multiple script loads
if (!window.taskState) {
  window.taskState = {
    expandedTasks: new Set(),
    allTasks: []
  };
}

function getTaskState() {
  return window.taskState;
}

// Compute aggregated status for a task based on its children
function computeTaskStatus(task, taskMap) {
  const children = (taskMap[task.id] || []);
  if (children.length === 0) return task.status;

  const statuses = [task.status, ...children.map(child => computeTaskStatus(child, taskMap))];
  if (statuses.includes('failed')) return 'failed';
  if (statuses.includes('incomplete')) return 'incomplete';
  if (statuses.includes('skipped')) return 'skipped';
  return 'complete';
}

// Build a map of parent_id -> [children]
function buildTaskChildrenMap(tasks) {
  const map = {};
  tasks.forEach(t => {
    if (!map[t.id]) map[t.id] = [];
  });
  tasks.forEach(t => {
    if (t.parent_id) {
      if (!map[t.parent_id]) map[t.parent_id] = [];
      map[t.parent_id].push(t);
    }
  });
  return map;
}

// Get all root-level tasks (those with no parent)
function getRootTasks(tasks) {
  return tasks.filter(t => !t.parent_id);
}

function renderTaskRow(task, depth, childrenMap, statusMap) {
  const children = childrenMap[task.id] || [];
  const hasChildren = children.length > 0;
  const isExpanded = getTaskState().expandedTasks.has(String(task.id));
  const displayStatus = statusMap[task.id] || task.status;
  const hasLinks = task.links && task.links.length > 0;
  const linksBadge = hasLinks
    ? `<span class="badge bg-info text-white" title="Has links">🔗</span>`
    : '';
  const statusIcon = app.statusIcon(displayStatus);
  const statusLabel = displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1);

  const childrenHtml = hasChildren && isExpanded
    ? `<div class="task-node-children">
        ${children.map(c => renderTaskRow(c, depth + 1, childrenMap, statusMap)).join('')}
      </div>`
    : '';

  return `
    <div class="task-node ${isExpanded ? 'expanded' : ''}" data-task-id="${task.id}">
      <div class="task-row" data-type="task" data-id="${task.id}" data-name="${app.escapeHtml(task.title)}" draggable="true">
        <span class="task-name-cell">
          <span style="display:inline-block; width: ${depth * 18}px; flex: none;"></span>
          ${hasChildren
            ? '<i class="bi bi-chevron-right task-folder-toggle" data-action="toggle-expand"></i>'
            : '<span class="task-folder-toggle"></span>'}
          <button type="button" class="todo-item-checkbox ${displayStatus !== 'incomplete' ? 'status-' + displayStatus : ''}" data-action="toggle-complete" data-id="${task.id}" data-status="${task.status}" title="${statusLabel} — click to change" aria-label="${statusLabel} — click to change">
            ${statusIcon ? `<i class="bi ${statusIcon}"></i>` : ''}
          </button>
          <span class="task-title" ${task.status === 'complete' ? 'style="text-decoration: line-through; opacity: 0.6;"' : ''}>${app.escapeHtml(task.title)}</span>
          ${linksBadge}
        </span>
        <span class="task-notes text-muted">${app.escapeHtml(task.notes) || '-'}</span>
        <span class="task-actions">
          <button class="btn btn-sm btn-danger" data-action="delete" data-id="${task.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
        </span>
      </div>
      ${childrenHtml}
    </div>
  `;
}

function renderTasksList() {
  const container = document.getElementById('tasksList');

  if (getTaskState().allTasks.length === 0) {
    container.innerHTML = '<p class="text-center text-muted">No tasks yet</p>';
    return;
  }

  const childrenMap = buildTaskChildrenMap(getTaskState().allTasks);
  const rootTasks = getRootTasks(getTaskState().allTasks);

  // Compute status map for all tasks
  const statusMap = {};
  getTaskState().allTasks.forEach(task => {
    statusMap[task.id] = computeTaskStatus(task, childrenMap);
  });

  container.innerHTML = rootTasks
    .map(t => renderTaskRow(t, 0, childrenMap, statusMap))
    .join('');

  setupDragListeners();
  window.allTasks = getTaskState().allTasks;
}

async function loadTasks() {
  const container = document.getElementById('tasksList');
  container.innerHTML = '<p class="text-center text-muted">Loading...</p>';

  try {
    const response = await fetch('/api/tasks');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();

    if (result.success) {
      getTaskState().allTasks = result.data || [];
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
  openNewTaskForm();
}

function openNewTaskForm() {
  const form = document.getElementById('taskForm');
  document.getElementById('taskId').value = '';
  form.reset();
  renderTaskLinks([]);

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
  const taskId = document.getElementById('taskId').value;

  const data = {
    title: document.getElementById('taskTitle').value,
    notes: document.getElementById('taskNotes').value
  };

  if (!data.title.trim()) {
    app.notify('Task title is required', 'danger');
    return;
  }

  try {
    const url = taskId ? `/api/tasks/${taskId}` : '/api/tasks';
    const method = taskId ? 'PUT' : 'POST';

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
      app.notify('Task saved!', 'success');
      bootstrap.Modal.getInstance(document.getElementById('taskModal')).hide();
      loadTasks();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error saving task', 'danger');
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

async function saveTaskEditor() {
  const taskId = document.getElementById('taskEditorId').value;

  const data = {
    title: document.getElementById('taskEditorFormTitle').value,
    notes: document.getElementById('taskEditorNotes').value
  };

  try {
    const url = taskId ? `/api/tasks/${taskId}` : '/api/tasks';
    const method = taskId ? 'PUT' : 'POST';

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
      app.notify('Task saved!', 'success');
      loadTasks();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error saving task', 'danger');
  }
}

function setupDragListeners() {
  const container = document.getElementById('tasksList');

  container.addEventListener('dragstart', (e) => {
    const row = e.target.closest('.task-row');
    if (!row) return;

    const taskId = row.getAttribute('data-id');
    const name = row.getAttribute('data-name');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${taskId}|${name}`);
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const row = e.target.closest('.task-row');
    if (row) {
      row.classList.add('task-drop-target');
    } else if (e.target === container || e.target.closest('#tasksList')) {
      container.classList.add('task-drop-target-root');
    }
  });

  container.addEventListener('dragleave', (e) => {
    if (!e.relatedTarget?.closest('.task-row')) {
      document.querySelectorAll('.task-row').forEach(r => r.classList.remove('task-drop-target'));
    }
    if (!e.relatedTarget?.closest('#tasksList')) {
      container.classList.remove('task-drop-target-root');
    }
  });

  container.addEventListener('drop', async (e) => {
    e.preventDefault();
    container.classList.remove('task-drop-target-root');
    document.querySelectorAll('.task-row').forEach(r => r.classList.remove('task-drop-target'));

    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;

    const [taskId] = data.split('|');
    const dropTarget = e.target.closest('.task-row');

    if (dropTarget) {
      const parentId = dropTarget.getAttribute('data-id');
      if (Number(parentId) === Number(taskId)) return;

      await updateTaskParent(taskId, parentId);
    } else {
      await updateTaskParent(taskId, null);
    }
  });

  // Toggle expand/collapse
  container.addEventListener('click', (e) => {
    if (e.target.classList.contains('task-folder-toggle')) {
      const row = e.target.closest('.task-row');
      const node = row?.closest('.task-node');
      if (node) {
        const taskId = node.getAttribute('data-task-id');
        if (getTaskState().expandedTasks.has(taskId)) {
          getTaskState().expandedTasks.delete(taskId);
        } else {
          getTaskState().expandedTasks.add(taskId);
        }
        renderTasksList();
      }
    }
  });

  // Status toggle
  container.addEventListener('click', (e) => {
    if (e.target.closest('.todo-item-checkbox[data-action="toggle-complete"]')) {
      const btn = e.target.closest('.todo-item-checkbox[data-action="toggle-complete"]');
      const taskId = btn.getAttribute('data-id');
      const status = btn.getAttribute('data-status');
      cycleTaskStatus(taskId, status);
    }
  });

  // Delete
  container.addEventListener('click', (e) => {
    if (e.target.closest('button[data-action="delete"]')) {
      const btn = e.target.closest('button[data-action="delete"]');
      const taskId = btn.getAttribute('data-id');
      deleteTask(taskId);
    }
  });

  // Edit
  container.addEventListener('click', (e) => {
    if (e.target.closest('.task-title')) {
      const row = e.target.closest('.task-row');
      const taskId = row.getAttribute('data-id');
      openTaskForm(taskId);
    }
  });
}

async function updateTaskParent(taskId, parentId) {
  const data = { parent_id: parentId };

  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (result.success) {
      loadTasks();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error updating task', 'danger');
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Initialize split-pane if it exists
  const splitPaneContainer = document.getElementById('taskSplitPane');
  const editorPane = document.getElementById('taskEditorPane');
  if (splitPaneContainer && editorPane) {
    window.taskSplitPane = new SplitPane(
      document.getElementById('taskListPane'),
      editorPane,
      document.getElementById('taskDivider')
    );
    TaskEditor.init(window.taskSplitPane, 'taskEditorForm');
    editorPane.classList.add('hidden');
  }

  loadTasks();

  const addBtn = document.getElementById('addTaskBtn');
  if (addBtn) {
    addBtn.addEventListener('click', openNewTaskForm);
  }

  const saveBtn = document.getElementById('saveTaskBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveTask);
  }

  const saveEditorBtn = document.getElementById('saveTaskEditorBtn');
  if (saveEditorBtn) {
    saveEditorBtn.addEventListener('click', saveTaskEditor);
  }

  const closeEditorBtn = document.getElementById('closeTaskEditorBtn');
  if (closeEditorBtn) {
    closeEditorBtn.addEventListener('click', closeTaskEditor);
  }
});
