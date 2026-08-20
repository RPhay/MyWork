/**
 * Data source authentication utilities
 * Handles on-demand SSO/credential login when accessing data sources
 */

let dataSourceAuthSessions = {};

/**
 * Check if a data source has valid authentication
 * If not, prompt for auth before proceeding
 */
async function ensureSourceAuth(sourceId) {
  try {
    // Check if we have cached auth for this source in session
    if (dataSourceAuthSessions[sourceId]) {
      return dataSourceAuthSessions[sourceId];
    }

    // Get auth status from server
    const response = await fetch(`/api/sources/${sourceId}/auth/status`);
    const result = await response.json();

    if (!result.success) {
      throw new Error('Failed to check auth status');
    }

    const authStatus = result.data;

    // If has valid auth, cache it and return
    if (authStatus.length > 0 && authStatus[0].isValid) {
      dataSourceAuthSessions[sourceId] = authStatus[0];
      return authStatus[0];
    }

    // No valid auth, need to prompt user
    return await promptForSourceAuth(sourceId);
  } catch (error) {
    console.error('Error checking source auth:', error);
    throw error;
  }
}

/**
 * Prompt user to authenticate to a data source
 */
async function promptForSourceAuth(sourceId) {
  return new Promise((resolve, reject) => {
    // Create modal for auth selection
    const modalHtml = `
      <div class="modal fade" id="dataSourceAuthModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Authentication Required</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <p>This data source requires authentication. Choose an authentication method:</p>
              <div id="authMethods" class="mt-3"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Remove existing modal if present
    const existing = document.getElementById('dataSourceAuthModal');
    if (existing) existing.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Populate auth methods
    const authMethodsDiv = document.getElementById('authMethods');
    authMethodsDiv.innerHTML = `
      <button class="btn btn-outline-primary w-100 mb-2" onclick="window.DSAuth.loginWithSSO(${sourceId})">
        Sign in with Entra ID
      </button>
      <button class="btn btn-outline-secondary w-100" onclick="window.DSAuth.loginWithCredentials(${sourceId})">
        Sign in with Username/Password
      </button>
    `;

    // Store resolve/reject for callbacks
    window.DSAuth = window.DSAuth || {};
    window.DSAuth.sourceAuthResolvers = window.DSAuth.sourceAuthResolvers || {};
    window.DSAuth.sourceAuthResolvers[sourceId] = { resolve, reject };

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('dataSourceAuthModal'));
    modal.show();
  });
}

/**
 * Initiate SSO login for data source
 */
async function loginWithSSO(sourceId) {
  try {
    // Get current context
    const contextId = document.getElementById('contextSwitcherBtn')?.dataset.contextId;
    if (!contextId) {
      app.notify('No context selected', 'warning');
      return;
    }

    const response = await app.fetchRaw(`/api/sources/${sourceId}/auth/sso/login`, {
      method: 'POST',
      
      body: JSON.stringify({
        contextId,
        provider: 'entra-id'
      })
    });

    const result = await response.json();
    if (!result.success) {
      app.notify('Failed to initiate login: ' + result.message, 'danger');
      return;
    }

    // Redirect to SSO auth
    window.location.href = result.authUrl + `&redirectTarget=/api/sources/${sourceId}/auth/sso/callback`;
  } catch (error) {
    console.error('SSO login error:', error);
    app.notify('Error initiating SSO: ' + error.message, 'danger');
  }
}

/**
 * Show credentials login form
 */
function loginWithCredentials(sourceId) {
  const modalHtml = `
    <div class="modal fade" id="credentialsModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Enter Credentials</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">Username</label>
              <input type="text" class="form-control" id="credUsername" placeholder="Username">
            </div>
            <div class="mb-3">
              <label class="form-label">Password</label>
              <input type="password" class="form-control" id="credPassword" placeholder="Password">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="window.DSAuth.saveCredentials(${sourceId})">
              Save & Login
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Hide auth modal
  const authModal = bootstrap.Modal.getInstance(document.getElementById('dataSourceAuthModal'));
  if (authModal) authModal.hide();

  // Show credentials modal
  const existing = document.getElementById('credentialsModal');
  if (existing) existing.remove();

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const credentialsModal = new bootstrap.Modal(document.getElementById('credentialsModal'));
  credentialsModal.show();
}

/**
 * Save credentials and authenticate
 */
async function saveCredentials(sourceId) {
  try {
    const username = document.getElementById('credUsername').value;
    const password = document.getElementById('credPassword').value;

    if (!username || !password) {
      app.notify('Please enter username and password', 'warning');
      return;
    }

    const response = await app.fetchRaw(`/api/sources/${sourceId}/auth/credentials`, {
      method: 'POST',
      
      body: JSON.stringify({ username, password })
    });

    const result = await response.json();
    if (!result.success) {
      app.notify('Failed to save credentials: ' + result.message, 'danger');
      return;
    }

    // Hide modals
    const credentialsModal = bootstrap.Modal.getInstance(document.getElementById('credentialsModal'));
    if (credentialsModal) credentialsModal.hide();

    // Resolve the auth promise
    const resolver = window.DSAuth.sourceAuthResolvers?.[sourceId];
    if (resolver) {
      resolver.resolve({ sourceId, authType: 'credentials', metadata: { username } });
      delete window.DSAuth.sourceAuthResolvers[sourceId];
    }

    app.notify('Authenticated successfully', 'success');
  } catch (error) {
    console.error('Credentials error:', error);
    app.notify('Error: ' + error.message, 'danger');
  }
}

// Export to window for onclick handlers
window.DSAuth = {
  ensureSourceAuth,
  promptForSourceAuth,
  loginWithSSO,
  loginWithCredentials,
  saveCredentials
};
