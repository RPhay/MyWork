let allContexts = [];
let selectedContextId = null;

function renderContextsList() {
  const container = document.getElementById('contextsList');

  if (allContexts.length === 0) {
    container.innerHTML = '<p class="text-center text-muted">No contexts yet</p>';
    return;
  }

  container.innerHTML = allContexts.map(context => `
    <div class="context-row ${String(context.id) === String(selectedContextId) ? 'selected' : ''}" data-context-id="${context.id}" draggable="true">
      <span class="context-row-title">${context.name}</span>
      ${context.userName
        ? `<span class="badge bg-light text-dark border context-row-owner" title="Owner">${app.escapeHtml(context.userName)}</span>`
        : `<span class="badge bg-danger context-row-owner" title="No owner assigned - this context can't be activated"><i class="bi bi-exclamation-triangle"></i> No owner</span>`}
      <span class="context-row-actions">
        <button class="btn btn-sm btn-danger" data-action="delete" data-id="${context.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
      </span>
    </div>
  `).join('');
}

async function loadContexts() {
  try {
    const response = await fetch('/api/contexts');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();

    if (result.success) {
      allContexts = result.data;
      renderContextsList();
    }
  } catch (error) {
    console.error('Error loading contexts:', error);
    document.getElementById('contextsList').innerHTML = '<p class="text-center text-danger">Error loading contexts</p>';
  }
}

function openNewContextForm() {
  document.getElementById('contextForm').reset();
}

async function saveContext() {
  const data = {
    name: document.getElementById('contextName').value
  };

  try {
    const response = await fetch('/api/contexts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Context created!', 'success');
      bootstrap.Modal.getInstance(document.getElementById('contextModal')).hide();
      loadContexts();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error creating context', 'danger');
  }
}

async function deleteContext(contextId) {
  if (!await app.confirm('Delete this context? Data belonging to it is not deleted, but will no longer be reachable unless you reassign it.')) return;

  try {
    const response = await fetch(`/api/contexts/${contextId}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Context deleted', 'success');
      if (String(selectedContextId) === String(contextId)) {
        selectedContextId = null;
        showContextPanel(null);
      }
      loadContexts();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error deleting context', 'danger');
  }
}

async function reorderContextsOnDrop(draggedId, targetId) {
  const ids = allContexts.map(c => String(c.id));
  const fromIndex = ids.indexOf(String(draggedId));
  if (fromIndex === -1) return;
  ids.splice(fromIndex, 1);

  let toIndex = ids.indexOf(String(targetId));
  if (toIndex === -1) toIndex = ids.length;
  ids.splice(toIndex, 0, String(draggedId));

  try {
    const response = await fetch('/api/contexts/reorder', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ orderedIds: ids })
    });
    const result = await response.json();
    if (result.success) {
      loadContexts();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error reordering contexts:', error);
    app.notify('Error reordering contexts', 'danger');
  }
}

// ---- Right panel: selecting a context ----

function showContextPanel(context) {
  const empty = document.getElementById('contextPanelEmpty');
  const panel = document.getElementById('contextPanel');

  if (!context) {
    empty.classList.remove('d-none');
    panel.classList.add('d-none');
    return;
  }

  empty.classList.add('d-none');
  panel.classList.remove('d-none');
  document.getElementById('contextPanelTitle').textContent = context.name;

  populateContextOwnerSelect(context);
  applySubtabOrder(context);
  loadContextTabsSubpanel(context.id);
  loadContextDbSubpanel(context.id);
}

// ---- Owner: every context must have a user assigned before it can be
// activated (see activeContextService.js#setActiveContextId) ----

let allUsers = [];

async function loadUsers() {
  try {
    const response = await fetch('/api/users');
    const result = await response.json();
    if (result.success) allUsers = result.data;
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

function populateContextOwnerSelect(context) {
  const select = document.getElementById('contextOwnerSelect');
  select.innerHTML = '<option value="">Unassigned</option>' +
    allUsers.map(u => `<option value="${u.id}">${app.escapeHtml(u.name)}</option>`).join('');
  select.value = context.user_id || '';
  document.getElementById('contextOwnerWarning').classList.toggle('d-none', !!context.user_id);
}

async function saveContextOwner(contextId, userId) {
  try {
    const response = await fetch(`/api/contexts/${contextId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ user_id: userId || null })
    });
    const result = await response.json();
    if (!result.success) {
      app.notify('Error: ' + result.message, 'danger');
      return;
    }
    document.getElementById('contextOwnerWarning').classList.toggle('d-none', !!userId);
    await loadContexts();
  } catch (error) {
    console.error('Error saving context owner:', error);
    app.notify('Error saving owner', 'danger');
  }
}

