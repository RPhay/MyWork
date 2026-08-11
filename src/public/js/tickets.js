let allTickets = [];
let allToDos = [];
let allGoals = [];
let expandedTicketTypes = new Set(['ServiceNow', 'Azure DevOps', 'Other']);
let expandedTicketNodes = new Set();
const TICKET_TYPE_ORDER = ['ServiceNow', 'Azure DevOps', 'Other'];

// Association rules - what can be children of what
const ASSOCIATION_RULES = {
  ticket: ['todo', 'goal'],
  todo: ['category', 'ticket'],
  category: ['ticket', 'todo'],
};

function saveTicketFolderState() {
  localStorage.setItem('expandedTicketTypes', JSON.stringify(Array.from(expandedTicketTypes)));
  localStorage.setItem('expandedTicketNodes', JSON.stringify(Array.from(expandedTicketNodes)));
}

function loadTicketFolderState() {
  const saved1 = localStorage.getItem('expandedTicketTypes');
  const saved2 = localStorage.getItem('expandedTicketNodes');
  if (saved1) {
    try {
      expandedTicketTypes = new Set(JSON.parse(saved1));
    } catch (e) {
      expandedTicketTypes = new Set(['ServiceNow', 'Azure DevOps', 'Other']);
    }
  }
  if (saved2) {
    try {
      expandedTicketNodes = new Set(JSON.parse(saved2));
    } catch (e) {
      expandedTicketNodes = new Set();
    }
  }
}

function renderToDoInTree(todo, depth = 0, showRemove = true) {
  const removeBtn = showRemove
    ? `<button class="btn btn-sm btn-link text-danger child-remove p-0 ms-2" data-action="unlink" data-type="todo" data-id="${todo.id}" title="Unlink" aria-label="Unlink"><i class="bi bi-x-circle"></i></button>`
    : '';

  return `
    <div class="ticket-node todo-node" data-todo-id="${todo.id}" style="margin-left: ${depth * 20}px; padding: 8px 0; border-bottom: 1px solid #eee;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="flex: 1; display: flex; align-items: center; gap: 6px; font-size: 0.9rem;">
          <i class="bi bi-check2-square text-muted"></i>
          <span>${app.escapeHtml(todo.title)}</span>
        </span>
        ${removeBtn}
      </div>
    </div>
  `;
}

function renderGoalInTree(goal, depth = 0, showRemove = true) {
  const removeBtn = showRemove
    ? `<button class="btn btn-sm btn-link text-danger child-remove p-0 ms-2" data-action="unlink" data-type="goal" data-id="${goal.id}" title="Unlink" aria-label="Unlink"><i class="bi bi-x-circle"></i></button>`
    : '';

  return `
    <div class="ticket-node goal-node" data-goal-id="${goal.id}" style="margin-left: ${depth * 20}px; padding: 8px 0; border-bottom: 1px solid #eee;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="flex: 1; display: flex; align-items: center; gap: 6px; font-size: 0.9rem;">
          <i class="bi bi-target text-muted"></i>
          <span>${app.escapeHtml(goal.name)}</span>
        </span>
        ${removeBtn}
      </div>
    </div>
  `;
}

