let calendarViewYear;
let calendarViewMonth; // 0-indexed
let expandedWorkItems = new Set();
let currentWorkItems = [];

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
    time_box_minutes: event.duration || null,
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

  container.innerHTML = items
    .map((item) => {
      const isExpanded = expandedWorkItems.has(String(item.id));
      const children = [
        ...(item.priorities || []).map((p) => ({
          type: "priority",
          id: p.id,
          label: p.path || p.title,
          icon: APP_ICONS.project,
        })),
        ...(item.goals || []).map((g) => ({
          type: "goal",
          id: g.id,
          label: g.name,
          icon: APP_ICONS.goal,
        })),
        ...(item.areas || []).map((a) => ({
          type: "area",
          id: a.id,
          label: a.path || a.name,
          icon: APP_ICONS.area,
        })),
      ];

      const childrenHtml =
        children.length > 0
          ? children
              .map(
                (c) => `
          <div class="child-item">
            <i class="bi ${c.icon} text-muted"></i>
            <span>${app.escapeHtml(c.label)}</span>
            <button class="btn btn-sm btn-link text-danger child-remove p-0" data-action="unlink" data-type="${c.type}" data-child-id="${c.id}" title="Remove" aria-label="Remove">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
        `,
              )
              .join("")
          : '<div class="text-muted small">Drag a project, goal, or category here</div>';

      const hasChildren = children.length > 0;

      return `
      <div class="work-item ${isExpanded ? "expanded" : ""}" data-work-id="${item.id}" data-has-children="${hasChildren}">
        <div class="work-item-header" draggable="true" data-status="${item.status}" title="${hasChildren ? "Click to expand/collapse, double-click to edit; drag to reorder" : "Click to change status, double-click to edit; drag to reorder"}">
          <span class="work-item-title-cell">
            <i class="bi bi-chevron-right work-item-toggle" data-action="toggle-expand" title="Expand/collapse"></i>
            <i class="bi ${APP_ICONS.workItem} text-muted" title="Work Item"></i>
            <span class="work-item-title">${app.escapeHtml(item.title)}</span>
            ${item.notes ? `<i class="bi bi-sticky text-muted" title="${app.escapeHtml(item.notes)}"></i>` : ""}
          </span>
          <span class="work-item-emoji" data-action="pick-emoji" data-id="${item.id}" title="Oh! Click to pick an emoji">${app.escapeHtml(item.emoji || "")}</span>
          <span class="badge bg-${item.status === "Complete" ? "success" : item.status === "In Progress" ? "warning" : "secondary"} work-item-status-badge" data-action="cycle-status" data-id="${item.id}" title="Click to change status">${item.status}</span>
          <span class="badge bg-light text-dark border work-item-timebox-badge" data-action="cycle-timebox" data-id="${item.id}" data-minutes="${item.time_box_minutes || ""}" title="Click to change time box">${item.time_box_minutes ? item.time_box_minutes + "m" : "No time box"}</span>
          <span class="work-item-actions">
            <button class="btn btn-sm btn-danger" data-action="delete" data-id="${item.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
          </span>
        </div>
        <div class="work-item-children">${childrenHtml}</div>
      </div>
    `;
    })
    .join("");
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

function openNewWorkForm() {
  document.getElementById("workId").value = "";
  document.getElementById("workForm").reset();
  updateEmojiFieldButton("workEmojiBtn", "");
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
      const modalEl = document.getElementById("workModal");
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
      loadWorkItems();
      loadCalendarDayTotals(calendarViewYear, calendarViewMonth);
    } else {
      app.notify("Error: " + result.message, "danger");
    }
  } catch (error) {
    console.error("Error:", error);
    app.notify("Error saving work item", "danger");
  }
}

