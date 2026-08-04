async function loadSources() {
  const tbody = document.getElementById('sourcesTableBody');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Loading...</td></tr>';

  try {
    const response = await fetch('/api/sources');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();

    if (result.success && result.data.length > 0) {
      tbody.innerHTML = result.data.map(source => `
        <tr>
          <td>${app.escapeHtml(source.name)}</td>
          <td>${app.escapeHtml(source.provider || source.type)}</td>
          <td>${app.escapeHtml(source.authType || 'Not configured')}</td>
          <td><span class="badge bg-secondary">${app.escapeHtml(source.status || 'Inactive')}</span></td>
          <td><input type="checkbox" ${source.enabled ? 'checked' : ''} data-action="toggle" data-id="${source.id}"></td>
          <td>
            <button class="btn btn-sm btn-info" data-action="edit" data-id="${source.id}" title="Edit" aria-label="Edit"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-danger" data-action="delete" data-id="${source.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
          </td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No data sources configured</td></tr>';
    }
  } catch (error) {
    console.error('Error:', error);
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading sources</td></tr>';
  }
}

let currentSourceType = null;
let currentAuthMethod = null;

function selectSourceType(sourceType) {
  console.log('selectSourceType called with:', sourceType);
  currentSourceType = sourceType;

  const typeNames = {
    'teams': 'Microsoft Teams',
    'outlook': 'Microsoft Outlook',
    'azure-devops': 'Azure DevOps',
    'github-enterprise': 'GitHub Enterprise',
    'servicenow': 'ServiceNow'
  };

  try {
    // Update auth modal title
    const authTitle = document.getElementById('authModalTitle');
    if (authTitle) {
      authTitle.textContent = `How would you like to authenticate with ${typeNames[sourceType] || sourceType}?`;
    }

    // Update SSO description
    const ssoSignInDesc = document.getElementById('ssoSignInDesc');
    if (ssoSignInDesc) {
      ssoSignInDesc.textContent = `Sign in with your ${typeNames[sourceType] || sourceType} account`;
    }

    // Hide type modal and show auth modal
    const typeModalEl = document.getElementById('sourceTypeModal');
    const authModalEl = document.getElementById('sourceAuthModal');

    if (typeModalEl && authModalEl) {
      const typeModal = bootstrap.Modal.getInstance(typeModalEl);
      if (typeModal) {
        typeModal.hide();
        setTimeout(() => {
          const authModal = new bootstrap.Modal(authModalEl);
          authModal.show();
        }, 300);
      }
    }
  } catch (error) {
    console.error('Error in selectSourceType:', error);
  }
}

function selectAuthMethod(authMethod) {
  console.log('selectAuthMethod called with:', authMethod);
  currentAuthMethod = authMethod;

  try {
    const authModalEl = document.getElementById('sourceAuthModal');

    if (authMethod === 'sso') {
      // For SSO, redirect to Teams/Outlook login immediately
      const authModal = bootstrap.Modal.getInstance(authModalEl);
      if (authModal) {
        authModal.hide();
      }
      // Redirect to OAuth login for this source type
      window.location.href = `/api/sources/auth/sso/initiate?type=${currentSourceType}`;
    } else {
      // For credentials, show the credentials form
      const credentialsModalEl = document.getElementById('sourceAuthCredentialsModal');
      if (authModalEl && credentialsModalEl) {
        const authModal = bootstrap.Modal.getInstance(authModalEl);
        if (authModal) {
          authModal.hide();
          setTimeout(() => {
            openAuthCredentialsForm();
            const credentialsModal = new bootstrap.Modal(credentialsModalEl);
            credentialsModal.show();
          }, 300);
        }
      }
    }
  } catch (error) {
    console.error('Error in selectAuthMethod:', error);
  }
}


function openNewSourceForm() {
  document.getElementById('sourceId').value = '';
  document.getElementById('sourceForm').reset();
  currentSourceType = null;
  currentAuthMethod = null;
  updateSourceConfig();
}

function openAuthCredentialsForm() {
  document.getElementById('sourceId').value = '';
  document.getElementById('sourceType').value = currentSourceType || '';
  document.getElementById('authMethod').value = currentAuthMethod || '';
  document.getElementById('authForm').reset();

  const typeNames = {
    'teams': 'Microsoft Teams',
    'outlook': 'Microsoft Outlook',
    'azure-devops': 'Azure DevOps',
    'github-enterprise': 'GitHub Enterprise',
    'servicenow': 'ServiceNow'
  };

  const title = document.getElementById('authCredentialsTitle');
  if (title) {
    const authLabel = currentAuthMethod === 'sso' ? 'SSO' : 'Credentials';
    title.textContent = `${typeNames[currentSourceType] || currentSourceType} - ${authLabel}`;
  }

  updateAuthCredentialsFields();

  // Reset test message and disable save button
  const testMsg = document.getElementById('testMessage');
  if (testMsg) {
    testMsg.style.display = 'none';
  }
  const saveBtn = document.getElementById('saveAuthBtn');
  if (saveBtn) {
    saveBtn.disabled = true;
  }
}

function updateAuthCredentialsFields() {
  const sourceType = document.getElementById('sourceType').value;
  const fieldsContainer = document.getElementById('authCredentialsFields');

  fieldsContainer.innerHTML = '';

  // Only show credentials fields (SSO goes through OAuth redirect, no form needed)
  const configs = {
    'teams': [
      { name: 'username', label: 'Username', type: 'email', required: true },
      { name: 'password', label: 'Password', type: 'password', required: true },
    ],
    'outlook': [
      { name: 'username', label: 'Email Address', type: 'email', required: true },
      { name: 'password', label: 'Password', type: 'password', required: true },
    ],
    'azure-devops': [
      { name: 'organization_url', label: 'Organization URL', type: 'url', placeholder: 'https://dev.azure.com/yourorg', required: true },
      { name: 'pat', label: 'Personal Access Token', type: 'password', required: true },
    ],
    'github-enterprise': [
      { name: 'enterprise_url', label: 'Enterprise URL', type: 'url', placeholder: 'https://github.enterprise.com', required: true },
      { name: 'token', label: 'Personal Access Token', type: 'password', required: true },
    ],
    'servicenow': [
      { name: 'instance_url', label: 'Instance URL', type: 'url', placeholder: 'https://yourcompany.service-now.com', required: true },
      { name: 'username', label: 'Username', type: 'text', required: true },
      { name: 'password', label: 'Password', type: 'password', required: true },
    ]
  };

  const fields = configs[sourceType] || [];
  fields.forEach(field => {
    const div = document.createElement('div');
    div.className = 'mb-3';
    div.innerHTML = `
      <label for="auth_${field.name}" class="form-label">${field.label}</label>
      <input type="${field.type}" class="form-control" id="auth_${field.name}" name="auth_${field.name}"
             placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''}>
    `;
    fieldsContainer.appendChild(div);
  });
}

async function testAuth() {
  console.log('Testing authentication...');
  const sourceType = document.getElementById('sourceType').value;
  const authMethod = document.getElementById('authMethod').value;
  const testMsg = document.getElementById('testMessage');

  const authData = {};
  document.querySelectorAll('#authCredentialsFields input').forEach(input => {
    const key = input.id.replace('auth_', '');
    authData[key] = input.value;
  });

  try {
    const response = await fetch(`/api/sources/test-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({
        type: sourceType,
        authMethod: authMethod,
        credentials: authData
      })
    });

    const result = await response.json();
    testMsg.style.display = 'block';

    if (result.success) {
      testMsg.className = 'alert alert-success mt-3';
      testMsg.textContent = '✓ Authentication successful!';
      document.getElementById('saveAuthBtn').disabled = false;
    } else {
      testMsg.className = 'alert alert-danger mt-3';
      testMsg.textContent = '✗ Authentication failed: ' + (result.message || 'Unknown error');
      document.getElementById('saveAuthBtn').disabled = true;
    }
  } catch (error) {
    console.error('Error:', error);
    testMsg.style.display = 'block';
    testMsg.className = 'alert alert-danger mt-3';
    testMsg.textContent = '✗ Error testing authentication';
    document.getElementById('saveAuthBtn').disabled = true;
  }
}

