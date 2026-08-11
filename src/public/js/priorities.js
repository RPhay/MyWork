let expandedPriorities = new Set();
let expandedProjectFolders = new Set();
let expandedProjectTaskFolders = new Set();
let allPriorities = [];
let allToDos = [];
let allToDoFolders = [];
let allTasks = [];
let allTaskFolders = [];

function renderCategoryInTree(category, depth) {
  return `
    <div class="priority-node category-node" data-category-id="${category.id}">
      <div class="priority-node-header category-node-header" style="cursor: default;">
        <span class="priority-title-cell">
          <span style="display:inline-block; width: ${depth * 18}px; flex: none;"></span>
          <span class="priority-toggle"></span>
          <i class="bi ${APP_ICONS.area} text-muted"></i>
          <span class="priority-title">${app.escapeHtml(category.name || category.path)}</span>
        </span>
      </div>
    </div>
  `;
}

function renderGoalInTree(goal, depth) {
  return `
    <div class="priority-node goal-node" data-goal-id="${goal.id}">
      <div class="priority-node-header goal-node-header" style="cursor: default;">
        <span class="priority-title-cell">
          <span style="display:inline-block; width: ${depth * 18}px; flex: none;"></span>
          <span class="priority-toggle"></span>
          <i class="bi ${APP_ICONS.goal} text-muted"></i>
          <span class="priority-title">${app.escapeHtml(goal.name)}</span>
        </span>
      </div>
    </div>
  `;
}

function renderToDoInTree(toDo, depth, showRemove = true) {
  const hasLinks = toDo.links && toDo.links.length > 0;
  const linksBadge = hasLinks
    ? `<span class="badge bg-info text-white" title="Has links">🔗</span>`
    : '';
  const status = toDo.status || 'incomplete';
  const statusIcon = app.statusIcon(status);
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
  const removeBtn = showRemove
    ? `<button class="btn btn-sm btn-link text-danger child-remove p-0" data-action="unlink" data-type="todo" data-child-id="${toDo.id}" title="Remove" aria-label="Remove"><i class="bi bi-x-circle"></i></button>`
    : '';

  // Find children of this todo (todos with parent_id === this.id)
  const children = allToDos.filter(t => t.parent_id === toDo.id);
  const childrenHtml = children.length > 0
    ? `<div class="priority-node-children">
        ${children.map(child => renderToDoInTree(child, depth + 1, false)).join('')}
      </div>`
    : '';

  return `
    <div class="priority-node todo-node ${children.length > 0 ? 'expanded' : ''}" data-todo-id="${toDo.id}">
      <div class="priority-node-header todo-node-header" draggable="true" style="cursor: grab;">
        <span class="priority-title-cell">
          <span style="display:inline-block; width: ${depth * 18}px; flex: none;"></span>
          ${children.length > 0
            ? '<i class="bi bi-chevron-right priority-toggle" data-action="toggle-expand"></i>'
            : '<span class="priority-toggle"></span>'}
          <button type="button" class="todo-item-checkbox ${status !== 'incomplete' ? 'status-' + status : ''}" data-action="toggle-complete" data-id="${toDo.id}" data-status="${status}" title="${statusLabel} — click to change" aria-label="${statusLabel} — click to change">
            ${statusIcon ? `<i class="bi ${statusIcon}"></i>` : ''}
          </button>
          <span class="priority-title" ${status === 'complete' ? 'style="text-decoration: line-through; opacity: 0.6;"' : ''}>${app.escapeHtml(toDo.title)}</span>
          ${linksBadge}
        </span>
        <span class="priority-badges"><small class="text-muted">${app.escapeHtml(toDo.notes || '')}</small></span>
        <span class="priority-badges"></span>
        <span class="priority-actions">
          ${removeBtn}
        </span>
      </div>
      ${childrenHtml}
    </div>
  `;
}

function renderIdeaInTree(idea, depth, showRemove = true) {
  const removeBtn = showRemove
    ? `<button class="btn btn-sm btn-link text-danger child-remove p-0" data-action="unlink" data-type="idea" data-child-id="${idea.id}" title="Remove" aria-label="Remove"><i class="bi bi-x-circle"></i></button>`
    : '';

  return `
    <div class="priority-node idea-node" data-idea-id="${idea.id}">
      <div class="priority-node-header idea-node-header" draggable="true" style="cursor: grab;">
        <span class="priority-title-cell">
          <span style="display:inline-block; width: ${depth * 18}px; flex: none;"></span>
          <span class="priority-toggle"></span>
          <i class="bi bi-lightbulb text-muted"></i>
          <span class="priority-title">${app.escapeHtml(idea.title)}</span>
        </span>
        <span class="priority-badges"><small class="text-muted">${app.escapeHtml(idea.notes || '')}</small></span>
        <span class="priority-badges"></span>
        <span class="priority-actions">
          ${removeBtn}
        </span>
      </div>
    </div>
  `;
}

function renderTicketInTree(ticket, depth, showRemove = true) {
  const removeBtn = showRemove
    ? `<button class="btn btn-sm btn-link text-danger child-remove p-0" data-action="unlink" data-type="ticket" data-child-id="${ticket.id}" title="Remove" aria-label="Remove"><i class="bi bi-x-circle"></i></button>`
    : '';

  return `
    <div class="priority-node ticket-node" data-ticket-id="${ticket.id}">
      <div class="priority-node-header ticket-node-header" draggable="true" style="cursor: grab;">
        <span class="priority-title-cell">
          <span style="display:inline-block; width: ${depth * 18}px; flex: none;"></span>
          <span class="priority-toggle"></span>
          <i class="bi bi-ticket text-muted"></i>
          <span class="priority-title">${app.escapeHtml(ticket.title)}</span>
        </span>
        <span class="priority-badges"><small class="text-muted">${app.escapeHtml(ticket.notes || '')}</small></span>
        <span class="priority-badges"></span>
        <span class="priority-actions">
          ${removeBtn}
        </span>
      </div>
    </div>
  `;
}

// Aggregate status for a folder shown under a project: failed beats incomplete
// beats skipped, and only "all complete" reads as complete. An empty folder
// (nothing in it yet) reads as incomplete rather than trivially "complete".
function computeFolderStatus(todos) {
  if (todos.length === 0) return 'incomplete';
  if (todos.some(td => (td.status || 'incomplete') === 'failed')) return 'failed';
  if (todos.some(td => (td.status || 'incomplete') === 'incomplete')) return 'incomplete';
  if (todos.some(td => (td.status || 'incomplete') === 'skipped')) return 'skipped';
  return 'complete';
}

function renderFolderInProjectTree(folder, todosInFolder, depth) {
  const hasChildren = todosInFolder.length > 0;
  const isExpanded = expandedProjectFolders.has(String(folder.id));
  const status = computeFolderStatus(todosInFolder);
  const statusIcon = app.statusIcon(status);
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

  const childrenHtml = hasChildren
    ? `<div class="priority-node-children">${todosInFolder.map(td => renderToDoInTree(td, depth + 1, false)).join('')}</div>`
    : '';

  return `
    <div class="priority-node project-folder-node ${isExpanded ? 'expanded' : ''}" data-project-folder-id="${folder.id}">
      <div class="priority-node-header">
        <span class="priority-title-cell">
          <span style="display:inline-block; width: ${depth * 18}px; flex: none;"></span>
          ${hasChildren
            ? '<i class="bi bi-chevron-right priority-toggle" data-action="toggle-expand"></i>'
            : '<span class="priority-toggle"></span>'}
          <span class="todo-item-checkbox todo-item-checkbox-readonly ${status !== 'incomplete' ? 'status-' + status : ''}" title="${statusLabel} (all to-dos in this folder)" aria-label="${statusLabel}">
            ${statusIcon ? `<i class="bi ${statusIcon}"></i>` : ''}
          </span>
          <span class="priority-title">${app.escapeHtml(folder.name)}</span>
        </span>
        <span class="priority-badges"></span>
        <span class="priority-badges"></span>
        <span class="priority-actions">
          <button class="btn btn-sm btn-link text-danger child-remove p-0" data-action="unlink-folder" data-type="todo-folder" data-folder-id="${folder.id}" title="Remove folder from project" aria-label="Remove folder from project"><i class="bi bi-x-circle"></i></button>
        </span>
      </div>
      ${childrenHtml}
    </div>
  `;
}

