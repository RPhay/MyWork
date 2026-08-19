// Tab Management
// The remembered tab is stored per page: the dashboard and Settings both have
// tab strips with entirely different keys, so one shared entry meant visiting
// Settings clobbered the dashboard's tab (and vice versa) with a name the other
// page has no tab for.
function rememberedTabKey() {
  return `currentTab:${window.location.pathname}`;
}

// The dashboard deliberately does NOT restore a remembered tab: loading the
// dashboard with no ?tab= always lands on the server default (Dailies).
// Settings still restores, because its own strip is where you were working
// when you left it. An explicit ?tab= wins on both pages.
function restoresRememberedTab() {
  return window.location.pathname !== '/';
}

class TabManager {
  constructor() {
    // Precedence: an explicit ?tab= in the URL, then (Settings only) the tab
    // this page was last left on, then the server's default.
    const urlTab = new URLSearchParams(window.location.search).get('tab');
    const remembered = restoresRememberedTab()
      ? sessionStorage.getItem(rememberedTabKey())
      : null;
    // Dailies is a rail now, not a page, so it cannot be the landing tab. The
    // first tab button that actually exists is.
    const serverDefault = window.APP_CONFIG?.activeTab;
    const firstRealTab = document.querySelector('button[data-tab]')?.dataset.tab;
    const fallback =
      (serverDefault && document.querySelector(`button[data-tab="${CSS.escape(serverDefault)}"]`))
        ? serverDefault
        : (firstRealTab || 'priority');

    this.currentTab = urlTab || remembered || fallback;

    // Only honour a remembered tab that still exists - a type can be disabled
    // or deleted while its name is still sitting in sessionStorage.
    if (!document.querySelector(`button[data-tab="${CSS.escape(this.currentTab)}"]`)) {
      this.currentTab = fallback;
    }

    this.init();
  }

