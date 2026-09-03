// One sticky note window - what the desktop wrapper's `sticky` CLI mode
// loads (see desktop/src-tauri/src/main.rs and pipWindowService.js). Fetches
// the one field's current value on open, autosaves it back debounced, and -
// only under the Tauri wrapper, where __TAURI__ actually exists - lets a
// right-press-and-move drag reposition the window and the ✕ close it. In a
// plain browser tab (someone navigated here directly) the textarea still
// works; there is just no window to move or close.
(function () {
  'use strict';

  const entityId = document.body.dataset.entityId;
  const typeSlug = document.body.dataset.typeSlug;
  const fieldKey = document.body.dataset.fieldKey;
  const textarea = document.getElementById('stickyText');

  if (!entityId || !typeSlug || !fieldKey) {
    textarea.disabled = true;
    textarea.placeholder = 'Nothing to show - this window opened without a record.';
    return;
  }

  // ---- load ---------------------------------------------------------------
  (async () => {
    try {
      const data = await app.fetchData(`/api/entities/${typeSlug}/${entityId}`);
      textarea.value = data?.fields?.[fieldKey] ?? '';
    } catch (error) {
      console.error('Could not load sticky note:', error);
    }
    textarea.focus();
  })();

  // ---- autosave, debounced --------------------------------------------------
  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 600);
  }
  async function save() {
    try {
      await app.fetchRaw(`/api/entities/${typeSlug}/${entityId}`, {
        method: 'PUT',
        body: JSON.stringify({ fields: { [fieldKey]: textarea.value } }),
      });
    } catch (error) {
      console.error('Could not save sticky note:', error);
    }
  }
  textarea.addEventListener('input', scheduleSave);
  // A window can be closed (or the app quit) with a save still pending in
  // the debounce window - flush whatever's typed rather than lose it.
  window.addEventListener('beforeunload', save);

  // ---- Tauri: move + close --------------------------------------------------
  const T = window.__TAURI__;
  if (!T) return;

  document.getElementById('stickyClose').addEventListener('click', () => {
    clearTimeout(saveTimer);
    save().finally(() => T.window.getCurrentWindow().close());
  });

  // Right-press-and-move drags the window - the same mechanism /pip uses
  // (focus-desktop.js): the Rust side follows the real cursor via a plain
  // Tauri event, because driving setPosition from JS mousemove fails here
  // (WKWebView reports screenX/Y against a stale window origin once the
  // window has actually moved). Right button is free to use for this since
  // the textarea only cares about the left one and the keyboard.
  let rightPress = null;
  let moving = false;
  const endMove = () => {
    if (!moving) return;
    moving = false;
    T.event.emit('pip-move', 'end').catch(() => {});
  };

  document.addEventListener('mousedown', (e) => {
    if (e.button !== 2) return;
    e.preventDefault();
    rightPress = { x: e.clientX, y: e.clientY };
  });

  document.addEventListener('mousemove', (e) => {
    if (!rightPress) return;
    if (!(e.buttons & 2)) { rightPress = null; endMove(); return; }
    if (Math.abs(e.clientX - rightPress.x) + Math.abs(e.clientY - rightPress.y) < 3) return;
    rightPress = null;
    moving = true;
    T.event.emit('pip-move', 'begin').catch(() => { moving = false; });
  });

  document.addEventListener('mouseup', (e) => {
    if (e.button !== 2) return;
    endMove();
    rightPress = null;
  });

  // Safety net: if the app loses focus mid-drag, the follow-the-cursor
  // thread on the Rust side must still stop.
  window.addEventListener('blur', endMove);

  // No native right-click menu here - a plain right-click is "did not move",
  // not "show a menu" (unlike /pip, this window has nothing worth putting in
  // one).
  document.addEventListener('contextmenu', (e) => e.preventDefault());
})();