function renderTaskInTree(task, depth, showRemove = true) {
  const hasLinks = task.links && task.links.length > 0;
  const linksBadge = hasLinks
    ? `<span class="badge bg-info text-white" title="Has links">🔗</span>`
    : '';
  const status = task.status || 'incomplete';
  const statusIcon = app.statusIcon(status);
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
  const removeBtn = showRemove
    ? `<button class="btn btn-sm btn-link text-danger child-remove p-0" data-action="unlink" data-type="task" data-child-id="${task.id}" title="Remove" aria-label="Remove"><i class="bi bi-x-circle"></i></button>`
    : '';

  // Find children of this task (tasks with parent_id === this.id)
  const children = allTasks.filter(t => t.parent_id === task.id);
  const childrenHtml = children.length > 0
    ? `<div class="priority-node-children">
        ${children.map(child => renderTaskInTree(child, depth + 1, false)).join('')}
      </div>`
    : '';

  return `
    <div class="priority-node task-node ${children.length > 0 ? 'expanded' : ''}" data-task-id="${task.id}">
      <div class="priority-node-header task-node-header" draggable="true" style="cursor: grab;">
        <span class="priority-title-cell">
          <span style="display:inline-block; width: ${depth * 18}px; flex: none;"></span>
          ${children.length > 0
            ? '<i class="bi bi-chevron-right priority-toggle" data-action="toggle-expand"></i>'
            : '<span class="priority-toggle"></span>'}
          <button type="button" class="todo-item-checkbox ${status !== 'incomplete' ? 'status-' + status : ''}" data-action="toggle-complete" data-id="${task.id}" data-status="${status}" title="${statusLabel} — click to change" aria-label="${statusLabel} — click to change">
            ${statusIcon ? `<i class="bi ${statusIcon}"></i>` : ''}
          </button>
          <span class="priority-title" ${status === 'complete' ? 'style="text-decoration: line-through; opacity: 0.6;"' : ''}>${app.escapeHtml(task.title)}</span>
          ${linksBadge}
        </span>
        <span class="priority-badges"><small class="text-muted">${app.escapeHtml(task.notes || '')}</small></span>
        <span class="priority-badges"></span>
        <span class="priority-actions">
          ${removeBtn}
        </span>
      </div>
      ${childrenHtml}
    </div>
  `;
}

function renderTaskFolderInProjectTree(folder, tasksInFolder, depth) {
  const hasChildren = tasksInFolder.length > 0;
  const isExpanded = expandedProjectTaskFolders.has(String(folder.id));
  const status = computeFolderStatus(tasksInFolder);
  const statusIcon = app.statusIcon(status);
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

  const childrenHtml = hasChildren
    ? `<div class="priority-node-children">${tasksInFolder.map(t => renderTaskInTree(t, depth + 1, false)).join('')}</div>`
    : '';

  return `
    <div class="priority-node project-task-folder-node ${isExpanded ? 'expanded' : ''}" data-project-task-folder-id="${folder.id}">
      <div class="priority-node-header">
        <span class="priority-title-cell">
          <span style="display:inline-block; width: ${depth * 18}px; flex: none;"></span>
          ${hasChildren
            ? '<i class="bi bi-chevron-right priority-toggle" data-action="toggle-expand"></i>'
            : '<span class="priority-toggle"></span>'}
          <span class="todo-item-checkbox todo-item-checkbox-readonly ${status !== 'incomplete' ? 'status-' + status : ''}" title="${statusLabel} (all tasks in this folder)" aria-label="${statusLabel}">
            ${statusIcon ? `<i class="bi ${statusIcon}"></i>` : ''}
          </span>
          <span class="priority-title">${app.escapeHtml(folder.name)}</span>
        </span>
        <span class="priority-badges"></span>
        <span class="priority-badges"></span>
        <span class="priority-actions">
          <button class="btn btn-sm btn-link text-danger child-remove p-0" data-action="unlink-folder" data-type="task-folder" data-folder-id="${folder.id}" title="Remove folder from project" aria-label="Remove folder from project"><i class="bi bi-x-circle"></i></button>
        </span>
      </div>
      ${childrenHtml}
    </div>
  `;
}

function renderPriorityNode(priority, byParent, depth) {
  const children = byParent.get(priority.id) || [];
  const linkedFolders = allToDoFolders.filter(f => f.priority_id === priority.id);
  const linkedFolderIds = new Set(linkedFolders.map(f => f.id));
  // Exclude to-dos already covered by a linked folder so they don't render twice
  // if both the to-do and its folder end up associated with this project.
  const directToDos = allToDos.filter(td => td.priority_id === priority.id && !linkedFolderIds.has(td.folder_id));
  const linkedTaskFolders = allTaskFolders.filter(f => f.priority_id === priority.id);
  const linkedTaskFolderIds = new Set(linkedTaskFolders.map(f => f.id));
  const directTasks = allTasks.filter(t => t.priority_id === priority.id && !linkedTaskFolderIds.has(t.folder_id));
  const directIdeas = (window.allIdeas || []).filter(i => i.priority_id === priority.id);
  const categories = priority.areas || [];
  const goals = priority.goals || [];

  const hasChildren = children.length > 0 || linkedFolders.length > 0 || directToDos.length > 0
    || linkedTaskFolders.length > 0 || directTasks.length > 0 || directIdeas.length > 0 || categories.length > 0 || goals.length > 0;

  // Auto-expand if priority has associated categories or goals
  const hasAssociations = categories.length > 0 || goals.length > 0;
  if (hasAssociations && !expandedPriorities.has(String(priority.id))) {
    expandedPriorities.add(String(priority.id));
  }

  const isExpanded = expandedPriorities.has(String(priority.id));

  let childrenHtml = '';
  if (hasChildren) {
    let html = '';
    // Render sub-projects
    html += children.map(c => renderPriorityNode(c, byParent, depth + 1)).join('');
    // Render categories
    html += categories.map(cat => renderCategoryInTree(cat, depth + 1)).join('');
    // Render goals
    html += goals.map(goal => renderGoalInTree(goal, depth + 1)).join('');
    // Render linked to-do folders (live - always shows whatever's currently in the folder)
    html += linkedFolders.map(f => renderFolderInProjectTree(f, allToDos.filter(td => td.folder_id === f.id), depth + 1)).join('');
    // Render directly associated todos
    html += directToDos.map(td => renderToDoInTree(td, depth + 1)).join('');
    // Render linked task folders (live)
    html += linkedTaskFolders.map(f => renderTaskFolderInProjectTree(f, allTasks.filter(t => t.folder_id === f.id), depth + 1)).join('');
    // Render directly associated tasks
    html += directTasks.map(t => renderTaskInTree(t, depth + 1)).join('');
    // Render directly associated ideas
    html += directIdeas.map(i => renderIdeaInTree(i, depth + 1)).join('');
    // Render directly associated tickets
    const directTickets = (window.allTickets || []).filter(t => t.priority_id === priority.id);
    html += directTickets.map(t => renderTicketInTree(t, depth + 1)).join('');
    childrenHtml = `<div class="priority-node-children">${html}</div>`;
  }

  const hasLinks = priority.hasLinks || false;
  const linksBadge = hasLinks
    ? `<span class="badge bg-info text-white" title="Has links">🔗</span>`
    : '';

  return `
    <div class="priority-node ${isExpanded ? 'expanded' : ''}" data-priority-id="${priority.id}">
      <div class="priority-node-header" draggable="true">
        <span class="priority-title-cell">
          <span style="display:inline-block; width: ${depth * 18}px; flex: none;"></span>
          ${hasChildren
            ? '<i class="bi bi-chevron-right priority-toggle" data-action="toggle-expand"></i>'
            : '<span class="priority-toggle"></span>'}
          <i class="bi ${APP_ICONS.project} text-muted"></i>
          <span class="priority-title">${app.escapeHtml(priority.title)}</span>
          ${linksBadge}
        </span>
        <span class="priority-actions">
          <button class="btn btn-sm btn-danger" data-action="delete" data-id="${priority.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
        </span>
      </div>
      ${childrenHtml}
    </div>
  `;
}

function renderPrioritiesList(priorities) {
  const container = document.getElementById('prioritiesList');

  if (!priorities || priorities.length === 0) {
    container.innerHTML = '<p class="text-center text-muted">No projects yet</p>';
    return;
  }

  const byParent = app.groupByParent(priorities);
  const topLevel = byParent.get(null) || [];

  if (topLevel.length === 0) {
    container.innerHTML = '<p class="text-center text-muted">No projects yet</p>';
    return;
  }

  container.innerHTML = topLevel.map(p => renderPriorityNode(p, byParent, 0)).join('');
}

