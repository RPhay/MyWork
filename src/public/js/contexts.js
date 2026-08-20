let allContexts = [];
let allFolders = [];
let expandedFolders = new Set();
let selectedContextId = null;

// ---- Rendering ----

const DEFAULT_CONTEXT_ICON = "bi-collection";

function contextRowHtml(context) {
  return `
    <div class="context-row ${String(context.id) === String(selectedContextId) ? "selected" : ""}"
         data-context-id="${context.id}" draggable="true">
      <button type="button" class="icon-picker-trigger" data-action="pick-icon" data-entity-type="context" data-id="${context.id}" title="Change icon" aria-label="Change icon">
        <i class="bi ${context.icon || DEFAULT_CONTEXT_ICON}"></i>
      </button>
      <span class="context-row-title">${app.escapeHtml(context.name)}</span>
      ${!context.db_host ? `<i class="bi bi-house-fill text-primary" title="Home database" style="font-size:.8rem;flex-shrink:0"></i>` : ""}
      ${
        context.userName
          ? `<span class="badge bg-light text-dark border context-row-owner" title="Owner">${app.escapeHtml(context.userName)}</span>`
          : `<span class="badge bg-danger context-row-owner" title="No owner assigned"><i class="bi bi-exclamation-triangle"></i> No owner</span>`
      }
      <span class="context-row-actions">
        <button class="btn btn-sm btn-danger" data-action="delete" data-id="${context.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
      </span>
    </div>`;
}

function folderNodeHtml(folder, foldersByParent, contextsByFolder) {
  const childFolders = foldersByParent.get(folder.id) || [];
  const childContexts = contextsByFolder.get(folder.id) || [];
  const isExpanded = expandedFolders.has(String(folder.id));
  const hasChildren = childFolders.length > 0 || childContexts.length > 0;

  const chevron = hasChildren
    ? `<i class="bi bi-chevron-${isExpanded ? "down" : "right"} me-1" style="font-size:.75rem"></i>`
    : `<span style="display:inline-block;width:14px"></span>`;

  const childrenHtml = isExpanded
    ? `
    <div class="context-folder-children">
      ${childFolders.map((f) => folderNodeHtml(f, foldersByParent, contextsByFolder)).join("")}
      ${childContexts.map((c) => contextRowHtml(c)).join("")}
    </div>`
    : "";

  // A custom icon shows statically; without one, keep the folder-fill/folder-open-fill
  // toggle that reflects expand state (no open/closed variant exists for arbitrary icons).
  const folderIconClass =
    folder.icon || `bi-folder${isExpanded ? "-open" : ""}-fill`;
  const folderIconColorClass = folder.icon ? "" : " text-warning";

  return `
    <div class="context-folder-node" data-folder-id="${folder.id}">
      <div class="context-folder-header" draggable="true" data-folder-id="${folder.id}">
        ${chevron}
        <button type="button" class="icon-picker-trigger" data-action="pick-icon" data-entity-type="folder" data-id="${folder.id}" title="Change icon" aria-label="Change icon">
          <i class="bi ${folderIconClass}${folderIconColorClass}"></i>
        </button>
        <span class="context-folder-title" style="flex:1;font-weight:500">${app.escapeHtml(folder.name)}</span>
        <span class="context-row-actions">
          <button class="btn btn-sm btn-info" data-action="edit-folder" data-id="${folder.id}" title="Rename" aria-label="Rename"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-danger" data-action="delete-folder" data-id="${folder.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
        </span>
      </div>
      ${childrenHtml}
    </div>`;
}

function renderContextsList() {
  const container = document.getElementById("contextsList");

  const foldersByParent = app.groupByParent(allFolders);
  const contextsByFolder = new Map();
  allContexts.forEach((c) => {
    const key = c.folder_id || null;
    if (!contextsByFolder.has(key)) contextsByFolder.set(key, []);
    contextsByFolder.get(key).push(c);
  });

  const topFolders = foldersByParent.get(null) || [];
  const topContexts = contextsByFolder.get(null) || [];

  if (topFolders.length === 0 && topContexts.length === 0) {
    container.innerHTML =
      '<p class="text-center text-muted">No contexts yet</p>';
    return;
  }

  container.innerHTML =
    topFolders
      .map((f) => folderNodeHtml(f, foldersByParent, contextsByFolder))
      .join("") + topContexts.map((c) => contextRowHtml(c)).join("");
}

async function loadContexts() {
  try {
    const [ctxRes, folderRes] = await Promise.all([
      fetch("/api/contexts"),
      fetch("/api/context-folders").catch(() => null),
    ]);
    if (!ctxRes.ok) throw new Error(`HTTP ${ctxRes.status}`);
    const ctxResult = await ctxRes.json();
    const folderResult =
      folderRes && folderRes.ok ? await folderRes.json() : { success: false };

    if (ctxResult.success) {
      allContexts = ctxResult.data;
      allFolders = folderResult.success ? folderResult.data : [];
      renderContextsList();
    }
  } catch (error) {
    console.error("Error loading contexts:", error);
    document.getElementById("contextsList").innerHTML =
      '<p class="text-center text-danger">Error loading contexts</p>';
  }
}

