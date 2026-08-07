async function loadYears() {
  const select = document.getElementById('yearSelect');
  const previousValue = select.value || String(window.APP_CONFIG?.currentYear || new Date().getFullYear());

  try {
    const response = await fetch('/api/years');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    const years = (result.success && result.data.length > 0) ? result.data.map(y => y.year) : [];

    select.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');

    if (years.includes(parseInt(previousValue, 10))) {
      select.value = previousValue;
    } else if (years.length > 0) {
      select.value = years[years.length - 1];
    }
  } catch (error) {
    console.error('Error loading years:', error);
  }
}

function openNewYearForm() {
  document.getElementById('yearForm').reset();
}

async function saveYear() {
  const yearInput = document.getElementById('newYear');
  const year = parseInt(yearInput.value, 10);

  if (!year) {
    app.notify('Enter a valid year', 'warning');
    return;
  }

  try {
    const response = await fetch('/api/years', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ year })
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Year added!', 'success');
      bootstrap.Modal.getInstance(document.getElementById('yearModal')).hide();
      await loadYears();
      document.getElementById('yearSelect').value = String(year);
      loadYearlyGoals();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error adding year', 'danger');
  }
}

let currentGoals = [];

async function loadYearlyGoals() {
  const select = document.getElementById('yearSelect');

  // If years haven't been loaded yet, load them first
  if (select.options.length === 0) {
    await loadYears();
  }

  const year = select.value;
  const tbody = document.getElementById('goalsTableBody');

  tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Loading...</td></tr>';

  try {
    const response = await fetch(`/api/goals/year/${year}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();

    if (result.success && result.data.length > 0) {
      currentGoals = result.data;
      tbody.innerHTML = currentGoals.map(goal => `
        <tr draggable="true" data-goal-id="${goal.id}">
          <td><i class="bi ${APP_ICONS.goal} text-muted"></i> <span class="goal-name">${app.escapeHtml(goal.name)}</span></td>
          <td>${(goal.categories || []).map(c => app.escapeHtml(c.name)).join(', ') || '-'}</td>
          <td><span class="badge bg-${goal.status === 'Complete' ? 'success' : goal.status === 'In Progress' ? 'warning' : 'secondary'} goal-status-badge" data-action="cycle-status" data-id="${goal.id}" title="Click to change status">${goal.status}</span></td>
          <td>${goal.due_date || '-'}</td>
          <td>
            <button class="btn btn-sm btn-info" data-action="edit" data-id="${goal.id}" title="Edit" aria-label="Edit"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-danger" data-action="delete" data-id="${goal.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
          </td>
        </tr>
      `).join('');
    } else {
      currentGoals = [];
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No goals for ' + year + '</td></tr>';
    }
  } catch (error) {
    console.error('Error loading goals:', error);
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading goals</td></tr>';
  }
}

const GOAL_STATUS_CYCLE = ['Not Started', 'In Progress', 'Complete'];

async function cycleGoalStatus(goalId, currentStatus) {
  const currentIndex = GOAL_STATUS_CYCLE.indexOf(currentStatus);
  const nextStatus = GOAL_STATUS_CYCLE[(currentIndex + 1) % GOAL_STATUS_CYCLE.length];

  try {
    const response = await fetch(`/api/goals/${goalId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ status: nextStatus })
    });
    const result = await response.json();
    if (result.success) {
      loadYearlyGoals();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error updating goal status:', error);
    app.notify('Error updating goal status', 'danger');
  }
}

async function reorderGoalsOnDrop(draggedId, targetId, position) {
  const ids = currentGoals.map(g => String(g.id));
  const fromIndex = ids.indexOf(String(draggedId));
  if (fromIndex === -1) return;
  ids.splice(fromIndex, 1);

  let toIndex = targetId ? ids.indexOf(String(targetId)) : -1;
  if (toIndex === -1) {
    toIndex = ids.length;
  } else if (position === 'after') {
    toIndex += 1;
  }
  ids.splice(toIndex, 0, String(draggedId));

  try {
    const response = await fetch('/api/goals/reorder', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ orderedIds: ids })
    });
    const result = await response.json();
    if (result.success) {
      loadYearlyGoals();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error reordering goals:', error);
    app.notify('Error reordering goals', 'danger');
  }
}

async function loadGoalCategoryOptions() {
  const select = document.getElementById('goalCategories');

  try {
    const response = await fetch('/api/goals/categories/all');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    const categories = (result.success && result.data) || [];

    select.innerHTML = categories.map(c => `<option value="${c.id}">${app.escapeHtml(c.name)}</option>`).join('');
  } catch (error) {
    console.error('Error loading categories:', error);
  }
}

function selectGoalCategories(categories) {
  const ids = new Set((categories || []).map(c => String(c.id)));
  Array.from(document.getElementById('goalCategories').options).forEach(opt => {
    opt.selected = ids.has(opt.value);
  });
}

function openNewGoalForm() {
  document.getElementById('goalId').value = '';
  document.getElementById('goalForm').reset();
  selectGoalCategories([]);
}

async function saveGoal() {
  const goalId = document.getElementById('goalId').value;
  const year = document.getElementById('yearSelect').value;

  const data = {
    year: parseInt(year),
    name: document.getElementById('goalName').value,
    description: document.getElementById('goalDescription').value,
    measurements: document.getElementById('goalMeasurements').value,
    goal_updates: document.getElementById('goalUpdates').value,
    status: document.getElementById('goalStatus').value,
    due_date: document.getElementById('goalDueDate').value,
    categories: Array.from(document.getElementById('goalCategories').selectedOptions).map(opt => opt.value)
  };

  try {
    const url = goalId ? `/api/goals/${goalId}` : '/api/goals';
    const method = goalId ? 'PUT' : 'POST';

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
      app.notify('Goal saved!', 'success');
      const modal = bootstrap.Modal.getInstance(document.getElementById('goalModal'));
      if (modal) {
        modal.hide();
      } else {
        document.getElementById('goalModal').classList.remove('show');
        document.getElementById('goalModal').style.display = 'none';
        document.body.classList.remove('modal-open');
      }
      loadYearlyGoals();
    } else {
      app.notify('Error saving goal: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error saving goal', 'danger');
  }
}

