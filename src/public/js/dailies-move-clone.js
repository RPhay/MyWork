// The Move/Clone modal and its own month grid. Split out of dailies.js -
// see dashboard.ejs for load order. Calls buildCalendarHtml(), which stays
// in dailies.js; that is safe because the call happens at runtime, long
// after every classic script has executed.

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

function openMoveCloneModal(dailyId, mode) {
  document.getElementById("moveCloneWorkId").value = dailyId;
  document.getElementById("moveCloneMode").value = mode;
  document.getElementById("moveCloneModalTitle").textContent =
    mode === "clone" ? "Clone Daily To" : "Move Daily To";
  document.getElementById("confirmMoveCloneBtn").textContent =
    mode === "clone" ? "Clone" : "Move";
  document.getElementById("moveCloneHint").textContent =
    mode === "clone" ? "Select one or more dates." : "Select a date.";

  const initialDate =
    document.getElementById("selectedDate")?.value ||
    app.localISODate();
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

async function postWorkItemDateAction(dailyId, action, date) {
  const response = await app.fetchRaw(`/api/dailies/${dailyId}/${action}`, {
    method: "POST",
    
    body: JSON.stringify({ date }) });
  return response.json();
}

async function confirmMoveClone() {
  const dailyId = document.getElementById("moveCloneWorkId").value;
  const mode = document.getElementById("moveCloneMode").value;

  if (mode === "clone") {
    const dates = Array.from(moveCloneSelectedDates || []);
    if (dates.length === 0) {
      app.notify("Pick at least one date", "warning");
      return;
    }

    try {
      for (const date of dates) {
        const result = await postWorkItemDateAction(dailyId, "clone", date);
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
    const result = await postWorkItemDateAction(dailyId, "move", date);
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