function openNewContextForm() {
  document.getElementById("contextForm").reset();
}

async function saveContext() {
  const data = {
    name: document.getElementById("contextName").value,
  };

  try {
    const response = await app.fetchRaw("/api/contexts", {
      method: "POST",
      
      body: JSON.stringify(data) });

    const result = await response.json();
    if (result.success) {
      app.notify("Context created!", "success");
      bootstrap.Modal.getInstance(
        document.getElementById("contextModal"),
      ).hide();
      loadContexts();
    } else {
      app.notify("Error: " + result.message, "danger");
    }
  } catch (error) {
    console.error("Error:", error);
    app.notify("Error creating context", "danger");
  }
}

async function deleteContext(contextId) {
  if (
    !(await app.confirm(
      "Delete this context? Data belonging to it is not deleted, but will no longer be reachable unless you reassign it.",
    ))
  )
    return;

  try {
    const response = await app.fetchRaw(`/api/contexts/${contextId}`, {
      method: "DELETE" });

    const result = await response.json();
    if (result.success) {
      app.notify("Context deleted", "success");
      if (String(selectedContextId) === String(contextId)) {
        selectedContextId = null;
        showContextPanel(null);
      }
      loadContexts();
    } else {
      app.notify("Error: " + result.message, "danger");
    }
  } catch (error) {
    console.error("Error:", error);
    app.notify("Error deleting context", "danger");
  }
}

// ---- Folder CRUD ----

function openNewFolderModal() {
  document.getElementById("contextFolderId").value = "";
  document.getElementById("contextFolderName").value = "";
  document.getElementById("contextFolderModalTitle").textContent = "New Folder";
  new bootstrap.Modal(document.getElementById("contextFolderModal")).show();
}

function openEditFolderModal(folder) {
  document.getElementById("contextFolderId").value = folder.id;
  document.getElementById("contextFolderName").value = folder.name;
  document.getElementById("contextFolderModalTitle").textContent =
    "Rename Folder";
  new bootstrap.Modal(document.getElementById("contextFolderModal")).show();
}

async function saveFolder() {
  const id = document.getElementById("contextFolderId").value;
  const name = document.getElementById("contextFolderName").value.trim();
  if (!name) return;

  const url = id ? `/api/context-folders/${id}` : "/api/context-folders";
  const method = id ? "PUT" : "POST";

  try {
    const response = await app.fetchRaw(url, {
      method,
      
      body: JSON.stringify({ name }) });
    const result = await response.json();
    if (result.success) {
      bootstrap.Modal.getInstance(
        document.getElementById("contextFolderModal"),
      ).hide();
      if (!id) expandedFolders.add(String(result.data.id));
      loadContexts();
    } else {
      app.notify("Error: " + result.message, "danger");
    }
  } catch (error) {
    console.error("Error saving folder:", error);
    app.notify("Error saving folder", "danger");
  }
}

async function deleteFolder(folderId) {
  if (
    !(await app.confirm(
      "Delete this folder? Contexts inside will be moved to the top level.",
    ))
  )
    return;
  try {
    const response = await app.fetchRaw(`/api/context-folders/${folderId}`, {
      method: "DELETE" });
    const result = await response.json();
    if (result.success) {
      expandedFolders.delete(String(folderId));
      loadContexts();
    } else {
      app.notify("Error: " + result.message, "danger");
    }
  } catch (error) {
    console.error("Error deleting folder:", error);
    app.notify("Error deleting folder", "danger");
  }
}

async function moveContextToFolder(contextId, folderId) {
  try {
    const response = await app.fetchRaw(`/api/contexts/${contextId}`, {
      method: "PUT",
      
      body: JSON.stringify({ folder_id: folderId || null }) });
    const result = await response.json();
    if (result.success) {
      if (folderId) expandedFolders.add(String(folderId));
      loadContexts();
    } else {
      app.notify("Error: " + result.message, "danger");
    }
  } catch (error) {
    console.error("Error moving context:", error);
    app.notify("Error moving context", "danger");
  }
}

// ---- Icon picker (contexts and folders share the same popover/palette) ----

let iconPickerTarget = null;

function showIconPicker(x, y, entityType, entityId) {
  iconPickerTarget = { entityType, entityId };
  const popover = document.getElementById("contextIconPickerPopover");
  popover.style.left = `${x}px`;
  popover.style.top = `${y}px`;
  popover.classList.remove("d-none");
}