async function editGoal(goalId) {
  try {
    const response = await fetch(`/api/goals/${goalId}`);
    const result = await response.json();
    const goal = result.data;

    document.getElementById('goalId').value = goal.id;
    document.getElementById('goalName').value = goal.name;
    document.getElementById('goalDescription').value = goal.description;
    document.getElementById('goalMeasurements').value = goal.measurements;
    document.getElementById('goalUpdates').value = goal.goal_updates;
    document.getElementById('goalStatus').value = goal.status;
    document.getElementById('goalDueDate').value = goal.due_date;
    selectGoalCategories(goal.categories);

    const modal = new bootstrap.Modal(document.getElementById('goalModal'));
    modal.show();
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error loading goal', 'danger');
  }
}

async function deleteGoal(goalId) {
  if (!await app.confirm('Are you sure you want to delete this goal?')) return;

  try {
    const response = await fetch(`/api/goals/${goalId}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Goal deleted', 'success');
      loadYearlyGoals();
    } else {
      app.notify('Error deleting goal', 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error deleting goal', 'danger');
  }
}

function initGoalsEventListeners() {
  document.getElementById('yearSelect').addEventListener('change', loadYearlyGoals);
  document.getElementById('addYearBtn').addEventListener('click', openNewYearForm);
  document.getElementById('saveYearBtn').addEventListener('click', saveYear);
  document.getElementById('addGoalBtn').addEventListener('click', openNewGoalForm);
  document.getElementById('saveGoalBtn').addEventListener('click', saveGoal);

  const tbody = document.getElementById('goalsTableBody');

  app.bindInlineRename(tbody, '.goal-name', async (newName, titleEl) => {
    const goalId = titleEl.closest('tr[data-goal-id]').dataset.goalId;
    try {
      const response = await fetch(`/api/goals/${goalId}`, {
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
      loadYearlyGoals();
      return true;
    } catch (error) {
      console.error('Error renaming goal:', error);
      app.notify('Error renaming goal', 'danger');
      return false;
    }
  });

  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn) {
      if (btn.dataset.action === 'edit') editGoal(btn.dataset.id);
      else if (btn.dataset.action === 'delete') deleteGoal(btn.dataset.id);
      else if (btn.dataset.action === 'cycle-status') {
        cycleGoalStatus(btn.dataset.id, btn.textContent.trim());
      }
      return;
    }

    // Single-click on row to open editor
    const row = e.target.closest('tr[data-goal-id]');
    if (row) {
      editGoal(row.dataset.goalId);
    }
  });

  tbody.addEventListener('dblclick', (e) => {
    if (e.target.closest('[data-action]')) return;
    const row = e.target.closest('tr');
    if (row) editGoal(row.dataset.goalId);
  });

  tbody.addEventListener('dragstart', (e) => {
    const row = e.target.closest('tr[data-goal-id]');
    if (!row) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('goal-id', row.dataset.goalId);
    row.classList.add('dragging-item');
  });

  tbody.addEventListener('dragend', (e) => {
    const row = e.target.closest('tr[data-goal-id]');
    if (row) row.classList.remove('dragging-item');
    tbody.querySelectorAll('.drop-indicator-before, .drop-indicator-after').forEach(el => {
      el.classList.remove('drop-indicator-before', 'drop-indicator-after');
    });
  });

  tbody.addEventListener('dragover', (e) => {
    const row = e.target.closest('tr[data-goal-id]');
    if (!row) return;
    e.preventDefault();
    tbody.querySelectorAll('.drop-indicator-before, .drop-indicator-after').forEach(el => {
      el.classList.remove('drop-indicator-before', 'drop-indicator-after');
    });
    const zone = app.getVerticalDropZone(e, row);
    row.classList.add(zone === 'before' ? 'drop-indicator-before' : 'drop-indicator-after');
  });

  tbody.addEventListener('drop', (e) => {
    const row = e.target.closest('tr[data-goal-id]');
    const draggedId = e.dataTransfer.getData('goal-id');
    if (!draggedId) return;
    e.preventDefault();

    tbody.querySelectorAll('.drop-indicator-before, .drop-indicator-after').forEach(el => {
      el.classList.remove('drop-indicator-before', 'drop-indicator-after');
    });

    if (!row || row.dataset.goalId === draggedId) return;

    const position = app.getVerticalDropZone(e, row);
    reorderGoalsOnDrop(draggedId, row.dataset.goalId, position);
  });
}

async function initGoals() {
  // #goalModal can be opened from other tabs (e.g. the Dailies right panel). Left
  // inside the #tab-yearly-goals pane, it's a descendant of a display:none ancestor
  // whenever that tab isn't active, so Bootstrap's backdrop would show but the
  // dialog itself never could - move it to the body so it always renders.
  document.body.appendChild(document.getElementById('goalModal'));

  // Initialize split pane for side-panel viewing
  if (document.getElementById('goalSplitPane')) {
    window.goalSplitPane = new SplitPane('goalSplitPane', 'goalListPane', 'goalDivider', 'goalEditorPane', 66.66);
  }

  initGoalsEventListeners();
  loadGoalCategoryOptions();
  await loadYears();
  loadYearlyGoals();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initGoals());
} else {
  initGoals();
}