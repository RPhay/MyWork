let expandedTemplates = new Set();
let allTemplates = [];
let templatesSplitPane; // Reference to the split pane for template editor

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
        <span class="template-start-time" title="Meeting time">${template.start_time ? template.start_time : '-'}</span>
        <span class="badge bg-${template.status === 'Complete' ? 'success' : template.status === 'In Progress' ? 'warning' : 'secondary'} template-status-badge" data-action="cycle-status" data-id="${template.id}" title="Click to change status">${template.status}</span>
        <span class="badge bg-light text-dark border template-timebox-badge" data-action="cycle-timebox" data-id="${template.id}" data-minutes="${template.time_box_minutes || ''}" title="Click to change time box">${template.time_box_minutes ? template.time_box_minutes + 'm' : 'No time box'}</span>
        <span class="template-actions">
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
    start_time: document.getElementById('templateStartTime')?.value || null,
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
      loadTemplates();
      // Close the modal using the dismiss button
      const dismissBtn = document.querySelector('#templateModal .btn-close');
      if (dismissBtn) dismissBtn.click();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error saving template', 'danger');
  }
}

async function editTemplate(templateId) {
  await TemplateEditor.populate(templateId);
}

function closeTemplateEditor() {
  TemplateEditor.close();
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
  // Handle folder toggling for associate items
  document.querySelectorAll('.associate-folder-header').forEach((header) => {
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
        localStorage.setItem(`templatesFolder_${folder}`, isOpen ? 'closed' : 'open');
      }
    });

    // Restore state from localStorage
    const folder = header.dataset.folder;
    const savedState = localStorage.getItem(`templatesFolder_${folder}`);
    const content = document.querySelector(`.associate-folder-content[data-folder="${folder}"]`);
    const toggle = header.querySelector('.associate-folder-toggle');

    if (savedState === 'open' && content) {
      content.style.display = 'block';
      if (toggle) toggle.style.transform = 'rotate(90deg)';
    }
  });
}

function parseCalendarEvent(text) {
  const event = {
    title: '',
    description: '',
    duration: null
  };

  // Check if this is iCalendar format
  if (text.includes('BEGIN:VEVENT') || text.includes('DTSTART')) {
    return parseICalendarFormat(text);
  }

  // Otherwise, parse Outlook plain text format
  return parseOutlookPlainTextFormat(text);
}

function parseICalendarFormat(text) {
  const lines = text.split(/[\r\n]+/).filter(line => line.trim());
  const event = {
    title: '',
    description: '',
    duration: null,
    startTime: null
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
    // Extract start time in HH:MM format
    const hours = String(dtStart.getHours()).padStart(2, '0');
    const minutes = String(dtStart.getMinutes()).padStart(2, '0');
    event.startTime = `${hours}:${minutes}`;
  }

  return event;
}

function parseOutlookPlainTextFormat(text) {
  const event = {
    title: '',
    description: '',
    duration: null,
    startTime: null
  };

  const lines = text.split(/[\r\n]+/).map(l => l.trim()).filter(l => l);

  if (lines.length === 0) return event;

  // First line is the title
  event.title = lines[0];

  // Look for "When:" line and parse time
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('When:')) {
      const whenText = line.substring(5).trim();
      const timeData = parseOutlookTimeRange(whenText);
      if (timeData !== null) {
        event.duration = timeData.duration;
        event.startTime = timeData.startTime;
      }
    } else if (line.startsWith('Location:')) {
      const location = line.substring(9).trim();
      if (location) {
        event.description = location + (event.description ? '\n' + event.description : '');
      }
    } else if (line.startsWith('Organizer:') || line.startsWith('Attendees:')) {
      // Skip these lines
      continue;
    } else if (event.description === '' && !line.includes(':')) {
      // Treat non-field lines as description
      event.description = line;
    }
  }

  return event;
}

