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
  if (taskId) {
    const task = allTasks.find(t => t.id === taskId);
    if (task) {
      document.getElementById('taskId').value = task.id;
      document.getElementById('taskTitle').value = task.title;
      document.getElementById('taskNotes').value = task.notes || '';
      renderTaskLinks(task.links || []);
    }
  } else {
    document.getElementById('taskId').value = '';
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskNotes').value = '';
    renderTaskLinks([]);
  }

  const modal = new bootstrap.Modal(document.getElementById('taskModal'));
  modal.show();
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
  const title = document.getElementById('taskTitle').value;
  const notes = document.getElementById('taskNotes').value;

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

function addTaskLink() {
  const url = document.getElementById('taskLinkUrl').value.trim();
  const title = document.getElementById('taskLinkTitle').value.trim();

  if (!url) {
    app.notify('URL is required', 'warning');
    return;
  }

  const currentLinks = Array.from(document.querySelectorAll('#taskLinksList a')).map(a => ({
    url: a.href,
    title: a.textContent
  }));

  currentLinks.push({ url, title: title || url });
  renderTaskLinks(currentLinks);

  document.getElementById('taskLinkUrl').value = '';
  document.getElementById('taskLinkTitle').value = '';
}

function initTasksEventListeners() {
  document.getElementById('addTaskBtn')?.addEventListener('click', () => openTaskForm());
  document.getElementById('saveTaskBtn')?.addEventListener('click', saveTask);
  document.getElementById('addTaskLinkBtn')?.addEventListener('click', addTaskLink);

  document.getElementById('tasksList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'edit') openTaskForm(parseInt(btn.dataset.id));
    else if (btn.dataset.action === 'delete') deleteTask(parseInt(btn.dataset.id));
    else if (btn.dataset.action === 'remove-link') {
      const links = Array.from(document.querySelectorAll('#taskLinksList a')).map(a => ({
        url: a.href,
        title: a.textContent
      }));
      links.splice(parseInt(btn.dataset.index), 1);
      renderTaskLinks(links);
    }
  });
}

function initTasks() {
  initTasksEventListeners();
  loadTasks();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTasks);
} else {
  initTasks();
}