async function loadPriorities() {
  const container = document.getElementById('prioritiesList');
  if (!container) {
    console.error('[Priorities] Container prioritiesList not found');
    return;
  }
  container.innerHTML = '<p class="text-center text-muted">Loading...</p>';

  try {
    // Load projects
    const prioResponse = await fetch('/api/priorities');
    if (!prioResponse.ok) throw new Error(`HTTP ${prioResponse.status}`);
    const prioResult = await prioResponse.json();

    // Load todos
    const todoResponse = await fetch('/api/to-dos');
    if (!todoResponse.ok) throw new Error(`HTTP ${todoResponse.status}`);
    const todoResult = await todoResponse.json();

    // Load tasks
    const taskResponse = await fetch('/api/tasks');
    if (!taskResponse.ok) throw new Error(`HTTP ${taskResponse.status}`);
    const taskResult = await taskResponse.json();

    // Load ideas
    const ideaResponse = await fetch('/api/ideas');
    if (!ideaResponse.ok) throw new Error(`HTTP ${ideaResponse.status}`);
    const ideaResult = await ideaResponse.json();

    // Load tickets
    const ticketResponse = await fetch('/api/tickets');
    if (!ticketResponse.ok) throw new Error(`HTTP ${ticketResponse.status}`);
    const ticketResult = await ticketResponse.json();

    if (prioResult.success && todoResult.success && taskResult.success && ideaResult.success && ticketResult.success) {
      allPriorities = prioResult.data;
      allToDos = todoResult.data || [];
      allToDoFolders = []; // Folders no longer exist - they're just todos with children
      allTasks = taskResult.data || [];
      allTaskFolders = []; // Folders no longer exist - they're just tasks with children
      window.allIdeas = ideaResult.data || [];
      window.allTickets = ticketResult.data || [];
      renderPrioritiesList(allPriorities);
      loadPriorityRightPanel();
    } else {
      console.error('Failed results:', { prioResult, todoResult, taskResult, ideaResult, ticketResult });
      container.innerHTML = '<p class="text-center text-danger">Error loading projects</p>';
    }
  } catch (error) {
    console.error('Error loading priorities:', error);
    container.innerHTML = '<p class="text-center text-danger">Error loading projects</p>';
  }
}

async function loadPriorityRightPanel() {
  // Categories (areas)
  try {
    const response = await fetch('/api/areas');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    const div = document.getElementById('projCategoriesListRight');

    if (result.success && result.data.length > 0) {
      div.innerHTML = app.flattenTree(result.data).map(a => `
        <div class="area-item" draggable="true" data-type="area" data-id="${a.id}" data-name="${app.escapeHtml(a.name)}" style="margin-left: ${a.depth * 14}px;">
          <span><i class="bi ${APP_ICONS.area}"></i> ${app.escapeHtml(a.name)}</span>
          <small class="text-muted">→</small>
        </div>
      `).join('');
      setupDragListeners();
    } else {
      div.innerHTML = '<small class="text-muted">No categories</small>';
    }
  } catch (error) {
    console.error('Error loading categories:', error);
  }

  // Goals
  try {
    const year = window.APP_CONFIG?.currentYear || new Date().getFullYear();
    const response = await fetch(`/api/goals/year/${year}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    const div = document.getElementById('projGoalsListRight');

    if (result.success && result.data.length > 0) {
      div.innerHTML = result.data.map(g => `
        <div class="goal-item" draggable="true" data-type="goal" data-id="${g.id}" data-name="${app.escapeHtml(g.name)}">
          <span><i class="bi ${APP_ICONS.goal}"></i> ${app.escapeHtml(g.name)}</span>
          <small class="text-muted">→</small>
        </div>
      `).join('');
      setupDragListeners();
    } else {
      div.innerHTML = '<small class="text-muted">No goals</small>';
    }
  } catch (error) {
    console.error('Error loading goals:', error);
  }

  // To Dos
  try {
    const response = await fetch('/api/to-dos');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    const div = document.getElementById('projToDosListRight');

    if (result.success && result.data.length > 0) {
      const toDos = result.data;
      const folderById = new Map(allToDoFolders.map(f => [f.id, f]));

      // Group by Todos-tab folder, so this drawer stays a "browse to-dos to drag
      // onto a project" view regardless of any existing project association.
      const folderGroups = {};
      const unfiledToDos = [];

      toDos.forEach(td => {
        if (td.folder_id) {
          if (!folderGroups[td.folder_id]) folderGroups[td.folder_id] = { items: [] };
          folderGroups[td.folder_id].items.push(td);
        } else {
          unfiledToDos.push(td);
        }
      });

      let html = '';

      // Render unfiled todos
      if (unfiledToDos.length > 0) {
        html += '<div class="todo-group-header mb-2" data-folder-id="null" style="padding: 0.5rem 0.75rem; background: #f8f9fa; border-radius: 4px; cursor: pointer; font-weight: 500;">Unfiled</div>';
        html += unfiledToDos.map(td => `
          <div class="todo-item" draggable="true" data-type="todo" data-id="${td.id}" data-name="${app.escapeHtml(td.title)}" data-folder-id="null" style="padding: 0.25rem 0.5rem; cursor: move; margin-left: 0.5rem;">
            <small><i class="bi bi-check2-square"></i> ${app.escapeHtml(td.title)}</small>
            <small class="text-muted float-end">→</small>
          </div>
        `).join('');
      }

      // Render todos grouped by folder; the group header is itself a drag source
      // (type "todo-folder") so the whole folder can be dropped onto a project.
      Object.entries(folderGroups).forEach(([folderId, group]) => {
        const folder = folderById.get(parseInt(folderId));
        const folderName = folder ? folder.name : 'Folder';
        html += `<div class="todo-group-header mb-2" draggable="true" data-type="todo-folder" data-id="${folderId}" data-name="${app.escapeHtml(folderName)}" data-folder-id="${folderId}" style="padding: 0.5rem 0.75rem; background: #f8f9fa; border-radius: 4px; cursor: move; font-weight: 500;"><i class="bi bi-folder-check" style="transform: rotate(0deg); transition: transform 0.15s;"></i> ${app.escapeHtml(folderName)} (${group.items.length})</div>`;
        html += group.items.map(td => `
          <div class="todo-item" draggable="true" data-type="todo" data-id="${td.id}" data-name="${app.escapeHtml(td.title)}" data-folder-id="${folderId}" style="padding: 0.25rem 0.5rem; cursor: move; margin-left: 1.5rem;">
            <small><i class="bi bi-check2-square"></i> ${app.escapeHtml(td.title)}</small>
            <small class="text-muted float-end">→</small>
          </div>
        `).join('');
      });

      div.innerHTML = html || '<small class="text-muted">No to dos</small>';
      setupDragListeners();

      // Add click handlers for todo items
      div.querySelectorAll('.todo-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const todoId = parseInt(item.dataset.id);
          editProjectToDo(todoId);
        });
      });
    } else {
      div.innerHTML = '<small class="text-muted">No to dos</small>';
    }
  } catch (error) {
    console.error('Error loading todos:', error);
  }

  // Tasks
  try {
    const response = await fetch('/api/tasks');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    const div = document.getElementById('projTasksListRight');

    if (result.success && result.data.length > 0) {
      const tasks = result.data;
      const folderById = new Map(allTaskFolders.map(f => [f.id, f]));

      // Group by Tasks-tab folder, so this drawer stays a "browse tasks to drag
      // onto a project" view regardless of any existing project association.
      const folderGroups = {};
      const unfiledTasks = [];

      tasks.forEach(t => {
        if (t.folder_id) {
          if (!folderGroups[t.folder_id]) folderGroups[t.folder_id] = { items: [] };
          folderGroups[t.folder_id].items.push(t);
        } else {
          unfiledTasks.push(t);
        }
      });

      let html = '';

      // Render unfiled tasks
      if (unfiledTasks.length > 0) {
        html += '<div class="todo-group-header mb-2" data-folder-id="null" style="padding: 0.5rem 0.75rem; background: #f8f9fa; border-radius: 4px; cursor: pointer; font-weight: 500;">Unfiled</div>';
        html += unfiledTasks.map(t => `
          <div class="todo-item" draggable="true" data-type="task" data-id="${t.id}" data-name="${app.escapeHtml(t.title)}" data-folder-id="null" style="padding: 0.25rem 0.5rem; cursor: move; margin-left: 0.5rem;">
            <small><i class="bi bi-card-checklist"></i> ${app.escapeHtml(t.title)}</small>
            <small class="text-muted float-end">→</small>
          </div>
        `).join('');
      }

      // Render tasks grouped by folder; the group header is itself a drag source
      // (type "task-folder") so the whole folder can be dropped onto a project.
      Object.entries(folderGroups).forEach(([folderId, group]) => {
        const folder = folderById.get(parseInt(folderId));
        const folderName = folder ? folder.name : 'Folder';
        html += `<div class="todo-group-header mb-2" draggable="true" data-type="task-folder" data-id="${folderId}" data-name="${app.escapeHtml(folderName)}" data-folder-id="${folderId}" style="padding: 0.5rem 0.75rem; background: #f8f9fa; border-radius: 4px; cursor: move; font-weight: 500;"><i class="bi bi-folder-check" style="transform: rotate(0deg); transition: transform 0.15s;"></i> ${app.escapeHtml(folderName)} (${group.items.length})</div>`;
        html += group.items.map(t => `
          <div class="todo-item" draggable="true" data-type="task" data-id="${t.id}" data-name="${app.escapeHtml(t.title)}" data-folder-id="${folderId}" style="padding: 0.25rem 0.5rem; cursor: move; margin-left: 1.5rem;">
            <small><i class="bi bi-card-checklist"></i> ${app.escapeHtml(t.title)}</small>
            <small class="text-muted float-end">→</small>
          </div>
        `).join('');
      });

      div.innerHTML = html || '<small class="text-muted">No tasks</small>';
      setupDragListeners();
    } else {
      div.innerHTML = '<small class="text-muted">No tasks</small>';
    }
  } catch (error) {
    console.error('Error loading tasks:', error);
  }
}

async function deleteProject(projectId) {
  const projectName = document.querySelector(`[data-priority-id="${projectId}"] .priority-title`)?.textContent || 'this project';

  if (!await app.confirm(`Delete "${projectName}"? This will remove it from all contexts.`)) {
    return;
  }

  try {
    const response = await fetch(`/api/priorities/${projectId}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Project deleted', 'success');
      PriorityEditor.close();
      loadPriorities();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error deleting project:', error);
    app.notify('Error deleting project', 'danger');
  }
}

function initProjRightPanelTabs() {
  // Handle folder toggling for associate items
  document.querySelectorAll('.associate-folder-header').forEach(header => {
    header.addEventListener('click', () => {
      const folder = header.dataset.folder;
      const content = document.querySelector(`.associate-folder-content[data-folder="${folder}"]`);
      const toggle = header.querySelector('.associate-folder-toggle');

      if (content) {
        const isOpen = content.style.display !== 'none';
        content.style.display = isOpen ? 'none' : 'block';
        if (toggle) {
          toggle.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
        }
        localStorage.setItem(`projFolder_${folder}`, isOpen ? 'closed' : 'open');
      }
    });

    // Restore state from localStorage
    const folder = header.dataset.folder;
    const savedState = localStorage.getItem(`projFolder_${folder}`);
    const content = document.querySelector(`.associate-folder-content[data-folder="${folder}"]`);
    const toggle = header.querySelector('.associate-folder-toggle');

    if (savedState === 'open' && content) {
      content.style.display = 'block';
      if (toggle) toggle.style.transform = 'rotate(90deg)';
    }
  });
}

async function linkCategoryOrGoalToPriority(priorityId, type, id) {
  const path = type === 'area' ? 'areas' : type === 'goal' ? 'goals' : null;
  if (!path) return;

  try {
    const response = await fetch(`/api/priorities/${priorityId}/${path}/${id}`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });
    const result = await response.json();
    if (result.success) {
      loadPriorities();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error linking to project:', error);
    app.notify('Error linking to project', 'danger');
  }
}

async function linkToDoToPriority(toDoId, priorityId) {
  try {
    const response = await fetch(`/api/to-dos/${toDoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ priority_id: priorityId })
    });
    const result = await response.json();
    if (result.success) {
      app.notify('To Do associated with project', 'success');
      loadPriorities();
      loadPriorityRightPanel();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error linking to do to project:', error);
    app.notify('Error linking to do to project', 'danger');
  }
}

async function unlinkToDoFromProject(toDoId) {
  try {
    const response = await fetch(`/api/to-dos/${toDoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ priority_id: null })
    });
    const result = await response.json();
    if (result.success) {
      app.notify('To Do removed from project', 'success');
      loadPriorities();
      loadPriorityRightPanel();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error unlinking to do from project:', error);
    app.notify('Error unlinking to do from project', 'danger');
  }
}

