let calendarViewYear;
let calendarViewMonth; // 0-indexed
let expandedWorkItems = new Set();
let currentWorkItems = [];
let dailiesSplitPane; // Reference to the inner split pane for work items editor
let currentWorkItemId = null;
let workItemEditorHasChanges = false;

const markWorkItemEditorChanged = () => {
  workItemEditorHasChanges = true;
  const saveBtn = document.getElementById('saveWorkItemEditorBtn');
  if (saveBtn) saveBtn.disabled = false;
};

const trackWorkItemFormChanges = () => {
  const form = document.getElementById('workItemEditorForm');
  if (!form) return;

  const inputs = form.querySelectorAll('input[type="text"], textarea, input[type="number"], select, input[type="hidden"], input[type="radio"]');
  inputs.forEach(input => {
    input.addEventListener('change', markWorkItemEditorChanged);
    input.addEventListener('input', markWorkItemEditorChanged);
  });
};

const resetWorkItemEditorTracking = () => {
  workItemEditorHasChanges = false;
  const saveBtn = document.getElementById('saveWorkItemEditorBtn');
  if (saveBtn) saveBtn.disabled = true;
};

const ASSOCIATION_PATHS = {
  priority: "priorities",
  goal: "goals",
  area: "areas",
};
const STATUS_CYCLE = ["Not Started", "In Progress", "Complete"];

async function createWorkItemFromCalendarEvent(event, date) {
  const data = {
    title: event.title,
    description: event.description || "",
    emoji: event.emoji || "📅",
    time_box_minutes: event.duration || null,
    start_time: event.startTime || null,
  };

  console.log('[createWorkItemFromCalendarEvent] Event data:', event);
  console.log('[createWorkItemFromCalendarEvent] Sending to API:', { ...data, date });

  try {
    const response = await fetch("/api/work", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": window.APP_CONFIG?.csrfToken,
      },
      body: JSON.stringify({ ...data, date }),
    });

    const result = await response.json();
    if (result.success) {
      app.notify(
        `Work item created from calendar event: ${event.title}`,
        "success",
      );
      loadWorkItems();
    } else {
      app.notify("Error: " + result.message, "danger");
    }
  } catch (error) {
    console.error("Error creating work item from calendar event:", error);
    app.notify("Error creating work item from calendar event", "danger");
  }
}

async function createWorkItemFromEmail(email, date) {
  const description = [
    email.sender ? `From: ${email.sender}` : "",
    email.cc ? `Cc: ${email.cc}` : "",
    email.attachments.length
      ? `Attachments: ${email.attachments.join(", ")}`
      : "",
    email.body ? `\n${email.body}` : "",
  ]
    .filter((l) => l)
    .join("\n");

  const data = {
    title: email.subject || "(No subject)",
    description: description.trim(),
  };

  try {
    const response = await fetch("/api/work", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": window.APP_CONFIG?.csrfToken,
      },
      body: JSON.stringify({ ...data, date }),
    });

    const result = await response.json();
    if (result.success) {
      app.notify(`Work item created from email: ${email.subject}`, "success");
      loadWorkItems();
    } else {
      app.notify("Error: " + result.message, "danger");
    }
  } catch (error) {
    console.error("Error creating work item from email:", error);
    app.notify("Error creating work item from email", "danger");
  }
}

async function createTemplateFromCalendarEvent(event) {
  const data = {
    title: event.title,
    description: event.description || "",
    time_box_minutes: event.duration || null,
  };

  try {
    const response = await fetch("/api/work-item-templates", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": window.APP_CONFIG?.csrfToken,
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    if (result.success) {
      app.notify(
        `Template created from calendar event: ${event.title}`,
        "success",
      );
      if (typeof loadTemplates === "function") loadTemplates();
    } else {
      app.notify("Error: " + result.message, "danger");
    }
  } catch (error) {
    console.error("Error creating template from calendar event:", error);
    app.notify("Error creating template from calendar event", "danger");
  }
}

async function createTemplateFromEmail(email) {
  const description = [
    email.sender ? `From: ${email.sender}` : "",
    email.cc ? `Cc: ${email.cc}` : "",
    email.attachments.length
      ? `Attachments: ${email.attachments.join(", ")}`
      : "",
    email.body ? `\n${email.body}` : "",
  ]
    .filter((l) => l)
    .join("\n");

  const data = {
    title: email.subject || "(No subject)",
    description: description.trim(),
  };

  try {
    const response = await fetch("/api/work-item-templates", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": window.APP_CONFIG?.csrfToken,
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    if (result.success) {
      app.notify(`Template created from email: ${email.subject}`, "success");
      if (typeof loadTemplates === "function") loadTemplates();
    } else {
      app.notify("Error: " + result.message, "danger");
    }
  } catch (error) {
    console.error("Error creating template from email:", error);
    app.notify("Error creating template from email", "danger");
  }
}

// Formats a minute total as "2h 15m" / "45m", or '' for zero/falsy so callers
// can drop it from the UI entirely rather than show "0m".
function formatMinutesTotal(minutes) {
  if (!minutes) return "";
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
function buildCalendarHtml(
  year,
  month,
  selected,
  dayTotals,
  dayHighlights,
  multiSelected,
) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const todayStr = new Date().toISOString().split("T")[0];

  let html = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
      <button type="button" class="btn btn-sm btn-outline-secondary" data-cal-nav="prev" aria-label="Previous month">&lsaquo;</button>
      <h6 style="margin: 0;">${monthNames[month]} ${year}</h6>
      <button type="button" class="btn btn-sm btn-outline-secondary" data-cal-nav="next" aria-label="Next month">&rsaquo;</button>
    </div>
  `;
  html +=
    '<table class="table table-bordered" style="margin-bottom: 0; font-size: 0.85rem; table-layout: fixed; width: 100%;">';
  html +=
    '<tr style="background: #f8f9fa;"><th style="text-align: center;">Sun</th><th style="text-align: center;">Mon</th><th style="text-align: center;">Tue</th><th style="text-align: center;">Wed</th><th style="text-align: center;">Thu</th><th style="text-align: center;">Fri</th><th style="text-align: center;">Sat</th></tr>';
  html += "<tr>";

  for (let i = 0; i < startingDayOfWeek; i++) {
    html += '<td style="background: #fafafa;">&nbsp;</td>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateStr = date.toISOString().split("T")[0];
    const isToday = dateStr === todayStr;
    const isSelected =
      selected instanceof Set ? selected.has(dateStr) : dateStr === selected;

    const highlight = dayHighlights && dayHighlights.get(dateStr);
    const highlightColor = highlight && highlight.color;
    const highlightTextColor = highlight && highlight.textColor;

    let cellStyle =
      "cursor: pointer; text-align: center; padding: 4px; height: 36px; vertical-align: middle; position: relative; ";
    if (isSelected) {
      cellStyle += "background: #007bff; color: white; font-weight: bold;";
    } else {
      if (isToday)
        cellStyle += `background: ${highlightColor || "#e7f3ff"}; font-weight: bold; border: 2px solid #007bff;`;
      else if (highlightColor) cellStyle += `background: ${highlightColor};`;
      if (highlightTextColor) cellStyle += `color: ${highlightTextColor};`;
    }

    // Ctrl/Cmd-click multi-select for bulk-applying a context menu action (e.g.
    // highlight color) to several days at once - independent of isSelected,
    // which drives the single "day shown below" navigation state.
    if (multiSelected && multiSelected.size > 1 && multiSelected.has(dateStr)) {
      cellStyle += "outline: 2px solid #6f42c1; outline-offset: -2px;";
    }

    const dayLabel = formatMinutesTotal(dayTotals && dayTotals.get(dateStr));
    const timeBadge = dayLabel
      ? `<span style="position: absolute; top: 1px; right: 2px; font-size: 0.6rem; opacity: 0.75; line-height: 1;">${dayLabel}</span>`
      : "";

    html += `<td style="${cellStyle}" data-date="${dateStr}" title="${dateStr}">${day}${timeBadge}</td>`;

    if ((day + startingDayOfWeek) % 7 === 0 && day < daysInMonth) {
      html += "</tr><tr>";
    }
  }

  const totalCells = startingDayOfWeek + daysInMonth;
  const remainingCells = 7 - (totalCells % 7);
  if (remainingCells < 7) {
    for (let i = 0; i < remainingCells; i++) {
      html += '<td style="background: #fafafa;">&nbsp;</td>';
    }
  }

  html += "</tr></table>";
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
  const selectedDate =
    document.getElementById("selectedDate")?.value ||
    new Date().toISOString().split("T")[0];

  if (calendarViewYear === undefined) {
    const initial = new Date(selectedDate + "T00:00:00");
    calendarViewYear = initial.getFullYear();
    calendarViewMonth = initial.getMonth();
  }

  document.getElementById("calendar").innerHTML = buildCalendarHtml(
    calendarViewYear,
    calendarViewMonth,
    selectedDate,
    calendarDayTotals,
    calendarDayHighlights,
    calendarMultiSelectedDates,
  );
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
  const pad = (n) => String(n).padStart(2, "0");
  const startDate = `${year}-${pad(month + 1)}-01`;
  const endDate = `${year}-${pad(month + 1)}-${pad(new Date(year, month + 1, 0).getDate())}`;

  try {
    const response = await fetch(
      `/api/work/range?startDate=${startDate}&endDate=${endDate}`,
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (!result.success) return;

    // The view may have moved on to a different month by the time this resolves.
    if (year !== calendarViewYear || month !== calendarViewMonth) return;

    calendarDayTotals = new Map();
    for (const item of result.data) {
      const dateStr = item.date.slice(0, 10);
      calendarDayTotals.set(
        dateStr,
        (calendarDayTotals.get(dateStr) || 0) + (item.time_box_minutes || 0),
      );
    }

    const selectedDate =
      document.getElementById("selectedDate")?.value ||
      new Date().toISOString().split("T")[0];
    document.getElementById("calendar").innerHTML = buildCalendarHtml(
      calendarViewYear,
      calendarViewMonth,
      selectedDate,
      calendarDayTotals,
      calendarDayHighlights,
      calendarMultiSelectedDates,
    );
  } catch (error) {
    console.error("Error loading calendar day totals:", error);
  }
}

async function loadCalendarDayHighlights(year, month) {
  const pad = (n) => String(n).padStart(2, "0");
  const startDate = `${year}-${pad(month + 1)}-01`;
  const endDate = `${year}-${pad(month + 1)}-${pad(new Date(year, month + 1, 0).getDate())}`;

  try {
    const response = await fetch(
      `/api/day-highlights/range?startDate=${startDate}&endDate=${endDate}`,
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (!result.success) return;

    if (year !== calendarViewYear || month !== calendarViewMonth) return;

    calendarDayHighlights = new Map(
      result.data.map((h) => [
        h.date.slice(0, 10),
        { color: h.color, textColor: h.text_color },
      ]),
    );

    const selectedDate =
      document.getElementById("selectedDate")?.value ||
      new Date().toISOString().split("T")[0];
    document.getElementById("calendar").innerHTML = buildCalendarHtml(
      calendarViewYear,
      calendarViewMonth,
      selectedDate,
      calendarDayTotals,
      calendarDayHighlights,
      calendarMultiSelectedDates,
    );
  } catch (error) {
    console.error("Error loading calendar day highlights:", error);
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
  let dateInput = document.getElementById("selectedDate");
  if (!dateInput) {
    dateInput = document.createElement("input");
    dateInput.type = "hidden";
    dateInput.id = "selectedDate";
    document.body.appendChild(dateInput);
  }
  dateInput.value = dateStr;
  expandedWorkItems.clear();
  loadWorkItems();
  renderCalendar();
  updateDateDisplay();
}

function updateDateDisplay() {
  const dateInput = document.getElementById("selectedDate");
  const dateStr = dateInput?.value || new Date().toISOString().split("T")[0];
  const date = new Date(dateStr + "T00:00:00");
  const formatted = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  document.getElementById("selectedDateDisplay").textContent = formatted;
}

function updateDailyTimeTotal() {
  const totalMinutes = currentWorkItems.reduce(
    (sum, item) => sum + (item.time_box_minutes || 0),
    0,
  );
  const label = formatMinutesTotal(totalMinutes);
  document.getElementById("dailyTimeTotal").textContent = label
    ? `(${label} tracked)`
    : "";
}

function renderWorkItemsList(items) {
  const container = document.getElementById("workItemsList");

  if (!items || items.length === 0) {
    container.innerHTML = '<p class="text-center text-muted">No work items</p>';
    return;
  }

  let html = '';

  items.forEach((item) => {
    const isExpanded = expandedWorkItems.has(String(item.id));
    const hasChildren = (item.priorities?.length || 0) + (item.goals?.length || 0) + (item.areas?.length || 0) + (item.todos?.length || 0) + (item.tasks?.length || 0) + (item.tickets?.length || 0) + (item.ideas?.length || 0) > 0;

    // Render work item row
    html += `
      <div class="work-item ${isExpanded ? "expanded" : ""}" data-work-id="${item.id}" data-has-children="${hasChildren}">
        <div class="work-item-header" draggable="true" data-status="${item.status}" title="${hasChildren ? "Click to expand/collapse, double-click to edit; drag to reorder" : "Click to change status, double-click to edit; drag to reorder"}">
          <span class="work-item-title-cell">
            <i class="bi bi-chevron-right work-item-toggle" data-action="toggle-expand" title="Expand/collapse"></i>
            <i class="bi ${APP_ICONS.workItem} text-muted" title="Work Item"></i>
            <span class="work-item-title">${app.escapeHtml(item.title)}</span>
          </span>
          <span class="work-item-emoji" data-action="pick-emoji" data-id="${item.id}" title="Oh! Click to pick an emoji">${app.escapeHtml(item.emoji || "")}</span>
          <span class="work-item-start-time" title="Meeting start time">${item.start_time ? item.start_time : "-"}</span>
          <span class="badge bg-${item.status === "Complete" ? "success" : item.status === "In Progress" ? "warning" : "secondary"} work-item-status-badge" data-action="cycle-status" data-id="${item.id}" title="Click to change status">${item.status}</span>
          <span class="badge bg-light text-dark border work-item-timebox-badge" data-action="cycle-timebox" data-id="${item.id}" data-minutes="${item.time_box_minutes || ""}" title="Click to change time box">${item.time_box_minutes ? item.time_box_minutes + "m" : "No time box"}</span>
          <span class="work-item-claude-toggle" data-action="toggle-claude" data-id="${item.id}" title="Toggle: worked with Claude" style="text-align: center; cursor: pointer; font-size: 18px;"><i class="bi bi-sun-fill" style="color: ${item.worked_with_claude ? "#FFA500" : "#ddd"}; opacity: ${item.worked_with_claude ? "1" : "0.5"};"></i></span>
          <span class="work-item-notes-cell" data-action="edit-notes" data-id="${item.id}" style="cursor: pointer; text-align: center;" title="${item.notes ? 'Has notes - double-click to edit' : 'No notes - double-click to add'}"><i class="bi bi-sticky-fill" style="color: ${item.notes ? '#ffd43b' : '#dee2e6'};"></i></span>
          <span class="work-item-actions">
            <button class="btn btn-sm btn-danger" data-action="delete" data-id="${item.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
          </span>
        </div>
    `;

    // Render child items if expanded
    if (isExpanded) {
      if (item.priorities?.length > 0) {
        item.priorities.forEach((p) => {
          html += renderChildItem('priority', p.id, p.path || p.title, APP_ICONS.project, item.id);
        });
      }
      if (item.goals?.length > 0) {
        item.goals.forEach((g) => {
          html += renderChildItem('goal', g.id, g.name, APP_ICONS.goal, item.id);
        });
      }
      if (item.areas?.length > 0) {
        item.areas.forEach((a) => {
          html += renderChildItem('area', a.id, a.path || a.name, APP_ICONS.area, item.id);
        });
      }
      if (item.todos?.length > 0) {
        item.todos.forEach((t) => {
          html += renderChildItem('todo', t.id, t.title, APP_ICONS.todo, item.id);
        });
      }
      if (item.tasks?.length > 0) {
        item.tasks.forEach((t) => {
          html += renderChildItem('task', t.id, t.title, APP_ICONS.task, item.id);
        });
      }
      if (item.tickets?.length > 0) {
        item.tickets.forEach((t) => {
          html += renderChildItem('ticket', t.id, t.title, APP_ICONS.ticket, item.id);
        });
      }
      if (item.ideas?.length > 0) {
        item.ideas.forEach((i) => {
          html += renderChildItem('idea', i.id, i.title, APP_ICONS.idea, item.id);
        });
      }
    }

    html += '</div>'; // Close work-item
  });

  container.innerHTML = html;
}

function renderChildItem(type, id, label, icon, parentWorkItemId) {
  const iconClass = icon || (APP_ICONS[type] || 'bi-circle');
  return `
    <div class="work-item child-item-row" data-work-id="${id}" data-item-type="${type}" data-parent-work-id="${parentWorkItemId}" style="margin-left: 30px;" data-child-id="${id}">
      <div class="work-item-header" style="cursor: pointer;" title="Click to edit, right-click for menu">
        <span class="work-item-title-cell">
          <i class="bi ${iconClass} text-muted"></i>
          <span class="work-item-title">${app.escapeHtml(label)}</span>
        </span>
        <span style="flex: 1;"></span>
        <span class="work-item-actions">
          <button class="btn btn-sm btn-link text-danger p-0" data-action="unlink" data-type="${type}" data-child-id="${id}" title="Remove" aria-label="Remove">
            <i class="bi bi-x-lg"></i>
          </button>
        </span>
      </div>
    </div>
  `;
}

async function loadWorkItems() {
  const dateInput = document.getElementById("selectedDate");
  if (!dateInput || !dateInput.value) {
    const today = new Date().toISOString().split("T")[0];
    selectDate(today);
    return;
  }

  const date = dateInput.value;
  const container = document.getElementById("workItemsList");
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
      container.innerHTML =
        '<p class="text-center text-danger">Error loading work items</p>';
    }
  } catch (error) {
    console.error("Error:", error);
    container.innerHTML =
      '<p class="text-center text-danger">Error loading work items</p>';
  }
}

async function reorderWorkItemsOnDrop(draggedId, targetId, position) {
  const ids = currentWorkItems.map((i) => String(i.id));
  const fromIndex = ids.indexOf(String(draggedId));
  if (fromIndex === -1) return;
  ids.splice(fromIndex, 1);

  let toIndex = targetId ? ids.indexOf(String(targetId)) : -1;
  if (toIndex === -1) {
    toIndex = ids.length;
  } else if (position === "after") {
    toIndex += 1;
  }
  ids.splice(toIndex, 0, String(draggedId));

  const dateInput = document.getElementById("selectedDate");
  const date = dateInput?.value;
  if (!date) return;

  try {
    const response = await fetch("/api/work/reorder", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": window.APP_CONFIG?.csrfToken,
      },
      body: JSON.stringify({ date, orderedIds: ids }),
    });
    const result = await response.json();
    if (result.success) {
      loadWorkItems();
    } else {
      app.notify("Error: " + result.message, "danger");
    }
  } catch (error) {
    console.error("Error reordering work items:", error);
    app.notify("Error reordering work items", "danger");
  }
}