async function loadTickets() {
  const ticketsList = document.getElementById('ticketsList');
  ticketsList.innerHTML = '<p class="text-center text-muted">Loading...</p>';

  try {
    const [ticketsRes, todosRes, goalsRes] = await Promise.all([
      fetch('/api/tickets'),
      fetch('/api/to-dos'),
      fetch('/api/goals/all')
    ]);

    if (!ticketsRes.ok || !todosRes.ok || !goalsRes.ok) {
      throw new Error('HTTP error');
    }

    const ticketsResult = await ticketsRes.json();
    const todosResult = await todosRes.json();
    const goalsResult = await goalsRes.json();

    if (ticketsResult.success) {
      allTickets = ticketsResult.data || [];
      allToDos = todosResult.success ? (todosResult.data || []) : [];
      allGoals = goalsResult.success ? (goalsResult.data || []) : [];
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

  const grouped = { 'ServiceNow': [], 'Azure DevOps': [], 'Other': [] };
  allTickets.forEach(ticket => {
    if (grouped[ticket.ticket_type]) {
      grouped[ticket.ticket_type].push(ticket);
    }
  });

  TICKET_TYPE_ORDER.forEach(type => {
    const tickets = grouped[type];
    const isExpanded = expandedTicketTypes.has(type);

    const groupDiv = document.createElement('div');
    groupDiv.className = 'ticket-group';
    groupDiv.dataset.ticketType = type;

    const headerDiv = document.createElement('div');
    headerDiv.className = 'ticket-group-header';
    headerDiv.style.cursor = 'pointer';
    headerDiv.style.padding = '10px';
    headerDiv.style.background = '#f8f9fa';
    headerDiv.style.borderRadius = '4px';
    headerDiv.style.marginBottom = '8px';
    headerDiv.style.display = 'flex';
    headerDiv.style.alignItems = 'center';
    headerDiv.style.gap = '8px';
    headerDiv.style.fontWeight = '500';
    headerDiv.innerHTML = `
      <i class="bi ${isExpanded ? 'bi-chevron-down' : 'bi-chevron-right'}"></i>
      <i class="bi bi-folder2"></i>
      <span>${app.escapeHtml(type)}</span>
      <span class="badge bg-light text-dark ms-auto">${tickets.length}</span>
    `;

    headerDiv.addEventListener('click', () => {
      if (expandedTicketTypes.has(type)) {
        expandedTicketTypes.delete(type);
      } else {
        expandedTicketTypes.add(type);
      }
      saveTicketFolderState();
      renderTickets();
    });

    headerDiv.addEventListener('contextmenu', (e) => showTicketContextMenu(e, type, null));

    groupDiv.appendChild(headerDiv);

    if (isExpanded) {
      if (tickets.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'text-muted small';
        emptyDiv.style.padding = '8px';
        emptyDiv.textContent = 'No tickets';
        groupDiv.appendChild(emptyDiv);
      } else {
        tickets.forEach(ticket => {
          const isTicketExpanded = expandedTicketNodes.has(`ticket-${ticket.id}`);

          const ticketNodeDiv = document.createElement('div');
          ticketNodeDiv.className = 'ticket-node';
          ticketNodeDiv.dataset.ticketId = ticket.id;

          const ticketHeaderDiv = document.createElement('div');
          ticketHeaderDiv.style.padding = '8px';
          ticketHeaderDiv.style.borderBottom = '1px solid #eee';
          ticketHeaderDiv.style.display = 'flex';
          ticketHeaderDiv.style.alignItems = 'center';
          ticketHeaderDiv.style.gap = '8px';
          ticketHeaderDiv.style.cursor = 'pointer';
          ticketHeaderDiv.style.fontSize = '0.9rem';

          const associatedTodos = allToDos.filter(t => t.ticket_id === ticket.id);
          const associatedGoals = allGoals.filter(g => g.ticket_id === ticket.id);
          const hasChildren = associatedTodos.length > 0 || associatedGoals.length > 0;

          ticketHeaderDiv.innerHTML = `
            <span style="flex: 1; display: flex; align-items: center; gap: 6px;">
              ${hasChildren
                ? `<i class="bi ${isTicketExpanded ? 'bi-chevron-down' : 'bi-chevron-right'}" data-action="toggle-expand" style="cursor: pointer;"></i>`
                : '<span style="width: 16px;"></span>'}
              <i class="bi bi-ticket text-muted"></i>
              <strong>${app.escapeHtml(ticket.title)}</strong>
            </span>
          `;

          ticketHeaderDiv.addEventListener('click', (e) => {
            if (e.target.closest('[data-action="toggle-expand"]')) {
              e.stopPropagation();
              if (expandedTicketNodes.has(`ticket-${ticket.id}`)) {
                expandedTicketNodes.delete(`ticket-${ticket.id}`);
              } else {
                expandedTicketNodes.add(`ticket-${ticket.id}`);
              }
              saveTicketFolderState();
              renderTickets();
            } else {
              editTicket(ticket.id);
            }
          });

          ticketHeaderDiv.addEventListener('contextmenu', (e) => {
            e.stopPropagation();
            showTicketContextMenu(e, type, ticket.id);
          });

          ticketNodeDiv.appendChild(ticketHeaderDiv);

          if (isTicketExpanded && hasChildren) {
            const childrenDiv = document.createElement('div');
            childrenDiv.style.marginLeft = '8px';
            childrenDiv.style.borderLeft = '2px solid #ddd';
            childrenDiv.style.paddingLeft = '8px';

            associatedTodos.forEach(todo => {
              const todoEl = document.createElement('div');
              todoEl.innerHTML = renderToDoInTree(todo, 0, true);
              childrenDiv.appendChild(todoEl.firstChild);
            });

            associatedGoals.forEach(goal => {
              const goalEl = document.createElement('div');
              goalEl.innerHTML = renderGoalInTree(goal, 0, true);
              childrenDiv.appendChild(goalEl.firstChild);
            });

            ticketNodeDiv.appendChild(childrenDiv);
          }

          groupDiv.appendChild(ticketNodeDiv);
        });
      }
    }

    ticketsList.appendChild(groupDiv);
  });

  attachTicketNodeEventListeners();
}

function attachTicketNodeEventListeners() {
  const ticketsList = document.getElementById('ticketsList');

  // Unlink handlers
  ticketsList.addEventListener('click', (e) => {
    const unlinkBtn = e.target.closest('[data-action="unlink"]');
    if (unlinkBtn) {
      e.stopPropagation();
      const type = unlinkBtn.dataset.type;
      const id = parseInt(unlinkBtn.dataset.id);
      const ticketNode = unlinkBtn.closest('.ticket-node');
      if (type === 'todo') {
        unlinkTodoFromTicket(id, parseInt(ticketNode.dataset.ticketId));
      } else if (type === 'goal') {
        unlinkGoalFromTicket(id, parseInt(ticketNode.dataset.ticketId));
      }
    }
  });

  // Drag-and-drop handlers for associated items
  ticketsList.addEventListener('dragstart', (e) => {
    const node = e.target.closest('.todo-node, .goal-node');
    if (!node) return;

    const todoId = node.dataset.todoId;
    const goalId = node.dataset.goalId;
    const ticketNode = node.closest('.ticket-node');

    if (todoId || goalId) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('itemType', todoId ? 'todo' : 'goal');
      e.dataTransfer.setData('itemId', todoId || goalId);
      e.dataTransfer.setData('sourceTicketId', ticketNode?.dataset.ticketId || '');
      node.style.opacity = '0.5';
    }
  });

  ticketsList.addEventListener('dragend', (e) => {
    const node = e.target.closest('.todo-node, .goal-node');
    if (node) node.style.opacity = '1';
    document.querySelectorAll('.ticket-node').forEach(n => n.style.borderTop = '');
  });

  ticketsList.addEventListener('dragover', (e) => {
    e.preventDefault();
    const itemType = e.dataTransfer.getData('itemType');
    if (!itemType) return;

    const ticketNode = e.target.closest('.ticket-node');
    if (ticketNode && ticketNode.querySelector('.ticket-node-header')) {
      ticketNode.style.borderTop = '3px solid #0d6efd';
      e.dataTransfer.dropEffect = 'move';
    }
  });

  ticketsList.addEventListener('dragleave', (e) => {
    const ticketNode = e.target.closest('.ticket-node');
    if (ticketNode) ticketNode.style.borderTop = '';
  });

  ticketsList.addEventListener('drop', async (e) => {
    e.preventDefault();
    document.querySelectorAll('.ticket-node').forEach(n => n.style.borderTop = '');

    const itemType = e.dataTransfer.getData('itemType');
    const itemId = e.dataTransfer.getData('itemId');
    const targetTicketNode = e.target.closest('.ticket-node');

    if (!itemType || !itemId || !targetTicketNode) return;

    const targetTicketId = parseInt(targetTicketNode.dataset.ticketId);
    const sourceTicketId = parseInt(e.dataTransfer.getData('sourceTicketId'));

    if (targetTicketId === sourceTicketId) return;

    if (itemType === 'todo') {
      await associateTodoWithTicket(parseInt(itemId), targetTicketId);
    } else if (itemType === 'goal') {
      await associateGoalWithTicket(parseInt(itemId), targetTicketId);
    }
  });

  // Single-click to edit ticket
  ticketsList.addEventListener('click', (e) => {
    const header = e.target.closest('.ticket-node .ticket-node-header');
    if (header && !e.target.closest('[data-action]') && !e.target.closest('[data-submenu]')) {
      const ticketNode = header.closest('.ticket-node');
      if (ticketNode?.dataset.ticketId) {
        editTicket(parseInt(ticketNode.dataset.ticketId));
      }
    }
  });
}

async function associateTodoWithTicket(todoId, ticketId) {
  try {
    const response = await fetch(`/api/to-dos/${todoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ ticket_id: ticketId })
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Todo associated with ticket', 'success');
      loadTickets();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error associating todo:', error);
    app.notify('Error associating todo', 'danger');
  }
}

async function associateGoalWithTicket(goalId, ticketId) {
  try {
    const response = await fetch(`/api/goals/${goalId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ ticket_id: ticketId })
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Goal associated with ticket', 'success');
      loadTickets();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error associating goal:', error);
    app.notify('Error associating goal', 'danger');
  }
}

function showTicketContextMenu(e, ticketType, ticketId) {
  e.preventDefault();
  const menu = document.getElementById('ticketContextMenu');
  menu.classList.remove('d-none');
  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';
  menu.dataset.ticketType = ticketType;
  menu.dataset.ticketId = ticketId || '';

  menu.querySelectorAll('.context-menu-item').forEach(item => {
    item.onclick = () => {
      const action = item.dataset.action;
      if (action === 'manage-associations') {
        showManageTicketAssociationsModal(ticketId);
      } else if (action === 'delete-ticket') {
        deleteTicket(ticketId);
      }
      hideTicketContextMenu();
    };
  });
}

function hideTicketContextMenu() {
  document.getElementById('ticketContextMenu').classList.add('d-none');
}

function showManageTicketAssociationsModal(ticketId) {
  const ticket = allTickets.find(t => t.id === ticketId);
  if (!ticket) return;

  const associatedTodos = allToDos.filter(t => t.ticket_id === ticketId);
  const associatedGoals = allGoals.filter(g => g.ticket_id === ticketId);

  const itemsList = document.getElementById('ticketAssociatedItemsList');
  if (associatedTodos.length === 0 && associatedGoals.length === 0) {
    itemsList.innerHTML = '<p class="text-center text-muted">No associated items</p>';
  } else {
    let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';

    associatedTodos.forEach((todo) => {
      html += `
        <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: #f8f9fa; border-radius: 4px;">
          <i class="bi bi-check2-square"></i>
          <span style="flex: 1; font-size: 0.9rem;">${app.escapeHtml(todo.title)}</span>
          <button class="btn btn-sm btn-link p-0" data-action="unlink-item" data-type="todo" data-id="${todo.id}" title="Unlink">
            <i class="bi bi-x-circle text-danger"></i>
          </button>
        </div>
      `;
    });

    associatedGoals.forEach((goal) => {
      html += `
        <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: #f8f9fa; border-radius: 4px;">
          <i class="bi bi-target"></i>
          <span style="flex: 1; font-size: 0.9rem;">${app.escapeHtml(goal.name)}</span>
          <button class="btn btn-sm btn-link p-0" data-action="unlink-item" data-type="goal" data-id="${goal.id}" title="Unlink">
            <i class="bi bi-x-circle text-danger"></i>
          </button>
        </div>
      `;
    });

    html += '</div>';
    itemsList.innerHTML = html;

    itemsList.querySelectorAll('[data-action="unlink-item"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const type = btn.dataset.type;
        const id = parseInt(btn.dataset.id);
        if (type === 'todo') {
          await unlinkTodoFromTicket(id, ticketId);
          showManageTicketAssociationsModal(ticketId);
        } else if (type === 'goal') {
          await unlinkGoalFromTicket(id, ticketId);
          showManageTicketAssociationsModal(ticketId);
        }
      });
    });
  }

  const modal = new bootstrap.Modal(document.getElementById('manageTicketAssociationsModal'));
  modal.show();
}

