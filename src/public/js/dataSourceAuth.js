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
    const modalEl = document.getElementById('dataSourceAuthModal');
    const modal = new bootstrap.Modal(modalEl);

    // Dismissing this modal - the X, Escape, or a click outside it - used to
    // leave the promise pending forever: nothing but the two auth buttons
    // ever called resolve/reject, so ensureSourceAuth's caller hung with no
    // way to know the user simply closed the dialog. Resolving `false` here
    // says "not authenticated" the same way an explicit cancel would.
    //
    // `loginWithCredentials` also hides THIS modal, to hand off to its own -
    // that is a handoff, not a dismissal, so it marks the resolver
    // `handingOff` first and this listener honours that instead of settling
    // the promise out from under the flow that is still in progress.
    modalEl.addEventListener('hidden.bs.modal', () => {
      const resolver = window.DSAuth.sourceAuthResolvers?.[sourceId];
      if (resolver && !resolver.handingOff) {
        delete window.DSAuth.sourceAuthResolvers[sourceId];
        resolver.resolve(false);
      }
    }, { once: true });

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
      rejectSourceAuth(sourceId, new Error('No context selected'));
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
      rejectSourceAuth(sourceId, new Error(result.message || 'Failed to initiate login'));
      return;
    }

    // Redirect to SSO auth. The page unloads here, which is its own kind of
    // settling - nothing left running still holds the promise - so there is
    // nothing to resolve on the success path.
    window.location.href = result.authUrl + `&redirectTarget=/api/sources/${sourceId}/auth/sso/callback`;
  } catch (error) {
    console.error('SSO login error:', error);
    app.notify('Error initiating SSO: ' + error.message, 'danger');
    rejectSourceAuth(sourceId, error);
  }
}

// Settles a still-pending promptForSourceAuth() promise with a failure,
// rather than leaving the SSO branch's errors to rely on the user dismissing
// the modal by hand before ensureSourceAuth's caller ever hears back.
function rejectSourceAuth(sourceId, error) {
  const resolver = window.DSAuth.sourceAuthResolvers?.[sourceId];
  if (resolver) {
    delete window.DSAuth.sourceAuthResolvers[sourceId];
    resolver.reject(error);
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
            <button type="button" class="btn btn-sm btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-sm btn-outline-success" onclick="window.DSAuth.saveCredentials(${sourceId})">
              Save & Login
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Hide auth modal - a handoff to the credentials modal below, not a
  // dismissal, so the auth modal's own hidden.bs.modal listener must not
  // read this as "the user cancelled" and resolve the promise false.
  const resolver = window.DSAuth.sourceAuthResolvers?.[sourceId];
  if (resolver) resolver.handingOff = true;
  const authModal = bootstrap.Modal.getInstance(document.getElementById('dataSourceAuthModal'));
  if (authModal) authModal.hide();

  // Show credentials modal
  const existing = document.getElementById('credentialsModal');
  if (existing) existing.remove();

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const credentialsModalEl = document.getElementById('credentialsModal');
  const credentialsModal = new bootstrap.Modal(credentialsModalEl);

  // The handoff continues here: dismissing THIS modal without saving is the
  // point at which the flow is actually abandoned, so it is this modal's
  // hidden.bs.modal - not the auth modal's - that settles the promise false
  // for a cancel from the credentials step. saveCredentials() already
  // resolves and clears the resolver on success, so this only fires for an
  // actual cancel.
  credentialsModalEl.addEventListener('hidden.bs.modal', () => {
    const r = window.DSAuth.sourceAuthResolvers?.[sourceId];
    if (r) {
      delete window.DSAuth.sourceAuthResolvers[sourceId];
      r.resolve(false);
    }
  }, { once: true });

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
