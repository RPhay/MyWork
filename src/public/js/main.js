// Main Application JavaScript

// Server-rendered config, passed via data attributes on <body> (CSP-safe: no inline script needed)
window.APP_CONFIG = {
  activeTab: document.body.dataset.activeTab || 'dailies',
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

  // Make API call with CSRF token
  async fetch(url, options = {}) {
    const csrfToken = window.APP_CONFIG?.csrfToken || document.querySelector('[name="_csrf"]')?.value;

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('API Error:', error);
      this.notify(`Error: ${error.message}`, 'danger');
      throw error;
    }
  },

  // Get CSRF token from page
  getCsrfToken() {
    return window.APP_CONFIG?.csrfToken || document.querySelector('[name="_csrf"]')?.value;
  },

  // Confirm action with custom modal
  confirm(message, title = 'Confirm Action') {
    return new Promise((resolve) => {
      const modalElement = document.getElementById('confirmModal');
      if (!modalElement) {
        // Fallback to browser confirm if modal doesn't exist
        resolve(window.confirm(message));
        return;
      }

      const titleElement = document.getElementById('confirmModalTitle');
      const messageElement = document.getElementById('confirmModalMessage');
      const confirmBtn = document.getElementById('confirmModalConfirm');
      const cancelBtn = document.getElementById('confirmModalCancel');

      if (!titleElement || !messageElement || !confirmBtn || !cancelBtn) {
        // Fallback to browser confirm if any element is missing
        resolve(window.confirm(message));
        return;
      }

      titleElement.textContent = title;
      messageElement.textContent = message;

      const modal = new bootstrap.Modal(modalElement);
      modal.show();

      const handleConfirm = () => {
        modal.hide();
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        resolve(true);
      };

      const handleCancel = () => {
        modal.hide();
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        resolve(false);
      };

      confirmBtn.addEventListener('click', handleConfirm);
      cancelBtn.addEventListener('click', handleCancel);
    });
  },

  // Icon shown inside a status checkbox; empty for 'incomplete' (empty box).
  statusIcon(status) {
    return { complete: 'bi-check-lg', failed: 'bi-x-lg', skipped: 'bi-dash-lg' }[status] || '';
  },

  // Advance a to-do's or task's status to the next state in STATUS_CYCLE and
  // save it; shared by every page that renders a status checkbox. `endpoint`
  // is the full REST URL for the item being updated (e.g. `/api/to-dos/5` or
  // `/api/tasks/5`).
  async cycleStatus(endpoint, currentStatus) {
    const idx = STATUS_CYCLE.indexOf(currentStatus);
    const nextStatus = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ status: nextStatus })
    });
    return response.json();
  },

  // For flat (non-hierarchical) drag-reorder lists: which half of the hovered
  // row the cursor is in, so dropping shows/lands as "insert before" or
  // "insert after" instead of silently reordering with no visual cue.
  getVerticalDropZone(event, rowEl) {
    const rect = rowEl.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
  },

  // For hierarchical (tree) drag-reorder lists: same idea, but the middle band
  // of the row means "nest inside this row" rather than "insert before/after" it.
  getTreeDropZone(event, rowEl) {
    const rect = rowEl.getBoundingClientRect();
    const offset = (event.clientY - rect.top) / rect.height;
    if (offset < 0.25) return 'before';
    if (offset > 0.75) return 'after';
    return 'nest';
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
      e.dataTransfer.effectAllowed = 'move';
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
          const response = await fetch('/api/active-context', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': window.APP_CONFIG?.csrfToken
            },
            body: JSON.stringify({ id: item.dataset.contextId })
          });
          const result = await response.json();
          if (!result.success) {
            app.notify('Error: ' + result.message, 'danger');
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