function clearWorkItemDropIndicators(container) {
  container
    .querySelectorAll(
      ".drag-over, .drop-indicator-before, .drop-indicator-after",
    )
    .forEach((el) => {
      el.classList.remove(
        "drag-over",
        "drop-indicator-before",
        "drop-indicator-after",
      );
    });
}

// Builds an id -> "Parent - Child" display name map for a parent_id-linked list,
// so a sub-item dragged onto an empty daily defaults to a title that includes its
// parent, not just its own leaf name.
function buildDashPathMap(records, labelField) {
  const byId = new Map(records.map((r) => [r.id, r]));
  const cache = new Map();

  function resolve(id) {
    if (cache.has(id)) return cache.get(id);
    const record = byId.get(id);
    if (!record) return "";
    const path =
      record.parent_id && byId.has(record.parent_id)
        ? `${resolve(record.parent_id)} - ${record[labelField]}`
        : record[labelField];
    cache.set(id, path);
    return path;
  }

  const map = new Map();
  records.forEach((r) => map.set(r.id, resolve(r.id)));
  return map;
}

async function loadPrioritiesAndGoals() {
  // Load priorities
  try {
    const prioResponse = await fetch("/api/priorities");
    if (!prioResponse.ok) throw new Error(`HTTP ${prioResponse.status}`);
    const prioResult = await prioResponse.json();
    const prioritiesDiv = document.getElementById("prioritiesListRight");

    if (prioResult.success && prioResult.data.length > 0) {
      const prioPaths = buildDashPathMap(prioResult.data, "title");
      prioritiesDiv.innerHTML = app
        .flattenTree(prioResult.data)
        .map(
          (p) => `
        <div class="priority-item" draggable="true" data-type="priority" data-id="${p.id}" data-name="${app.escapeHtml(prioPaths.get(p.id))}" style="margin-left: ${p.depth * 14}px;">
          <span><i class="bi ${APP_ICONS.project}"></i> ${app.escapeHtml(p.title)}</span>
          <small class="text-muted">→</small>
        </div>
      `,
        )
        .join("");
      setupDragListeners();
    } else {
      prioritiesDiv.innerHTML =
        '<small class="text-muted">No priorities</small>';
    }
  } catch (error) {
    console.error("Error loading priorities:", error);
  }

  // Load goals
  try {
    const year = new Date().getFullYear();
    const goalResponse = await fetch(`/api/goals/year/${year}`);
    if (!goalResponse.ok) throw new Error(`HTTP ${goalResponse.status}`);
    const goalResult = await goalResponse.json();
    const goalsDiv = document.getElementById("goalsListRight");

    if (goalResult.success && goalResult.data.length > 0) {
      goalsDiv.innerHTML = goalResult.data
        .map(
          (g) => `
        <div class="goal-item" draggable="true" data-type="goal" data-id="${g.id}" data-name="${app.escapeHtml(g.name)}">
          <span><i class="bi ${APP_ICONS.goal}"></i> ${app.escapeHtml(g.name)}</span>
          <small class="text-muted">→</small>
        </div>
      `,
        )
        .join("");
      setupDragListeners();
    } else {
      goalsDiv.innerHTML = '<small class="text-muted">No goals</small>';
    }
  } catch (error) {
    console.error("Error loading goals:", error);
  }

  // Load areas
  try {
    const areaResponse = await fetch("/api/areas");
    if (!areaResponse.ok) throw new Error(`HTTP ${areaResponse.status}`);
    const areaResult = await areaResponse.json();
    const areasDiv = document.getElementById("areasListRight");

    if (areaResult.success && areaResult.data.length > 0) {
      const areaPaths = buildDashPathMap(areaResult.data, "name");
      areasDiv.innerHTML = app
        .flattenTree(areaResult.data)
        .map(
          (a) => `
        <div class="area-item" draggable="true" data-type="area" data-id="${a.id}" data-name="${app.escapeHtml(areaPaths.get(a.id))}" style="margin-left: ${a.depth * 14}px;">
          <span><i class="bi ${APP_ICONS.area}"></i> ${app.escapeHtml(a.name)}</span>
          <small class="text-muted">→</small>
        </div>
      `,
        )
        .join("");
      setupDragListeners();
    } else {
      areasDiv.innerHTML = '<small class="text-muted">No categories</small>';
    }
  } catch (error) {
    console.error("Error loading areas:", error);
  }

  // Load templates
  try {
    const templateResponse = await fetch("/api/work-item-templates");
    if (!templateResponse.ok)
      throw new Error(`HTTP ${templateResponse.status}`);
    const templateResult = await templateResponse.json();
    const templatesDiv = document.getElementById("templatesListRight");

    if (templateResult.success && templateResult.data.length > 0) {
      templatesDiv.innerHTML = templateResult.data
        .map(
          (t) => `
        <div class="template-item" draggable="true" data-type="template" data-id="${t.id}">
          <span><i class="bi ${APP_ICONS.template}"></i> ${app.escapeHtml(t.title)}</span>
          <small class="text-muted">→</small>
        </div>
      `,
        )
        .join("");
      setupDragListeners();
    } else {
      templatesDiv.innerHTML = '<small class="text-muted">No templates</small>';
    }
  } catch (error) {
    console.error("Error loading templates:", error);
  }
}

// Shared across every tab that has draggable priority/goal/area/template chips
// (Dailies, Templates). Only binds elements that aren't already bound, since all
// tab panes live in the DOM at once and each tab's load function calls this again.
function setupDragListeners() {
  const draggables = document.querySelectorAll(
    '[draggable="true"]:not([data-drag-bound])',
  );
  draggables.forEach((item) => {
    item.dataset.dragBound = "true";

    item.addEventListener("dragstart", (e) => {
      e.dataTransfer.effectAllowed = "copy";
      e.dataTransfer.setData("type", item.dataset.type);
      e.dataTransfer.setData("id", item.dataset.id);
      e.dataTransfer.setData(
        "name",
        item.dataset.name || item.textContent.trim(),
      );
      currentDragType = item.dataset.type;
      item.classList.add("dragging-item");
    });

    item.addEventListener("dragend", () => {
      item.classList.remove("dragging-item");
      currentDragType = null;
    });
  });
}