function hideIconPicker() {
  iconPickerTarget = null;
  document.getElementById("contextIconPickerPopover").classList.add("d-none");
}

async function selectIcon(icon) {
  if (!iconPickerTarget) return;
  const { entityType, entityId } = iconPickerTarget;
  hideIconPicker();

  const url =
    entityType === "folder"
      ? `/api/context-folders/${entityId}`
      : `/api/contexts/${entityId}`;

  try {
    const response = await app.fetchRaw(url, {
      method: "PUT",
      
      body: JSON.stringify({ icon }) });
    const result = await response.json();
    if (result.success) {
      loadContexts();
    } else {
      app.notify("Error: " + result.message, "danger");
    }
  } catch (error) {
    console.error("Error setting icon:", error);
    app.notify("Error setting icon", "danger");
  }
}

function initIconPicker() {
  const popover = document.getElementById("contextIconPickerPopover");

  popover.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-icon]");
    if (btn) selectIcon(btn.dataset.icon);
  });

  document.addEventListener("click", (e) => {
    if (
      !popover.classList.contains("d-none") &&
      !popover.contains(e.target) &&
      !e.target.closest('[data-action="pick-icon"]')
    ) {
      hideIconPicker();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideIconPicker();
  });
}

// ---- Reorder ----

async function reorderContextsOnDrop(draggedId, targetId) {
  const ids = allContexts.map((c) => String(c.id));
  const fromIndex = ids.indexOf(String(draggedId));
  if (fromIndex === -1) return;
  ids.splice(fromIndex, 1);

  let toIndex = ids.indexOf(String(targetId));
  if (toIndex === -1) toIndex = ids.length;
  ids.splice(toIndex, 0, String(draggedId));

  try {
    const response = await app.fetchRaw("/api/contexts/reorder", {
      method: "PATCH",
      
      body: JSON.stringify({ orderedIds: ids }) });
    const result = await response.json();
    if (result.success) {
      loadContexts();
    } else {
      app.notify("Error: " + result.message, "danger");
    }
  } catch (error) {
    console.error("Error reordering contexts:", error);
    app.notify("Error reordering contexts", "danger");
  }
}

// ---- Right panel: selecting a context ----

function showContextPanel(context) {
  const empty = document.getElementById("contextPanelEmpty");
  const panel = document.getElementById("contextPanel");

  if (!context) {
    empty.classList.remove("d-none");
    panel.classList.add("d-none");
    return;
  }

  empty.classList.add("d-none");
  panel.classList.remove("d-none");
  document.getElementById("contextPanelTitle").textContent = context.name;

  populateContextOwnerSelect(context);
  applySubtabOrder(context);
  loadContextDbSubpanel(context.id);
}

// ---- Owner: every context must have a user assigned before it can be
// activated (see activeContextService.js#setActiveContextId) ----

let allUsers = [];

async function loadUsers() {
  try {
    const response = await fetch("/api/users");
    const result = await response.json();
    if (result.success) allUsers = result.data;
  } catch (error) {
    console.error("Error loading users:", error);
  }
}

function populateContextOwnerSelect(context) {
  const select = document.getElementById("contextOwnerSelect");
  select.innerHTML =
    '<option value="">Unassigned</option>' +
    allUsers
      .map((u) => `<option value="${u.id}">${app.escapeHtml(u.name)}</option>`)
      .join("");
  select.value = context.user_id || "";
  document
    .getElementById("contextOwnerWarning")
    .classList.toggle("d-none", !!context.user_id);
}

async function saveContextOwner(contextId, userId) {
  try {
    const response = await app.fetchRaw(`/api/contexts/${contextId}`, {
      method: "PUT",
      
      body: JSON.stringify({ user_id: userId || null }) });
    const result = await response.json();
    if (!result.success) {
      app.notify("Error: " + result.message, "danger");
      return;
    }
    document
      .getElementById("contextOwnerWarning")
      .classList.toggle("d-none", !!userId);
    await loadContexts();
  } catch (error) {
    console.error("Error saving context owner:", error);
    app.notify("Error saving owner", "danger");
  }
}

async function addNewContextOwner() {
  const name = await app.prompt("New user name:", { title: "Add Owner", placeholder: "Name" });
  if (!name || !name.trim()) return;

  try {
    const response = await app.fetchRaw("/api/users", {
      method: "POST",
      
      body: JSON.stringify({ name: name.trim() }) });
    const result = await response.json();
    if (!result.success) {
      app.notify("Error: " + result.message, "danger");
      return;
    }
    if (!allUsers.some((u) => u.id === result.data.id)) {
      allUsers.push(result.data);
    }
    const select = document.getElementById("contextOwnerSelect");
    select.innerHTML =
      '<option value="">Unassigned</option>' +
      allUsers
        .map(
          (u) => `<option value="${u.id}">${app.escapeHtml(u.name)}</option>`,
        )
        .join("");
    select.value = result.data.id;
    if (selectedContextId)
      await saveContextOwner(selectedContextId, result.data.id);
  } catch (error) {
    console.error("Error creating user:", error);
    app.notify("Error creating user", "danger");
  }
}

