// System Database configuration (app-level, not context-specific)

const NEW_GENERIC_TABLES = ['entity_types', 'entity_type_fields', 'entity_type_relationships', 'entities', 'entity_field_values', 'entity_relationships'];

async function loadSystemDatabaseSubpanel() {
  const panel = document.getElementById("systemDatabasePanel");
  if (!panel) return;

  try {
    const response = await fetch("/api/system-database");
    const result = await response.json();

    if (!result.success) {
      panel.innerHTML = `<div class="alert alert-danger">Failed to load system database config</div>`;
      return;
    }

    const config = result.data;

    if (!config.dbType || !config.config) {
      showSystemDbConfigChoice();
      return;
    }

    showSystemDbConfigured(config.dbType, config.config);
  } catch (error) {
    console.error("Error loading system database config:", error);
    panel.innerHTML = `<div class="alert alert-danger">Error loading configuration: ${error.message}</div>`;
  }
}

function showSystemDbConfigChoice() {
  const panel = document.getElementById("systemDatabasePanel");
  if (!panel) return;

  panel.innerHTML = `
    <div class="alert alert-info">
      <p class="mb-3">No system database connection configured.</p>
      <button type="button" class="btn btn-primary me-2" id="chooseSystemDbMysqlBtn">
        <i class="bi bi-database"></i> Use MySQL/MariaDB
      </button>
      <button type="button" class="btn btn-primary" id="chooseSystemDbMssqlBtn">
        <i class="bi bi-database"></i> Use MSSQL
      </button>
    </div>
  `;

  document.getElementById("chooseSystemDbMysqlBtn").addEventListener("click", () => chooseSystemDbType("mysql"));
  document.getElementById("chooseSystemDbMssqlBtn").addEventListener("click", () => chooseSystemDbType("mssql"));
}

function showSystemDbConfigured(dbType, config) {
  const panel = document.getElementById("systemDatabasePanel");
  if (!panel) return;

  const isMssql = dbType === 'mssql';
  panel.innerHTML = `
    <div class="card mb-3">
      <div class="card-body">
        <h6 class="card-title">Current Settings</h6>
        <div class="row">
          <div class="col-md-6">
            <div class="mb-2">
              <small class="text-muted">Type</small>
              <div>${isMssql ? 'MSSQL' : 'MySQL/MariaDB'}</div>
            </div>
            <div class="mb-2">
              <small class="text-muted">Host</small>
              <div>${app.escapeHtml(config.host)}</div>
            </div>
            <div class="mb-2">
              <small class="text-muted">Port</small>
              <div>${config.port}</div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="mb-2">
              <small class="text-muted">Database</small>
              <div>${app.escapeHtml(config.database)}</div>
            </div>
            <div class="mb-2">
              <small class="text-muted">User</small>
              <div>${app.escapeHtml(config.user)}</div>
            </div>
            <div class="mb-2">
              <small class="text-muted">Password</small>
              <div>${config.hasPassword ? '••••••••' : '(no password)'}</div>
            </div>
          </div>
        </div>
        <div class="mt-3">
          <button type="button" class="btn btn-sm btn-secondary me-2" id="updateSystemDbBtn">
            <i class="bi bi-pencil"></i> Update Settings
          </button>
          <button type="button" class="btn btn-sm btn-primary me-2" id="analyzeAndMigrateBtn" title="Analyze database and perform safe migrations">
            <i class="bi bi-magic"></i> Analyze & Migrate
          </button>
          <button type="button" class="btn btn-sm btn-danger" id="removeSystemDbBtn">
            <i class="bi bi-trash"></i> Remove
          </button>
        </div>
        <div id="systemDbSchemaStatus" class="mt-3"></div>
      </div>
    </div>
  `;

  document.getElementById("updateSystemDbBtn").addEventListener("click", async () => {
    showSystemDbEditForm(dbType, config);
  });
  document.getElementById("analyzeAndMigrateBtn").addEventListener("click", analyzeAndMigrate);
  document.getElementById("removeSystemDbBtn").addEventListener("click", removeSystemDbConfig);
}