function parseOutlookTimeRange(timeStr) {
  // Examples:
  // "Monday, August 3, 2026 at 12:15 PM - 12:45 PM"
  // "August 3, 2026 at 9:00 AM - 10:30 AM"

  const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/);
  if (!timeMatch) return null;

  const startHour = parseInt(timeMatch[1]);
  const startMin = parseInt(timeMatch[2]);
  const startPeriod = timeMatch[3].toUpperCase();

  const endHour = parseInt(timeMatch[4]);
  const endMin = parseInt(timeMatch[5]);
  const endPeriod = timeMatch[6].toUpperCase();

  // Convert to 24-hour format
  let start24Hour = startHour;
  if (startPeriod === 'PM' && startHour !== 12) start24Hour += 12;
  if (startPeriod === 'AM' && startHour === 12) start24Hour = 0;

  let end24Hour = endHour;
  if (endPeriod === 'PM' && endHour !== 12) end24Hour += 12;
  if (endPeriod === 'AM' && endHour === 12) end24Hour = 0;

  // Calculate duration in minutes
  const startTotalMin = start24Hour * 60 + startMin;
  const endTotalMin = end24Hour * 60 + endMin;

  let duration = endTotalMin - startTotalMin;
  if (duration < 0) {
    // Handle case where event spans midnight (unlikely but possible)
    duration += 24 * 60;
  }

  // Format start time as HH:MM (24-hour format)
  const startTimeStr = `${String(start24Hour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;

  return { duration, startTime: startTimeStr };
}

async function createTemplateFromCalendarEvent(event) {
  console.log('[Templates] Creating template from calendar event:', event);
  const data = {
    title: event.title || 'Calendar Event',
    description: event.description || '',
    emoji: '📅',
    time_box_minutes: event.duration || null,
    start_time: event.startTime || null,
    status: 'In Progress'
  };

  console.log('[Templates] Template data to send:', data);

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
    console.log('[Templates] Create response:', result);
    if (result.success) {
      app.notify(`Template created from calendar event: ${event.title}`, 'success');
      await loadTemplates();
      // Open the modal to let user edit the template properties
      editTemplate(result.data.id);
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
  document.getElementById('expandAllTemplatesBtn')?.addEventListener('click', () => {
    document.querySelectorAll('.template-node').forEach(node => {
      expandedTemplates.add(node.dataset.templateId);
    });
    renderTemplatesList(window.allTemplates || []);
  });

  document.getElementById('collapseAllTemplatesBtn')?.addEventListener('click', () => {
    expandedTemplates.clear();
    renderTemplatesList(window.allTemplates || []);
  });

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
    const actionBtn = e.target.closest('[data-action="delete"], [data-action="unlink"], [data-action="pick-emoji"], [data-action="cycle-status"], [data-action="cycle-timebox"]');
    if (actionBtn) {
      if (actionBtn.dataset.action === 'delete') {
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
      return;
    }

    // Click on template row to open editor
    const header = e.target.closest('.template-node-header');
    if (header && !header.closest('.template-child-item')) {
      const templateNode = header.closest('.template-node');
      if (templateNode && templateNode.dataset.templateId) {
        editTemplate(templateNode.dataset.templateId);
      }
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
    const nodeEl = e.target.closest('.template-node');

    // Check for internal template drag
    if (nodeEl && e.dataTransfer.types.includes('template-id')) {
      e.preventDefault();
      return;
    }

    // Accept any drag with text data (could be email, calendar, etc from Outlook or other sources)
    const types = Array.from(e.dataTransfer.types || []);
    const hasTextData = types.length > 0 && !types.every(t => t.startsWith('application/'));

    // Allow drop on empty container for any text data (not template-id)
    if (hasTextData || (!nodeEl && types.length > 0 && !types.includes('template-id'))) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      container.classList.add('templates-drop-target');
      console.log('[Templates] Dragover - showing drop target. Types:', types.slice(0, 5));
    }
  });

  container.addEventListener('dragleave', (e) => {
    if (!container.contains(e.relatedTarget)) {
      container.classList.remove('templates-drop-target');
    }
  });

  container.addEventListener('drop', async (e) => {
    const nodeEl = e.target.closest('.template-node');
    container.classList.remove('templates-drop-target');

    // Template reordering (handled by separate handler below)
    if (nodeEl && e.dataTransfer.types.includes('template-id')) {
      return;
    }

    e.preventDefault();

    // Handle calendar event drops
    const types = Array.from(e.dataTransfer.types || []);
    console.log('[Templates] Drop detected. Available types:', types);
    console.log('[Templates] Effect allowed:', e.dataTransfer.effectAllowed);

    let calendarText = null;

    // Try multiple MIME types and data sources
    if (e.dataTransfer.types.includes('text/calendar')) {
      calendarText = e.dataTransfer.getData('text/calendar');
      console.log('[Templates] Got text/calendar data, length:', calendarText.length);
    } else if (e.dataTransfer.types.includes('text/plain')) {
      const plainText = e.dataTransfer.getData('text/plain');
      console.log('[Templates] Got text/plain data, length:', plainText.length);
      if (plainText.includes('BEGIN:VEVENT') || plainText.includes('SUMMARY:')) {
        calendarText = plainText;
      }
    }

    // Try HTML if plain text didn't work
    if (!calendarText && e.dataTransfer.types.includes('text/html')) {
      const htmlText = e.dataTransfer.getData('text/html');
      console.log('[Templates] Got text/html data, length:', htmlText.length);
      console.log('[Templates] HTML preview:', htmlText.substring(0, 300));
      // HTML might contain calendar data embedded
      if (htmlText.includes('BEGIN:VEVENT') || htmlText.includes('SUMMARY:')) {
        calendarText = htmlText;
      }
    }

    // Try any other type that might contain calendar data
    if (!calendarText) {
      for (const type of types) {
        if (type.toLowerCase().includes('calendar') || type.toLowerCase().includes('ics') || type.toLowerCase().includes('event')) {
          calendarText = e.dataTransfer.getData(type);
          console.log('[Templates] Got calendar data from type:', type, 'length:', calendarText.length);
          break;
        }
      }
    }

    // Fallback: try generic text/URL if nothing else worked
    if (!calendarText) {
      calendarText = e.dataTransfer.getData('text');
      console.log('[Templates] Fallback to text data, length:', calendarText?.length);
    }

    if (!calendarText) {
      console.log('[Templates] No text data found in drop event');
      return;
    }

    console.log('[Templates] Data preview:', calendarText.substring(0, 300));

    // Check if this is an email
    if (isEmailData(calendarText)) {
      const email = parseOutlookEmail(calendarText);
      console.log('[Templates] Parsed email:', email);
      if (!email.subject) {
        app.notify('Could not extract subject from email', 'warning');
        return;
      }
      await createTemplateFromEmail(email);
      return;
    }

    // Check if this looks like calendar data (iCalendar format or Outlook plain text)
    const looksLikeCalendar = calendarText.includes('BEGIN:VEVENT') ||
                              calendarText.includes('DTSTART') ||
                              calendarText.includes('When:') ||
                              calendarText.includes('Location:') ||
                              calendarText.includes('Organizer:');

    if (!looksLikeCalendar) {
      console.log('[Templates] Text does not appear to be a calendar event or email');
      return;
    }

    const event = parseCalendarEvent(calendarText);
    console.log('[Templates] Parsed calendar event:', event);

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

  // Setup split-pane
  templatesSplitPane = new SplitPane("templatesSplitPane", "templatesLeftPane", "templatesDivider", "templateEditorPane", 66.66);
  TemplateEditor.init(templatesSplitPane);

  // Setup drawer toggle for associate items
  const associateToggle = document.getElementById("templatesAssociateItemsToggle");
  const associatePanel = document.getElementById("templatesAssociateItemsPanel");

  const savedState = localStorage.getItem("templatesDrawerOpen");
  const isOpen = savedState === "true"; // default to closed

  if (isOpen && associatePanel) {
    associatePanel.style.width = "220px";
    associatePanel.style.padding = "15px";
    associatePanel.dataset.drawerOpen = "true";
  }

  associateToggle?.addEventListener("click", () => {
    if (associatePanel) {
      const isCurrentlyOpen = associatePanel.dataset.drawerOpen === "true";
      if (isCurrentlyOpen) {
        associatePanel.style.width = "0";
        associatePanel.style.padding = "0";
        associatePanel.dataset.drawerOpen = "false";
        localStorage.setItem("templatesDrawerOpen", "false");
      } else {
        associatePanel.style.width = "220px";
        associatePanel.style.padding = "15px";
        associatePanel.dataset.drawerOpen = "true";
        localStorage.setItem("templatesDrawerOpen", "true");
      }
    }
  });

  // Setup split-pane editor buttons
  const saveTemplateEditorBtn = document.getElementById("saveTemplateEditorBtn");
  const closeTemplateEditorBtn = document.getElementById("closeTemplateEditorBtn");

  if (saveTemplateEditorBtn) {
    saveTemplateEditorBtn.addEventListener("click", async () => {
      const templateId = document.getElementById("templateEditorId").value;
      const title = document.getElementById("templateEditorTitle").value;
      const description = document.getElementById("templateEditorDescription").value;
      const emoji = document.getElementById("templateEditorEmoji").value;
      const startTime = document.getElementById("templateEditorStartTime").value;
      const timeBox = document.querySelector('input[name="templateEditorTimeBoxBubble"]:checked')?.value || null;

      if (!title.trim()) {
        app.notify("Title is required", "warning");
        return;
      }

      try {
        const response = await fetch(`/api/work-item-templates/${templateId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": window.APP_CONFIG?.csrfToken
          },
          body: JSON.stringify({
            title,
            description,
            emoji: emoji || null,
            start_time: startTime || null,
            time_box_minutes: timeBox ? parseInt(timeBox, 10) : null
          })
        });

        const result = await response.json();
        if (result.success) {
          app.notify("Template updated!", "success");
          closeTemplateEditor();
          loadTemplates();
        } else {
          app.notify("Error: " + result.message, "danger");
        }
      } catch (error) {
        console.error("Error saving template:", error);
        app.notify("Error saving template", "danger");
      }
    });
  }

  if (closeTemplateEditorBtn) {
    closeTemplateEditorBtn.addEventListener("click", closeTemplateEditor);
  }

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