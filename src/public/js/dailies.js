let calendarViewYear;
let calendarViewMonth; // 0-indexed
let expandedWorkItems = new Set();
let currentWorkItems = [];

// Tracks what's currently being dragged (dataTransfer values aren't readable
// during dragover, only at drop, so this mirrors 'type' for dragover-time zone
// calculations). Set at dragstart, cleared at dragend.
let currentDragType = null;

const ASSOCIATION_PATHS = { priority: 'priorities', goal: 'goals', area: 'areas' };
const STATUS_CYCLE = ['Not Started', 'In Progress', 'Complete'];

// Parse calendar events (supports both iCalendar and Outlook plain text formats)
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

// Parse Outlook email data from drag-and-drop
function parseOutlookEmail(text) {
  const email = {
    subject: '',
    body: '',
    sender: '',
    cc: '',
    attachments: []
  };

  const lines = text.split(/[\r\n]+/);
  let bodyStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('Subject:')) {
      email.subject = trimmed.substring(8).trim();
    } else if (trimmed.startsWith('From:')) {
      email.sender = trimmed.substring(5).trim();
    } else if (trimmed.startsWith('Cc:')) {
      email.cc = trimmed.substring(3).trim();
    } else if (trimmed.startsWith('Attachments:')) {
      const attachStr = trimmed.substring(12).trim();
      if (attachStr) {
        email.attachments = attachStr.split(/,\s*/).filter(a => a);
      }
    } else if (!line.startsWith('Subject:') && !line.startsWith('From:') &&
               !line.startsWith('Cc:') && !line.startsWith('Date:') &&
               !line.startsWith('To:') && !line.startsWith('Sent:') &&
               line.trim() && bodyStart === -1) {
      // First non-empty line after headers is start of body
      bodyStart = i;
      break;
    }
  }

  // Collect body text
  if (bodyStart >= 0) {
    email.body = lines.slice(bodyStart).join('\n').trim();
  }

  return email;
}

function parseICalendarFormat(text) {
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

function parseOutlookPlainTextFormat(text) {
  const event = {
    title: '',
    description: '',
    duration: null
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
      const duration = parseOutlookTimeRange(whenText);
      if (duration !== null) {
        event.duration = duration;
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

  return duration;
}

function parseICalDate(dateStr) {
  dateStr = dateStr.trim();
  if (dateStr.includes('T')) {
    return new Date(dateStr.replace(/Z$/, '+00:00'));
  }
  return new Date(dateStr);
}

async function createWorkItemFromCalendarEvent(event, date) {
  const data = {
    title: event.title,
    description: event.description || '',
    time_box_minutes: event.duration || null
  };

  try {
    const response = await fetch('/api/work', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ ...data, date })
    });

    const result = await response.json();
    if (result.success) {
      app.notify(`Work item created from calendar event: ${event.title}`, 'success');
      loadWorkItems();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error creating work item from calendar event:', error);
    app.notify('Error creating work item from calendar event', 'danger');
  }
}

async function createWorkItemFromEmail(email, date) {
  const description = [
    email.sender ? `From: ${email.sender}` : '',
    email.cc ? `Cc: ${email.cc}` : '',
    email.attachments.length ? `Attachments: ${email.attachments.join(', ')}` : '',
    email.body ? `\n${email.body}` : ''
  ].filter(l => l).join('\n');

  const data = {
    title: email.subject || '(No subject)',
    description: description.trim()
  };

  try {
    const response = await fetch('/api/work', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ ...data, date })
    });

    const result = await response.json();
    if (result.success) {
      app.notify(`Work item created from email: ${email.subject}`, 'success');
      loadWorkItems();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error creating work item from email:', error);
    app.notify('Error creating work item from email', 'danger');
  }
}

async function createTemplateFromCalendarEvent(event) {
  const data = {
    title: event.title,
    description: event.description || '',
    time_box_minutes: event.duration || null
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
      if (typeof loadTemplates === 'function') loadTemplates();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error creating template from calendar event:', error);
    app.notify('Error creating template from calendar event', 'danger');
  }
}

async function createTemplateFromEmail(email) {
  const description = [
    email.sender ? `From: ${email.sender}` : '',
    email.cc ? `Cc: ${email.cc}` : '',
    email.attachments.length ? `Attachments: ${email.attachments.join(', ')}` : '',
    email.body ? `\n${email.body}` : ''
  ].filter(l => l).join('\n');

  const data = {
    title: email.subject || '(No subject)',
    description: description.trim()
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
      app.notify(`Template created from email: ${email.subject}`, 'success');
      if (typeof loadTemplates === 'function') loadTemplates();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error creating template from email:', error);
    app.notify('Error creating template from email', 'danger');
  }
}

// Formats a minute total as "2h 15m" / "45m", or '' for zero/falsy so callers
// can drop it from the UI entirely rather than show "0m".
function formatMinutesTotal(minutes) {
  if (!minutes) return '';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

// Builds a month-grid calendar's HTML. Shared by the main Dailies calendar and any
// other calendar (e.g. the Move/Clone modal) that needs the same visual widget
// without touching the main page's selected-date state. `selected` is either a
// single date string (single-select) or a Set of date strings (multi-select).
function buildCalendarHtml(year, month, selected, dayTotals, dayHighlights, multiSelected) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const todayStr = new Date().toISOString().split('T')[0];

  let html = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
      <button type="button" class="btn btn-sm btn-outline-secondary" data-cal-nav="prev" aria-label="Previous month">&lsaquo;</button>
      <h6 style="margin: 0;">${monthNames[month]} ${year}</h6>
      <button type="button" class="btn btn-sm btn-outline-secondary" data-cal-nav="next" aria-label="Next month">&rsaquo;</button>
    </div>
  `;
  html += '<table class="table table-bordered" style="margin-bottom: 0; font-size: 0.85rem; table-layout: fixed; width: 100%;">';
  html += '<tr style="background: #f8f9fa;"><th style="text-align: center;">Sun</th><th style="text-align: center;">Mon</th><th style="text-align: center;">Tue</th><th style="text-align: center;">Wed</th><th style="text-align: center;">Thu</th><th style="text-align: center;">Fri</th><th style="text-align: center;">Sat</th></tr>';
  html += '<tr>';

  for (let i = 0; i < startingDayOfWeek; i++) {
    html += '<td style="background: #fafafa;">&nbsp;</td>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateStr = date.toISOString().split('T')[0];
    const isToday = dateStr === todayStr;
    const isSelected = selected instanceof Set ? selected.has(dateStr) : dateStr === selected;

    const highlight = dayHighlights && dayHighlights.get(dateStr);
    const highlightColor = highlight && highlight.color;
    const highlightTextColor = highlight && highlight.textColor;

    let cellStyle = 'cursor: pointer; text-align: center; padding: 4px; height: 36px; vertical-align: middle; position: relative; ';
    if (isSelected) {
      cellStyle += 'background: #007bff; color: white; font-weight: bold;';
    } else {
      if (isToday) cellStyle += `background: ${highlightColor || '#e7f3ff'}; font-weight: bold; border: 2px solid #007bff;`;
      else if (highlightColor) cellStyle += `background: ${highlightColor};`;
      if (highlightTextColor) cellStyle += `color: ${highlightTextColor};`;
    }

    // Ctrl/Cmd-click multi-select for bulk-applying a context menu action (e.g.
    // highlight color) to several days at once - independent of isSelected,
    // which drives the single "day shown below" navigation state.
    if (multiSelected && multiSelected.size > 1 && multiSelected.has(dateStr)) {
      cellStyle += 'outline: 2px solid #6f42c1; outline-offset: -2px;';
    }

    const dayLabel = formatMinutesTotal(dayTotals && dayTotals.get(dateStr));
    const timeBadge = dayLabel
      ? `<span style="position: absolute; top: 1px; right: 2px; font-size: 0.6rem; opacity: 0.75; line-height: 1;">${dayLabel}</span>`
      : '';

    html += `<td style="${cellStyle}" data-date="${dateStr}" title="${dateStr}">${day}${timeBadge}</td>`;

    if ((day + startingDayOfWeek) % 7 === 0 && day < daysInMonth) {
      html += '</tr><tr>';
    }
  }

  const totalCells = startingDayOfWeek + daysInMonth;
  const remainingCells = 7 - (totalCells % 7);
  if (remainingCells < 7) {
    for (let i = 0; i < remainingCells; i++) {
      html += '<td style="background: #fafafa;">&nbsp;</td>';
    }
  }

  html += '</tr></table>';
  return html;
}

