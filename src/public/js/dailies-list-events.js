// Delegated event wiring for the work-items list, incl. its drag/drop.
// Split out of dailies.js - see dashboard.ejs for load order.
// dailies.js loads LAST and holds the DOMContentLoaded bootstrap.

function initWorkItemsListEventListeners() {
  const container = document.getElementById("workItemsList");
  const centerPane = document.getElementById("dailiesCenterPane");

  app.bindInlineRename(
    container,
    ".work-item-title",
    async (newTitle, titleEl) => {
      const dailyId = titleEl.closest(".work-item").dataset.workId;
      try {
        const response = await app.fetchRaw(`/api/dailies/${dailyId}`, {
          method: "PUT",
          
          body: JSON.stringify({ title: newTitle }) });
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

  container.addEventListener("click", async (e) => {
    const actionBtn = e.target.closest(
      '[data-action="delete"], [data-action="unlink"], [data-action="unroot"], [data-action="delete-child"], [data-action="cycle-status"], [data-action="cycle-timebox"], [data-action="pick-emoji"], [data-action="toggle-claude"]',
    );
    if (actionBtn) {
      if (actionBtn.dataset.action === "delete") {
        deleteWorkItem(actionBtn.dataset.id);
      } else if (actionBtn.dataset.action === "unroot") {
        // On the DAY rather than inside a work item, so it comes off the day.
        // Same promise as unlink: the record itself is untouched.
        await takeEntityOffDay(actionBtn.dataset.childId);
      } else if (actionBtn.dataset.action === "unlink") {
        // A REFERENCE: take it off the day and leave the record alone.
        const row = actionBtn.closest(".child-item-row");
        unlinkChild(
          row?.dataset.parentWorkId,
          actionBtn.dataset.type,
          actionBtn.dataset.childId,
        );
      } else if (actionBtn.dataset.action === "delete-child") {
        // A COPY: it exists only here, so removing it means deleting it - and a
        // copy owns its children, which go with it. Deleting is soft, so it can
        // be brought back from Recently Deleted.
        const ok = await app.confirm({
          title: 'Delete this copy',
          message: 'Delete this copy and everything inside it? The original is not affected.',
          confirmText: 'Delete',
        });
        if (!ok) return;
        const slug = actionBtn.dataset.type;
        const id = actionBtn.dataset.childId;
        const res = await app.fetchRaw(`/api/entities/${slug}/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          app.notify('Could not delete that', 'danger');
          return;
        }
        loadWorkItems();
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

    if (e.target.closest('[data-action="delete-selected-dailies"]')) {
      await deleteSelectedDailies();
      return;
    }
    if (e.target.closest('[data-action="clear-dailies-selection"]')) {
      clearDailiesSelection();
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

    const workItemEl = header.closest(".work-item");

    // Same gestures as every typed page: ONE click opens and closes the row,
    // TWO open the editor. A single click used to open the editor here, so
    // there was no way to look inside an item without loading it - and it was
    // inconsistent with the rest of the app.
    //
    // The expand is deferred so a double click does not toggle the row open and
    // shut on its way to the editor.
    if (!workItemEl.classList.contains("child-item-row")) {
      if (handleDailiesSelectionClick(e, workItemEl)) return;   // modifier: selection only
    }
    clearTimeout(dailiesClickTimer);
    dailiesClickTimer = setTimeout(() => {
      if (workItemEl.dataset.hasChildren === "true") toggleWorkItem(workItemEl);
    }, DAILIES_DOUBLE_CLICK_MS);
  });

  // Escape clears, Delete removes - the same keys as the typed pages.
  document.addEventListener('keydown', async (e) => {
    if (!dailiesSelected.size) return;
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (e.key === 'Escape') { clearDailiesSelection(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      await deleteSelectedDailies();
    }
  });

  // A day shows REFERENCES to records that live on other pages. Editing one
  // there, or rearranging a tree it contains, has to show up here without a
  // reload - that is what a reference means.
  document.addEventListener('entity-saved', () => loadWorkItems());
  document.addEventListener('entity-structure-changed', () => loadWorkItems());

  container.addEventListener("dblclick", (e) => {
    const notesCell = e.target.closest('[data-action="edit-notes"]');
    if (notesCell) {
      openWorkItemNotesModal(notesCell.dataset.id);
      return;
    }
    if (e.target.closest("[data-action]")) return;
    const header = e.target.closest(".work-item-header");
    if (!header) return;
    clearTimeout(dailiesClickTimer);          // cancel the pending expand

    const workItemEl = header.closest(".work-item");
    if (workItemEl.classList.contains("child-item-row")) {
      editChildItem(workItemEl.dataset.itemType, workItemEl.dataset.workId);
    } else {
      editWorkItem(workItemEl.dataset.workId);
    }
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
    e.dataTransfer.effectAllowed = DRAG_EFFECT_ALLOWED;

    // A CHILD row reorders among its own siblings and nowhere else. It carries
    // its parent and its depth so the drop can refuse anything that would move
    // it up to the root or push a root item down into a tree - the one rule
    // asked for here, because those two moves mean different things (a child is
    // a reference to a record that lives on another page).
    if (workItemEl.classList.contains("child-item-row")) {
      currentDragType = "work-item-child";
      e.dataTransfer.setData("type", "work-item-child");
      e.dataTransfer.setData("id", workItemEl.dataset.childId);
      e.dataTransfer.setData("parent-work-id", workItemEl.dataset.parentWorkId || '');
      e.dataTransfer.setData("depth", workItemEl.dataset.depth || '0');
    } else {
      currentDragType = "work-item";
      e.dataTransfer.setData("type", "work-item");
      e.dataTransfer.setData("id", workItemEl.dataset.workId);
    }
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
      const zone = dropZone(e, workItemEl);
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

    // A child reorders among its OWN siblings. Dropped anywhere else - on a
    // root item, or inside a different parent - it is refused rather than
    // silently re-homed: moving a child out to the root and moving a root item
    // down into a tree are the two things that must not happen here.
    if (type === "work-item-child") {
      const targetRow = e.target.closest(".child-item-row");
      const parentWorkId = e.dataTransfer.getData("parent-work-id");
      const depth = e.dataTransfer.getData("depth");
      clearWorkItemDropIndicators(container);

      if (!targetRow) {
        app.notify('A row inside a day can only be reordered among its own level', 'info');
        return;
      }
      if (targetRow.dataset.parentWorkId !== parentWorkId || targetRow.dataset.depth !== depth) {
        app.notify('That would move it to a different level - reorder it where it is instead', 'info');
        return;
      }
      if (targetRow.dataset.childId === id) return;

      await reorderDayChildren(parentWorkId, id, targetRow.dataset.childId, dropZone(e, targetRow));
      return;
    }

    if (type === "work-item") {
      const targetId =
        workItemEl && workItemEl.dataset.workId !== id
          ? workItemEl.dataset.workId
          : null;
      const position = workItemEl
        ? dropZone(e, workItemEl)
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
        if (type === "template") {
          linkChild(workItemEl.dataset.workId, type, id);
          return;
        }
        const choice = await app.askCopyOrReference(e.dataTransfer.getData("name"));
        if (!choice) return;
        const linkId = choice === "copy" ? await cloneForDrop(type, id) : id;
        if (linkId) linkChild(workItemEl.dataset.workId, type, linkId);
        return;
      }

      // Dropped on empty space (not on an existing item)
      const dateInput = document.getElementById("selectedDate");
      const date = dateInput?.value || new Date().toISOString().split("T")[0];

      if (type === "template") {
        // A template dropped on a day is always a full copy, including its
        // children - that is what a template is for. Nothing done to the copy
        // reaches back into the template.
        instantiateTemplateOnDate(id, date);
      } else if (type) {
        const name = e.dataTransfer.getData("name");
        const choice = await app.askCopyOrReference(name);
        if (!choice) return;                       // cancelled
        // Onto the DAY, not into an invented work item. Dropping a record here
        // used to create a work item named after it, whether or not one was
        // wanted - a day is a place, not a container you have to create first.
        // Drop onto a daily's row to put it inside that daily instead, and use
        // "+ Daily" when you do want one to group things under.
        const entityId = choice === "copy" ? await cloneForDrop(type, id) : id;
        if (!entityId) return;
        await putEntityOnDay(entityId, date);
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
    const dailyId = contextMenuWorkItemId;
    hideWorkItemContextMenu();

    if (action === "add-project") showProjectSelector(dailyId);
    else if (action === "add-area") showAreaSelector(dailyId);
    else if (action === "add-goal") showGoalSelector(dailyId);
    else if (action === "add-todo") showTodoSelector(dailyId);
    else if (action === "add-task") showTaskSelector(dailyId);
    else if (action === "add-ticket") showTicketSelector(dailyId);
    else if (action === "add-idea") showIdeaSelector(dailyId);
    else if (action === "create-project") createAndEditItem("priority", dailyId);
    else if (action === "create-area") createAndEditItem("category", dailyId);
    else if (action === "create-goal") createAndEditItem("goal", dailyId);
    else if (action === "create-todo") createAndEditItem("todo", dailyId);
    else if (action === "create-task") createAndEditItem("task", dailyId);
    else if (action === "create-ticket") createAndEditItem("ticket", dailyId);
    else if (action === "create-idea") createAndEditItem("idea", dailyId);
    else if (action === "move-to") openMoveCloneModal(dailyId, "move");
    else if (action === "clone-to") openMoveCloneModal(dailyId, "clone");
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

