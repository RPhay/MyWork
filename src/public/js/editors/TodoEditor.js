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

  const save = async () => {
    const todoId = document.getElementById('toDoEditorId').value;
    const title = document.getElementById('toDoEditorFormTitle').value;
    const notes = document.getElementById('toDoEditorNotes').value;

    if (!title.trim()) {
      app.notify('Title is required', 'warning');
      return false;
    }

    const data = { title, notes };

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