async function selectContext(contextId) {
  selectedContextId = contextId;

  // Toggle the class in place rather than a full renderContextsList() - a
  // full re-render replaces the row DOM nodes, which resets the browser's
  // native double-click detection on whatever row you're clicking (dblclick
  // never fires if its two constituent clicks land on two different element
  // instances, even at the same screen position).
  document.querySelectorAll("#contextsList .context-row").forEach((row) => {
    row.classList.toggle(
      "selected",
      String(row.dataset.contextId) === String(contextId),
    );
  });

  const context = allContexts.find((c) => String(c.id) === String(contextId));
  showContextPanel(context || null);
}

function initSubTabs() {
  const nav = document.getElementById("contextSubTabs");

  nav.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-subtab]");
    if (!btn) return;

    nav
      .querySelectorAll("button[data-subtab]")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const target = btn.dataset.subtab;
    document.querySelectorAll(".context-subtab-pane").forEach((pane) => {
      pane.classList.toggle("d-none", pane.dataset.subtabPane !== target);
    });

    // Load content for specific tabs
    if (target === "database" && selectedContextId) {
      loadContextDbSubpanel(selectedContextId);
    }
  });

  app.bindTabDragReorder(nav, "li[data-subtab]", (orderedKeys) => {
    if (selectedContextId) saveSubtabOrder(selectedContextId, orderedKeys);
  });
}

async function saveSubtabOrder(contextId, orderedKeys) {
  try {
    await app.fetchRaw(`/api/contexts/${contextId}`, {
      method: "PUT",
      
      body: JSON.stringify({ subtab_order: JSON.stringify(orderedKeys) }) });
  } catch (error) {
    console.error("Error saving sub-tab order:", error);
  }
}

function applySubtabOrder(context) {
  const nav = document.getElementById("contextSubTabs");
  let order;
  try {
    order = context.subtab_order ? JSON.parse(context.subtab_order) : null;
  } catch {
    order = null;
  }
  if (!order || !Array.isArray(order)) return;

  order
    .map((key) => nav.querySelector(`li[data-subtab="${key}"]`))
    .filter(Boolean)
    .forEach((li) => nav.appendChild(li));
}


// ---- Database sub-panel: the selected context's own DB connection(s) ----
// A context can save both a MySQL/MariaDB and an MSSQL profile side by side
// (the type toggle just controls which fields are shown); only MySQL/MariaDB
// is ever the live query backend (see contextDatabaseConfigService.js).

const DB_PASSWORD_PLACEHOLDER = "••••••••••••";

function collectEditFormFields() {
  return {
    host: document.getElementById("editDbHost").value,
    port: document.getElementById("editDbPort").value || null,
    database: document.getElementById("editDbDatabase").value,
    user: document.getElementById("editDbUser").value,
    password: document.getElementById("editDbPassword").value,
  };
}

function showDbConfigChoice() {
  document.getElementById("contextDbNoConfig").classList.remove("d-none");
  document.getElementById("contextDbConfigured").classList.add("d-none");
  document.getElementById("contextDbForm").classList.add("d-none");
  // Disable schema update button when no DB is configured
  const schemaBtn = document.getElementById("checkSchemaBtn");
  if (schemaBtn) {
    schemaBtn.disabled = true;
    schemaBtn.title = "Configure a database connection first";
  }
}

function showDbConfigured(dbType, config) {
  const typeLabel = dbType === "mssql" ? "MSSQL (Azure)" : "MySQL / MariaDB";
  document.getElementById("currentDbTypeLabel").textContent = typeLabel;
  document.getElementById("currentDbHost").textContent = config.host || "-";
  document.getElementById("currentDbPort").textContent = config.port || "-";
  document.getElementById("currentDbDatabase").textContent = config.database || "-";
  document.getElementById("currentDbUser").textContent = config.user || "-";
  document.getElementById("currentDbPassword").textContent = config.hasPassword ? "••••••••" : "(not set)";

  document.getElementById("contextDbNoConfig").classList.add("d-none");
  document.getElementById("contextDbConfigured").classList.remove("d-none");
  document.getElementById("contextDbForm").classList.add("d-none");

  // Enable schema update button when DB is configured
  const schemaBtn = document.getElementById("checkSchemaBtn");
  if (schemaBtn) {
    schemaBtn.disabled = false;
    schemaBtn.title = "Check and update database schema";
  }
}

