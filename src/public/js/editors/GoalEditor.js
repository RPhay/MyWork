const GoalEditor = (() => {
  let splitPane = null;
  let formId = null;
  let categoriesSelect = null;
  let currentGoalId = null;
  const changeTracker = createChangeTracker({
    formId: 'goalEditorForm',
    saveBtnId: 'saveGoalEditorBtn',
    selectors: ['input[type="text"]', 'textarea', 'input[type="date"]', 'select'],
  });

  const init = (splitPaneInstance, editorFormId) => {
    splitPane = splitPaneInstance;
    formId = editorFormId;
    categoriesSelect = document.getElementById('goalEditorCategories');
  };

  const populate = async (goalId) => {
    try {
      const response = await fetch(`/api/goals/${goalId}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();

      if (!result.success || !result.data) {
        app.notify('Error loading goal', 'danger');
        return;
      }

      const goal = result.data;
      currentGoalId = goalId;
      changeTracker.resetChangeTracking();
      fillForm(goal);
      changeTracker.trackFormChanges();
      splitPane.showRightPane();
    } catch (error) {
      console.error('Error loading goal:', error);
      app.notify('Error loading goal', 'danger');
    }
  };

  const fillForm = (goal) => {
    document.getElementById('goalEditorId').value = goal.id;
    document.getElementById('goalEditorName').value = goal.name;
    document.getElementById('goalEditorDescription').value = goal.description || '';
    document.getElementById('goalEditorMeasurements').value = goal.measurements || '';
    document.getElementById('goalEditorUpdates').value = goal.goal_updates || '';
    document.getElementById('goalEditorStatus').value = goal.status;
    document.getElementById('goalEditorDueDate').value = goal.due_date || '';

    if (categoriesSelect) {
      const ids = new Set((goal.categories || []).map(c => String(c.id)));
      Array.from(categoriesSelect.options).forEach(opt => {
        opt.selected = ids.has(opt.value);
      });
    }
  };

  const save = async () => {
    const goalId = document.getElementById('goalEditorId').value;
    const year = document.getElementById('yearSelect')?.value;

    if (!year) {
      app.notify('Year is required', 'warning');
      return;
    }

    const data = {
      year: parseInt(year),
      name: document.getElementById('goalEditorName').value,
      description: document.getElementById('goalEditorDescription').value,
      measurements: document.getElementById('goalEditorMeasurements').value,
      goal_updates: document.getElementById('goalEditorUpdates').value,
      status: document.getElementById('goalEditorStatus').value,
      due_date: document.getElementById('goalEditorDueDate').value,
      categories: Array.from(categoriesSelect.selectedOptions).map(opt => opt.value)
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
        return true;
      } else {
        app.notify('Error saving goal: ' + result.message, 'danger');
        return false;
      }
    } catch (error) {
      console.error('Error:', error);
      app.notify('Error saving goal', 'danger');
      return false;
    }
  };

  const close = () => {
    changeTracker.resetChangeTracking();
    currentGoalId = null;
    if (splitPane) {
      splitPane.hideRightPane();
    }
  };

  const toggleOnSameRow = (goalId) => {
    if (currentGoalId === goalId) {
      if (changeTracker.hasChanges) {
        return false;
      }
      close();
      return true;
    }
    return false;
  };

  return {
    init,
    populate,
    fillForm,
    save,
    close,
    toggleOnSameRow
  };
})();
