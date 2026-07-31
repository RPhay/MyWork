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
      <span class="context-row-actions">
        <button class="btn btn-sm btn-info" data-action="edit" data-id="${context.id}" title="Edit" aria-label="Edit"><i class="bi bi-pencil"></i></button>
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

  applySubtabOrder(context);
  loadContextTabsSubpanel(context.id);
  loadContextDbSubpanel(context.id);
}

async function selectContext(contextId) {
  selectedContextId = contextId;
  renderContextsList();

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

// ---- Database sub-panel: the selected context's own DB connection ----

async function loadContextDbSubpanel(contextId) {
  document.getElementById('contextDbTestResult').textContent = '';

  try {
    const response = await fetch(`/api/context-database-config/${contextId}`);
    const result = await response.json();
    if (!result.success) return;

    const config = result.data;
    document.getElementById('contextDbHost').value = config.host || '';
    document.getElementById('contextDbPort').value = config.port || '';
    document.getElementById('contextDbName').value = config.database || '';
    document.getElementById('contextDbUser').value = config.user || '';
    document.getElementById('contextDbPassword').value = '';
    document.getElementById('contextDbPasswordHint').textContent = config.hasPassword
      ? 'A password is already saved - leave blank to keep it, or enter a new value to replace it.'
      : 'No password saved yet.';
  } catch (error) {
    console.error('Error loading context database config:', error);
  }
}

function collectContextDbData() {
  return {
    host: document.getElementById('contextDbHost').value,
    port: document.getElementById('contextDbPort').value || null,
    database: document.getElementById('contextDbName').value,
    user: document.getElementById('contextDbUser').value,
    password: document.getElementById('contextDbPassword').value,
  };
}

async function testContextDbConnection() {
  if (!selectedContextId) return;
  const el = document.getElementById('contextDbTestResult');
  el.textContent = 'Testing...';
  el.className = 'small mb-2 text-muted';

  try {
    const response = await fetch(`/api/context-database-config/${selectedContextId}/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify(collectContextDbData())
    });
    const result = await response.json();

    if (!result.success) {
      el.textContent = result.message;
      el.className = 'small mb-2 text-danger';
      return;
    }

    if (result.schemaExists === true) {
      el.textContent = 'Connected successfully - MyWork schema found.';
      el.className = 'small mb-2 text-success';
    } else if (result.schemaExists === false) {
      el.textContent = 'Connected successfully - MyWork schema was not found.';
      el.className = 'small mb-2 text-success';
      if (await app.confirm('The MyWork schema was not found in this database. Create it now?')) {
        await createContextDbSchema();
      }
    } else {
      el.textContent = 'Connected successfully (enter a database name to check for the MyWork schema).';
      el.className = 'small mb-2 text-success';
    }
  } catch (error) {
    console.error('Error testing context database connection:', error);
    el.textContent = 'Error testing connection';
    el.className = 'small mb-2 text-danger';
  }
}

async function createContextDbSchema() {
  const el = document.getElementById('contextDbTestResult');
  try {
    const response = await fetch(`/api/context-database-config/${selectedContextId}/create-schema`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify(collectContextDbData())
    });
    const result = await response.json();
    el.textContent = result.success ? 'Schema created successfully.' : 'Schema creation failed: ' + result.message;
    el.className = `small mb-2 ${result.success ? 'text-success' : 'text-danger'}`;
  } catch (error) {
    console.error('Error creating schema:', error);
    el.textContent = 'Error creating schema';
    el.className = 'small mb-2 text-danger';
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
      body: JSON.stringify(collectContextDbData())
    });
    const result = await response.json();
    if (result.success) {
      app.notify('Database config saved!', 'success');
      document.getElementById('contextDbPassword').value = '';
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
  document.getElementById('testContextDbBtn').addEventListener('click', testContextDbConnection);
  document.getElementById('saveContextDbBtn').addEventListener('click', saveContextDbConfig);

  const list = document.getElementById('contextsList');

  app.bindInlineRename(list, '.context-row-title', async (newName, titleEl) => {
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
  });

  list.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      if (actionBtn.dataset.action === 'edit') selectContext(actionBtn.dataset.id);
      else if (actionBtn.dataset.action === 'delete') deleteContext(actionBtn.dataset.id);
      return;
    }

    const row = e.target.closest('.context-row');
    if (row) selectContext(row.dataset.contextId);
  });

  list.addEventListener('dblclick', (e) => {
    const row = e.target.closest('.context-row');
    if (row) selectContext(row.dataset.contextId);
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
  loadContexts();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initContexts);
} else {
  initContexts();
}
