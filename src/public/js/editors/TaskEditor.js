const TaskEditor = (() => {
  let splitPane = null;
  let currentTaskId = null;
  const changeTracker = createChangeTracker({ formId: 'taskEditorForm', saveBtnId: 'saveTaskEditorBtn' });

  const init = (splitPaneInstance) => {
    splitPane = splitPaneInstance;
  };

  const populate = async (taskId) => {
    try {
      const allTasks = window.allTasks || [];
      // taskId comes from a DOM data-attribute (string); allTasks[].id is numeric
      // from the API response, so this must compare by String() not ===.
      const task = allTasks.find(t => String(t.id) === String(taskId));

      if (!task) {
        app.notify('Task not found', 'danger');
        return;
      }

      currentTaskId = taskId;
      changeTracker.resetChangeTracking();
      fillForm(task);
      changeTracker.trackFormChanges();
      splitPane.showRightPane();
    } catch (error) {
      console.error('Error loading task:', error);
      app.notify('Error loading task', 'danger');
    }
  };

  const fillForm = (task) => {
    document.getElementById('taskEditorId').value = task.id;
    document.getElementById('taskEditorFormTitle').value = task.title;
    document.getElementById('taskEditorNotes').value = task.notes || '';
    document.getElementById('taskEditorTitle').textContent = task.title;
    renderLinks(task.links || []);

    // Fill recurrence if present
    if (task.recurrence && task.recurrence.enabled) {
      fillRecurrenceForm(task.recurrence);
    }
  };

  const fillRecurrenceForm = (recurrence) => {
    const enabledCheckbox = document.getElementById('taskEditorRecurrenceEnabled');
    enabledCheckbox.checked = recurrence.enabled;
    toggleRecurrencePanel();

    const typeRadio = document.querySelector(`input[name="taskEditorRecurrenceType"][value="${recurrence.type || 'daily'}"]`);
    if (typeRadio) typeRadio.checked = true;
    updateRecurrenceTypePanel();

    if (recurrence.type === 'weekly' && recurrence.daysOfWeek) {
      recurrence.daysOfWeek.forEach(day => {
        const checkbox = document.getElementById(`taskEditorDay${day}`);
        if (checkbox) checkbox.checked = true;
      });
    }

    if (recurrence.type === 'monthly') {
      if (recurrence.dateOfMonth) {
        document.getElementById('taskEditorMonthlyDate').checked = true;
        document.getElementById('taskEditorMonthlyDateInput').value = recurrence.dateOfMonth;
      } else if (recurrence.weekday !== undefined) {
        document.getElementById('taskEditorMonthlyWeekday').checked = true;
        document.getElementById('taskEditorMonthlyWeekdaySelect').value = recurrence.weekday;
        document.getElementById('taskEditorMonthlyWeekofmonthSelect').value = recurrence.weekOfMonth || 1;
      } else if (recurrence.lastDay) {
        document.getElementById('taskEditorMonthlyLastday').checked = true;
      }
    }

    if (recurrence.type === 'interval') {
      document.getElementById('taskEditorIntervalDays').value = recurrence.intervalDays || 1;
      if (recurrence.allowedDaysOfWeek) {
        recurrence.allowedDaysOfWeek.forEach(day => {
          const checkbox = document.getElementById(`taskEditorIntervalDay${day}`);
          if (checkbox) checkbox.checked = true;
        });
      }
    }

    if (recurrence.startDate) {
      document.getElementById('taskEditorRecurrenceStartDate').value = recurrence.startDate;
    }

    if (recurrence.endDate) {
      document.getElementById('taskEditorRecurrenceEndDate').value = recurrence.endDate;
    }
  };

  const renderLinks = (links) => {
    const linksList = document.getElementById('taskEditorLinksList');
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
    const enabled = document.getElementById('taskEditorRecurrenceEnabled').checked;
    if (!enabled) return null;

    const typeRadio = document.querySelector('input[name="taskEditorRecurrenceType"]:checked');
    const type = typeRadio?.value || 'daily';
    const recurrence = { enabled: true, type };

    if (type === 'weekly') {
      const daysOfWeek = [];
      for (let i = 0; i < 7; i++) {
        const checkbox = document.getElementById(`taskEditorDay${i}`);
        if (checkbox && checkbox.checked) daysOfWeek.push(i);
      }
      if (daysOfWeek.length === 0) {
        app.notify('Select at least one day for weekly recurrence', 'warning');
        return null;
      }
      recurrence.daysOfWeek = daysOfWeek;
    }

    if (type === 'monthly') {
      const monthlyType = document.querySelector('input[name="taskEditorMonthlyType"]:checked').value;
      if (monthlyType === 'date') {
        const date = parseInt(document.getElementById('taskEditorMonthlyDateInput').value);
        if (!date || date < 1 || date > 31) {
          app.notify('Enter a valid date (1-31)', 'warning');
          return null;
        }
        recurrence.dateOfMonth = date;
      } else if (monthlyType === 'weekday') {
        recurrence.weekday = parseInt(document.getElementById('taskEditorMonthlyWeekdaySelect').value);
        recurrence.weekOfMonth = parseInt(document.getElementById('taskEditorMonthlyWeekofmonthSelect').value);
      } else if (monthlyType === 'lastday') {
        recurrence.lastDay = true;
      }
    }

    if (type === 'interval') {
      const days = parseInt(document.getElementById('taskEditorIntervalDays').value);
      if (!days || days < 1) {
        app.notify('Enter a valid interval (at least 1 day)', 'warning');
        return null;
      }
      recurrence.intervalDays = days;

      // Handle day filters
      const weekdays = document.getElementById('taskEditorIntervalFilterWeekdays').checked;
      const weekends = document.getElementById('taskEditorIntervalFilterWeekends').checked;

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
          const checkbox = document.getElementById(`taskEditorIntervalDay${i}`);
          if (checkbox && checkbox.checked) daysOfWeek.push(i);
        }
        if (daysOfWeek.length > 0 && daysOfWeek.length < 7) {
          recurrence.allowedDaysOfWeek = daysOfWeek;
        }
      }
    }

    const startDate = document.getElementById('taskEditorRecurrenceStartDate').value;
    if (startDate) recurrence.startDate = startDate;

    const endDate = document.getElementById('taskEditorRecurrenceEndDate').value;
    if (endDate) recurrence.endDate = endDate;

    return recurrence;
  };

  const save = async () => {
    const taskId = document.getElementById('taskEditorId').value;
    const title = document.getElementById('taskEditorFormTitle').value;
    const notes = document.getElementById('taskEditorNotes').value;

    if (!title.trim()) {
      app.notify('Title is required', 'warning');
      return false;
    }

    const data = { title, notes };

    const recurrence = getRecurrenceData();
    if (document.getElementById('taskEditorRecurrenceEnabled').checked && recurrence === null) {
      return false;
    }
    if (recurrence) {
      data.recurrence = recurrence;
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
        body: JSON.stringify(data)
      });

      const result = await response.json();
      if (result.success) {
        app.notify(taskId ? 'Task updated!' : 'Task created!', 'success');
        return true;
      } else {
        app.notify('Error: ' + result.message, 'danger');
        return false;
      }
    } catch (error) {
      console.error('Error:', error);
      app.notify('Error saving task', 'danger');
      return false;
    }
  };

  const toggleRecurrencePanel = () => {
    const enabled = document.getElementById('taskEditorRecurrenceEnabled').checked;
    const panel = document.getElementById('taskEditorRecurrencePanel');
    if (panel) {
      panel.style.display = enabled ? 'block' : 'none';
    }
  };

  const updateRecurrenceTypePanel = () => {
    const typeRadio = document.querySelector('input[name="taskEditorRecurrenceType"]:checked');
    const type = typeRadio?.value || 'daily';
    document.getElementById('taskEditorWeeklyConfig').style.display = type === 'weekly' ? 'block' : 'none';
    document.getElementById('taskEditorMonthlyConfig').style.display = type === 'monthly' ? 'block' : 'none';
    document.getElementById('taskEditorIntervalConfig').style.display = type === 'interval' ? 'block' : 'none';
  };

  const setupRecurrenceEventListeners = () => {
    const enabledCheckbox = document.getElementById('taskEditorRecurrenceEnabled');

    if (enabledCheckbox) {
      enabledCheckbox.addEventListener('change', toggleRecurrencePanel);
    }

    document.querySelectorAll('input[name="taskEditorRecurrenceType"]').forEach(radio => {
      radio.addEventListener('change', updateRecurrenceTypePanel);
    });

    // Handle interval day filter shortcuts
    const weekdaysCheckbox = document.getElementById('taskEditorIntervalFilterWeekdays');
    const weekendsCheckbox = document.getElementById('taskEditorIntervalFilterWeekends');

    if (weekdaysCheckbox) {
      weekdaysCheckbox.addEventListener('change', () => {
        if (weekdaysCheckbox.checked) {
          weekendsCheckbox.checked = false;
          // Clear specific day selections
          for (let i = 0; i < 7; i++) {
            const checkbox = document.getElementById(`taskEditorIntervalDay${i}`);
            if (checkbox) checkbox.checked = false;
          }
        }
      });
    }

    if (weekendsCheckbox) {
      weekendsCheckbox.addEventListener('change', () => {
        if (weekendsCheckbox.checked) {
          weekdaysCheckbox.checked = false;
          // Clear specific day selections
          for (let i = 0; i < 7; i++) {
            const checkbox = document.getElementById(`taskEditorIntervalDay${i}`);
            if (checkbox) checkbox.checked = false;
          }
        }
      });
    }

    // If specific days are clicked, clear weekdays/weekends
    for (let i = 0; i < 7; i++) {
      const checkbox = document.getElementById(`taskEditorIntervalDay${i}`);
      if (checkbox) {
        checkbox.addEventListener('change', () => {
          weekdaysCheckbox.checked = false;
          weekendsCheckbox.checked = false;
        });
      }
    }
  };

  const close = () => {
    changeTracker.resetChangeTracking();
    currentTaskId = null;
    if (splitPane) {
      splitPane.hideRightPane();
    }
  };

  const toggleOnSameRow = (taskId) => {
    if (currentTaskId === taskId) {
      if (changeTracker.hasChanges) {
        return false;
      }
      close();
      return true;
    }
    return false;
  };

  return {
    init: (splitPaneInstance) => {
      init(splitPaneInstance);
      setupRecurrenceEventListeners();
    },
    populate,
    fillForm,
    renderLinks,
    save,
    close,
    toggleOnSameRow
  };
})();