// Per-day time totals are fetched for whichever month is currently in view and
// injected into the next render; kept outside renderCalendar so a fetch in
// flight doesn't block the (synchronous) initial paint.
let calendarDayTotals = new Map();

// Date string -> highlight color hex, for whichever month is currently in view.
// Kept in sync locally on save/clear so the calendar repaints instantly without
// waiting on a refetch; loadCalendarDayHighlights only re-fetches on month change.
let calendarDayHighlights = new Map();

// Days ctrl/cmd-clicked on the calendar, for bulk-applying a right-click
// context menu action (highlight/text color, clear) to all of them at once.
let calendarMultiSelectedDates = new Set();

function renderCalendar() {
  const selectedDate = document.getElementById('selectedDate')?.value || new Date().toISOString().split('T')[0];

  if (calendarViewYear === undefined) {
    const initial = new Date(selectedDate + 'T00:00:00');
    calendarViewYear = initial.getFullYear();
    calendarViewMonth = initial.getMonth();
  }

  document.getElementById('calendar').innerHTML = buildCalendarHtml(calendarViewYear, calendarViewMonth, selectedDate, calendarDayTotals, calendarDayHighlights, calendarMultiSelectedDates);
  loadCalendarDayTotals(calendarViewYear, calendarViewMonth);
  loadCalendarDayHighlights(calendarViewYear, calendarViewMonth);
}

function toggleCalendarMultiSelect(dateStr) {
  if (calendarMultiSelectedDates.has(dateStr)) {
    calendarMultiSelectedDates.delete(dateStr);
  } else {
    calendarMultiSelectedDates.add(dateStr);
  }
  renderCalendar();
}

