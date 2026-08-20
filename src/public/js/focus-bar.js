// The focus bar: the two or three things you are working on right now, pinned
// to the top of every page whatever tab is open.
//
// Elapsed time is never stored by this file. The server returns banked seconds
// plus the moment a running clock started, and the tick below only re-renders
// the derived number - so a reload, a second tab, or a laptop left shut
// overnight all agree, and closing the browser cannot lose or invent time.

(function () {
  const TICK_MS = 1000;
  const REFRESH_MS = 60000;

  let items = [];
  let ticker = null;
  let menuEl = null;

  const RAG_TITLE = {
    red: 'Needs attention',
    amber: 'Needs watching',
    green: 'On track',
    grey: 'No status recorded',
  };

  function formatDuration(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    // Hours only once there are any: "4:07" reads faster than "0:04:07".
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${m}:${String(sec).padStart(2, '0')}`;
  }

  // The server's number is a snapshot; this is what it has become since.
  function liveSeconds(item) {
    if (!item.running || !item.startedAt) return item.seconds;
    const drift = Math.floor((Date.now() - item.startedAt) / 1000);
    return (item.seconds - item.serverDrift) + Math.max(0, drift);
  }

  // app.fetch carries the CSRF header, reads the body even on a 4xx, and
  // throws with the server's own message - so there is nothing left for a
  // local wrapper to add.
  const call = (path, options) => app.fetchData(`/api/focus${path}`, options);

  function setItems(data) {
    items = (data || []).map(i => ({
      ...i,
      // Freeze how much of the server's total was already elapsed at fetch
      // time, so the local tick adds to it rather than double-counting.
      serverDrift: i.running && i.startedAt
        ? Math.floor((Date.now() - i.startedAt) / 1000)
        : 0,
    }));
    render();
  }

  function render() {
    const bar = document.getElementById('focusBar');
    if (!bar) return;

    if (items.length === 0) {
      bar.innerHTML = '';
      bar.classList.remove('has-items');
      stopTicking();
      return;
    }

    bar.classList.add('has-items');
    bar.innerHTML = items.map(item => `
      <button type="button" class="focus-chip ${item.running ? 'running' : ''}"
              data-entity-id="${item.id}"
              title="${app.escapeHtml(item.typeLabel)} &#183; ${app.escapeHtml(RAG_TITLE[item.rag] || '')}: ${app.escapeHtml(item.why || '')}\n${item.running ? 'Click to stop the clock' : 'Click to start the clock'} &#183; right-click to remove">
        <span class="focus-rag rag-${item.rag}" aria-hidden="true"></span>
        <span class="focus-title">${app.escapeHtml(item.title)}</span>
        <span class="focus-time">${formatDuration(liveSeconds(item))}</span>
      </button>
    `).join('');

    if (items.some(i => i.running)) startTicking(); else stopTicking();
  }

  // Only the numbers change while a clock runs, so the whole bar is not rebuilt
  // - rebuilding it would drop the right-click menu and fight the hover state.
  function tick() {
    for (const item of items) {
      const el = document.querySelector(`.focus-chip[data-entity-id="${item.id}"] .focus-time`);
      if (el) el.textContent = formatDuration(liveSeconds(item));
    }
  }

  function startTicking() { if (!ticker) ticker = setInterval(tick, TICK_MS); }
  function stopTicking() { if (ticker) { clearInterval(ticker); ticker = null; } }

  function closeMenu() { menuEl?.remove(); menuEl = null; }

  function openMenu(x, y, entityId) {
    closeMenu();
    menuEl = document.createElement('div');
    menuEl.className = 'context-menu focus-context-menu';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'context-menu-item';
    btn.innerHTML = '<span>✕</span><span>Remove from focus bar</span>';
    btn.addEventListener('click', async () => {
      closeMenu();
      try {
        setItems(await call(`/${entityId}`, { method: 'DELETE' }));
      } catch (error) {
        app.notify(error.message || 'Could not remove that', 'danger');
      }
    });
    menuEl.appendChild(btn);
    document.body.appendChild(menuEl);
    const rect = menuEl.getBoundingClientRect();
    menuEl.style.left = `${Math.min(x, window.innerWidth - rect.width - 8)}px`;
    menuEl.style.top = `${Math.min(y, window.innerHeight - rect.height - 8)}px`;
  }

  async function refresh() {
    try {
      setItems(await call(''));
    } catch (error) {
      console.error('Could not load the focus bar:', error);
    }
  }

  function init() {
    const bar = document.getElementById('focusBar');
    if (!bar) return;

    bar.addEventListener('click', async (e) => {
      const chip = e.target.closest('.focus-chip');
      if (!chip) return;
      try {
        setItems(await call(`/${chip.dataset.entityId}/toggle`, { method: 'POST' }));
      } catch (error) {
        app.notify(error.message || 'Could not change the clock', 'danger');
      }
    });

    bar.addEventListener('contextmenu', (e) => {
      const chip = e.target.closest('.focus-chip');
      if (!chip) return;
      e.preventDefault();
      openMenu(e.clientX, e.clientY, chip.dataset.entityId);
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.focus-context-menu')) closeMenu();
    });

    // Drop a row here from any page. Nothing is copied and nothing is linked -
    // the bar shows the record itself, for display and RAG, exactly as pinning
    // from the context menu does. The bar is thin and often empty, so it grows
    // a visible landing strip while a drag is in flight rather than being a
    // target you have to aim at blind.
    const showTarget = (on) => bar.classList.toggle('drop-target', on);

    document.addEventListener('dragstart', () => bar.classList.add('drop-ready'));
    document.addEventListener('dragend', () => {
      bar.classList.remove('drop-ready');
      showTarget(false);
    });

    bar.addEventListener('dragover', (e) => {
      acceptDrop(e, 'copy');
      showTarget(true);
    });

    bar.addEventListener('dragleave', (e) => {
      if (!bar.contains(e.relatedTarget)) showTarget(false);
    });

    bar.addEventListener('drop', async (e) => {
      e.preventDefault();
      showTarget(false);
      bar.classList.remove('drop-ready');

      // Every draggable row in the app publishes `id`; board cards publish
      // theirs the same way. Anything else is not a record and is ignored.
      const entityId = e.dataTransfer.getData('id');
      const type = e.dataTransfer.getData('type');
      if (!entityId || !type) return;

      if (window.FocusBar.has(entityId)) {
        app.notify('Already on the focus bar', 'info');
        return;
      }
      try {
        await window.FocusBar.add(entityId);
        app.notify('Pinned to the focus bar', 'success');
      } catch (error) {
        app.notify(error.message || 'Could not pin that', 'danger');
      }
    });

    // A pinned record can be renamed or finished from anywhere, and something
    // else may pin an item; both are covered by re-reading on the same events
    // the rest of the app already publishes.
    document.addEventListener('entity-saved', refresh);
    document.addEventListener('focus-changed', refresh);

    // A long-lived page drifts from the server (another tab, another device).
    setInterval(refresh, REFRESH_MS);

    refresh();
  }

  // Anything can pin a record without knowing how the bar works.
  window.FocusBar = {
    refresh,
    async add(entityId) {
      const data = await call('', { method: 'POST', body: JSON.stringify({ entityId }) });
      setItems(data);
      return data;
    },
    has(entityId) { return items.some(i => String(i.id) === String(entityId)); },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