async function linkFolderToPriority(folderId, priorityId) {
  // Folders no longer exist - they're just todos with children
  app.notify('Folder linking is no longer available', 'info');
}

async function unlinkFolderFromProject(folderId) {
  // Folders no longer exist - they're just todos with children
  app.notify('Folder linking is no longer available', 'info');
}

async function linkTaskToPriority(taskId, priorityId) {
  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ priority_id: priorityId })
    });
    const result = await response.json();
    if (result.success) {
      app.notify('Task associated with project', 'success');
      loadPriorities();
      loadPriorityRightPanel();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error linking task to project:', error);
    app.notify('Error linking task to project', 'danger');
  }
}

async function unlinkTaskFromProject(taskId) {
  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ priority_id: null })
    });
    const result = await response.json();
    if (result.success) {
      app.notify('Task removed from project', 'success');
      loadPriorities();
      loadPriorityRightPanel();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error unlinking task from project:', error);
    app.notify('Error unlinking task from project', 'danger');
  }
}

async function unlinkIdeaFromProject(ideaId) {
  try {
    const response = await fetch(`/api/ideas/${ideaId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ priority_id: null })
    });
    const result = await response.json();
    if (result.success) {
      app.notify('Idea removed from project', 'success');
      loadPriorities();
      loadPriorityRightPanel();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error unlinking idea from project:', error);
    app.notify('Error unlinking idea from project', 'danger');
  }
}

async function unlinkTicketFromProject(ticketId) {
  try {
    const response = await fetch(`/api/tickets/${ticketId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ priority_id: null })
    });
    const result = await response.json();
    if (result.success) {
      app.notify('Ticket removed from project', 'success');
      loadPriorities();
      loadPriorityRightPanel();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error unlinking ticket from project:', error);
    app.notify('Error unlinking ticket from project', 'danger');
  }
}

async function linkTaskFolderToPriority(folderId, priorityId) {
  // Folders no longer exist - they're just tasks with children
  app.notify('Folder linking is no longer available', 'info');
}

async function unlinkTaskFolderFromProject(folderId) {
  // Folders no longer exist - they're just tasks with children
  app.notify('Folder linking is no longer available', 'info');
}

async function cycleProjectTaskStatus(taskId, currentStatus) {
  const result = await app.cycleStatus(`/api/tasks/${taskId}`, currentStatus);
  if (result.success) {
    loadPriorities();
  } else {
    app.notify('Error: ' + result.message, 'danger');
  }
}

async function openToDoModal(toDoId) {
  try {
    // Try to use the global editToDo function if available (from todos.js)
    if (window.editToDo) {
      await window.editToDo(toDoId);
    } else {
      // Fallback: navigate to todos tab
      const tabBtn = document.querySelector('[data-tab="todos"]');
      if (tabBtn) {
        tabBtn.click();
        app.notify('Go to the Todos tab to edit this to do', 'info');
      } else {
        app.notify('Please navigate to the Todos tab to edit this to do', 'info');
      }
    }
  } catch (error) {
    console.error('Error opening to do:', error);
    app.notify('Error opening to do', 'danger');
  }
}

