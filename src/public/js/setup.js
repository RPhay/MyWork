const csrfToken = document.body.dataset.csrfToken;

let activeDbType = "mysql";

// This page is intentionally standalone (no main.js), so it doesn't have
// access to the shared app.escapeHtml used elsewhere - a small local copy.
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

function collectSetupData() {
  if (activeDbType === "mssql") {
    return {
      dbType: "mssql",
      host: document.getElementById("mssqlHost").value,
      port: document.getElementById("mssqlPort").value || null,
      database: document.getElementById("mssqlDatabase").value,
      user: document.getElementById("mssqlUser").value,
      password: document.getElementById("mssqlPassword").value,
    };
  }
  return {
    dbType: "mysql",
    host: document.getElementById("setupHost").value,
    port: document.getElementById("setupPort").value || null,
    database: document.getElementById("setupDatabase").value,
    user: document.getElementById("setupUser").value,
    password: document.getElementById("setupPassword").value,
  };
}

function showStep(step) {
  document
    .getElementById("setupConnectStep")
    .classList.toggle("d-none", step !== "connect");
  document
    .getElementById("setupSchemaStep")
    .classList.toggle("d-none", step !== "schema");
  document
    .getElementById("setupDoneStep")
    .classList.toggle("d-none", step !== "done");
}

async function postJson(url, body) {
  // Standalone page (no main.js, so no app.fetchRaw) - attach the CSRF
  // token the same way main.js's fetchRaw does.
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
    },
    body: JSON.stringify(body || {}),
  });
  // If the server returned an HTML error page, surface the status rather than
  // a confusing JSON parse error.
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, message: `Server error (${response.status})` };
  }
}

function finishAndRedirect() {
  showStep("done");
  setTimeout(() => {
    window.location.href = "/";
  }, 900);
}

async function handleConnect() {
  const btn = document.getElementById("setupConnectBtn");
  const statusEl = document.getElementById("setupConnectStatus");
  const data = collectSetupData();

  if (!data.host || !data.user) {
    statusEl.innerHTML = `<span class="text-danger">${activeDbType === "mssql" ? "Server" : "Host"} and User are required.</span>`;
    return;
  }

  btn.disabled = true;
  statusEl.innerHTML = '<span class="text-muted">Connecting…</span>';

  try {
    const result = await postJson("/api/setup/connect", data);
    if (!result.success) {
      statusEl.innerHTML = `<span class="text-danger">${escapeHtml(result.message)}</span>`;
      return;
    }

    if (result.schemaExists === true) {
      finishAndRedirect();
      return;
    }

    // schemaExists is false or null (no database name given yet) - either
    // way there's nothing usable yet, so ask about creating it.
    showStep("schema");
  } catch (error) {
    console.error("Error connecting:", error);
    statusEl.innerHTML =
      '<span class="text-danger">Error connecting - please try again.</span>';
  } finally {
    btn.disabled = false;
  }
}

async function handleCreateSchema() {
  const btn = document.getElementById("setupCreateSchemaBtn");
  const statusEl = document.getElementById("setupSchemaStatus");
  btn.disabled = true;
  statusEl.innerHTML = '<span class="text-muted">Creating schema…</span>';

  try {
    const result = await postJson(
      "/api/setup/create-schema",
      collectSetupData(),
    );
    if (!result.success) {
      statusEl.innerHTML = `<span class="text-danger">${escapeHtml(result.message)}</span>`;
      return;
    }
    finishAndRedirect();
  } catch (error) {
    console.error("Error creating schema:", error);
    statusEl.innerHTML = `<span class="text-danger">${escapeHtml(error.message || "Error creating schema - please try again.")}</span>`;
  } finally {
    btn.disabled = false;
  }
}

function handleSkip() {
  window.location.href = "/";
}

document
  .getElementById("setupConnectBtn")
  .addEventListener("click", handleConnect);
document
  .getElementById("setupCreateSchemaBtn")
  .addEventListener("click", handleCreateSchema);
document.getElementById("setupSkipBtn").addEventListener("click", handleSkip);

document.querySelectorAll("#setupDbTypeTabs [data-db-type]").forEach((btn) => {
  btn.addEventListener("click", () => {
    activeDbType = btn.dataset.dbType;
    document
      .querySelectorAll("#setupDbTypeTabs [data-db-type]")
      .forEach((b) => {
        b.classList.toggle("active", b === btn);
      });
    document
      .getElementById("mysqlForm")
      .classList.toggle("d-none", activeDbType !== "mysql");
    document
      .getElementById("mssqlForm")
      .classList.toggle("d-none", activeDbType !== "mssql");
    // Reset connect step state when switching tabs
    document.getElementById("setupConnectStatus").innerHTML = "";
    showStep("connect");
  });
});

// Resuming mid-setup: the connection already succeeded on a previous load
// (e.g. the user reloaded before deciding on schema creation), so skip
// straight to the schema step instead of asking them to reconnect.
if (
  document.body.dataset.initialConnected === "true" &&
  document.body.dataset.initialSchemaExists === "false"
) {
  showStep("schema");
}