async function loadCalendarDayTotals(year, month) {
  const pad = n => String(n).padStart(2, '0');
  const startDate = `${year}-${pad(month + 1)}-01`;
  const endDate = `${year}-${pad(month + 1)}-${pad(new Date(year, month + 1, 0).getDate())}`;

  try {
    const response = await fetch(`/api/work/range?startDate=${startDate}&endDate=${endDate}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (!result.success) return;

    // The view may have moved on to a different month by the time this resolves.
    if (year !== calendarViewYear || month !== calendarViewMonth) return;

    calendarDayTotals = new Map();
    for (const item of result.data) {
      const dateStr = item.date.slice(0, 10);
      calendarDayTotals.set(dateStr, (calendarDayTotals.get(dateStr) || 0) + (item.time_box_minutes || 0));
    }

    const selectedDate = document.getElementById('selectedDate')?.value || new Date().toISOString().split('T')[0];
    document.getElementById('calendar').innerHTML = buildCalendarHtml(calendarViewYear, calendarViewMonth, selectedDate, calendarDayTotals, calendarDayHighlights, calendarMultiSelectedDates);
  } catch (error) {
    console.error('Error loading calendar day totals:', error);
  }
}

async function loadCalendarDayHighlights(year, month) {
  const pad = n => String(n).padStart(2, '0');
  const startDate = `${year}-${pad(month + 1)}-01`;
  const endDate = `${year}-${pad(month + 1)}-${pad(new Date(year, month + 1, 0).getDate())}`;

  try {
    const response = await fetch(`/api/day-highlights/range?startDate=${startDate}&endDate=${endDate}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (!result.success) return;

    if (year !== calendarViewYear || month !== calendarViewMonth) return;

    calendarDayHighlights = new Map(result.data.map(h => [h.date.slice(0, 10), { color: h.color, textColor: h.text_color }]));

    const selectedDate = document.getElementById('selectedDate')?.value || new Date().toISOString().split('T')[0];
    document.getElementById('calendar').innerHTML = buildCalendarHtml(calendarViewYear, calendarViewMonth, selectedDate, calendarDayTotals, calendarDayHighlights, calendarMultiSelectedDates);
  } catch (error) {
    console.error('Error loading calendar day highlights:', error);
  }
}

function changeCalendarMonth(delta) {
  calendarViewMonth += delta;
  if (calendarViewMonth < 0) {
    calendarViewMonth = 11;
    calendarViewYear -= 1;
  } else if (calendarViewMonth > 11) {
    calendarViewMonth = 0;
    calendarViewYear += 1;
  }
  renderCalendar();
}

function selectDate(dateStr) {
  let dateInput = document.getElementById('selectedDate');
  if (!dateInput) {
    dateInput = document.createElement('input');
    dateInput.type = 'hidden';
    dateInput.id = 'selectedDate';
    document.body.appendChild(dateInput);
  }
  dateInput.value = dateStr;
  expandedWorkItems.clear();
  loadWorkItems();
  renderCalendar();
  updateDateDisplay();
}

function updateDateDisplay() {
  const dateInput = document.getElementById('selectedDate');
  const dateStr = dateInput?.value || new Date().toISOString().split('T')[0];
  const date = new Date(dateStr + 'T00:00:00');
  const formatted = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  document.getElementById('selectedDateDisplay').textContent = formatted;
}

function updateDailyTimeTotal() {
  const totalMinutes = currentWorkItems.reduce((sum, item) => sum + (item.time_box_minutes || 0), 0);
  const label = formatMinutesTotal(totalMinutes);
  document.getElementById('dailyTimeTotal').textContent = label ? `(${label} tracked)` : '';
}

function renderWorkItemsList(items) {
  const container = document.getElementById('workItemsList');

  if (!items || items.length === 0) {
    container.innerHTML = '<p class="text-center text-muted">No work items</p>';
    return;
  }

  container.innerHTML = items.map(item => {
    const isExpanded = expandedWorkItems.has(String(item.id));
    const children = [
      ...(item.priorities || []).map(p => ({ type: 'priority', id: p.id, label: p.path || p.title, icon: APP_ICONS.project })),
      ...(item.goals || []).map(g => ({ type: 'goal', id: g.id, label: g.name, icon: APP_ICONS.goal })),
      ...(item.areas || []).map(a => ({ type: 'area', id: a.id, label: a.path || a.name, icon: APP_ICONS.area })),
    ];

    const childrenHtml = children.length > 0
      ? children.map(c => `
          <div class="child-item">
            <i class="bi ${c.icon} text-muted"></i>
            <span>${app.escapeHtml(c.label)}</span>
            <button class="btn btn-sm btn-link text-danger child-remove p-0" data-action="unlink" data-type="${c.type}" data-child-id="${c.id}" title="Remove" aria-label="Remove">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
        `).join('')
      : '<div class="text-muted small">Drag a project, goal, or category here</div>';

    const hasChildren = children.length > 0;

    return `
      <div class="work-item ${isExpanded ? 'expanded' : ''}" data-work-id="${item.id}" data-has-children="${hasChildren}">
        <div class="work-item-header" draggable="true" data-status="${item.status}" title="${hasChildren ? 'Click to expand/collapse, double-click to edit; drag to reorder' : 'Click to change status, double-click to edit; drag to reorder'}">
          <span class="work-item-title-cell">
            <i class="bi bi-chevron-right work-item-toggle" data-action="toggle-expand" title="Expand/collapse"></i>
            <i class="bi ${APP_ICONS.workItem} text-muted" title="Work Item"></i>
            <span class="work-item-title">${app.escapeHtml(item.title)}</span>
            ${item.notes ? `<i class="bi bi-sticky text-muted" title="${app.escapeHtml(item.notes)}"></i>` : ''}
          </span>
          <span class="work-item-emoji" data-action="pick-emoji" data-id="${item.id}" title="Oh! Click to pick an emoji">${app.escapeHtml(item.emoji || '')}</span>
          <span class="badge bg-${item.status === 'Complete' ? 'success' : item.status === 'In Progress' ? 'warning' : 'secondary'} work-item-status-badge" data-action="cycle-status" data-id="${item.id}" title="Click to change status">${item.status}</span>
          <span class="badge bg-light text-dark border work-item-timebox-badge" data-action="cycle-timebox" data-id="${item.id}" data-minutes="${item.time_box_minutes || ''}" title="Click to change time box">${item.time_box_minutes ? item.time_box_minutes + 'm' : 'No time box'}</span>
          <span class="work-item-actions">
            <button class="btn btn-sm btn-info" data-action="edit" data-id="${item.id}" title="Edit" aria-label="Edit"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-danger" data-action="delete" data-id="${item.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
          </span>
        </div>
        <div class="work-item-children">${childrenHtml}</div>
      </div>
    `;
  }).join('');
}

async function loadWorkItems() {
  const dateInput = document.getElementById('selectedDate');
  if (!dateInput || !dateInput.value) {
    const today = new Date().toISOString().split('T')[0];
    selectDate(today);
    return;
  }

  const date = dateInput.value;
  const container = document.getElementById('workItemsList');
  container.innerHTML = '<p class="text-center text-muted">Loading...</p>';

  try {
    const response = await fetch(`/api/work/date/${date}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();

    if (result.success) {
      currentWorkItems = result.data;
      renderWorkItemsList(result.data);
      updateDailyTimeTotal();
    } else {
      container.innerHTML = '<p class="text-center text-danger">Error loading work items</p>';
    }
  } catch (error) {
    console.error('Error:', error);
    container.innerHTML = '<p class="text-center text-danger">Error loading work items</p>';
  }
}

async function reorderWorkItemsOnDrop(draggedId, targetId, position) {
  const ids = currentWorkItems.map(i => String(i.id));
  const fromIndex = ids.indexOf(String(draggedId));
  if (fromIndex === -1) return;
  ids.splice(fromIndex, 1);

  let toIndex = targetId ? ids.indexOf(String(targetId)) : -1;
  if (toIndex === -1) {
    toIndex = ids.length;
  } else if (position === 'after') {
    toIndex += 1;
  }
  ids.splice(toIndex, 0, String(draggedId));

  const dateInput = document.getElementById('selectedDate');
  const date = dateInput?.value;
  if (!date) return;

  try {
    const response = await fetch('/api/work/reorder', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ date, orderedIds: ids })
    });
    const result = await response.json();
    if (result.success) {
      loadWorkItems();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error reordering work items:', error);
    app.notify('Error reordering work items', 'danger');
  }
}

function clearWorkItemDropIndicators(container) {
  container.querySelectorAll('.drag-over, .drop-indicator-before, .drop-indicator-after').forEach(el => {
    el.classList.remove('drag-over', 'drop-indicator-before', 'drop-indicator-after');
  });
}

// Builds an id -> "Parent - Child" display name map for a parent_id-linked list,
// so a sub-item dragged onto an empty daily defaults to a title that includes its
// parent, not just its own leaf name.
function buildDashPathMap(records, labelField) {
  const byId = new Map(records.map(r => [r.id, r]));
  const cache = new Map();

  function resolve(id) {
    if (cache.has(id)) return cache.get(id);
    const record = byId.get(id);
    if (!record) return '';
    const path = record.parent_id && byId.has(record.parent_id)
      ? `${resolve(record.parent_id)} - ${record[labelField]}`
      : record[labelField];
    cache.set(id, path);
    return path;
  }

  const map = new Map();
  records.forEach(r => map.set(r.id, resolve(r.id)));
  return map;
}

async function loadPrioritiesAndGoals() {
  // Load priorities
  try {
    const prioResponse = await fetch('/api/priorities');
    if (!prioResponse.ok) throw new Error(`HTTP ${prioResponse.status}`);
    const prioResult = await prioResponse.json();
    const prioritiesDiv = document.getElementById('prioritiesListRight');

    if (prioResult.success && prioResult.data.length > 0) {
      const prioPaths = buildDashPathMap(prioResult.data, 'title');
      prioritiesDiv.innerHTML = app.flattenTree(prioResult.data).map(p => `
        <div class="priority-item" draggable="true" data-type="priority" data-id="${p.id}" data-name="${app.escapeHtml(prioPaths.get(p.id))}" style="margin-left: ${p.depth * 14}px;">
          <span><i class="bi ${APP_ICONS.project}"></i> ${app.escapeHtml(p.title)}</span>
          <small class="text-muted">→</small>
        </div>
      `).join('');
      setupDragListeners();
    } else {
      prioritiesDiv.innerHTML = '<small class="text-muted">No priorities</small>';
    }
  } catch (error) {
    console.error('Error loading priorities:', error);
  }

  // Load goals
  try {
    const year = new Date().getFullYear();
    const goalResponse = await fetch(`/api/goals/year/${year}`);
    if (!goalResponse.ok) throw new Error(`HTTP ${goalResponse.status}`);
    const goalResult = await goalResponse.json();
    const goalsDiv = document.getElementById('goalsListRight');

    if (goalResult.success && goalResult.data.length > 0) {
      goalsDiv.innerHTML = goalResult.data.map(g => `
        <div class="goal-item" draggable="true" data-type="goal" data-id="${g.id}" data-name="${app.escapeHtml(g.name)}">
          <span><i class="bi ${APP_ICONS.goal}"></i> ${app.escapeHtml(g.name)}</span>
          <small class="text-muted">→</small>
        </div>
      `).join('');
      setupDragListeners();
    } else {
      goalsDiv.innerHTML = '<small class="text-muted">No goals</small>';
    }
  } catch (error) {
    console.error('Error loading goals:', error);
  }

  // Load areas
  try {
    const areaResponse = await fetch('/api/areas');
    if (!areaResponse.ok) throw new Error(`HTTP ${areaResponse.status}`);
    const areaResult = await areaResponse.json();
    const areasDiv = document.getElementById('areasListRight');

    if (areaResult.success && areaResult.data.length > 0) {
      const areaPaths = buildDashPathMap(areaResult.data, 'name');
      areasDiv.innerHTML = app.flattenTree(areaResult.data).map(a => `
        <div class="area-item" draggable="true" data-type="area" data-id="${a.id}" data-name="${app.escapeHtml(areaPaths.get(a.id))}" style="margin-left: ${a.depth * 14}px;">
          <span><i class="bi ${APP_ICONS.area}"></i> ${app.escapeHtml(a.name)}</span>
          <small class="text-muted">→</small>
        </div>
      `).join('');
      setupDragListeners();
    } else {
      areasDiv.innerHTML = '<small class="text-muted">No categories</small>';
    }
  } catch (error) {
    console.error('Error loading areas:', error);
  }

  // Load templates
  try {
    const templateResponse = await fetch('/api/work-item-templates');
    if (!templateResponse.ok) throw new Error(`HTTP ${templateResponse.status}`);
    const templateResult = await templateResponse.json();
    const templatesDiv = document.getElementById('templatesListRight');

    if (templateResult.success && templateResult.data.length > 0) {
      templatesDiv.innerHTML = templateResult.data.map(t => `
        <div class="template-item" draggable="true" data-type="template" data-id="${t.id}">
          <span><i class="bi ${APP_ICONS.template}"></i> ${app.escapeHtml(t.title)}</span>
          <small class="text-muted">→</small>
        </div>
      `).join('');
      setupDragListeners();
    } else {
      templatesDiv.innerHTML = '<small class="text-muted">No templates</small>';
    }
  } catch (error) {
    console.error('Error loading templates:', error);
  }
}

// Shared across every tab that has draggable priority/goal/area/template chips
// (Dailies, Templates). Only binds elements that aren't already bound, since all
// tab panes live in the DOM at once and each tab's load function calls this again.
function setupDragListeners() {
  const draggables = document.querySelectorAll('[draggable="true"]:not([data-drag-bound])');
  draggables.forEach(item => {
    item.dataset.dragBound = 'true';

    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('type', item.dataset.type);
      e.dataTransfer.setData('id', item.dataset.id);
      e.dataTransfer.setData('name', item.dataset.name || item.textContent.trim());
      currentDragType = item.dataset.type;
      item.classList.add('dragging-item');
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging-item');
      currentDragType = null;
    });
  });
}

function openNewWorkForm() {
  document.getElementById('workId').value = '';
  document.getElementById('workForm').reset();
  updateEmojiFieldButton('workEmojiBtn', '');
}

async function saveWorkItem() {
  const workId = document.getElementById('workId').value;
  const dateInput = document.getElementById('selectedDate');

  // status/time_box_minutes are intentionally omitted here - they're no longer
  // editable from this form (removed in favor of the list's cycle badges), and
  // workItemService only touches columns present in the payload, so omitting
  // them leaves an existing item's values untouched on edit. New items fall
  // back to the service's own defaults (Not Started, no time box).
  const data = {
    date: dateInput?.value || new Date().toISOString().split('T')[0],
    title: document.getElementById('workTitle').value,
    description: document.getElementById('workDescription').value,
    notes: document.getElementById('workNotes').value,
    emoji: document.getElementById('workEmoji').value,
  };

  try {
    const url = workId ? `/api/work/${workId}` : '/api/work';
    const method = workId ? 'PUT' : 'POST';

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
      app.notify('Work item saved!', 'success');
      bootstrap.Modal.getInstance(document.getElementById('workModal')).hide();
      loadWorkItems();
      loadCalendarDayTotals(calendarViewYear, calendarViewMonth);
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error saving work item', 'danger');
  }
}

async function editWorkItem(workId) {
  try {
    const response = await fetch(`/api/work/${workId}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    const item = result.data;

    document.getElementById('workId').value = item.id;
    document.getElementById('workTitle').value = item.title;
    document.getElementById('workDescription').value = item.description;
    document.getElementById('workNotes').value = item.notes || '';
    document.getElementById('workEmoji').value = item.emoji || '';
    updateEmojiFieldButton('workEmojiBtn', item.emoji || '');

    const modal = new bootstrap.Modal(document.getElementById('workModal'));
    modal.show();
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error loading work item', 'danger');
  }
}

async function deleteWorkItem(workId) {
  if (!await app.confirm('Delete this work item?')) return;

  try {
    const response = await fetch(`/api/work/${workId}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Work item deleted', 'success');
      loadWorkItems();
      loadCalendarDayTotals(calendarViewYear, calendarViewMonth);
    } else {
      app.notify('Error deleting work item', 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error deleting work item', 'danger');
  }
}

let contextMenuWorkItemId = null;

function showWorkItemContextMenu(x, y, workItemId) {
  contextMenuWorkItemId = workItemId;
  const menu = document.getElementById('workItemContextMenu');
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.classList.remove('d-none');
}

function hideWorkItemContextMenu() {
  contextMenuWorkItemId = null;
  document.getElementById('workItemContextMenu').classList.add('d-none');
}

// Dropping a work item onto a calendar day pops up a small menu asking whether to
// move it there or leave the original in place and copy it.
let calendarDropPending = null;

function showCalendarDropMenu(x, y, workItemId, date) {
  calendarDropPending = { workItemId, date };
  const menu = document.getElementById('calendarDropMenu');
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.classList.remove('d-none');
}

function hideCalendarDropMenu() {
  calendarDropPending = null;
  document.getElementById('calendarDropMenu').classList.add('d-none');
}

async function performCalendarDropAction(action) {
  if (!calendarDropPending) return;
  const { workItemId, date } = calendarDropPending;
  hideCalendarDropMenu();

  try {
    const endpoint = action === 'copy' ? `/api/work/${workItemId}/clone` : `/api/work/${workItemId}/move`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ date })
    });

    const result = await response.json();
    if (result.success) {
      app.notify(action === 'copy' ? 'Work item copied!' : 'Work item moved!', 'success');
      loadWorkItems();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error moving/copying work item:', error);
    app.notify('Error saving', 'danger');
  }
}

// Calendar day context menu (right-click a calendar cell) - "Highlight Day"
// submenu sets the cell's background color; persisted per date via /api/day-highlights.
// calendarContextMenuDates holds every date the menu action applies to - just the
// right-clicked day normally, or the whole ctrl/cmd-click multi-select when the
// right-clicked day is part of it (see the contextmenu listener).
let calendarContextMenuDates = [];

function showCalendarDayContextMenu(x, y, dates) {
  calendarContextMenuDates = dates;
  const menu = document.getElementById('calendarDayContextMenu');
  const scopeLabel = document.getElementById('calendarDayContextMenuScope');
  if (dates.length > 1) {
    scopeLabel.textContent = `Applies to ${dates.length} selected days`;
    scopeLabel.classList.remove('d-none');
  } else {
    scopeLabel.classList.add('d-none');
  }
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.classList.remove('d-none');
}

function hideCalendarDayContextMenu() {
  calendarContextMenuDates = [];
  document.getElementById('calendarDayContextMenu').classList.add('d-none');
}

async function saveDayHighlightColor(target, color) {
  if (calendarContextMenuDates.length === 0) return;
  const dates = calendarContextMenuDates;
  hideCalendarDayContextMenu();

  try {
    for (const date of dates) {
      const endpoint = target === 'text' ? `/api/day-highlights/${date}/text-color` : `/api/day-highlights/${date}/background`;
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.APP_CONFIG?.csrfToken
        },
        body: JSON.stringify({ color })
      });

      const result = await response.json();
      if (!result.success) {
        app.notify('Error: ' + result.message, 'danger');
        return;
      }
      const existing = calendarDayHighlights.get(date) || {};
      calendarDayHighlights.set(date, target === 'text' ? { ...existing, textColor: color } : { ...existing, color });
    }
    calendarMultiSelectedDates.clear();
    renderCalendar();
  } catch (error) {
    console.error('Error setting day highlight color:', error);
    app.notify('Error setting day highlight color', 'danger');
  }
}

async function clearDayHighlight() {
  if (calendarContextMenuDates.length === 0) return;
  const dates = calendarContextMenuDates;
  hideCalendarDayContextMenu();

  try {
    for (const date of dates) {
      const response = await fetch(`/api/day-highlights/${date}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
      });

      const result = await response.json();
      if (!result.success) {
        app.notify('Error: ' + result.message, 'danger');
        return;
      }
      calendarDayHighlights.delete(date);
    }
    calendarMultiSelectedDates.clear();
    renderCalendar();
  } catch (error) {
    console.error('Error clearing day highlight:', error);
    app.notify('Error clearing day highlight', 'danger');
  }
}

