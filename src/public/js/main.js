// Main Application JavaScript

// Server-rendered config, passed via data attributes on <body> (CSP-safe: no inline script needed)
window.APP_CONFIG = {
  activeTab: document.body.dataset.activeTab || 'daily',
  currentYear: parseInt(document.body.dataset.currentYear, 10),
  csrfToken: document.body.dataset.csrfToken,
  version: document.body.dataset.version,
};

if (window.APP_CONFIG.version) {
  const navVersion = document.getElementById('navVersion');
  if (navVersion) {
    navVersion.textContent = ' - v' + window.APP_CONFIG.version;
  }
}

// Shared Bootstrap Icons classes per concept, so the same icon shows up both on a
// tab button and on any row elsewhere in the app referencing that kind of thing.
window.APP_ICONS = {
  dailies: 'bi-calendar-day',
  workItem: 'bi-card-checklist',
  project: 'bi-collection',
  priorityBoard: 'bi-kanban',
  area: 'bi-diagram-3',
  goal: 'bi-bullseye',
  template: 'bi-clipboard-plus',
  todo: 'bi-check2-square',
  task: 'bi-list-task',
  ticket: 'bi-ticket',
  idea: 'bi-lightbulb',
};

// Order a status checkbox cycles through on click, shared by every page that
// renders a to-do or task row.
window.STATUS_CYCLE = ['incomplete', 'complete', 'failed', 'skipped'];