// Load and display items of each type in the modal
async function loadItemsForModal() {
  const itemTypes = [
    { id: 'project', endpoint: '/api/priorities', listId: 'projectsList', label: 'projects' },
    { id: 'task', endpoint: '/api/tasks', listId: 'dailiesTasksList', label: 'tasks' },
    { id: 'ticket', endpoint: '/api/tickets', listId: 'dailiesTicketsList', label: 'tickets' },
    { id: 'idea', endpoint: '/api/ideas', listId: 'ideaList', label: 'ideas' },
    { id: 'template', endpoint: '/api/work-item-templates', listId: 'dailiesTemplatesList', label: 'templates' },
    { id: 'goal', endpoint: `/api/goals/year/${window.APP_CONFIG?.currentYear || new Date().getFullYear()}`, listId: 'goalsList', label: 'goals' },
    { id: 'todo', endpoint: '/api/to-dos', listId: 'todosList', label: 'to dos' }
  ];

  for (const type of itemTypes) {
    await loadItemsByType(type.endpoint, type.listId, type.id, type.label);
  }
}

async function loadItemsByType(endpoint, listId, typeId, typeLabel) {
  const container = document.getElementById(listId);
  if (!container) return;

  try {
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();

    if (result.success && result.data && result.data.length > 0) {
      const items = result.data;
      const html = items.map(item => `
        <button type="button" class="list-group-item list-group-item-action text-start" data-action="add-item-to-dailies" data-item-type="${typeId}" data-item-id="${item.id}">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <div class="fw-500">${app.escapeHtml(item.title || item.name)}</div>
              ${item.notes ? `<small class="text-muted d-block">${app.escapeHtml(item.notes)}</small>` : ''}
            </div>
          </div>
        </button>
      `).join('');
      container.innerHTML = html;
    } else {
      container.innerHTML = `<p class="text-muted small">No ${typeLabel}</p>`;
    }
  } catch (error) {
    console.error(`Error loading ${typeLabel}:`, error);
    container.innerHTML = `<p class="text-muted small text-danger">Error loading ${typeLabel}</p>`;
  }
}