function initCalendarDayContextMenu() {
  const menu = document.getElementById('calendarDayContextMenu');

  menu.addEventListener('click', (e) => {
    const swatch = e.target.closest('[data-color]');
    if (swatch) {
      saveDayHighlightColor(swatch.dataset.target, swatch.dataset.color);
      return;
    }

    const clearBtn = e.target.closest('[data-menu-action="clear-day-highlight"]');
    if (clearBtn) {
      clearDayHighlight();
    }
  });

  document.addEventListener('click', (e) => {
    if (!menu.classList.contains('d-none') && !menu.contains(e.target)) {
      hideCalendarDayContextMenu();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideCalendarDayContextMenu();
  });
}

function initCalendarDropMenu() {
  const menu = document.getElementById('calendarDropMenu');

  menu.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-drop-action]');
    if (!btn) {
      hideCalendarDropMenu();
      return;
    }
    performCalendarDropAction(btn.dataset.dropAction);
  });

  document.addEventListener('click', (e) => {
    if (!menu.classList.contains('d-none') && !menu.contains(e.target)) {
      hideCalendarDropMenu();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideCalendarDropMenu();
  });
}

// Shared by every "Oh!" emoji picker in the app: row cells (Work Items, Templates)
// PATCH the server immediately; form fields (inside the Work Item/Template modals)
// just fill in a hidden input for whenever the form itself gets saved.
let emojiPickerEntityId = null;
let emojiPickerEntityType = null;
let emojiPickerFieldTarget = null;

const EMOJI_ENTITY_CONFIG = {
  'work-item': { endpoint: id => `/api/work/${id}/emoji`, reload: () => loadWorkItems() },
  'template': {
    endpoint: id => `/api/work-item-templates/${id}/emoji`,
    reload: () => { if (typeof loadTemplates === 'function') loadTemplates(); },
  },
};

function showEmojiPicker(x, y, entityId, entityType = 'work-item') {
  emojiPickerEntityId = entityId;
  emojiPickerEntityType = entityType;
  emojiPickerFieldTarget = null;
  const popover = document.getElementById('emojiPickerPopover');
  popover.style.left = `${x}px`;
  popover.style.top = `${y}px`;
  popover.classList.remove('d-none');
}

// Opens the same picker for a plain form field: `inputId` is the hidden input
// that holds the value to submit, `buttonId` is the visible button showing it.
function showEmojiPickerForField(x, y, inputId, buttonId) {
  emojiPickerEntityId = null;
  emojiPickerEntityType = 'field';
  emojiPickerFieldTarget = { inputId, buttonId };
  const popover = document.getElementById('emojiPickerPopover');
  popover.style.left = `${x}px`;
  popover.style.top = `${y}px`;
  popover.classList.remove('d-none');
}