async function addNewContextOwner() {
  const name = window.prompt('New user name:');
  if (!name || !name.trim()) return;

  try {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ name: name.trim() })
    });
    const result = await response.json();
    if (!result.success) {
      app.notify('Error: ' + result.message, 'danger');
      return;
    }
    if (!allUsers.some(u => u.id === result.data.id)) {
      allUsers.push(result.data);
    }
    const select = document.getElementById('contextOwnerSelect');
    select.innerHTML = '<option value="">Unassigned</option>' +
      allUsers.map(u => `<option value="${u.id}">${app.escapeHtml(u.name)}</option>`).join('');
    select.value = result.data.id;
    if (selectedContextId) await saveContextOwner(selectedContextId, result.data.id);
  } catch (error) {
    console.error('Error creating user:', error);
    app.notify('Error creating user', 'danger');
  }
}

async function selectContext(contextId) {
  selectedContextId = contextId;

  // Toggle the class in place rather than a full renderContextsList() - a
  // full re-render replaces the row DOM nodes, which resets the browser's
  // native double-click detection on whatever row you're clicking (dblclick
  // never fires if its two constituent clicks land on two different element
  // instances, even at the same screen position).
  document.querySelectorAll('#contextsList .context-row').forEach(row => {
    row.classList.toggle('selected', String(row.dataset.contextId) === String(contextId));
  });

  const context = allContexts.find(c => String(c.id) === String(contextId));
  showContextPanel(context || null);
}

function initSubTabs() {
  const nav = document.getElementById('contextSubTabs');

  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-subtab]');
    if (!btn) return;

    nav.querySelectorAll('button[data-subtab]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const target = btn.dataset.subtab;
    document.querySelectorAll('.context-subtab-pane').forEach(pane => {
      pane.classList.toggle('d-none', pane.dataset.subtabPane !== target);
    });
  });

  app.bindTabDragReorder(nav, 'li[data-subtab]', (orderedKeys) => {
    if (selectedContextId) saveSubtabOrder(selectedContextId, orderedKeys);
  });
}

async function saveSubtabOrder(contextId, orderedKeys) {
  try {
    await fetch(`/api/contexts/${contextId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ subtab_order: JSON.stringify(orderedKeys) })
    });
  } catch (error) {
    console.error('Error saving sub-tab order:', error);
  }
}

function applySubtabOrder(context) {
  const nav = document.getElementById('contextSubTabs');
  let order;
  try {
    order = context.subtab_order ? JSON.parse(context.subtab_order) : null;
  } catch {
    order = null;
  }
  if (!order || !Array.isArray(order)) return;

  order
    .map(key => nav.querySelector(`li[data-subtab="${key}"]`))
    .filter(Boolean)
    .forEach(li => nav.appendChild(li));
}

// ---- Tabs sub-panel: main-app tab visibility for the selected context ----

async function loadContextTabsSubpanel(contextId) {
  const container = document.getElementById('contextTabsList');
  container.innerHTML = '<p class="text-muted small">Loading...</p>';

  try {
    const response = await fetch(`/api/context-tab-settings/${contextId}`);
    const result = await response.json();
    if (!result.success) return;

    container.innerHTML = result.data.map(tab => `
      <div class="context-tab-visibility-row">
        <input type="checkbox" class="form-check-input" data-tab-key="${tab.key}" ${tab.visible ? 'checked' : ''}>
        <span>${tab.label}</span>
      </div>
    `).join('');

    container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', async () => {
        const settings = result.data.map(tab => ({
          key: tab.key,
          visible: tab.key === checkbox.dataset.tabKey ? checkbox.checked : tab.visible,
        }));
        try {
          await fetch(`/api/context-tab-settings/${contextId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': window.APP_CONFIG?.csrfToken
            },
            body: JSON.stringify({ settings })
          });
        } catch (error) {
          console.error('Error saving tab visibility:', error);
        }
      });
    });
  } catch (error) {
    console.error('Error loading tab settings:', error);
    container.innerHTML = '<p class="text-danger small">Error loading tab settings</p>';
  }
}

// ---- Database sub-panel: the selected context's own DB connection(s) ----
// A context can save both a MySQL/MariaDB and an MSSQL profile side by side
// (the type toggle just controls which fields are shown); only MySQL/MariaDB
// is ever the live query backend (see contextDatabaseConfigService.js).

const DB_PASSWORD_PLACEHOLDER = '••••••••••••';
let contextDbSnapshot = null;

function dbFieldSuffix(type) {
  return type === 'mssql' ? 'Mssql' : 'Mysql';
}

function currentDbType() {
  return document.querySelector('input[name="contextDbType"]:checked')?.value || 'mysql';
}

