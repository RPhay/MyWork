let allContexts = [];

function renderContextsTable() {
  const tbody = document.getElementById('contextsTableBody');

  if (allContexts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted">No contexts configured</td></tr>';
    return;
  }

  tbody.innerHTML = allContexts.map(context => `
    <tr data-context-id="${context.id}">
      <td>${context.name}</td>
      <td>
        <button class="btn btn-sm btn-info" data-action="edit" data-id="${context.id}" title="Edit" aria-label="Edit"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-danger" data-action="delete" data-id="${context.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

async function loadContexts() {
  const tbody = document.getElementById('contextsTableBody');
  tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted">Loading...</td></tr>';

  try {
    const response = await fetch('/api/contexts');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();

    if (result.success) {
      allContexts = result.data;
      renderContextsTable();
    } else {
      tbody.innerHTML = '<tr><td colspan="2" class="text-center text-danger">Error loading contexts</td></tr>';
    }
  } catch (error) {
    console.error('Error loading contexts:', error);
    tbody.innerHTML = '<tr><td colspan="2" class="text-center text-danger">Error loading contexts</td></tr>';
  }
}

function openNewContextForm() {
  document.getElementById('contextId').value = '';
  document.getElementById('contextForm').reset();
}

async function saveContext() {
  const contextId = document.getElementById('contextId').value;

  const data = {
    name: document.getElementById('contextName').value
  };

  try {
    const url = contextId ? `/api/contexts/${contextId}` : '/api/contexts';
    const method = contextId ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Context saved!', 'success');
      bootstrap.Modal.getInstance(document.getElementById('contextModal')).hide();
      loadContexts();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error saving context', 'danger');
  }
}

async function editContext(contextId) {
  const context = allContexts.find(c => String(c.id) === String(contextId));
  if (!context) return;

  document.getElementById('contextId').value = context.id;
  document.getElementById('contextName').value = context.name;

  const modal = new bootstrap.Modal(document.getElementById('contextModal'));
  modal.show();
}

async function deleteContext(contextId) {
  if (!await app.confirm('Delete this context?')) return;

  try {
    const response = await fetch(`/api/contexts/${contextId}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Context deleted', 'success');
      loadContexts();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error deleting context', 'danger');
  }
}

function initContextsEventListeners() {
  document.getElementById('addContextBtn').addEventListener('click', openNewContextForm);
  document.getElementById('saveContextBtn').addEventListener('click', saveContext);

  document.getElementById('contextsTableBody').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'edit') editContext(btn.dataset.id);
    else if (btn.dataset.action === 'delete') deleteContext(btn.dataset.id);
  });
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