function showDbEditForm(dbType, config) {
  document.getElementById("editingDbType").value = dbType;
  const isMssql = dbType === "mssql";
  document.getElementById("editDbHost").placeholder = isMssql ? "servername.database.windows.net" : "localhost";
  document.getElementById("editDbPort").placeholder = isMssql ? "1433" : "3306";
  document.getElementById("editDbHost").value = config.host || "";
  document.getElementById("editDbPort").value = config.port || "";
  document.getElementById("editDbDatabase").value = config.database || "";
  document.getElementById("editDbUser").value = config.user || "";
  document.getElementById("editDbPassword").value = "";
  document.getElementById("editDbPassword").dataset.placeholder = config.hasPassword ? DB_PASSWORD_PLACEHOLDER : "";
  if (config.hasPassword) {
    document.getElementById("editDbPassword").value = DB_PASSWORD_PLACEHOLDER;
  }

  document.getElementById("contextMssqlNotice").classList.toggle("d-none", !isMssql);
  document.getElementById("contextDbNoConfig").classList.add("d-none");
  document.getElementById("contextDbConfigured").classList.add("d-none");
  document.getElementById("contextDbForm").classList.remove("d-none");
}

async function loadContextDbSubpanel(contextId) {
  document.getElementById("contextDbStatus").textContent = "";
  document.getElementById("editContextDbStatus").textContent = "";

  try {
    const response = await fetch(`/api/context-database-config/${contextId}`);
    const result = await response.json();
    if (!result.success) {
      showDbConfigChoice();
      return;
    }

    const { dbType, config } = result.data;
    if (!dbType || !config) {
      showDbConfigChoice();
      return;
    }

    showDbConfigured(dbType, config);
  } catch (error) {
    console.error("Error loading context database config:", error);
    showDbConfigChoice();
  }
}

async function chooseDbType(dbType) {
  if (!selectedContextId) return;

  try {
    const response = await fetch(`/api/context-database-config/${selectedContextId}`);
    const result = await response.json();
    if (!result.success) {
      showDbEditForm(dbType, { host: "", port: "", database: "", user: "", hasPassword: false });
      return;
    }

    const { config } = result.data;
    const emptyConfig = { host: "", port: "", database: "", user: "", hasPassword: false };
    showDbEditForm(dbType, config || emptyConfig);
  } catch (error) {
    console.error("Error loading config:", error);
    showDbEditForm(dbType, { host: "", port: "", database: "", user: "", hasPassword: false });
  }
}

async function saveContextDbConfig() {
  if (!selectedContextId) return;

  const dbType = document.getElementById("editingDbType").value;
  const config = collectEditFormFields();
  const statusEl = document.getElementById("editContextDbStatus");
  const pwInput = document.getElementById("editDbPassword");

  if (!config.host || !config.database || !config.user) {
    statusEl.innerHTML = '<span class="text-danger">Host, database, and user are required</span>';
    return;
  }

  // If password is the placeholder, clear it (means user didn't change it)
  if (pwInput.dataset.placeholder && config.password === pwInput.dataset.placeholder) {
    config.password = undefined;
  }

  statusEl.innerHTML = '<span class="text-muted">Testing connection…</span>';

  try {
    // First test the connection
    const testConfig = { ...config };
    const testResponse = await app.fetchRaw(
      `/api/context-database-config/${selectedContextId}/test/${dbType}`,
      {
        method: "POST",
        
        body: JSON.stringify(testConfig) },
    );
    const testResult = await testResponse.json();
    if (!testResult.success) {
      statusEl.innerHTML = `<span class="text-danger">Connection failed: ${app.escapeHtml(testResult.message)}</span>`;
      return;
    }

    // Connection successful, check if schema exists
    statusEl.innerHTML = '<span class="text-muted">Checking schema…</span>';

    if (testResult.schemaExists === false) {
      // Schema doesn't exist, ask user if they want to create it
      const confirmed = await app.confirm(
        'The database schema does not exist in this database. Would you like to create it now? This will create the necessary tables and columns for MyWork to function properly with this context.',
        'Create Schema'
      );

      if (!confirmed) {
        statusEl.innerHTML = '<span class="text-warning">Schema creation cancelled. You can create it later from the Schema tab.</span>';
        return;
      }

      // Create the schema
      statusEl.innerHTML = '<span class="text-muted">Creating schema…</span>';
      const createResponse = await app.fetchRaw(
        `/api/context-database-config/${selectedContextId}/create-schema/${dbType}`,
        {
          method: "POST",
          
          body: JSON.stringify(config) },
      );
      const createResult = await createResponse.json();
      if (!createResult.success) {
        statusEl.innerHTML = `<span class="text-danger">Schema creation failed: ${app.escapeHtml(createResult.message)}</span>`;
        return;
      }
    }

    // Schema is ready, now save the config
    statusEl.innerHTML = '<span class="text-muted">Saving…</span>';
    const saveResponse = await app.fetchRaw(
      `/api/context-database-config/${selectedContextId}`,
      {
        method: "PUT",
        
        body: JSON.stringify({ dbType, config }) },
    );
    const saveResult = await saveResponse.json();
    if (saveResult.success) {
      app.notify("Database config saved!", "success");
      loadContextDbSubpanel(selectedContextId);
    } else {
      const errorMsg = saveResult.details || saveResult.message || 'Unknown error';
      statusEl.innerHTML = `<span class="text-danger">Save failed: ${app.escapeHtml(errorMsg)}</span>`;
      console.error('Full error response:', saveResult);
    }
  } catch (error) {
    console.error("Error saving database config:", error);
    statusEl.innerHTML = '<span class="text-danger">Error saving config</span>';
  }
}

