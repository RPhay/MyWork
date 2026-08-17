const TicketEditor = (() => {
  let splitPane = null;
  let currentTicketId = null;
  const changeTracker = createChangeTracker({
    formId: 'ticketEditorForm',
    saveBtnId: 'saveTicketEditorBtn',
    selectors: ['input[type="text"]', 'textarea', 'input[type="url"]', 'select'],
  });

  const init = (splitPaneInstance) => {
    splitPane = splitPaneInstance;
  };

  const populate = async (ticketId) => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();

      if (!result.success || !result.data) {
        app.notify('Error loading ticket', 'danger');
        return;
      }

      const ticket = result.data;
      currentTicketId = ticketId;
      changeTracker.resetChangeTracking();
      fillForm(ticket);
      changeTracker.trackFormChanges();
      splitPane.showRightPane();
    } catch (error) {
      console.error('Error loading ticket:', error);
      app.notify('Error loading ticket', 'danger');
    }
  };

  const fillForm = (ticket) => {
    document.getElementById('ticketEditorId').value = ticket.id;
    document.getElementById('ticketEditorFormTitle').value = ticket.title;
    document.getElementById('ticketEditorNotes').value = ticket.notes || '';
    document.getElementById('ticketEditorType').value = ticket.ticket_type;
    document.getElementById('ticketEditorTitle').textContent = ticket.title;
    renderLinks(ticket.links || []);
  };

  const renderLinks = (links) => {
    const linksList = document.getElementById('ticketEditorLinksList');
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
    const ticketId = document.getElementById('ticketEditorId').value;
    const title = document.getElementById('ticketEditorFormTitle').value;
    const notes = document.getElementById('ticketEditorNotes').value;
    const ticketType = document.getElementById('ticketEditorType').value;

    if (!title.trim()) {
      app.notify('Title is required', 'warning');
      return false;
    }

    const data = {
      title,
      notes,
      ticket_type: ticketType
    };

    try {
      const method = ticketId ? 'PUT' : 'POST';
      const url = ticketId ? `/api/tickets/${ticketId}` : '/api/tickets';

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
        app.notify(ticketId ? 'Ticket updated!' : 'Ticket created!', 'success');
        return true;
      } else {
        app.notify('Error: ' + result.message, 'danger');
        return false;
      }
    } catch (error) {
      console.error('Error:', error);
      app.notify('Error saving ticket', 'danger');
      return false;
    }
  };

  const close = () => {
    changeTracker.resetChangeTracking();
    currentTicketId = null;
    if (splitPane) {
      splitPane.hideRightPane();
    }
  };

  const toggleOnSameRow = (ticketId) => {
    if (currentTicketId === ticketId) {
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
    renderLinks,
    save,
    close,
    toggleOnSameRow
  };
})();
