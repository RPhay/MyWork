let allTickets = [];

async function loadTickets() {
  const ticketsList = document.getElementById('ticketsList');
  ticketsList.innerHTML = '<p class="text-center text-muted">Loading...</p>';

  try {
    const response = await fetch('/api/tickets');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();

    if (result.success && result.data.length > 0) {
      allTickets = result.data;
      renderTickets();
    } else {
      ticketsList.innerHTML = '<p class="text-center text-muted">No tickets yet</p>';
    }
  } catch (error) {
    console.error('Error loading tickets:', error);
    ticketsList.innerHTML = '<p class="text-center text-danger">Error loading tickets</p>';
  }
}

function renderTickets() {
  const ticketsList = document.getElementById('ticketsList');
  ticketsList.innerHTML = '';

  // Group tickets by type
  const grouped = { 'ServiceNow': [], 'Azure DevOps': [], 'Other': [] };
  allTickets.forEach(ticket => {
    if (grouped[ticket.ticket_type]) {
      grouped[ticket.ticket_type].push(ticket);
    }
  });

  // Render each group
  Object.entries(grouped).forEach(([type, tickets]) => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'ticket-group';

    const headerDiv = document.createElement('div');
    headerDiv.className = `ticket-group-header ${type.toLowerCase().replace(' ', '-')}`;
    headerDiv.innerHTML = `<i class="bi bi-folder2"></i> <strong>${app.escapeHtml(type)}</strong> (${tickets.length})`;
    headerDiv.dataset.ticketType = type;
    headerDiv.addEventListener('contextmenu', (e) => showTicketContextMenu(e, type));

    groupDiv.appendChild(headerDiv);

    if (tickets.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'text-muted small ms-3';
      emptyDiv.textContent = 'No tickets';
      groupDiv.appendChild(emptyDiv);
    } else {
      tickets.forEach(ticket => {
        const ticketRow = document.createElement('div');
        ticketRow.className = `ticket-row ${type.toLowerCase().replace(' ', '-')}`;
        ticketRow.dataset.ticketId = ticket.id;
        ticketRow.innerHTML = `
          <div class="ticket-title">${app.escapeHtml(ticket.title)}</div>
          <div class="ticket-notes">${app.escapeHtml(ticket.notes || '')}</div>
          <div class="d-flex gap-1">
            <button class="btn btn-sm btn-info" data-action="edit" data-id="${ticket.id}" title="Edit" aria-label="Edit"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-danger" data-action="delete" data-id="${ticket.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
          </div>
        `;
        ticketRow.addEventListener('click', () => editTicket(ticket.id));
        groupDiv.appendChild(ticketRow);
      });
    }

    ticketsList.appendChild(groupDiv);
  });
}

function showTicketContextMenu(e, ticketType) {
  e.preventDefault();
  const menu = document.getElementById('ticketContextMenu');
  menu.classList.remove('d-none');
  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';
  menu.dataset.presetType = ticketType;

  // Remove old listener and add new one
  const items = menu.querySelectorAll('.context-menu-item');
  items.forEach(item => {
    item.onclick = () => {
      if (item.dataset.menuAction === 'add-ticket') {
        openNewTicketFormWithType(ticketType);
      }
      hideContextMenu();
    };
  });
}

function hideContextMenu() {
  document.getElementById('ticketContextMenu').classList.add('d-none');
}

function openNewTicketForm() {
  document.getElementById('ticketForm').reset();
  document.getElementById('ticketId').value = '';
  document.getElementById('ticketPresetType').value = '';
  renderTicketLinks([]);
}

function openNewTicketFormWithType(ticketType) {
  document.getElementById('ticketForm').reset();
  document.getElementById('ticketId').value = '';
  document.getElementById('ticketType').value = ticketType;
  document.getElementById('ticketPresetType').value = ticketType;
  renderTicketLinks([]);

  const modal = new bootstrap.Modal(document.getElementById('ticketModal'));
  modal.show();
}

function closeTicketEditor() {
  const editorPane = document.getElementById('ticketEditorPane');
  if (editorPane) {
    editorPane.classList.add('hidden');
  }
}

function renderTicketLinks(links) {
  const linksList = document.getElementById('ticketLinksList');
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
}

function renderTicketLinksEditor(links) {
  const linksList = document.getElementById('ticketEditorLinksList');
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
}

