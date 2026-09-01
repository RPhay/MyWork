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

// Pending app.whenVisible() checks - see whenVisible/recheckVisible below.
// Module-level rather than per-call so tabs.js can re-ask all of them at once
// when it changes which panes are on screen.
const pendingVisibilityChecks = new Set();

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

  /**
   * Is this pane actually on screen?
   *
   * `offsetParent === null` is true for anything inside a `display: none`
   * ancestor, which is exactly how a put-away tab or rail is hidden here.
   */
  isVisible(target) {
    const el = typeof target === 'string' ? document.getElementById(target) : target;
    return !!el && el.offsetParent !== null;
  },

  /**
   * Run `fn` ONCE, the first time `target` is on screen - immediately if it
   * already is.
   *
   * Every view in this app renders up front and is shown by un-hiding it, so a
   * loader wired to DOMContentLoaded fetches for panes nobody is looking at.
   * That is what had a page load pulling the reporting aggregates, the
   * priorities board and the whole Dailies rail before you had opened any of
   * them - and `loadTabData()` fetched them AGAIN on the switch that actually
   * showed them, so the eager pass was never even the copy you read.
   *
   * Anchor on the PANE, not on the list inside it: an unloaded list is empty
   * and therefore zero-height, and a zero-area target never reports as
   * intersecting, so observing it asks "are you visible" of the one element
   * that cannot become visible until it loads.
   *
   * A pane becomes visible from a tab click, a rail toggle, a pop-out or a
   * restored layout; an observer answers all of them without any of those
   * paths having to remember to say so.
   */
  whenVisible(target, fn) {
    const el = typeof target === 'string' ? document.getElementById(target) : target;
    // A name that matches nothing must not quietly become "load it eagerly",
    // which is the behaviour this exists to remove - and is exactly what a
    // mistyped id did here once, leaving the priorities board still fetching
    // on every page load while looking gated. Say so, then fail safe.
    if (!el) {
      console.warn(`app.whenVisible: no element "${target}" - loading immediately`);
      return fn();
    }

    let io = null;
    const check = () => {
      if (el.offsetParent === null) return false;   // still put away
      io?.disconnect();
      pendingVisibilityChecks.delete(check);
      fn();
      return true;
    };

    // The deterministic half. tabs.js calls app.recheckVisible() every time it
    // changes which panes are up, so a rail toggle or a tab switch loads its
    // pane there and then. This is what the observer below cannot be trusted
    // to do: Chrome delivers no IntersectionObserver callbacks to a page it is
    // not rendering, so in a background tab the pane would stay empty with
    // nothing in flight.
    pendingVisibilityChecks.add(check);

    // The backstop, for a pane made visible by something that does not know to
    // announce it - a pop-out window, a restored layout, CSS.
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver((records) => {
        if (records.some(r => r.isIntersecting)) check();
      });
      io.observe(el);
    }

    // For being visible ALREADY - deferred, not checked on the spot. Rail and
    // tab visibility is applied by tabs.js during the same DOMContentLoaded
    // pass, and a loader that asks before that has run gets the pre-layout
    // answer: the Dailies rail is briefly up while it initialises, so an
    // immediate check saw "visible" and fetched the whole rail on a page where
    // it was put away.
    const checkAfterLayout = () => setTimeout(check, 0);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', checkAfterLayout);
    } else {
      checkAfterLayout();
    }
  },

  /**
   * Re-ask every pending whenVisible() whether its pane is up now.
   *
   * Called by tabs.js whenever it changes the layout. Cheap - each check is an
   * `offsetParent` read, and a check that fires removes itself.
   */
  recheckVisible() {
    for (const check of [...pendingVisibilityChecks]) check();
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
        document.removeEventListener('keydown', onKeydown, true);
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
      // Enter = the confirm button, Escape = cancel, from anywhere in the
      // dialog. This listener used to sit on the text INPUT, so Enter worked in
      // a prompt() and did nothing in a confirm() - which is every delete in
      // the app, the one dialog you answer most often.
      const onKeydown = (e) => {
        // On DOCUMENT, not on the modal: the dialog does not reliably hold
        // focus when it opens (observed landing on <body>), and a listener on
        // the modal never sees a keystroke that was delivered to an ancestor.
        // Guarded on the dialog actually being open so it is not a global key
        // handler for the rest of the page's life.
        if (!modalElement.classList.contains('show')) return;
        if (e.key === 'Enter') {
          // A focused button already turns Enter into a click. Handling it here
          // as well would run onConfirm twice.
          if (e.target.tagName === 'BUTTON') return;
          e.preventDefault();
          onConfirm();
        } else if (e.key === 'Escape') {
          // Bootstrap dismisses on Escape by default and that already resolved
          // No via hidden.bs.modal. Explicit here so the behaviour survives a
          // dialog built with keyboard:false, and so both keys are visible in
          // one place rather than one being a framework default nobody can see.
          e.preventDefault();
          onCancel();
        }
      };

      confirmBtn.addEventListener('click', onConfirm);
      cancelBtn.addEventListener('click', onCancel);
      document.addEventListener('keydown', onKeydown, true);
      modalElement.addEventListener('hidden.bs.modal', onHidden);

      // What holds focus decides what Enter does natively, so set it rather
      // than leaving it to Bootstrap: the text field when there is one, the
      // picker when it is a choice, otherwise the confirm button - which also
      // makes Enter's effect visible instead of a hidden shortcut.
      modalElement.addEventListener(
        'shown.bs.modal',
        () => {
          if (input) inputEl.focus();
          else if (choices) selectEl.focus();
          else confirmBtn.focus();
        },
        { once: true }
      );

      modal.show();
    });
  },

  // Resolves true/false. Replaces window.confirm everywhere.
  // `preserveWhitespace` for a confirmation that lists things one per line.
  // Without it _dialog CLEARS white-space (see the assignment there), which is
  // right for the usual one-line confirm and wrong for a list - the newlines
  // survive in the text and HTML collapses them, so the whole message arrives
  // as one run-on paragraph. `alert()` has always passed it; `confirm()` could
  // not until now.
  confirm(message, title = 'Confirm Action', { preserveWhitespace = false } = {}) {
    return this._dialog({ title, message, preserveWhitespace });
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


// Local view state belongs to whoever was last here.
//
// Thirty-nine localStorage call sites across seven files hold theme, split-pane
// widths, which rows are expanded, the open editor, saved views and the focus
// palette. All of it is per BROWSER, so without this, switching profile leaves
// you looking at the previous person's layout and theme.
//
// Cleared wholesale on a change of user rather than namespaced per key. Many of
// those keys are COMPUTED (`entity-expanded-${id}`, `splitPane-${id}-left`), so
// a prefix scheme means editing every site and would half-land the first time
// one was missed - and a missed one is invisible, because stale layout looks
// like a preference, not a bug. Clearing cannot be half-done.
//
// The trade: your layout resets when you switch, rather than each profile
// keeping its own. Keeping it per profile means moving this state server-side,
// which is a bigger change than the leak justifies today.
//
// Safe to clear everything: this origin serves only MyWork, so nothing else
// stores anything here.
function forgetOtherProfilesLocalState(user) {
  const MARKER = 'mywork.lastUserId';
  try {
    const current = user ? String(user.id) : '';
    const previous = localStorage.getItem(MARKER);
    // First ever load has no marker - record it and clear nothing, or every
    // existing user loses their layout the day profiles ship.
    if (previous === null) {
      localStorage.setItem(MARKER, current);
      return;
    }
    if (previous === current) return;

    localStorage.clear();
    localStorage.setItem(MARKER, current);
  } catch {
    // Private mode, or storage disabled. Nothing to forget in that case.
  }
}

// Which profile this session is signed in as via single sign-on, or null.
//
// Returns null for every reason that is not "signed in": SSO off (the home
// machine, and the default), enabled but not yet signed in, or the endpoint
// unreachable. The navbar must render identically in all of those cases -
// an SSO badge that appears because a fetch failed is worse than no badge.
async function getSsoSignedInUserId() {
  try {
    const response = await fetch('/auth/status');
    if (!response.ok) return null;
    const result = await response.json();
    const data = result?.data;
    if (!data?.enabled || !data.signedIn) return null;
    return typeof data.userId === 'number' ? data.userId : null;
  } catch {
    return null;
  }
}

// Top-right user switcher (navbar.ejs, present on every page).
//
// A PROFILE picker, not a login: there is no password and it is not access
// control. It decides whose contexts - and therefore whose data - the app is
// showing. See src/services/activeUserService.js.
//
// Switching reloads the page for the same reason switching context does:
// every tab's data is filtered server-side by the active context, and the new
// user's context is a different database entirely.
async function initUserSwitcher() {
  const btn = document.getElementById('userSwitcherBtn');
  const label = document.getElementById('userSwitcherLabel');
  const menu = document.getElementById('userSwitcherMenu');
  if (!btn) return null;

  try {
    const response = await fetch('/api/active-user');
    const result = await response.json();
    if (!result.success) throw new Error(result.message);

    const { user, users, needsUser, needsContext } = result.data;

    forgetOtherProfilesLocalState(user);

    label.textContent = user ? user.name : 'Choose user';

    // Which profile, if any, this session actually SIGNED IN as. Only ever
    // set when SSO_MODE resolves to on/auto and the sign-in completed, so on
    // the home machine this is null and nothing below it renders.
    const ssoUserId = await getSsoSignedInUserId();

    // Badge on the BUTTON, beside the name, visible without opening the
    // menu - being signed in is a standing fact about the session, not a
    // detail to go looking for. Removed and re-added rather than toggled
    // because initUserSwitcher re-runs (after setting an email, say) and a
    // toggle would leave two badges behind.
    const existingBadge = document.getElementById('userSwitcherSsoBadge');
    if (existingBadge) existingBadge.remove();
    if (ssoUserId !== null && user && user.id === ssoUserId) {
      const badge = document.createElement('span');
      badge.id = 'userSwitcherSsoBadge';
      badge.className = 'badge text-bg-light ms-1';
      badge.textContent = 'SSO';
      badge.title = 'Signed in with Microsoft single sign-on';
      // Before the caret, which Bootstrap draws as the button's ::after.
      label.insertAdjacentElement('afterend', badge);
    }

    // The list, plus a way to add a profile without going to Settings - a new
    // user is two clicks from here, which is the whole point of a picker.
    menu.innerHTML = (users || []).map(u => {
      const isActive = Boolean(user && u.id === user.id);
      // The signed-in profile is almost always also the ACTIVE row, which is
      // painted Bootstrap primary - so a text-bg-primary badge there is blue
      // on blue and reads as bare text with no pill at all. Light badge on
      // the active row, primary everywhere else.
      const badge = ssoUserId !== null && u.id === ssoUserId
        ? `<span class="badge ${isActive ? 'text-bg-light' : 'text-bg-primary'}" title="Signed in with Microsoft single sign-on">SSO</span>`
        : '';
      // Signed in: every OTHER profile is unreachable, because the server
      // refuses the switch. Disabling here is presentation only - the guard
      // that matters is in PUT /api/active-user, since a disabled button
      // stops a click and nothing else.
      const locked = ssoUserId !== null && u.id !== ssoUserId;
      return `
      <li>
        <button type="button" class="dropdown-item d-flex align-items-center justify-content-between gap-3 ${isActive ? 'active' : ''} ${locked ? 'disabled' : ''}" data-user-id="${u.id}"${locked ? ' disabled title="Signed in with single sign-on - sign out to use a different profile"' : ''}>
          <span><i class="bi bi-person-fill"></i> ${app.escapeHtml(u.name)}</span>
          ${badge}
        </button>
      </li>
    `;
    }).join('') + `
      <li><hr class="dropdown-divider"></li>
      ${user ? `<li><button type="button" class="dropdown-item" id="setUserEmailItem" title="The address single sign-on matches this profile by"><i class="bi bi-envelope"></i> Email for SSO…</button></li>` : ''}
      <li><button type="button" class="dropdown-item" id="addUserItem"><i class="bi bi-plus-lg"></i> New user…</button></li>
      ${ssoUserId !== null ? `<li><hr class="dropdown-divider"></li>
      <li><button type="button" class="dropdown-item text-danger" id="ssoSignOutItem"><i class="bi bi-box-arrow-right"></i> Sign out</button></li>` : ''}`;

    menu.querySelectorAll('[data-user-id]').forEach(item => {
      item.addEventListener('click', () => {
        if (item.classList.contains('active')) return;
        switchToUser(item.dataset.userId);
      });
    });

    const addItem = document.getElementById('addUserItem');
    if (addItem) addItem.addEventListener('click', promptForNewUser);

    const emailItem = document.getElementById('setUserEmailItem');
    if (emailItem) {
      emailItem.addEventListener('click', () => promptForUserEmail(user));
    }

    const signOutItem = document.getElementById('ssoSignOutItem');
    if (signOutItem) signOutItem.addEventListener('click', ssoSignOut);

    return { user, users, needsUser, needsContext };
  } catch (error) {
    console.error('Error loading users:', error);
    label.textContent = 'User';
    return null;
  }
}

async function switchToUser(userId) {
  try {
    const response = await app.fetchRaw('/api/active-user', {
      method: 'PUT',
      body: JSON.stringify({ userId })
    });
    const result = await response.json();
    if (!result.success) {
      app.notify('Error: ' + result.message, 'danger');
      return;
    }
    // A profile that owns nothing is a real state, not a failure - the switch
    // worked, there is simply nowhere to go yet. Say so instead of reloading
    // into an error page.
    if (result.data?.needsContext) {
      app.notify(`${result.data.user.name} has no contexts yet - create one in Settings`, 'warning');
      window.location.href = '/settings?tab=contexts';
      return;
    }
    window.location.reload();
  } catch (error) {
    console.error('Error switching user:', error);
    app.notify('Error switching user', 'danger');
  }
}

// End the single sign-on session.
//
// Only ever rendered when signed in. Reloads rather than redirecting: the
// gate in app.js will bounce the next page load to /auth/login by itself,
// and letting it do so keeps one place deciding where an unauthenticated
// request goes.
async function ssoSignOut() {
  try {
    await app.fetchRaw('/auth/logout', { method: 'POST' });
  } catch (error) {
    console.error('Error signing out:', error);
  }
  window.location.reload();
}

// Set the address single sign-on matches this profile by.
//
// Without this the email match is unreachable from the UI, and an SSO
// feature you cannot configure lands you on a NEW profile with none of your
// contexts - which is the failure the match exists to prevent. Set it on the
// profile you already use, BEFORE the first sign-in on the work machine.
async function promptForUserEmail(user) {
  if (!user) return;

  const email = await app.prompt(
    `Work email address for ${user.name}. Single sign-on matches this profile by it; leave blank to clear.`,
    {
      title: 'Email for SSO',
      defaultValue: user.email || '',
      placeholder: 'e.g. you@company.com',
    },
  );
  // Cancelled. An empty STRING is a deliberate clear and must still be sent,
  // which is why this tests for null rather than falsiness.
  if (email === null || email === undefined) return;

  try {
    const response = await app.fetchRaw(`/api/users/${user.id}`, {
      method: 'PUT',
      body: JSON.stringify({ email: email.trim() }),
    });
    const result = await response.json();
    if (!result.success) {
      app.notify('Error: ' + result.message, 'danger');
      return;
    }
    app.notify(
      email.trim()
        ? `${user.name} will be matched by ${email.trim()}`
        : `Cleared the email for ${user.name}`,
      'success',
    );
    initUserSwitcher();
  } catch (error) {
    console.error('Error saving user email:', error);
    app.notify('Could not save the email address', 'danger');
  }
}

async function promptForNewUser() {
  const name = await app.prompt('Name for the new profile', { title: 'New user', placeholder: 'e.g. Ryan' });
  if (!name || !name.trim()) return;
  try {
    const response = await app.fetchRaw('/api/users', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim() })
    });
    const result = await response.json();
    if (!result.success) {
      app.notify('Error: ' + result.message, 'danger');
      return;
    }
    await switchToUser(result.data.id);
  } catch (error) {
    console.error('Error creating user:', error);
    app.notify('Error creating user', 'danger');
  }
}