async function saveAuth() {
  const sourceType = document.getElementById('sourceType').value;
  const authMethod = document.getElementById('authMethod').value;

  const authData = {};
  document.querySelectorAll('#authCredentialsFields input').forEach(input => {
    const key = input.id.replace('auth_', '');
    authData[key] = input.value;
  });

  // Generate a default name based on provider and timestamp
  const typeNames = {
    'teams': 'Teams',
    'outlook': 'Outlook',
    'azure-devops': 'Azure DevOps',
    'github-enterprise': 'GitHub',
    'servicenow': 'ServiceNow'
  };
  const defaultName = `${typeNames[sourceType] || sourceType} (${new Date().toLocaleDateString()})`;

  const data = {
    name: defaultName,
    type: sourceType,
    authMethod: authMethod,
    enabled: true,
    config: authData
  };

  try {
    const response = await fetch('/api/sources', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Source saved!', 'success');
      const modal = bootstrap.Modal.getInstance(document.getElementById('sourceAuthCredentialsModal'));
      if (modal) modal.hide();
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

    document.getElementById('editSourceId').value = source.id;
    document.getElementById('editSourceName').value = source.name;
    document.getElementById('editSourceEnabled').checked = source.enabled;

    const modal = new bootstrap.Modal(document.getElementById('editSourceModal'));
    modal.show();
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error loading source', 'danger');
  }
}

async function updateSource() {
  const sourceId = document.getElementById('editSourceId').value;
  const name = document.getElementById('editSourceName').value;
  const enabled = document.getElementById('editSourceEnabled').checked;

  try {
    const response = await fetch(`/api/sources/${sourceId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ name, enabled })
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Source updated!', 'success');
      bootstrap.Modal.getInstance(document.getElementById('editSourceModal')).hide();
      loadSources();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    app.notify('Error updating source', 'danger');
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
  // Auth credential modal buttons
  document.getElementById('testAuthBtn')?.addEventListener('click', testAuth);
  document.getElementById('saveAuthBtn')?.addEventListener('click', saveAuth);

  // Edit source modal button
  document.getElementById('updateSourceBtn')?.addEventListener('click', updateSource);

  // SSO button - just shows credentials form
  document.getElementById('ssoSignInBtn')?.addEventListener('click', () => selectAuthMethod('sso'));

  // Provider type buttons in sourceTypeModal
  document.querySelectorAll('.provider-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      console.log('Provider button clicked:', btn.dataset.provider);
      selectSourceType(btn.dataset.provider);
    });
  });

  // Auth method buttons in sourceAuthModal
  document.querySelectorAll('.auth-method-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      console.log('Auth method button clicked:', btn.dataset.method);
      selectAuthMethod(btn.dataset.method);
    });
  });

  // Table actions
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