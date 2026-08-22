// Context menus: work-item menu, calendar drop menu, calendar day menu.
// Split out of dailies.js - see dashboard.ejs for load order.
// dailies.js loads LAST and holds the DOMContentLoaded bootstrap.

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
    const response = await app.fetchRaw(endpoint, {
      method: "POST",
      
      body: JSON.stringify({ date }) });

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
      const response = await app.fetchRaw(endpoint, {
        method: "PUT",
        
        body: JSON.stringify({ color }) });

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
      const response = await app.fetchRaw(`/api/day-highlights/${date}`, {
        method: "DELETE" });

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

