let allTasks = [];

async function loadTasks() {
  const tasksList = document.getElementById('tasksList');
  tasksList.innerHTML = '<p class="text-center text-muted">Loading...</p>';

  try {
    const response = await fetch('/api/tasks');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();

    if (result.success && result.data.length > 0) {
      allTasks = result.data;
      renderTasks();
    } else {
      tasksList.innerHTML = '<p class="text-center text-muted">No tasks yet</p>';
    }
  } catch (error) {
    console.error('Error loading tasks:', error);
    tasksList.innerHTML = '<p class="text-center text-danger">Error loading tasks</p>';
  }
}

function renderTasks() {
  const tasksList = document.getElementById('tasksList');
  tasksList.innerHTML = '';

  allTasks.forEach(task => {
    const taskRow = document.createElement('div');
    taskRow.className = 'task-row';
    taskRow.innerHTML = `
      <div class="task-name-cell">
        <span class="task-title">${app.escapeHtml(task.title)}</span>
      </div>
      <div class="text-muted small">${app.escapeHtml(task.notes || '')}</div>
      <div class="task-actions">
        <button class="btn btn-sm btn-info" data-action="edit" data-id="${task.id}" title="Edit" aria-label="Edit"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-danger" data-action="delete" data-id="${task.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
      </div>
    `;
    tasksList.appendChild(taskRow);
  });
}

async function openTaskForm(taskId = null) {
  // Check if split-pane exists
  const editorPane = document.getElementById('taskEditorPane');
  const useSplitPane = editorPane && window.taskSplitPane;

  if (taskId) {
    const task = allTasks.find(t => t.id === taskId);
    if (task) {
      if (useSplitPane) {
        // Populate split-pane editor fields
        document.getElementById('taskEditorId').value = task.id;
        document.getElementById('taskEditorFormTitle').value = task.title;
        document.getElementById('taskEditorNotes').value = task.notes || '';
        renderTaskLinksEditor(task.links || []);

        // Show split-pane editor
        editorPane.classList.remove('hidden');
        document.getElementById('taskEditorTitle').textContent = task.title;
      } else {
        // Populate modal form fields
        document.getElementById('taskId').value = task.id;
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskNotes').value = task.notes || '';
        renderTaskLinks(task.links || []);
      }
    }
  } else {
    if (useSplitPane) {
      document.getElementById('taskEditorId').value = '';
      document.getElementById('taskEditorFormTitle').value = '';
      document.getElementById('taskEditorNotes').value = '';
      renderTaskLinksEditor([]);
    } else {
      document.getElementById('taskId').value = '';
      document.getElementById('taskTitle').value = '';
      document.getElementById('taskNotes').value = '';
      renderTaskLinks([]);
    }
  }

  // Only show modal if split-pane doesn't exist
  if (!useSplitPane) {
    const modal = new bootstrap.Modal(document.getElementById('taskModal'));
    modal.show();
  }
}

function closeTaskEditor() {
  const editorPane = document.getElementById('taskEditorPane');
  if (editorPane) {
    editorPane.classList.add('hidden');
  }
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
  // Check which form is being used
  const editorPane = document.getElementById('taskEditorPane');
  const useSplitPane = editorPane && !editorPane.classList.contains('hidden');

  let taskId, title, notes;
  if (useSplitPane) {
    taskId = document.getElementById('taskEditorId').value;
    title = document.getElementById('taskEditorFormTitle').value;
    notes = document.getElementById('taskEditorNotes').value;
  } else {
    taskId = document.getElementById('taskId').value;
    title = document.getElementById('taskTitle').value;
    notes = document.getElementById('taskNotes').value;
  }

  if (!title.trim()) {
    app.notify('Title is required', 'warning');
    return;
  }

  const taskData = {
    title,
    notes
  };

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
    renderTaskLinksEditor(currentLinks);
  } else {
    renderTaskLinks(currentLinks);
  }

  document.getElementById(`${prefix}LinkUrl`).value = '';
  document.getElementById(`${prefix}LinkTitle`).value = '';
}

function initTasksEventListeners() {
  document.getElementById('addTaskBtn')?.addEventListener('click', () => openTaskForm());
  document.getElementById('saveTaskBtn')?.addEventListener('click', saveTask);
  document.getElementById('addTaskLinkBtn')?.addEventListener('click', () => addTaskLink(false));

  // Modal form link removal
  document.getElementById('tasksList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'edit') openTaskForm(parseInt(btn.dataset.id));
    else if (btn.dataset.action === 'delete') deleteTask(parseInt(btn.dataset.id));
    else if (btn.dataset.action === 'remove-link' && btn.closest('#taskLinksList')) {
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
      loadTasks();
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
        renderTaskLinksEditor(links);
      }
    });
  }
}

function initTasks() {
  // Initialize split pane for side-panel editing
  if (document.getElementById('taskSplitPane')) {
    window.taskSplitPane = new SplitPane('taskSplitPane', 'taskListPane', 'taskDivider', 'taskEditorPane', 66.66);
  }

  initTasksEventListeners();
  loadTasks();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTasks);
} else {
  initTasks();
}
