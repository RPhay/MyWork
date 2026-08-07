let expandedPriorities = new Set();
let allPriorities = [];
let allToDos = [];

function renderToDoInTree(toDo, depth) {
  const hasLinks = toDo.links && toDo.links.length > 0;
  const linksBadge = hasLinks
    ? `<span class="badge bg-info text-white" title="Has links">🔗</span>`
    : '';

  return `
    <div class="priority-node todo-node" data-todo-id="${toDo.id}">
      <div class="priority-node-header todo-node-header" draggable="true" style="cursor: grab;">
        <span class="priority-title-cell">
          <span style="display:inline-block; width: ${depth * 18}px; flex: none;"></span>
          <span class="priority-toggle"></span>
          <i class="bi bi-check2-square text-muted"></i>
          <span class="priority-title">${app.escapeHtml(toDo.title)}</span>
          ${linksBadge}
        </span>
        <span class="priority-badges"><small class="text-muted">${app.escapeHtml(toDo.notes || '')}</small></span>
        <span class="priority-badges"></span>
        <span class="priority-actions">
          <button class="btn btn-sm btn-danger" data-action="delete" data-id="${toDo.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
        </span>
      </div>
    </div>
  `;
}

function renderPriorityNode(priority, byParent, depth) {
  const children = byParent.get(priority.id) || [];
  const associatedToDos = allToDos.filter(td => td.folder_id === priority.id);
  const hasChildren = children.length > 0 || associatedToDos.length > 0;
  const isExpanded = expandedPriorities.has(String(priority.id));

  let childrenHtml = '';
  if (hasChildren) {
    let html = '';
    // Render sub-projects
    html += children.map(c => renderPriorityNode(c, byParent, depth + 1)).join('');
    // Render associated todos
    html += associatedToDos.map(td => renderToDoInTree(td, depth + 1)).join('');
    childrenHtml = `<div class="priority-node-children">${html}</div>`;
  }

  const areaBadges = (priority.areas || []).map(a => `<span class="badge bg-secondary"><i class="bi ${APP_ICONS.area}"></i> ${app.escapeHtml(a.path || a.name)}</span>`).join('');
  const goalBadges = (priority.goals || []).map(g => `<span class="badge bg-info text-dark"><i class="bi ${APP_ICONS.goal}"></i> ${app.escapeHtml(g.name)}</span>`).join('');
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
        <span class="priority-badges">${areaBadges || '<span class="text-muted small">-</span>'}</span>
        <span class="priority-badges">${goalBadges || '<span class="text-muted small">-</span>'}</span>
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

    if (prioResult.success && todoResult.success) {
      allPriorities = prioResult.data;
      allToDos = todoResult.data || [];
      renderPrioritiesList(allPriorities);
      loadPriorityRightPanel();
    } else {
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

      // Group by folder
      const folders = {};
      const unfiledToDos = [];

      toDos.forEach(td => {
        if (td.folder_id) {
          if (!folders[td.folder_id]) folders[td.folder_id] = { name: '', items: [] };
          folders[td.folder_id].items.push(td);
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

      // Render todos in folders
      Object.entries(folders).forEach(([folderId, folder]) => {
        const folderObj = toDos.find(td => td.id === parseInt(folderId));
        const folderName = folderObj ? folderObj.title : 'Folder';
        html += `<div class="todo-group-header mb-2" data-folder-id="${folderId}" style="padding: 0.5rem 0.75rem; background: #f8f9fa; border-radius: 4px; cursor: pointer; font-weight: 500;"><i class="bi bi-folder-check" style="transform: rotate(0deg); transition: transform 0.15s;"></i> ${app.escapeHtml(folderName)} (${folder.items.length})</div>`;
        html += folder.items.map(td => `
          <div class="todo-item" draggable="true" data-type="todo" data-id="${td.id}" data-name="${app.escapeHtml(td.title)}" data-folder-id="${folderId}" style="padding: 0.25rem 0.5rem; cursor: move; margin-left: 1.5rem;">
            <small><i class="bi bi-check2-square"></i> ${app.escapeHtml(td.title)}</small>
            <small class="text-muted float-end">→</small>
          </div>
        `).join('');
      });

      div.innerHTML = html || '<small class="text-muted">No to dos</small>';
      setupDragListeners();

      // Add double-click handlers for todo items
      div.querySelectorAll('.todo-item').forEach(item => {
        item.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          const todoId = item.dataset.id;
          openToDoModal(todoId);
        });
      });
    } else {
      div.innerHTML = '<small class="text-muted">No to dos</small>';
    }
  } catch (error) {
    console.error('Error loading todos:', error);
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
      body: JSON.stringify({ folder_id: priorityId })
    });
    const result = await response.json();
    if (result.success) {
      app.notify('To Do associated with project', 'success');
      loadPriorityRightPanel();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error linking to do to project:', error);
    app.notify('Error linking to do to project', 'danger');
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

async function editPriority(priorityId) {
  try {
    const response = await fetch(`/api/priorities/${priorityId}`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    const result = await response.json();
    if (!result.success || !result.data) {
      throw new Error(result.message || 'Failed to load project');
    }
    const priority = result.data;

    // Populate split-pane editor
    document.getElementById('priorityEditorId').value = priority.id;
    document.getElementById('priorityEditorFormTitle').value = priority.title;
    document.getElementById('priorityEditorNotes').value = priority.notes;
    document.getElementById('priorityEditorTitle').textContent = priority.title;

    // Load and display links
    const linksResponse = await fetch(`/api/priorities/${priorityId}/links`).catch(() => ({ json: () => ({ data: [] }) }));
    const linksResult = await linksResponse.json();
    renderPriorityLinks(linksResult.data || []);

    // Setup link input handlers
    const addLinkBtn = document.getElementById('priorityEditorAddLinkBtn');
    if (addLinkBtn) {
      addLinkBtn.onclick = async (e) => {
        e.preventDefault();
        const url = document.getElementById('priorityEditorLinkUrl').value;
        const title = document.getElementById('priorityEditorLinkTitle').value;
        if (url && title) {
          const linkResponse = await fetch(`/api/priorities/${priority.id}/links`, {
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
              renderPriorityLinks(links);
              document.getElementById('priorityEditorLinkUrl').value = '';
              document.getElementById('priorityEditorLinkTitle').value = '';
            }
          }
        }
      };
    }

    // Show split-pane editor
    if (window.prioritySplitPane) {
      window.prioritySplitPane.showRightPane();
    }
  } catch (error) {
    console.error('Error loading project:', error);
    app.notify('Error loading project', 'danger');
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
    const priorityId = titleEl.closest('.priority-node').dataset.priorityId;
    try {
      const response = await fetch(`/api/priorities/${priorityId}`, {
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
      console.error('Error renaming project:', error);
      app.notify('Error renaming project', 'danger');
      return false;
    }
  });

  container.addEventListener('dragstart', (e) => {
    const header = e.target.closest('.priority-node-header');
    if (!header) return;
    const node = header.closest('.priority-node');

    e.dataTransfer.effectAllowed = 'move';

    // Check if it's a todo or project
    if (node.classList.contains('todo-node')) {
      e.dataTransfer.setData('type', 'todo');
      e.dataTransfer.setData('id', node.dataset.todoId);
    } else {
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
      // For todos, folder_id represents the associated project
      linkToDoToPriority(id, priorityId);
    } else {
      linkCategoryOrGoalToPriority(priorityId, type, id);
    }
  });

  container.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action="delete"], [data-action="edit-todo"]');
    if (actionBtn) {
      if (actionBtn.dataset.action === 'delete') {
        const isTodo = actionBtn.closest('.todo-node');
        if (isTodo) {
          deleteToDoFromProject(actionBtn.dataset.id);
        } else {
          deletePriority(actionBtn.dataset.id);
        }
      } else if (actionBtn.dataset.action === 'edit-todo') {
        openToDoModal(actionBtn.dataset.id);
      }
      return;
    }

    const toggleIcon = e.target.closest('[data-action="toggle-expand"]');
    if (toggleIcon) {
      togglePriorityNode(toggleIcon.closest('.priority-node'));
      return;
    }

    // Click on project row to open editor
    const header = e.target.closest('.priority-node-header');
    if (header && !header.closest('.todo-node')) {
      const priorityNode = header.closest('.priority-node');
      if (priorityNode && priorityNode.dataset.priorityId) {
        editPriority(priorityNode.dataset.priorityId);
      }
    }
  });

  container.addEventListener('dblclick', (e) => {
    if (e.target.closest('[data-action]')) return;
    const header = e.target.closest('.priority-node-header');
    if (!header) return;

    // Check if it's a todo node or project node
    const todoNode = header.closest('.todo-node');
    if (todoNode) {
      openToDoModal(todoNode.dataset.todoId);
    } else {
      const priorityNode = header.closest('.priority-node');
      if (priorityNode && priorityNode.dataset.priorityId) {
        editPriority(priorityNode.dataset.priorityId);
      }
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
  if (document.getElementById('prioritySplitPane')) {
    window.prioritySplitPane = new SplitPane('prioritySplitPane', 'priorityListPane', 'priorityDivider', 'priorityEditorPane', 66.66);
  }

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
      const priorityId = document.getElementById('priorityEditorId').value;
      const title = document.getElementById('priorityEditorFormTitle').value;
      const notes = document.getElementById('priorityEditorNotes').value;

      if (!title.trim()) {
        app.notify('Title is required', 'warning');
        return;
      }

      try {
        const response = await fetch(`/api/priorities/${priorityId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': window.APP_CONFIG?.csrfToken
          },
          body: JSON.stringify({ title, notes })
        });

        const result = await response.json();
        if (result.success) {
          app.notify('Project updated!', 'success');
          closePriorityEditor();
          loadPriorities();
        } else {
          app.notify('Error: ' + result.message, 'danger');
        }
      } catch (error) {
        console.error('Error saving project:', error);
        app.notify('Error saving project', 'danger');
      }
    });
  }

  if (closePriorityEditorBtn) {
    closePriorityEditorBtn.addEventListener('click', closePriorityEditor);
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