// Utility functions
const app = {
  // Format date for display
  formatDate(date) {
    if (typeof date === 'string') {
      date = new Date(date);
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  },

  // Escape text for safe interpolation into HTML markup or attributes
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text ?? '';
    return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  // Format datetime for display
  formatDateTime(date) {
    if (typeof date === 'string') {
      date = new Date(date);
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  // Show notification as a full-width bar pinned to the bottom of the page
  notify(message, type = 'info') {
    let container = document.getElementById('notificationBar');
    if (!container) {
      container = document.createElement('div');
      container.id = 'notificationBar';
      container.style.cssText = 'position: fixed; left: 0; right: 0; bottom: 0; z-index: 1080; display: flex; flex-direction: column-reverse;';
      document.body.appendChild(container);
    }

    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show mb-0 rounded-0 text-center`;
    alertDiv.setAttribute('role', 'alert');

    // Built as DOM nodes rather than innerHTML - `message` routinely embeds
    // user-controlled text (a title, a server error) and this runs on every
    // call site across the app, so it can't assume the caller escaped it.
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn-close';
    closeBtn.setAttribute('data-bs-dismiss', 'alert');
    closeBtn.setAttribute('aria-label', 'Close');
    alertDiv.appendChild(messageSpan);
    alertDiv.appendChild(closeBtn);

    container.appendChild(alertDiv);

    // Errors stay until dismissed so there's time to read the detail; others auto-dismiss
    if (type !== 'danger') {
      setTimeout(() => {
        alertDiv.remove();
      }, 5000);
    }
  },

  /**
   * The only way this app should talk to its own API.
   *
   * There were 173 raw `fetch(` calls against one of these, with 126 places
   * hand-writing the CSRF header - and a forgotten header is not a visible
   * error, the write just silently fails. That is the worst way to fail.
   *
   * Returns the parsed envelope ({ success, data, message }). Throws on a
   * failed request with the SERVER'S message attached, not "HTTP 400" - the
   * previous version threw before reading the body, so every considered error
   * message the API produced was discarded at the door. That is the other
   * reason nobody adopted it.
   *
   * It deliberately does NOT show a toast: callers already do, and two
   * notifications for one failure is worse than none.
   */
  async fetch(url, options = {}) {
    const csrfToken = this.getCsrfToken();

    const headers = { ...options.headers };
    // FormData sets its own multipart boundary; forcing JSON breaks the upload.
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

    // window.fetch, not app.fetchRaw: this IS the implementation.
    const response = await window.fetch(url, { ...options, headers });

    // Read the body first, whatever the status: the API answers a 4xx with
    // { success: false, message } and that message is the useful part.
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (!response.ok || (body && body.success === false)) {
      const error = new Error(body?.message || `Request failed (${response.status})`);
      error.status = response.status;
      error.body = body;
      throw error;
    }

    return body;
  },

  /** app.fetch, unwrapped - what a caller almost always actually wants. */
  async fetchData(url, options = {}) {
    return (await this.fetch(url, options))?.data;
  },

  /**
   * The raw Response, with the CSRF header attached.
   *
   * For call sites that need the Response itself - checking `.ok`, reading a
   * blob, streaming a download. Prefer `app.fetch`; this exists so that no
   * call site anywhere has a reason to write the header by hand, which is the
   * thing that actually causes silent write failures.
   */
  fetchRaw(url, options = {}) {
    const csrfToken = this.getCsrfToken();
    const headers = { ...options.headers };
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    // window.fetch, not app.fetchRaw: this IS the implementation.
    return window.fetch(url, { ...options, headers });
  },

  // Every source the app has ever used for this. body.dataset is what the
  // layouts actually set and what most call sites read; the other two predate
  // it. Checking all three is why app.fetch can now replace them.
  getCsrfToken() {
    return document.body?.dataset?.csrfToken
      || window.APP_CONFIG?.csrfToken
      || document.querySelector('[name="_csrf"]')?.value;
  },

  // Copy or reference? Asked whenever a row is dropped somewhere that can hold
  // either - onto a day, or into a template. The two behave very differently
  // afterwards (a reference mirrors edits back to the original; a copy does
  // not) and the choice cannot be inferred, so it is always asked.
  // Resolves 'copy', 'reference', or null if dismissed.
  // Copy or reference? Asked on every drop of a typed row, because the two behave
  // very differently afterwards and the choice cannot be inferred. Uses the app's
  // own modal - browser dialogs are against this project's UX standards.
  // Resolves 'copy', 'reference', or null if dismissed.
  askCopyOrReference(name) {
    return new Promise((resolve) => {
      const modalEl = document.getElementById("copyOrReferenceModal");
      if (!modalEl) return resolve("reference");   // no modal: keep the old behaviour
  
      document.getElementById("copyOrReferenceName").textContent = name || "this item";
      const modal = new bootstrap.Modal(modalEl);
  
      let answered = null;
      const pick = (choice) => () => { answered = choice; modal.hide(); };
      const copyBtn = document.getElementById("copyOrReferenceCopyBtn");
      const refBtn = document.getElementById("copyOrReferenceRefBtn");
      const onCopy = pick("copy");
      const onRef = pick("reference");
  
      copyBtn.addEventListener("click", onCopy);
      refBtn.addEventListener("click", onRef);
      modalEl.addEventListener("hidden.bs.modal", () => {
        copyBtn.removeEventListener("click", onCopy);
        refBtn.removeEventListener("click", onRef);
        resolve(answered);
      }, { once: true });
  
      modal.show();
    });
  },

  /**
   * Pick one of a list. Same modal as confirm and prompt, so every dialog in
   * the app dismisses the same way and none of them is a browser popup
   * (UI_STANDARDS.md forbids those). Resolves to the chosen value, or null if
   * the dialog was dismissed.
   */
  choose(options) {
    return this._dialog({ ...options, confirmLabel: options.confirmLabel || 'Move' });
  },

  // Confirm action with custom modal
  // Custom modal dialogs. UI_STANDARDS.md §5c forbids browser dialogs, but the
  // `#confirmModal` markup this used to depend on lived only in dashboard.ejs,
  // so on Settings app.confirm silently fell back to window.confirm - which is
  // why Settings code just called confirm() directly. The dialog is built here
  // instead, on first use, so both work identically on every page.
  //
  // The element ids are unchanged from the old markup (#confirmModal,
  // #confirmModalConfirm, ...) because they are what the e2e tests drive.
  _dialog(options) {
    const { title, message, input, options: choices } = options;

    let modalElement = document.getElementById('confirmModal');
    if (!modalElement) {
      modalElement = document.createElement('div');
      modalElement.className = 'modal fade';
      modalElement.id = 'confirmModal';
      modalElement.tabIndex = -1;
      modalElement.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header border-bottom">
              <h5 class="modal-title" id="confirmModalTitle"></h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <p id="confirmModalMessage" class="mb-2"></p>
              <input type="text" class="form-control" id="confirmModalInput">
              <select class="form-select d-none" id="confirmModalSelect"></select>
            </div>
            <div class="modal-footer border-top">
              <button type="button" class="btn btn-secondary" id="confirmModalCancel">Cancel</button>
              <button type="button" class="btn btn-primary" id="confirmModalConfirm">Confirm</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(modalElement);
    }

    const titleEl = modalElement.querySelector('#confirmModalTitle');
    const messageEl = modalElement.querySelector('#confirmModalMessage');
    const inputEl = modalElement.querySelector('#confirmModalInput');
    // Older markup may predate the picker; build it rather than fail.
    let selectEl = modalElement.querySelector('#confirmModalSelect');
    if (!selectEl) {
      selectEl = document.createElement('select');
      selectEl.id = 'confirmModalSelect';
      selectEl.className = 'form-select d-none';
      inputEl.insertAdjacentElement('afterend', selectEl);
    }
    const confirmBtn = modalElement.querySelector('#confirmModalConfirm');
    const cancelBtn = modalElement.querySelector('#confirmModalCancel');

    titleEl.textContent = title;
    messageEl.textContent = message;
    messageEl.classList.toggle('d-none', !message);
    inputEl.classList.toggle('d-none', !input);
    selectEl.classList.toggle('d-none', !choices);
    if (choices) {
      selectEl.innerHTML = choices
        .map(o => `<option value="${app.escapeHtml(String(o.value))}">${app.escapeHtml(String(o.label))}</option>`)
        .join('');
    }
    inputEl.value = input?.defaultValue || '';
    inputEl.placeholder = input?.placeholder || '';
    confirmBtn.textContent = options.confirmLabel || (input ? 'OK' : 'Confirm');

    // A report has nothing to cancel, so it shows one button. Reset explicitly
    // rather than only hiding: the element is reused across every dialog on the
    // page, so a Cancel hidden once would stay hidden for the next confirm().
    cancelBtn.classList.toggle('d-none', Boolean(options.hideCancel));
    // Long reports need to stay readable - preserve newlines, and let a very
    // long list scroll inside the dialog rather than running off it.
    messageEl.style.whiteSpace = options.preserveWhitespace ? 'pre-wrap' : '';
    messageEl.style.maxHeight = options.preserveWhitespace ? '50vh' : '';
    messageEl.style.overflowY = options.preserveWhitespace ? 'auto' : '';

    const modal = new bootstrap.Modal(modalElement);

    return new Promise((resolve) => {
      let settled = false;

      // `hidden.bs.modal` covers every dismissal route - the X, the backdrop,
      // Escape - so a dialog can never resolve twice or hang unresolved.
      const finish = (value) => {
        if (settled) return;
        settled = true;
        confirmBtn.removeEventListener('click', onConfirm);
        cancelBtn.removeEventListener('click', onCancel);
        inputEl.removeEventListener('keydown', onKeydown);
        modalElement.removeEventListener('hidden.bs.modal', onHidden);
        resolve(value);
      };

      const onConfirm = () => {
        if (choices) {
          const picked = selectEl.value;
          modal.hide();
          finish(picked);
          return;
        }
        const value = input ? inputEl.value.trim() : true;
        modal.hide();
        finish(input && !value ? null : value);
      };
      const onCancel = () => { modal.hide(); finish(input ? null : false); };
      const onHidden = () => finish(input ? null : false);
      const onKeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); onConfirm(); }
      };

      confirmBtn.addEventListener('click', onConfirm);
      cancelBtn.addEventListener('click', onCancel);
      inputEl.addEventListener('keydown', onKeydown);
      modalElement.addEventListener('hidden.bs.modal', onHidden);

      modalElement.addEventListener(
        'shown.bs.modal',
        () => { if (input) inputEl.focus(); },
        { once: true }
      );

      modal.show();
    });
  },

  // Resolves true/false. Replaces window.confirm everywhere.
  confirm(message, title = 'Confirm Action') {
    return this._dialog({ title, message });
  },

  // A message with one button, for reporting what an action did. Keeps its
  // newlines, unlike notify(), so it can carry a per-item list that would be
  // unreadable in a toast.
  alert(message, title = 'Done') {
    return this._dialog({
      title, message, hideCancel: true, preserveWhitespace: true, confirmLabel: 'OK',
    });
  },

  // Resolves the entered string, or null if cancelled or left empty. Replaces
  // window.prompt everywhere.
  prompt(message, { title = 'Enter a value', defaultValue = '', placeholder = '' } = {}) {
    return this._dialog({ title, message, input: { defaultValue, placeholder } });
  },

  // Icon shown inside a status checkbox; empty for 'incomplete' (empty box).
  statusIcon(status) {
    return { complete: 'bi-check-lg', failed: 'bi-x-lg', skipped: 'bi-dash-lg' }[status] || '';
  },

  // Icon shown for importance/urgency level
  importanceIcon(importance) {
    return { low: 'bi-arrow-down', medium: 'bi-dash', high: 'bi-arrow-up', critical: 'bi-exclamation-diamond-fill' }[importance] || '';
  },

  // Color class for importance level
  importanceColor(importance) {
    return { low: 'text-secondary', medium: 'text-info', high: 'text-warning', critical: 'text-danger' }[importance] || '';
  },

  // Advance a to-do's or task's status to the next state in STATUS_CYCLE and
  // save it; shared by every page that renders a status checkbox. `endpoint`
  // is the full REST URL for the item being updated (e.g. `/api/to-dos/5` or
  // `/api/tasks/5`).
  async cycleStatus(endpoint, currentStatus) {
    const idx = STATUS_CYCLE.indexOf(currentStatus);
    const nextStatus = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    const response = await app.fetchRaw(endpoint, {
      method: 'PUT',
      
      body: JSON.stringify({ status: nextStatus })
    });
    return response.json();
  },

  // For flat (non-hierarchical) drag-reorder lists: which half of the hovered
  // row the cursor is in, so dropping shows/lands as "insert before" or
  // "insert after" instead of silently reordering with no visual cue.
  // Shared emoji picker. Opens next to `anchorEl` and resolves to the chosen
  // emoji, or null if dismissed. Used by the `emoji` field type in both the
  // editor and the row cell, so there is one picker rather than one per
  // surface. Dailies has its own older picker wired to its own endpoints; this
  // one is generic and returns a value instead of saving.
  pickEmoji(anchorEl) {
    const EMOJI = [
      '⭐','🌟','✨','🔥','⚡','💡','🎯','✅','☑️','❌','⚠️','❗','❓','🔔',
      '📌','🔖','🏷️','📝','🗒️','📋','📅','📆','⏰','⏳','🚩','🏁','🏆','🥇',
      '🚀','🛠️','🔧','⚙️','🧰','🐛','🩹','🔍','🔎','🧠','📊','📈','📉','🧮',
      '💰','💳','🏦','👤','👥','🤝','💬','🗣️','📞','✉️','📧','📢','📣',
      '🏠','🏢','🏛️','🏭','🌍','🌐','🧭','🗺️','✈️','🚗','🚚','⛵','☁️','🌙',
      '☀️','🌱','🌳','🍀','❤️','💜','💙','💚','💛','🧡','🖤','🤍','🔴','🟠',
      '🟡','🟢','🔵','🟣','⚫','⚪','🎨','🎬','🎵','🎮','🕹️','🎁','🧩','🪄',
      '🔒','🔑','🛡️','💾','🖥️','💻','📦','🧊','🧪','🔬','📡','🛰️','♻️','🔄',
    ];

    return new Promise((resolve) => {
      document.querySelectorAll('.app-emoji-picker').forEach(el => el.remove());

      const picker = document.createElement('div');
      picker.className = 'app-emoji-picker';
      picker.innerHTML =
        '<button type="button" class="app-emoji-clear" data-emoji="">clear</button>' +
        EMOJI.map(e => `<button type="button" class="app-emoji-choice" data-emoji="${e}">${e}</button>`).join('');
      document.body.appendChild(picker);

      const b = anchorEl.getBoundingClientRect();
      const p = picker.getBoundingClientRect();
      const below = window.innerHeight - b.bottom;
      picker.style.top = `${below > p.height ? b.bottom + 4 : Math.max(4, b.top - p.height - 4)}px`;
      picker.style.left = `${Math.min(Math.max(4, b.left), window.innerWidth - p.width - 8)}px`;

      const done = (value) => {
        picker.remove();
        document.removeEventListener('mousedown', away, true);
        resolve(value);
      };
      const away = (e) => { if (!picker.contains(e.target) && e.target !== anchorEl) done(null); };

      picker.addEventListener('click', (e) => {
        const choice = e.target.closest('[data-emoji]');
        if (choice) done(choice.dataset.emoji);
      });
      setTimeout(() => document.addEventListener('mousedown', away, true), 0);
    });
  },

  // Child-count badge shown after a row's title on every page that renders a
  // row with things nested under it: the typed pages, Dailies, Templates, the
  // Priority Board and its Weekly list. One helper so the markup and wording
  // stay identical everywhere - add new row types by calling this, not by
  // hand-rolling another span.
  //
  // The count is DIRECT children, not all descendants.
  childCountBadge(count) {
    const n = Number(count) || 0;
    return n > 0
      ? `<span class="child-count" title="${n} item${n === 1 ? '' : 's'} inside">(${n})</span>`
      : '';
  },

  // Selected-row indicator. Every list in the app where a row can be selected
  // uses the same `.selected` state class (UI_STANDARDS.md §5), so selection
  // looks identical on Dailies, Templates, the typed pages, Contexts, the
  // Priority Board and Settings > Entity Types. Pass null to clear.
  //
  // `groupSelector` is what identifies the row's siblings - the class is
  // removed from every match before it is added, so a list can only ever have
  // one selected record. `rows` is an element, or a NodeList/array when one
  // record is shown in more than one place at once (a Priority Board strip and
  // its Weekly Priorities row are the same project).
  selectRow(rows, groupSelector) {
    document
      .querySelectorAll(`${groupSelector}`)
      .forEach((el) => el.classList.remove('selected'));
    if (!rows) return;
    const list = rows instanceof Element ? [rows] : [...rows];
    list.forEach((el) => el.classList.add('selected'));
  },

  // Kept as delegates: the drop-zone geometry moved into dragDropUtils.js with
  // the rest of the drag protocol (audit finding 05), and these two names are
  // used by code outside this repo's own surfaces.
  getVerticalDropZone(event, rowEl) {
    return dropZone(event, rowEl);
  },

  getTreeDropZone(event, rowEl) {
    return dropZone(event, rowEl, { nesting: true });
  },

  // Column headers are a horizontal strip. Restored 2026-08-21: this delegate
  // was deleted in finding 05 while its two callers in generic-entity-init.js
  // were left in place, so column reordering threw and did nothing.
  getHorizontalDropZone(event, cellEl) {
    return dropZoneHorizontal(event, cellEl);
  },

  // Group a flat list of { id, parent_id } records by parent_id (null = top-level)
  groupByParent(records) {
    const byParent = new Map();
    records.forEach(r => {
      const key = r.parent_id || null;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(r);
    });
    return byParent;
  },

  // Flatten a parent_id-linked list into tree order, annotating each item with `depth`
  flattenTree(records) {
    const byParent = this.groupByParent(records);
    const result = [];
    const walk = (parentId, depth) => {
      (byParent.get(parentId) || []).forEach(item => {
        result.push({ ...item, depth });
        walk(item.id, depth + 1);
      });
    };
    walk(null, 0);
    return result;
  },

  // Click, pause, click again on a title (not a fast double-click, which rows
  // typically still use to open the full edit modal) starts inline rename.
  // Bound once per container; delegates to any current/future element matching
  // `selector`. Captures on the way down so title clicks never also reach the
  // row's own click handling (status cycling, expand/collapse, etc).
  bindInlineRename(container, selector, onSave) {
    const MIN_GAP_MS = 400;
    const MAX_GAP_MS = 1000;
    let lastClick = null;

    container.addEventListener('click', (e) => {
      const titleEl = e.target.closest(selector);
      if (!titleEl) return;

      if (titleEl.querySelector('input')) return; // already editing

      const now = Date.now();
      if (lastClick && lastClick.el === titleEl) {
        const delta = now - lastClick.time;
        lastClick = null;
        if (delta >= MIN_GAP_MS && delta <= MAX_GAP_MS) {
          e.stopPropagation();
          app.startInlineRename(titleEl, onSave);
          return;
        }
      }
      lastClick = { el: titleEl, time: now };
    }, true);
  },

  startInlineRename(titleEl, onSave) {
    const originalText = titleEl.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-control form-control-sm inline-rename-input';
    input.value = originalText;

    titleEl.textContent = '';
    titleEl.appendChild(input);
    input.focus();
    input.select();

    let done = false;
    const finish = async (commit) => {
      if (done) return;
      done = true;

      const newValue = input.value.trim();
      if (!commit || !newValue || newValue === originalText) {
        titleEl.textContent = originalText;
        return;
      }

      titleEl.textContent = newValue;
      const ok = await onSave(newValue, titleEl);
      if (ok === false) titleEl.textContent = originalText;
    };

    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
  },

  // Generic drag-to-reorder for any tab strip (main app tabs, per-context
  // sub-tabs, etc). `navEl` is the container holding the tab elements;
  // `itemSelector` picks out the draggable items (must have `draggable="true"`
  // in the markup already); `onReorder(orderedKeys)` fires on drop with the
  // new order, reading each item's `data-tab` attribute (the same one that
  // already identifies which tab it is). Purely a reordering gesture -
  // selecting/activating a tab is left to existing click handlers, untouched.
  bindTabDragReorder(navEl, itemSelector, onReorder) {
    let draggingEl = null;

    navEl.addEventListener('dragstart', (e) => {
      const item = e.target.closest(itemSelector);
      if (!item) return;
      draggingEl = item;
      e.dataTransfer.effectAllowed = DRAG_EFFECT_ALLOWED;
      item.classList.add('dragging-tab');
    });

    navEl.addEventListener('dragend', () => {
      if (draggingEl) draggingEl.classList.remove('dragging-tab');
      draggingEl = null;
    });

    navEl.addEventListener('dragover', (e) => {
      const item = e.target.closest(itemSelector);
      if (!item || !draggingEl || item === draggingEl) return;
      e.preventDefault();

      const rect = item.getBoundingClientRect();
      const before = e.clientX < rect.left + rect.width / 2;
      item.parentNode.insertBefore(draggingEl, before ? item : item.nextSibling);
    });

    navEl.addEventListener('drop', (e) => {
      const item = e.target.closest(itemSelector);
      if (!item) return;
      e.preventDefault();

      const orderedKeys = Array.from(navEl.querySelectorAll(itemSelector)).map(el => el.dataset.tab);
      onReorder(orderedKeys);
    });
  },
};

// Make app globally accessible
window.app = app;

// Top-right context switcher (navbar.ejs, present on every page). The active
// context is authoritative on the server (persists across page loads/tabs,
// same idea as the active database profile), not client-side state - so
// switching reloads the page, ensuring every tab's data (which all filter by
// the active context server-side) is refetched under the new one.
async function initContextSwitcher() {
  const btn = document.getElementById('contextSwitcherBtn');
  const label = document.getElementById('contextSwitcherLabel');
  const menu = document.getElementById('contextSwitcherMenu');
  if (!btn) return;

  try {
    const [contextsResponse, activeResponse] = await Promise.all([
      fetch('/api/contexts'),
      fetch('/api/active-context'),
    ]);
    const contextsResult = await contextsResponse.json();
    const activeResult = await activeResponse.json();
    const contexts = (contextsResult.success && contextsResult.data) || [];
    const active = activeResult.success ? activeResult.data : null;

    if (contexts.length === 0 || !active) {
      label.textContent = 'No contexts';
      return;
    }

    const DEFAULT_CONTEXT_ICON = 'bi-collection';
    label.innerHTML = `<i class="bi ${active.icon || DEFAULT_CONTEXT_ICON}"></i> ${app.escapeHtml(active.name)}`;

    menu.innerHTML = contexts.map(c => `
      <li>
        <button type="button" class="dropdown-item ${c.id === active.id ? 'active' : ''}" data-context-id="${c.id}">
          <i class="bi ${c.icon || DEFAULT_CONTEXT_ICON}"></i> ${app.escapeHtml(c.name)}
        </button>
      </li>
    `).join('');

    menu.querySelectorAll('[data-context-id]').forEach(item => {
      item.addEventListener('click', async () => {
        if (item.classList.contains('active')) return;
        try {
          const contextId = item.dataset.contextId;
          const response = await app.fetchRaw('/api/active-context', {
            method: 'PUT',
            
            body: JSON.stringify({ id: contextId })
          });
          const result = await response.json();
          if (!result.success) {
            // Check if the error is about missing database configuration
            if (result.message && result.message.includes('no database configured')) {
              showContextDatabaseConfigModal(contextId);
            } else {
              app.notify('Error: ' + result.message, 'danger');
            }
            return;
          }
          window.location.reload();
        } catch (error) {
          console.error('Error switching context:', error);
          app.notify('Error switching context', 'danger');
        }
      });
    });
  } catch (error) {
    console.error('Error loading contexts:', error);
    label.textContent = 'Context';
  }
}

function showContextDatabaseConfigModal(contextId) {
  const modal = new bootstrap.Modal(document.getElementById('contextDatabaseConfigModal'));

  const useSystemDbBtn = document.getElementById('useSystemDatabaseBtn');
  const goToSettingsBtn = document.getElementById('goToSettingsBtn');

  useSystemDbBtn.onclick = async () => {
    useSystemDbBtn.disabled = true;
    try {
      const response = await app.fetchRaw(`/api/contexts/${contextId}/use-system-database`, {
        method: 'POST' });
      const result = await response.json();
      if (result.success) {
        app.notify('Context configured to use system database. Switching context...', 'success');
        modal.hide();
        // Try to switch context again
        window.location.reload();
      } else {
        app.notify('Error: ' + result.message, 'danger');
      }
    } catch (error) {
      console.error('Error using system database:', error);
      app.notify('Error configuring database', 'danger');
    } finally {
      useSystemDbBtn.disabled = false;
    }
  };

  goToSettingsBtn.onclick = () => {
    modal.hide();
    window.location.href = '/settings?tab=contexts';
  };

  modal.show();
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('MyWork application initialized');
    initContextSwitcher();
  });
} else {
  console.log('MyWork application initialized');
  initContextSwitcher();
}
