const PriorityEditor = (() => {
  let splitPane = null;

  const init = (splitPaneInstance) => {
    splitPane = splitPaneInstance;
  };

  const populate = async (priorityId) => {
    try {
      const response = await fetch(`/api/priorities/${priorityId}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();

      if (!result.success || !result.data) {
        app.notify('Error loading project', 'danger');
        return;
      }

      const priority = result.data;
      fillForm(priority, 'priority');

      // Load and display links
      const linksResponse = await fetch(`/api/priorities/${priorityId}/links`).catch(() => ({ json: () => ({ data: [] }) }));
      const linksResult = await linksResponse.json();
      renderLinks(linksResult.data || []);

      // Load and display associated items
      await renderAssociatedItems(priority);

      splitPane.showRightPane();
    } catch (error) {
      console.error('Error loading priority:', error);
      app.notify('Error loading project', 'danger');
    }
  };

  const fillForm = (item, type) => {
    document.getElementById('priorityEditorType').value = type;
    document.getElementById('priorityEditorId').value = item.id;
    document.getElementById('priorityEditorFormTitle').value = item.title;
    document.getElementById('priorityEditorNotes').value = item.notes || '';
    document.getElementById('priorityEditorTitle').textContent = item.title;
  };

  const renderLinks = (links) => {
    const linksList = document.getElementById('priorityEditorLinksList');
    if (!linksList) return;

    linksList.innerHTML = '';
    links.forEach((link, index) => {
      const linkEl = document.createElement('div');
      linkEl.className = 'mb-2 p-2 bg-light rounded d-flex justify-content-between align-items-center';

      const titleSpan = document.createElement('span');
      titleSpan.className = 'flex-grow-1 cursor-pointer';
      titleSpan.innerHTML = `<a href="${app.escapeHtml(link.url)}" target="_blank" class="text-decoration-none">${app.escapeHtml(link.title || link.url)}</a>`;
      titleSpan.title = 'Click to rename';
      titleSpan.style.cursor = 'pointer';

      titleSpan.addEventListener('click', () => {
        const newTitle = prompt('Enter link title:', link.title || '');
        if (newTitle !== null) {
          link.title = newTitle;
          renderLinks(links);
        }
      });

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn btn-sm btn-outline-danger';
      removeBtn.innerHTML = '<i class="bi bi-x"></i>';
      removeBtn.addEventListener('click', () => {
        links.splice(index, 1);
        renderLinks(links);
      });

      linkEl.appendChild(titleSpan);
      linkEl.appendChild(removeBtn);
      linksList.appendChild(linkEl);
    });
  };

  const save = async () => {
    const type = document.getElementById('priorityEditorType').value;
    const id = document.getElementById('priorityEditorId').value;
    const title = document.getElementById('priorityEditorFormTitle').value;
    const notes = document.getElementById('priorityEditorNotes').value;

    if (!title.trim()) {
      app.notify('Title is required', 'warning');
      return false;
    }

    try {
      const endpoint = type === 'todo' ? `/api/to-dos/${id}` : `/api/priorities/${id}`;
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.APP_CONFIG?.csrfToken
        },
        body: JSON.stringify({ title, notes })
      });

      const result = await response.json();
      if (result.success) {
        const msg = type === 'todo' ? 'To Do updated!' : 'Project updated!';
        app.notify(msg, 'success');
        return true;
      } else {
        app.notify('Error: ' + result.message, 'danger');
        return false;
      }
    } catch (error) {
      console.error('Error saving:', error);
      const msg = type === 'todo' ? 'Error saving to do' : 'Error saving project';
      app.notify(msg, 'danger');
      return false;
    }
  };

  const renderAssociatedItems = async (priority) => {
    const priorityId = priority.id;

    // Render categories
    const categories = priority.areas || [];
    renderItemsList('priorityEditorCategoriesList', categories, 'category', priorityId);

    // Fetch and render todos
    const todosResponse = await fetch('/api/to-dos').catch(() => ({ json: () => ({ data: [] }) }));
    const todosResult = await todosResponse.json();
    const allTodos = todosResult.data || [];
    const associatedTodos = allTodos.filter(t => t.priority_id === priorityId);
    renderItemsList('priorityEditorTodosList', associatedTodos, 'todo', priorityId);

    // Fetch and render ideas
    const ideasResponse = await fetch('/api/ideas').catch(() => ({ json: () => ({ data: [] }) }));
    const ideasResult = await ideasResponse.json();
    const allIdeas = ideasResult.data || [];
    renderItemsList('priorityEditorIdeasList', allIdeas, 'idea', priorityId);

    // Fetch and render tickets
    const ticketsResponse = await fetch('/api/tickets').catch(() => ({ json: () => ({ data: [] }) }));
    const ticketsResult = await ticketsResponse.json();
    const allTickets = ticketsResult.data || [];
    const associatedTickets = allTickets.filter(t => t.priority_id === priorityId);
    renderItemsList('priorityEditorTicketsList', associatedTickets, 'ticket', priorityId);
  };

  const renderItemsList = (containerId, items, itemType, priorityId) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    items.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'list-group-item d-flex justify-content-between align-items-center';
      itemEl.innerHTML = `
        <span>${app.escapeHtml(item.name || item.title || item.subject)}</span>
        <button type="button" class="btn btn-sm btn-outline-danger remove-item" data-item-type="${itemType}" data-item-id="${item.id}">
          <i class="bi bi-x-lg"></i>
        </button>
      `;
      container.appendChild(itemEl);

      itemEl.querySelector('.remove-item').addEventListener('click', (e) => {
        e.preventDefault();
        removeAssociation(priorityId, itemType, item.id);
      });
    });
  };

  const removeAssociation = async (priorityId, itemType, itemId) => {
    try {
      let url, body;

      if (itemType === 'category') {
        const response = await fetch(`/api/priorities/${priorityId}`);
        const result = await response.json();
        const priority = result.data;
        const existingAreaIds = (priority.areas || []).map(a => a.id).filter(id => id !== itemId);
        url = `/api/priorities/${priorityId}`;
        body = JSON.stringify({ area_ids: existingAreaIds });
      } else if (itemType === 'todo') {
        url = `/api/to-dos/${itemId}`;
        body = JSON.stringify({ priority_id: null });
      } else if (itemType === 'ticket') {
        url = `/api/tickets/${itemId}`;
        body = JSON.stringify({ priority_id: null });
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
        PriorityEditor.populate(priorityId);
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
    init,
    populate,
    fillForm,
    renderLinks,
    renderAssociatedItems,
    save,
    close
  };
})();