async function addItemToDailies(itemType, itemId) {
  const dateInput = document.getElementById("selectedDate");
  const date = dateInput?.value || new Date().toISOString().split("T")[0];

  try {
    // Fetch the item to get its title and details
    let endpoint = '';
    let endpoint_map = {
      'project': '/api/priorities',
      'task': '/api/tasks',
      'ticket': '/api/tickets',
      'idea': '/api/ideas',
      'template': '/api/work-item-templates',
      'goal': '/api/goals',
      'todo': '/api/to-dos'
    };

    endpoint = endpoint_map[itemType];
    if (!endpoint) {
      app.notify('Unknown item type', 'danger');
      return;
    }

    const itemResponse = await fetch(`${endpoint}/${itemId}`);
    if (!itemResponse.ok) throw new Error(`HTTP ${itemResponse.status}`);
    const itemResult = itemResponse.json();

    const item = (await itemResult).data;
    if (!item) {
      app.notify('Item not found', 'danger');
      return;
    }

    // Create a work item for this item on the selected date
    const data = {
      date,
      title: item.title || item.name,
      description: item.description || item.notes || '',
      emoji: item.emoji || '📋'
    };

    const response = await fetch('/api/work', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (result.success) {
      app.notify(`Added "${item.title || item.name}" to dailies`, 'success');
      loadWorkItems();
      loadCalendarDayTotals(calendarViewYear, calendarViewMonth);
      // Switch back to calendar tab to show the newly added item
      const calendarTab = document.getElementById("calendar-tab");
      if (calendarTab) calendarTab.click();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error adding item to dailies:', error);
    app.notify('Error adding item to dailies', 'danger');
  }
}

function openAddItemPicker() {
  // Click the "Work Picker" tab to show it
  const pickerTab = document.getElementById("picker-tab");
  if (pickerTab) {
    pickerTab.click();
    loadItemsForModal();
  }
}

function openNewWorkForm() {
  openAddItemPicker();
}

async function saveWorkItem() {
  const workId = document.getElementById("workId").value;
  const dateInput = document.getElementById("selectedDate");

  // status/time_box_minutes are intentionally omitted here - they're no longer
  // editable from this form (removed in favor of the list's cycle badges), and
  // workItemService only touches columns present in the payload, so omitting
  // them leaves an existing item's values untouched on edit. New items fall
  // back to the service's own defaults (Not Started, no time box).
  const data = {
    date: dateInput?.value || new Date().toISOString().split("T")[0],
    title: document.getElementById("workTitle").value,
    description: document.getElementById("workDescription").value,
    notes: document.getElementById("workNotes").value,
    emoji: document.getElementById("workEmoji").value,
  };

  try {
    const url = workId ? `/api/work/${workId}` : "/api/work";
    const method = workId ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": window.APP_CONFIG?.csrfToken,
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    if (result.success) {
      app.notify("Work item saved!", "success");
      loadWorkItems();
      loadCalendarDayTotals(calendarViewYear, calendarViewMonth);
      // Close the modal using the dismiss button
      const dismissBtn = document.querySelector('#workModal .btn-close');
      if (dismissBtn) dismissBtn.click();
    } else {
      app.notify("Error: " + result.message, "danger");
    }
  } catch (error) {
    console.error("Error:", error);
    app.notify("Error saving work item", "danger");
  }
}

let workItemEditorRequestId = 0;

async function editWorkItem(workId) {
  try {
    // Check if clicking on same row that's already open
    if (currentWorkItemId === workId) {
      if (workItemEditorHasChanges) {
        return; // Don't close if there are unsaved changes
      }
      closeWorkItemEditor();
      return;
    }

    // Increment request ID to track which request is current
    const requestId = ++workItemEditorRequestId;

    const response = await fetch(`/api/work/${workId}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();

    // Ignore if a newer request has been made
    if (requestId !== workItemEditorRequestId) {
      return;
    }

    const item = result.data;

    const setFieldValue = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    };

    const setFieldText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    currentWorkItemId = workId;
    resetWorkItemEditorTracking();

    // Make sure form is visible
    const workItemEditorForm = document.getElementById('workItemEditorForm');
    if (workItemEditorForm) workItemEditorForm.style.display = 'block';

    setFieldValue("workItemEditorId", item.id);
    setFieldValue("workItemEditorTitle", item.title);
    setFieldText("workItemEditorDisplayTitle", item.title);
    setFieldValue("workItemEditorDescription", item.description);
    setFieldValue("workItemEditorEmoji", item.emoji || "");
    setFieldValue("workItemEditorStatus", item.status || "");
    setFieldValue("workItemEditorTimeBox", item.time_box_minutes ? (item.time_box_minutes / 60).toFixed(1) : "");
    updateEmojiFieldButton("workItemEditorEmojiBtn", item.emoji || "");
    trackWorkItemFormChanges();

    // Show split-pane editor
    if (dailiesSplitPane) {
      dailiesSplitPane.showRightPane();
    }
  } catch (error) {
    console.error("Error loading work item:", error);
    app.notify("Error loading work item", "danger");
  }
}

function closeWorkItemEditor() {
  resetWorkItemEditorTracking();
  currentWorkItemId = null;
  if (dailiesSplitPane) {
    dailiesSplitPane.hideRightPane();
  }
}

async function deleteWorkItem(workId) {
  if (!(await app.confirm("Delete this work item?"))) return;

  try {
    const response = await fetch(`/api/work/${workId}`, {
      method: "DELETE",
      headers: { "X-CSRF-Token": window.APP_CONFIG?.csrfToken },
    });

    const result = await response.json();
    if (result.success) {
      app.notify("Work item deleted", "success");
      loadWorkItems();
      loadCalendarDayTotals(calendarViewYear, calendarViewMonth);
    } else {
      app.notify("Error deleting work item", "danger");
    }
  } catch (error) {
    console.error("Error:", error);
    app.notify("Error deleting work item", "danger");
  }
}

let contextMenuWorkItemId = null;

function showWorkItemContextMenu(x, y, workItemId) {
  contextMenuWorkItemId = workItemId;
  const menu = document.getElementById("workItemContextMenu");
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  collapseContextMenuSubmenus();
  menu.classList.remove("d-none");
}

function hideWorkItemContextMenu() {
  contextMenuWorkItemId = null;
  document.getElementById("workItemContextMenu").classList.add("d-none");
}

// Dropping a work item onto a calendar day pops up a small menu asking whether to
// move it there or leave the original in place and copy it.
let calendarDropPending = null;

function showCalendarDropMenu(x, y, workItemId, date) {
  calendarDropPending = { workItemId, date };
  const menu = document.getElementById("calendarDropMenu");
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.classList.remove("d-none");
}

function hideCalendarDropMenu() {
  calendarDropPending = null;
  document.getElementById("calendarDropMenu").classList.add("d-none");
}

async function performCalendarDropAction(action) {
  if (!calendarDropPending) return;
  const { workItemId, date } = calendarDropPending;
  hideCalendarDropMenu();

  try {
    const endpoint =
      action === "copy"
        ? `/api/work/${workItemId}/clone`
        : `/api/work/${workItemId}/move`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": window.APP_CONFIG?.csrfToken,
      },
      body: JSON.stringify({ date }),
    });

    const result = await response.json();
    if (result.success) {
      app.notify(
        action === "copy" ? "Work item copied!" : "Work item moved!",
        "success",
      );
      loadWorkItems();
    } else {
      app.notify("Error: " + result.message, "danger");
    }
  } catch (error) {
    console.error("Error moving/copying work item:", error);
    app.notify("Error saving", "danger");
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
  const menu = document.getElementById("calendarDayContextMenu");
  const scopeLabel = document.getElementById("calendarDayContextMenuScope");
  if (dates.length > 1) {
    scopeLabel.textContent = `Applies to ${dates.length} selected days`;
    scopeLabel.classList.remove("d-none");
  } else {
    scopeLabel.classList.add("d-none");
  }
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.classList.remove("d-none");
}

function hideCalendarDayContextMenu() {
  calendarContextMenuDates = [];
  document.getElementById("calendarDayContextMenu").classList.add("d-none");
}

async function saveDayHighlightColor(target, color) {
  if (calendarContextMenuDates.length === 0) return;
  const dates = calendarContextMenuDates;
  hideCalendarDayContextMenu();

  try {
    for (const date of dates) {
      const endpoint =
        target === "text"
          ? `/api/day-highlights/${date}/text-color`
          : `/api/day-highlights/${date}/background`;
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": window.APP_CONFIG?.csrfToken,
        },
        body: JSON.stringify({ color }),
      });

      const result = await response.json();
      if (!result.success) {
        app.notify("Error: " + result.message, "danger");
        return;
      }
      const existing = calendarDayHighlights.get(date) || {};
      calendarDayHighlights.set(
        date,
        target === "text"
          ? { ...existing, textColor: color }
          : { ...existing, color },
      );
    }
    calendarMultiSelectedDates.clear();
    renderCalendar();
  } catch (error) {
    console.error("Error setting day highlight color:", error);
    app.notify("Error setting day highlight color", "danger");
  }
}

async function clearDayHighlight() {
  if (calendarContextMenuDates.length === 0) return;
  const dates = calendarContextMenuDates;
  hideCalendarDayContextMenu();

  try {
    for (const date of dates) {
      const response = await fetch(`/api/day-highlights/${date}`, {
        method: "DELETE",
        headers: { "X-CSRF-Token": window.APP_CONFIG?.csrfToken },
      });

      const result = await response.json();
      if (!result.success) {
        app.notify("Error: " + result.message, "danger");
        return;
      }
      calendarDayHighlights.delete(date);
    }
    calendarMultiSelectedDates.clear();
    renderCalendar();
  } catch (error) {
    console.error("Error clearing day highlight:", error);
    app.notify("Error clearing day highlight", "danger");
  }
}

function initCalendarDayContextMenu() {
  const menu = document.getElementById("calendarDayContextMenu");
  if (!menu) return;

  menu.addEventListener("click", (e) => {
    const swatch = e.target.closest("[data-color]");
    if (swatch) {
      saveDayHighlightColor(swatch.dataset.target, swatch.dataset.color);
      return;
    }

    const clearBtn = e.target.closest(
      '[data-menu-action="clear-day-highlight"]',
    );
    if (clearBtn) {
      clearDayHighlight();
    }
  });

  document.addEventListener("click", (e) => {
    if (!menu.classList.contains("d-none") && !menu.contains(e.target)) {
      hideCalendarDayContextMenu();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideCalendarDayContextMenu();
  });
}

function initCalendarDropMenu() {
  const menu = document.getElementById("calendarDropMenu");
  if (!menu) return;

  menu.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-drop-action]");
    if (!btn) {
      hideCalendarDropMenu();
      return;
    }
    performCalendarDropAction(btn.dataset.dropAction);
  });

  document.addEventListener("click", (e) => {
    if (!menu.classList.contains("d-none") && !menu.contains(e.target)) {
      hideCalendarDropMenu();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideCalendarDropMenu();
  });
}

// Shared by every "Oh!" emoji picker in the app: row cells (Work Items, Templates)
// PATCH the server immediately; form fields (inside the Work Item/Template modals)
// just fill in a hidden input for whenever the form itself gets saved.
let emojiPickerEntityId = null;
let emojiPickerEntityType = null;
let emojiPickerFieldTarget = null;

const EMOJI_ENTITY_CONFIG = {
  "work-item": {
    endpoint: (id) => `/api/work/${id}/emoji`,
    reload: () => loadWorkItems(),
  },
  template: {
    endpoint: (id) => `/api/work-item-templates/${id}/emoji`,
    reload: () => {
      if (typeof loadTemplates === "function") loadTemplates();
    },
  },
};

function showEmojiPicker(x, y, entityId, entityType = "work-item") {
  emojiPickerEntityId = entityId;
  emojiPickerEntityType = entityType;
  emojiPickerFieldTarget = null;
  const popover = document.getElementById("emojiPickerPopover");
  popover.style.left = `${x}px`;
  popover.style.top = `${y}px`;
  popover.classList.remove("d-none");
}

// Opens the same picker for a plain form field: `inputId` is the hidden input
// that holds the value to submit, `buttonId` is the visible button showing it.
function showEmojiPickerForField(x, y, inputId, buttonId) {
  emojiPickerEntityId = null;
  emojiPickerEntityType = "field";
  emojiPickerFieldTarget = { inputId, buttonId };
  const popover = document.getElementById("emojiPickerPopover");
  popover.style.left = `${x}px`;
  popover.style.top = `${y}px`;
  popover.classList.remove("d-none");
}

function updateEmojiFieldButton(buttonId, emoji) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.textContent = emoji || "Pick an emoji";
  btn.classList.toggle("text-muted", !emoji);
}

function hideEmojiPicker() {
  emojiPickerEntityId = null;
  emojiPickerEntityType = null;
  emojiPickerFieldTarget = null;
  document.getElementById("emojiPickerPopover").classList.add("d-none");
}

async function selectEmoji(emoji) {
  if (emojiPickerEntityType === "field") {
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
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": window.APP_CONFIG?.csrfToken,
      },
      body: JSON.stringify({ emoji }),
    });

    const result = await response.json();
    if (result.success) {
      config.reload();
    } else {
      app.notify("Error: " + result.message, "danger");
    }
  } catch (error) {
    console.error("Error setting emoji:", error);
    app.notify("Error setting emoji", "danger");
  }
}

function initEmojiPicker() {
  const popover = document.getElementById("emojiPickerPopover");
  if (!popover) return;

  // Also opened from Templates (a different tab pane). Left inside #tab-dailies,
  // it's a descendant of a display:none ancestor whenever Dailies isn't the
  // active tab, so it would silently fail to render there - move it to the body.
  document.body.appendChild(popover);

  popover.addEventListener("click", (e) => {
    const tabBtn = e.target.closest("[data-emoji-tab]");
    if (tabBtn) {
      const category = tabBtn.dataset.emojiTab;
      popover
        .querySelectorAll("#emojiPickerTabs [data-emoji-tab]")
        .forEach((b) => b.classList.remove("active"));
      tabBtn.classList.add("active");
      popover.querySelectorAll(".emoji-picker-grid").forEach((panel) => {
        panel.classList.toggle("d-none", panel.dataset.emojiPanel !== category);
      });
      return;
    }

    const btn = e.target.closest(".emoji-picker-btn");
    if (!btn) return;
    selectEmoji(btn.dataset.emoji);
  });

  document.addEventListener("click", (e) => {
    const fieldBtn = e.target.closest('[data-action="pick-emoji-field"]');
    if (fieldBtn) {
      const rect = fieldBtn.getBoundingClientRect();
      showEmojiPickerForField(
        rect.left,
        rect.bottom + 4,
        fieldBtn.dataset.input,
        fieldBtn.id,
      );
      return;
    }

    if (
      !popover.classList.contains("d-none") &&
      !popover.contains(e.target) &&
      !e.target.closest('[data-action="pick-emoji"]')
    ) {
      hideEmojiPicker();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideEmojiPicker();
  });
}

function openWorkItemNotesModal(workItemId) {
  const item = currentWorkItems.find(
    (i) => String(i.id) === String(workItemId),
  );
  if (!item) return;

  document.getElementById("workNotesModalId").value = item.id;
  document.getElementById("workNotesModalText").value = item.notes || "";

  const modal = new bootstrap.Modal(document.getElementById("workNotesModal"));
  modal.show();
}

async function saveWorkItemNotes() {
  const id = document.getElementById("workNotesModalId").value;
  const notes = document.getElementById("workNotesModalText").value;

  try {
    const response = await fetch(`/api/work/${id}/notes`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": window.APP_CONFIG?.csrfToken,
      },
      body: JSON.stringify({ notes }),
    });

    const result = await response.json();
    if (result.success) {
      app.notify("Notes saved!", "success");
      bootstrap.Modal.getInstance(
        document.getElementById("workNotesModal"),
      ).hide();
      loadWorkItems();
    } else {
      app.notify("Error: " + result.message, "danger");
    }
  } catch (error) {
    console.error("Error saving notes:", error);
    app.notify("Error saving notes", "danger");
  }
}

function createToDoFromWorkItem(workItemId) {
  const item = currentWorkItems.find(
    (i) => String(i.id) === String(workItemId),
  );
  if (!item) return;

  if (typeof openToDoModalPrefilled !== "function") {
    app.notify("To Dos are not available", "danger");
    return;
  }

  openToDoModalPrefilled(item.title, item.notes || "");
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
  const mode = document.getElementById("moveCloneMode").value;
  const selected =
    mode === "clone" ? moveCloneSelectedDates : moveCloneSelectedDate;
  document.getElementById("moveCloneCalendar").innerHTML = buildCalendarHtml(
    moveCloneCalYear,
    moveCloneCalMonth,
    selected,
  );
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
  const mode = document.getElementById("moveCloneMode").value;
  if (mode === "clone") {
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
  document.getElementById("moveCloneWorkId").value = workItemId;
  document.getElementById("moveCloneMode").value = mode;
  document.getElementById("moveCloneModalTitle").textContent =
    mode === "clone" ? "Clone Work Item To" : "Move Work Item To";
  document.getElementById("confirmMoveCloneBtn").textContent =
    mode === "clone" ? "Clone" : "Move";
  document.getElementById("moveCloneHint").textContent =
    mode === "clone" ? "Select one or more dates." : "Select a date.";

  const initialDate =
    document.getElementById("selectedDate")?.value ||
    new Date().toISOString().split("T")[0];
  const initial = new Date(initialDate + "T00:00:00");
  moveCloneCalYear = initial.getFullYear();
  moveCloneCalMonth = initial.getMonth();

  if (mode === "clone") {
    moveCloneSelectedDates = new Set();
  } else {
    moveCloneSelectedDate = initialDate;
  }

  renderMoveCloneCalendar();

  const modal = new bootstrap.Modal(document.getElementById("moveCloneModal"));
  modal.show();
}

async function postWorkItemDateAction(workId, action, date) {
  const response = await fetch(`/api/work/${workId}/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": window.APP_CONFIG?.csrfToken,
    },
    body: JSON.stringify({ date }),
  });
  return response.json();
}

async function confirmMoveClone() {
  const workId = document.getElementById("moveCloneWorkId").value;
  const mode = document.getElementById("moveCloneMode").value;

  if (mode === "clone") {
    const dates = Array.from(moveCloneSelectedDates || []);
    if (dates.length === 0) {
      app.notify("Pick at least one date", "warning");
      return;
    }

    try {
      for (const date of dates) {
        const result = await postWorkItemDateAction(workId, "clone", date);
        if (!result.success) {
          app.notify("Error: " + result.message, "danger");
          return;
        }
      }
      app.notify(
        `Work item cloned to ${dates.length} date${dates.length > 1 ? "s" : ""}!`,
        "success",
      );
      bootstrap.Modal.getInstance(
        document.getElementById("moveCloneModal"),
      ).hide();
      loadWorkItems();
    } catch (error) {
      console.error("Error cloning work item:", error);
      app.notify("Error cloning work item", "danger");
    }
    return;
  }

  const date = moveCloneSelectedDate;
  if (!date) {
    app.notify("Pick a date", "warning");
    return;
  }

  try {
    const result = await postWorkItemDateAction(workId, "move", date);
    if (result.success) {
      app.notify("Work item moved!", "success");
      bootstrap.Modal.getInstance(
        document.getElementById("moveCloneModal"),
      ).hide();
      loadWorkItems();
    } else {
      app.notify("Error: " + result.message, "danger");
    }
  } catch (error) {
    console.error("Error moving work item:", error);
    app.notify("Error moving work item", "danger");
  }
}

async function cycleWorkItemStatus(workId, currentStatus) {
  const currentIndex = STATUS_CYCLE.indexOf(currentStatus);
  const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length];

  try {
    const response = await fetch(`/api/work/${workId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": window.APP_CONFIG?.csrfToken,
      },
      body: JSON.stringify({ status: nextStatus }),
    });

    if (response.status === 429) {
      app.notify(
        "Too many requests - please slow down a moment and try again",
        "warning",
      );
      return;
    }

    const result = await response.json();
    if (result.success) {
      // Update just this work item's status in the DOM without reloading everything
      const workItemEl = document.querySelector(`[data-work-id="${workId}"]`);
      if (workItemEl) {
        const header = workItemEl.querySelector(".work-item-header");
        if (header) {
          header.dataset.status = nextStatus;
        }
        const statusBadge = workItemEl.querySelector('[data-action="cycle-status"]');
        if (statusBadge) {
          statusBadge.textContent = nextStatus;
          // Update badge color based on status
          const bgClass = nextStatus === "Complete" ? "success" : nextStatus === "In Progress" ? "warning" : "secondary";
          statusBadge.className = `badge bg-${bgClass} work-item-status-badge`;
        }
      }
      loadCalendarDayTotals(calendarViewYear, calendarViewMonth);
    } else {
      app.notify("Error: " + result.message, "danger");
    }
  } catch (error) {
    console.error("Error updating status:", error);
    app.notify("Error updating status", "danger");
  }
}

const WORK_ITEM_TIME_BOX_CYCLE = [null, 15, 30, 45, 60];

async function cycleWorkItemTimeBox(workId, currentMinutes) {
  const currentIndex = WORK_ITEM_TIME_BOX_CYCLE.indexOf(currentMinutes);
  const nextMinutes =
    WORK_ITEM_TIME_BOX_CYCLE[
      (currentIndex + 1) % WORK_ITEM_TIME_BOX_CYCLE.length
    ];

  try {
    const response = await fetch(`/api/work/${workId}/timebox`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": window.APP_CONFIG?.csrfToken,
      },
      body: JSON.stringify({ time_box_minutes: nextMinutes }),
    });

    if (response.status === 429) {
      app.notify(
        "Too many requests - please slow down a moment and try again",
        "warning",
      );
      return;
    }

    const result = await response.json();
    if (result.success) {
      // Update just this work item's timebox in the DOM
      const workItemEl = document.querySelector(`[data-work-id="${workId}"]`);
      if (workItemEl) {
        const timeboxBtn = workItemEl.querySelector('[data-action="cycle-timebox"]');
        if (timeboxBtn) {
          if (nextMinutes === null) {
            timeboxBtn.textContent = '';
            timeboxBtn.dataset.minutes = '';
          } else {
            timeboxBtn.textContent = nextMinutes + 'm';
            timeboxBtn.dataset.minutes = nextMinutes;
          }
        }
      }
      // Update calendar total immediately without full reload
      const selectedDate = document.getElementById("selectedDate")?.value;
      if (selectedDate) {
        updateCalendarDayTotal(selectedDate);
      }
    } else {
      app.notify("Error: " + result.message, "danger");
    }
  } catch (error) {
    console.error("Error updating time box:", error);
    app.notify("Error updating time box", "danger");
  }
}

async function toggleWorkItemClaude(workId) {
  try {
    const response = await fetch(`/api/work/${workId}/claude`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": window.APP_CONFIG?.csrfToken,
      },
      body: JSON.stringify({}),
    });

    if (response.status === 429) {
      app.notify(
        "Too many requests - please slow down a moment and try again",
        "warning",
      );
      return;
    }

    const result = await response.json();
    if (result.success) {
      // Update just this work item's claude flag in the DOM
      const workItemEl = document.querySelector(`[data-work-id="${workId}"]`);
      if (workItemEl) {
        const claudeToggle = workItemEl.querySelector('[data-action="toggle-claude"] i');
        if (claudeToggle) {
          // Toggle the color and opacity
          const isActive = claudeToggle.style.color === '#FFA500' || claudeToggle.style.color === 'rgb(255, 165, 0)';
          claudeToggle.style.color = isActive ? '#ddd' : '#FFA500';
          claudeToggle.style.opacity = isActive ? '0.5' : '1';
        }
      }
    } else {
      app.notify("Error: " + result.message, "danger");
    }
  } catch (error) {
    console.error("Error toggling claude flag:", error);
    app.notify("Error toggling claude flag", "danger");
  }
}

function updateCalendarDayTotal(dateStr) {
  // Recalculate total for this day from current work items
  const newTotal = currentWorkItems.reduce(
    (sum, item) => sum + (item.time_box_minutes || 0),
    0,
  );
  calendarDayTotals.set(dateStr, newTotal);

  // Update the calendar cell display
  const dayCell = document.querySelector(`#calendar [data-date="${dateStr}"]`);
  if (dayCell) {
    // Remove old time badge if it exists
    const oldBadge = dayCell.querySelector("span");
    if (oldBadge && oldBadge.style.position === "absolute") {
      oldBadge.remove();
    }

    // Add new time badge
    const dayLabel = formatMinutesTotal(newTotal);
    if (dayLabel) {
      const timeBadge = document.createElement("span");
      timeBadge.textContent = dayLabel;
      timeBadge.style.cssText =
        "position: absolute; top: 1px; right: 2px; font-size: 0.6rem; opacity: 0.75; line-height: 1;";
      dayCell.appendChild(timeBadge);
    }
  }

  // Also update the daily time total display at the top
  const totalMinutes = currentWorkItems.reduce(
    (sum, item) => sum + (item.time_box_minutes || 0),
    0,
  );
  const totalLabel = formatMinutesTotal(totalMinutes);
  document.getElementById("dailyTimeTotal").textContent = totalLabel
    ? `(${totalLabel})`
    : "";
}

function toggleWorkItem(workItemEl) {
  const id = String(workItemEl.dataset.workId);
  if (expandedWorkItems.has(id)) {
    expandedWorkItems.delete(id);
    workItemEl.classList.remove("expanded");
  } else {
    expandedWorkItems.add(id);
    workItemEl.classList.add("expanded");
  }
  renderWorkItemsList(currentWorkItems);
}

async function linkChild(workId, type, id) {
  const path = ASSOCIATION_PATHS[type];
  if (!path) return;

  try {
    const response = await fetch(`/api/work/${workId}/${path}/${id}`, {
      method: "POST",
      headers: { "X-CSRF-Token": window.APP_CONFIG?.csrfToken },
    });
    const result = await response.json();
    if (result.success) {
      expandedWorkItems.add(String(workId));
      loadWorkItems();
    } else {
      app.notify("Error: " + result.message, "danger");
    }
  } catch (error) {
    console.error("Error linking item:", error);
    app.notify("Error linking item", "danger");
  }
}

// Dropping a project/goal/area on empty space in the work items list creates a new
// work item (titled after the dragged item) with that item linked as a child.
async function createWorkItemFromChild(type, id, name, date) {
  try {
    const response = await fetch("/api/work", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": window.APP_CONFIG?.csrfToken,
      },
      body: JSON.stringify({ date, title: name }),
    });

    const result = await response.json();
    if (!result.success) {
      app.notify("Error: " + result.message, "danger");
      return;
    }

    await linkChild(result.data.id, type, id);
  } catch (error) {
    console.error("Error creating work item:", error);
    app.notify("Error creating work item", "danger");
  }
}

