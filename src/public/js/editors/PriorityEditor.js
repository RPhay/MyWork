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
