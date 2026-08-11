const TodoEditor = (() => {
  let splitPane = null;
  let formId = null;

  const init = (splitPaneInstance, editorFormId) => {
    splitPane = splitPaneInstance;
    formId = editorFormId;
  };

  const populate = async (todoId) => {
    try {
      const response = await fetch(`/api/to-dos/${todoId}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();

      if (!result.success || !result.data) {
        app.notify('Error loading to do', 'danger');
        return;
      }

      const toDo = result.data;
      fillForm(toDo);

      // Call external functions if they exist (from todos.js)
      if (typeof renderToDoItemsEditor === 'function') {
        renderToDoItemsEditor(toDo.items || [], 'toDoEditorItemsList');
      }
      if (typeof loadLinksForEntity === 'function') {
        loadLinksForEntity('to-do', toDo.id, 'toDoEditorLinksList');
      }
      if (typeof setupURLDragDrop === 'function') {
        setupURLDragDrop('to-do', 'toDoEditorLinksList', () => toDo.id);
      }

      splitPane.showRightPane();
    } catch (error) {
      console.error('Error loading to do:', error);
      app.notify('Error loading to do', 'danger');
    }
  };

  const fillForm = (toDo) => {
    document.getElementById('toDoEditorId').value = toDo.id;
    document.getElementById('toDoEditorFormTitle').value = toDo.title;
    document.getElementById('toDoEditorNotes').value = toDo.notes || '';
    document.getElementById('todoEditorTitle').textContent = toDo.title;

    // Fill recurrence if present
    if (toDo.recurrence && toDo.recurrence.enabled) {
      fillRecurrenceForm(toDo.recurrence);
    }
  };

  const fillRecurrenceForm = (recurrence) => {
    const enabledCheckbox = document.getElementById('toDoEditorRecurrenceEnabled');
    enabledCheckbox.checked = recurrence.enabled;
    toggleRecurrencePanel();

    const typeSelect = document.getElementById('toDoEditorRecurrenceType');
    typeSelect.value = recurrence.type || 'daily';
    updateRecurrenceTypePanel();

    if (recurrence.type === 'weekly' && recurrence.daysOfWeek) {
      recurrence.daysOfWeek.forEach(day => {
        const checkbox = document.getElementById(`toDoEditorDay${day}`);
        if (checkbox) checkbox.checked = true;
      });
    }

    if (recurrence.type === 'monthly') {
      if (recurrence.dateOfMonth) {
        document.getElementById('toDoEditorMonthlyDate').checked = true;
        document.getElementById('toDoEditorMonthlyDateInput').value = recurrence.dateOfMonth;
      } else if (recurrence.weekday !== undefined) {
        document.getElementById('toDoEditorMonthlyWeekday').checked = true;
        document.getElementById('toDoEditorMonthlyWeekdaySelect').value = recurrence.weekday;
        document.getElementById('toDoEditorMonthlyWeekofmonthSelect').value = recurrence.weekOfMonth || 1;
      } else if (recurrence.lastDay) {
        document.getElementById('toDoEditorMonthlyLastday').checked = true;
      }
    }

    if (recurrence.type === 'interval') {
      document.getElementById('toDoEditorIntervalDays').value = recurrence.intervalDays || 1;
    }

    if (recurrence.startDate) {
      document.getElementById('toDoEditorRecurrenceStartDate').value = recurrence.startDate;
    }

    if (recurrence.endDate) {
      document.getElementById('toDoEditorRecurrenceEndDate').value = recurrence.endDate;
    }
  };

  const renderLinks = (links) => {
    const linksList = document.getElementById('toDoEditorLinksList');
    if (!linksList) return;

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
  };

  const getRecurrenceData = () => {
    const enabled = document.getElementById('toDoEditorRecurrenceEnabled').checked;
    if (!enabled) return null;

    const type = document.getElementById('toDoEditorRecurrenceType').value;
    const recurrence = { enabled: true, type };

    if (type === 'weekly') {
      const daysOfWeek = [];
      for (let i = 0; i < 7; i++) {
        const checkbox = document.getElementById(`toDoEditorDay${i}`);
        if (checkbox && checkbox.checked) daysOfWeek.push(i);
      }
      if (daysOfWeek.length === 0) {
        app.notify('Select at least one day for weekly recurrence', 'warning');
        return null;
      }
      recurrence.daysOfWeek = daysOfWeek;
    }

    if (type === 'monthly') {
      const monthlyType = document.querySelector('input[name="toDoEditorMonthlyType"]:checked').value;
      if (monthlyType === 'date') {
        const date = parseInt(document.getElementById('toDoEditorMonthlyDateInput').value);
        if (!date || date < 1 || date > 31) {
          app.notify('Enter a valid date (1-31)', 'warning');
          return null;
        }
        recurrence.dateOfMonth = date;
      } else if (monthlyType === 'weekday') {
        recurrence.weekday = parseInt(document.getElementById('toDoEditorMonthlyWeekdaySelect').value);
        recurrence.weekOfMonth = parseInt(document.getElementById('toDoEditorMonthlyWeekofmonthSelect').value);
      } else if (monthlyType === 'lastday') {
        recurrence.lastDay = true;
      }
    }

    if (type === 'interval') {
      const days = parseInt(document.getElementById('toDoEditorIntervalDays').value);
      if (!days || days < 1) {
        app.notify('Enter a valid interval (at least 1 day)', 'warning');
        return null;
      }
      recurrence.intervalDays = days;
    }

    const startDate = document.getElementById('toDoEditorRecurrenceStartDate').value;
    if (startDate) recurrence.startDate = startDate;

    const endDate = document.getElementById('toDoEditorRecurrenceEndDate').value;
    if (endDate) recurrence.endDate = endDate;

    return recurrence;
  };

  const save = async () => {
    const todoId = document.getElementById('toDoEditorId').value;
    const title = document.getElementById('toDoEditorFormTitle').value;
    const notes = document.getElementById('toDoEditorNotes').value;

    if (!title.trim()) {
      app.notify('Title is required', 'warning');
      return false;
    }

    const data = { title, notes };

    const recurrence = getRecurrenceData();
    if (document.getElementById('toDoEditorRecurrenceEnabled').checked && recurrence === null) {
      return false;
    }
    if (recurrence) {
      data.recurrence = recurrence;
    }

    try {
      const method = todoId ? 'PUT' : 'POST';
      const url = todoId ? `/api/to-dos/${todoId}` : '/api/to-dos';

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
        app.notify(todoId ? 'To Do updated!' : 'To Do created!', 'success');
        return true;
      } else {
        app.notify('Error: ' + result.message, 'danger');
        return false;
      }
    } catch (error) {
      console.error('Error:', error);
      app.notify('Error saving to do', 'danger');
      return false;
    }
  };

  const toggleRecurrencePanel = () => {
    const enabled = document.getElementById('toDoEditorRecurrenceEnabled').checked;
    const panel = document.getElementById('toDoEditorRecurrencePanel');
    if (panel) {
      panel.style.display = enabled ? 'block' : 'none';
    }
  };

  const updateRecurrenceTypePanel = () => {
    const type = document.getElementById('toDoEditorRecurrenceType').value;
    document.getElementById('toDoEditorWeeklyConfig').style.display = type === 'weekly' ? 'block' : 'none';
    document.getElementById('toDoEditorMonthlyConfig').style.display = type === 'monthly' ? 'block' : 'none';
    document.getElementById('toDoEditorIntervalConfig').style.display = type === 'interval' ? 'block' : 'none';
  };

  const setupRecurrenceEventListeners = () => {
    const enabledCheckbox = document.getElementById('toDoEditorRecurrenceEnabled');
    const typeSelect = document.getElementById('toDoEditorRecurrenceType');

    if (enabledCheckbox) {
      enabledCheckbox.addEventListener('change', toggleRecurrencePanel);
    }

    if (typeSelect) {
      typeSelect.addEventListener('change', updateRecurrenceTypePanel);
    }
  };

  const close = () => {
    if (splitPane) {
      splitPane.hideRightPane();
    }
  };

  return {
    init: (splitPaneInstance, editorFormId) => {
      init(splitPaneInstance, editorFormId);
      setupRecurrenceEventListeners();
    },
    populate,
    fillForm,
    renderLinks,
    save,
    close
  };
})();