async function editWorkItem(workId) {
  try {
    const response = await fetch(`/api/work/${workId}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    const item = result.data;

    document.getElementById("workItemEditorId").value = item.id;
    document.getElementById("workItemEditorTitle").value = item.title;
    document.getElementById("workItemEditorDescription").value = item.description;
    document.getElementById("workItemEditorEmoji").value = item.emoji || "";
    document.getElementById("workItemEditorStatus").value = item.status || "";
    document.getElementById("workItemEditorTimeBox").value = item.time_box_minutes ? (item.time_box_minutes / 60).toFixed(1) : "";
    updateEmojiFieldButton("workItemEditorEmojiBtn", item.emoji || "");

    // Show split-pane editor
    const editorPane = document.getElementById("workItemEditorPane");
    if (editorPane) {
      editorPane.classList.remove("hidden");
    }
  } catch (error) {
    console.error("Error:", error);
    app.notify("Error loading work item", "danger");
  }
}

function closeWorkItemEditor() {
  const editorPane = document.getElementById("workItemEditorPane");
  if (editorPane) {
    editorPane.classList.add("hidden");
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
      loadWorkItems();
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
      // Update calendar total immediately without full reload
      const selectedDate = document.getElementById("selectedDate")?.value;
      if (selectedDate) {
        updateCalendarDayTotal(selectedDate);
      }
      loadWorkItems();
    } else {
      app.notify("Error: " + result.message, "danger");
    }
  } catch (error) {
    console.error("Error updating time box:", error);
    app.notify("Error updating time box", "danger");
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
      '[data-action="delete"], [data-action="unlink"], [data-action="cycle-status"], [data-action="cycle-timebox"], [data-action="pick-emoji"]',
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

    // Click on work item to open editor
    const workItemEl = header.closest(".work-item");
    editWorkItem(workItemEl.dataset.workId);
  });

  container.addEventListener("dblclick", (e) => {
    if (e.target.closest("[data-action]")) return;
    const header = e.target.closest(".work-item-header");
    if (!header) return;
    editWorkItem(header.closest(".work-item").dataset.workId);
  });

  container.addEventListener("contextmenu", (e) => {
    const workItemEl = e.target.closest(".work-item");
    if (!workItemEl) return;
    e.preventDefault();
    showWorkItemContextMenu(e.clientX, e.clientY, workItemEl.dataset.workId);
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

  container.addEventListener("dragover", (e) => {
    const workItemEl = e.target.closest(".work-item");
    if (workItemEl) {
      e.preventDefault();

      if (currentDragType === "work-item") {
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
      } else {
        // Linking a project/goal/category/template onto this work item
        workItemEl.classList.remove(
          "drop-indicator-before",
          "drop-indicator-after",
        );
        workItemEl.classList.add("drag-over");
      }
    } else {
      // Dropping on empty space either reorders to the end, or (for a template) creates a new item
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
      const hasInternalDrag =
        currentDragType && !["work-item"].includes(currentDragType);

      if (hasCalendarData || hasInternalDrag || types.length > 0) {
        e.preventDefault();
        container.classList.add("work-items-drop-target");
      }
    }
  });

  container.addEventListener("dragleave", (e) => {
    const workItemEl = e.target.closest(".work-item");
    if (workItemEl && !workItemEl.contains(e.relatedTarget)) {
      workItemEl.classList.remove(
        "drag-over",
        "drop-indicator-before",
        "drop-indicator-after",
      );
    }
    if (!container.contains(e.relatedTarget)) {
      container.classList.remove("work-items-drop-target");
    }
  });

  container.addEventListener("drop", async (e) => {
    e.preventDefault();
    container.classList.remove("work-items-drop-target");

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

  menu.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-menu-action]");
    if (!btn || !contextMenuWorkItemId) {
      hideWorkItemContextMenu();
      return;
    }

    const workItemId = contextMenuWorkItemId;
    hideWorkItemContextMenu();

    if (btn.dataset.menuAction === "edit-notes") {
      openWorkItemNotesModal(workItemId);
    } else if (btn.dataset.menuAction === "create-todo") {
      createToDoFromWorkItem(workItemId);
    } else if (btn.dataset.menuAction === "move-to") {
      openMoveCloneModal(workItemId, "move");
    } else if (btn.dataset.menuAction === "clone-to") {
      openMoveCloneModal(workItemId, "clone");
    }
  });

  document.addEventListener("click", (e) => {
    if (!menu.classList.contains("d-none") && !menu.contains(e.target)) {
      hideWorkItemContextMenu();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideWorkItemContextMenu();
  });

  document
    .getElementById("saveWorkNotesBtn")
    .addEventListener("click", saveWorkItemNotes);
  document
    .getElementById("confirmMoveCloneBtn")
    .addEventListener("click", confirmMoveClone);

  document
    .getElementById("moveCloneCalendar")
    .addEventListener("click", (e) => {
      const navBtn = e.target.closest("[data-cal-nav]");
      if (navBtn) {
        changeMoveCloneCalendarMonth(navBtn.dataset.calNav === "prev" ? -1 : 1);
        return;
      }
      const dayCell = e.target.closest("[data-date]");
      if (dayCell) selectMoveCloneDate(dayCell.dataset.date);
    });
}

function initDailiesEventListeners() {
  console.log("[Dailies] initDailiesEventListeners called");
  const calendarEl = document.getElementById("calendar");
  console.log("[Dailies] Calendar element found:", !!calendarEl);

  document
    .getElementById("addWorkItemBtn")
    .addEventListener("click", openNewWorkForm);
  document
    .getElementById("saveWorkBtn")
    .addEventListener("click", saveWorkItem);
  document
    .getElementById("importOutlookEmailsBtn")
    ?.addEventListener("click", importSelectedOutlookEmails);

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

  calendarEl.addEventListener("click", (e) => {
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
  const outerSplitPane = new SplitPane("dailiesOuterSplitPane", "dailiesCalendarPane", "dailiesOuterDivider", "dailiesSplitPane", 25);

  // Setup inner split-pane (Work Items | Editor)
  const splitPane = new SplitPane("dailiesSplitPane", "dailiesCenterPane", "dailiesDivider", "workItemEditorPane", 66.66);

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