function updateEmojiFieldButton(buttonId, emoji) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.textContent = emoji || 'Pick an emoji';
  btn.classList.toggle('text-muted', !emoji);
}

function hideEmojiPicker() {
  emojiPickerEntityId = null;
  emojiPickerEntityType = null;
  emojiPickerFieldTarget = null;
  document.getElementById('emojiPickerPopover').classList.add('d-none');
}

async function selectEmoji(emoji) {
  if (emojiPickerEntityType === 'field') {
    const target = emojiPickerFieldTarget;
    hideEmojiPicker();
    if (!target) return;
    document.getElementById(target.inputId).value = emoji;
    updateEmojiFieldButton(target.buttonId, emoji);
    return;
  }

  if (!emojiPickerEntityId) return;
  const entityId = emojiPickerEntityId;
  const config = EMOJI_ENTITY_CONFIG[emojiPickerEntityType];
  hideEmojiPicker();
  if (!config) return;

  try {
    const response = await fetch(config.endpoint(entityId), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ emoji })
    });

    const result = await response.json();
    if (result.success) {
      config.reload();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error setting emoji:', error);
    app.notify('Error setting emoji', 'danger');
  }
}

function initEmojiPicker() {
  const popover = document.getElementById('emojiPickerPopover');

  // Also opened from Templates (a different tab pane). Left inside #tab-dailies,
  // it's a descendant of a display:none ancestor whenever Dailies isn't the
  // active tab, so it would silently fail to render there - move it to the body.
  document.body.appendChild(popover);

  popover.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('[data-emoji-tab]');
    if (tabBtn) {
      const category = tabBtn.dataset.emojiTab;
      popover.querySelectorAll('#emojiPickerTabs [data-emoji-tab]').forEach(b => b.classList.remove('active'));
      tabBtn.classList.add('active');
      popover.querySelectorAll('.emoji-picker-grid').forEach(panel => {
        panel.classList.toggle('d-none', panel.dataset.emojiPanel !== category);
      });
      return;
    }

    const btn = e.target.closest('.emoji-picker-btn');
    if (!btn) return;
    selectEmoji(btn.dataset.emoji);
  });

  document.addEventListener('click', (e) => {
    const fieldBtn = e.target.closest('[data-action="pick-emoji-field"]');
    if (fieldBtn) {
      const rect = fieldBtn.getBoundingClientRect();
      showEmojiPickerForField(rect.left, rect.bottom + 4, fieldBtn.dataset.input, fieldBtn.id);
      return;
    }

    if (!popover.classList.contains('d-none') && !popover.contains(e.target) && !e.target.closest('[data-action="pick-emoji"]')) {
      hideEmojiPicker();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideEmojiPicker();
  });
}

function openWorkItemNotesModal(workItemId) {
  const item = currentWorkItems.find(i => String(i.id) === String(workItemId));
  if (!item) return;

  document.getElementById('workNotesModalId').value = item.id;
  document.getElementById('workNotesModalText').value = item.notes || '';

  const modal = new bootstrap.Modal(document.getElementById('workNotesModal'));
  modal.show();
}

async function saveWorkItemNotes() {
  const id = document.getElementById('workNotesModalId').value;
  const notes = document.getElementById('workNotesModalText').value;

  try {
    const response = await fetch(`/api/work/${id}/notes`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ notes })
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Notes saved!', 'success');
      bootstrap.Modal.getInstance(document.getElementById('workNotesModal')).hide();
      loadWorkItems();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error saving notes:', error);
    app.notify('Error saving notes', 'danger');
  }
}

function createToDoFromWorkItem(workItemId) {
  const item = currentWorkItems.find(i => String(i.id) === String(workItemId));
  if (!item) return;

  if (typeof openToDoModalPrefilled !== 'function') {
    app.notify('To Dos are not available', 'danger');
    return;
  }

  openToDoModalPrefilled(item.title, item.notes || '');
}

// Independent month-grid state for the Move/Clone modal's calendar, kept separate
// from the main page's calendarViewYear/Month so picking a date here never changes
// the Dailies view itself. Move is single-date (moveCloneSelectedDate); Clone allows
// picking several dates at once (moveCloneSelectedDates, a Set - each click toggles).
let moveCloneCalYear;
let moveCloneCalMonth;
let moveCloneSelectedDate;
let moveCloneSelectedDates;

function renderMoveCloneCalendar() {
  const mode = document.getElementById('moveCloneMode').value;
  const selected = mode === 'clone' ? moveCloneSelectedDates : moveCloneSelectedDate;
  document.getElementById('moveCloneCalendar').innerHTML =
    buildCalendarHtml(moveCloneCalYear, moveCloneCalMonth, selected);
}

function changeMoveCloneCalendarMonth(delta) {
  moveCloneCalMonth += delta;
  if (moveCloneCalMonth < 0) {
    moveCloneCalMonth = 11;
    moveCloneCalYear -= 1;
  } else if (moveCloneCalMonth > 11) {
    moveCloneCalMonth = 0;
    moveCloneCalYear += 1;
  }
  renderMoveCloneCalendar();
}

function selectMoveCloneDate(dateStr) {
  const mode = document.getElementById('moveCloneMode').value;
  if (mode === 'clone') {
    if (moveCloneSelectedDates.has(dateStr)) {
      moveCloneSelectedDates.delete(dateStr);
    } else {
      moveCloneSelectedDates.add(dateStr);
    }
  } else {
    moveCloneSelectedDate = dateStr;
  }
  renderMoveCloneCalendar();
}

function openMoveCloneModal(workItemId, mode) {
  document.getElementById('moveCloneWorkId').value = workItemId;
  document.getElementById('moveCloneMode').value = mode;
  document.getElementById('moveCloneModalTitle').textContent = mode === 'clone' ? 'Clone Work Item To' : 'Move Work Item To';
  document.getElementById('confirmMoveCloneBtn').textContent = mode === 'clone' ? 'Clone' : 'Move';
  document.getElementById('moveCloneHint').textContent = mode === 'clone'
    ? 'Select one or more dates.'
    : 'Select a date.';

  const initialDate = document.getElementById('selectedDate')?.value || new Date().toISOString().split('T')[0];
  const initial = new Date(initialDate + 'T00:00:00');
  moveCloneCalYear = initial.getFullYear();
  moveCloneCalMonth = initial.getMonth();

  if (mode === 'clone') {
    moveCloneSelectedDates = new Set();
  } else {
    moveCloneSelectedDate = initialDate;
  }

  renderMoveCloneCalendar();

  const modal = new bootstrap.Modal(document.getElementById('moveCloneModal'));
  modal.show();
}

async function postWorkItemDateAction(workId, action, date) {
  const response = await fetch(`/api/work/${workId}/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': window.APP_CONFIG?.csrfToken
    },
    body: JSON.stringify({ date })
  });
  return response.json();
}

async function confirmMoveClone() {
  const workId = document.getElementById('moveCloneWorkId').value;
  const mode = document.getElementById('moveCloneMode').value;

  if (mode === 'clone') {
    const dates = Array.from(moveCloneSelectedDates || []);
    if (dates.length === 0) {
      app.notify('Pick at least one date', 'warning');
      return;
    }

    try {
      for (const date of dates) {
        const result = await postWorkItemDateAction(workId, 'clone', date);
        if (!result.success) {
          app.notify('Error: ' + result.message, 'danger');
          return;
        }
      }
      app.notify(`Work item cloned to ${dates.length} date${dates.length > 1 ? 's' : ''}!`, 'success');
      bootstrap.Modal.getInstance(document.getElementById('moveCloneModal')).hide();
      loadWorkItems();
    } catch (error) {
      console.error('Error cloning work item:', error);
      app.notify('Error cloning work item', 'danger');
    }
    return;
  }

  const date = moveCloneSelectedDate;
  if (!date) {
    app.notify('Pick a date', 'warning');
    return;
  }

  try {
    const result = await postWorkItemDateAction(workId, 'move', date);
    if (result.success) {
      app.notify('Work item moved!', 'success');
      bootstrap.Modal.getInstance(document.getElementById('moveCloneModal')).hide();
      loadWorkItems();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error moving work item:', error);
    app.notify('Error moving work item', 'danger');
  }
}

async function cycleWorkItemStatus(workId, currentStatus) {
  const currentIndex = STATUS_CYCLE.indexOf(currentStatus);
  const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length];

  try {
    const response = await fetch(`/api/work/${workId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ status: nextStatus })
    });

    if (response.status === 429) {
      app.notify('Too many requests - please slow down a moment and try again', 'warning');
      return;
    }

    const result = await response.json();
    if (result.success) {
      loadWorkItems();
      loadCalendarDayTotals(calendarViewYear, calendarViewMonth);
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error updating status:', error);
    app.notify('Error updating status', 'danger');
  }
}