function showAssociateModal(type, ticketId) {
  // TODO: Implement modal for associating items
  app.notify(`Associate ${type} feature coming soon`, 'info');
}

function openCreateTodoForTicket(ticketId) {
  window.pendingAssociateTodoToTicket = ticketId;
  // Open todo editor
  const todoForm = document.getElementById('todoForm');
  if (todoForm) {
    todoForm.reset();
    document.getElementById('todoId').value = '';
    const modal = new bootstrap.Modal(document.getElementById('todoModal'));
    modal.show();
  } else {
    app.notify('Todo editor not available', 'warning');
  }
}

function openCreateGoalForTicket(ticketId) {
  window.pendingAssociateGoalToTicket = ticketId;
  // Open goal editor
  app.notify('Create goal feature coming soon', 'info');
}

async function unlinkTodoFromTicket(todoId, ticketId) {
  try {
    const response = await fetch(`/api/to-dos/${todoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ ticket_id: null })
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Todo unlinked', 'success');
      loadTickets();
    } else {
      app.notify('Error unlinking todo', 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error unlinking todo', 'danger');
  }
}

async function unlinkGoalFromTicket(goalId, ticketId) {
  try {
    const response = await fetch(`/api/goals/${goalId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ ticket_id: null })
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Goal unlinked', 'success');
      loadTickets();
    } else {
      app.notify('Error unlinking goal', 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error unlinking goal', 'danger');
  }
}

async function deleteTicket(ticketId) {
  const ticket = allTickets.find(t => t.id === ticketId);
  const name = ticket ? ticket.title : 'this ticket';

  if (!await app.confirm(`Delete "${name}"?`)) return;

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
  const editorPane = document.getElementById('ticketEditorPane');
  const useSplitPane = editorPane && window.ticketSplitPane;

  if (useSplitPane) {
    await TicketEditor.populate(ticketId);
  } else {
    try {
      const response = await fetch(`/api/tickets/${ticketId}`);
      const result = await response.json();
      const ticket = result.data;

      document.getElementById('ticketId').value = ticket.id;
      document.getElementById('ticketTitle').value = ticket.title;
      document.getElementById('ticketNotes').value = ticket.notes || '';
      document.getElementById('ticketType').value = ticket.ticket_type;
      renderTicketLinks(ticket.links || []);

      const modal = new bootstrap.Modal(document.getElementById('ticketModal'));
      modal.show();
    } catch (error) {
      console.error('Error:', error);
      app.notify('Error loading ticket', 'danger');
    }
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
    TicketEditor.renderLinks(currentLinks);
  } else {
    renderTicketLinks(currentLinks);
  }

  document.getElementById(`${prefix}LinkUrl`).value = '';
  document.getElementById(`${prefix}LinkTitle`).value = '';
}

function initTickets() {
  loadTicketFolderState();

  const editorPane = document.getElementById('ticketEditorPane');
  if (editorPane) {
    window.ticketSplitPane = new SplitPane('ticketSplitPane', 'ticketListPane', 'ticketDivider', 'ticketEditorPane', 66.66);
    TicketEditor.init(window.ticketSplitPane);
  }

  document.getElementById('addTicketBtn')?.addEventListener('click', () => {
    const modal = new bootstrap.Modal(document.getElementById('ticketModal'));
    modal.show();
  });

  document.getElementById('ticketEditorAddLinkBtn')?.addEventListener('click', () => addTicketLink(true));

  document.addEventListener('click', () => hideTicketContextMenu());

  loadTickets();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTickets);
} else {
  initTickets();
}