function addTicketLink(isEditor = false) {
  const prefix = isEditor ? 'ticketEditor' : 'ticket';
  const url = document.getElementById(`${prefix}LinkUrl`).value.trim();
  const title = document.getElementById(`${prefix}LinkTitle`).value.trim();

  if (!url) {
    app.notify('URL is required', 'warning');
    return;
  }

  const linkListId = isEditor ? 'ticketEditorLinksList' : 'ticketLinksList';
  const currentLinks = Array.from(document.querySelectorAll(`#${linkListId} a`)).map(a => ({
    url: a.href,
    title: a.textContent
  }));

  currentLinks.push({ url, title: title || url });

  if (isEditor) {
    renderTicketLinksEditor(currentLinks);
  } else {
    renderTicketLinks(currentLinks);
  }

  document.getElementById(`${prefix}LinkUrl`).value = '';
  document.getElementById(`${prefix}LinkTitle`).value = '';
}

async function saveTicket() {
  // Check which form is being used
  const editorPane = document.getElementById('ticketEditorPane');
  const useSplitPane = editorPane && !editorPane.classList.contains('hidden');

  let ticketId, title, notes, ticket_type;
  if (useSplitPane) {
    ticketId = document.getElementById('ticketEditorId').value;
    title = document.getElementById('ticketEditorFormTitle').value;
    notes = document.getElementById('ticketEditorNotes').value;
    ticket_type = document.getElementById('ticketEditorType').value;
  } else {
    ticketId = document.getElementById('ticketId').value;
    title = document.getElementById('ticketTitle').value;
    notes = document.getElementById('ticketNotes').value;
    ticket_type = document.getElementById('ticketType').value;
  }

  if (!title.trim()) {
    app.notify('Title is required', 'warning');
    return;
  }

  try {
    const method = ticketId ? 'PUT' : 'POST';
    const url = ticketId ? `/api/tickets/${ticketId}` : '/api/tickets';

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ title, notes, ticket_type })
    });

    const result = await response.json();
    if (result.success) {
      app.notify(ticketId ? 'Ticket updated!' : 'Ticket created!', 'success');
      const modal = bootstrap.Modal.getInstance(document.getElementById('ticketModal'));
      if (modal) modal.hide();
      loadTickets();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error saving ticket', 'danger');
  }
}

