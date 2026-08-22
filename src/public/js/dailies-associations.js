// Selector / associate / create-and-associate families and their modals.
// Split out of dailies.js - see dashboard.ejs for load order.
// dailies.js loads LAST and holds the DOMContentLoaded bootstrap.

// Helper: Collapse all submenus before showing context menu
function collapseContextMenuSubmenus() {
  const menu = document.getElementById("workItemContextMenu");
  if (menu) {
    menu.querySelectorAll(".context-menu-submenu").forEach(m => m.classList.add("d-none"));
  }
}

// Generic selection modal for adding associations
function showSelectionModal(title, items, callback, isTreeFormat = false) {
  const modal = document.createElement("div");
  modal.className = "modal fade";
  modal.setAttribute("tabindex", "-1");

  let bodyHtml;
  if (isTreeFormat) {
    bodyHtml = buildTreeHTML(items);
  } else {
    bodyHtml = items.length > 0
      ? `<div class="list-group">${items.map(item => `
          <button type="button" class="list-group-item list-group-item-action item-row" data-item-id="${item.id}">
            ${app.escapeHtml(item.title || item.name || item.subject || "")}
          </button>
        `).join("")}</div>`
      : '<p class="text-muted">No items available</p>';
  }

  modal.innerHTML = `
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header border-bottom">
          <h5 class="modal-title">${app.escapeHtml(title)}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body" style="max-height: 60vh; overflow-y: auto;">
          ${bodyHtml}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  const bsModal = new bootstrap.Modal(modal);

  modal.addEventListener("click", (e) => {
    const itemBtn = e.target.closest("[data-item-id]");
    if (itemBtn) {
      callback(itemBtn.dataset.itemId);
      bsModal.hide();
    }
  });

  modal.addEventListener("hidden.bs.modal", () => {
    modal.remove();
  });

  bsModal.show();
}

// Build tree HTML for hierarchical items (Priorities/Areas)
function buildTreeHTML(items, parentId = null, depth = 0, visited = new Set()) {
  // Prevent infinite recursion with depth limit and cycle detection
  const MAX_DEPTH = 50;
  if (depth > MAX_DEPTH) {
    console.warn('[buildTreeHTML] Max depth reached, stopping recursion');
    return '';
  }

  const filtered = items.filter(item => (item.parent_id === parentId || item.parent_id === null));
  const hasChildren = (itemId) => items.some(item => item.parent_id === itemId && !visited.has(item.id));

  return filtered.map(item => {
    // Detect and skip cycles
    if (visited.has(item.id)) {
      console.warn(`[buildTreeHTML] Cycle detected for item ${item.id}, skipping`);
      return '';
    }

    const newVisited = new Set(visited);
    newVisited.add(item.id);

    const childrenHtml = hasChildren(item.id) ? buildTreeHTML(items, item.id, depth + 1, newVisited) : '';
    const paddingLeft = depth * 20;
    return `
      <div style="padding-left: ${paddingLeft}px;">
        <button type="button" class="list-group-item list-group-item-action item-row" data-item-id="${item.id}">
          ${app.escapeHtml(item.title || item.name || item.subject || "")}
        </button>
        ${childrenHtml}
      </div>
    `;
  }).join('');
}

// Modal for removing associations (scoped to only currently-associated items)

// Fetch and show selection modal for projects/priorities
async function showProjectSelector(workItemId) {
  const response = await fetch('/api/priorities');
  const result = await response.json();
  const projects = result.success ? result.data : [];
  showSelectionModal('Associate Project', projects, (projectId) => {
    associateProject(workItemId, projectId);
  }, true); // Projects are hierarchical
}

// Fetch and show selection modal for areas
async function showAreaSelector(workItemId) {
  const response = await fetch('/api/areas');
  const result = await response.json();
  const areas = result.success ? result.data : [];
  showSelectionModal('Associate Category', areas, (areaId) => {
    associateArea(workItemId, areaId);
  }, true); // Areas are hierarchical
}

// Fetch and show selection modal for goals
async function showGoalSelector(workItemId) {
  const year = window.APP_CONFIG?.currentYear || new Date().getFullYear();
  const response = await fetch(`/api/goals/year/${year}`);
  const result = await response.json();
  const goals = result.success ? result.data : [];
  showSelectionModal('Associate Goal', goals, (goalId) => {
    associateGoal(workItemId, goalId);
  });
}

// Fetch and show selection modal for templates

// Fetch and show selection modal for todos
async function showTodoSelector(workItemId) {
  const response = await fetch('/api/to-dos');
  const result = await response.json();
  const todos = result.success ? result.data : [];
  showSelectionModal('Associate Todo', todos, (todoId) => {
    associateTodo(workItemId, todoId);
  });
}

// Fetch and show selection modal for tasks
async function showTaskSelector(workItemId) {
  const response = await fetch('/api/tasks');
  const result = await response.json();
  const tasks = result.success ? result.data : [];
  showSelectionModal('Associate Task', tasks, (taskId) => {
    associateTask(workItemId, taskId);
  });
}

// Fetch and show selection modal for tickets
async function showTicketSelector(workItemId) {
  const response = await fetch('/api/tickets');
  const result = await response.json();
  const tickets = result.success ? result.data : [];
  showSelectionModal('Associate Ticket', tickets, (ticketId) => {
    associateTicket(workItemId, ticketId);
  });
}

// Fetch and show selection modal for ideas
async function showIdeaSelector(workItemId) {
  const response = await fetch('/api/ideas');
  const result = await response.json();
  const ideas = result.success ? result.data : [];
  showSelectionModal('Associate Idea', ideas, (ideaId) => {
    associateIdea(workItemId, ideaId);
  });
}

// Association functions
async function associateProject(workItemId, projectId) {
  try {
    const response = await app.fetchRaw(`/api/work/${workItemId}/priorities/${projectId}`, {
      method: 'POST' });
    const result = await response.json();
    if (result.success) {
      app.notify('Project associated!', 'success');
      loadWorkItems();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error associating project:', error);
    app.notify('Error associating project', 'danger');
  }
}

async function associateArea(workItemId, areaId) {
  try {
    const response = await app.fetchRaw(`/api/work/${workItemId}/areas/${areaId}`, {
      method: 'POST' });
    const result = await response.json();
    if (result.success) {
      app.notify('Category associated!', 'success');
      loadWorkItems();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error associating area:', error);
    app.notify('Error associating category', 'danger');
  }
}

async function associateGoal(workItemId, goalId) {
  try {
    const response = await app.fetchRaw(`/api/work/${workItemId}/goals/${goalId}`, {
      method: 'POST' });
    const result = await response.json();
    if (result.success) {
      app.notify('Goal associated!', 'success');
      loadWorkItems();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error associating goal:', error);
    app.notify('Error associating goal', 'danger');
  }
}

async function associateTemplate(workItemId, templateId) {
  try {
    const response = await app.fetchRaw(`/api/work/${workItemId}/templates/${templateId}`, {
      method: 'POST' });
    const result = await response.json();
    if (result.success) {
      app.notify('Template associated!', 'success');
      loadWorkItems();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error associating template:', error);
    app.notify('Error associating template', 'danger');
  }
}

async function associateTodo(workItemId, todoId) {
  try {
    const response = await app.fetchRaw(`/api/work/${workItemId}/todos/${todoId}`, {
      method: 'POST' });
    const result = await response.json();
    if (result.success) {
      app.notify('Todo associated!', 'success');
      loadWorkItems();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error associating todo:', error);
    app.notify('Error associating todo', 'danger');
  }
}

async function associateTask(workItemId, taskId) {
  try {
    const response = await app.fetchRaw(`/api/work/${workItemId}/tasks/${taskId}`, {
      method: 'POST' });
    const result = await response.json();
    if (result.success) {
      app.notify('Task associated!', 'success');
      loadWorkItems();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error associating task:', error);
    app.notify('Error associating task', 'danger');
  }
}

async function associateTicket(workItemId, ticketId) {
  try {
    const response = await app.fetchRaw(`/api/work/${workItemId}/tickets/${ticketId}`, {
      method: 'POST' });
    const result = await response.json();
    if (result.success) {
      app.notify('Ticket associated!', 'success');
      loadWorkItems();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error associating ticket:', error);
    app.notify('Error associating ticket', 'danger');
  }
}

async function associateIdea(workItemId, ideaId) {
  try {
    const response = await app.fetchRaw(`/api/work/${workItemId}/ideas/${ideaId}`, {
      method: 'POST' });
    const result = await response.json();
    if (result.success) {
      app.notify('Idea associated!', 'success');
      loadWorkItems();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error associating idea:', error);
    app.notify('Error associating idea', 'danger');
  }
}

// Create and associate functions
async function createAndAssociateProject(workItemId) {
  const title = await app.prompt('Enter project name:', { title: 'New Project', placeholder: 'Project name' });
  if (!title) return;
  try {
    const response = await app.fetchRaw('/api/priorities', {
      method: 'POST',
      
      body: JSON.stringify({ title })
    });
    const result = await response.json();
    if (result.success) {
      app.notify('Project created and associated!', 'success');
      await associateProject(workItemId, result.data.id);
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error creating project:', error);
    app.notify('Error creating project', 'danger');
  }
}

async function createAndAssociateArea(workItemId) {
  const name = await app.prompt('Enter category name:', { title: 'New Category', placeholder: 'Category name' });
  if (!name) return;
  try {
    const response = await app.fetchRaw('/api/areas', {
      method: 'POST',
      
      body: JSON.stringify({ name })
    });
    const result = await response.json();
    if (result.success) {
      app.notify('Category created and associated!', 'success');
      await associateArea(workItemId, result.data.id);
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error creating area:', error);
    app.notify('Error creating category', 'danger');
  }
}

async function createAndAssociateGoal(workItemId) {
  const name = await app.prompt('Enter goal name:', { title: 'New Goal', placeholder: 'Goal name' });
  if (!name) return;
  try {
    const response = await app.fetchRaw('/api/goals', {
      method: 'POST',
      
      body: JSON.stringify({ name })
    });
    const result = await response.json();
    if (result.success) {
      app.notify('Goal created and associated!', 'success');
      await associateGoal(workItemId, result.data.id);
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error creating goal:', error);
    app.notify('Error creating goal', 'danger');
  }
}

async function createAndAssociateTodo(workItemId) {
  const title = await app.prompt('Enter todo title:', { title: 'New Todo', placeholder: 'Todo title' });
  if (!title) return;
  try {
    const response = await app.fetchRaw('/api/to-dos', {
      method: 'POST',
      
      body: JSON.stringify({ title })
    });
    const result = await response.json();
    if (result.success) {
      app.notify('Todo created and associated!', 'success');
      await associateTodo(workItemId, result.data.id);
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error creating todo:', error);
    app.notify('Error creating todo', 'danger');
  }
}

async function createAndAssociateTask(workItemId) {
  const title = await app.prompt('Enter task title:', { title: 'New Task', placeholder: 'Task title' });
  if (!title) return;
  try {
    const response = await app.fetchRaw('/api/tasks', {
      method: 'POST',
      
      body: JSON.stringify({ title })
    });
    const result = await response.json();
    if (result.success) {
      app.notify('Task created and associated!', 'success');
      await associateTask(workItemId, result.data.id);
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error creating task:', error);
    app.notify('Error creating task', 'danger');
  }
}

async function createAndAssociateTicket(workItemId) {
  const title = await app.prompt('Enter ticket title:', { title: 'New Ticket', placeholder: 'Ticket title' });
  if (!title) return;
  try {
    const response = await app.fetchRaw('/api/tickets', {
      method: 'POST',
      
      body: JSON.stringify({ title })
    });
    const result = await response.json();
    if (result.success) {
      app.notify('Ticket created and associated!', 'success');
      await associateTicket(workItemId, result.data.id);
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error creating ticket:', error);
    app.notify('Error creating ticket', 'danger');
  }
}

async function createAndAssociateIdea(workItemId) {
  const title = await app.prompt('Enter idea title:', { title: 'New Idea', placeholder: 'Idea title' });
  if (!title) return;
  try {
    const response = await app.fetchRaw('/api/ideas', {
      method: 'POST',
      
      body: JSON.stringify({ title })
    });
    const result = await response.json();
    if (result.success) {
      app.notify('Idea created and associated!', 'success');
      await associateIdea(workItemId, result.data.id);
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error creating idea:', error);
    app.notify('Error creating idea', 'danger');
  }
}

// Child item context menu (for associated items like categories, goals, etc.)

function showChildItemContextMenu(x, y, itemType, itemId) {
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.position = 'fixed';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.style.zIndex = '2000';

  const typeNames = {
    'priority': 'Project',
    'area': 'Category',
    'goal': 'Goal',
    'template': 'Template',
    'todo': 'Todo',
    'task': 'Task',
    'ticket': 'Ticket',
    'idea': 'Idea'
  };

  const typeName = typeNames[itemType] || itemType;

  menu.innerHTML = `
    <button type="button" class="context-menu-item" data-child-action="edit">
      <i class="bi bi-pencil"></i> Edit ${typeName}
    </button>
    <button type="button" class="context-menu-item" data-child-action="delete">
      <i class="bi bi-trash text-danger"></i> Remove ${typeName}
    </button>
  `;

  menu.addEventListener('click', async (e) => {
    const actionBtn = e.target.closest('[data-child-action]');
    if (!actionBtn) return;

    const action = actionBtn.dataset.childAction;
    document.body.removeChild(menu);

    if (action === 'edit') {
      editChildItem(itemType, itemId);
    } else if (action === 'delete') {
      if (await app.confirm(`Remove this ${typeName}?`, 'Confirm Remove')) {
        deleteChildItem(itemType, itemId);
      }
    }
  });

  document.body.appendChild(menu);

  document.addEventListener('click', function closeMenu(e) {
    if (!menu.contains(e.target)) {
      if (menu.parentNode) document.body.removeChild(menu);
      document.removeEventListener('click', closeMenu);
    }
  });
}

function deleteChildItem(itemType, itemId) {
  // Find the parent work item
  const childRow = document.querySelector(`.child-item-row[data-work-id="${itemId}"]`);
  if (!childRow) return;

  const parentWorkItemId = childRow.dataset.parentWorkId;
  if (!parentWorkItemId) return;

  // Delete the association
  const apiMap = {
    'priority': 'priorities',
    'area': 'areas',
    'goal': 'goals',
    'template': 'templates',
    'todo': 'todos',
    'task': 'tasks',
    'ticket': 'tickets',
    'idea': 'ideas'
  };

  const endpoint = apiMap[itemType];
  if (!endpoint) return;

  app.fetchRaw(`/api/work/${parentWorkItemId}/${endpoint}/${itemId}`, {
    method: 'DELETE' })
    .then(r => r.json())
    .then(result => {
      if (result.success) {
        app.notify(`${itemType} removed`, 'success');
        loadWorkItems();
      }
    })
    .catch(error => {
      console.error('Error deleting association:', error);
      app.notify('Error removing association', 'danger');
    });
}

// Edit child item - opens the appropriate editor for the item type
function editChildItem(itemType, itemId) {
  // Map item types to their editor functions
  const editorMap = {
    'priority': () => editChildPriority(itemId),
    'area': () => editChildArea(itemId),
    'goal': () => editChildGoal(itemId),
    'template': () => editChildTemplate(itemId),
    'todo': () => editChildTodo(itemId),
    'task': () => editChildTask(itemId),
    'ticket': () => editChildTicket(itemId),
    'idea': () => editChildIdea(itemId)
  };

  const editor = editorMap[itemType];
  if (editor) {
    editor();
  } else {
    console.error('Unknown item type:', itemType);
  }
}

// Create and edit item - creates new item and opens in editor
async function createAndEditItem(itemType, parentWorkItemId) {
  // Use existing create-and-associate functions which now open in editors
  const createFunctionMap = {
    'priority': () => createAndAssociateProject(parentWorkItemId),
    'area': () => createAndAssociateArea(parentWorkItemId),
    'goal': () => createAndAssociateGoal(parentWorkItemId),
    'template': () => createAndAssociateTemplate(parentWorkItemId),
    'todo': () => createAndAssociateTodo(parentWorkItemId),
    'task': () => createAndAssociateTask(parentWorkItemId),
    'ticket': () => createAndAssociateTicket(parentWorkItemId),
    'idea': () => createAndAssociateIdea(parentWorkItemId)
  };

  const createFn = createFunctionMap[itemType];
  if (createFn) {
    createFn();
  }
}

// Template creation (was missing)
async function createAndAssociateTemplate(workItemId) {
  const title = await app.prompt('Enter template name:', { title: 'New Template', placeholder: 'Template name' });
  if (!title) return;
  try {
    const response = await app.fetchRaw('/api/work-item-templates', {
      method: 'POST',
      
      body: JSON.stringify({ title })
    });
    const result = await response.json();
    if (result.success) {
      app.notify('Template created and associated!', 'success');
      await associateTemplate(workItemId, result.data.id);
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error creating template:', error);
    app.notify('Error creating template', 'danger');
  }
}