function populateDbFieldsFor(type, profile) {
  const suffix = dbFieldSuffix(type);
  document.getElementById(`contextDbHost${suffix}`).value = profile.host || '';
  document.getElementById(`contextDbPort${suffix}`).value = profile.port || '';
  document.getElementById(`contextDbName${suffix}`).value = profile.database || '';
  document.getElementById(`contextDbUser${suffix}`).value = profile.user || '';
  const pwInput = document.getElementById(`contextDbPassword${suffix}`);
  pwInput.value = profile.hasPassword ? DB_PASSWORD_PLACEHOLDER : '';
  pwInput.dataset.placeholder = profile.hasPassword ? DB_PASSWORD_PLACEHOLDER : '';
}

// Raw current field values, for dirty-checking and for populating a fresh
// context cloned from this one (see cloneContextDbConfig).
function collectDbFieldsFor(type) {
  const suffix = dbFieldSuffix(type);
  return {
    host: document.getElementById(`contextDbHost${suffix}`).value,
    port: document.getElementById(`contextDbPort${suffix}`).value || null,
    database: document.getElementById(`contextDbName${suffix}`).value,
    user: document.getElementById(`contextDbUser${suffix}`).value,
    password: document.getElementById(`contextDbPassword${suffix}`).value,
  };
}

// Same as above, but resolves an untouched masked-password field to
// undefined so the server knows to keep the existing stored password rather
// than overwriting it with the literal placeholder dots.
function collectDbFieldsForSave(type) {
  const fields = collectDbFieldsFor(type);
  const pwInput = document.getElementById(`contextDbPassword${dbFieldSuffix(type)}`);
  if (pwInput.dataset.placeholder && fields.password === pwInput.dataset.placeholder) {
    fields.password = undefined;
  }
  return fields;
}

function snapshotDbForm() {
  return JSON.stringify({
    dbType: currentDbType(),
    mysql: collectDbFieldsFor('mysql'),
    mssql: collectDbFieldsFor('mssql'),
  });
}

function updateSaveButtonState() {
  document.getElementById('saveContextDbBtn').disabled = snapshotDbForm() === contextDbSnapshot;
}

function updateDbTypeVisibility() {
  const type = currentDbType();
  document.querySelectorAll('[data-db-fields]').forEach(el => {
    el.classList.toggle('d-none', el.dataset.dbFields !== type);
  });
  document.getElementById('contextMssqlNotice').classList.toggle('d-none', type !== 'mssql');
}

function removeCreateSchemaBtn() {
  document.getElementById('contextCreateSchemaBtn')?.remove();
}

function renderDbStatus(result) {
  const statusEl = document.getElementById('contextDbStatus');
  removeCreateSchemaBtn();

  if (!result.success) {
    statusEl.innerHTML = `<i class="bi bi-x-circle text-danger"></i> <span class="text-danger">${app.escapeHtml(result.message || 'Connection failed')}</span>`;
    return;
  }

  if (result.schemaExists === false) {
    statusEl.innerHTML = '<i class="bi bi-exclamation-triangle text-warning"></i> <span class="text-warning">Connected - schema not found</span> ';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm btn-outline-secondary ms-1';
    btn.id = 'contextCreateSchemaBtn';
    btn.textContent = 'Create Schema';
    btn.addEventListener('click', createContextDbSchema);
    statusEl.appendChild(btn);
  } else if (result.schemaExists === true) {
    statusEl.innerHTML = '<i class="bi bi-check-circle text-success"></i> <span class="text-success">Connected - schema found</span>';
  } else {
    statusEl.innerHTML = '<i class="bi bi-check-circle text-success"></i> <span class="text-success">Connected</span>';
  }
}

async function autoTestDbConnection() {
  if (!selectedContextId) return;
  const type = currentDbType();
  const statusEl = document.getElementById('contextDbStatus');
  const fields = collectDbFieldsForSave(type);
  removeCreateSchemaBtn();

  if (!fields.host || !fields.user) {
    statusEl.textContent = '';
    return;
  }

  statusEl.innerHTML = '<span class="text-muted">Testing connection…</span>';

  try {
    const response = await fetch(`/api/context-database-config/${selectedContextId}/test/${type}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify(fields)
    });
    const result = await response.json();
    // The type toggle may have changed while this request was in flight.
    if (currentDbType() !== type) return;
    renderDbStatus(result);
  } catch (error) {
    console.error('Error testing context database connection:', error);
    if (currentDbType() !== type) return;
    statusEl.innerHTML = '<i class="bi bi-x-circle text-danger"></i> <span class="text-danger">Error testing connection</span>';
  }
}

async function createContextDbSchema() {
  const type = currentDbType();
  const statusEl = document.getElementById('contextDbStatus');
  try {
    const response = await fetch(`/api/context-database-config/${selectedContextId}/create-schema/${type}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify(collectDbFieldsForSave(type))
    });
    const result = await response.json();
    if (result.success) {
      app.notify('Schema created!', 'success');
      autoTestDbConnection();
    } else {
      app.notify('Schema creation failed: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error creating schema:', error);
    statusEl.innerHTML = '<i class="bi bi-x-circle text-danger"></i> <span class="text-danger">Error creating schema</span>';
  }
}