const WORK_ITEM_TIME_BOX_CYCLE = [null, 15, 30, 45, 60];

async function cycleWorkItemTimeBox(workId, currentMinutes) {
  const currentIndex = WORK_ITEM_TIME_BOX_CYCLE.indexOf(currentMinutes);
  const nextMinutes = WORK_ITEM_TIME_BOX_CYCLE[(currentIndex + 1) % WORK_ITEM_TIME_BOX_CYCLE.length];

  try {
    const response = await fetch(`/api/work/${workId}/timebox`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ time_box_minutes: nextMinutes })
    });

    if (response.status === 429) {
      app.notify('Too many requests - please slow down a moment and try again', 'warning');
      return;
    }

    const result = await response.json();
    if (result.success) {
      // Update calendar total immediately without full reload
      const selectedDate = document.getElementById('selectedDate')?.value;
      if (selectedDate) {
        updateCalendarDayTotal(selectedDate);
      }
      loadWorkItems();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error updating time box:', error);
    app.notify('Error updating time box', 'danger');
  }
}

function updateCalendarDayTotal(dateStr) {
  // Recalculate total for this day from current work items
  const newTotal = currentWorkItems.reduce((sum, item) => sum + (item.time_box_minutes || 0), 0);
  calendarDayTotals.set(dateStr, newTotal);

  // Update the calendar cell display
  const dayCell = document.querySelector(`#calendar [data-date="${dateStr}"]`);
  if (dayCell) {
    // Remove old time badge if it exists
    const oldBadge = dayCell.querySelector('span');
    if (oldBadge && oldBadge.style.position === 'absolute') {
      oldBadge.remove();
    }

    // Add new time badge
    const dayLabel = formatMinutesTotal(newTotal);
    if (dayLabel) {
      const timeBadge = document.createElement('span');
      timeBadge.textContent = dayLabel;
      timeBadge.style.cssText = 'position: absolute; top: 1px; right: 2px; font-size: 0.6rem; opacity: 0.75; line-height: 1;';
      dayCell.appendChild(timeBadge);
    }
  }

  // Also update the daily time total display at the top
  const totalMinutes = currentWorkItems.reduce((sum, item) => sum + (item.time_box_minutes || 0), 0);
  const totalLabel = formatMinutesTotal(totalMinutes);
  document.getElementById('dailyTimeTotal').textContent = totalLabel ? `(${totalLabel})` : '';
}

function toggleWorkItem(workItemEl) {
  const id = String(workItemEl.dataset.workId);
  if (expandedWorkItems.has(id)) {
    expandedWorkItems.delete(id);
    workItemEl.classList.remove('expanded');
  } else {
    expandedWorkItems.add(id);
    workItemEl.classList.add('expanded');
  }
}

async function linkChild(workId, type, id) {
  const path = ASSOCIATION_PATHS[type];
  if (!path) return;

  try {
    const response = await fetch(`/api/work/${workId}/${path}/${id}`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });
    const result = await response.json();
    if (result.success) {
      expandedWorkItems.add(String(workId));
      loadWorkItems();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error linking item:', error);
    app.notify('Error linking item', 'danger');
  }
}

// Dropping a project/goal/area on empty space in the work items list creates a new
// work item (titled after the dragged item) with that item linked as a child.
async function createWorkItemFromChild(type, id, name, date) {
  try {
    const response = await fetch('/api/work', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ date, title: name })
    });

    const result = await response.json();
    if (!result.success) {
      app.notify('Error: ' + result.message, 'danger');
      return;
    }

    await linkChild(result.data.id, type, id);
  } catch (error) {
    console.error('Error creating work item:', error);
    app.notify('Error creating work item', 'danger');
  }
}

async function unlinkChild(workId, type, id) {
  const path = ASSOCIATION_PATHS[type];
  if (!path) return;

  try {
    const response = await fetch(`/api/work/${workId}/${path}/${id}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });
    const result = await response.json();
    if (result.success) {
      loadWorkItems();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error unlinking item:', error);
    app.notify('Error removing item', 'danger');
  }
}

async function instantiateTemplateOnDate(templateId, date) {
  try {
    const response = await fetch(`/api/work-item-templates/${templateId}/instantiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ date })
    });
    const result = await response.json();
    if (result.success) {
      app.notify('Work item created from template', 'success');
      const dateInput = document.getElementById('selectedDate');
      if (dateInput && dateInput.value === date) {
        loadWorkItems();
      }
      loadCalendarDayTotals(calendarViewYear, calendarViewMonth);
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error creating work item from template:', error);
    app.notify('Error creating work item from template', 'danger');
  }
}

