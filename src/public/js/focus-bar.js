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
              draggable="true"
              data-entity-id="${item.id}"
              ${item.color ? `style="background:${app.escapeHtml(item.color)};"` : ''}
              title="${app.escapeHtml(item.typeLabel)} &#183; ${app.escapeHtml(RAG_TITLE[item.rag] || '')}: ${app.escapeHtml(item.why || '')}\n${item.running ? 'Click to stop the clock' : 'Click to start the clock'} &#183; right-click to remove">
        <span class="focus-icon" aria-hidden="true">${app.escapeHtml(item.icon || '')}</span>
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

  // The palette is configured in Settings > Miscellaneous > Focus colours, where
  // each colour is given a name, so this menu can say what a colour MEANS
  // rather than showing swatches to be memorised. Falls back to a sensible set
  // when nothing has been configured.
  const DEFAULT_CHIP_COLOURS = [
    { color: '#ffe0e0', label: 'Blocked' },
    { color: '#ffedd5', label: 'Waiting' },
    { color: '#fff7cc', label: 'Needs attention' },
    { color: '#dcfce7', label: 'On track' },
    { color: '#dbeafe', label: 'In review' },
    { color: '#ede9fe', label: 'Someday' },
    { color: '#e5e7eb', label: 'Parked' },
  ];

  function chipColours() {
    try {
      const saved = JSON.parse(localStorage.getItem('focusColourPalette') || 'null');
      if (Array.isArray(saved) && saved.length) return saved.filter(c => c && c.color);
    } catch { /* fall through */ }
    return DEFAULT_CHIP_COLOURS;
  }

  function openMenu(x, y, entityId) {
    closeMenu();
    menuEl = document.createElement('div');
    menuEl.className = 'context-menu focus-context-menu';

    const swatches = document.createElement('div');
    swatches.className = 'focus-swatches';
    // "None" first, then the configured colours.
    for (const { color: hex, label } of [{ color: '#ffffff', label: 'None' }, ...chipColours()]) {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'focus-swatch';
      sw.title = label || hex;
      sw.style.background = hex;
      sw.addEventListener('click', async () => {
        closeMenu();
        try {
          // White is "no colour" rather than a colour, so the chip goes back to
          // its default instead of being painted the same shade as the page.
          const color = hex === '#ffffff' ? null : hex;
          await app.fetchRaw(`/api/focus/${entityId}/color`, {
            method: 'PATCH', body: JSON.stringify({ color }),
          });
          await refresh();
        } catch { app.notify('Could not change the colour', 'danger'); }
      });
      swatches.appendChild(sw);
    }
    menuEl.appendChild(swatches);
    menuEl.insertAdjacentHTML('beforeend', '<hr style="margin:4px 0;">');

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

    // The CLOCK is what starts and stops the clock. Clicking anywhere on the
    // chip used to do it, so nudging one while reading the bar silently began
    // timing something.
    bar.addEventListener('click', async (e) => {
      const time = e.target.closest('.focus-time');
      if (!time) return;
      const chip = time.closest('.focus-chip');
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

    // Left/right, not up/down: the bar lays its chips out horizontally, so the
    // midpoint that decides "before or after" is the vertical one.
    function chipDropTarget(e) {
      const chip = e.target.closest('.focus-chip');
      if (!chip) return null;
      const r = chip.getBoundingClientRect();
      return { chip, before: e.clientX < r.left + r.width / 2 };
    }

    function clearChipIndicators() {
      bar.querySelectorAll('.focus-chip').forEach(c =>
        c.classList.remove('chip-drop-before', 'chip-drop-after'));
    }

    function chipOrderAfterDrop(e, movingId) {
      const ids = [...bar.querySelectorAll('.focus-chip')].map(c => c.dataset.entityId);
      const from = ids.indexOf(String(movingId));
      if (from === -1) return null;
      ids.splice(from, 1);

      const target = chipDropTarget(e);
      if (!target) return [...ids, String(movingId)];       // dropped past the end
      let to = ids.indexOf(target.chip.dataset.entityId);
      if (to === -1) return null;
      if (!target.before) to += 1;
      ids.splice(to, 0, String(movingId));
      return ids;
    }

    bar.addEventListener('dragstart', (e) => {
      const chip = e.target.closest('.focus-chip');
      if (!chip) return;
      beginDrag(e, { 'focus-chip-id': chip.dataset.entityId });
      chip.classList.add('chip-dragging');
    });

    bar.addEventListener('dragend', () => {
      bar.querySelectorAll('.chip-dragging').forEach(c => c.classList.remove('chip-dragging'));
      clearChipIndicators();
    });

    bar.addEventListener('dragover', (e) => {
      const reordering = e.dataTransfer.types.includes('focus-chip-id');
      acceptDrop(e, reordering ? 'move' : 'copy');
      if (reordering) {
        clearChipIndicators();
        const target = chipDropTarget(e);
        if (target) target.chip.classList.add(target.before ? 'chip-drop-before' : 'chip-drop-after');
        return;
      }
      showTarget(true);
    });

    bar.addEventListener('dragleave', (e) => {
      if (!bar.contains(e.relatedTarget)) showTarget(false);
    });

    bar.addEventListener('drop', async (e) => {
      e.preventDefault();
      showTarget(false);
      bar.classList.remove('drop-ready');
      clearChipIndicators();

      // A chip dragged along the bar is a REORDER, not a pin. Distinguished by
      // the payload the chip publishes, so a row dragged in from a list still
      // pins exactly as before.
      const movingId = e.dataTransfer.getData('focus-chip-id');
      if (movingId) {
        const order = chipOrderAfterDrop(e, movingId);
        if (!order) return;
        try {
          await app.fetchRaw('/api/focus/order', {
            method: 'PATCH', body: JSON.stringify({ orderedIds: order }),
          });
          await refresh();
        } catch { app.notify('Could not reorder the focus bar', 'danger'); }
        return;
      }

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