async function removeContextDbConfig() {
  if (!selectedContextId) return;
  if (!(await app.confirm("Are you sure? This will remove the database connection for this context.", "Remove Connection"))) {
    return;
  }

  try {
    const response = await app.fetchRaw(`/api/context-database-config/${selectedContextId}`, {
      method: "DELETE" });
    const result = await response.json();
    if (result.success) {
      app.notify("Database connection removed", "success");
      loadContextDbSubpanel(selectedContextId);
    } else {
      app.notify("Error: " + result.message, "danger");
    }
  } catch (error) {
    console.error("Error removing database config:", error);
    app.notify("Error removing connection", "danger");
  }
}

function cancelEditContextDb() {
  loadContextDbSubpanel(selectedContextId);
}

async function checkAndUpdateSchema() {
  if (!selectedContextId) {
    app.notify("Please select a context first", "warning");
    return;
  }

  const btn = document.getElementById("checkSchemaBtn");
  const statusEl = document.getElementById("schemaUpdateStatus");
  const resultsEl = document.getElementById("schemaUpdateResults");
  const resultsContentEl = document.getElementById("schemaUpdateResultsContent");

  btn.disabled = true;
  statusEl.textContent = "Checking and updating schema...";
  resultsEl.classList.add("d-none");

  try {
    const response = await app.fetchRaw(
      `/api/contexts/${selectedContextId}/schema/update`,
      {
        method: "POST" }
    );

    const result = await response.json();

    if (result.success) {
      const data = result.data;
      let html = `<p class="mb-2 text-success"><i class="bi bi-check-circle"></i> ${app.escapeHtml(data.message)}</p>`;

      if (data.tablesCreated.length > 0) {
        html += `<div class="mb-2"><strong>Tables Created:</strong><ul>`;
        data.tablesCreated.forEach((table) => {
          html += `<li>${app.escapeHtml(table)}</li>`;
        });
        html += `</ul></div>`;
      }

      if (data.columnsAdded.length > 0) {
        html += `<div class="mb-2"><strong>Columns Added:</strong><ul>`;
        data.columnsAdded.forEach((col) => {
          html += `<li>${app.escapeHtml(col.table)}.${app.escapeHtml(col.column)}</li>`;
        });
        html += `</ul></div>`;
      }

      if (data.indexesAdded.length > 0) {
        html += `<div class="mb-2"><strong>Indexes Added:</strong><ul>`;
        data.indexesAdded.forEach((idx) => {
          html += `<li>${app.escapeHtml(idx.table)}.${app.escapeHtml(idx.index)}</li>`;
        });
        html += `</ul></div>`;
      }

      if (data.errors.length > 0) {
        html += `<div class="alert alert-warning mb-0"><strong>Warnings:</strong><ul>`;
        data.errors.forEach((err) => {
          html += `<li>${app.escapeHtml(err.table)}: ${app.escapeHtml(err.message)}</li>`;
        });
        html += `</ul></div>`;
      }

      resultsContentEl.innerHTML = html;
      resultsEl.classList.remove("d-none");
      statusEl.textContent = "Schema update completed";
      app.notify("Schema updated successfully", "success");
    } else {
      app.notify("Error: " + result.message, "danger");
    }
  } catch (error) {
    console.error("Error updating schema:", error);
    app.notify("Error updating schema", "danger");
  } finally {
    btn.disabled = false;
  }
}

async function backupContext() {
  if (!selectedContextId) {
    app.notify("Please select a context first", "warning");
    return;
  }

  const btn = document.getElementById("backupContextBtn");
  const statusEl = document.getElementById("backupContextStatus");
  const context = allContexts.find((c) => String(c.id) === String(selectedContextId));

  if (!context) {
    app.notify("Context not found", "danger");
    return;
  }

  btn.disabled = true;
  statusEl.textContent = "Creating backup...";

  try {
    const response = await app.fetchRaw(`/api/contexts/${selectedContextId}/backup`, {
      method: "POST" });

    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.message || `HTTP ${response.status}`);
    }

    // Get the blob from the response
    const blob = await response.blob();

    // Create a download link
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const timestamp = new Date().toISOString().slice(0, 10);
    link.download = `mywork-backup-${context.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${timestamp}.zip`;
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);

    statusEl.innerHTML = '<i class="bi bi-check-circle text-success"></i> Backup downloaded successfully';
    app.notify("Backup created and downloaded", "success");
  } catch (error) {
    console.error("Error creating backup:", error);
    statusEl.innerHTML = '<i class="bi bi-exclamation-circle text-danger"></i> Error creating backup';
    app.notify("Error creating backup: " + error.message, "danger");
  } finally {
    btn.disabled = false;
  }
}