async function unlinkChild(workId, type, id) {
  const path = ASSOCIATION_PATHS[type];
  if (!path) return;

  try {
    const response = await fetch(`/api/work/${workId}/${path}/${id}`, {
      method: "DELETE",
      headers: { "X-CSRF-Token": window.APP_CONFIG?.csrfToken },
    });
    const result = await response.json();
    if (result.success) {
      loadWorkItems();
    } else {
      app.notify("Error: " + result.message, "danger");
    }
  } catch (error) {
    console.error("Error unlinking item:", error);
    app.notify("Error removing item", "danger");
  }
}

async function instantiateTemplateOnDate(templateId, date) {
  try {
    const response = await fetch(
      `/api/work-item-templates/${templateId}/instantiate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": window.APP_CONFIG?.csrfToken,
        },
        body: JSON.stringify({ date }),
      },
    );
    const result = await response.json();
    if (result.success) {
      app.notify("Work item created from template", "success");
      const dateInput = document.getElementById("selectedDate");
      if (dateInput && dateInput.value === date) {
        loadWorkItems();
      }
      loadCalendarDayTotals(calendarViewYear, calendarViewMonth);
    } else {
      app.notify("Error: " + result.message, "danger");
    }
  } catch (error) {
    console.error("Error creating work item from template:", error);
    app.notify("Error creating work item from template", "danger");
  }
}

function initWorkItemsListEventListeners() {
  const container = document.getElementById("workItemsList");
  const centerPane = document.getElementById("dailiesCenterPane");
  let clickTimer = null;

  app.bindInlineRename(
    container,
    ".work-item-title",
    async (newTitle, titleEl) => {
      const workId = titleEl.closest(".work-item").dataset.workId;
      try {
        const response = await fetch(`/api/work/${workId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": window.APP_CONFIG?.csrfToken,
          },
          body: JSON.stringify({ title: newTitle }),
        });
        const result = await response.json();
        if (!result.success) {
          app.notify("Error: " + result.message, "danger");
          return false;
        }
        loadWorkItems();
        return true;
      } catch (error) {
        console.error("Error renaming work item:", error);
        app.notify("Error renaming work item", "danger");
        return false;
      }
    },
  );

  container.addEventListener("click", (e) => {
    const actionBtn = e.target.closest(
      '[data-action="delete"], [data-action="unlink"], [data-action="cycle-status"], [data-action="cycle-timebox"], [data-action="pick-emoji"], [data-action="toggle-claude"]',
    );
    if (actionBtn) {
      if (actionBtn.dataset.action === "delete") {
        deleteWorkItem(actionBtn.dataset.id);
      } else if (actionBtn.dataset.action === "unlink") {
        const workItemEl = actionBtn.closest("[data-work-id]");
        unlinkChild(
          workItemEl.dataset.workId,
          actionBtn.dataset.type,
          actionBtn.dataset.childId,
        );
      } else if (actionBtn.dataset.action === "cycle-status") {
        const header = actionBtn.closest(".work-item-header");
        cycleWorkItemStatus(actionBtn.dataset.id, header.dataset.status);
      } else if (actionBtn.dataset.action === "cycle-timebox") {
        const currentMinutes = actionBtn.dataset.minutes
          ? parseInt(actionBtn.dataset.minutes, 10)
          : null;
        cycleWorkItemTimeBox(actionBtn.dataset.id, currentMinutes);
      } else if (actionBtn.dataset.action === "pick-emoji") {
        showEmojiPicker(e.clientX, e.clientY, actionBtn.dataset.id);
      } else if (actionBtn.dataset.action === "toggle-claude") {
        toggleWorkItemClaude(actionBtn.dataset.id);
      }
      return;
    }

    const toggleIcon = e.target.closest('[data-action="toggle-expand"]');
    if (toggleIcon) {
      toggleWorkItem(toggleIcon.closest(".work-item"));
      return;
    }

    const header = e.target.closest(".work-item-header");
    if (!header) return;

    // Ignore clicks on elements with data-action (those are handled above)
    if (e.target.closest('[data-action]')) return;

    // Click on item to open editor
    const workItemEl = header.closest(".work-item");
    if (workItemEl.classList.contains("child-item-row")) {
      // Child item - open its editor
      const itemType = workItemEl.dataset.itemType;
      const itemId = workItemEl.dataset.workId;
      editChildItem(itemType, itemId);
    } else {
      // Work item - open work item editor
      editWorkItem(workItemEl.dataset.workId);
    }
  });

  container.addEventListener("dblclick", (e) => {
    const notesCell = e.target.closest('[data-action="edit-notes"]');
    if (notesCell) {
      openWorkItemNotesModal(notesCell.dataset.id);
      return;
    }
    if (e.target.closest("[data-action]")) return;
    const header = e.target.closest(".work-item-header");
    if (!header) return;
    editWorkItem(header.closest(".work-item").dataset.workId);
  });

  container.addEventListener("contextmenu", (e) => {
    e.preventDefault();

    // Check for child item FIRST (before parent work item)
    const childItem = e.target.closest(".child-item-row");
    if (childItem) {
      const itemType = childItem.dataset.itemType;
      const itemId = childItem.dataset.workId;
      showChildItemContextMenu(e.clientX, e.clientY, itemType, itemId);
      return;
    }

    // Otherwise check for work item (which is not a child item)
    const workItemEl = e.target.closest(".work-item");
    if (workItemEl && !workItemEl.classList.contains("child-item-row")) {
      showWorkItemContextMenu(e.clientX, e.clientY, workItemEl.dataset.workId);
    }
  });

  container.addEventListener("dragstart", (e) => {
    const header = e.target.closest(".work-item-header");
    if (!header) return;
    const workItemEl = header.closest(".work-item");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("type", "work-item");
    e.dataTransfer.setData("id", workItemEl.dataset.workId);
    currentDragType = "work-item";
    header.classList.add("dragging-item");
  });

  container.addEventListener("dragend", (e) => {
    const header = e.target.closest(".work-item-header");
    if (header) header.classList.remove("dragging-item");
    currentDragType = null;
    clearWorkItemDropIndicators(container);
  });

  centerPane.addEventListener("dragover", (e) => {
    const types = Array.from(e.dataTransfer.types || []);
    const hasCalendarData =
      types.includes("text/calendar") ||
      types.includes("text/plain") ||
      types.some(
        (t) =>
          t.toLowerCase().includes("calendar") ||
          t.toLowerCase().includes("ics") ||
          t.toLowerCase().includes("event"),
      );

    // Always allow drops for calendar data or internal drags
    if (hasCalendarData || currentDragType) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      centerPane.classList.add("work-items-drop-target");
    }

    const workItemEl = e.target.closest(".work-item");
    if (workItemEl && currentDragType === "work-item") {
      // Reordering: show which side of this row the dragged item will land
      // on, rather than just highlighting the row as if it were a merge target.
      const zone = app.getVerticalDropZone(e, workItemEl);
      workItemEl.classList.remove(
        "drag-over",
        "drop-indicator-before",
        "drop-indicator-after",
      );
      workItemEl.classList.add(
        zone === "before" ? "drop-indicator-before" : "drop-indicator-after",
      );
    } else if (workItemEl && currentDragType && currentDragType !== "work-item") {
      // Linking a project/goal/category/template onto this work item
      workItemEl.classList.remove(
        "drop-indicator-before",
        "drop-indicator-after",
      );
      workItemEl.classList.add("drag-over");
    }
  });

  centerPane.addEventListener("dragleave", (e) => {
    const workItemEl = e.target.closest(".work-item");
    if (workItemEl && !workItemEl.contains(e.relatedTarget)) {
      workItemEl.classList.remove(
        "drag-over",
        "drop-indicator-before",
        "drop-indicator-after",
      );
    }
    if (!centerPane.contains(e.relatedTarget)) {
      centerPane.classList.remove("work-items-drop-target");
    }
  });

  centerPane.addEventListener("drop", async (e) => {
    e.preventDefault();
    centerPane.classList.remove("work-items-drop-target");

    const type = e.dataTransfer.getData("type");
    const id = e.dataTransfer.getData("id");
    const workItemEl = e.target.closest(".work-item");

    if (type === "work-item") {
      const targetId =
        workItemEl && workItemEl.dataset.workId !== id
          ? workItemEl.dataset.workId
          : null;
      const position = workItemEl
        ? app.getVerticalDropZone(e, workItemEl)
        : "after";
      if (workItemEl)
        workItemEl.classList.remove(
          "drag-over",
          "drop-indicator-before",
          "drop-indicator-after",
        );
      reorderWorkItemsOnDrop(id, targetId, position);
      return;
    }

    if (type && id) {
      if (workItemEl) {
        workItemEl.classList.remove(
          "drag-over",
          "drop-indicator-before",
          "drop-indicator-after",
        );
        linkChild(workItemEl.dataset.workId, type, id);
        return;
      }

      // Dropped on empty space (not on an existing item)
      const dateInput = document.getElementById("selectedDate");
      const date = dateInput?.value || new Date().toISOString().split("T")[0];

      if (type === "template") {
        instantiateTemplateOnDate(id, date);
      } else if (type === "priority" || type === "goal" || type === "area") {
        const name = e.dataTransfer.getData("name");
        createWorkItemFromChild(type, id, name, date);
      }
      return;
    }

    // Handle external calendar events from Outlook
    const types = Array.from(e.dataTransfer.types || []);
    console.log("[Dailies WorkItems] Drop detected. Types:", types);

    let calendarText = null;

    if (e.dataTransfer.types.includes("text/calendar")) {
      calendarText = e.dataTransfer.getData("text/calendar");
    } else if (e.dataTransfer.types.includes("text/plain")) {
      calendarText = e.dataTransfer.getData("text/plain");
    } else {
      for (const t of e.dataTransfer.types) {
        if (
          t.toLowerCase().includes("calendar") ||
          t.toLowerCase().includes("ics") ||
          t.toLowerCase().includes("event")
        ) {
          calendarText = e.dataTransfer.getData(t);
          break;
        }
      }
    }

    if (!calendarText) {
      calendarText = e.dataTransfer.getData("text");
    }

    console.log(
      "[Dailies WorkItems] Calendar text:",
      calendarText?.substring(0, 100),
    );

    // Check if this looks like calendar data
    const looksLikeCalendar =
      calendarText &&
      (calendarText.includes("BEGIN:VEVENT") ||
        calendarText.includes("DTSTART") ||
        calendarText.includes("When:") ||
        calendarText.includes("Location:") ||
        calendarText.includes("Organizer:"));

    if (looksLikeCalendar) {
      const event = parseCalendarEvent(calendarText);
      console.log("[Dailies WorkItems] Parsed event:", event);

      if (event.title) {
        const dateInput = document.getElementById("selectedDate");
        const date = dateInput?.value || new Date().toISOString().split("T")[0];
        await createWorkItemFromCalendarEvent(event, date);
      }
    }
  });
}

