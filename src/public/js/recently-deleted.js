// Recently Deleted: the way back from a delete.
//
// Deleting a folder takes everything inside it, which is the intended
// behaviour and exactly why this exists - until now a mis-click was
// unrecoverable. Rows are stamped rather than removed, and everything stamped
// in the same delete restores together, so "undo that" means the folder AND its
// contents rather than one row of it.

(function () {
  let panel = null;

  const call = (path, options) => app.fetchData(`/api/trash${path}`, options);

  function when(stamp) {
    const seconds = Math.floor((Date.now() - new Date(stamp).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  function render(batches) {
    const body = panel.querySelector('.trash-body');
    if (batches.length === 0) {
      body.innerHTML = '<p class="text-muted text-center small" style="padding:24px 0;">Nothing has been deleted.</p>';
      return;
    }
    body.innerHTML = batches.map(b => `
      <div class="trash-row" data-entity-id="${b.lead.id}">
        <span class="trash-icon">${b.lead.isFolder ? '📁' : (b.lead.icon || '')}</span>
        <span class="trash-main">
          <span class="trash-title">${app.escapeHtml(b.lead.title)}</span>
          <span class="trash-meta">
            ${app.escapeHtml(b.lead.typeLabel)} &#183; ${when(b.deletedAt)}${
              b.alsoRemoved > 0
                ? ` &#183; with ${b.alsoRemoved} item${b.alsoRemoved === 1 ? '' : 's'} inside`
                : ''}
          </span>
        </span>
        <button type="button" class="btn btn-sm btn-outline-primary" data-action="restore">Restore</button>
        <button type="button" class="btn btn-sm btn-outline-danger" data-action="purge" title="Delete permanently">Delete forever</button>
      </div>
    `).join('');
  }

  async function refresh() {
    try {
      render(await call(''));
    } catch (error) {
      console.error('Could not load Recently Deleted:', error);
    }
  }

  function close() { panel?.remove(); panel = null; }

  async function open() {
    if (panel) { close(); return; }

    panel = document.createElement('div');
    panel.className = 'trash-overlay';
    panel.innerHTML = `
      <div class="trash-panel" role="dialog" aria-modal="true" aria-label="Recently deleted">
        <div class="trash-head">
          <strong>Recently deleted</strong>
          <button type="button" class="btn-close" aria-label="Close"></button>
        </div>
        <div class="trash-body"></div>
      </div>`;
    document.body.appendChild(panel);

    panel.addEventListener('mousedown', (e) => { if (e.target === panel) close(); });
    panel.querySelector('.btn-close').addEventListener('click', close);

    panel.addEventListener('click', async (e) => {
      const row = e.target.closest('.trash-row');
      if (!row) return;
      const id = row.dataset.entityId;

      if (e.target.closest('[data-action="restore"]')) {
        try {
          const { restored } = await call(`/${id}/restore`, { method: 'POST' });
          app.notify(restored > 1 ? `Restored ${restored} items` : 'Restored', 'success');
          await refresh();
          document.dispatchEvent(new CustomEvent('entity-saved'));
        } catch (error) {
          app.notify(error.message || 'Could not restore that', 'danger');
        }
      }

      if (e.target.closest('[data-action="purge"]')) {
        const sure = await app.confirm(
          'Delete this permanently? This one cannot be undone.', 'Delete forever');
        if (!sure) return;
        try {
          await call(`/${id}`, { method: 'DELETE' });
          app.notify('Deleted permanently', 'success');
          await refresh();
          document.dispatchEvent(new CustomEvent('entity-structure-changed'));
        } catch (error) {
          app.notify(error.message || 'Could not delete that', 'danger');
        }
      }
    });

    await refresh();
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel) close();
  });

  window.RecentlyDeleted = { open, close, refresh };
})();
