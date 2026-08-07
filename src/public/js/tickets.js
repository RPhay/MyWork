let allTickets = [];
let expandedTicketFolders = new Set(['ServiceNow', 'Azure DevOps', 'Other']);
const TICKET_TYPE_ORDER = ['ServiceNow', 'Azure DevOps', 'Other'];

function saveTicketFolderState() {
  localStorage.setItem('expandedTicketFolders', JSON.stringify(Array.from(expandedTicketFolders)));
  localStorage.setItem('ticketTypeOrder', JSON.stringify(TICKET_TYPE_ORDER));
}

function loadTicketFolderState() {
  const saved = localStorage.getItem('expandedTicketFolders');
  if (saved) {
    try {
      expandedTicketFolders = new Set(JSON.parse(saved));
    } catch (e) {
      expandedTicketFolders = new Set(['ServiceNow', 'Azure DevOps', 'Other']);
    }
  }
}

async function loadTickets() {
  const ticketsList = document.getElementById('ticketsList');
  ticketsList.innerHTML = '<p class="text-center text-muted">Loading...</p>';

  try {
    const response = await fetch('/api/tickets');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();

    if (result.success) {
      allTickets = result.data || [];
      renderTickets();
    } else {
      ticketsList.innerHTML = '<p class="text-center text-danger">Error loading tickets</p>';
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

  // Render each group in order
  TICKET_TYPE_ORDER.forEach(type => {
    const tickets = grouped[type];
    const isExpanded = expandedTicketFolders.has(type);

    const groupDiv = document.createElement('div');
    groupDiv.className = 'ticket-group';
    groupDiv.dataset.ticketType = type;
    groupDiv.draggable = true;

    const headerDiv = document.createElement('div');
    headerDiv.className = `ticket-group-header ${type.toLowerCase().replace(' ', '-')}`;
    headerDiv.innerHTML = `
      <i class="bi ${isExpanded ? 'bi-chevron-down' : 'bi-chevron-right'} ticket-folder-toggle"></i>
      <i class="bi bi-folder2"></i>
      <strong>${app.escapeHtml(type)}</strong>
      <span class="badge bg-light text-dark ms-2">${tickets.length}</span>
    `;
    headerDiv.dataset.ticketType = type;
    headerDiv.style.cursor = 'pointer';

    // Toggle expand/collapse
    headerDiv.addEventListener('click', (e) => {
      e.stopPropagation();
      if (expandedTicketFolders.has(type)) {
        expandedTicketFolders.delete(type);
      } else {
        expandedTicketFolders.add(type);
      }
      saveTicketFolderState();
      renderTickets();
    });

    headerDiv.addEventListener('contextmenu', (e) => showTicketContextMenu(e, type));

    // Drag to reorder folders
    groupDiv.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('ticketType', type);
      groupDiv.style.opacity = '0.5';
    });

    groupDiv.addEventListener('dragend', () => {
      groupDiv.style.opacity = '1';
    });

    groupDiv.addEventListener('dragover', (e) => {
      e.preventDefault();
      const draggedType = e.dataTransfer.getData('ticketType');
      if (draggedType && draggedType !== type) {
        groupDiv.style.borderTop = '3px solid #0d6efd';
      } else {
        // Allow URL drop
        e.dataTransfer.dropEffect = 'copy';
        headerDiv.style.background = '#d9e8f5';
      }
    });

    groupDiv.addEventListener('dragleave', () => {
      groupDiv.style.borderTop = '';
      headerDiv.style.background = '';
    });

    groupDiv.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      groupDiv.style.borderTop = '';
      headerDiv.style.background = '';

      const draggedType = e.dataTransfer.getData('ticketType');
      if (draggedType && draggedType !== type) {
        // Reorder folders
        const draggedIdx = TICKET_TYPE_ORDER.indexOf(draggedType);
        const targetIdx = TICKET_TYPE_ORDER.indexOf(type);
        if (draggedIdx !== -1 && targetIdx !== -1) {
          [TICKET_TYPE_ORDER[draggedIdx], TICKET_TYPE_ORDER[targetIdx]] = [TICKET_TYPE_ORDER[targetIdx], TICKET_TYPE_ORDER[draggedIdx]];
          saveTicketFolderState();
          renderTickets();
        }
      } else {
        // URL drop
        const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
        if (url) {
          const parsed = parseTicketUrl(url);
          const title = parsed?.title || url.split('/').pop() || 'Ticket';
          createTicketFromUrl(title, type, url);
        }
      }
    });

    groupDiv.appendChild(headerDiv);

    // Render tickets only if expanded
    if (isExpanded) {
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
              <button class="btn btn-sm btn-danger" data-action="delete" data-id="${ticket.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
            </div>
          `;
          ticketRow.addEventListener('click', () => editTicket(ticket.id));
          groupDiv.appendChild(ticketRow);
        });
      }
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

    const titleSpan = document.createElement('span');
    titleSpan.className = 'flex-grow-1 cursor-pointer';
    titleSpan.innerHTML = `<a href="${app.escapeHtml(link.url)}" target="_blank" class="text-decoration-none">${app.escapeHtml(link.title || link.url)}</a>`;
    titleSpan.title = 'Click to rename';
    titleSpan.style.cursor = 'pointer';

    titleSpan.addEventListener('click', () => {
      const newTitle = prompt('Enter link title:', link.title || '');
      if (newTitle !== null) {
        link.title = newTitle;
        renderTicketLinks(links);
      }
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-sm btn-outline-danger';
    removeBtn.innerHTML = '<i class="bi bi-x"></i>';
    removeBtn.addEventListener('click', () => {
      links.splice(index, 1);
      renderTicketLinks(links);
    });

    linkEl.appendChild(titleSpan);
    linkEl.appendChild(removeBtn);
    linksList.appendChild(linkEl);
  });
}

function renderTicketLinksEditor(links) {
  const linksList = document.getElementById('ticketEditorLinksList');
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
        renderTicketLinksEditor(links);
      }
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-sm btn-outline-danger';
    removeBtn.innerHTML = '<i class="bi bi-x"></i>';
    removeBtn.addEventListener('click', () => {
      links.splice(index, 1);
      renderTicketLinksEditor(links);
    });

    linkEl.appendChild(titleSpan);
    linkEl.appendChild(removeBtn);
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
  let linkListSelector;

  if (useSplitPane) {
    ticketId = document.getElementById('ticketEditorId').value;
    title = document.getElementById('ticketEditorFormTitle').value;
    notes = document.getElementById('ticketEditorNotes').value;
    ticket_type = document.getElementById('ticketEditorType').value;
    linkListSelector = '#ticketEditorLinksList';
  } else {
    ticketId = document.getElementById('ticketId').value;
    title = document.getElementById('ticketTitle').value;
    notes = document.getElementById('ticketNotes').value;
    ticket_type = document.getElementById('ticketType').value;
    linkListSelector = '#ticketLinksList';
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
      const newTicketId = ticketId || result.data.id;

      // Save links if any exist in the form
      const linkElements = document.querySelectorAll(`${linkListSelector} a`);
      for (const linkEl of linkElements) {
        const linkUrl = linkEl.href;
        const linkTitle = linkEl.textContent;

        // Only save if not already in database (check by trying to add)
        await fetch(`/api/tickets/${newTicketId}/links`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': window.APP_CONFIG?.csrfToken
          },
          body: JSON.stringify({ url: linkUrl, title: linkTitle })
        }).catch(() => {}); // Ignore errors if link already exists
      }

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

function extractTicketNumber(url, ticketType) {
  if (ticketType === 'ServiceNow') {
    const match = url.match(/(?:incident|change_request|problem|change|cmdb_ci_service|sys_user)\.do\?sys_id=([a-f0-9]+)|[?&]sys_id=([a-f0-9]+)/i);
    const sysId = match ? (match[1] || match[2]) : '';
    return `SNOW-${sysId}`.substring(0, 20);
  } else if (ticketType === 'Azure DevOps') {
    const match = url.match(/[?/](\d+)(?:[/?#]|$)/);
    const workItemId = match ? match[1] : '';
    return `ADO-${workItemId}`.substring(0, 20);
  }
  return url.split('/').pop() || 'Link';
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
        notes: '',
        ticket_type: ticketType
      })
    });

    const result = await response.json();
    if (result.success) {
      const ticketId = result.data.id;
      // Add the URL as a link with extracted ticket number as title
      const linkTitle = extractTicketNumber(url, ticketType);
      await fetch(`/api/tickets/${ticketId}/links`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.APP_CONFIG?.csrfToken
        },
        body: JSON.stringify({ url, title: linkTitle })
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
  // Load saved state
  loadTicketFolderState();

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