async function deleteToDoFromProject(toDoId) {
  if (!await app.confirm('Delete this to do?')) return;

  try {
    const response = await fetch(`/api/to-dos/${toDoId}`, {
      method: 'DELETE',
      headers: {
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      }
    });
    const result = await response.json();
    if (result.success) {
      app.notify('To Do deleted', 'success');
      loadPriorities();
      loadPriorityRightPanel();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error deleting to do:', error);
    app.notify('Error deleting to do', 'danger');
  }
}

async function cycleProjectToDoStatus(toDoId, currentStatus) {
  const result = await app.cycleStatus(`/api/to-dos/${toDoId}`, currentStatus);
  if (result.success) {
    loadPriorities();
  } else {
    app.notify('Error: ' + result.message, 'danger');
  }
}

function getDescendantIds(priorityId) {
  const descendants = new Set();
  const byParent = app.groupByParent(allPriorities);
  const queue = [Number(priorityId)];

  while (queue.length > 0) {
    const current = queue.pop();
    (byParent.get(current) || []).forEach(child => {
      if (!descendants.has(child.id)) {
        descendants.add(child.id);
        queue.push(child.id);
      }
    });
  }

  return descendants;
}

function openNewPriorityForm() {
  document.getElementById('priorityId').value = '';
  document.getElementById('priorityForm').reset();
}

async function savePriority() {
  const priorityId = document.getElementById('priorityId').value;

  // parent_id, area_ids, and goal_ids are intentionally omitted here - they're
  // only ever changed via drag-and-drop (reparenting, and linking categories/goals
  // from the right panel), never through this form, so a plain edit must leave
  // them untouched.
  const data = {
    title: document.getElementById('priorityTitle').value,
    notes: document.getElementById('priorityNotes').value
  };

  try {
    const url = priorityId ? `/api/priorities/${priorityId}` : '/api/priorities';
    const method = priorityId ? 'PUT' : 'POST';

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
      app.notify('Project saved!', 'success');
      loadPriorities();
      // Close the modal using the dismiss button
      const dismissBtn = document.querySelector('#priorityModal .btn-close');
      if (dismissBtn) dismissBtn.click();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error saving project', 'danger');
  }
}

async function editProjectToDo(toDoId) {
  try {
    const response = await fetch(`/api/to-dos/${toDoId}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();

    if (!result.success || !result.data) {
      app.notify('Error loading to do', 'danger');
      return;
    }

    const toDo = result.data;

    // Show todo form, hide priority form
    document.getElementById('priorityEditorForm').style.display = 'none';
    document.getElementById('projToDoEditorForm').style.display = 'block';
    document.getElementById('priorityEditorTitle').textContent = toDo.title;

    // Populate todo form
    document.getElementById('projToDoEditorId').value = toDo.id;
    document.getElementById('projToDoEditorFormTitle').value = toDo.title;
    document.getElementById('projToDoEditorNotes').value = toDo.notes || '';
    document.getElementById('projToDoEditorLinksList').innerHTML = '';

    window.prioritySplitPane.showRightPane();
  } catch (error) {
    console.error('Error loading to do:', error);
    app.notify('Error loading to do', 'danger');
  }
}

async function editPriority(priorityId) {
  // Show priority form, hide todo form
  document.getElementById('priorityEditorForm').style.display = 'block';
  document.getElementById('projToDoEditorForm').style.display = 'none';

  await PriorityEditor.populate(priorityId);

  // Setup link input handlers
  const addLinkBtn = document.getElementById('priorityEditorAddLinkBtn');
  if (addLinkBtn) {
    addLinkBtn.onclick = async (e) => {
      e.preventDefault();
      const url = document.getElementById('priorityEditorLinkUrl').value;
      const title = document.getElementById('priorityEditorLinkTitle').value;
      if (url && title) {
        const linkResponse = await fetch(`/api/priorities/${priorityId}/links`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': window.APP_CONFIG?.csrfToken
          },
          body: JSON.stringify({ url, title })
        });
        if (linkResponse.ok) {
          const linkResult = await linkResponse.json();
          if (linkResult.success) {
            const links = Array.from(document.querySelectorAll('#priorityEditorLinksList a')).map(a => ({
              url: a.href,
              title: a.textContent
            }));
            links.push({ url, title });
            PriorityEditor.renderLinks(links);
            document.getElementById('priorityEditorLinkUrl').value = '';
            document.getElementById('priorityEditorLinkTitle').value = '';
          }
        }
      }
    };
  }
}

async function deletePriority(priorityId) {
  const hasChildren = getDescendantIds(priorityId).size > 0;
  const message = hasChildren
    ? 'This project has sub-projects that will also be deleted. Delete anyway?'
    : 'Delete this project?';

  if (!await app.confirm(message)) return;

  try {
    const response = await fetch(`/api/priorities/${priorityId}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Project deleted', 'success');
      loadPriorities();
    } else {
      app.notify('Error deleting project', 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error deleting project', 'danger');
  }
}

function togglePriorityNode(nodeEl) {
  const id = String(nodeEl.dataset.priorityId);
  if (expandedPriorities.has(id)) {
    expandedPriorities.delete(id);
    nodeEl.classList.remove('expanded');
  } else {
    expandedPriorities.add(id);
    nodeEl.classList.add('expanded');
  }
}

function toggleProjectFolderNode(nodeEl) {
  const id = String(nodeEl.dataset.projectFolderId);
  if (expandedProjectFolders.has(id)) {
    expandedProjectFolders.delete(id);
    nodeEl.classList.remove('expanded');
  } else {
    expandedProjectFolders.add(id);
    nodeEl.classList.add('expanded');
  }
}

function toggleProjectTaskFolderNode(nodeEl) {
  const id = String(nodeEl.dataset.projectTaskFolderId);
  if (expandedProjectTaskFolders.has(id)) {
    expandedProjectTaskFolders.delete(id);
    nodeEl.classList.remove('expanded');
  } else {
    expandedProjectTaskFolders.add(id);
    nodeEl.classList.add('expanded');
  }
}

async function reparentPriority(priorityId, newParentId) {
  try {
    const response = await fetch(`/api/priorities/${priorityId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ parent_id: newParentId })
    });

    const result = await response.json();
    if (result.success) {
      if (newParentId) expandedPriorities.add(String(newParentId));
      loadPriorities();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error moving project:', error);
    app.notify('Error moving project', 'danger');
  }
}

function clearDropTargets(container) {
  container.querySelectorAll('.priority-drop-target').forEach(el => el.classList.remove('priority-drop-target'));
  container.querySelectorAll('.drop-indicator-before, .drop-indicator-after').forEach(el => {
    el.classList.remove('drop-indicator-before', 'drop-indicator-after');
  });
  container.classList.remove('priority-drop-target-root');
}

async function reorderPrioritySibling(draggedId, targetId, position) {
  const dragged = allPriorities.find(p => String(p.id) === String(draggedId));
  const target = allPriorities.find(p => String(p.id) === String(targetId));
  if (!dragged || !target) return;

  const parentKey = target.parent_id || null;
  const byParent = app.groupByParent(allPriorities);
  const siblingIds = (byParent.get(parentKey) || [])
    .map(p => String(p.id))
    .filter(id => id !== String(draggedId));

  let insertIndex = siblingIds.indexOf(String(targetId));
  if (position === 'after') insertIndex += 1;
  siblingIds.splice(insertIndex, 0, String(draggedId));

  try {
    // Dropping between siblings under a different parent than the dragged
    // item's current one also reparents it, same as dropping directly onto a project.
    if ((dragged.parent_id || null) !== parentKey) {
      await fetch(`/api/priorities/${draggedId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.APP_CONFIG?.csrfToken
        },
        body: JSON.stringify({ parent_id: parentKey })
      });
    }

    const response = await fetch('/api/priorities/reorder-siblings', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ orderedIds: siblingIds })
    });
    const result = await response.json();
    if (result.success) {
      loadPriorities();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error reordering project:', error);
    app.notify('Error reordering project', 'danger');
  }
}