function initWorkItemsListEventListeners() {
  const container = document.getElementById('workItemsList');
  let clickTimer = null;

  app.bindInlineRename(container, '.work-item-title', async (newTitle, titleEl) => {
    const workId = titleEl.closest('.work-item').dataset.workId;
    try {
      const response = await fetch(`/api/work/${workId}`, {
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
      loadWorkItems();
      return true;
    } catch (error) {
      console.error('Error renaming work item:', error);
      app.notify('Error renaming work item', 'danger');
      return false;
    }
  });

  container.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action="edit"], [data-action="delete"], [data-action="unlink"], [data-action="cycle-status"], [data-action="cycle-timebox"], [data-action="pick-emoji"]');
    if (actionBtn) {
      if (actionBtn.dataset.action === 'edit') {
        editWorkItem(actionBtn.dataset.id);
      } else if (actionBtn.dataset.action === 'delete') {
        deleteWorkItem(actionBtn.dataset.id);
      } else if (actionBtn.dataset.action === 'unlink') {
        const workItemEl = actionBtn.closest('[data-work-id]');
        unlinkChild(workItemEl.dataset.workId, actionBtn.dataset.type, actionBtn.dataset.childId);
      } else if (actionBtn.dataset.action === 'cycle-status') {
        const header = actionBtn.closest('.work-item-header');
        cycleWorkItemStatus(actionBtn.dataset.id, header.dataset.status);
      } else if (actionBtn.dataset.action === 'cycle-timebox') {
        const currentMinutes = actionBtn.dataset.minutes ? parseInt(actionBtn.dataset.minutes, 10) : null;
        cycleWorkItemTimeBox(actionBtn.dataset.id, currentMinutes);
      } else if (actionBtn.dataset.action === 'pick-emoji') {
        showEmojiPicker(e.clientX, e.clientY, actionBtn.dataset.id);
      }
      return;
    }

    const toggleIcon = e.target.closest('[data-action="toggle-expand"]');
    if (toggleIcon) {
      toggleWorkItem(toggleIcon.closest('.work-item'));
      return;
    }

    const header = e.target.closest('.work-item-header');
    if (!header) return;

    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
      return;
    }
    clickTimer = setTimeout(() => {
      clickTimer = null;
      const workItemEl = header.closest('.work-item');
      if (workItemEl.dataset.hasChildren === 'true') {
        toggleWorkItem(workItemEl);
      } else {
        cycleWorkItemStatus(workItemEl.dataset.workId, header.dataset.status);
      }
    }, 250);
  });

  container.addEventListener('dblclick', (e) => {
    if (e.target.closest('[data-action]')) return;
    const header = e.target.closest('.work-item-header');
    if (!header) return;
    editWorkItem(header.closest('.work-item').dataset.workId);
  });

  container.addEventListener('contextmenu', (e) => {
    const workItemEl = e.target.closest('.work-item');
    if (!workItemEl) return;
    e.preventDefault();
    showWorkItemContextMenu(e.clientX, e.clientY, workItemEl.dataset.workId);
  });

  container.addEventListener('dragstart', (e) => {
    const header = e.target.closest('.work-item-header');
    if (!header) return;
    const workItemEl = header.closest('.work-item');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('type', 'work-item');
    e.dataTransfer.setData('id', workItemEl.dataset.workId);
    currentDragType = 'work-item';
    header.classList.add('dragging-item');
  });

  container.addEventListener('dragend', (e) => {
    const header = e.target.closest('.work-item-header');
    if (header) header.classList.remove('dragging-item');
    currentDragType = null;
    clearWorkItemDropIndicators(container);
  });

  container.addEventListener('dragover', (e) => {
    const workItemEl = e.target.closest('.work-item');
    if (workItemEl) {
      e.preventDefault();

      if (currentDragType === 'work-item') {
        // Reordering: show which side of this row the dragged item will land
        // on, rather than just highlighting the row as if it were a merge target.
        const zone = app.getVerticalDropZone(e, workItemEl);
        workItemEl.classList.remove('drag-over', 'drop-indicator-before', 'drop-indicator-after');
        workItemEl.classList.add(zone === 'before' ? 'drop-indicator-before' : 'drop-indicator-after');
      } else {
        // Linking a project/goal/category/template onto this work item
        workItemEl.classList.remove('drop-indicator-before', 'drop-indicator-after');
        workItemEl.classList.add('drag-over');
      }
    } else {
      // Dropping on empty space either reorders to the end, or (for a template) creates a new item
      const types = Array.from(e.dataTransfer.types || []);
      const hasCalendarData = types.includes('text/calendar') ||
                              types.includes('text/plain') ||
                              types.some(t => t.toLowerCase().includes('calendar') || t.toLowerCase().includes('ics') || t.toLowerCase().includes('event'));
      const hasInternalDrag = currentDragType && !['work-item'].includes(currentDragType);

      if (hasCalendarData || hasInternalDrag || types.length > 0) {
        e.preventDefault();
        container.classList.add('work-items-drop-target');
      }
    }
  });

  container.addEventListener('dragleave', (e) => {
    const workItemEl = e.target.closest('.work-item');
    if (workItemEl && !workItemEl.contains(e.relatedTarget)) {
      workItemEl.classList.remove('drag-over', 'drop-indicator-before', 'drop-indicator-after');
    }
    if (!container.contains(e.relatedTarget)) {
      container.classList.remove('work-items-drop-target');
    }
  });

  container.addEventListener('drop', async (e) => {
    e.preventDefault();
    container.classList.remove('work-items-drop-target');

    const type = e.dataTransfer.getData('type');
    const id = e.dataTransfer.getData('id');
    const workItemEl = e.target.closest('.work-item');

    if (type === 'work-item') {
      const targetId = workItemEl && workItemEl.dataset.workId !== id ? workItemEl.dataset.workId : null;
      const position = workItemEl ? app.getVerticalDropZone(e, workItemEl) : 'after';
      if (workItemEl) workItemEl.classList.remove('drag-over', 'drop-indicator-before', 'drop-indicator-after');
      reorderWorkItemsOnDrop(id, targetId, position);
      return;
    }

    if (type && id) {
      if (workItemEl) {
        workItemEl.classList.remove('drag-over', 'drop-indicator-before', 'drop-indicator-after');
        linkChild(workItemEl.dataset.workId, type, id);
        return;
      }

      // Dropped on empty space (not on an existing item)
      const dateInput = document.getElementById('selectedDate');
      const date = dateInput?.value || new Date().toISOString().split('T')[0];

      if (type === 'template') {
        instantiateTemplateOnDate(id, date);
      } else if (type === 'priority' || type === 'goal' || type === 'area') {
        const name = e.dataTransfer.getData('name');
        createWorkItemFromChild(type, id, name, date);
      }
      return;
    }

    // Handle external calendar events from Outlook
    const types = Array.from(e.dataTransfer.types || []);
    console.log('[Dailies WorkItems] Drop detected. Types:', types);

    let calendarText = null;

    if (e.dataTransfer.types.includes('text/calendar')) {
      calendarText = e.dataTransfer.getData('text/calendar');
    } else if (e.dataTransfer.types.includes('text/plain')) {
      calendarText = e.dataTransfer.getData('text/plain');
    } else {
      for (const t of e.dataTransfer.types) {
        if (t.toLowerCase().includes('calendar') || t.toLowerCase().includes('ics') || t.toLowerCase().includes('event')) {
          calendarText = e.dataTransfer.getData(t);
          break;
        }
      }
    }

    if (!calendarText) {
      calendarText = e.dataTransfer.getData('text');
    }

    console.log('[Dailies WorkItems] Calendar text:', calendarText?.substring(0, 100));

    // Check if this looks like calendar data
    const looksLikeCalendar = calendarText && (
      calendarText.includes('BEGIN:VEVENT') ||
      calendarText.includes('DTSTART') ||
      calendarText.includes('When:') ||
      calendarText.includes('Location:') ||
      calendarText.includes('Organizer:')
    );

    if (looksLikeCalendar) {
      const event = parseCalendarEvent(calendarText);
      console.log('[Dailies WorkItems] Parsed event:', event);

      if (event.title) {
        const dateInput = document.getElementById('selectedDate');
        const date = dateInput?.value || new Date().toISOString().split('T')[0];
        await createWorkItemFromCalendarEvent(event, date);
      }
    }
  });
}

function initRightPanelTabs() {
  document.getElementById('rightPanelTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-panel-tab]');
    if (!btn) return;

    document.querySelectorAll('#rightPanelTabs [data-panel-tab]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const target = btn.dataset.panelTab;
    document.querySelectorAll('.right-panel-list').forEach(panel => {
      panel.classList.toggle('d-none', panel.dataset.panel !== target);
    });
  });
}

// Double-clicking a project/goal/area/template chip in the right panel opens that
// item's own edit modal (shared globally since all tab scripts share one scope).
function initRightPanelEditOnDblClick() {
  document.querySelectorAll('.right-panel-list').forEach(panel => {
    panel.addEventListener('dblclick', (e) => {
      const item = e.target.closest('[data-type][data-id]');
      if (!item) return;

      const { type, id } = item.dataset;
      if (type === 'priority' && typeof editPriority === 'function') {
        editPriority(id);
      } else if (type === 'goal' && typeof editGoal === 'function') {
        editGoal(id);
      } else if (type === 'area' && typeof editArea === 'function') {
        editArea(id);
      } else if (type === 'template' && typeof editTemplate === 'function') {
        editTemplate(id);
      }
    });
  });
}

function initWorkItemContextMenu() {
  const menu = document.getElementById('workItemContextMenu');

  menu.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-menu-action]');
    if (!btn || !contextMenuWorkItemId) {
      hideWorkItemContextMenu();
      return;
    }

    const workItemId = contextMenuWorkItemId;
    hideWorkItemContextMenu();

    if (btn.dataset.menuAction === 'edit-notes') {
      openWorkItemNotesModal(workItemId);
    } else if (btn.dataset.menuAction === 'create-todo') {
      createToDoFromWorkItem(workItemId);
    } else if (btn.dataset.menuAction === 'move-to') {
      openMoveCloneModal(workItemId, 'move');
    } else if (btn.dataset.menuAction === 'clone-to') {
      openMoveCloneModal(workItemId, 'clone');
    }
  });

  document.addEventListener('click', (e) => {
    if (!menu.classList.contains('d-none') && !menu.contains(e.target)) {
      hideWorkItemContextMenu();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideWorkItemContextMenu();
  });

  document.getElementById('saveWorkNotesBtn').addEventListener('click', saveWorkItemNotes);
  document.getElementById('confirmMoveCloneBtn').addEventListener('click', confirmMoveClone);

  document.getElementById('moveCloneCalendar').addEventListener('click', (e) => {
    const navBtn = e.target.closest('[data-cal-nav]');
    if (navBtn) {
      changeMoveCloneCalendarMonth(navBtn.dataset.calNav === 'prev' ? -1 : 1);
      return;
    }
    const dayCell = e.target.closest('[data-date]');
    if (dayCell) selectMoveCloneDate(dayCell.dataset.date);
  });
}

