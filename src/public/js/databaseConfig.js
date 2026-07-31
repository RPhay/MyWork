function populateProfileForm(type, profile) {
  if (!profile) return;

  document.getElementById(`${type}Host`).value = profile.host || '';
  document.getElementById(`${type}Port`).value = profile.port || '';
  document.getElementById(`${type}Database`).value = profile.database || '';
  document.getElementById(`${type}User`).value = profile.user || '';

  const passwordHint = document.getElementById(`${type}PasswordHint`);
  passwordHint.textContent = profile.hasPassword
    ? 'A password is already saved - leave blank to keep it, or enter a new value to replace it.'
    : 'No password saved yet.';

  if (type === 'mssql') {
    document.getElementById('mssqlEncrypt').checked = profile.encrypt !== false;
    document.getElementById('mssqlTrustCert').checked = !!profile.trustServerCertificate;
  }
}

function updateActiveBadges(activeType) {
  document.getElementById('mysqlActiveBadge').classList.toggle('d-none', activeType !== 'mysql');
  document.getElementById('mssqlActiveBadge').classList.toggle('d-none', activeType !== 'mssql');
  document.getElementById('setMysqlActiveBtn').classList.toggle('d-none', activeType === 'mysql');
  document.getElementById('setMssqlActiveBtn').classList.toggle('d-none', activeType === 'mssql');
}

async function loadDatabaseConfig() {
  try {
    const response = await fetch('/api/database-config');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (!result.success) return;

    const { activeType, mysql, mssql } = result.data;
    populateProfileForm('mysql', mysql);
    populateProfileForm('mssql', mssql);
    updateActiveBadges(activeType);
  } catch (error) {
    console.error('Error loading database config:', error);
  }
}

function collectProfileData(type) {
  const data = {
    host: document.getElementById(`${type}Host`).value,
    port: document.getElementById(`${type}Port`).value || null,
    database: document.getElementById(`${type}Database`).value,
    user: document.getElementById(`${type}User`).value,
    password: document.getElementById(`${type}Password`).value,
  };

  if (type === 'mssql') {
    data.encrypt = document.getElementById('mssqlEncrypt').checked;
    data.trustServerCertificate = document.getElementById('mssqlTrustCert').checked;
  }

  return data;
}

function showTestResult(type, result) {
  const el = document.getElementById(`${type}TestResult`);
  el.textContent = result.message;
  el.className = `small mb-2 ${result.success ? 'text-success' : 'text-danger'}`;
}

async function createSchemaOnTarget(type) {
  const el = document.getElementById(`${type}TestResult`);

  try {
    const response = await fetch(`/api/database-config/${type}/create-schema`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify(collectProfileData(type))
    });
    const result = await response.json();
    if (result.success) {
      el.textContent = 'Connected successfully - MyWork schema created.';
      el.className = 'small mb-2 text-success';
    } else {
      el.textContent = 'Schema creation failed: ' + result.message;
      el.className = 'small mb-2 text-danger';
    }
  } catch (error) {
    console.error('Error creating schema:', error);
    el.textContent = 'Error creating schema';
    el.className = 'small mb-2 text-danger';
  }
}

async function testDatabaseConnection(type) {
  const el = document.getElementById(`${type}TestResult`);
  el.textContent = 'Testing...';
  el.className = 'small mb-2 text-muted';

  try {
    const response = await fetch(`/api/database-config/${type}/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify(collectProfileData(type))
    });
    const result = await response.json();

    if (!result.success) {
      showTestResult(type, result);
      return;
    }

    if (result.schemaExists === true) {
      showTestResult(type, { success: true, message: 'Connected successfully - MyWork schema found.' });
    } else if (result.schemaExists === false) {
      showTestResult(type, { success: true, message: 'Connected successfully - MyWork schema was not found.' });
      const label = type === 'mysql' ? 'MySQL / MariaDB' : 'MSSQL';
      if (await app.confirm(`The MyWork schema was not found in this ${label} database. Create it now?`)) {
        await createSchemaOnTarget(type);
      }
    } else {
      showTestResult(type, { success: true, message: 'Connected successfully (enter a database name to check for the MyWork schema).' });
    }
  } catch (error) {
    console.error('Error testing connection:', error);
    showTestResult(type, { success: false, message: 'Error testing connection' });
  }
}

async function saveDatabaseProfile(type) {
  try {
    const response = await fetch(`/api/database-config/${type}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify(collectProfileData(type))
    });
    const result = await response.json();
    if (result.success) {
      app.notify(`${type === 'mysql' ? 'MySQL / MariaDB' : 'MSSQL'} connection profile saved!`, 'success');
      document.getElementById(`${type}Password`).value = '';
      populateProfileForm(type, result.data);
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error saving profile:', error);
    app.notify('Error saving connection profile', 'danger');
  }
}

async function setActiveDatabaseType(type) {
  try {
    const response = await fetch('/api/database-config/active-type', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ type })
    });
    const result = await response.json();
    if (result.success) {
      updateActiveBadges(result.data.activeType);
      app.notify(
        type === 'mysql'
          ? 'Live database connection switched to this MySQL/MariaDB profile'
          : 'Active database type updated (MSSQL is not queryable yet, so this only records intent)',
        'success'
      );
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error setting active type:', error);
    app.notify('Error setting active type', 'danger');
  }
}

function initDatabaseConfigEventListeners() {
  document.getElementById('testMysqlBtn').addEventListener('click', () => testDatabaseConnection('mysql'));
  document.getElementById('saveMysqlBtn').addEventListener('click', () => saveDatabaseProfile('mysql'));
  document.getElementById('setMysqlActiveBtn').addEventListener('click', () => setActiveDatabaseType('mysql'));

  document.getElementById('testMssqlBtn').addEventListener('click', () => testDatabaseConnection('mssql'));
  document.getElementById('saveMssqlBtn').addEventListener('click', () => saveDatabaseProfile('mssql'));
  document.getElementById('setMssqlActiveBtn').addEventListener('click', () => setActiveDatabaseType('mssql'));
}

function initDatabaseConfig() {
  initDatabaseConfigEventListeners();
  loadDatabaseConfig();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDatabaseConfig);
} else {
  initDatabaseConfig();
}