function initPrioritiesEventListeners() {
  document.getElementById('addPriorityBtn').addEventListener('click', openNewPriorityForm);
  document.getElementById('savePriorityBtn').addEventListener('click', savePriority);

  const container = document.getElementById('prioritiesList');

  app.bindInlineRename(container, '.priority-title', async (newTitle, titleEl) => {
    const node = titleEl.closest('.priority-node');
    const isTodo = node.classList.contains('todo-node');
    const url = isTodo ? `/api/to-dos/${node.dataset.todoId}` : `/api/priorities/${node.dataset.priorityId}`;
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.APP_CONFIG?.csrfToken
        },
        body: JSON.stringify({ title: newTitle })
      });
      const result = await response.json();
      if (!result.success) {
        app.notify('Error: ' + result.message, 'danger');
        return false;
      }
      loadPriorities();
      return true;
    } catch (error) {
      console.error(`Error renaming ${isTodo ? 'to do' : 'project'}:`, error);
      app.notify(`Error renaming ${isTodo ? 'to do' : 'project'}`, 'danger');
      return false;
    }
  });

  container.addEventListener('dragstart', (e) => {
    const header = e.target.closest('.priority-node-header');
    if (!header) return;
    const node = header.closest('.priority-node');

    e.dataTransfer.effectAllowed = 'move';

    // Check if it's a todo, task, or project
    if (node.classList.contains('todo-node')) {
      e.dataTransfer.setData('type', 'todo');
      e.dataTransfer.setData('id', node.dataset.todoId);
    } else if (node.classList.contains('task-node')) {
      e.dataTransfer.setData('type', 'task');
      e.dataTransfer.setData('id', node.dataset.taskId);
    } else if (node.dataset.priorityId) {
      e.dataTransfer.setData('priority-id', node.dataset.priorityId);
    }

    header.classList.add('dragging-item');
  });

  container.addEventListener('dragend', (e) => {
    const header = e.target.closest('.priority-node-header');
    if (header) header.classList.remove('dragging-item');
    clearDropTargets(container);
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    const header = e.target.closest('.priority-node-header');
    clearDropTargets(container);
    const isInternalDrag = e.dataTransfer.types.includes('priority-id');

    if (header) {
      if (isInternalDrag) {
        const zone = app.getTreeDropZone(e, header);
        if (zone === 'nest') {
          header.classList.add('priority-drop-target');
        } else {
          header.classList.add(zone === 'before' ? 'drop-indicator-before' : 'drop-indicator-after');
        }
      } else {
        // Dropping a category/goal chip onto a project associates it
        header.classList.add('priority-drop-target');
      }
    } else if (isInternalDrag) {
      container.classList.add('priority-drop-target-root');
    }
  });

  container.addEventListener('drop', (e) => {
    e.preventDefault();
    const header = e.target.closest('.priority-node-header');
    const priorityDraggedId = e.dataTransfer.getData('priority-id');

    if (priorityDraggedId) {
      const zone = header ? app.getTreeDropZone(e, header) : null;
      clearDropTargets(container);

      const targetId = header ? header.closest('.priority-node').dataset.priorityId : null;
      if (targetId && String(targetId) === String(priorityDraggedId)) return;

      if (!targetId) {
        reparentPriority(priorityDraggedId, null);
      } else if (zone === 'nest') {
        reparentPriority(priorityDraggedId, targetId);
      } else {
        reorderPrioritySibling(priorityDraggedId, targetId, zone);
      }
      return;
    }

    // External chip drop (category/goal/todo from the right panel) - associates it
    // onto whichever project/sub-project row it was dropped on.
    clearDropTargets(container);
    const type = e.dataTransfer.getData('type');
    const id = e.dataTransfer.getData('id');
    if (!type || !id || !header) return;

    const priorityId = header.closest('.priority-node').dataset.priorityId;

    if (type === 'todo') {
      linkToDoToPriority(id, priorityId);
    } else if (type === 'todo-folder') {
      linkFolderToPriority(id, priorityId);
    } else if (type === 'task') {
      linkTaskToPriority(id, priorityId);
    } else if (type === 'task-folder') {
      linkTaskFolderToPriority(id, priorityId);
    } else {
      linkCategoryOrGoalToPriority(priorityId, type, id);
    }
  });

  container.addEventListener('click', (e) => {
    console.log('[Priorities] Click on:', e.target, 'closest priority-node-header:', e.target.closest('.priority-node-header'));
    const actionBtn = e.target.closest('[data-action="delete"], [data-action="edit-todo"], [data-action="unlink"], [data-action="unlink-folder"], [data-action="toggle-complete"]');
    if (actionBtn) {
      console.log('[Priorities] Action button:', actionBtn.dataset.action);
      if (actionBtn.dataset.action === 'delete') {
        const isTodo = actionBtn.closest('.todo-node');
        if (isTodo) {
          deleteToDoFromProject(actionBtn.dataset.id);
        } else {
          deletePriority(actionBtn.dataset.id);
        }
      } else if (actionBtn.dataset.action === 'unlink') {
        const type = actionBtn.dataset.type;
        if (type === 'task') {
          unlinkTaskFromProject(actionBtn.dataset.childId);
        } else if (type === 'idea') {
          unlinkIdeaFromProject(actionBtn.dataset.childId);
        } else if (type === 'ticket') {
          unlinkTicketFromProject(actionBtn.dataset.childId);
        } else {
          // Default to todo for backwards compatibility
          unlinkToDoFromProject(actionBtn.dataset.childId);
        }
      } else if (actionBtn.dataset.action === 'unlink-folder') {
        if (actionBtn.closest('.project-task-folder-node')) {
          unlinkTaskFolderFromProject(actionBtn.dataset.folderId);
        } else {
          unlinkFolderFromProject(actionBtn.dataset.folderId);
        }
      } else if (actionBtn.dataset.action === 'edit-todo') {
        openToDoModal(actionBtn.dataset.id);
      } else if (actionBtn.dataset.action === 'toggle-complete') {
        if (actionBtn.closest('.task-node')) {
          cycleProjectTaskStatus(actionBtn.dataset.id, actionBtn.dataset.status);
        } else {
          cycleProjectToDoStatus(actionBtn.dataset.id, actionBtn.dataset.status);
        }
      }
      return;
    }

    const toggleIcon = e.target.closest('[data-action="toggle-expand"]');
    if (toggleIcon) {
      const toggleNode = toggleIcon.closest('.priority-node');
      if (toggleNode.classList.contains('project-folder-node')) {
        toggleProjectFolderNode(toggleNode);
      } else if (toggleNode.classList.contains('project-task-folder-node')) {
        toggleProjectTaskFolderNode(toggleNode);
      } else {
        togglePriorityNode(toggleNode);
      }
      return;
    }

    // Click on project or todo row to open editor
    const header = e.target.closest('.priority-node-header');
    if (header) {
      const todoNode = header.closest('.todo-node');
      const taskNode = header.closest('.task-node');
      const categoryNode = header.closest('.category-node');
      const goalNode = header.closest('.goal-node');

      if (todoNode && todoNode.dataset.todoId) {
        console.log('[Priorities] Opening todo:', todoNode.dataset.todoId);
        editProjectToDo(todoNode.dataset.todoId);
      } else if (taskNode && taskNode.dataset.taskId) {
        // Tasks don't have a quick-edit form embedded in the Projects page;
        // editing happens on the Tasks tab itself.
      } else if (categoryNode && categoryNode.dataset.categoryId) {
        console.log('[Priorities] Opening category:', categoryNode.dataset.categoryId);
        // Navigate to Areas tab and open category editor
        const areasBtn = document.querySelector('button[data-tab="areas"]');
        if (areasBtn) areasBtn.click();
        // Store the category ID to open after tab switches
        window.pendingAreaEdit = categoryNode.dataset.categoryId;
      } else if (goalNode && goalNode.dataset.goalId) {
        console.log('[Priorities] Opening goal:', goalNode.dataset.goalId);
        // Navigate to Goals tab and open goal editor
        const goalsBtn = document.querySelector('button[data-tab="yearly-goals"]');
        if (goalsBtn) goalsBtn.click();
        window.pendingGoalEdit = goalNode.dataset.goalId;
      } else {
        const priorityNode = header.closest('.priority-node');
        if (priorityNode && priorityNode.dataset.priorityId) {
          console.log('[Priorities] Opening priority:', priorityNode.dataset.priorityId);
          // Check if clicking on same row that's already open
          if (!PriorityEditor.toggleOnSameRow(priorityNode.dataset.priorityId)) {
            editPriority(priorityNode.dataset.priorityId);
          }
        }
      }
    } else {
      console.log('[Priorities] Click but no header found, target:', e.target);
    }
  });

}

function closePriorityEditor() {
  if (window.prioritySplitPane) {
    window.prioritySplitPane.hideRightPane();
  }
}

function renderPriorityLinks(links) {
  const linksList = document.getElementById('priorityEditorLinksList');
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
        renderPriorityLinks(links);
      }
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-sm btn-outline-danger';
    removeBtn.innerHTML = '<i class="bi bi-x"></i>';
    removeBtn.addEventListener('click', () => {
      links.splice(index, 1);
      renderPriorityLinks(links);
    });

    linkEl.appendChild(titleSpan);
    linkEl.appendChild(removeBtn);
    linksList.appendChild(linkEl);
  });
}