function initRightPanelTabs() {
  // Handle folder toggling for associate items
  document.querySelectorAll(".associate-folder-header").forEach((header) => {
    header.addEventListener("click", () => {
      const folder = header.dataset.folder;
      const content = document.querySelector(`.associate-folder-content[data-folder="${folder}"]`);
      const toggle = header.querySelector(".associate-folder-toggle");

      if (content) {
        const isOpen = content.style.display !== "none";
        content.style.display = isOpen ? "none" : "block";
        if (toggle) {
          toggle.style.transform = isOpen ? "rotate(0deg)" : "rotate(90deg)";
        }
        localStorage.setItem(`dailiesFolder_${folder}`, isOpen ? "closed" : "open");
      }
    });

    // Restore state from localStorage
    const folder = header.dataset.folder;
    const savedState = localStorage.getItem(`dailiesFolder_${folder}`);
    const content = document.querySelector(`.associate-folder-content[data-folder="${folder}"]`);
    const toggle = header.querySelector(".associate-folder-toggle");

    if (savedState === "open" && content) {
      content.style.display = "block";
      if (toggle) toggle.style.transform = "rotate(90deg)";
    }
  });
}

// Double-clicking a project/goal/area/template chip in the right panel opens that
// item's own edit modal (shared globally since all tab scripts share one scope).
function initRightPanelEditOnDblClick() {
  document.querySelectorAll(".right-panel-list").forEach((panel) => {
    panel.addEventListener("dblclick", (e) => {
      const item = e.target.closest("[data-type][data-id]");
      if (!item) return;

      const { type, id } = item.dataset;
      if (type === "priority" && typeof editPriority === "function") {
        editPriority(id);
      } else if (type === "goal" && typeof editGoal === "function") {
        editGoal(id);
      } else if (type === "area" && typeof editArea === "function") {
        editArea(id);
      } else if (type === "template" && typeof editTemplate === "function") {
        editTemplate(id);
      }
    });
  });
}