async function deleteTicket(ticketId) {
  if (!await app.confirm('Delete this ticket?')) return;

  try {
    const response = await fetch(`/api/tickets/${ticketId}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Ticket deleted', 'success');
      loadTickets();
    } else {
      app.notify('Error deleting ticket', 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error deleting ticket', 'danger');
  }
}

async function editTicket(ticketId) {
  try {
    const response = await fetch(`/api/tickets/${ticketId}`);
    const result = await response.json();
    const ticket = result.data;

    // Check if split-pane exists
    const editorPane = document.getElementById('ticketEditorPane');
    const useSplitPane = editorPane && window.ticketSplitPane;

    if (useSplitPane) {
      // Populate split-pane form
      document.getElementById('ticketEditorId').value = ticket.id;
      document.getElementById('ticketEditorFormTitle').value = ticket.title;
      document.getElementById('ticketEditorNotes').value = ticket.notes || '';
      document.getElementById('ticketEditorType').value = ticket.ticket_type;
      renderTicketLinksEditor(ticket.links || []);

      // Show side-panel editor
      editorPane.classList.remove('hidden');
      document.getElementById('ticketEditorTitle').textContent = ticket.title;
    } else {
      // Populate modal form
      document.getElementById('ticketId').value = ticket.id;
      document.getElementById('ticketTitle').value = ticket.title;
      document.getElementById('ticketNotes').value = ticket.notes || '';
      document.getElementById('ticketType').value = ticket.ticket_type;
      renderTicketLinks(ticket.links || []);

      // Show modal
      const modal = new bootstrap.Modal(document.getElementById('ticketModal'));
      modal.show();
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error loading ticket', 'danger');
  }
}

function initTicketsEventListeners() {
  document.getElementById('addTicketBtn')?.addEventListener('click', openNewTicketForm);
  document.getElementById('saveTicketBtn')?.addEventListener('click', saveTicket);
  document.getElementById('addTicketLinkBtn')?.addEventListener('click', () => addTicketLink(false));

  // Modal form link removal
  document.getElementById('ticketsList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'edit') editTicket(parseInt(btn.dataset.id));
    else if (btn.dataset.action === 'delete') deleteTicket(parseInt(btn.dataset.id));
    else if (btn.dataset.action === 'remove-link' && btn.closest('#ticketLinksList')) {
      const links = Array.from(document.querySelectorAll('#ticketLinksList a')).map(a => ({
        url: a.href,
        title: a.textContent
      }));
      links.splice(parseInt(btn.dataset.index), 1);
      renderTicketLinks(links);
    }
  });

  // Side-panel editor buttons
  const saveEditorBtn = document.getElementById('saveTicketEditorBtn');
  const closeEditorBtn = document.getElementById('closeTicketEditorBtn');
  const editorLinkBtn = document.getElementById('ticketEditorAddLinkBtn');

  if (saveEditorBtn) {
    saveEditorBtn.addEventListener('click', async () => {
      await saveTicket();
      closeTicketEditor();
      loadTickets();
    });
  }
  if (closeEditorBtn) {
    closeEditorBtn.addEventListener('click', closeTicketEditor);
  }
  if (editorLinkBtn) {
    editorLinkBtn.addEventListener('click', () => addTicketLink(true));
  }

  // Side-panel editor link removal
  const editorPane = document.getElementById('ticketEditorPane');
  if (editorPane) {
    editorPane.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn?.dataset.action === 'remove-link' && btn.closest('#ticketEditorLinksList')) {
        const links = Array.from(document.querySelectorAll('#ticketEditorLinksList a')).map(a => ({
          url: a.href,
          title: a.textContent
        }));
        links.splice(parseInt(btn.dataset.index), 1);
        renderTicketLinksEditor(links);
      }
    });
  }

  // Close context menu on click elsewhere
  document.addEventListener('click', () => hideContextMenu());

  // Drag and drop URL support
  const ticketsList = document.getElementById('ticketsList');
  if (ticketsList) {
    ticketsList.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      ticketsList.style.opacity = '0.7';
    });

    ticketsList.addEventListener('dragleave', () => {
      ticketsList.style.opacity = '1';
    });

    ticketsList.addEventListener('drop', async (e) => {
      e.preventDefault();
      ticketsList.style.opacity = '1';

      const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
      if (!url) return;

      // Parse URL to determine ticket type and create ticket
      const ticket = parseTicketUrl(url);
      if (ticket) {
        await createTicketFromUrl(ticket.title, ticket.type, url);
      }
    });
  }
}

function parseTicketUrl(url) {
  // ServiceNow - match patterns like https://instance.service-now.com/nav_to.do?uri=incident.do?sys_id=xxx
  // or https://instance.service-now.com/...
  if (url.includes('service-now.com') || url.includes('servicenow.com')) {
    const match = url.match(/(?:incident|change_request|problem|change|cmdb_ci_service|sys_user)\.do\?sys_id=([a-f0-9]+)|[?&]sys_id=([a-f0-9]+)/i);
    const sysId = match ? (match[1] || match[2]) : '';
    return {
      type: 'ServiceNow',
      title: `SNOW-${sysId || 'ticket'}`.substring(0, 100)
    };
  }

  // Azure DevOps - match patterns like https://dev.azure.com/org/project/_workitems/edit/123456
  if (url.includes('dev.azure.com') || url.includes('visualstudio.com')) {
    const match = url.match(/[?/](\d+)(?:[/?#]|$)/);
    const workItemId = match ? match[1] : '';
    return {
      type: 'Azure DevOps',
      title: `ADO-${workItemId || 'work-item'}`.substring(0, 100)
    };
  }

  return null;
}

async function createTicketFromUrl(title, ticketType, url) {
  try {
    const response = await fetch('/api/tickets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({
        title,
        notes: `Imported from: ${url}`,
        ticket_type: ticketType
      })
    });

    const result = await response.json();
    if (result.success) {
      const ticketId = result.data.id;
      // Add the URL as a link
      await fetch(`/api/tickets/${ticketId}/links`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.APP_CONFIG?.csrfToken
        },
        body: JSON.stringify({ url, title: 'Source' })
      });

      app.notify(`Ticket created: ${title}`, 'success');
      loadTickets();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error creating ticket from URL:', error);
    app.notify('Error creating ticket from URL', 'danger');
  }
}

function initTickets() {
  // Initialize split pane for side-panel editing
  if (document.getElementById('ticketSplitPane')) {
    window.ticketSplitPane = new SplitPane('ticketSplitPane', 'ticketListPane', 'ticketDivider', 'ticketEditorPane', 66.66);
  }

  initTicketsEventListeners();
  loadTickets();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTickets);
} else {
  initTickets();
}