function chooseSystemDbType(dbType) {
  const isMssql = dbType === 'mssql';
  showSystemDbEditForm(dbType, {
    host: isMssql ? 'localhost' : '127.0.0.1',
    port: isMssql ? 1433 : 3306,
    database: 'mywork',
    user: '',
    password: '',
    hasPassword: false,
  });
}

function showSystemDbEditForm(dbType, config) {
  const panel = document.getElementById("systemDatabasePanel");
  if (!panel) return;

  const isMssql = dbType === 'mssql';
  const defaultPort = isMssql ? 1433 : 3306;
  const port = config.port || defaultPort;

  panel.innerHTML = `
    <div class="card mb-3">
      <div class="card-body">
        <h6 class="card-title">${isMssql ? 'MSSQL' : 'MySQL/MariaDB'} Configuration</h6>
        <form id="systemDbEditForm" class="mb-3">
          <div class="row">
            <div class="col-md-6">
              <div class="mb-3">
                <label for="systemDbHost" class="form-label">Host</label>
                <input type="text" class="form-control" id="systemDbHost" required value="${app.escapeHtml(config.host || '')}">
              </div>
              <div class="mb-3">
                <label for="systemDbPort" class="form-label">Port</label>
                <input type="number" class="form-control" id="systemDbPort" required value="${port}">
              </div>
            </div>
            <div class="col-md-6">
              <div class="mb-3">
                <label for="systemDbDatabase" class="form-label">Database</label>
                <input type="text" class="form-control" id="systemDbDatabase" required value="${app.escapeHtml(config.database || '')}">
              </div>
              <div class="mb-3">
                <label for="systemDbUser" class="form-label">User</label>
                <input type="text" class="form-control" id="systemDbUser" required value="${app.escapeHtml(config.user || '')}">
              </div>
            </div>
          </div>
          <div class="mb-3">
            <label for="systemDbPassword" class="form-label">Password</label>
            <input type="password" class="form-control" id="systemDbPassword" placeholder="${config.hasPassword ? '••••••••' : 'Enter password'}">
          </div>
          <div class="mb-3">
            <button type="button" class="btn btn-sm btn-secondary me-2" id="testSystemDbBtn">
              <i class="bi bi-plug"></i> Test Connection
            </button>
            <button type="button" class="btn btn-sm btn-danger" id="cancelSystemDbBtn">Cancel</button>
            <span id="systemDbTestStatus" class="ms-2"></span>
          </div>
        </form>
        <div id="systemDbTestResult" class="alert d-none"></div>
        <button type="button" class="btn btn-primary" id="saveSystemDbBtn" disabled>
          <i class="bi bi-check"></i> Save Configuration
        </button>
      </div>
    </div>
  `;

  const testBtn = document.getElementById("testSystemDbBtn");
  const cancelBtn = document.getElementById("cancelSystemDbBtn");
  const saveBtn = document.getElementById("saveSystemDbBtn");
  const testStatus = document.getElementById("systemDbTestStatus");
  const testResult = document.getElementById("systemDbTestResult");

  testBtn.addEventListener("click", async () => {
    testBtn.disabled = true;
    testStatus.textContent = "Testing...";
    testResult.classList.add("d-none");

    const formData = {
      host: document.getElementById("systemDbHost").value,
      port: Number(document.getElementById("systemDbPort").value),
      database: document.getElementById("systemDbDatabase").value,
      user: document.getElementById("systemDbUser").value,
      password: document.getElementById("systemDbPassword").value,
    };

    try {
      const response = await app.fetchRaw(`/api/system-database/test/${dbType}`, {
        method: "POST",
        
        body: JSON.stringify(formData) });
      const result = await response.json();

      if (result.success) {
        testStatus.innerHTML = '<i class="bi bi-check-circle text-success"></i> Connected';
        testResult.classList.remove("d-none");
        testResult.className = "alert alert-success d-none";
        testResult.textContent = result.message;
        testResult.classList.remove("d-none");
        saveBtn.disabled = false;
      } else {
        testStatus.innerHTML = '<i class="bi bi-exclamation-circle text-danger"></i> Failed';
        testResult.classList.remove("d-none");
        testResult.className = "alert alert-danger d-none";
        testResult.textContent = result.message;
        testResult.classList.remove("d-none");
      }
    } catch (error) {
      console.error("Error testing connection:", error);
      testStatus.innerHTML = '<i class="bi bi-exclamation-circle text-danger"></i> Error';
      testResult.classList.remove("d-none");
      testResult.className = "alert alert-danger d-none";
      testResult.textContent = error.message;
      testResult.classList.remove("d-none");
    } finally {
      testBtn.disabled = false;
    }
  });

  cancelBtn.addEventListener("click", () => {
    loadSystemDatabaseSubpanel();
  });

  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    const formData = {
      dbType,
      config: {
        host: document.getElementById("systemDbHost").value,
        port: Number(document.getElementById("systemDbPort").value),
        database: document.getElementById("systemDbDatabase").value,
        user: document.getElementById("systemDbUser").value,
        password: document.getElementById("systemDbPassword").value,
      },
    };

    try {
      const response = await app.fetchRaw("/api/system-database", {
        method: "PUT",
        
        body: JSON.stringify(formData) });
      const result = await response.json();

      if (result.success) {
        app.notify("System database configuration saved", "success");
        loadSystemDatabaseSubpanel();
      } else {
        app.notify("Error: " + result.message, "danger");
        saveBtn.disabled = false;
      }
    } catch (error) {
      console.error("Error saving config:", error);
      app.notify("Error saving configuration", "danger");
      saveBtn.disabled = false;
    }
  });
}

