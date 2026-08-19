// Global save shortcut: Cmd+S (macOS) / Ctrl+S saves whatever is currently
// being edited, on every editing surface - the split-pane editors (typed
// pages, Dailies work item, Dailies child item, Templates, Settings > Entity
// Types) and the modals (Contexts, Priority Board, Theme, Data Sources).
//
// It works by clicking the Save button that owns the thing you are editing
// rather than by knowing anything about any particular editor, so a surface
// added later is covered for free as long as its Save button follows the
// naming convention below.
(function () {
  'use strict';

  // The two shapes every Save button in this codebase already uses, plus an
  // explicit opt-in for anything that can't. Documented in UI_STANDARDS.md §5c.
  const SAVE_BUTTON_SELECTOR = [
    'button[data-action="save"]',
    'button[id^="save" i]',
    'button[id$="SaveBtn"]',
  ].join(', ');

  // Containers that scope a save: the editor or modal a Save button belongs to.
  // Ordered widest-last so the walk up from the focused element stops at the
  // tightest one that actually contains a Save button.
  const SCOPE_SELECTOR = [
    '.modal.show',
    '.draggable-modal',
    '.split-pane-right',
    '.tab-content-pane.active',
    'form',
  ].join(', ');

  function isVisible(el) {
    return el.getClientRects().length > 0;
  }

  function saveButtonsIn(root) {
    return [...root.querySelectorAll(SAVE_BUTTON_SELECTOR)].filter(
      (btn) => !btn.disabled && isVisible(btn)
    );
  }

  // An open modal is always the answer when there is one: it is on top of, and
  // blocks interaction with, whatever editor is behind it.
  function topmostModal() {
    const modals = [
      ...document.querySelectorAll('.modal.show, .draggable-modal'),
    ].filter(isVisible);
    return modals.length ? modals[modals.length - 1] : null;
  }

  function resolveSaveButton() {
    const modal = topmostModal();
    const root = modal || document;

    // Walk up from whatever has focus and take the first container that holds
    // a live Save button. This is what disambiguates a panel with several -
    // the Contexts modal has a Save for the context and separate Saves for its
    // database/ServiceNow/ADO sub-panels - because focus is inside the one you
    // are actually typing in.
    let node = document.activeElement;
    if (node && node !== document.body && root.contains(node)) {
      while (node && node !== root) {
        if (node.matches?.(SCOPE_SELECTOR)) {
          const scoped = saveButtonsIn(node);
          if (scoped.length) return scoped[0];
        }
        node = node.parentElement;
      }
    }

    const candidates = saveButtonsIn(root);
    // With nothing focused and more than one editor open, there is no
    // defensible choice - do nothing rather than save the wrong record.
    return candidates.length === 1 ? candidates[0] : null;
  }

  // New item / new folder on the tab you are looking at.
  //
  // New item is Cmd/Alt+I, not +N: Cmd+N opens a browser window and a page
  // cannot take it back, so the shortcut simply never fired. Cmd/Ctrl+F is
  // likewise claimed by find, so Alt is bound alongside and is the reliable
  // one of the pair.
  // The two buttons are `add<Type>Btn` and `add<Type>FolderBtn` - the folder one
  // ALSO ends in "Btn", so matching on that suffix alone picked the folder
  // button for both shortcuts. The item selector excludes it explicitly.
  const NEW_ITEM_SELECTOR = 'button[id^="add"][id$="Btn"]:not([id$="FolderBtn"])';
  const NEW_FOLDER_SELECTOR = 'button[id^="add"][id$="FolderBtn"]';

  function clickInActiveTab(selector) {
    const pane = document.querySelector('.tab-content-pane.active');
    if (!pane) return false;
    const btn = [...pane.querySelectorAll(selector)]
      .find((el) => !el.disabled && el.getClientRects().length > 0);
    if (!btn) return false;
    btn.click();
    return true;
  }

  // Capture phase: Quill and the per-form keydown handlers must not get a
  // chance to swallow this first.
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.repeat) return;
      if (!(e.metaKey || e.ctrlKey || e.altKey)) return;
      // Alt/Cmd+I = new item, Alt/Cmd+F = new folder.
      if (e.key === 'i' || e.key === 'I') {
        if (clickInActiveTab(NEW_ITEM_SELECTOR)) { e.preventDefault(); e.stopPropagation(); }
        return;
      }
      if (e.key === 'f' || e.key === 'F') {
        if (clickInActiveTab(NEW_FOLDER_SELECTOR)) { e.preventDefault(); e.stopPropagation(); }
        return;
      }

      if (e.key !== 's' && e.key !== 'S') return;
      if (!(e.metaKey || e.ctrlKey)) return;   // Save is Cmd/Ctrl+S, not Alt+S

      // Always swallow it: the browser's Save Page dialog is never what
      // someone pressing Cmd+S inside an editor wants, including when there
      // happens to be nothing to save.
      e.preventDefault();
      e.stopPropagation();

      resolveSaveButton()?.click();
    },
    true
  );
})();
