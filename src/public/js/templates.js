let expandedTemplates = new Set();
let allTemplates = [];

const TEMPLATE_ASSOCIATION_PATHS = { priority: 'priorities', goal: 'goals', area: 'areas' };

function renderTemplateNode(template) {
  const isExpanded = expandedTemplates.has(String(template.id));
  const children = [
    ...(template.priorities || []).map(p => ({ type: 'priority', id: p.id, label: p.path || p.title, icon: APP_ICONS.project })),
    ...(template.goals || []).map(g => ({ type: 'goal', id: g.id, label: g.name, icon: APP_ICONS.goal })),
    ...(template.areas || []).map(a => ({ type: 'area', id: a.id, label: a.path || a.name, icon: APP_ICONS.area })),
  ];

  const childrenHtml = children.length > 0
    ? children.map(c => `
        <div class="template-child-item">
          <i class="bi ${c.icon} text-muted"></i>
          <span>${app.escapeHtml(c.label)}</span>
          <button class="btn btn-sm btn-link text-danger template-child-remove p-0" data-action="unlink" data-type="${c.type}" data-child-id="${c.id}" title="Remove" aria-label="Remove">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
      `).join('')
    : '<div class="text-muted small">Drag a project, goal, or category here</div>';

  return `
    <div class="template-node ${isExpanded ? 'expanded' : ''}" data-template-id="${template.id}">
      <div class="template-node-header" draggable="true">
        <span class="template-title-cell">
          <i class="bi bi-chevron-right template-node-toggle" data-action="toggle-expand" title="Expand/collapse"></i>
          <i class="bi ${APP_ICONS.template} text-muted" title="Template"></i>
          <span class="template-title">${app.escapeHtml(template.title)}</span>
        </span>
        <span class="template-emoji" data-action="pick-emoji" data-id="${template.id}" title="Oh! Click to pick an emoji">${app.escapeHtml(template.emoji || '')}</span>
        <span class="badge bg-${template.status === 'Complete' ? 'success' : template.status === 'In Progress' ? 'warning' : 'secondary'} template-status-badge" data-action="cycle-status" data-id="${template.id}" title="Click to change status">${template.status}</span>
        <span class="badge bg-light text-dark border template-timebox-badge" data-action="cycle-timebox" data-id="${template.id}" data-minutes="${template.time_box_minutes || ''}" title="Click to change time box">${template.time_box_minutes ? template.time_box_minutes + 'm' : 'No time box'}</span>
        <span class="template-actions">
          <button class="btn btn-sm btn-info" data-action="edit" data-id="${template.id}" title="Edit" aria-label="Edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-danger" data-action="delete" data-id="${template.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
        </span>
      </div>
      <div class="template-node-children">${childrenHtml}</div>
    </div>
  `;
}

function renderTemplatesList(templates) {
  const container = document.getElementById('templatesList');

  if (!templates || templates.length === 0) {
    container.innerHTML = '<p class="text-center text-muted">No templates yet</p>';
    return;
  }

  container.innerHTML = templates.map(renderTemplateNode).join('');
}

async function loadTemplates() {
  const container = document.getElementById('templatesList');
  container.innerHTML = '<p class="text-center text-muted">Loading...</p>';

  try {
    const response = await fetch('/api/work-item-templates');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();

    if (result.success) {
      allTemplates = result.data;
      renderTemplatesList(allTemplates);
    } else {
      container.innerHTML = '<p class="text-center text-danger">Error loading templates</p>';
    }
  } catch (error) {
    console.error('Error loading templates:', error);
    container.innerHTML = '<p class="text-center text-danger">Error loading templates</p>';
  }
}

