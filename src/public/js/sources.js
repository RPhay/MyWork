async function loadSources() {
  const tbody = document.getElementById('sourcesTableBody');
  tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Loading...</td></tr>';

  try {
    const response = await fetch('/api/sources');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();

    if (result.success && result.data.length > 0) {
      tbody.innerHTML = result.data.map(source => `
        <tr>
          <td>${app.escapeHtml(source.name)}</td>
          <td>${app.escapeHtml(source.type)}</td>
          <td><span class="badge bg-secondary">${app.escapeHtml(source.status)}</span></td>
          <td><input type="checkbox" ${source.enabled ? 'checked' : ''} data-action="toggle" data-id="${source.id}"></td>
          <td>
            <button class="btn btn-sm btn-info" data-action="edit" data-id="${source.id}" title="Edit" aria-label="Edit"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-danger" data-action="delete" data-id="${source.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
          </td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No sources configured</td></tr>';
    }
  } catch (error) {
    console.error('Error:', error);
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading sources</td></tr>';
  }
}

function openNewSourceForm() {
  document.getElementById('sourceId').value = '';
  document.getElementById('sourceForm').reset();
  updateSourceConfig();
}

function updateSourceConfig() {
  const sourceType = document.getElementById('sourceType').value;
  const configFields = document.getElementById('sourceConfigFields');

  configFields.innerHTML = '';

  const configs = {
    'outlook-calendar': [
      { name: 'tenant_id', label: 'Tenant ID', type: 'text', required: true },
      { name: 'client_id', label: 'Client ID', type: 'text', required: true },
      { name: 'client_secret', label: 'Client Secret', type: 'password', required: true },
    ],
    'azure-devops': [
      { name: 'organization', label: 'Organization', type: 'text', required: true },
      { name: 'token', label: 'Personal Access Token', type: 'password', required: true },
    ],
    'github': [
      { name: 'owner', label: 'Repository Owner', type: 'text', required: true },
      { name: 'repo', label: 'Repository Name', type: 'text', required: true },
      { name: 'token', label: 'GitHub Token', type: 'password', required: true },
    ],
  };

  const fields = configs[sourceType] || [];
  fields.forEach(field => {
    const div = document.createElement('div');
    div.className = 'mb-3';
    div.innerHTML = `
      <label for="config_${field.name}" class="form-label">${field.label}${field.required ? ' *' : ''}</label>
      <input type="${field.type}" class="form-control" id="config_${field.name}" name="config_${field.name}" ${field.required ? 'required' : ''}>
    `;
    configFields.appendChild(div);
  });
}

async function testSourceConnection() {
  const sourceId = document.getElementById('sourceId').value;
  if (!sourceId) {
    app.notify('Save the source first', 'warning');
    return;
  }

  try {
    const response = await fetch(`/api/sources/${sourceId}/test`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Connection test passed!', 'success');
    } else {
      app.notify('Connection test failed: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error testing connection', 'danger');
  }
}

async function saveSource() {
  const sourceId = document.getElementById('sourceId').value;

  const data = {
    name: document.getElementById('sourceName').value,
    type: document.getElementById('sourceType').value,
    enabled: document.getElementById('sourceEnabled').checked,
    config: {}
  };

  // Collect config fields
  const configInputs = document.querySelectorAll('#sourceConfigFields input');
  configInputs.forEach(input => {
    const key = input.id.replace('config_', '');
    data.config[key] = input.value;
  });

  try {
    const url = sourceId ? `/api/sources/${sourceId}` : '/api/sources';
    const method = sourceId ? 'PUT' : 'POST';

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
      app.notify('Source saved!', 'success');
      bootstrap.Modal.getInstance(document.getElementById('sourceModal')).hide();
      loadSources();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error saving source', 'danger');
  }
}

async function editSource(sourceId) {
  try {
    const response = await fetch(`/api/sources/${sourceId}`);
    const result = await response.json();
    const source = result.data;

    document.getElementById('sourceId').value = source.id;
    document.getElementById('sourceName').value = source.name;
    document.getElementById('sourceType').value = source.type;
    document.getElementById('sourceEnabled').checked = source.enabled;

    updateSourceConfig();

    // Populate config fields
    if (source.config) {
      Object.keys(source.config).forEach(key => {
        const input = document.getElementById(`config_${key}`);
        if (input) input.value = source.config[key];
      });
    }

    const modal = new bootstrap.Modal(document.getElementById('sourceModal'));
    modal.show();
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error loading source', 'danger');
  }
}

async function deleteSource(sourceId) {
  if (!await app.confirm('Delete this source?')) return;

  try {
    const response = await fetch(`/api/sources/${sourceId}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Source deleted', 'success');
      loadSources();
    } else {
      app.notify('Error deleting source', 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error deleting source', 'danger');
  }
}

async function toggleSource(sourceId, enabled) {
  try {
    const response = await fetch(`/api/sources/${sourceId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ enabled })
    });

    const result = await response.json();
    if (!result.success) {
      loadSources();
    }
  } catch (error) {
    console.error('Error:', error);
    loadSources();
  }
}

function initSourcesEventListeners() {
  document.getElementById('addSourceBtn').addEventListener('click', openNewSourceForm);
  document.getElementById('sourceType').addEventListener('change', updateSourceConfig);
  document.getElementById('testSourceBtn').addEventListener('click', testSourceConnection);
  document.getElementById('saveSourceBtn').addEventListener('click', saveSource);

  document.getElementById('sourcesTableBody').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'edit') editSource(btn.dataset.id);
    else if (btn.dataset.action === 'delete') deleteSource(btn.dataset.id);
  });

  document.getElementById('sourcesTableBody').addEventListener('change', (e) => {
    const checkbox = e.target.closest('[data-action="toggle"]');
    if (checkbox) toggleSource(checkbox.dataset.id, checkbox.checked);
  });

  document.getElementById('sourcesTableBody').addEventListener('dblclick', (e) => {
    if (e.target.closest('[data-action="toggle"]')) return;
    const row = e.target.closest('tr');
    const editBtn = row?.querySelector('[data-action="edit"]');
    if (editBtn) editSource(editBtn.dataset.id);
  });
}

function initSources() {
  initSourcesEventListeners();
  loadSources();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSources);
} else {
  initSources();
}