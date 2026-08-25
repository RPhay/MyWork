let calendarViewYear;
let calendarViewMonth; // 0-indexed
let expandedWorkItems = new Set();
let currentWorkItems = [];
// Records sitting on the day itself, with no work item wrapped round them.
let currentDayRootEntities = [];
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
    const response = await app.fetchRaw("/api/work", {
      method: "POST",
      
      body: JSON.stringify({ ...data, date }) });

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
    const response = await app.fetchRaw("/api/work", {
      method: "POST",
      
      body: JSON.stringify({ ...data, date }) });

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
    const response = await app.fetchRaw(`/api/work/${id}/notes`, {
      method: "PATCH",
      
      body: JSON.stringify({ notes }) });

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



async function cycleWorkItemStatus(workId, currentStatus) {
  const currentIndex = STATUS_CYCLE.indexOf(currentStatus);
  const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length];

  try {
    const response = await app.fetchRaw(`/api/work/${workId}/status`, {
      method: "PATCH",
      
      body: JSON.stringify({ status: nextStatus }) });

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
          statusBadge.className = `status-cell work-item-status-badge ${statusRoleClass(nextStatus)}`;
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

// The same ladder the Time Box field on every type offers: 15m, 30m, 45m, 1h,
// 1.5h, 2h. Stored in MINUTES here, which is what work_items.time_box_minutes
// has always held; null means none.
// "1h" rather than "60m", matching the Time Box field's own wording.
function formatTimeBox(minutes) {
  if (!minutes) return 'No time box';
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}

const WORK_ITEM_TIME_BOX_CYCLE = [null, 15, 30, 45, 60, 90, 120];

async function cycleWorkItemTimeBox(workId, currentMinutes) {
  const currentIndex = WORK_ITEM_TIME_BOX_CYCLE.indexOf(currentMinutes);
  const nextMinutes =
    WORK_ITEM_TIME_BOX_CYCLE[
      (currentIndex + 1) % WORK_ITEM_TIME_BOX_CYCLE.length
    ];

  try {
    const response = await app.fetchRaw(`/api/work/${workId}/timebox`, {
      method: "PATCH",
      
      body: JSON.stringify({ time_box_minutes: nextMinutes }) });

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
    const response = await app.fetchRaw(`/api/work/${workId}/claude`, {
      method: "PATCH",
      
      body: JSON.stringify({}) });

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
  // CSS-only expand/collapse (children already in the DOM, see
  // renderWorkItemsList) - no re-render, matching areas.js's toggleAreaNode.
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
  // ONE path for every type. The seven per-type junctions could not hold a type
  // invented later, and - the reason this matters here - they have no order
  // column, so a day's children could never be reordered through them.
  const path = 'entities';

  try {
    const response = await app.fetchRaw(`/api/work/${workId}/${path}/${id}`, {
      method: "POST" });
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
// askCopyOrReference now lives in main.js as app.askCopyOrReference, so the
// Templates page asks the same question in the same words.

// Type slug for the clone endpoint. Dailies names things in the singular and
// those names are not always the type slug (`todo` vs `to_do`).
const DROP_TYPE_SLUG = { todo: "to_do" };

// Makes an independent copy of a dropped record - the row plus everything
// nested under it - and returns the new id to link instead of the original.
async function cloneForDrop(type, id) {
  const slug = DROP_TYPE_SLUG[type] || type;
  try {
    const response = await app.fetchRaw(`/api/entities/${slug}/${id}/clone`, {
      method: "POST" });
    const result = await response.json();
    if (!result.success) throw new Error(result.message);
    return result.data.id;
  } catch (error) {
    app.notify(`Could not copy: ${error.message}`, "danger");
    return null;
  }
}

// Put a record on the day itself, with no work item wrapped round it.
async function putEntityOnDay(entityId, date) {
  try {
    const response = await app.fetchRaw(`/api/work/date/${date}/roots/${entityId}`, {
      method: "POST" });
    const result = await response.json();
    if (!result.success) {
      app.notify("Error: " + result.message, "danger");
      return;
    }
    loadWorkItems();
  } catch (error) {
    console.error("Error putting a record on the day:", error);
    app.notify("Could not put that on the day", "danger");
  }
}

// Take it off the day. The record itself is untouched.
async function takeEntityOffDay(entityId) {
  const date = document.getElementById("selectedDate")?.value;
  if (!date) return;
  try {
    const response = await app.fetchRaw(`/api/work/date/${date}/roots/${entityId}`, {
      method: "DELETE" });
    const result = await response.json();
    if (!result.success) {
      app.notify("Error: " + result.message, "danger");
      return;
    }
    loadWorkItems();
  } catch (error) {
    console.error("Error taking a record off the day:", error);
    app.notify("Could not take that off the day", "danger");
  }
}

// A daily to group work under. Records no longer NEED one - they can sit on the
// day - so this exists for when you want one, rather than being the only way in.
async function addDaily() {
  const date = document.getElementById("selectedDate")?.value
    || new Date().toISOString().split("T")[0];
  try {
    const response = await app.fetchRaw("/api/work", {
      method: "POST",
      body: JSON.stringify({ date, title: "New daily" }) });
    const result = await response.json();
    if (!result.success) {
      app.notify("Error: " + result.message, "danger");
      return;
    }
    await loadWorkItems();
    // Straight into its editor, so it can be named without hunting for it -
    // the same thing creating a row on a typed page does.
    editWorkItem(result.data.id);
  } catch (error) {
    console.error("Error adding a daily:", error);
    app.notify("Could not add a daily", "danger");
  }
}

async function createWorkItemFromChild(type, id, name, date, asCopy = false) {
  try {
    const response = await app.fetchRaw("/api/work", {
      method: "POST",
      
      body: JSON.stringify({ date, title: name }) });

    const result = await response.json();
    if (!result.success) {
      app.notify("Error: " + result.message, "danger");
      return;
    }

    const linkId = asCopy ? await cloneForDrop(type, id) : id;
    if (linkId) await linkChild(result.data.id, type, linkId);
  } catch (error) {
    console.error("Error creating work item:", error);
    app.notify("Error creating work item", "danger");
  }
}

async function unlinkChild(workId, type, id) {
  const path = 'entities';

  try {
    const response = await app.fetchRaw(`/api/work/${workId}/${path}/${id}`, {
      method: "DELETE" });
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
    // Templates are entities now, so instantiation goes through the generic
    // endpoint. It creates the work item and gives it an independent COPY of
    // everything the template holds - a template is never a reference.
    const response = await app.fetchRaw(
      `/api/entities/template/${templateId}/instantiate`,
      {
        method: "POST",
        
        body: JSON.stringify({ date }) },
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

function initDailiesEventListeners() {
  console.log("[Dailies] initDailiesEventListeners called");
  const calendarEl = document.getElementById("calendar");
  console.log("[Dailies] Calendar element found:", !!calendarEl);

  // "+ Add" and the picker chain it fed (openNewWorkForm, openAddItemPicker,
  // loadItemsForModal, loadItemsByType, addItemToDailies) are gone for good,
  // along with the #picker-pane handler - that element is in no view. "+ Daily"
  // below is NOT that button coming back: it creates a daily to group work
  // under, and nothing has to go through one any more.
  const addDailyBtn = document.getElementById("addDailyBtn");
  if (addDailyBtn) {
    addDailyBtn.addEventListener("click", addDaily);
  }

  const importOutlookEmailsBtn = document.getElementById("importOutlookEmailsBtn");
  if (importOutlookEmailsBtn) {
    importOutlookEmailsBtn.addEventListener("click", importSelectedOutlookEmails);
  }

  initWorkItemsListEventListeners();
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
      const response = await app.fetchRaw("/api/work-items", {
        method: "POST",
        
        body: JSON.stringify(workItem) });

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

  // Setup inner split-pane (Dailies | Editor)
  dailiesSplitPane = new SplitPane("dailiesSplitPane", "dailiesCenterPane", "dailiesDivider", "workItemEditorPane", 66.66);

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
        const response = await app.fetchRaw(`/api/work/${workId}`, {
          method: "PUT",
          
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
          'category': '/api/areas',
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

        // Build payload from only the fields this type actually has
        const payload = { title, name: title };

        (CHILD_ITEM_FIELD_MAP[type] || []).forEach((field) => {
          if (field === 'notes') {
            payload.notes = document.getElementById('childItemEditorNotes').value;
          } else if (field === 'description') {
            payload.description = document.getElementById('childItemEditorDescription').value;
          } else if (field === 'status') {
            payload.status = document.getElementById('childItemEditorStatus').value;
          } else if (field === 'year') {
            const year = document.getElementById('childItemEditorYear').value;
            if (year) payload.year = parseInt(year, 10);
          }
        });

        console.log('[Save child item] Sending to', endpoint + '/' + id, 'payload:', payload);

        const response = await app.fetchRaw(`${endpoint}/${id}`, {
          method: 'PUT',
          
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
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDailies);
} else {
  initDailies();
}