  // Dailies rail: its button in the tab bar shows and hides the rail beside
  // whichever tab is open, instead of switching to a page of its own. The
  // choice is remembered, and the rail starts open.
  setupDailiesRail() {
    const KEY = 'dailiesRailOpen';
    const apply = (open) => {
      document.body.classList.toggle('dailies-rail-open', open);
      document.querySelectorAll('[data-rail-toggle]').forEach(el => {
        if (el.tagName === 'BUTTON') el.classList.toggle('active', open);
      });
    };
    apply(localStorage.getItem(KEY) !== 'false');

    // The rail is resizable, and its width outlives closing and reopening it -
    // and page loads. Stored as a percentage so it still makes sense if the
    // window is a different size next time.
    const WIDTH_KEY = 'dailiesRailWidth';
    const rail = document.getElementById('dailiesRail');
    const divider = document.getElementById('dailiesRailDivider');
    const shell = document.getElementById('appShell');

    const applyWidth = (pct) => {
      if (rail) rail.style.flex = `0 0 ${pct}%`;
    };
    const storedWidth = parseFloat(localStorage.getItem(WIDTH_KEY));
    applyWidth(Number.isFinite(storedWidth) ? storedWidth : 50);

    if (divider && rail && shell) {
      let dragging = false;
      divider.addEventListener('mousedown', (e) => {
        dragging = true;
        divider.classList.add('dragging');
        e.preventDefault();          // otherwise the drag selects text
      });
      document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const box = shell.getBoundingClientRect();
        const pct = ((e.clientX - box.left) / box.width) * 100;
        // Kept within sane bounds: neither side may be squeezed out entirely.
        applyWidth(Math.min(80, Math.max(20, pct)));
      });
      document.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false;
        divider.classList.remove('dragging');
        const box = shell.getBoundingClientRect();
        const pct = (rail.getBoundingClientRect().width / box.width) * 100;
        localStorage.setItem(WIDTH_KEY, String(Math.round(pct * 10) / 10));
      });
    }

    // The calendar inside the rail has its own toggle, since the Work Picker
    // tab it used to share space with is gone.
    const CAL_KEY = 'dailiesCalendarOpen';
    const applyCal = (open) => {
      document.body.classList.toggle('dailies-calendar-open', open);
      document.getElementById('toggleDailiesCalendarBtn')?.classList.toggle('active', open);
    };
    applyCal(localStorage.getItem(CAL_KEY) !== 'false');
    document.getElementById('toggleDailiesCalendarBtn')?.addEventListener('click', () => {
      const open = !document.body.classList.contains('dailies-calendar-open');
      localStorage.setItem(CAL_KEY, String(open));
      applyCal(open);
    });

    document.querySelectorAll('button[data-rail-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const open = !document.body.classList.contains('dailies-rail-open');
        localStorage.setItem(KEY, String(open));
        apply(open);
      });
    });
  }

  init() {
    this.setupDailiesRail();
    this.setupTabButtons();
    this.showTab(this.currentTab);
    this.setupUrlSync();
    this.initializeTabContent();
    this.applyContextTabConfig();
  }

  initializeTabContent() {
    // Initialize the currently active tab
    // The rail is always in the DOM, so Dailies initialises on every page load
    // rather than when its tab is opened.
    if (typeof renderCalendar !== 'undefined') {
      renderCalendar();
      updateDateDisplay();
      const today = new Date().toISOString().split('T')[0];
      const dateInput = document.getElementById('selectedDate');
      if (!dateInput) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.id = 'selectedDate';
        input.value = today;
        document.body.appendChild(input);
      }
      loadWorkItems();
    }
  }

  // Tab order is global, not per context: it is entity_types.order_index, the
  // same value Settings > Entity Types writes when you drag types there. This
  // list and that one are two views of one value, in both directions.
  //
  // Visibility is entity_types.is_visible and is applied server-side in
  // dashboard.ejs, so a hidden type never reaches the DOM - there is nothing to
  // hide here. This replaced a per-context layer (context_tab_settings) that
  // fetched settings after render and reordered on top of the global order;
  // with two mechanisms owning one property they disagreed as soon as either
  // was used.
  applyContextTabConfig() {
    const nav = document.getElementById('mainTabs');
    if (!nav || !window.app?.bindTabDragReorder) return;

    app.bindTabDragReorder(nav, 'li[data-type-id]', async () => {
      // Every type tab in DOM order, Dailies included - reorderEntityTypes
      // assigns 0..n to exactly the ids it is given, so sending a partial list
      // would leave the omitted types sharing stale indices.
      const orderedIds = Array.from(nav.querySelectorAll('li[data-type-id]'))
        .map(li => Number(li.dataset.typeId));
      try {
        const response = await fetch('/api/entity-types/reorder', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': document.body.dataset.csrfToken || window.APP_CONFIG?.csrfToken,
          },
          body: JSON.stringify({ orderedIds }),
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
      } catch (error) {
        console.error('Error saving tab order:', error);
        app.notify?.('Could not save the new tab order', 'danger');
      }
    });
  }

  setupTabButtons() {
    // button[data-tab] specifically - some tab <li> wrappers also carry a
    // data-tab attribute (for drag-reorder addressing), and matching those
    // too would double-fire this handler on every click via event bubbling.
    const tabButtons = document.querySelectorAll('button[data-tab]');
    tabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = button.dataset.tab;
        this.switchTab(tab);
      });
    });
  }

  switchTab(tabName) {
    // Update URL without reload (preserve whichever page we're on, e.g. / or /settings)
    window.history.pushState(
      { tab: tabName },
      '',
      `${window.location.pathname}?tab=${tabName}`
    );

    // Show the tab
    this.showTab(tabName);

    // Remembered per page - see rememberedTabKey().
    sessionStorage.setItem(rememberedTabKey(), tabName);
  }

  showTab(tabName) {
    // Hide all tabs
    const tabPanes = document.querySelectorAll('.tab-content-pane');
    tabPanes.forEach(pane => {
      pane.classList.remove('active');
    });

    // Remove active class from all buttons
    const tabButtons = document.querySelectorAll('button[data-tab]');
    tabButtons.forEach(button => {
      button.classList.remove('active');
    });

    // Show selected tab
    const selectedPane = document.getElementById(`tab-${tabName}`);
    if (selectedPane) {
      selectedPane.classList.add('active');
    }

    // Add active class to button
    const selectedButton = document.querySelector(`button[data-tab="${tabName}"]`);
    if (selectedButton) {
      selectedButton.classList.add('active');
    }

    this.currentTab = tabName;

    // Load tab-specific data
    this.loadTabData(tabName);
  }

  setupUrlSync() {
    // Handle browser back/forward
    window.addEventListener('popstate', (e) => {
      const tab = e.state?.tab || window.APP_CONFIG?.activeTab || 'work_item';
      this.showTab(tab);
    });
  }

  loadTabData(tabName) {
    // Re-fetch this tab's data every time it's switched to, so content reflects
    // whatever changed elsewhere while the tab wasn't active (not just what was
    // loaded once at page load).
    console.log('Loading tab data for:', tabName);

    // Only tabs that actually exist belong here. This switch had accumulated
    // cases for `my-priorities`, `areas`, `yearly-goals`, `todos`,
    // `brainstorming`, `data-sources` and `database-config` - none of which is
    // a tab name any more, and most of whose loader functions were deleted
    // with the bespoke tabs they belonged to. They were silently doing nothing
    // behind `typeof x !== 'undefined'` guards.
    //
    // The typed pages (Categories, Goals, Todos, Tasks, Tickets, Ideas,
    // Projects) are absent on purpose: generic-entity-init.js owns their
    // fetching. Only the hand-written tabs need an entry.
    switch (tabName) {
      case 'template':
        if (typeof loadTemplates !== 'undefined') loadTemplates();
        break;
      case 'priority-board':
        if (typeof loadBoard !== 'undefined') loadBoard();
        break;
      case 'reporting':
        if (typeof loadActiveReportingSubtab !== 'undefined') loadActiveReportingSubtab();
        break;
      // Settings
      case 'contexts':
        if (typeof loadContexts !== 'undefined') loadContexts();
        break;
    }
  }

  static getInstance() {
    if (!window.tabManager) {
      window.tabManager = new TabManager();
    }
    return window.tabManager;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    TabManager.getInstance();
  });
} else {
  TabManager.getInstance();
}

// Export for use in other scripts
window.TabManager = TabManager;
