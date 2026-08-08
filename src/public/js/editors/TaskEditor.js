const TaskEditor = (() => {
  let splitPane = null;

  const init = (splitPaneInstance) => {
    splitPane = splitPaneInstance;
  };

  const populate = async (taskId) => {
    try {
      const allTasks = window.allTasks || [];
      const task = allTasks.find(t => t.id === taskId);

      if (!task) {
        app.notify('Task not found', 'danger');
        return;
      }

      fillForm(task);
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

  const save = async () => {
    const taskId = document.getElementById('taskEditorId').value;
    const title = document.getElementById('taskEditorFormTitle').value;
    const notes = document.getElementById('taskEditorNotes').value;

    if (!title.trim()) {
      app.notify('Title is required', 'warning');
      return false;
    }

    const data = { title, notes };

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

  const close = () => {
    if (splitPane) {
      splitPane.hideRightPane();
    }
  };

  return {
    init,
    populate,
    fillForm,
    renderLinks,
    save,
    close
  };
})();
