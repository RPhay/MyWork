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
  project: 'bi-folder2',
  priorityBoard: 'bi-kanban',
  area: 'bi-diagram-3',
  goal: 'bi-bullseye',
  template: 'bi-clipboard-plus',
};

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
    alertDiv.innerHTML = `
      <span>${message}</span>
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

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

  // Confirm action
  confirm(message) {
    return new Promise((resolve) => {
      if (window.confirm(message)) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
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
};

// Make app globally accessible
window.app = app;

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('MyWork application initialized');
  });
} else {
  console.log('MyWork application initialized');
}
