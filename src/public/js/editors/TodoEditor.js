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

      // Load and display associated items
      await renderAssociatedItems(toDo);

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

    const typeRadio = document.querySelector(`input[name="toDoEditorRecurrenceType"][value="${recurrence.type || 'daily'}"]`);
    if (typeRadio) typeRadio.checked = true;
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
      if (recurrence.allowedDaysOfWeek) {
        recurrence.allowedDaysOfWeek.forEach(day => {
          const checkbox = document.getElementById(`toDoEditorIntervalDay${day}`);
          if (checkbox) checkbox.checked = true;
        });
      }
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

    const typeRadio = document.querySelector('input[name="toDoEditorRecurrenceType"]:checked');
    const type = typeRadio?.value || 'daily';
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

      // Handle day filters
      const weekdays = document.getElementById('toDoEditorIntervalFilterWeekdays').checked;
      const weekends = document.getElementById('toDoEditorIntervalFilterWeekends').checked;

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
          const checkbox = document.getElementById(`toDoEditorIntervalDay${i}`);
          if (checkbox && checkbox.checked) daysOfWeek.push(i);
        }
        if (daysOfWeek.length > 0 && daysOfWeek.length < 7) {
          recurrence.allowedDaysOfWeek = daysOfWeek;
        }
      }
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
    const typeRadio = document.querySelector('input[name="toDoEditorRecurrenceType"]:checked');
    const type = typeRadio?.value || 'daily';
    document.getElementById('toDoEditorWeeklyConfig').style.display = type === 'weekly' ? 'block' : 'none';
    document.getElementById('toDoEditorMonthlyConfig').style.display = type === 'monthly' ? 'block' : 'none';
    document.getElementById('toDoEditorIntervalConfig').style.display = type === 'interval' ? 'block' : 'none';
  };

  const setupRecurrenceEventListeners = () => {
    const enabledCheckbox = document.getElementById('toDoEditorRecurrenceEnabled');

    if (enabledCheckbox) {
      enabledCheckbox.addEventListener('change', toggleRecurrencePanel);
    }

    document.querySelectorAll('input[name="toDoEditorRecurrenceType"]').forEach(radio => {
      radio.addEventListener('change', updateRecurrenceTypePanel);
    });

    // Handle interval day filter shortcuts
    const weekdaysCheckbox = document.getElementById('toDoEditorIntervalFilterWeekdays');
    const weekendsCheckbox = document.getElementById('toDoEditorIntervalFilterWeekends');

    if (weekdaysCheckbox) {
      weekdaysCheckbox.addEventListener('change', () => {
        if (weekdaysCheckbox.checked) {
          weekendsCheckbox.checked = false;
          // Clear specific day selections
          for (let i = 0; i < 7; i++) {
            const checkbox = document.getElementById(`toDoEditorIntervalDay${i}`);
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
            const checkbox = document.getElementById(`toDoEditorIntervalDay${i}`);
            if (checkbox) checkbox.checked = false;
          }
        }
      });
    }

    // If specific days are clicked, clear weekdays/weekends
    for (let i = 0; i < 7; i++) {
      const checkbox = document.getElementById(`toDoEditorIntervalDay${i}`);
      if (checkbox) {
        checkbox.addEventListener('change', () => {
          weekdaysCheckbox.checked = false;
          weekendsCheckbox.checked = false;
        });
      }
    }
  };

  const renderAssociatedItems = async (todo) => {
    const todoId = todo.id;

    // Fetch all associated items
    const categoriesResponse = await fetch('/api/areas').catch(() => ({ json: () => ({ data: [] }) }));
    const categoriesResult = await categoriesResponse.json();
    const allCategories = categoriesResult.data || [];
    const associatedCategories = allCategories.filter(c => {
      // Check if this todo is in the category's to_dos
      return (c.to_dos || []).some(t => t.id === todoId);
    });

    const projectsResponse = await fetch('/api/priorities').catch(() => ({ json: () => ({ data: [] }) }));
    const projectsResult = await projectsResponse.json();
    const associatedProjects = (projectsResult.data || []).filter(p => p.todos && p.todos.some(t => t.id === todoId));

    // Store for tree rendering
    window.todoAssociatedData = {
      associatedCategories, associatedProjects, todoId
    };
    renderAssociatedItemsTree(todoId);
  };

  const renderAssociatedItemsTree = (todoId) => {
    const data = window.todoAssociatedData;
    if (!data) return;

    // Hide old sections
    const catList = document.getElementById('toDoEditorCategoriesList');
    if (catList) catList.style.display = 'none';
    const catLabel = document.getElementById('toDoEditorCategoriesLabel');
    if (catLabel) catLabel.style.display = 'none';
    const projList = document.getElementById('toDoEditorProjectsList');
    if (projList) projList.style.display = 'none';
    const projLabel = document.getElementById('toDoEditorProjectsLabel');
    if (projLabel) projLabel.style.display = 'none';

    // Render tree in a new container
    let treeContainer = document.getElementById('toDoEditorAssociatedItemsTree');
    if (!treeContainer) {
      treeContainer = document.createElement('div');
      treeContainer.id = 'toDoEditorAssociatedItemsTree';
      treeContainer.className = 'mb-3';
      const linksSection = document.querySelector('[id="toDoEditorLinksList"]')?.closest('.mb-3');
      if (linksSection) {
        linksSection.parentElement.insertBefore(treeContainer, linksSection.nextElementSibling);
      }
    }

    let html = '<hr class="my-3"><div class="associate-tree">';

    if (data.associatedCategories.length === 0 && data.associatedProjects.length === 0) {
      html += '<p class="text-muted small">No associated items</p>';
    } else {
      // Categories
      if (data.associatedCategories.length > 0) {
        html += '<div class="associate-tree-section mb-2"><strong>Categories</strong>';
        data.associatedCategories.forEach(cat => {
          html += `<div class="associate-tree-item ms-3" data-item-type="category" data-item-id="${cat.id}">
            <span>${app.escapeHtml(cat.name || cat.path)}</span>
            <button type="button" class="btn btn-sm btn-outline-danger remove-assoc ms-2" style="padding: 0.125rem 0.375rem;">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>`;
        });
        html += '</div>';
      }

      // Projects
      if (data.associatedProjects.length > 0) {
        html += '<div class="associate-tree-section mb-2"><strong>Projects</strong>';
        data.associatedProjects.forEach(proj => {
          html += `<div class="associate-tree-item ms-3" data-item-type="project" data-item-id="${proj.id}">
            <span>${app.escapeHtml(proj.title)}</span>
            <button type="button" class="btn btn-sm btn-outline-danger remove-assoc ms-2" style="padding: 0.125rem 0.375rem;">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>`;
        });
        html += '</div>';
      }
    }

    html += '</div>';
    treeContainer.innerHTML = html;

    // Add event listeners
    treeContainer.querySelectorAll('.remove-assoc').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const item = btn.closest('[data-item-type]');
        removeAssociation(todoId, item.dataset.itemType, item.dataset.itemId);
      });
    });
  };

  const removeAssociation = async (todoId, itemType, itemId) => {
    try {
      let url, body;

      if (itemType === 'category') {
        url = `/api/areas/${itemId}`;
        const response = await fetch(url);
        const result = await response.json();
        const area = result.data;
        const existingTodoIds = (area.to_dos || []).map(t => t.id).filter(id => id !== parseInt(todoId));
        body = JSON.stringify({ todo_ids: existingTodoIds });
      } else if (itemType === 'project') {
        url = `/api/priorities/${itemId}`;
        const response = await fetch(url);
        const result = await response.json();
        const priority = result.data;
        const existingTodoIds = (priority.todos || []).map(t => t.id).filter(id => id !== parseInt(todoId));
        body = JSON.stringify({ todo_ids: existingTodoIds });
      }

      if (!url) return;

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.APP_CONFIG?.csrfToken
        },
        body: body
      });

      const result = await response.json();
      if (result.success) {
        app.notify('Association removed!', 'success');
        // Reload todo and re-render associated items tree
        const todoResponse = await fetch(`/api/to-dos/${todoId}`);
        const todoResult = await todoResponse.json();
        await renderAssociatedItems(todoResult.data);
      } else {
        app.notify('Error: ' + result.message, 'danger');
      }
    } catch (error) {
      console.error('Error removing association:', error);
      app.notify('Error removing association', 'danger');
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
    renderAssociatedItems,
    renderAssociatedItemsTree,
    save,
    close
  };
})();
