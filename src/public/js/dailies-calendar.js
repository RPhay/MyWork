// Calendar grid, month navigation, day totals and day highlights.
// Split out of dailies.js - see dashboard.ejs for load order.
// dailies.js loads LAST and holds the DOMContentLoaded bootstrap.

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