// Nobody chosen yet - on a fresh install, or after the chosen profile was
// deleted. The app is showing SOMEBODY'S data at this point (the fallback in
// getActiveContextId), so this asks rather than letting that pass unnoticed.
async function showUserPicker(users) {
  if (!users || users.length === 0) return;
  const el = document.getElementById('userPickerModal');
  if (!el) return;
  const list = document.getElementById('userPickerList');
  list.innerHTML = users.map(u => `
    <button type="button" class="list-group-item list-group-item-action d-flex align-items-center justify-content-between gap-2" data-pick-user="${u.id}">
      <span><i class="bi bi-person-circle me-2"></i>${app.escapeHtml(u.name)}</span>
      ${u.email ? `<small class="text-muted">${app.escapeHtml(u.email)}</small>` : ''}
    </button>
  `).join('');

  // The address field only appears where it means something. On a machine
  // with SSO off it would be an unexplained box on the first screen anyone
  // sees; with SSO on it is the ONLY way out of a sign-in that landed on the
  // wrong profile, because this modal's static backdrop hides the navbar.
  const emailBlock = document.getElementById('userPickerEmailBlock');
  const emailInput = document.getElementById('userPickerEmail');
  let ssoEnabled = false;
  try {
    const status = await (await fetch('/auth/status')).json();
    ssoEnabled = Boolean(status?.data?.enabled);
  } catch {
    ssoEnabled = false;
  }
  if (emailBlock && ssoEnabled) emailBlock.classList.remove('d-none');

  const signOutBtn = document.getElementById('userPickerSignOut');
  if (signOutBtn) signOutBtn.addEventListener('click', ssoSignOut);

  list.querySelectorAll('[data-pick-user]').forEach(b =>
    b.addEventListener('click', async () => {
      const userId = b.dataset.pickUser;
      const email = (emailInput?.value || '').trim();

      // Save the address BEFORE switching: switchToUser reloads the page on
      // success, so anything left until afterwards never runs.
      if (email && ssoEnabled) {
        try {
          const response = await app.fetchRaw(`/api/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify({ email })
          });
          const result = await response.json();
          if (!result.success) {
            app.notify('Could not save that address: ' + result.message, 'danger');
            return;
          }
        } catch (error) {
          console.error('Error saving email from picker:', error);
          app.notify('Could not save that address', 'danger');
          return;
        }
      }

      switchToUser(userId);
    }));

  new bootstrap.Modal(el, { backdrop: 'static', keyboard: false }).show();
}

async function initUserAndContext() {
  const state = await initUserSwitcher();
  initContextSwitcher();
  if (state?.needsUser) showUserPicker(state.users);
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('MyWork application initialized');
    initUserAndContext();
  });
} else {
  console.log('MyWork application initialized');
  initUserAndContext();
}
