// Store state on window to survive multiple script loads
if (!window.taskState) {
  window.taskState = {
    expandedTasks: new Set(),
    allTasks: [],
    draggedTaskId: null
  };
}

function getTaskState() {
  return window.taskState;
}

// Compute aggregated status for a task based on its children
function computeTaskStatus(task, taskMap, visited = new Set(), depth = 0) {
  const MAX_DEPTH = 100;
  if (depth > MAX_DEPTH) return task.status;

  const taskId = String(task.id);
  if (visited.has(taskId)) return task.status;
  visited.add(taskId);

  const children = (taskMap[task.id] || []);
  if (children.length === 0) return task.status;

  const statuses = [task.status, ...children.map(child => computeTaskStatus(child, taskMap, visited, depth + 1))];
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

function renderTaskRow(task, depth, childrenMap, statusMap, visited = new Set()) {
  const MAX_DEPTH = 100;
  if (depth > MAX_DEPTH) return '';

  const taskId = String(task.id);
  if (visited.has(taskId)) return '';
  visited.add(taskId);

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
        ${children.map(c => renderTaskRow(c, depth + 1, childrenMap, statusMap, visited)).join('')}
      </div>`
    : '';

  return `
    <div class="task-node ${isExpanded ? 'expanded' : ''}" data-task-id="${task.id}">
      <div class="task-row" data-task-id="${task.id}" data-type="task" data-id="${task.id}" data-name="${app.escapeHtml(task.title)}" draggable="true" style="cursor: grab;">
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

  // Event listeners stay attached to the container even after innerHTML changes
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

function collectTaskRecurrenceFromModal() {
  const enabled = document.getElementById('taskRecurrenceEnabled').checked;
  if (!enabled) return null;

  const typeRadio = document.querySelector('input[name="taskRecurrenceType"]:checked');
  const type = typeRadio?.value || 'daily';
  const recurrence = { enabled: true, type };

  if (type === 'weekly') {
    const daysOfWeek = [];
    for (let i = 0; i < 7; i++) {
      const checkbox = document.getElementById(`taskWeekDay${i}`);
      if (checkbox && checkbox.checked) daysOfWeek.push(i);
    }
    if (daysOfWeek.length === 0) {
      app.notify('Select at least one day for weekly recurrence', 'warning');
      return null;
    }
    recurrence.daysOfWeek = daysOfWeek;
  }

  if (type === 'monthly') {
    const monthlyType = document.querySelector('input[name="taskMonthlyType"]:checked').value;
    if (monthlyType === 'date') {
      const date = parseInt(document.getElementById('taskMonthlyDateInput').value);
      if (!date || date < 1 || date > 31) {
        app.notify('Enter a valid date (1-31)', 'warning');
        return null;
      }
      recurrence.dateOfMonth = date;
    } else if (monthlyType === 'weekday') {
      recurrence.weekday = parseInt(document.getElementById('taskMonthlyWeekdaySelect').value);
      recurrence.weekOfMonth = parseInt(document.getElementById('taskMonthlyWeekofmonthSelect').value);
    } else if (monthlyType === 'lastday') {
      recurrence.lastDay = true;
    }
  }

  if (type === 'interval') {
    const days = parseInt(document.getElementById('taskIntervalDays').value);
    if (!days || days < 1) {
      app.notify('Enter a valid interval (at least 1 day)', 'warning');
      return null;
    }
    recurrence.intervalDays = days;

    // Handle day filters
    const weekdays = document.getElementById('taskIntervalFilterWeekdays').checked;
    const weekends = document.getElementById('taskIntervalFilterWeekends').checked;

    if (weekdays && weekends) {
      // Both selected = all days, don't restrict
    } else if (weekdays) {
      recurrence.allowedDaysOfWeek = [1, 2, 3, 4, 5]; // Mon-Fri
    } else if (weekends) {
      recurrence.allowedDaysOfWeek = [0, 6]; // Sun, Sat
    } else {
      // Check specific days
      const daysOfWeek = [];
      for (let i = 0; i < 7; i++) {
        const checkbox = document.getElementById(`taskIntervalWeekDay${i}`);
        if (checkbox && checkbox.checked) daysOfWeek.push(i);
      }
      if (daysOfWeek.length > 0 && daysOfWeek.length < 7) {
        recurrence.allowedDaysOfWeek = daysOfWeek;
      }
    }
  }

  const startDate = document.getElementById('taskRecurrenceStartDate').value;
  if (startDate) recurrence.startDate = startDate;

  const endDate = document.getElementById('taskRecurrenceEndDate').value;
  if (endDate) recurrence.endDate = endDate;

  return recurrence;
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

  const recurrence = collectTaskRecurrenceFromModal();
  if (document.getElementById('taskRecurrenceEnabled').checked && recurrence === null) {
    return;
  }
  if (recurrence) {
    data.recurrence = recurrence;
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
      const modalElement = document.getElementById('taskModal');
      const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
      modal.hide();
      // Wait for the modal hide transition, with timeout fallback
      await Promise.race([
        new Promise(resolve => {
          const onHidden = () => {
            modalElement.removeEventListener('hidden.bs.modal', onHidden);
            resolve();
          };
          modalElement.addEventListener('hidden.bs.modal', onHidden);
        }),
        new Promise(resolve => setTimeout(resolve, 500))
      ]);
      // Force remove any lingering backdrop
      document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
      document.body.style.overflow = '';
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
  // Check if this task has children
  const childrenMap = buildTaskChildrenMap(getTaskState().allTasks);
  const children = childrenMap[taskId] || [];

  let message = 'Delete this task?';
  if (children.length > 0) {
    message = `Delete this task? It has ${children.length} child item${children.length !== 1 ? 's' : ''} that will also be deleted.`;
  }

  if (!await app.confirm(message)) return;

  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Task deleted', 'success');
      TaskEditor.close();
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

function setupDragListeners() {
  const container = document.getElementById('tasksList');
  if (!container) return;

  // Clear existing listeners by cloning and replacing
  const newContainer = container.cloneNode(false);
  container.parentNode.replaceChild(newContainer, container);

  newContainer.addEventListener('dragstart', (e) => {
    const row = e.target.closest('.task-row');
    if (!row) return;

    const taskId = row.getAttribute('data-task-id');
    const name = row.getAttribute('data-name');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({ taskId, name }));
    row.style.opacity = '0.5';
  });

  newContainer.addEventListener('dragend', (e) => {
    const row = e.target.closest('.task-row');
    if (row) row.style.opacity = '1';
  });

  newContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const row = e.target.closest('.task-row');
    if (row) {
      row.classList.add('task-drop-target');
    }
  });

  newContainer.addEventListener('dragleave', (e) => {
    const row = e.target.closest('.task-row');
    if (row && !e.relatedTarget?.closest('.task-row[data-task-id="' + row.getAttribute('data-task-id') + '"]')) {
      row.classList.remove('task-drop-target');
    }
  });

  newContainer.addEventListener('drop', async (e) => {
    e.preventDefault();
    document.querySelectorAll('.task-row').forEach(r => r.classList.remove('task-drop-target'));

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      const taskId = data.taskId;
      const dropTarget = e.target.closest('.task-row');

      if (dropTarget) {
        const parentId = dropTarget.getAttribute('data-task-id');
        if (Number(parentId) !== Number(taskId)) {
          await updateTaskParent(taskId, parentId);
        }
      } else {
        await updateTaskParent(taskId, null);
      }
    } catch (error) {
      console.error('Error handling drop:', error);
    }
  });

  // Toggle expand/collapse
  newContainer.addEventListener('click', (e) => {
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
      e.stopPropagation();
    }
  });

  // Status toggle
  newContainer.addEventListener('click', (e) => {
    if (e.target.closest('.todo-item-checkbox[data-action="toggle-complete"]')) {
      const btn = e.target.closest('.todo-item-checkbox[data-action="toggle-complete"]');
      const taskId = btn.getAttribute('data-id');
      const status = btn.getAttribute('data-status');
      cycleTaskStatus(taskId, status);
      e.stopPropagation();
    }
  });

  // Delete
  newContainer.addEventListener('click', (e) => {
    if (e.target.closest('button[data-action="delete"]')) {
      const btn = e.target.closest('button[data-action="delete"]');
      const taskId = btn.getAttribute('data-id');
      deleteTask(taskId);
      e.stopPropagation();
    }
  });

  // Edit - open editor on row click (except for interactive elements)
  newContainer.addEventListener('click', (e) => {
    const row = e.target.closest('.task-row');
    if (!row) return;

    // Don't open editor if clicking on interactive elements
    const isInteractive = e.target.closest('[data-action]') ||
                         e.target.closest('button') ||
                         e.target.closest('.task-checkbox');

    if (!isInteractive) {
      const taskId = row.getAttribute('data-task-id');
      openTaskForm(taskId);
      e.stopPropagation();
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
function initializeTasksTab() {
  // Initialize SplitPane for editor
  window.taskSplitPane = new SplitPane('taskSplitPane', 'taskListPane', 'taskDivider', 'taskEditorPane', 66.66);

  // Initialize TaskEditor
  TaskEditor.init(window.taskSplitPane);

  // Set up event listeners ONCE on the container
  // These persist even when innerHTML changes due to event delegation
  setupDragListeners();

  loadTasks();

  const expandAllBtn = document.getElementById('expandAllTasksBtn');
  if (expandAllBtn) {
    expandAllBtn.addEventListener('click', () => {
      getTaskState().allTasks.forEach(task => {
        getTaskState().expandedTasks.add(String(task.id));
      });
      renderTasksList();
    });
  }

  const collapseAllBtn = document.getElementById('collapseAllTasksBtn');
  if (collapseAllBtn) {
    collapseAllBtn.addEventListener('click', () => {
      getTaskState().expandedTasks.clear();
      renderTasksList();
    });
  }

  const addBtn = document.getElementById('addTaskBtn');
  if (addBtn) {
    addBtn.addEventListener('click', openNewTaskForm);
  }

  const saveBtn = document.getElementById('saveTaskBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveTask);
  }

  // Set up recurrence UI listeners for modal
  const taskRecurrenceEnabled = document.getElementById('taskRecurrenceEnabled');
  if (taskRecurrenceEnabled) {
    taskRecurrenceEnabled.addEventListener('change', () => {
      const panel = document.getElementById('taskRecurrencePanel');
      if (panel) {
        panel.style.display = taskRecurrenceEnabled.checked ? 'block' : 'none';
      }
    });
  }

  document.querySelectorAll('input[name="taskRecurrenceType"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const type = radio.value;
      document.getElementById('taskWeeklyConfig').style.display = type === 'weekly' ? 'block' : 'none';
      document.getElementById('taskMonthlyConfig').style.display = type === 'monthly' ? 'block' : 'none';
      document.getElementById('taskIntervalConfig').style.display = type === 'interval' ? 'block' : 'none';
    });
  });

  // Handle interval day filter shortcuts for modal
  const taskWeekdaysCheckbox = document.getElementById('taskIntervalFilterWeekdays');
  const taskWeekendsCheckbox = document.getElementById('taskIntervalFilterWeekends');

  if (taskWeekdaysCheckbox) {
    taskWeekdaysCheckbox.addEventListener('change', () => {
      if (taskWeekdaysCheckbox.checked) {
        taskWeekendsCheckbox.checked = false;
        for (let i = 0; i < 7; i++) {
          const checkbox = document.getElementById(`taskIntervalWeekDay${i}`);
          if (checkbox) checkbox.checked = false;
        }
      }
    });
  }

  if (taskWeekendsCheckbox) {
    taskWeekendsCheckbox.addEventListener('change', () => {
      if (taskWeekendsCheckbox.checked) {
        taskWeekdaysCheckbox.checked = false;
        for (let i = 0; i < 7; i++) {
          const checkbox = document.getElementById(`taskIntervalWeekDay${i}`);
          if (checkbox) checkbox.checked = false;
        }
      }
    });
  }

  for (let i = 0; i < 7; i++) {
    const checkbox = document.getElementById(`taskIntervalWeekDay${i}`);
    if (checkbox) {
      checkbox.addEventListener('change', () => {
        taskWeekdaysCheckbox.checked = false;
        taskWeekendsCheckbox.checked = false;
      });
    }
  }

  // Wire up editor pane buttons
  const saveEditorBtn = document.getElementById('saveTaskEditorBtn');
  if (saveEditorBtn) {
    saveEditorBtn.addEventListener('click', async () => {
      if (await TaskEditor.save()) {
        TaskEditor.close();
        loadTasks();
      }
    });
  }

  const closeEditorBtn = document.getElementById('closeTaskEditorBtn');
  if (closeEditorBtn) {
    closeEditorBtn.addEventListener('click', () => {
      TaskEditor.close();
    });
  }

  // Wire up delete button in editor pane if it exists
  const deleteEditorBtn = document.getElementById('deleteTaskEditorBtn');
  if (deleteEditorBtn) {
    deleteEditorBtn.addEventListener('click', async () => {
      const taskId = document.getElementById('taskEditorId').value;
      if (taskId) {
        await deleteTask(taskId);
      }
    });
  }
}

// If DOM is already loaded, initialize immediately; otherwise wait
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeTasksTab);
} else {
  initializeTasksTab();
}