async function removeSystemDbConfig() {
  if (!(await app.confirm("Are you sure? This will reset the system database to the default configuration.", "Reset System Database"))) {
    return;
  }

  try {
    app.notify("System database configuration reset is not yet implemented", "warning");
  } catch (error) {
    console.error("Error removing system database config:", error);
    app.notify("Error removing configuration", "danger");
  }
}

async function analyzeAndMigrate() {
  const btn = document.getElementById("analyzeAndMigrateBtn");
  const statusEl = document.getElementById("systemDbSchemaStatus");

  btn.disabled = true;
  statusEl.innerHTML = '<div class="alert alert-info py-2 px-3"><i class="bi bi-hourglass-split"></i> Analyzing database and performing migrations...</div>';

  try {
    const response = await app.fetchRaw('/api/system-database/schema/analyze-and-migrate', {
      method: 'POST' });

    const result = await response.json();

    if (!result.success) {
      statusEl.innerHTML = `
        <div class="alert alert-danger">
          <h6><i class="bi bi-exclamation-circle"></i> Analysis and Migration Failed</h6>
          <p class="mb-2">${app.escapeHtml(result.message)}</p>
          ${result.data?.errors?.length > 0 ? `
            <div class="small">
              <strong>Errors:</strong>
              <ul class="mb-0">
                ${result.data.errors.map(err => `<li>${app.escapeHtml(err)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      `;
      app.notify("Error: " + result.message, "danger");
      return;
    }

    const report = result.data;
    let html = `
      <div class="alert ${report.success ? 'alert-success' : 'alert-warning'}">
        <h6><i class="bi ${report.success ? 'bi-check-circle' : 'bi-exclamation-circle'}"></i> Unified Schema Analysis & Migration</h6>
        <div class="small">
          <p><strong>Timestamp:</strong> ${new Date(report.timestamp).toLocaleString()}</p>
          <p><strong>Databases Migrated:</strong> ${report.totalDatabasesMigrated}</p>
          ${report.totalErrors > 0 ? `<p class="text-danger"><strong>Errors:</strong> ${report.totalErrors}</p>` : ''}
        </div>

        <!-- System Database Report -->
        ${report.systemDatabase ? `
          <div class="mt-3 mb-3">
            <div class="card">
              <div class="card-header bg-light">
                <h6 class="mb-0"><i class="bi bi-server"></i> System Database</h6>
              </div>
              <div class="card-body small">
                <p class="mb-1"><strong>Status:</strong> ${report.systemDatabase.success ? '<span class="text-success">✓ Success</span>' : '<span class="text-danger">✗ Failed</span>'}</p>
                <p class="mb-2"><strong>Database Type:</strong> ${report.systemDatabase.databaseType === 'mssql' ? 'MSSQL' : 'MySQL/MariaDB'}</p>
                ${report.systemDatabase.actions?.length > 0 ? `
                  <strong>Actions:</strong>
                  <ul class="mb-2">
                    ${report.systemDatabase.actions.map(a => `<li>${app.escapeHtml(a)}</li>`).join('')}
                  </ul>
                ` : ''}
                ${report.systemDatabase.warnings?.length > 0 ? `
                  <div class="alert alert-warning py-2 px-2 mb-2">
                    <strong>Warnings:</strong>
                    <ul class="mb-0">
                      ${report.systemDatabase.warnings.map(w => `<li>${app.escapeHtml(w)}</li>`).join('')}
                    </ul>
                  </div>
                ` : ''}
                ${report.systemDatabase.errors?.length > 0 ? `
                  <div class="alert alert-danger py-2 px-2 mb-0">
                    <strong>Errors:</strong>
                    <ul class="mb-0">
                      ${report.systemDatabase.errors.map(e => `<li>${app.escapeHtml(e)}</li>`).join('')}
                    </ul>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Context Databases Report -->
        ${report.contextDatabases?.length > 0 ? `
          <div class="mt-3 mb-3">
            <h6><i class="bi bi-collection"></i> Context Databases (${report.contextDatabases.length})</h6>
            ${report.contextDatabases.map(ctx => `
              <div class="card mt-2">
                <div class="card-header bg-light">
                  <p class="mb-0"><strong>${app.escapeHtml(ctx.contextName)}</strong> ${ctx.success ? '<span class="badge bg-success">Success</span>' : '<span class="badge bg-danger">Failed</span>'}</p>
                </div>
                <div class="card-body small">
                  ${ctx.actions?.length > 0 ? `
                    <strong>Actions:</strong>
                    <ul class="mb-2">
                      ${ctx.actions.map(a => `<li>${app.escapeHtml(a)}</li>`).join('')}
                    </ul>
                  ` : ''}
                  ${ctx.warnings?.length > 0 ? `
                    <div class="alert alert-warning py-2 px-2 mb-2">
                      <strong>Warnings:</strong>
                      <ul class="mb-0">
                        ${ctx.warnings.map(w => `<li>${app.escapeHtml(w)}</li>`).join('')}
                      </ul>
                    </div>
                  ` : ''}
                  ${ctx.errors?.length > 0 ? `
                    <div class="alert alert-danger py-2 px-2 mb-0">
                      <strong>Errors:</strong>
                      <ul class="mb-0">
                        ${ctx.errors.map(e => `<li>${app.escapeHtml(e)}</li>`).join('')}
                      </ul>
                    </div>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;

    statusEl.innerHTML = html;
    app.notify(report.success ? "Schema migration complete for all databases" : "Schema migration encountered errors", report.success ? "success" : "warning");

  } catch (error) {
    console.error("Error during analysis and migration:", error);
    statusEl.innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-circle"></i> ${app.escapeHtml(error.message)}
      </div>
    `;
    app.notify("Error during analysis and migration", "danger");
  } finally {
    btn.disabled = false;
  }
}

function initSystemDatabase() {
  const systemDatabaseTab = document.getElementById("system-database-tab");
  if (systemDatabaseTab) {
    systemDatabaseTab.addEventListener("click", loadSystemDatabaseSubpanel);
    // Load on initial page load if this tab is active
    if (systemDatabaseTab.classList.contains("active")) {
      loadSystemDatabaseSubpanel();
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSystemDatabase);
} else {
  initSystemDatabase();
}