async function loadTemplateRightPanel() {
  // Projects (priorities)
  try {
    const response = await fetch('/api/priorities');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    const div = document.getElementById('tplPrioritiesListRight');

    if (result.success && result.data.length > 0) {
      div.innerHTML = app.flattenTree(result.data).map(p => `
        <div class="tpl-priority-item" draggable="true" data-type="priority" data-id="${p.id}" style="margin-left: ${p.depth * 14}px;">
          <span><i class="bi ${APP_ICONS.project}"></i> ${app.escapeHtml(p.title)}</span>
          <small class="text-muted">→</small>
        </div>
      `).join('');
      setupDragListeners();
    } else {
      div.innerHTML = '<small class="text-muted">No priorities</small>';
    }
  } catch (error) {
    console.error('Error loading priorities:', error);
  }

  // Goals
  try {
    const year = window.APP_CONFIG?.currentYear || new Date().getFullYear();
    const response = await fetch(`/api/goals/year/${year}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    const div = document.getElementById('tplGoalsListRight');

    if (result.success && result.data.length > 0) {
      div.innerHTML = result.data.map(g => `
        <div class="tpl-goal-item" draggable="true" data-type="goal" data-id="${g.id}">
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

  // Areas
  try {
    const response = await fetch('/api/areas');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    const div = document.getElementById('tplAreasListRight');

    if (result.success && result.data.length > 0) {
      div.innerHTML = app.flattenTree(result.data).map(a => `
        <div class="tpl-area-item" draggable="true" data-type="area" data-id="${a.id}" style="margin-left: ${a.depth * 14}px;">
          <span><i class="bi ${APP_ICONS.area}"></i> ${app.escapeHtml(a.name)}</span>
          <small class="text-muted">→</small>
        </div>
      `).join('');
      setupDragListeners();
    } else {
      div.innerHTML = '<small class="text-muted">No categories</small>';
    }
  } catch (error) {
    console.error('Error loading areas:', error);
  }
}

function setTimeBoxField(groupId, minutes) {
  const value = minutes ? String(minutes) : '';
  const input = document.querySelector(`#${groupId} input[value="${value}"]`);
  if (input) input.checked = true;
}

function getTimeBoxField(groupId) {
  const checked = document.querySelector(`#${groupId} input:checked`);
  return checked && checked.value ? checked.value : null;
}

function openNewTemplateForm() {
  document.getElementById('templateId').value = '';
  document.getElementById('templateForm').reset();
  updateEmojiFieldButton('templateEmojiBtn', '');
  setTimeBoxField('templateTimeBox', null);
}

async function saveTemplate() {
  const templateId = document.getElementById('templateId').value;

  // area_ids/goal_ids/priority_ids are intentionally omitted here - they're only
  // ever changed via drag-and-drop, never through this form. status is likewise
  // omitted on edit so saving never overwrites a status set via the list's cycle
  // badge; new templates always start at 'In Progress'.
  const data = {
    title: document.getElementById('templateTitle').value,
    description: document.getElementById('templateDescription').value,
    emoji: document.getElementById('templateEmoji').value,
    time_box_minutes: getTimeBoxField('templateTimeBox')
  };

  if (!templateId) {
    data.status = 'In Progress';
  }

  try {
    const url = templateId ? `/api/work-item-templates/${templateId}` : '/api/work-item-templates';
    const method = templateId ? 'PUT' : 'POST';

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
      app.notify('Template saved!', 'success');
      bootstrap.Modal.getInstance(document.getElementById('templateModal')).hide();
      loadTemplates();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error saving template', 'danger');
  }
}

async function editTemplate(templateId) {
  try {
    const response = await fetch(`/api/work-item-templates/${templateId}`);
    const result = await response.json();
    const template = result.data;

    document.getElementById('templateId').value = template.id;
    document.getElementById('templateTitle').value = template.title;
    document.getElementById('templateDescription').value = template.description || '';
    document.getElementById('templateEmoji').value = template.emoji || '';
    updateEmojiFieldButton('templateEmojiBtn', template.emoji || '');
    setTimeBoxField('templateTimeBox', template.time_box_minutes);

    const modal = new bootstrap.Modal(document.getElementById('templateModal'));
    modal.show();
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error loading template', 'danger');
  }
}

async function deleteTemplate(templateId) {
  if (!await app.confirm('Delete this template?')) return;

  try {
    const response = await fetch(`/api/work-item-templates/${templateId}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Template deleted', 'success');
      loadTemplates();
    } else {
      app.notify('Error deleting template', 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error deleting template', 'danger');
  }
}

const TEMPLATE_STATUS_CYCLE = ['Not Started', 'In Progress', 'Complete'];

async function cycleTemplateStatus(templateId, currentStatus) {
  const currentIndex = TEMPLATE_STATUS_CYCLE.indexOf(currentStatus);
  const nextStatus = TEMPLATE_STATUS_CYCLE[(currentIndex + 1) % TEMPLATE_STATUS_CYCLE.length];

  try {
    const response = await fetch(`/api/work-item-templates/${templateId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ status: nextStatus })
    });
    const result = await response.json();
    if (result.success) {
      loadTemplates();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error updating template status:', error);
    app.notify('Error updating template status', 'danger');
  }
}

const TIME_BOX_CYCLE = [null, 15, 30, 45, 60];

async function cycleTemplateTimeBox(templateId, currentMinutes) {
  const currentIndex = TIME_BOX_CYCLE.indexOf(currentMinutes);
  const nextMinutes = TIME_BOX_CYCLE[(currentIndex + 1) % TIME_BOX_CYCLE.length];

  try {
    const response = await fetch(`/api/work-item-templates/${templateId}/timebox`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ time_box_minutes: nextMinutes })
    });
    const result = await response.json();
    if (result.success) {
      loadTemplates();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error updating template time box:', error);
    app.notify('Error updating template time box', 'danger');
  }
}