function initWorkItemContextMenu() {
  const menu = document.getElementById("workItemContextMenu");
  if (!menu) return;

  // Submenu toggle handler (click-to-toggle, not hover)
  document.addEventListener("click", (e) => {
    const submenuBtn = e.target.closest("[data-submenu]");
    if (submenuBtn && !menu.classList.contains("d-none")) {
      const submenuId = submenuBtn.dataset.submenu + "-submenu";
      const submenu = document.getElementById(submenuId);
      if (submenu) {
        const isHidden = submenu.classList.contains("d-none");
        // Hide all submenus first
        menu.querySelectorAll(".context-menu-submenu").forEach(m => m.classList.add("d-none"));
        // Show the clicked submenu
        if (isHidden) {
          submenu.classList.remove("d-none");
        }
      }
      e.stopPropagation();
    } else if (e.target.closest("[data-action]") && !menu.classList.contains("d-none") && menu.contains(e.target)) {
      // Let action handlers proceed
    } else if (!menu.classList.contains("d-none") && !menu.contains(e.target)) {
      hideWorkItemContextMenu();
    }
  });

  // Main action dispatcher
  menu.addEventListener("click", async (e) => {
    const actionBtn = e.target.closest("[data-action]");
    if (!actionBtn || !contextMenuWorkItemId) return;

    const action = actionBtn.dataset.action;
    const workItemId = contextMenuWorkItemId;
    hideWorkItemContextMenu();

    if (action === "add-project") showProjectSelector(workItemId);
    else if (action === "add-area") showAreaSelector(workItemId);
    else if (action === "add-goal") showGoalSelector(workItemId);
    else if (action === "add-todo") showTodoSelector(workItemId);
    else if (action === "add-task") showTaskSelector(workItemId);
    else if (action === "add-ticket") showTicketSelector(workItemId);
    else if (action === "add-idea") showIdeaSelector(workItemId);
    else if (action === "create-project") createAndEditItem("priority", workItemId);
    else if (action === "create-area") createAndEditItem("area", workItemId);
    else if (action === "create-goal") createAndEditItem("goal", workItemId);
    else if (action === "create-todo") createAndEditItem("todo", workItemId);
    else if (action === "create-task") createAndEditItem("task", workItemId);
    else if (action === "create-ticket") createAndEditItem("ticket", workItemId);
    else if (action === "create-idea") createAndEditItem("idea", workItemId);
    else if (action === "move-to") openMoveCloneModal(workItemId, "move");
    else if (action === "clone-to") openMoveCloneModal(workItemId, "clone");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideWorkItemContextMenu();
  });

  const saveWorkNotesBtn = document.getElementById("saveWorkNotesBtn");
  if (saveWorkNotesBtn) {
    saveWorkNotesBtn.addEventListener("click", saveWorkItemNotes);
  }

  const confirmMoveCloneBtn = document.getElementById("confirmMoveCloneBtn");
  if (confirmMoveCloneBtn) {
    confirmMoveCloneBtn.addEventListener("click", confirmMoveClone);
  }

  const moveCloneCalendar = document.getElementById("moveCloneCalendar");
  if (moveCloneCalendar) {
    moveCloneCalendar.addEventListener("click", (e) => {
      const navBtn = e.target.closest("[data-cal-nav]");
      if (navBtn) {
        changeMoveCloneCalendarMonth(navBtn.dataset.calNav === "prev" ? -1 : 1);
        return;
      }
      const dayCell = e.target.closest("[data-date]");
      if (dayCell) selectMoveCloneDate(dayCell.dataset.date);
    });
  }
}

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
function showRemovalModal(workItem, assocKey, typeName) {
  const items = workItem[assocKey] || [];
  if (items.length === 0) {
    app.notify(`No ${typeName}s associated with this work item`, 'info');
    return;
  }

  const typeToAssocPath = {
    'projects': 'priority',
    'areas': 'area',
    'goals': 'goal',
    'templates': 'template',
    'todos': 'todo',
    'tasks': 'task',
    'tickets': 'ticket',
    'ideas': 'idea'
  };
  const assocPath = typeToAssocPath[assocKey];

  showSelectionModal(`Remove ${typeName}`, items, (itemId) => {
    unlinkChild(workItem.id, assocPath, itemId);
  });
}

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
async function showTemplateSelector(workItemId) {
  const response = await fetch('/api/work-item-templates');
  const result = await response.json();
  const templates = result.success ? result.data : [];
  showSelectionModal('Associate Template', templates, (templateId) => {
    associateTemplate(workItemId, templateId);
  });
}

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
    const response = await fetch(`/api/work/${workItemId}/priorities/${projectId}`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });
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
    const response = await fetch(`/api/work/${workItemId}/areas/${areaId}`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });
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
    const response = await fetch(`/api/work/${workItemId}/goals/${goalId}`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });
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
    const response = await fetch(`/api/work/${workItemId}/templates/${templateId}`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });
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
    const response = await fetch(`/api/work/${workItemId}/todos/${todoId}`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });
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
    const response = await fetch(`/api/work/${workItemId}/tasks/${taskId}`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });
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
    const response = await fetch(`/api/work/${workItemId}/tickets/${ticketId}`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });
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
    const response = await fetch(`/api/work/${workItemId}/ideas/${ideaId}`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });
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
  const title = prompt('Enter project name:');
  if (!title) return;
  try {
    const response = await fetch('/api/priorities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.APP_CONFIG?.csrfToken },
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
  const name = prompt('Enter category name:');
  if (!name) return;
  try {
    const response = await fetch('/api/areas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.APP_CONFIG?.csrfToken },
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
  const name = prompt('Enter goal name:');
  if (!name) return;
  try {
    const response = await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.APP_CONFIG?.csrfToken },
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
  const title = prompt('Enter todo title:');
  if (!title) return;
  try {
    const response = await fetch('/api/to-dos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.APP_CONFIG?.csrfToken },
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
  const title = prompt('Enter task title:');
  if (!title) return;
  try {
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.APP_CONFIG?.csrfToken },
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
  const title = prompt('Enter ticket title:');
  if (!title) return;
  try {
    const response = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.APP_CONFIG?.csrfToken },
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
  const title = prompt('Enter idea title:');
  if (!title) return;
  try {
    const response = await fetch('/api/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.APP_CONFIG?.csrfToken },
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
let childItemContextMenuData = null;

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

  menu.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-child-action]');
    if (!actionBtn) return;

    const action = actionBtn.dataset.childAction;
    document.body.removeChild(menu);

    if (action === 'edit') {
      editChildItem(itemType, itemId);
    } else if (action === 'delete') {
      if (confirm(`Remove this ${typeName}?`)) {
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

  fetch(`/api/work/${parentWorkItemId}/${endpoint}/${itemId}`, {
    method: 'DELETE',
    headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
  })
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
    'priority': () => editPriority(itemId),
    'area': () => editArea(itemId),
    'goal': () => editGoal(itemId),
    'template': () => editTemplate(itemId),
    'todo': () => editTodo(itemId),
    'task': () => editTask(itemId),
    'ticket': () => editTicket(itemId),
    'idea': () => editIdea(itemId)
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
  const title = prompt('Enter template name:');
  if (!title) return;
  try {
    const response = await fetch('/api/work-item-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.APP_CONFIG?.csrfToken },
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

// Store currently edited child item
let currentEditingChild = null;
let childItemEditorId = null;
let childItemEditorHasChanges = false;

const markChildItemEditorChanged = () => {
  childItemEditorHasChanges = true;
  const saveBtn = document.getElementById('saveChildItemEditorBtn');
  if (saveBtn) saveBtn.disabled = false;
};

const trackChildItemFormChanges = () => {
  const form = document.getElementById('childItemEditorForm');
  if (!form) return;

  const inputs = form.querySelectorAll('input[type="text"], textarea, input[type="number"], select');
  inputs.forEach(input => {
    input.addEventListener('change', markChildItemEditorChanged);
    input.addEventListener('input', markChildItemEditorChanged);
  });
};

function openChildItemEditor(type, id) {
  // If clicking same item, toggle close
  if (currentEditingChild?.id === id && currentEditingChild?.type === type) {
    closeChildItemEditor();
    return;
  }

  currentEditingChild = { type, id };
  childItemEditorId = id;

  // Hide work item editor, show child editor
  const workPane = document.getElementById('workItemEditorPane');
  const childPane = document.getElementById('childItemEditorPane');
  if (workPane) workPane.classList.add('hidden');
  if (childPane) childPane.classList.remove('hidden');

  // Load child item data
  childItemEditorHasChanges = false;
  const saveBtn = document.getElementById('saveChildItemEditorBtn');
  if (saveBtn) saveBtn.disabled = true;

  loadChildItemForEditing(type, id);
  trackChildItemFormChanges();
}

function closeChildItemEditor() {
  currentEditingChild = null;
  childItemEditorId = null;
  const childPane = document.getElementById('childItemEditorPane');
  if (childPane) childPane.classList.add('hidden');
}

async function loadChildItemForEditing(type, id) {
  const typeMap = {
    'priority': '/api/priorities',
    'area': '/api/areas',
    'goal': '/api/goals',
    'template': '/api/work-item-templates',
    'todo': '/api/to-dos',
    'task': '/api/tasks',
    'ticket': '/api/tickets',
    'idea': '/api/ideas'
  };

  const typeLabels = {
    'priority': 'Priority',
    'area': 'Category',
    'goal': 'Goal',
    'template': 'Template',
    'todo': 'Todo',
    'task': 'Task',
    'ticket': 'Ticket',
    'idea': 'Idea'
  };

  const endpoint = typeMap[type];
  if (!endpoint) return;

  try {
    const response = await fetch(`${endpoint}/${id}`);
    const result = await response.json();
    if (result.success) {
      const item = result.data;

      // Set common fields
      document.getElementById('childItemEditorId').value = id;
      document.getElementById('childItemEditorType').value = type;
      document.getElementById('childItemEditorTitle').value = item.title || item.name || '';
      document.getElementById('childItemEditorDisplayTitle').textContent = item.title || item.name || 'Edit Item';
      document.getElementById('childItemEditorTypeLabel').textContent = typeLabels[type] || type;

      // Hide all optional fields first
      document.getElementById('childItemEditorNotesField').style.display = 'none';
      document.getElementById('childItemEditorDescriptionField').style.display = 'none';
      document.getElementById('childItemEditorStatusField').style.display = 'none';
      document.getElementById('childItemEditorYearField').style.display = 'none';

      // Show and populate fields based on type
      if (type === 'todo' || type === 'task') {
        // Todos and tasks have: notes, status
        document.getElementById('childItemEditorNotesField').style.display = 'block';
        document.getElementById('childItemEditorStatusField').style.display = 'block';
        document.getElementById('childItemEditorNotes').value = item.notes || '';
        document.getElementById('childItemEditorStatus').value = item.status || 'incomplete';
      } else if (type === 'ticket' || type === 'idea') {
        // Tickets and ideas have: notes (no status field)
        document.getElementById('childItemEditorNotesField').style.display = 'block';
        document.getElementById('childItemEditorNotes').value = item.notes || '';
      } else if (type === 'priority') {
        // Priorities have: notes (not description!)
        document.getElementById('childItemEditorNotesField').style.display = 'block';
        document.getElementById('childItemEditorNotes').value = item.notes || '';
      } else if (type === 'goal') {
        // Goals have: description, year
        document.getElementById('childItemEditorDescriptionField').style.display = 'block';
        document.getElementById('childItemEditorYearField').style.display = 'block';
        document.getElementById('childItemEditorDescription').value = item.description || '';
        document.getElementById('childItemEditorYear').value = item.year || '';
      } else {
        // Areas and templates have: description
        document.getElementById('childItemEditorDescriptionField').style.display = 'block';
        document.getElementById('childItemEditorDescription').value = item.description || '';
      }
    }
  } catch (error) {
    console.error('Error loading child item:', error);
  }
}

// Editor functions - open child item editor in right pane
function editPriority(priorityId) {
  openChildItemEditor('priority', priorityId);
}

function editArea(areaId) {
  openChildItemEditor('area', areaId);
}

function editGoal(goalId) {
  openChildItemEditor('goal', goalId);
}

function editTemplate(templateId) {
  openChildItemEditor('template', templateId);
}

function editTodo(todoId) {
  openChildItemEditor('todo', todoId);
}

function editTask(taskId) {
  openChildItemEditor('task', taskId);
}

function editTicket(ticketId) {
  openChildItemEditor('ticket', ticketId);
}

function editIdea(ideaId) {
  openChildItemEditor('idea', ideaId);
}

function initDailiesEventListeners() {
  console.log("[Dailies] initDailiesEventListeners called");
  const calendarEl = document.getElementById("calendar");
  console.log("[Dailies] Calendar element found:", !!calendarEl);

  const addWorkItemBtn = document.getElementById("addWorkItemBtn");
  if (addWorkItemBtn) {
    addWorkItemBtn.addEventListener("click", openNewWorkForm);
  }

  const importOutlookEmailsBtn = document.getElementById("importOutlookEmailsBtn");
  if (importOutlookEmailsBtn) {
    importOutlookEmailsBtn.addEventListener("click", importSelectedOutlookEmails);
  }

  // Handle clicking items in the work picker
  const pickerPane = document.getElementById("picker-pane");
  if (pickerPane) {
    pickerPane.addEventListener("click", (e) => {
      const addItemBtn = e.target.closest("[data-action='add-item-to-dailies']");
      if (addItemBtn) {
        const itemType = addItemBtn.dataset.itemType;
        const itemId = addItemBtn.dataset.itemId;
        addItemToDailies(itemType, itemId);
        return;
      }

      const createBtn = e.target.closest("[data-action='create-new-item']");
      if (createBtn) {
        const itemType = createBtn.dataset.type;
        app.notify(`Creating new ${itemType} - navigate to the appropriate tab to create it`, 'info');
        return;
      }
    });
  }

  initWorkItemsListEventListeners();
  initRightPanelTabs();
  initRightPanelEditOnDblClick();
  initWorkItemContextMenu();
  initCalendarDropMenu();
  initCalendarDayContextMenu();
  initEmojiPicker();

  if (!calendarEl) {
    console.error(
      "[Dailies] Calendar element not found! Cannot attach event listeners.",
    );
    return;
  }

  console.log("[Dailies] Attaching click listener to calendar element");
  calendarEl.addEventListener("click", (e) => {
    console.log("[Dailies] Calendar click event fired", e.target, e.target.closest("[data-date]"));
    const navBtn = e.target.closest("[data-cal-nav]");
    if (navBtn) {
      changeCalendarMonth(navBtn.dataset.calNav === "prev" ? -1 : 1);
      return;
    }
    const dayCell = e.target.closest("[data-date]");
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

  calendarEl.addEventListener("contextmenu", (e) => {
    const dayCell = e.target.closest("[data-date]");
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

  calendarEl.addEventListener("dragover", (e) => {
    const dayCell = e.target.closest("[data-date]");
    document
      .querySelectorAll("#calendar .calendar-drop-target")
      .forEach((el) => el.classList.remove("calendar-drop-target"));

    if (dayCell) {
      const types = Array.from(e.dataTransfer.types || []);
      console.log("[Dailies] DRAGOVER EVENT - Types:", types);
      console.log("[Dailies] dropEffect:", e.dataTransfer.dropEffect);
      console.log("[Dailies] effectAllowed:", e.dataTransfer.effectAllowed);

      // Check if this is internal drag (template or work-item)
      const hasInternalDrag =
        types.includes("type") &&
        (e.dataTransfer.getData("type") === "template" ||
          e.dataTransfer.getData("type") === "work-item");

      // Accept any drag with text data (could be email, calendar, etc from Outlook or other sources)
      // Even if we can't identify it as a specific type, allow the drop
      const hasTextData =
        types.length > 0 && !types.every((t) => t.startsWith("application/"));

      console.log(
        "[Dailies] hasInternalDrag:",
        hasInternalDrag,
        "hasTextData:",
        hasTextData,
      );
      console.log("[Dailies] Accepting drag?", hasTextData || hasInternalDrag);

      if (hasTextData || hasInternalDrag) {
        console.log(
          "[Dailies] YES - preventing default and showing drop target",
        );
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        // Highlight all selected dates if multi-select is active, otherwise just the hovered date
        const targetDates =
          calendarMultiSelectedDates.size > 0
            ? Array.from(calendarMultiSelectedDates)
            : [dayCell.dataset.date];
        targetDates.forEach((date) => {
          const cell = document.querySelector(
            `#calendar [data-date="${date}"]`,
          );
          if (cell) cell.classList.add("calendar-drop-target");
        });
        console.log(
          "[Dailies] Dragover - calendar drop zone active on",
          targetDates,
        );
      }
    }
  });

  calendarEl.addEventListener("dragleave", (e) => {
    const dayCell = e.target.closest("[data-date]");
    if (dayCell && !dayCell.contains(e.relatedTarget)) {
      dayCell.classList.remove("calendar-drop-target");
    }
  });

  // Catch-all dragover on document to see all drags
  document.addEventListener(
    "dragover",
    (e) => {
      if (e.target.closest("#calendar")) {
        const types = Array.from(e.dataTransfer.types || []);
        console.log("[Document] Dragover on calendar area. Types:", types);
      }
    },
    true,
  );

  calendarEl.addEventListener("drop", (e) => {
    console.log(
      "[Dailies] DROP EVENT FIRED on element:",
      e.target.tagName,
      e.target.className,
    );
    const dayCell = e.target.closest("[data-date]");
    console.log("[Dailies] dayCell found:", !!dayCell);
    document
      .querySelectorAll("#calendar .calendar-drop-target")
      .forEach((el) => el.classList.remove("calendar-drop-target"));
    if (!dayCell) {
      console.log(
        "[Dailies] Drop detected but no dayCell found. Target:",
        e.target.outerHTML.substring(0, 100),
      );
      return;
    }
    e.preventDefault();
    console.log("[Dailies] Drop on date:", dayCell.dataset.date);

    const type = e.dataTransfer.getData("type");
    const id = e.dataTransfer.getData("id");

    // Determine target dates: use multi-select if available, otherwise just the dropped-on date
    const targetDates =
      calendarMultiSelectedDates.size > 0
        ? Array.from(calendarMultiSelectedDates).sort()
        : [dayCell.dataset.date];
    console.log("[Dailies] Target dates:", targetDates);

    if (type === "template") {
      // Apply template instantiation to all selected dates
      targetDates.forEach((date) => {
        instantiateTemplateOnDate(id, date);
      });
      return;
    } else if (type === "work-item") {
      showCalendarDropMenu(e.clientX, e.clientY, id, dayCell.dataset.date);
      return;
    }

    // Handle external calendar events from Outlook
    const types = Array.from(e.dataTransfer.types || []);
    console.log("[Dailies] External drop. Types:", types, "id:", id);
    const hasCalendarData =
      types.includes("text/calendar") ||
      types.includes("text/plain") ||
      types.some(
        (t) =>
          t.toLowerCase().includes("calendar") ||
          t.toLowerCase().includes("ics") ||
          t.toLowerCase().includes("event"),
      );

    console.log("[Dailies] hasCalendarData:", hasCalendarData, "id:", id);

    if (hasCalendarData && !id) {
      let calendarText = null;

      if (e.dataTransfer.types.includes("text/calendar")) {
        calendarText = e.dataTransfer.getData("text/calendar");
        console.log("[Dailies] Got text/calendar");
      } else if (e.dataTransfer.types.includes("text/plain")) {
        calendarText = e.dataTransfer.getData("text/plain");
        console.log("[Dailies] Got text/plain");
      } else {
        for (const type of e.dataTransfer.types) {
          if (
            type.toLowerCase().includes("calendar") ||
            type.toLowerCase().includes("ics") ||
            type.toLowerCase().includes("event")
          ) {
            calendarText = e.dataTransfer.getData(type);
            console.log("[Dailies] Got from type:", type);
            break;
          }
        }
      }

      console.log(
        "[Dailies] Calendar text found:",
        calendarText?.length,
        "bytes",
      );
      console.log("[Dailies] Text preview:", calendarText?.substring(0, 100));

      // Check if this looks like calendar data (iCalendar or Outlook plain text)
      const looksLikeCalendar =
        calendarText &&
        (calendarText.includes("BEGIN:VEVENT") ||
          calendarText.includes("DTSTART") ||
          calendarText.includes("When:") ||
          calendarText.includes("Location:") ||
          calendarText.includes("Organizer:"));

      // Check if this looks like email data
      const looksLikeEmail =
        calendarText &&
        (calendarText.includes("Subject:") ||
          calendarText.includes("From:") ||
          (calendarText.includes("To:") && calendarText.includes("Date:")));

      console.log(
        "[Dailies] looksLikeCalendar:",
        looksLikeCalendar,
        "looksLikeEmail:",
        looksLikeEmail,
      );

      if (looksLikeCalendar) {
        const event = parseCalendarEvent(calendarText);
        console.log("[Dailies] Parsed calendar event:", event);
        if (event.title) {
          console.log(
            "[Dailies] Creating work items from calendar event on dates:",
            targetDates,
          );
          targetDates.forEach((date) => {
            createWorkItemFromCalendarEvent(event, date);
          });
        }
      } else if (looksLikeEmail) {
        const email = parseOutlookEmail(calendarText);
        console.log("[Dailies] Parsed email:", email);
        if (email.subject) {
          console.log(
            "[Dailies] Creating work items from email on dates:",
            targetDates,
          );
          targetDates.forEach((date) => {
            createWorkItemFromEmail(email, date);
          });
        }
      }
    }
  });
}

async function loadDataSourcesForImport() {
  try {
    const response = await fetch("/api/sources");
    if (!response.ok) return;
    const result = await response.json();

    const container = document.getElementById("dataSourcesIcons");
    if (!container || !result.success || !result.data.length) return;

    container.innerHTML = "";

    const sourceIcons = {
      teams: { icon: "bi-microsoft-teams", label: "Teams", color: "#6264A7" },
      outlook: { icon: "bi-envelope", label: "Outlook", color: "#0078D4" },
      "azure-devops": {
        icon: "bi-diagram-3",
        label: "Azure DevOps",
        color: "#0078D4",
      },
      "github-enterprise": {
        icon: "bi-github",
        label: "GitHub",
        color: "#000",
      },
      servicenow: { icon: "bi-ticket", label: "ServiceNow", color: "#00A699" },
    };

    result.data.forEach((source) => {
      const config = sourceIcons[source.type];
      if (!config) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-sm";
      btn.style.cssText = `
        width: 38px;
        height: 38px;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #dee2e6;
        background: #fff;
        color: ${config.color};
        font-size: 18px;
        border-radius: 4px;
      `;
      btn.title = `Import from ${config.label}`;
      btn.innerHTML = `<i class="bi ${config.icon}"></i>`;
      btn.dataset.sourceId = source.id;
      btn.dataset.sourceType = source.type;
      btn.onclick = (e) => {
        e.preventDefault();
        importFromDataSource(source.id, source.type);
      };

      container.appendChild(btn);
    });
  } catch (error) {
    console.error("Error loading data sources:", error);
  }
}

async function importFromDataSource(sourceId, sourceType) {
  console.log("Import from source:", sourceId, sourceType);

  if (sourceType === "outlook") {
    await loadOutlookEmails(sourceId);
  } else {
    app.notify("Import from " + sourceType + " coming soon!", "info");
  }
}

async function importSelectedOutlookEmails() {
  const selectedIndices = Array.from(
    document.querySelectorAll(".outlook-email-checkbox:checked"),
  ).map((cb) => parseInt(cb.value));

  if (selectedIndices.length === 0) {
    app.notify("No emails selected", "warning");
    return;
  }

  const emails = window.outlookEmailsData || [];
  const selectedDate = document.getElementById("selectedDate").value;

  for (const idx of selectedIndices) {
    const email = emails[idx];
    if (!email) continue;

    // Create a work item from the email
    const workItem = {
      title: email.subject,
      description: email.bodyPreview || email.body,
      notes: `From: ${email.from}\nDate: ${new Date(email.receivedDateTime).toLocaleString()}`,
      date: selectedDate,
    };

    try {
      const response = await fetch("/api/work-items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": window.APP_CONFIG?.csrfToken,
        },
        body: JSON.stringify(workItem),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      console.error("Error importing email:", error);
    }
  }

  app.notify(`Imported ${selectedIndices.length} email(s)`, "success");
  bootstrap.Modal.getInstance(
    document.getElementById("importOutlookModal"),
  ).hide();
  loadWorkItems();
}

function beginSsoAuth() {
  const sourceType = document.getElementById("sourceType").value;
  if (!sourceType) {
    app.notify("No source type selected", "warning");
    return;
  }

  // Redirect to OAuth initiation endpoint
  window.location.href = `/api/sources/auth/sso/initiate?type=${sourceType}`;
}

async function loadOutlookEmails(sourceId) {
  const selectedDate = document.getElementById("selectedDate").value;
  const modal = new bootstrap.Modal(
    document.getElementById("importOutlookModal"),
  );
  modal.show();

  // Show loading state
  document.getElementById("outlookLoadingSpinner").style.display = "block";
  document.getElementById("outlookEmailsList").style.display = "none";
  document.getElementById("outlookErrorMsg").style.display = "none";

  try {
    const response = await fetch(
      `/api/sources/${sourceId}/emails?date=${selectedDate}`,
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();

    document.getElementById("outlookLoadingSpinner").style.display = "none";

    if (!result.success) {
      document.getElementById("outlookErrorMsg").style.display = "block";
      document.getElementById("outlookErrorMsg").textContent =
        result.message || "Failed to load emails";
      return;
    }

    const emails = result.data || [];
    const emailsList = document.getElementById("outlookEmailsList");

    if (emails.length === 0) {
      emailsList.style.display = "block";
      emailsList.innerHTML =
        '<p class="text-muted text-center">No emails found for this date</p>';
      document.getElementById("importOutlookEmailsBtn").disabled = true;
      return;
    }

    // Build email list with checkboxes
    emailsList.innerHTML = emails
      .map(
        (email, idx) => `
      <div class="form-check" style="padding: 10px; border-bottom: 1px solid #dee2e6;">
        <input class="form-check-input outlook-email-checkbox" type="checkbox" value="${idx}" id="email_${idx}">
        <label class="form-check-label w-100" for="email_${idx}" style="cursor: pointer;">
          <div style="font-weight: 500; margin-bottom: 2px;">${app.escapeHtml(email.subject)}</div>
          <small class="text-muted">${app.escapeHtml(email.from)} • ${new Date(email.receivedDateTime).toLocaleTimeString()}</small>
          <div style="font-size: 0.85rem; margin-top: 4px; color: #666;">${app.escapeHtml(email.bodyPreview || "")}</div>
        </label>
      </div>
    `,
      )
      .join("");

    emailsList.style.display = "block";

    // Add change listeners to checkboxes to enable/disable import button
    document.querySelectorAll(".outlook-email-checkbox").forEach((cb) => {
      cb.addEventListener("change", () => {
        const anyChecked = document.querySelector(
          ".outlook-email-checkbox:checked",
        );
        document.getElementById("importOutlookEmailsBtn").disabled =
          !anyChecked;
      });
    });

    // Store emails for later import
    window.outlookEmailsData = emails;
    window.outlookSourceId = sourceId;
  } catch (error) {
    console.error("Error loading emails:", error);
    document.getElementById("outlookLoadingSpinner").style.display = "none";
    document.getElementById("outlookErrorMsg").style.display = "block";
    document.getElementById("outlookErrorMsg").textContent =
      "Error loading emails: " + error.message;
  }
}

function initDailies() {
  const today = new Date().toISOString().split("T")[0];
  const dateInput = document.createElement("input");
  dateInput.type = "hidden";
  dateInput.id = "selectedDate";
  dateInput.value = today;
  document.body.appendChild(dateInput);

  // Setup outer split-pane (Calendar | Content)
  const outerSplitPane = new SplitPane("dailiesOuterSplitPane", "dailiesCalendarPane", "dailiesOuterDivider", "dailiesContentRight", 25);
  outerSplitPane.showRightPane(75);

  // Setup inner split-pane (Work Items | Editor)
  dailiesSplitPane = new SplitPane("dailiesSplitPane", "dailiesCenterPane", "dailiesDivider", "workItemEditorPane", 66.66);

  // Setup drawer toggle for associate items
  const associateToggle = document.getElementById("dailiesAssociateItemsToggle");
  const associatePanel = document.getElementById("dailiesAssociateItemsPanel");

  const savedState = localStorage.getItem("dailiesDrawerOpen");
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
        localStorage.setItem("dailiesDrawerOpen", "false");
      } else {
        associatePanel.style.width = "220px";
        associatePanel.style.padding = "15px";
        associatePanel.dataset.drawerOpen = "true";
        localStorage.setItem("dailiesDrawerOpen", "true");
      }
    }
  });

  // Setup split-pane editor buttons
  const saveWorkItemEditorBtn = document.getElementById("saveWorkItemEditorBtn");
  const closeWorkItemEditorBtn = document.getElementById("closeWorkItemEditorBtn");

  if (saveWorkItemEditorBtn) {
    saveWorkItemEditorBtn.addEventListener("click", async () => {
      const workId = document.getElementById("workItemEditorId").value;
      const title = document.getElementById("workItemEditorTitle").value;
      const description = document.getElementById("workItemEditorDescription").value;
      const status = document.getElementById("workItemEditorStatus").value;
      const timeBox = document.getElementById("workItemEditorTimeBox").value;

      if (!title.trim()) {
        app.notify("Title is required", "warning");
        return;
      }

      try {
        const response = await fetch(`/api/work/${workId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": window.APP_CONFIG?.csrfToken
          },
          body: JSON.stringify({
            title,
            description,
            status: status || "Not Started",
            time_box_minutes: timeBox ? Math.round(parseFloat(timeBox) * 60) : null
          })
        });

        const result = await response.json();
        if (result.success) {
          app.notify("Work item updated!", "success");
          closeWorkItemEditor();
          loadWorkItems();
          loadCalendarDayTotals(calendarViewYear, calendarViewMonth);
        } else {
          app.notify("Error: " + result.message, "danger");
        }
      } catch (error) {
        console.error("Error saving work item:", error);
        app.notify("Error saving work item", "danger");
      }
    });
  }

  if (closeWorkItemEditorBtn) {
    closeWorkItemEditorBtn.addEventListener("click", closeWorkItemEditor);
  }

  // Child item editor handlers
  const closeChildBtn = document.getElementById("closeChildItemEditorBtn");
  if (closeChildBtn) {
    closeChildBtn.addEventListener("click", closeChildItemEditor);
  }

  const saveChildBtn = document.getElementById("saveChildItemEditorBtn");
  if (saveChildBtn) {
    saveChildBtn.addEventListener("click", async () => {
      const type = document.getElementById("childItemEditorType").value;
      const id = document.getElementById("childItemEditorId").value;
      const title = document.getElementById("childItemEditorTitle").value;

      if (!title) {
        app.notify("Title is required", "warning");
        return;
      }

      try {
        const typeMap = {
          'priority': '/api/priorities',
          'area': '/api/areas',
          'goal': '/api/goals',
          'template': '/api/work-item-templates',
          'todo': '/api/to-dos',
          'task': '/api/tasks',
          'ticket': '/api/tickets',
          'idea': '/api/ideas'
        };

        const endpoint = typeMap[type];
        if (!endpoint) {
          console.error('Unknown type:', type);
          return;
        }

        // Build payload based on type
        const payload = { title, name: title };

        if (type === 'todo' || type === 'task') {
          // Todos and tasks have: notes, status
          payload.notes = document.getElementById('childItemEditorNotes').value;
          payload.status = document.getElementById('childItemEditorStatus').value;
        } else if (type === 'ticket' || type === 'idea' || type === 'priority') {
          // Tickets, ideas, priorities have: notes (no status)
          payload.notes = document.getElementById('childItemEditorNotes').value;
        } else if (type === 'goal') {
          // Goals have: description, year
          payload.description = document.getElementById('childItemEditorDescription').value;
          const year = document.getElementById('childItemEditorYear').value;
          if (year) payload.year = parseInt(year, 10);
        } else {
          // Areas and templates have: description
          payload.description = document.getElementById('childItemEditorDescription').value;
        }

        console.log('[Save child item] Sending to', endpoint + '/' + id, 'payload:', payload);

        const response = await fetch(`${endpoint}/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': window.APP_CONFIG?.csrfToken
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          console.error('Save failed with status:', response.status);
          const text = await response.text();
          console.error('Response body:', text);
        }

        const result = await response.json();
        console.log('[Save child item] Response:', result);

        if (result.success) {
          app.notify("Item saved!", "success");
          closeChildItemEditor();
          loadWorkItems();
        } else {
          app.notify("Error: " + result.message, "danger");
        }
      } catch (error) {
        console.error("Error saving child item:", error);
        app.notify("Error saving item", "danger");
      }
    });
  }

  initDailiesEventListeners();
  renderCalendar();
  updateDateDisplay();
  loadWorkItems();
  loadPrioritiesAndGoals();
  loadDataSourcesForImport();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDailies);
} else {
  initDailies();
}
