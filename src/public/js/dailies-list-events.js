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
      '[data-action="edit-work-item"], [data-action="delete"], [data-action="unlink"], [data-action="unroot"], [data-action="delete-child"], [data-action="cycle-status"], [data-action="cycle-timebox"], [data-action="pick-emoji"], [data-action="toggle-claude"]',
    );
    if (actionBtn) {
      if (actionBtn.dataset.action === "edit-work-item") {
        editWorkItem(actionBtn.dataset.id);
      } else if (actionBtn.dataset.action === "delete") {
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

    // A click expands/collapses a daily that has children - deferred so a
    // rapid double click (which no longer means anything special for a daily
    // row, see the dblclick handler below) does not also toggle it twice on
    // its way through. Child items keep the double-click-to-edit gesture
    // below, which is why the deferred expand still needs cancelling there.
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

    // A daily's own row does nothing on double-click any more, open or closed
    // - the pencil icon opens it now (data-action="edit-work-item"), the same
    // as every other row in the app. Only a CHILD item (a Project, Category,
    // etc. dropped onto the day) still opens this way; it has no pencil icon
    // of its own here.
    const workItemEl = header.closest(".work-item");
    if (workItemEl.classList.contains("child-item-row")) {
      clearTimeout(dailiesClickTimer);          // cancel the pending expand
      editChildItem(workItemEl.dataset.itemType, workItemEl.dataset.workId);
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
    // "Files" belongs in this list, and leaving it out is what made the FIRST
    // Outlook drag of a session do nothing. Outlook hands the first drag over
    // as a temp .ics FILE - types is ["Files"] and nothing else - so none of
    // the text flavours below matched, preventDefault() was never called, and
    // the browser refused the drop outright: no drop event, no handler, no
    // message. Drag the same appointment again and Outlook now also offers
    // text/plain from its cache, which matched, which is why every drop after
    // the first one worked.
    const hasCalendarData =
      types.includes("Files") ||
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
          // A template is never filed UNDER anything. linkChild() here made
          // the daily HOLD the template as a reference - the one arrangement
          // the data model forbids ("Nothing may hold a Template" in
          // CLAUDE.md): no type declares `template` as a hierarchy child, and
          // a reference means editing the day's copy edits the template every
          // other day was built from. Dropping a template anywhere on this
          // rail means the same thing it means on empty space - instantiate
          // it onto the day, as an independent copy.
          instantiateTemplateOnDate(id, dropDate());
          return;
        }
        const choice = await app.askCopyOrReference(e.dataTransfer.getData("name"));
        if (!choice) return;
        const linkId = choice === "copy" ? await cloneForDrop(type, id) : id;
        if (linkId) linkChild(workItemEl.dataset.workId, type, linkId);
        return;
      }

      // Dropped on empty space (not on an existing item)
      const date = dropDate();

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

    // Handle external calendar events from Outlook.
    //
    // Read the DataTransfer SYNCHRONOUSLY and completely, before any await.
    // The event's data is only valid for the duration of the handler, so an
    // await here empties getData() and the drop silently does nothing - which
    // is the shape of "it hung and then nothing happened". File objects, once
    // captured, stay valid afterwards.
    const types = Array.from(e.dataTransfer.types || []);
    const files = Array.from(e.dataTransfer.files || []);
    const read = (t) => {
      try { return e.dataTransfer.getData(t) || ''; } catch { return ''; }
    };

    // Same synchronous-read requirement as calendarText below - a ServiceNow
    // record dragged in from its own browser tab, read here (not further
    // down, after the calendar-file branch's await) so it is still valid
    // when the calendar check below falls through to it.
    const linkPayload = externalLinkDropPayload(e.dataTransfer);

    let calendarText =
      (types.includes('text/calendar') && read('text/calendar')) ||
      (types.includes('text/plain') && read('text/plain')) ||
      '';

    if (!calendarText) {
      const named = types.find((t) => /calendar|ics|event/i.test(t));
      if (named) calendarText = read(named);
    }
    if (!calendarText) calendarText = read('text');

    console.log('[Dailies WorkItems] Drop detected. Types:', types,
      'files:', files.map((f) => `${f.name} (${f.type || 'no type'}, ${f.size}b)`));

    // Outlook hands the FIRST drag of a session over as a file rather than as
    // text - it writes a temp .ics and Chrome blocks the page while Outlook
    // produces it, which is the pause. Nothing read it, so the drop was
    // dropped: no item, no message, and a second drag of the same appointment
    // then worked because Outlook had it cached as text. Read the file.
    if (!looksLikeCalendarText(calendarText) && files.length) {
      const cal = files.find((f) =>
        /\.(ics|vcs)$/i.test(f.name) || /calendar/i.test(f.type));
      if (cal) {
        try {
          calendarText = await cal.text();
        } catch (err) {
          console.error('[Dailies WorkItems] Could not read dropped file', cal.name, err);
        }
      }
    }

    console.log('[Dailies WorkItems] Calendar text:', calendarText?.substring(0, 100));

    if (looksLikeCalendarText(calendarText)) {
      const event = parseCalendarEvent(calendarText);
      console.log('[Dailies WorkItems] Parsed event:', event);

      if (event.title) {
        const dateInput = document.getElementById('selectedDate');
        const date = dateInput?.value || new Date().toISOString().split('T')[0];
        await createWorkItemFromCalendarEvent(event, date);
        return;
      }
      app.notify('That calendar item had no subject, so there was nothing to name it', 'warning');
      return;
    }

    // Not a calendar item - a ServiceNow record dragged in from its own
    // browser tab, maybe. Same attach shape as an internal type+id drop
    // above: onto a work item if one was dropped on, onto the day itself
    // otherwise - just with a freshly created id instead of a dragged one.
    if (linkPayload) {
      const created = await createServiceNowRecord(linkPayload);
      if (created) {
        if (workItemEl) {
          await linkChild(workItemEl.dataset.workId, 'servicenow', created.id);
        } else {
          await putEntityOnDay(created.id, dropDate());
        }
      }
      return;
    }

    // Say so. Doing nothing at all is indistinguishable from the app being
    // broken, and it was: an unreadable drop left no item and no explanation.
    if (types.length || files.length) {
      const what = files.length
        ? files.map((f) => f.name).join(', ')
        : types.join(', ');
      console.warn('[Dailies WorkItems] Nothing usable in the drop:', { types, files: files.map((f) => f.name) });
      app.notify(`Could not read that drop (${what}) - drag the appointment from the calendar view`, 'warning');
    }
  });
}


// Which day a drop lands on: whatever the rail is showing.
function dropDate() {
  const dateInput = document.getElementById("selectedDate");
  return dateInput?.value || new Date().toISOString().split("T")[0];
}

// What counts as calendar data, wherever it came from - a text/plain payload,
// a named calendar flavour, or the contents of a dropped .ics file.
function looksLikeCalendarText(text) {
  return !!text && (
    text.includes('BEGIN:VEVENT') ||
    text.includes('DTSTART') ||
    text.includes('When:') ||
    text.includes('Location:') ||
    text.includes('Organizer:'));
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

