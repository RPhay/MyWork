// The focus bar: what you are working on right now, pinned to the top of
// every page whatever tab is open, grouped into 0-n "monitors" configured in
// Settings > Miscellaneous > Focus monitors.
//
// Elapsed time is never stored by this file. The server returns banked seconds
// plus the moment a running clock started, and the tick below only re-renders
// the derived number - so a reload, a second tab, or a laptop left shut
// overnight all agree, and closing the browser cannot lose or invent time.

(function () {
  const TICK_MS = 1000;
  const REFRESH_MS = 60000;

  let items = [];
  // count: 0 until the first refresh() lands the server-derived value - never
  // actually rendered (render() is only reached through setItems(), which
  // only runs after data has arrived), but 0 is the honest shape: no monitor
  // exists until something is pinned to one.
  let monitorSettings = {
    count: 0,
    showNumbers: false,
    maxMonitors: 32,
    monitors: Array.from({ length: 32 }, () => ({ label: '', layout: 'side-by-side' })),
  };
  let ticker = null;
  let menuEl = null;

  // The server owns the bound and ships it with every settings read; the
  // fallback only covers the first paint, before that read lands.
  const monitorLimit = () => Number(monitorSettings.maxMonitors) || 32;

  // How many monitors exist RIGHT NOW: the highest monitor number anything in
  // `items` currently occupies. Derived from `items` rather than read off
  // monitorSettings.count, which the server computes the same way but which
  // this client only refetches on refresh() - a pin/unpin/move updates
  // `items` immediately (setItems, after every call()) without necessarily
  // triggering a refresh(), so trusting the last-fetched settings value here
  // would leave a just-created or just-emptied monitor invisible until the
  // next refresh happened to land.
  const currentMonitorCount = () => items.reduce((max, i) => Math.max(max, i.monitor || 0), 0);

  // Which stacked monitor the pointer is currently over, 1-based or null.
  // Driven by our own mouseover/mouseout rather than left to CSS :hover,
  // because a render() rebuilds the bar's whole innerHTML (any click on a
  // chip does this) and a fresh DOM node does not inherit :hover just for
  // occupying the same screen position the cursor already sat on - the
  // stack would silently collapse under a pointer that never moved. Reapplied
  // after every render() instead, so it survives the rebuild.
  let hoveredMonitor = null;

  // The monitor whose right-click menu is currently open, 1-based or null.
  // Its stack must stay revealed for as long as the menu is up, independent
  // of hover - the menu itself sits outside the monitor's box, so opening it
  // moves the pointer off the zone and would otherwise close the stack out
  // from under the very menu that's acting on it.
  let menuOpenMonitor = null;

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

  // True between a chip's dragstart and its dragend. The bar re-reads from the
  // server on a timer and rebuilds every chip, so a refresh landing mid-drag
  // deletes the element under the cursor: the drag dies and the item appears to
  // vanish. Redraws are held until the gesture finishes.
  let dragging = false;
  let redrawPending = false;

  function setItems(data) {
    items = (data || []).map(i => ({
      ...i,
      // Freeze how much of the server's total was already elapsed at fetch
      // time, so the local tick adds to it rather than double-counting.
      serverDrift: i.running && i.startedAt
        ? Math.floor((Date.now() - i.startedAt) / 1000)
        : 0,
    }));
    if (dragging) { redrawPending = true; return; }
    render();
  }

  // clockDisabled blocks STARTING the clock - a buried item in a stack has
  // to be dragged to the top first, rather than timed in place. It never
  // applies to an item that's already running: a clock started before it got
  // reordered out of first place must still be stoppable from right where it
  // sits, or there would be no way to stop it without starting a different
  // one first.
  // `buried`: a stack item that isn't the top one. A click anywhere on it
  // promotes it rather than acting on it in place - see the click handler in
  // init() - so its hint and hover affordance are about that, not the clock.
  // `width`: an explicit pixel width (from widestChipWidth below), forced
  // onto every chip in a stack so they all read as one uniform column rather
  // than each sized to its own title - the widest one still governs, but
  // every other one stretches to match it instead of leaving ragged space.
  function chipHtml(item, { buried = false, width = null } = {}) {
    const clickHint = buried
      ? 'Click to bring to the top of the stack'
      : (item.running ? 'Click to stop the clock' : 'Click to start the clock');

    const styleParts = [];
    if (item.color) styleParts.push(`background:${item.color}`);
    if (width) styleParts.push(`width:${width}px`);
    const styleAttr = styleParts.length ? ` style="${app.escapeHtml(styleParts.join(';'))}"` : '';

    return `
      <button type="button" class="focus-chip ${item.running ? 'running' : ''} ${buried ? 'buried' : ''}"
              draggable="true"
              data-entity-id="${item.id}"${styleAttr}
              title="${app.escapeHtml(item.typeLabel)} &#183; ${app.escapeHtml(RAG_TITLE[item.rag] || '')}: ${app.escapeHtml(item.why || '')}\n${clickHint} &#183; right-click to remove">
        <span class="focus-icon" aria-hidden="true">${app.escapeHtml(item.icon || '')}</span>
        <span class="focus-title">${app.escapeHtml(item.title)}</span>
        <span class="focus-time">${formatDuration(liveSeconds(item))}</span>
      </button>
    `;
  }

  // The natural (unconstrained, still capped by .focus-chip's own max-width)
  // width of the widest of these - measured off-screen rather than assumed,
  // since it depends on each item's title/icon. Used so a stacked monitor's
  // box is wide enough for whichever item is widest, not just whichever one
  // happens to be on top - otherwise the box's width changed every time a
  // different item got promoted, and a wider buried item was squeezed down
  // to the top item's width the moment it was revealed.
  function widestChipWidth(zoneItems) {
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:absolute; visibility:hidden; top:-9999px; left:-9999px; ' +
      'display:flex; flex-direction:column; align-items:flex-start;';
    probe.innerHTML = zoneItems.map(item => chipHtml(item)).join('');
    document.body.appendChild(probe);
    const width = Math.max(0, ...[...probe.children].map(el => el.getBoundingClientRect().width));
    probe.remove();
    return width;
  }

  // Stacked with more than one item: only the first ever sits in the box's
  // own normal flow (so the navbar's height never changes, whether the stack
  // is open or not), and the rest live in their own wrapper that CSS reveals
  // as an overlay hanging below it - see .focus-monitor-stack-rest in
  // main.css. No toggle, no click, no open/closed state to track here.
  function monitorZoneHtml(n, zoneItems, config) {
    const layout = config.layout === 'stacked' ? 'stacked' : 'side-by-side';

    let itemsHtml;
    let itemsStyle = '';
    if (layout === 'stacked' && zoneItems.length > 1) {
      const width = Math.ceil(widestChipWidth(zoneItems));
      itemsStyle = ` style="min-width:${width}px;"`;
      itemsHtml = `${chipHtml(zoneItems[0], { width })}
        <div class="focus-monitor-stack-rest">${zoneItems.slice(1)
          .map(item => chipHtml(item, { buried: true, width }))
          .join('')}</div>`;
    } else {
      itemsHtml = zoneItems.map(chipHtml).join('');
    }

    return `
      <div class="focus-monitor ${zoneItems.length === 0 ? 'empty' : ''}" data-monitor="${n}" data-layout="${layout}">
        ${monitorSettings.showNumbers ? `<span class="focus-monitor-number">${n}</span>` : ''}
        ${config.label ? `<span class="focus-monitor-label">${app.escapeHtml(config.label)}</span>` : ''}
        <div class="focus-monitor-items"${itemsStyle}>${itemsHtml}</div>
      </div>
    `;
  }

  // A monitor is exactly as real as what's pinned to it - `count` (server-
  // derived, see focusMonitorsService.js) is the highest monitor number
  // anything currently occupies, so this loop only ever draws populated
  // zones. Nothing pinned anywhere means count is 0, and 0 means exactly what
  // it says: nothing is drawn, not an empty strip, not a drop hint - the bar
  // leaves the navbar entirely. Whatever is pinned stays pinned in the
  // database regardless; only the drawing depends on count.
  function render() {
    const bar = document.getElementById('focusBar');
    if (!bar) return;

    const count = currentMonitorCount();
    if (count === 0) {
      // Nothing pinned, so there are no monitors to draw - but the bar is also
      // the ONLY thing a drag can land on to create the first one, and an
      // element the stylesheet has hidden cannot receive a drop. Drawing
      // literally nothing here made that a dead end: unpin the last chip and
      // dragging could never pin anything again, because the only target for
      // the gesture had left the page. So the empty bar keeps a landing strip,
      // which CSS reveals only while a drag carrying something pinnable is
      // actually in flight - no empty boxes sitting in the navbar at rest,
      // which is what deriving the count was for, and no vanished target.
      bar.innerHTML = '<div class="focus-bar-landing">Drop here to focus</div>';
      bar.classList.add('no-monitors');
      stopTicking();
      return;
    }
    bar.classList.remove('no-monitors');
    const byMonitor = new Map();
    for (const item of items) {
      const n = Math.min(Math.max(item.monitor || 1, 1), count);
      if (!byMonitor.has(n)) byMonitor.set(n, []);
      byMonitor.get(n).push(item);
    }

    const zones = [];
    for (let n = 1; n <= count; n++) {
      const zoneItems = (byMonitor.get(n) || []).slice().sort((a, b) => a.slot - b.slot);
      const config = monitorSettings.monitors[n - 1] || { label: '', layout: 'side-by-side' };
      zones.push(monitorZoneHtml(n, zoneItems, config));
    }
    bar.innerHTML = zones.join('');

    // Carry the hover-revealed stack over the rebuild - see hoveredMonitor.
    if (hoveredMonitor) {
      bar.querySelector(`.focus-monitor[data-monitor="${hoveredMonitor}"]`)?.classList.add('force-open');
    }
    // Same, for a monitor whose right-click menu is still open - see menuOpenMonitor.
    if (menuOpenMonitor) {
      bar.querySelector(`.focus-monitor[data-monitor="${menuOpenMonitor}"]`)?.classList.add('force-open');
    }

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

  function closeMenu() {
    menuEl?.remove();
    menuEl = null;
    if (menuOpenMonitor) {
      const n = menuOpenMonitor;
      menuOpenMonitor = null;
      // Leave it open if the pointer happens to already be back over it -
      // only force it shut if hover isn't the reason it's still open.
      if (hoveredMonitor !== n) {
        document.querySelector(`.focus-monitor[data-monitor="${n}"]`)?.classList.remove('force-open');
      }
    }
  }

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

  // One menu, right-clicking anything in the bar: a chip's own choices
  // (colour, remove) when the click landed on one, then the monitor's
  // (add/remove/layout) always - a monitor's own space can be too small to
  // reliably right-click around a chip that fills it, especially the top
  // item of a stack, so its choices have to be reachable from the chip too
  // rather than needing a second right-click somewhere else.
  //
  // `entityId` is set only when a chip was clicked. `monitor` is the 1-based
  // monitor the click landed in - always set when a chip was clicked (every
  // chip lives in one), and null only when the click landed on the bar's own
  // empty space between/around the boxes, where "Add a monitor" still makes
  // sense but "remove"/"layout" need a specific "this monitor" and are left
  // off.
  function openContextMenu(x, y, { entityId, monitor }) {
    closeMenu();
    menuEl = document.createElement('div');
    menuEl.className = 'context-menu focus-context-menu';

    if (entityId) {
      const swatches = document.createElement('div');
      swatches.className = 'focus-swatches';
      // "None" first, then the configured colours. A row per colour, showing
      // the colour AND what it means: a grid of bare swatches made you
      // remember which shade you had decided was "Blocked", and naming them
      // is the entire point of configuring the palette in Settings.
      for (const { color: hex, label } of [{ color: '#ffffff', label: 'None' }, ...chipColours()]) {
        const sw = document.createElement('button');
        sw.type = 'button';
        sw.className = 'context-menu-item focus-swatch-row';
        sw.title = label || hex;
        sw.innerHTML = `<span class="focus-swatch" style="background:${hex};"></span>`
          + `<span class="focus-swatch-label">${app.escapeHtml(label || hex)}</span>`;
        sw.addEventListener('click', async () => {
          closeMenu();
          try {
            // White is "no colour" rather than a colour, so the chip goes
            // back to its default instead of being painted the page's own shade.
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

      const removeChipBtn = document.createElement('button');
      removeChipBtn.type = 'button';
      removeChipBtn.className = 'context-menu-item';
      removeChipBtn.innerHTML = '<span>✕</span><span>Remove from focus bar</span>';
      removeChipBtn.addEventListener('click', async () => {
        closeMenu();
        try {
          setItems(await call(`/${entityId}`, { method: 'DELETE' }));
        } catch (error) {
          app.notify(error.message || 'Could not remove that', 'danger');
        }
      });
      menuEl.appendChild(removeChipBtn);

      menuEl.insertAdjacentHTML('beforeend', '<hr style="margin:4px 0;">');
    }

    // There is deliberately no "+ Add a monitor" item here any more: a
    // monitor that starts out empty is exactly the persistent, pre-configured
    // box this feature was rebuilt to stop showing. Dragging something onto
    // the bar's own empty space (below) is the only way to make one - the
    // monitor and its first pin arrive together.

    if (monitor) {
      const removeMonitorBtn = document.createElement('button');
      removeMonitorBtn.type = 'button';
      removeMonitorBtn.className = 'context-menu-item';
      removeMonitorBtn.disabled = currentMonitorCount() <= 1;
      removeMonitorBtn.innerHTML = '<span>✕</span><span>Remove this monitor</span>';
      removeMonitorBtn.addEventListener('click', async () => {
        closeMenu();
        try {
          const data = await app.fetchData(`/api/focus-monitors/${monitor}/remove`, { method: 'POST' });
          await refresh();
          if (data.movedCount) app.notify(`${data.movedCount} pinned item(s) moved to Monitor 1`, 'info');
        } catch (error) {
          app.notify(error.message || 'Could not remove that monitor', 'danger');
        }
      });
      menuEl.appendChild(removeMonitorBtn);

      menuEl.insertAdjacentHTML('beforeend', '<hr style="margin:4px 0;">');

      const config = monitorSettings.monitors[monitor - 1] || { layout: 'side-by-side' };
      for (const [layout, label] of [['side-by-side', 'Side by side'], ['stacked', 'Stacked']]) {
        const current = config.layout === layout;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'context-menu-item';
        btn.disabled = current;
        btn.innerHTML = `<span>${current ? '✓' : ''}</span><span>${label}</span>`;
        btn.addEventListener('click', async () => {
          closeMenu();
          try {
            const monitors = monitorSettings.monitors.slice();
            monitors[monitor - 1] = { ...monitors[monitor - 1], layout };
            await app.fetchData('/api/focus-monitors', { method: 'PUT', body: JSON.stringify({ monitors }) });
            await refresh();
          } catch {
            app.notify('Could not change the layout', 'danger');
          }
        });
        menuEl.appendChild(btn);
      }
    }

    document.body.appendChild(menuEl);
    const rect = menuEl.getBoundingClientRect();
    menuEl.style.left = `${Math.min(x, window.innerWidth - rect.width - 8)}px`;
    menuEl.style.top = `${Math.min(y, window.innerHeight - rect.height - 8)}px`;
  }

  async function refresh() {
    try {
      const [freshItems, freshSettings] = await Promise.all([
        call(''),
        app.fetchData('/api/focus-monitors', {}),
      ]);
      if (freshSettings) monitorSettings = freshSettings;
      setItems(freshItems);
    } catch (error) {
      console.error('Could not load the focus bar:', error);
    }
  }

  function init() {
    const bar = document.getElementById('focusBar');
    if (!bar) return;

    // The CLOCK is what starts and stops the clock - clicking anywhere else
    // on a chip used to start/stop it, so nudging one while reading the bar
    // silently began timing something. A buried stack item is the one
    // exception: any click on it at all promotes it to the top instead.
    bar.addEventListener('click', async (e) => {
      const chip = e.target.closest('.focus-chip');
      if (!chip) return;

      const zone = chip.closest('.focus-monitor');
      const stacked = zone?.dataset.layout === 'stacked';
      const isFirst = stacked && zone.querySelector('.focus-chip') === chip;

      // A buried stack item: ANY click on it - the clock included - promotes
      // it to the top instead of acting on it in place, the same "this is
      // what I'm looking at now" gesture dragging it to the front performs.
      // Nothing here starts or stops a clock in the same click that moved
      // it; time it with a second click once it has actually arrived at the
      // top, same as any other pinned item.
      if (stacked && !isFirst) {
        const ids = [...zone.querySelectorAll('.focus-chip')].map(c => c.dataset.entityId);
        ids.splice(ids.indexOf(chip.dataset.entityId), 1);
        ids.unshift(chip.dataset.entityId);
        try {
          await app.fetchRaw(`/api/focus/monitors/${zone.dataset.monitor}/order`, {
            method: 'PATCH', body: JSON.stringify({ orderedIds: ids }),
          });
          await refresh();
        } catch { app.notify('Could not bring that to the top', 'danger'); }
        return;
      }

      // Only the clock is a control: clicking the chip elsewhere must not
      // start or stop timing.
      const time = e.target.closest('.focus-time');
      if (!time) return;
      try {
        setItems(await call(`/${chip.dataset.entityId}/toggle`, { method: 'POST' }));
      } catch (error) {
        app.notify(error.message || 'Could not change the clock', 'danger');
      }
    });

    // Two clicks on a chip goes to the record: its own page, that row selected,
    // its editor open. Done by asking for the tab and letting the machinery
    // that already exists do the rest - `focus` scrolls to and highlights the
    // row (search uses it), and the remembered-editor key is what reopens an
    // editor after a load, so setting it here means the tab restores the record
    // rather than needing a second, parallel way in.
    bar.addEventListener('dblclick', (e) => {
      const chip = e.target.closest('.focus-chip');
      if (!chip) return;
      e.preventDefault();
      const id = chip.dataset.entityId;
      const item = items.find(i => String(i.id) === String(id));
      if (!item?.typeSlug) return;

      try {
        localStorage.setItem('entityOpenEditor', JSON.stringify({ typeSlug: item.typeSlug, id: String(id) }));
        // Whatever else was on screen, the point of this gesture is that record.
        localStorage.setItem('typePaneVisible', 'true');
      } catch { /* storage off: the tab still opens, just without the editor */ }

      window.location.href = `/?tab=${encodeURIComponent(item.typeSlug)}&focus=${encodeURIComponent(id)}`;
    });

    // Hovering a stacked monitor reveals the rest of its items - see
    // hoveredMonitor above for why this is tracked in JS rather than left to
    // CSS :hover alone. mouseover/mouseout (not mouseenter/mouseleave)
    // because only the bubbling pair can be delegated through one listener
    // on the bar instead of rebinding after every render().
    bar.addEventListener('mouseover', (e) => {
      const zone = e.target.closest('.focus-monitor');
      if (!zone) return;
      const n = Number(zone.dataset.monitor);
      if (hoveredMonitor === n) return;
      hoveredMonitor = n;
      zone.classList.add('force-open');
    });

    bar.addEventListener('mouseout', (e) => {
      const zone = e.target.closest('.focus-monitor');
      if (!zone || zone.contains(e.relatedTarget)) return;   // still inside it
      const n = Number(zone.dataset.monitor);
      // A menu open on this monitor keeps it revealed regardless of hover -
      // see menuOpenMonitor.
      if (n !== menuOpenMonitor) zone.classList.remove('force-open');
      if (hoveredMonitor === n) hoveredMonitor = null;
    });

    // One right-click, one menu - on a chip or a monitor's own empty space.
    // NOT the bar's own slack around a narrow set of monitors any more - that
    // used to offer "Add a monitor", which no longer exists (see
    // openContextMenu): dragging is the only way to create one now, so a menu
    // with nothing in it would just be a blank popup.
    bar.addEventListener('contextmenu', (e) => {
      const chip = e.target.closest('.focus-chip');
      const zone = e.target.closest('.focus-monitor');
      if (!chip && !zone) return;
      e.preventDefault();
      const monitor = zone ? Number(zone.dataset.monitor) : null;
      // Pin the stack open for as long as this menu is showing - the menu
      // itself renders outside the monitor's box, so the pointer leaving the
      // zone to reach it must not be read as "no longer interested".
      if (monitor) {
        menuOpenMonitor = monitor;
        zone.classList.add('force-open');
      }
      openContextMenu(e.clientX, e.clientY, {
        entityId: chip ? chip.dataset.entityId : null,
        monitor,
      });
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.focus-context-menu')) closeMenu();
    });

    // Drop a row here from any page, onto whichever monitor it lands on.
    // Nothing is copied and nothing is linked - the bar shows the record
    // itself, for display and RAG, exactly as pinning from the context menu
    // does. The monitors are always visible, so there is no landing strip to
    // reveal first - only the specific zone under the cursor highlights.
    document.addEventListener('dragend', clearZoneTargets);

    function clearZoneTargets() {
      bar.querySelectorAll('.focus-monitor.drop-target').forEach(z => z.classList.remove('drop-target'));
      bar.classList.remove('new-monitor-target');
    }

    // A stacked zone lays its items out top-to-bottom (even collapsed - the
    // hidden ones just have no height), so before/after is a top/bottom
    // question there; a side-by-side zone is left/right.
    function chipDropTarget(e) {
      const chip = e.target.closest('.focus-chip');
      if (!chip) return null;
      const zone = chip.closest('.focus-monitor');
      const stacked = zone?.dataset.layout === 'stacked';
      const r = chip.getBoundingClientRect();
      const before = stacked
        ? e.clientY < r.top + r.height / 2
        : e.clientX < r.left + r.width / 2;
      return { chip, before };
    }

    function clearChipIndicators() {
      bar.querySelectorAll('.focus-chip').forEach(c =>
        c.classList.remove('chip-drop-before', 'chip-drop-after'));
    }

    // The order the target monitor's chips should end up in, with the moved
    // chip inserted at the drop point. Reads the target zone's own DOM, not
    // the source zone's - for a cross-monitor move the chip has not appeared
    // there yet, so it is added rather than assumed present.
    function chipOrderAfterDrop(e, movingId, targetMonitor) {
      const zone = bar.querySelector(`.focus-monitor[data-monitor="${targetMonitor}"]`);
      if (!zone) return null;
      const ids = [...zone.querySelectorAll('.focus-chip')].map(c => c.dataset.entityId);
      const from = ids.indexOf(String(movingId));
      if (from !== -1) ids.splice(from, 1);

      const target = chipDropTarget(e);
      if (!target || !zone.contains(target.chip)) return [...ids, String(movingId)];
      let to = ids.indexOf(target.chip.dataset.entityId);
      if (to === -1) return [...ids, String(movingId)];
      if (!target.before) to += 1;
      ids.splice(to, 0, String(movingId));
      return ids;
    }

    bar.addEventListener('dragstart', (e) => {
      const chip = e.target.closest('.focus-chip');
      if (!chip) return;
      dragging = true;
      beginDrag(e, { 'focus-chip-id': chip.dataset.entityId });
      chip.classList.add('chip-dragging');
    });

    bar.addEventListener('dragend', () => {
      dragging = false;
      bar.querySelectorAll('.chip-dragging').forEach(c => c.classList.remove('chip-dragging'));
      clearChipIndicators();
      // Anything the timer wanted to draw while the gesture was in flight.
      if (redrawPending) { redrawPending = false; render(); }
    });

    bar.addEventListener('dragover', (e) => {
      const reordering = e.dataTransfer.types.includes('focus-chip-id');
      acceptDrop(e, reordering ? 'move' : 'copy');

      const zone = e.target.closest('.focus-monitor');
      clearZoneTargets();
      // Only a drag the bar actually knows how to place - a pinned chip, or a
      // draggable row/card - earns the "drop here to make a new monitor" cue.
      // An unrelated drag (page text, an image, anything else) still gets a
      // drop-target zone highlight but never this, so it can't promise a
      // monitor that a drop would then have nothing to put in it.
      const placeable = reordering || (e.dataTransfer.types.includes('id') && e.dataTransfer.types.includes('type'));
      if (zone) {
        zone.classList.add('drop-target');
      } else if (placeable && currentMonitorCount() < monitorLimit()) {
        // The bar's own empty space, not any existing monitor - dropping
        // here makes a new one for whatever is let go, so it gets its own
        // cue rather than looking like nothing is there to land on.
        bar.classList.add('new-monitor-target');
      }

      if (reordering) {
        clearChipIndicators();
        const target = chipDropTarget(e);
        if (target) target.chip.classList.add(target.before ? 'chip-drop-before' : 'chip-drop-after');
      }
    });

    bar.addEventListener('dragleave', (e) => {
      if (!bar.contains(e.relatedTarget)) clearZoneTargets();
    });

    bar.addEventListener('drop', async (e) => {
      e.preventDefault();
      clearZoneTargets();
      clearChipIndicators();

      const zoneEl = e.target.closest('.focus-monitor');
      let targetMonitor = zoneEl ? Number(zoneEl.dataset.monitor) : null;

      // Read the payload before doing anything with side effects. A drag the
      // bar doesn't recognise (not a pinned chip, not a draggable row/card -
      // page text, an image, anything else the browser lets through) must
      // bail out here rather than after a monitor's already been created for
      // it, or every such miss over the bar's empty space leaves an orphaned
      // empty monitor behind with nothing to put in it.
      const movingId = e.dataTransfer.getData('focus-chip-id');
      const entityId = e.dataTransfer.getData('id');
      const type = e.dataTransfer.getData('type');
      if (!movingId && !(entityId && type)) return;

      // Dropped on the bar's own empty space, not any existing monitor - make
      // a new one for it, the same one the dragover cue above promised. There
      // is nothing to create ahead of time: the next monitor number is simply
      // one past the highest in use, and it becomes real the moment the pin/
      // move call below lands something on it - see focusMonitorsService.js's
      // header comment for why this isn't a server round-trip any more.
      if (targetMonitor === null) {
        const count = currentMonitorCount();
        if (count >= monitorLimit()) {
          app.notify(`Already at the maximum of ${monitorLimit()} monitors`, 'danger');
          return;
        }
        targetMonitor = count + 1;
      }

      // A chip dragged along the bar is a REORDER (or a move to a different
      // monitor), not a pin. Distinguished by the payload the chip publishes,
      // so a row dragged in from a list still pins exactly as before.
      if (movingId) {
        dragging = false;      // the gesture is over; this redraw is wanted
        const sourceItem = items.find(i => String(i.id) === String(movingId));
        const sourceMonitor = sourceItem ? sourceItem.monitor : targetMonitor;

        try {
          if (sourceMonitor !== targetMonitor) {
            await app.fetchRaw(`/api/focus/${movingId}/monitor`, {
              method: 'PATCH', body: JSON.stringify({ monitor: targetMonitor }),
            });
          }
          const order = chipOrderAfterDrop(e, movingId, targetMonitor);
          if (order) {
            await app.fetchRaw(`/api/focus/monitors/${targetMonitor}/order`, {
              method: 'PATCH', body: JSON.stringify({ orderedIds: order }),
            });
          }
          await refresh();
        } catch { app.notify('Could not move that on the focus bar', 'danger'); }
        return;
      }

      // Every draggable row in the app publishes `id`; board cards publish
      // theirs the same way - already confirmed present above.
      if (window.FocusBar.has(entityId)) {
        app.notify('Already on the focus bar', 'info');
        return;
      }
      try {
        await window.FocusBar.add(entityId, targetMonitor);
        app.notify('Pinned to the focus bar', 'success');
      } catch (error) {
        app.notify(error.message || 'Could not pin that', 'danger');
      }
    });

    // Dragging a pinned chip off the bar and dropping it anywhere else on the
    // page unpins it - the same action as "Remove from focus bar" on the
    // context menu, just by gesture. Needs its own dragover on the document:
    // without a preventDefault somewhere along the way, the browser refuses
    // the drop before it ever reaches a 'drop' listener.
    // Whether a gesture is carrying something the bar could actually pin - the
    // same test the bar's own dragover uses to decide if it may promise a new
    // monitor. Anything else (page text, an image) must leave the empty bar
    // hidden rather than offering a landing strip a drop could not fill.
    const carriesPinnable = (dt) => !!dt && (dt.types.includes('focus-chip-id')
      || (dt.types.includes('id') && dt.types.includes('type')));

    document.addEventListener('dragover', (e) => {
      if (e.dataTransfer.types.includes('focus-chip-id')) e.preventDefault();
      // Driven from the DOCUMENT, not the bar: when nothing is pinned the bar
      // is hidden, and a hidden element receives no dragover of its own to
      // reveal itself with. See the empty-bar branch in render().
      if (carriesPinnable(e.dataTransfer)) bar.classList.add('drag-active');
    });

    // The strip lasts exactly as long as the gesture, however it ends -
    // dropped, cancelled with Escape, or let go outside the window.
    const hideLanding = () => bar.classList.remove('drag-active');
    document.addEventListener('dragend', hideLanding);
    document.addEventListener('drop', hideLanding);

    document.addEventListener('drop', async (e) => {
      if (bar.contains(e.target)) return;      // the bar handles its own drops
      const movingId = e.dataTransfer.getData('focus-chip-id');
      if (!movingId) return;
      e.preventDefault();
      dragging = false;
      try {
        setItems(await call(`/${movingId}`, { method: 'DELETE' }));
      } catch (error) {
        app.notify(error.message || 'Could not remove that', 'danger');
      }
    });

    // A pinned record can be renamed or finished from anywhere, and something
    // else may pin an item; all three are covered by re-reading on the same
    // events the rest of the app already publishes.
    document.addEventListener('entity-saved', refresh);
    document.addEventListener('focus-changed', refresh);
    document.addEventListener('focus-monitors-changed', refresh);

    // A long-lived page drifts from the server (another tab, another device).
    setInterval(refresh, REFRESH_MS);

    refresh();
  }

  // Anything can pin a record without knowing how the bar works.
  window.FocusBar = {
    refresh,
    async add(entityId, monitor = 1) {
      const data = await call('', { method: 'POST', body: JSON.stringify({ entityId, monitor }) });
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
