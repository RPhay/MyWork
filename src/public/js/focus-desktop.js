// Runs only on /pip - the transparent, chromeless always-on-top window the
// desktop wrapper (desktop/) floats a focus monitor in. On screen it IS the
// monitor square, nothing else, and it deliberately supports exactly four
// gestures:
//
//   - click the TIMER: start/stop the clock (focus-bar.js's own handler);
//   - click the top chip's ICON on a stacked monitor: open/close the stack;
//   - right-press AND MOVE, anywhere: drag the window (the OS drag loop -
//     driving setPosition from mousemove fails here, WKWebView reports
//     screenX/Y against a stale window origin once the window moves);
//   - a quick right-click, anywhere: a one-item menu, "Close all pop-outs".
//
// Everything else the bar can normally do - double-click to the record,
// dragging chips, the colours/layout menu, hover-revealing stacks - is
// blocked in the capture phase before focus-bar.js sees it. Those all live
// in the browser's navbar, which this window mirrors but does not replace.
//
// ?monitor=N narrows the page to one monitor's zone (pure CSS, so
// focus-bar.js keeps rendering the whole bar and knows nothing about it).
// In a plain browser tab (no __TAURI__) none of this engages and the page
// is just a minimal view of the bar.
(function () {
  'use strict';

  const monitor = Number(document.body.dataset.monitor) || null;
  if (monitor) {
    const st = document.createElement('style');
    st.textContent = `#focusBar .focus-monitor:not([data-monitor="${monitor}"]) { display: none; }`;
    document.head.appendChild(st);
  }

  const T = window.__TAURI__;
  if (!T) return;

  const getWin = () => T.window.getCurrentWindow();
  const onTimer = (el) => !!el.closest?.('.focus-time');
  const onIcon = (el) => !!el.closest?.('.focus-icon');
  const onMenu = (el) => !!el.closest?.('.focus-context-menu');

  // Which stacked monitors are held open (by their icon having been
  // clicked). Kept here, not as bare classes, because focus-bar.js rebuilds
  // the bar's DOM on every state change and a class alone would be dropped -
  // fit() reapplies these after every rebuild. Persisted so a stack left
  // open STAYS open: through re-renders, and through the window being
  // closed and popped out again.
  //
  // The key is scoped to THIS window's identity (its monitor, or 'all'):
  // every wrapper process shares one storage area, so an unscoped key made
  // the windows clobber each other's state - monitor pop-outs must be
  // independent of one another, monitor 1's own window included when the
  // all-monitors window is also showing monitor 1.
  const stackKey = `pipStackOpen:${monitor || 'all'}`;
  const openStacks = new Set();
  try {
    for (const n of JSON.parse(localStorage.getItem(stackKey) || '[]')) {
      openStacks.add(Number(n));
    }
  } catch { /* fresh start */ }
  function rememberStacks() {
    try {
      localStorage.setItem(stackKey, JSON.stringify([...openStacks]));
    } catch { /* storage off: open state just won't survive a re-pop */ }
  }

  // ---- window sizing ------------------------------------------------------
  // The window hugs the monitor square: re-measured whenever the bar
  // re-renders (characterData too - a running clock's text widens the chip),
  // and grown while the close-all menu is showing so it isn't clipped.
  let queued = false;
  function fit() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(async () => {
      queued = false;
      for (const n of openStacks) {
        document.querySelector(`.focus-monitor[data-monitor="${n}"]`)?.classList.add('force-open');
      }
      const root = document.getElementById('pipRoot');
      if (!root) return;
      const r = root.getBoundingClientRect();
      let width = Math.ceil(r.width);
      let height = Math.ceil(r.height);
      // A measure taken before the bar has rendered is ~0x0, and sizing a
      // window to that makes it unfindable. Wait for the real render - the
      // MutationObserver calls back the moment it lands.
      if (width < 20 || height < 10) return;
      const menu = document.querySelector('.focus-context-menu');
      if (menu) {
        const m = menu.getBoundingClientRect();
        width = Math.max(width, Math.ceil(m.right) + 4);
        height = Math.max(height, Math.ceil(m.bottom) + 4);
      }
      try {
        await getWin().setSize(new T.dpi.LogicalSize(width, height));
      } catch { /* the window may be mid-close */ }
    });
  }

  function init() {
    const bar = document.getElementById('focusBar');
    if (bar) {
      new MutationObserver(fit)
        .observe(bar, { childList: true, subtree: true, characterData: true, attributes: true });
    }
    fit();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ---- virtual monitors (macOS Spaces) ------------------------------------
  // A pop-out lives ONLY on the Space it was opened on (the one the browser
  // was on) unless this is turned on - then it follows across every Space.
  // Per-window choice, remembered like the stack state.
  const spacesKey = `pipAllSpaces:${monitor || 'all'}`;
  let allSpaces = false;
  try { allSpaces = localStorage.getItem(spacesKey) === '1'; } catch { /* default off */ }
  function applyAllSpaces() {
    getWin().setVisibleOnAllWorkspaces(allSpaces).catch(() => {});
    try { localStorage.setItem(spacesKey, allSpaces ? '1' : '0'); } catch { /* volatile */ }
  }
  if (allSpaces) applyAllSpaces();

  // The list of virtual monitors (macOS Spaces), provided by the Rust side
  // (main.rs `spaces` - private API, so an OS update may make this list
  // empty; the menu then simply has no Space entries). Requested at startup
  // and again on every menu open so it tracks Spaces being added/removed;
  // the menu renders from the latest answer.
  let spaceList = [];
  T.event.listen('pip-spaces-list', (e) => { spaceList = Array.isArray(e.payload) ? e.payload : []; });
  const requestSpaces = () => T.event.emit('pip-spaces-request', '').catch(() => {});
  requestSpaces();

  // ---- the pop-out menu ---------------------------------------------------
  // The bar's OWN context menu (focus-bar.js openContextMenu) - the same
  // colour/remove/layout items right-click means in the navbar, minus the
  // pop-out entries (focus-bar hides those on this page: already popped) -
  // with the window's own entries appended: move to a virtual monitor, show
  // on all of them, close all pop-outs.
  function closePipMenu() {
    window.FocusBar.closeMenu();
    fit();
  }

  function openPipMenu(x, y, target) {
    const chip = target?.closest?.('.focus-chip');
    const zone = target?.closest?.('.focus-monitor');
    window.FocusBar.openContextMenu(x, y, {
      entityId: chip ? chip.dataset.entityId : null,
      monitor: zone ? Number(zone.dataset.monitor) : null,
    });
    const menuEl = document.querySelector('.focus-context-menu');
    if (!menuEl) return;

    menuEl.insertAdjacentHTML('beforeend', '<hr style="margin:4px 0;">');

    // One entry per virtual monitor: pick one, the window moves there.
    // Hidden while "show on all" is on, where a home Space is meaningless.
    if (!allSpaces && spaceList.length > 1) {
      for (const space of spaceList) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'context-menu-item';
        btn.disabled = !!space.current;
        btn.innerHTML = `<span>${space.current ? '✓' : '⇢'}</span><span>Move to ${app.escapeHtml(space.label)}</span>`;
        btn.addEventListener('click', () => {
          closePipMenu();
          T.event.emit('pip-space-move', String(space.id)).catch(() => {});
        });
        menuEl.appendChild(btn);
      }
      menuEl.insertAdjacentHTML('beforeend', '<hr style="margin:4px 0;">');
    }
    requestSpaces();

    const spacesBtn = document.createElement('button');
    spacesBtn.type = 'button';
    spacesBtn.className = 'context-menu-item';
    spacesBtn.innerHTML = `<span>${allSpaces ? '✓' : ''}</span><span>Show on all virtual monitors</span>`;
    spacesBtn.addEventListener('click', () => {
      closePipMenu();
      allSpaces = !allSpaces;
      applyAllSpaces();
    });
    menuEl.appendChild(spacesBtn);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'context-menu-item';
    closeBtn.innerHTML = '<span>✕</span><span>Close all pop-outs</span>';
    closeBtn.addEventListener('click', () => {
      closePipMenu();
      // The server kills every wrapper process, this one included - the
      // response may never arrive, which is success, not failure.
      app.fetchData('/api/pip-window/close-all', { method: 'POST' }).catch(() => {});
    });
    menuEl.appendChild(closeBtn);

    fit();
  }

  // ---- gestures -----------------------------------------------------------
  // Right button: press-and-move drags the window, press-and-release opens
  // the close-all menu. The drag is only committed on the first move, so a
  // motionless click stays a click.
  let rightPress = null; // {x, y} while the right button is down and undecided

  document.addEventListener('mousedown', (e) => {
    if (e.button !== 2) return;
    if (onMenu(e.target)) return;
    e.preventDefault();
    // target rides along: what was under the press decides which of the
    // bar menu's entries (chip colours/remove, monitor layout) apply.
    rightPress = { x: e.clientX, y: e.clientY, target: e.target };
  });

  // 'pip-move' begin/end are plain Tauri events main.rs listens for: the
  // Rust side follows the real cursor and moves the window. startDragging()
  // was tried and silently does nothing (macOS will not start its native
  // drag session from a right-mouse event), and custom invoke commands are
  // ACL-blocked for remote-URL windows - events are neither.
  let moving = false;
  const endMove = () => {
    if (!moving) return;
    moving = false;
    T.event.emit('pip-move', 'end').catch(() => {});
  };

  document.addEventListener('mousemove', (e) => {
    if (!rightPress) return;
    if (!(e.buttons & 2)) { rightPress = null; endMove(); return; }
    if (Math.abs(e.clientX - rightPress.x) + Math.abs(e.clientY - rightPress.y) < 3) return;
    rightPress = null;
    moving = true;
    T.event.emit('pip-move', 'begin').catch((err) => {
      moving = false;
      fetch(`/pip-debug?ev=begin-move-fail&msg=${encodeURIComponent(String(err))}`).catch(() => {});
    });
  });

  document.addEventListener('mouseup', (e) => {
    if (e.button !== 2) return;
    endMove();
    if (!rightPress) return;
    const { x, y, target } = rightPress;
    rightPress = null;
    openPipMenu(x, y, target);
  });

  // Safety net: if the app loses focus mid-drag, the follow-the-cursor
  // thread must still stop. (A normal release always lands inside the page,
  // because the window follows the cursor.)
  window.addEventListener('blur', endMove);

  // The browser's own context menu, and focus-bar.js's, never open here.
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
  }, true);

  // Left clicks: the timer toggles the clock (focus-bar.js handles it), the
  // top chip's icon toggles a stacked monitor open, anything else does
  // nothing at all - stopPropagation keeps focus-bar's click/dblclick
  // handlers (buried-item promotion, open-the-record) out of reach.
  document.addEventListener('click', (e) => {
    if (onMenu(e.target)) return;
    closePipMenu();
    if (onTimer(e.target)) return; // focus-bar's handler takes it from here
    e.stopPropagation();
    e.preventDefault();
    if (onIcon(e.target)) {
      const zone = e.target.closest('.focus-monitor[data-layout="stacked"]');
      const chip = e.target.closest('.focus-chip');
      // Only the TOP chip's icon opens/closes the stack - a buried chip's
      // icon is just part of a row that does nothing out here.
      if (zone && chip && zone.querySelector('.focus-chip') === chip) {
        const n = Number(zone.dataset.monitor);
        if (openStacks.has(n)) openStacks.delete(n); else openStacks.add(n);
        rememberStacks();
        zone.classList.toggle('force-open');
        fit();
      }
    }
  }, true);

  document.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    e.preventDefault();
  }, true);

  document.addEventListener('dragstart', (e) => {
    e.preventDefault();
  }, true);

  // Hover must not reveal stacks here - the icon click is the one way in.
  for (const type of ['mouseover', 'mouseout']) {
    document.addEventListener(type, (e) => {
      if (e.target.closest?.('.focus-monitor')) e.stopPropagation();
    }, true);
  }
})();