async function copySystemDatabaseSettings() {
  if (!selectedContextId) {
    app.notify("Please select a context first", "warning");
    return;
  }

  const btn = document.getElementById("copySystemDbBtn");
  const statusEl = document.getElementById("contextDbStatus");

  btn.disabled = true;
  statusEl.innerHTML = '<span class="text-muted">Copying system database settings...</span>';

  try {
    const response = await app.fetchRaw(`/api/contexts/${selectedContextId}/use-system-database`, {
      method: "POST" });

    const result = await response.json();

    if (result.success) {
      statusEl.innerHTML = '<i class="bi bi-check-circle text-success"></i> System database settings applied';
      app.notify("Context configured to use system database", "success");
      // Reload the database panel to show the new configuration
      await loadContextDbSubpanel(selectedContextId);
    } else {
      statusEl.innerHTML = '<i class="bi bi-exclamation-circle text-danger"></i> Failed to apply settings';
      app.notify("Error: " + result.message, "danger");
    }
  } catch (error) {
    console.error("Error copying system database settings:", error);
    statusEl.innerHTML = '<i class="bi bi-exclamation-circle text-danger"></i> Error copying settings';
    app.notify("Error copying database settings", "danger");
  } finally {
    btn.disabled = false;
  }
}

// ---- Wiring ----