async function loadContextDbSubpanel(contextId) {
  document.getElementById('contextDbStatus').textContent = '';
  removeCreateSchemaBtn();

  try {
    const response = await fetch(`/api/context-database-config/${contextId}`);
    const result = await response.json();
    if (!result.success) return;

    const config = result.data;
    const typeInput = document.querySelector(`input[name="contextDbType"][value="${config.dbType}"]`);
    if (typeInput) typeInput.checked = true;
    populateDbFieldsFor('mysql', config.mysql);
    populateDbFieldsFor('mssql', config.mssql);
    updateDbTypeVisibility();
    contextDbSnapshot = snapshotDbForm();
    updateSaveButtonState();
    autoTestDbConnection();
  } catch (error) {
    console.error('Error loading context database config:', error);
  }
}

async function saveContextDbConfig() {
  if (!selectedContextId) return;

  try {
    const response = await fetch(`/api/context-database-config/${selectedContextId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({
        dbType: currentDbType(),
        mysql: collectDbFieldsForSave('mysql'),
        mssql: collectDbFieldsForSave('mssql'),
      })
    });
    const result = await response.json();
    if (result.success) {
      app.notify('Database config saved!', 'success');
      loadContextDbSubpanel(selectedContextId);
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error saving context database config:', error);
    app.notify('Error saving database config', 'danger');
  }
}

// ---- Wiring ----

function initContextsEventListeners() {
  document.getElementById('addContextBtn').addEventListener('click', openNewContextForm);
  document.getElementById('saveContextBtn').addEventListener('click', saveContext);
  document.getElementById('saveContextDbBtn').addEventListener('click', saveContextDbConfig);

  document.getElementById('contextOwnerSelect').addEventListener('change', (e) => {
    if (selectedContextId) saveContextOwner(selectedContextId, e.target.value);
  });
  document.getElementById('addContextOwnerBtn').addEventListener('click', addNewContextOwner);

  document.querySelectorAll('input[name="contextDbType"]').forEach(radio => {
    radio.addEventListener('change', () => {
      updateDbTypeVisibility();
      updateSaveButtonState();
      autoTestDbConnection();
    });
  });

  document.getElementById('contextDbForm').querySelectorAll('input[id^="contextDb"]').forEach(input => {
    input.addEventListener('input', updateSaveButtonState);
  });

  const list = document.getElementById('contextsList');

  // A single click anywhere on a row (including its title) selects it into
  // the right panel. Renaming is a separate gesture (dblclick the title,
  // below) rather than click-pause-click - that gesture relies on tracking
  // the same DOM element across two clicks, which doesn't survive
  // selectContext's re-render happening in between.
  list.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      if (actionBtn.dataset.action === 'delete') deleteContext(actionBtn.dataset.id);
      return;
    }

    const row = e.target.closest('.context-row');
    if (row) selectContext(row.dataset.contextId);
  });

  async function renameContext(newName, titleEl) {
    const contextId = titleEl.closest('.context-row').dataset.contextId;
    try {
      const response = await fetch(`/api/contexts/${contextId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.APP_CONFIG?.csrfToken
        },
        body: JSON.stringify({ name: newName })
      });
      const result = await response.json();
      if (!result.success) {
        app.notify('Error: ' + result.message, 'danger');
        return false;
      }
      loadContexts();
      return true;
    } catch (error) {
      console.error('Error renaming context:', error);
      app.notify('Error renaming context', 'danger');
      return false;
    }
  }

  list.addEventListener('dblclick', (e) => {
    const titleEl = e.target.closest('.context-row-title');
    if (!titleEl || titleEl.querySelector('input')) return;
    app.startInlineRename(titleEl, renameContext);
  });

  list.addEventListener('dragstart', (e) => {
    const row = e.target.closest('.context-row');
    if (!row) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('context-id', row.dataset.contextId);
    row.classList.add('dragging-item');
  });

  list.addEventListener('dragend', (e) => {
    const row = e.target.closest('.context-row');
    if (row) row.classList.remove('dragging-item');
  });

  list.addEventListener('dragover', (e) => {
    const row = e.target.closest('.context-row');
    if (!row) return;
    e.preventDefault();
  });

  list.addEventListener('drop', (e) => {
    const row = e.target.closest('.context-row');
    if (!row) return;
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('context-id');
    if (!draggedId || String(draggedId) === String(row.dataset.contextId)) return;
    reorderContextsOnDrop(draggedId, row.dataset.contextId);
  });

  initSubTabs();
}

function initContexts() {
  initContextsEventListeners();
  loadUsers();
  loadContexts();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initContexts);
} else {
  initContexts();
}