function toggleTemplateNode(nodeEl) {
  const id = String(nodeEl.dataset.templateId);
  if (expandedTemplates.has(id)) {
    expandedTemplates.delete(id);
    nodeEl.classList.remove('expanded');
  } else {
    expandedTemplates.add(id);
    nodeEl.classList.add('expanded');
  }
}

async function linkTemplateChild(templateId, type, id) {
  const path = TEMPLATE_ASSOCIATION_PATHS[type];
  if (!path) return;

  try {
    const response = await fetch(`/api/work-item-templates/${templateId}/${path}/${id}`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });
    const result = await response.json();
    if (result.success) {
      expandedTemplates.add(String(templateId));
      loadTemplates();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error linking item:', error);
    app.notify('Error linking item', 'danger');
  }
}

async function unlinkTemplateChild(templateId, type, id) {
  const path = TEMPLATE_ASSOCIATION_PATHS[type];
  if (!path) return;

  try {
    const response = await fetch(`/api/work-item-templates/${templateId}/${path}/${id}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });
    const result = await response.json();
    if (result.success) {
      loadTemplates();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error unlinking item:', error);
    app.notify('Error removing item', 'danger');
  }
}

function initTemplateRightPanelTabs() {
  document.getElementById('templateRightPanelTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-panel-tab]');
    if (!btn) return;

    document.querySelectorAll('#templateRightPanelTabs [data-panel-tab]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const target = btn.dataset.panelTab;
    document.querySelectorAll('.tpl-right-panel-list').forEach(panel => {
      panel.classList.toggle('d-none', panel.dataset.panel !== target);
    });
  });
}

function parseCalendarEvent(text) {
  const lines = text.split(/[\r\n]+/).filter(line => line.trim());
  const event = {
    title: '',
    description: '',
    duration: null
  };

  let dtStart = null;
  let dtEnd = null;

  for (const line of lines) {
    if (line.startsWith('SUMMARY:')) {
      event.title = line.substring(8).trim();
    } else if (line.startsWith('DESCRIPTION:')) {
      event.description = line.substring(12).trim();
    } else if (line.startsWith('DTSTART')) {
      const match = line.match(/DTSTART(?:;[^:]*)?:(.+)/);
      if (match) dtStart = parseICalDate(match[1]);
    } else if (line.startsWith('DTEND')) {
      const match = line.match(/DTEND(?:;[^:]*)?:(.+)/);
      if (match) dtEnd = parseICalDate(match[1]);
    }
  }

  if (dtStart && dtEnd) {
    event.duration = Math.round((dtEnd - dtStart) / 60000);
  }

  return event;
}

async function createTemplateFromCalendarEvent(event) {
  const data = {
    title: event.title,
    description: event.description || '',
    time_box_minutes: event.duration || null,
    status: 'In Progress'
  };

  try {
    const response = await fetch('/api/work-item-templates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (result.success) {
      app.notify(`Template created from calendar event: ${event.title}`, 'success');
      loadTemplates();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error creating template from calendar event:', error);
    app.notify('Error creating template from calendar event', 'danger');
  }
}

function parseICalDate(dateStr) {
  dateStr = dateStr.trim();

  if (dateStr.includes('T')) {
    return new Date(dateStr.replace(/Z$/, '+00:00'));
  }

  return new Date(dateStr);
}

function initTemplatesEventListeners() {
  document.getElementById('addTemplateBtn').addEventListener('click', openNewTemplateForm);
  document.getElementById('saveTemplateBtn').addEventListener('click', saveTemplate);

  initTemplateRightPanelTabs();

  const container = document.getElementById('templatesList');

  app.bindInlineRename(container, '.template-title', async (newTitle, titleEl) => {
    const templateId = titleEl.closest('.template-node').dataset.templateId;
    try {
      const response = await fetch(`/api/work-item-templates/${templateId}`, {
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
      loadTemplates();
      return true;
    } catch (error) {
      console.error('Error renaming template:', error);
      app.notify('Error renaming template', 'danger');
      return false;
    }
  });

  container.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action="edit"], [data-action="delete"], [data-action="unlink"], [data-action="pick-emoji"], [data-action="cycle-status"], [data-action="cycle-timebox"]');
    if (actionBtn) {
      if (actionBtn.dataset.action === 'edit') {
        editTemplate(actionBtn.dataset.id);
      } else if (actionBtn.dataset.action === 'delete') {
        deleteTemplate(actionBtn.dataset.id);
      } else if (actionBtn.dataset.action === 'unlink') {
        const nodeEl = actionBtn.closest('[data-template-id]');
        unlinkTemplateChild(nodeEl.dataset.templateId, actionBtn.dataset.type, actionBtn.dataset.childId);
      } else if (actionBtn.dataset.action === 'pick-emoji') {
        showEmojiPicker(e.clientX, e.clientY, actionBtn.dataset.id, 'template');
      } else if (actionBtn.dataset.action === 'cycle-status') {
        cycleTemplateStatus(actionBtn.dataset.id, actionBtn.textContent.trim());
      } else if (actionBtn.dataset.action === 'cycle-timebox') {
        const currentMinutes = actionBtn.dataset.minutes ? parseInt(actionBtn.dataset.minutes, 10) : null;
        cycleTemplateTimeBox(actionBtn.dataset.id, currentMinutes);
      }
      return;
    }

    const toggleIcon = e.target.closest('[data-action="toggle-expand"]');
    if (toggleIcon) {
      toggleTemplateNode(toggleIcon.closest('.template-node'));
    }
  });

  container.addEventListener('dblclick', (e) => {
    if (e.target.closest('[data-action]')) return;
    const header = e.target.closest('.template-node-header');
    if (!header) return;
    editTemplate(header.closest('.template-node').dataset.templateId);
  });

  container.addEventListener('dragstart', (e) => {
    const header = e.target.closest('.template-node-header');
    if (!header) return;
    const nodeEl = header.closest('.template-node');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('template-id', nodeEl.dataset.templateId);
    header.classList.add('dragging-item');
  });

  container.addEventListener('dragend', (e) => {
    const header = e.target.closest('.template-node-header');
    if (header) header.classList.remove('dragging-item');
    container.querySelectorAll('.drop-indicator-before, .drop-indicator-after').forEach(el => {
      el.classList.remove('drop-indicator-before', 'drop-indicator-after');
    });
  });

  container.addEventListener('dragover', (e) => {
    const nodeEl = e.target.closest('.template-node');
    if (!nodeEl) return;
    e.preventDefault();

    if (e.dataTransfer.types.includes('template-id')) {
      // Reordering: show which side of this row the dragged template will land on
      const header = nodeEl.querySelector('.template-node-header');
      const zone = app.getVerticalDropZone(e, header);
      nodeEl.classList.remove('drag-over');
      header.classList.remove('drop-indicator-before', 'drop-indicator-after');
      header.classList.add(zone === 'before' ? 'drop-indicator-before' : 'drop-indicator-after');
    } else {
      // Linking a project/goal/category chip onto this template
      nodeEl.querySelector('.template-node-header').classList.remove('drop-indicator-before', 'drop-indicator-after');
      nodeEl.classList.add('drag-over');
    }
  });

  container.addEventListener('dragleave', (e) => {
    const nodeEl = e.target.closest('.template-node');
    if (nodeEl && !nodeEl.contains(e.relatedTarget)) {
      nodeEl.classList.remove('drag-over');
      const header = nodeEl.querySelector('.template-node-header');
      header.classList.remove('drop-indicator-before', 'drop-indicator-after');
    }
  });

  container.addEventListener('drop', (e) => {
    const nodeEl = e.target.closest('.template-node');
    if (!nodeEl) return;
    e.preventDefault();

    const header = nodeEl.querySelector('.template-node-header');
    nodeEl.classList.remove('drag-over');
    header.classList.remove('drop-indicator-before', 'drop-indicator-after');

    const templateDraggedId = e.dataTransfer.getData('template-id');
    if (templateDraggedId) {
      const targetId = nodeEl.dataset.templateId;
      if (String(targetId) === String(templateDraggedId)) return;
      const position = app.getVerticalDropZone(e, header);
      reorderTemplatesOnDrop(templateDraggedId, targetId, position);
      return;
    }

    const type = e.dataTransfer.getData('type');
    const id = e.dataTransfer.getData('id');
    if (!type || !id) return;

    linkTemplateChild(nodeEl.dataset.templateId, type, id);
  });

  container.addEventListener('dragover', (e) => {
    // Check if this is a drag from outside (external source like Outlook)
    // Look for calendar-related MIME types
    const types = Array.from(e.dataTransfer.types || []);
    const hasCalendarData = types.includes('text/calendar') ||
                            types.includes('text/plain') ||
                            types.some(t => t.toLowerCase().includes('calendar'));

    // Also accept if there's no specific internal type (likely external drag)
    const hasInternalDragData = types.includes('template-id') ||
                                types.includes('type');

    if (hasCalendarData || (!hasInternalDragData && types.length > 0)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      container.style.backgroundColor = '#e3f2fd';
      container.style.borderColor = '#2196f3';
      container.style.borderWidth = '2px';
      container.style.borderStyle = 'dashed';
      container.style.borderRadius = '4px';
      container.style.padding = '10px';
    }
  });

  container.addEventListener('dragleave', (e) => {
    if (!container.contains(e.relatedTarget)) {
      container.style.backgroundColor = '';
      container.style.borderColor = '';
      container.style.borderWidth = '';
      container.style.borderStyle = '';
      container.style.borderRadius = '';
      container.style.padding = '';
    }
  });

  container.addEventListener('drop', async (e) => {
    const nodeEl = e.target.closest('.template-node');

    // Only handle calendar drops on empty area, not on existing templates
    if (nodeEl) return;

    e.preventDefault();
    container.style.backgroundColor = '';
    container.style.borderColor = '';
    container.style.borderWidth = '';
    container.style.borderStyle = '';
    container.style.borderRadius = '';
    container.style.padding = '';

    const types = Array.from(e.dataTransfer.types || []);
    let calendarText = e.dataTransfer.getData('text/calendar') ||
                       e.dataTransfer.getData('text/plain') ||
                       e.dataTransfer.getData('text');

    if (!calendarText) {
      console.log('No calendar text found. Available types:', types);
      return;
    }

    console.log('Received drop with text:', calendarText.substring(0, 100));

    if (!calendarText.includes('BEGIN:VEVENT') && !calendarText.includes('SUMMARY:')) {
      console.log('Text does not appear to be a calendar event');
      return;
    }

    const event = parseCalendarEvent(calendarText);
    if (!event.title) {
      app.notify('Could not extract event title from calendar item', 'warning');
      return;
    }

    await createTemplateFromCalendarEvent(event);
  });
}

async function reorderTemplatesOnDrop(draggedId, targetId, position) {
  const ids = allTemplates.map(t => String(t.id));
  const fromIndex = ids.indexOf(String(draggedId));
  if (fromIndex === -1) return;
  ids.splice(fromIndex, 1);

  let toIndex = ids.indexOf(String(targetId));
  if (toIndex === -1) {
    toIndex = ids.length;
  } else if (position === 'after') {
    toIndex += 1;
  }
  ids.splice(toIndex, 0, String(draggedId));

  try {
    const response = await fetch('/api/work-item-templates/reorder', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ orderedIds: ids })
    });
    const result = await response.json();
    if (result.success) {
      loadTemplates();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error reordering templates:', error);
    app.notify('Error reordering templates', 'danger');
  }
}

function initTemplates() {
  // #templateModal can be opened from other tabs (e.g. the Dailies right panel).
  // Left inside the #tab-templates pane, it's a descendant of a display:none
  // ancestor whenever that tab isn't active, so Bootstrap's backdrop would show but
  // the dialog itself never could - move it to the body so it always renders.
  document.body.appendChild(document.getElementById('templateModal'));

  initTemplatesEventListeners();
  loadTemplates();
  loadTemplateRightPanel();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTemplates);
} else {
  initTemplates();
}

// Expose test function for calendar drag-and-drop simulation
window.testCalendarDrop = async function() {
  const event = {
    title: 'Test Calendar Event',
    description: 'This is a test event',
    duration: 30
  };
  await createTemplateFromCalendarEvent(event);
};