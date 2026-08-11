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

    // Fetch all associated items
    const categories = priority.areas || [];

    const todosResponse = await fetch('/api/to-dos').catch(() => ({ json: () => ({ data: [] }) }));
    const todosResult = await todosResponse.json();
    const associatedTodos = (todosResult.data || []).filter(t => t.priority_id === priorityId);

    const ideasResponse = await fetch('/api/ideas').catch(() => ({ json: () => ({ data: [] }) }));
    const ideasResult = await ideasResponse.json();
    const associatedIdeas = (ideasResult.data || []).filter(i => i.priority_id === priorityId);

    const ticketsResponse = await fetch('/api/tickets').catch(() => ({ json: () => ({ data: [] }) }));
    const ticketsResult = await ticketsResponse.json();
    const associatedTickets = (ticketsResult.data || []).filter(t => t.priority_id === priorityId);

    // Render tree structure
    window.priorityAssociatedData = {
      categories, associatedTodos, associatedIdeas, associatedTickets, priorityId
    };
    renderAssociatedItemsTree(priorityId);
  };

  const renderAssociatedItemsTree = (priorityId) => {
    const data = window.priorityAssociatedData;
    if (!data) return;

    const container = document.querySelector('[id^="priorityEditor"][id$="List"]')?.parentElement || document.body;
    const sections = container.querySelectorAll('[id^="priorityEditor"][id$="List"]');

    // Hide old sections
    sections.forEach(s => s.style.display = 'none');
    sections.forEach(s => {
      if (s.previousElementSibling) s.previousElementSibling.style.display = 'none';
    });

    // Render tree in a new container
    let treeContainer = document.getElementById('priorityEditorAssociatedItemsTree');
    if (!treeContainer) {
      treeContainer = document.createElement('div');
      treeContainer.id = 'priorityEditorAssociatedItemsTree';
      treeContainer.className = 'mb-3';
      const linksSection = document.querySelector('[id="priorityEditorLinksList"]')?.closest('.mb-3');
      if (linksSection) {
        linksSection.parentElement.insertBefore(treeContainer, linksSection.nextElementSibling);
      }
    }

    let html = '<hr class="my-3"><div class="associate-tree">';

    if (data.categories.length === 0 && data.associatedTodos.length === 0 &&
        data.associatedIdeas.length === 0 && data.associatedTickets.length === 0) {
      html += '<p class="text-muted small">No associated items</p>';
    } else {
      // Categories
      if (data.categories.length > 0) {
        html += '<div class="associate-tree-section mb-2"><strong>Categories</strong>';
        data.categories.forEach(cat => {
          html += `<div class="associate-tree-item ms-3" data-item-type="category" data-item-id="${cat.id}">
            <span>${app.escapeHtml(cat.name || cat.path)}</span>
            <button type="button" class="btn btn-sm btn-outline-danger remove-assoc ms-2" style="padding: 0.125rem 0.375rem;">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>`;
        });
        html += '</div>';
      }

      // Todos
      if (data.associatedTodos.length > 0) {
        html += '<div class="associate-tree-section mb-2"><strong>Todos</strong>';
        data.associatedTodos.forEach(todo => {
          html += `<div class="associate-tree-item ms-3" data-item-type="todo" data-item-id="${todo.id}">
            <span>${app.escapeHtml(todo.title)}</span>
            <button type="button" class="btn btn-sm btn-outline-danger remove-assoc ms-2" style="padding: 0.125rem 0.375rem;">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>`;
        });
        html += '</div>';
      }

      // Ideas
      if (data.associatedIdeas.length > 0) {
        html += '<div class="associate-tree-section mb-2"><strong>Ideas</strong>';
        data.associatedIdeas.forEach(idea => {
          html += `<div class="associate-tree-item ms-3" data-item-type="idea" data-item-id="${idea.id}">
            <span>${app.escapeHtml(idea.title)}</span>
            <button type="button" class="btn btn-sm btn-outline-danger remove-assoc ms-2" style="padding: 0.125rem 0.375rem;">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>`;
        });
        html += '</div>';
      }

      // Tickets
      if (data.associatedTickets.length > 0) {
        html += '<div class="associate-tree-section mb-2"><strong>Tickets</strong>';
        data.associatedTickets.forEach(ticket => {
          html += `<div class="associate-tree-item ms-3" data-item-type="ticket" data-item-id="${ticket.id}">
            <span>${app.escapeHtml(ticket.subject)}</span>
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
        removeAssociation(priorityId, item.dataset.itemType, item.dataset.itemId);
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
        const existingAreaIds = (priority.areas || []).map(a => a.id).filter(id => id !== parseInt(itemId));
        url = `/api/priorities/${priorityId}`;
        body = JSON.stringify({ area_ids: existingAreaIds });
      } else if (itemType === 'todo' || itemType === 'task') {
        url = `/api/${itemType === 'task' ? 'tasks' : 'to-dos'}/${itemId}`;
        body = JSON.stringify({ priority_id: null });
      } else if (itemType === 'ticket') {
        url = `/api/tickets/${itemId}`;
        body = JSON.stringify({ priority_id: null });
      } else if (itemType === 'idea') {
        url = `/api/ideas/${itemId}`;
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
        // Reload associated data and re-render tree
        const priorityResponse = await fetch(`/api/priorities/${priorityId}`);
        const priorityResult = await priorityResponse.json();
        await renderAssociatedItems(priorityResult.data);
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
    renderAssociatedItemsTree,
    save,
    close
  };
})();
