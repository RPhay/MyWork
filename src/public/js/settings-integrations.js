// Settings > Integrations.
//
// One card today - Azure Entra ID Directory - built so the toggle, status
// line and sync button are generic enough to add a sibling card later
// without restructuring this file.

(function () {
  const el = (id) => document.getElementById(id);

  function renderEntraStatus(status) {
    const statusEl = el('entraDirectoryStatus');
    const toggle = el('entraDirectoryEnabled');
    const syncBtn = el('entraDirectorySyncBtn');
    const syncedAt = el('entraDirectorySyncedAt');
    if (!statusEl || !toggle || !syncBtn || !syncedAt) return;

    toggle.checked = Boolean(status.enabled);
    toggle.disabled = !status.configured;
    syncBtn.disabled = !status.configured || !status.enabled;

    if (!status.configured) {
      statusEl.innerHTML = `<span class="text-danger">Not configured - missing ${status.missing.map(app.escapeHtml).join(', ')} in .env.local.</span>`;
    } else if (!status.enabled) {
      statusEl.innerHTML = '<span class="text-muted">Configured, currently off.</span>';
    } else {
      statusEl.innerHTML = `<span class="text-success">On - ${status.userCount} ${status.userCount === 1 ? 'person' : 'people'} cached.</span>`;
    }

    syncedAt.textContent = status.lastSyncedAt
      ? `Last synced ${app.formatDateTime(status.lastSyncedAt)}`
      : 'Never synced';
  }

  async function loadEntraStatus() {
    try {
      const status = await app.fetchData('/api/integrations/entra/status');
      renderEntraStatus(status);
    } catch (error) {
      const statusEl = el('entraDirectoryStatus');
      if (statusEl) statusEl.innerHTML = `<span class="text-danger">${app.escapeHtml(error.message)}</span>`;
    }
  }

  async function toggleEntraEnabled(enabled) {
    try {
      const status = await app.fetchData('/api/integrations/entra/enabled', {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      });
      renderEntraStatus(status);
    } catch (error) {
      app.notify(error.message, 'danger');
      await loadEntraStatus(); // revert the switch to the real state
    }
  }

  async function syncEntraNow() {
    const syncBtn = el('entraDirectorySyncBtn');
    if (!syncBtn) return;
    const originalHtml = syncBtn.innerHTML;
    syncBtn.disabled = true;
    syncBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Syncing...';
    try {
      const result = await app.fetchData('/api/integrations/entra/sync', { method: 'POST' });
      renderEntraStatus(result.status);
      app.notify(`Synced ${result.count} ${result.count === 1 ? 'person' : 'people'} from Entra ID.`, 'success');
    } catch (error) {
      app.notify(error.message, 'danger');
      await loadEntraStatus();
    } finally {
      syncBtn.innerHTML = originalHtml;
    }
  }

  function init() {
    if (!el('entraDirectoryEnabled')) return;
    loadEntraStatus();

    el('entraDirectoryEnabled').addEventListener('change', (e) => {
      toggleEntraEnabled(e.target.checked);
    });
    el('entraDirectorySyncBtn').addEventListener('click', syncEntraNow);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