function initPriorities() {
  // #priorityModal can be opened from other tabs (e.g. the Dailies right panel).
  // Left inside the #tab-my-priorities pane, it's a descendant of a display:none
  // ancestor whenever that tab isn't active, so Bootstrap's backdrop would show but
  // the dialog itself never could - move it to the body so it always renders.
  document.body.appendChild(document.getElementById('priorityModal'));

  // Initialize split pane for side-panel editing
  window.prioritySplitPane = new SplitPane('prioritySplitPane', 'priorityListPane', 'priorityDivider', 'priorityEditorPane', 66.66);
  PriorityEditor.init(window.prioritySplitPane);

  // Setup drawer toggle for associate items
  const associateToggle = document.getElementById('associateItemsToggle');
  const associatePanel = document.getElementById('associateItemsPanel');

  const savedState = localStorage.getItem('prioritiesDrawerOpen');
  const isOpen = savedState === 'true'; // default to closed

  if (isOpen && associatePanel) {
    associatePanel.style.width = '220px';
    associatePanel.style.padding = '15px';
    associatePanel.dataset.drawerOpen = 'true';
  }

  associateToggle?.addEventListener('click', () => {
    if (associatePanel) {
      const isCurrentlyOpen = associatePanel.dataset.drawerOpen === 'true';
      if (isCurrentlyOpen) {
        associatePanel.style.width = '0';
        associatePanel.style.padding = '0';
        associatePanel.dataset.drawerOpen = 'false';
        localStorage.setItem('prioritiesDrawerOpen', 'false');
      } else {
        associatePanel.style.width = '220px';
        associatePanel.style.padding = '15px';
        associatePanel.dataset.drawerOpen = 'true';
        localStorage.setItem('prioritiesDrawerOpen', 'true');
      }
    }
  });

  // Setup split-pane editor buttons
  const savePriorityEditorBtn = document.getElementById('savePriorityEditorBtn');
  const closePriorityEditorBtn = document.getElementById('closePriorityEditorBtn');

  if (savePriorityEditorBtn) {
    savePriorityEditorBtn.addEventListener('click', async () => {
      const type = document.getElementById('priorityEditorType').value;
      const id = document.getElementById('priorityEditorId').value;
      const title = document.getElementById('priorityEditorFormTitle').value;
      const notes = document.getElementById('priorityEditorNotes').value;

      if (!title.trim()) {
        app.notify('Title is required', 'warning');
        return;
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
          closePriorityEditor();
          loadPriorities();
          loadPriorityRightPanel();
        } else {
          app.notify('Error: ' + result.message, 'danger');
        }
      } catch (error) {
        console.error('Error saving:', error);
        const msg = type === 'todo' ? 'Error saving to do' : 'Error saving project';
        app.notify(msg, 'danger');
      }
    });
  }

  if (closePriorityEditorBtn) {
    closePriorityEditorBtn.addEventListener('click', closePriorityEditor);
  }

  // Todo editor buttons
  const saveToDoEditorBtn = document.getElementById('saveProjToDoEditorBtn');
  const closeToDoEditorBtn = document.getElementById('closeProjToDoEditorBtn');

  if (saveToDoEditorBtn) {
    saveToDoEditorBtn.addEventListener('click', async () => {
      const toDoId = document.getElementById('projToDoEditorId').value;
      const title = document.getElementById('projToDoEditorFormTitle').value;
      const notes = document.getElementById('projToDoEditorNotes').value;

      if (!title.trim()) {
        app.notify('Title is required', 'warning');
        return;
      }

      try {
        const response = await fetch(`/api/to-dos/${toDoId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': window.APP_CONFIG?.csrfToken
          },
          body: JSON.stringify({ title, notes })
        });

        const result = await response.json();
        if (result.success) {
          app.notify('To Do updated!', 'success');
          closePriorityEditor();
          loadPriorities();
          loadPriorityRightPanel();
        } else {
          app.notify('Error: ' + result.message, 'danger');
        }
      } catch (error) {
        console.error('Error saving to do:', error);
        app.notify('Error saving to do', 'danger');
      }
    });
  }

  if (closeToDoEditorBtn) {
    closeToDoEditorBtn.addEventListener('click', closePriorityEditor);
  }

  // Setup associated items add buttons
  document.getElementById('priorityEditorAddCategoryBtn')?.addEventListener('click', () => {
    const priorityId = document.getElementById('priorityEditorId').value;
    if (priorityId) showCategorySelector(priorityId);
  });

  document.getElementById('priorityEditorAddTodoBtn')?.addEventListener('click', () => {
    const priorityId = document.getElementById('priorityEditorId').value;
    if (priorityId) showTodoSelector(priorityId);
  });

  document.getElementById('priorityEditorAddIdeaBtn')?.addEventListener('click', () => {
    const priorityId = document.getElementById('priorityEditorId').value;
    if (priorityId) showIdeaSelector(priorityId);
  });

  document.getElementById('priorityEditorAddTicketBtn')?.addEventListener('click', () => {
    const priorityId = document.getElementById('priorityEditorId').value;
    if (priorityId) showTicketSelector(priorityId);
  });

  // Setup project context menu
  const contextMenu = document.getElementById('projectContextMenu');
  let contextMenuProjectId = null;

  document.addEventListener('contextmenu', (e) => {
    const header = e.target.closest('.priority-node-header');
    if (header) {
      e.preventDefault();
      contextMenuProjectId = header.closest('.priority-node').dataset.priorityId;
      contextMenu.style.left = e.clientX + 'px';
      contextMenu.style.top = e.clientY + 'px';
      contextMenu.classList.remove('d-none');
    } else {
      contextMenu.classList.add('d-none');
    }
  });

  document.addEventListener('click', (e) => {
    // Check if click is on a submenu button to show/hide submenus
    const submenuBtn = e.target.closest('[data-submenu]');
    if (submenuBtn && !contextMenu.classList.contains('d-none')) {
      const submenuId = submenuBtn.dataset.submenu + '-submenu';
      const submenu = document.getElementById(submenuId);
      if (submenu) {
        const isHidden = submenu.classList.contains('d-none');
        // Hide all submenus first
        contextMenu.querySelectorAll('.context-menu-submenu').forEach(m => m.classList.add('d-none'));
        // Show the clicked submenu
        if (isHidden) {
          submenu.classList.remove('d-none');
        }
      }
      e.stopPropagation();
    } else {
      contextMenu.classList.add('d-none');
    }
  });

  contextMenu.addEventListener('click', async (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action || !contextMenuProjectId) return;

    contextMenu.classList.add('d-none');

    if (action === 'associate-category') {
      showCategorySelector(contextMenuProjectId);
    } else if (action === 'associate-idea') {
      showIdeaSelector(contextMenuProjectId);
    } else if (action === 'associate-ticket') {
      showTicketSelector(contextMenuProjectId);
    } else if (action === 'associate-todo') {
      showTodoSelector(contextMenuProjectId);
    } else if (action === 'create-category') {
      createAndAssociateCategory(contextMenuProjectId);
    } else if (action === 'create-idea') {
      createAndAssociateIdea(contextMenuProjectId);
    } else if (action === 'create-ticket') {
      createAndAssociateTicket(contextMenuProjectId);
    } else if (action === 'create-todo') {
      createAndAssociateTodo(contextMenuProjectId);
    } else if (action === 'delete-project') {
      deleteProject(contextMenuProjectId);
    }
  });

  // Category selector
  async function showCategorySelector(projectId) {
    const categories = await fetchCategories();
    showSelectionModal('Associate Category', categories, (categoryId) => {
      associateCategory(projectId, categoryId);
    }, true); // Use tree format for hierarchical categories
  }

  // Idea selector
  async function showIdeaSelector(projectId) {
    const ideas = await fetchIdeas();
    showSelectionModal('Associate Idea', ideas, (ideaId) => {
      associateIdea(projectId, ideaId);
    });
  }

  // Ticket selector
  async function showTicketSelector(projectId) {
    const tickets = await fetchTickets();
    showSelectionModal('Associate Ticket', tickets, (ticketId) => {
      associateTicket(projectId, ticketId);
    });
  }

  // Todo selector
  async function showTodoSelector(projectId) {
    const todos = await fetchTodos();
    showSelectionModal('Associate Todo', todos, (todoId) => {
      associateTodo(projectId, todoId);
    });
  }

  // Generic selection modal with tree support
  function showSelectionModal(title, items, callback, isTreeFormat = false) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';

    let bodyHtml;
    if (isTreeFormat) {
      // Build tree structure for hierarchical items (areas)
      bodyHtml = buildTreeHTML(items);
    } else {
      // Simple list for non-hierarchical items
      bodyHtml = `
        <div class="list-group">
          ${items.map(item => `
            <button type="button" class="list-group-item list-group-item-action" data-id="${item.id}">
              ${app.escapeHtml(item.name || item.title || item.subject)}
            </button>
          `).join('')}
        </div>
      `;
    }

    modal.innerHTML = `
      <div class="modal-dialog ${isTreeFormat ? 'modal-dialog-scrollable' : ''}">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${title}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            ${bodyHtml}
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

    // ESC key closes modal
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        bsModal.hide();
      }
    };

    // Setup tree interactions if tree format
    if (isTreeFormat) {
      const treeItems = modal.querySelectorAll('[data-tree-toggle]');
      treeItems.forEach(toggle => {
        toggle.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const item = toggle.closest('[data-tree-item]');
          const children = item.querySelector('[data-tree-children]');
          if (children) {
            const isExpanded = item.classList.contains('expanded');
            if (isExpanded) {
              item.classList.remove('expanded');
              children.style.display = 'none';
              toggle.style.transform = 'rotate(0deg)';
            } else {
              item.classList.add('expanded');
              children.style.display = 'block';
              toggle.style.transform = 'rotate(90deg)';
            }
          }
        });
      });
    }

    modal.addEventListener('click', (e) => {
      // Don't trigger selection if clicking on a toggle button
      if (e.target.closest('[data-tree-toggle]')) {
        return;
      }
      const btn = e.target.closest('[data-id]');
      if (btn && !btn.hasAttribute('data-tree-toggle')) {
        callback(btn.dataset.id);
        bsModal.hide();
      }
    });

    modal.addEventListener('shown.bs.modal', () => {
      document.addEventListener('keydown', escHandler);
    });

    modal.addEventListener('hidden.bs.modal', () => {
      document.removeEventListener('keydown', escHandler);
      modal.remove();
    });
  }

  // Build tree HTML for hierarchical items
  function buildTreeHTML(items, parentId = null, depth = 0) {
    const children = items.filter(item => (item.parent_id || null) === parentId);
    if (children.length === 0 && parentId !== null) return '';

    return `
      <div class="selection-tree" ${parentId === null ? 'style="padding: 0;"' : `style="padding-left: ${depth * 1.5}rem; margin-top: 0.25rem;"`}>
        ${children.map(item => {
          const hasChildren = items.some(i => i.parent_id === item.id);
          const childrenHtml = hasChildren ? buildTreeHTML(items, item.id, depth + 1) : '';
          return `
            <div class="selection-tree-item" data-tree-item="${item.id}">
              <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; border-radius: 3px; cursor: pointer; user-select: none;" data-id="${item.id}">
                ${hasChildren ? `
                  <i class="bi bi-chevron-right" data-tree-toggle style="font-size: 0.9rem; transition: transform 0.2s; flex: none; width: 1rem; display: flex; align-items: center;"></i>
                ` : `<span style="flex: none; width: 1rem;"></span>`}
                <span>${app.escapeHtml(item.name || item.path || item.title || item.subject)}</span>
              </div>
              ${childrenHtml ? `<div data-tree-children style="display: none;">${childrenHtml}</div>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // Fetch functions
  async function fetchCategories() {
    const response = await fetch('/api/areas');
    const result = await response.json();
    return result.data || [];
  }

  async function fetchIdeas() {
    const response = await fetch('/api/ideas');
    const result = await response.json();
    return result.data || [];
  }

  async function fetchTickets() {
    const response = await fetch('/api/tickets');
    const result = await response.json();
    return result.data || [];
  }

  async function fetchTodos() {
    const response = await fetch('/api/to-dos');
    const result = await response.json();
    return result.data || [];
  }

  // Association functions
  async function associateCategory(projectId, categoryId) {
    try {
      // Get current priority to preserve existing associations
      const getResponse = await fetch(`/api/priorities/${projectId}`);
      const getResult = await getResponse.json();
      const priority = getResult.data;

      // Get existing area_ids and add the new one
      const existingAreaIds = (priority.areas || []).map(a => a.id);
      const newAreaIds = [...existingAreaIds, parseInt(categoryId)];

      // Remove duplicates
      const uniqueAreaIds = [...new Set(newAreaIds)];

      const response = await fetch(`/api/priorities/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.APP_CONFIG?.csrfToken
        },
        body: JSON.stringify({ area_ids: uniqueAreaIds })
      });

      const result = await response.json();
      if (result.success) {
        app.notify('Category associated!', 'success');
        // Refresh the associated items tree in the editor
        if (typeof PriorityEditor !== 'undefined' && PriorityEditor.renderAssociatedItems) {
          const freshResponse = await fetch(`/api/priorities/${projectId}`);
          const freshResult = await freshResponse.json();
          await PriorityEditor.renderAssociatedItems(freshResult.data);
        }
        loadPriorities();
      } else {
        app.notify('Error: ' + result.message, 'danger');
      }
    } catch (error) {
      console.error('Error associating category:', error);
      app.notify('Error associating category', 'danger');
    }
  }

  async function associateIdea(projectId, ideaId) {
    try {
      const response = await fetch(`/api/ideas/${ideaId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.APP_CONFIG?.csrfToken
        },
        body: JSON.stringify({ priority_id: projectId })
      });

      const result = await response.json();
      if (result.success) {
        app.notify('Idea associated!', 'success');
        // Refresh the associated items tree in the editor
        if (typeof PriorityEditor !== 'undefined' && PriorityEditor.renderAssociatedItems) {
          const freshResponse = await fetch(`/api/priorities/${projectId}`);
          const freshResult = await freshResponse.json();
          await PriorityEditor.renderAssociatedItems(freshResult.data);
        }
        loadPriorities();
      } else {
        app.notify('Error: ' + result.message, 'danger');
      }
    } catch (error) {
      console.error('Error associating idea:', error);
      app.notify('Error associating idea', 'danger');
    }
  }

  async function associateTicket(projectId, ticketId) {
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.APP_CONFIG?.csrfToken
        },
        body: JSON.stringify({ priority_id: projectId })
      });

      const result = await response.json();
      if (result.success) {
        app.notify('Ticket associated!', 'success');
        // Refresh the associated items tree in the editor
        if (typeof PriorityEditor !== 'undefined' && PriorityEditor.renderAssociatedItems) {
          const freshResponse = await fetch(`/api/priorities/${projectId}`);
          const freshResult = await freshResponse.json();
          await PriorityEditor.renderAssociatedItems(freshResult.data);
        }
        loadPriorities();
      } else {
        app.notify('Error: ' + result.message, 'danger');
      }
    } catch (error) {
      console.error('Error associating ticket:', error);
      app.notify('Error associating ticket', 'danger');
    }
  }

  async function associateTodo(projectId, todoId) {
    try {
      const response = await fetch(`/api/to-dos/${todoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.APP_CONFIG?.csrfToken
        },
        body: JSON.stringify({ priority_id: projectId })
      });

      const result = await response.json();
      if (result.success) {
        app.notify('Todo associated!', 'success');
        // Refresh the associated items tree in the editor
        if (typeof PriorityEditor !== 'undefined' && PriorityEditor.renderAssociatedItems) {
          const freshResponse = await fetch(`/api/priorities/${projectId}`);
          const freshResult = await freshResponse.json();
          await PriorityEditor.renderAssociatedItems(freshResult.data);
        }
        loadPriorities();
      } else {
        app.notify('Error: ' + result.message, 'danger');
      }
    } catch (error) {
      console.error('Error associating todo:', error);
      app.notify('Error associating todo', 'danger');
    }
  }

  // Create and associate functions
  async function createAndAssociateCategory(projectId) {
    const name = prompt('Enter category name:');
    if (!name) return;

    try {
      const response = await fetch('/api/areas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.APP_CONFIG?.csrfToken
        },
        body: JSON.stringify({ name })
      });

      const result = await response.json();
      if (result.success) {
        app.notify('Category created and associated!', 'success');
        await associateCategory(projectId, result.data.id);
      } else {
        app.notify('Error: ' + result.message, 'danger');
      }
    } catch (error) {
      console.error('Error creating category:', error);
      app.notify('Error creating category', 'danger');
    }
  }

  async function createAndAssociateIdea(projectId) {
    const title = prompt('Enter idea title:');
    if (!title) return;

    try {
      const response = await fetch('/api/ideas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.APP_CONFIG?.csrfToken
        },
        body: JSON.stringify({ title, priority_id: projectId })
      });

      const result = await response.json();
      if (result.success) {
        app.notify('Idea created and associated!', 'success');
        loadPriorities();
        if (typeof PriorityEditor !== 'undefined' && PriorityEditor.renderAssociatedItems) {
          const freshResponse = await fetch(`/api/priorities/${projectId}`);
          const freshResult = await freshResponse.json();
          await PriorityEditor.renderAssociatedItems(freshResult.data);
        }
      } else {
        app.notify('Error: ' + result.message, 'danger');
      }
    } catch (error) {
      console.error('Error creating idea:', error);
      app.notify('Error creating idea', 'danger');
    }
  }

  async function createAndAssociateTicket(projectId) {
    const subject = prompt('Enter ticket subject:');
    if (!subject) return;

    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.APP_CONFIG?.csrfToken
        },
        body: JSON.stringify({ subject, priority_id: projectId })
      });

      const result = await response.json();
      if (result.success) {
        app.notify('Ticket created and associated!', 'success');
        loadPriorities();
        if (typeof PriorityEditor !== 'undefined' && PriorityEditor.renderAssociatedItems) {
          const freshResponse = await fetch(`/api/priorities/${projectId}`);
          const freshResult = await freshResponse.json();
          await PriorityEditor.renderAssociatedItems(freshResult.data);
        }
      } else {
        app.notify('Error: ' + result.message, 'danger');
      }
    } catch (error) {
      console.error('Error creating ticket:', error);
      app.notify('Error creating ticket', 'danger');
    }
  }

  async function createAndAssociateTodo(projectId) {
    const title = prompt('Enter todo title:');
    if (!title) return;

    try {
      const response = await fetch('/api/to-dos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.APP_CONFIG?.csrfToken
        },
        body: JSON.stringify({ title, priority_id: projectId })
      });

      const result = await response.json();
      if (result.success) {
        app.notify('Todo created and associated!', 'success');
        loadPriorities();
        if (typeof PriorityEditor !== 'undefined' && PriorityEditor.renderAssociatedItems) {
          const freshResponse = await fetch(`/api/priorities/${projectId}`);
          const freshResult = await freshResponse.json();
          await PriorityEditor.renderAssociatedItems(freshResult.data);
        }
      } else {
        app.notify('Error: ' + result.message, 'danger');
      }
    } catch (error) {
      console.error('Error creating todo:', error);
      app.notify('Error creating todo', 'danger');
    }
  }

  initPrioritiesEventListeners();
  initProjRightPanelTabs();
  loadPriorities();
  loadPriorityRightPanel();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPriorities);
} else {
  initPriorities();
}