function initContextsEventListeners() {
  document
    .getElementById("addContextBtn")
    .addEventListener("click", openNewContextForm);
  document
    .getElementById("saveContextBtn")
    .addEventListener("click", saveContext);

  // Database configuration buttons
  document
    .getElementById("chooseDbTypeMysqlBtn")
    .addEventListener("click", () => chooseDbType("mysql"));
  document
    .getElementById("chooseDbTypeMssqlBtn")
    .addEventListener("click", () => chooseDbType("mssql"));
  document
    .getElementById("updateContextDbBtn")
    .addEventListener("click", async () => {
      if (!selectedContextId) return;
      try {
        const response = await fetch(`/api/context-database-config/${selectedContextId}`);
        const result = await response.json();
        if (result.success && result.data.dbType && result.data.config) {
          showDbEditForm(result.data.dbType, result.data.config);
        }
      } catch (error) {
        console.error("Error loading config for edit:", error);
      }
    });
  // Copy system database button (when no config exists)
  const copySystemDbBtnNoConfig = document.getElementById("copySystemDbBtnNoConfig");
  if (copySystemDbBtnNoConfig) {
    copySystemDbBtnNoConfig.addEventListener("click", copySystemDatabaseSettings);
  }

  // Copy system database button (when config exists)
  const copySystemDbBtn = document.getElementById("copySystemDbBtn");
  if (copySystemDbBtn) {
    copySystemDbBtn.addEventListener("click", copySystemDatabaseSettings);
  }
  document
    .getElementById("saveContextDbBtn")
    .addEventListener("click", saveContextDbConfig);
  document
    .getElementById("cancelEditContextDbBtn")
    .addEventListener("click", cancelEditContextDb);
  document
    .getElementById("removeContextDbBtn")
    .addEventListener("click", removeContextDbConfig);

  document
    .getElementById("checkSchemaBtn")
    .addEventListener("click", checkAndUpdateSchema);
  document
    .getElementById("backupContextBtn")
    .addEventListener("click", backupContext);
  document
    .getElementById("addContextFolderBtn")
    .addEventListener("click", openNewFolderModal);
  document
    .getElementById("saveContextFolderBtn")
    .addEventListener("click", saveFolder);

  document
    .getElementById("contextOwnerSelect")
    .addEventListener("change", (e) => {
      if (selectedContextId)
        saveContextOwner(selectedContextId, e.target.value);
    });
  document
    .getElementById("addContextOwnerBtn")
    .addEventListener("click", addNewContextOwner);


  const list = document.getElementById("contextsList");

  list.addEventListener("click", (e) => {
    // Folder expand/collapse
    const folderHeader = e.target.closest(".context-folder-header");
    const actionBtn = e.target.closest("[data-action]");

    if (actionBtn) {
      const { action, id } = actionBtn.dataset;
      if (action === "delete") {
        deleteContext(id);
        return;
      }
      if (action === "delete-folder") {
        deleteFolder(id);
        return;
      }
      if (action === "edit-folder") {
        const folder = allFolders.find((f) => String(f.id) === String(id));
        if (folder) openEditFolderModal(folder);
        return;
      }
      if (action === "pick-icon") {
        const rect = actionBtn.getBoundingClientRect();
        showIconPicker(
          rect.left,
          rect.bottom + 4,
          actionBtn.dataset.entityType,
          id,
        );
        return;
      }
      return;
    }

    if (folderHeader && !actionBtn) {
      const folderId = folderHeader.dataset.folderId;
      if (expandedFolders.has(String(folderId))) {
        expandedFolders.delete(String(folderId));
      } else {
        expandedFolders.add(String(folderId));
      }
      renderContextsList();
      return;
    }

    const row = e.target.closest(".context-row");
    if (row) selectContext(row.dataset.contextId);
  });

  async function renameContext(newName, titleEl) {
    const contextId = titleEl.closest(".context-row").dataset.contextId;
    try {
      const response = await app.fetchRaw(`/api/contexts/${contextId}`, {
        method: "PUT",
        
        body: JSON.stringify({ name: newName }) });
      const result = await response.json();
      if (!result.success) {
        app.notify("Error: " + result.message, "danger");
        return false;
      }
      loadContexts();
      return true;
    } catch (error) {
      console.error("Error renaming context:", error);
      app.notify("Error renaming context", "danger");
      return false;
    }
  }

  list.addEventListener("dblclick", (e) => {
    const titleEl = e.target.closest(".context-row-title");
    if (!titleEl || titleEl.querySelector("input")) return;
    app.startInlineRename(titleEl, renameContext);
  });

  // Drag-and-drop: contexts reorder among themselves; dropping a context onto
  // a folder header moves it into that folder; dropping onto the list background
  // (outside any folder header) moves it to root.
  list.addEventListener("dragstart", (e) => {
    const row = e.target.closest(".context-row");
    const folderHeader = e.target.closest(".context-folder-header");
    if (row) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("context-id", row.dataset.contextId);
      row.classList.add("dragging-item");
    } else if (folderHeader) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("folder-id", folderHeader.dataset.folderId);
    }
  });

  list.addEventListener("dragend", (e) => {
    e.target.closest(".context-row")?.classList.remove("dragging-item");
    list
      .querySelectorAll(".context-folder-header.drag-over")
      .forEach((el) => el.classList.remove("drag-over"));
  });

  list.addEventListener("dragover", (e) => {
    const folderHeader = e.target.closest(".context-folder-header");
    const contextId =
      e.dataTransfer.types.includes("context-id") ||
      e.dataTransfer.types.includes("Files");
    if (folderHeader) {
      e.preventDefault();
      list
        .querySelectorAll(".context-folder-header.drag-over")
        .forEach((el) => el.classList.remove("drag-over"));
      folderHeader.classList.add("drag-over");
    } else if (e.target.closest(".context-row")) {
      e.preventDefault();
      list
        .querySelectorAll(".context-folder-header.drag-over")
        .forEach((el) => el.classList.remove("drag-over"));
    } else {
      // Hovering over list background = drop to root
      if (e.dataTransfer.types.includes("context-id")) {
        e.preventDefault();
        list
          .querySelectorAll(".context-folder-header.drag-over")
          .forEach((el) => el.classList.remove("drag-over"));
      }
    }
  });

  list.addEventListener("dragleave", (e) => {
    if (!list.contains(e.relatedTarget)) {
      list
        .querySelectorAll(".context-folder-header.drag-over")
        .forEach((el) => el.classList.remove("drag-over"));
    }
  });

  list.addEventListener("drop", (e) => {
    list
      .querySelectorAll(".context-folder-header.drag-over")
      .forEach((el) => el.classList.remove("drag-over"));

    const draggedContextId = e.dataTransfer.getData("context-id");
    const draggedFolderId = e.dataTransfer.getData("folder-id");

    const targetFolderHeader = e.target.closest(".context-folder-header");
    const targetContextRow = e.target.closest(".context-row");

    if (draggedContextId) {
      e.preventDefault();
      if (targetFolderHeader) {
        // Drop context into folder
        moveContextToFolder(
          draggedContextId,
          targetFolderHeader.dataset.folderId,
        );
      } else if (targetContextRow) {
        // Reorder context among its siblings
        reorderContextsOnDrop(
          draggedContextId,
          targetContextRow.dataset.contextId,
        );
      } else {
        // Drop onto list background = move to root
        moveContextToFolder(draggedContextId, null);
      }
    }
  });

  initSubTabs();
  initIconPicker();
}

function initContexts() {
  initContextsEventListeners();
  loadUsers();
  loadContexts();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initContexts);
} else {
  initContexts();
}