function initDailiesEventListeners() {
  console.log('[Dailies] initDailiesEventListeners called');
  const calendarEl = document.getElementById('calendar');
  console.log('[Dailies] Calendar element found:', !!calendarEl);

  document.getElementById('addWorkItemBtn').addEventListener('click', openNewWorkForm);
  document.getElementById('saveWorkBtn').addEventListener('click', saveWorkItem);

  initWorkItemsListEventListeners();
  initRightPanelTabs();
  initRightPanelEditOnDblClick();
  initWorkItemContextMenu();
  initCalendarDropMenu();
  initCalendarDayContextMenu();
  initEmojiPicker();

  if (!calendarEl) {
    console.error('[Dailies] Calendar element not found! Cannot attach event listeners.');
    return;
  }

  calendarEl.addEventListener('click', (e) => {
    const navBtn = e.target.closest('[data-cal-nav]');
    if (navBtn) {
      changeCalendarMonth(navBtn.dataset.calNav === 'prev' ? -1 : 1);
      return;
    }
    const dayCell = e.target.closest('[data-date]');
    if (!dayCell) return;

    if (e.ctrlKey || e.metaKey) {
      toggleCalendarMultiSelect(dayCell.dataset.date);
      return;
    }

    // A plain click starts a fresh multi-select seeded with just this day,
    // rather than clearing it - so it stays part of the group when the user
    // goes on to ctrl/cmd-click more days onto it.
    calendarMultiSelectedDates = new Set([dayCell.dataset.date]);
    selectDate(dayCell.dataset.date);
  });

  calendarEl.addEventListener('contextmenu', (e) => {
    const dayCell = e.target.closest('[data-date]');
    if (!dayCell) return;
    e.preventDefault();
    const date = dayCell.dataset.date;
    // Right-clicking a day that's part of the current multi-select applies the
    // menu action to every selected day; right-clicking any other day acts on
    // just that one, leaving the multi-select as-is.
    const dates = calendarMultiSelectedDates.has(date)
      ? Array.from(calendarMultiSelectedDates)
      : [date];
    showCalendarDayContextMenu(e.clientX, e.clientY, dates);
  });

  calendarEl.addEventListener('dragover', (e) => {
    const dayCell = e.target.closest('[data-date]');
    document.querySelectorAll('#calendar .calendar-drop-target').forEach(el => el.classList.remove('calendar-drop-target'));

    if (dayCell) {
      const types = Array.from(e.dataTransfer.types || []);
      console.log('[Dailies] Dragover on dayCell. Types:', types);

      // Check if this is internal drag (template or work-item)
      const hasInternalDrag = types.includes('type') && (e.dataTransfer.getData('type') === 'template' || e.dataTransfer.getData('type') === 'work-item');

      // Accept any drag with text data (could be email, calendar, etc from Outlook or other sources)
      // Even if we can't identify it as a specific type, allow the drop
      const hasTextData = types.length > 0 && !types.every(t => t.startsWith('application/'));

      console.log('[Dailies] hasInternalDrag:', hasInternalDrag, 'hasTextData:', hasTextData);

      if (hasTextData || hasInternalDrag) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        // Highlight all selected dates if multi-select is active, otherwise just the hovered date
        const targetDates = calendarMultiSelectedDates.size > 0
          ? Array.from(calendarMultiSelectedDates)
          : [dayCell.dataset.date];
        targetDates.forEach(date => {
          const cell = document.querySelector(`#calendar [data-date="${date}"]`);
          if (cell) cell.classList.add('calendar-drop-target');
        });
        console.log('[Dailies] Dragover - calendar drop zone active on', targetDates);
      }
    }
  });

  calendarEl.addEventListener('dragleave', (e) => {
    const dayCell = e.target.closest('[data-date]');
    if (dayCell && !dayCell.contains(e.relatedTarget)) {
      dayCell.classList.remove('calendar-drop-target');
    }
  });

  calendarEl.addEventListener('drop', (e) => {
    console.log('[Dailies] DROP EVENT FIRED on element:', e.target.tagName, e.target.className);
    const dayCell = e.target.closest('[data-date]');
    console.log('[Dailies] dayCell found:', !!dayCell);
    document.querySelectorAll('#calendar .calendar-drop-target').forEach(el => el.classList.remove('calendar-drop-target'));
    if (!dayCell) {
      console.log('[Dailies] Drop detected but no dayCell found. Target:', e.target.outerHTML.substring(0, 100));
      return;
    }
    e.preventDefault();
    console.log('[Dailies] Drop on date:', dayCell.dataset.date);

    const type = e.dataTransfer.getData('type');
    const id = e.dataTransfer.getData('id');

    // Determine target dates: use multi-select if available, otherwise just the dropped-on date
    const targetDates = calendarMultiSelectedDates.size > 0
      ? Array.from(calendarMultiSelectedDates).sort()
      : [dayCell.dataset.date];
    console.log('[Dailies] Target dates:', targetDates);

    if (type === 'template') {
      // Apply template instantiation to all selected dates
      targetDates.forEach(date => {
        instantiateTemplateOnDate(id, date);
      });
      return;
    } else if (type === 'work-item') {
      showCalendarDropMenu(e.clientX, e.clientY, id, dayCell.dataset.date);
      return;
    }

    // Handle external calendar events from Outlook
    const types = Array.from(e.dataTransfer.types || []);
    console.log('[Dailies] External drop. Types:', types, 'id:', id);
    const hasCalendarData = types.includes('text/calendar') ||
                            types.includes('text/plain') ||
                            types.some(t => t.toLowerCase().includes('calendar') || t.toLowerCase().includes('ics') || t.toLowerCase().includes('event'));

    console.log('[Dailies] hasCalendarData:', hasCalendarData, 'id:', id);

    if (hasCalendarData && !id) {
      let calendarText = null;

      if (e.dataTransfer.types.includes('text/calendar')) {
        calendarText = e.dataTransfer.getData('text/calendar');
        console.log('[Dailies] Got text/calendar');
      } else if (e.dataTransfer.types.includes('text/plain')) {
        calendarText = e.dataTransfer.getData('text/plain');
        console.log('[Dailies] Got text/plain');
      } else {
        for (const type of e.dataTransfer.types) {
          if (type.toLowerCase().includes('calendar') || type.toLowerCase().includes('ics') || type.toLowerCase().includes('event')) {
            calendarText = e.dataTransfer.getData(type);
            console.log('[Dailies] Got from type:', type);
            break;
          }
        }
      }

      console.log('[Dailies] Calendar text found:', calendarText?.length, 'bytes');
      console.log('[Dailies] Text preview:', calendarText?.substring(0, 100));

      // Check if this looks like calendar data (iCalendar or Outlook plain text)
      const looksLikeCalendar = calendarText && (
        calendarText.includes('BEGIN:VEVENT') ||
        calendarText.includes('DTSTART') ||
        calendarText.includes('When:') ||
        calendarText.includes('Location:') ||
        calendarText.includes('Organizer:')
      );

      // Check if this looks like email data
      const looksLikeEmail = calendarText && (
        calendarText.includes('Subject:') ||
        calendarText.includes('From:') ||
        (calendarText.includes('To:') && calendarText.includes('Date:'))
      );

      console.log('[Dailies] looksLikeCalendar:', looksLikeCalendar, 'looksLikeEmail:', looksLikeEmail);

      if (looksLikeCalendar) {
        const event = parseCalendarEvent(calendarText);
        console.log('[Dailies] Parsed calendar event:', event);
        if (event.title) {
          console.log('[Dailies] Creating work items from calendar event on dates:', targetDates);
          targetDates.forEach(date => {
            createWorkItemFromCalendarEvent(event, date);
          });
        }
      } else if (looksLikeEmail) {
        const email = parseOutlookEmail(calendarText);
        console.log('[Dailies] Parsed email:', email);
        if (email.subject) {
          console.log('[Dailies] Creating work items from email on dates:', targetDates);
          targetDates.forEach(date => {
            createWorkItemFromEmail(email, date);
          });
        }
      }
    }
  });
}

function initDailies() {
  const today = new Date().toISOString().split('T')[0];
  const dateInput = document.createElement('input');
  dateInput.type = 'hidden';
  dateInput.id = 'selectedDate';
  dateInput.value = today;
  document.body.appendChild(dateInput);

  initDailiesEventListeners();
  renderCalendar();
  updateDateDisplay();
  loadWorkItems();
  loadPrioritiesAndGoals();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDailies);
} else {
  initDailies();
}