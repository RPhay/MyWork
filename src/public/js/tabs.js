// Tab Management
// The remembered tab is stored per page: the dashboard and Settings both have
// tab strips with entirely different keys, so one shared entry meant visiting
// Settings clobbered the dashboard's tab (and vice versa) with a name the other
// page has no tab for.
function rememberedTabKey() {
  return `currentTab:${window.location.pathname}`;
}

class TabManager {
  constructor() {
    // Precedence: an explicit ?tab= in the URL, then the tab this page was last
    // left on, then the server's default. That is what makes leaving for
    // Settings and coming back land on the tab you were working in.
    const urlTab = new URLSearchParams(window.location.search).get('tab');
    const remembered = sessionStorage.getItem(rememberedTabKey());
    const fallback = window.APP_CONFIG?.activeTab || 'dailies';

    this.currentTab = urlTab || remembered || fallback;

    // Only honour a remembered tab that still exists - a type can be disabled
    // or deleted while its name is still sitting in sessionStorage.
    if (!document.querySelector(`button[data-tab="${CSS.escape(this.currentTab)}"]`)) {
      this.currentTab = fallback;
    }

    this.init();
  }

  init() {
    this.setupTabButtons();
    this.showTab(this.currentTab);
    this.setupUrlSync();
    this.initializeTabContent();
    this.applyContextTabConfig();
  }

  initializeTabContent() {
    // Initialize the currently active tab
    if (this.currentTab === 'dailies' && typeof renderCalendar !== 'undefined') {
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
      const tab = e.state?.tab || window.APP_CONFIG?.activeTab || 'dailies';
      this.showTab(tab);
    });
  }

  loadTabData(tabName) {
    // Re-fetch this tab's data every time it's switched to, so content reflects
    // whatever changed elsewhere while the tab wasn't active (not just what was
    // loaded once at page load).
    console.log('Loading tab data for:', tabName);

    switch (tabName) {
      case 'dailies':
        if (typeof loadWorkItems !== 'undefined') loadWorkItems();
        break;
      case 'my-priorities':
        if (typeof loadPriorities !== 'undefined') loadPriorities();
        if (typeof loadPriorityRightPanel !== 'undefined') loadPriorityRightPanel();
        break;
      case 'areas':
        if (typeof loadAreas !== 'undefined') loadAreas();
        break;
      case 'yearly-goals':
        if (typeof loadYearlyGoals !== 'undefined') loadYearlyGoals();
        break;
      case 'data-sources':
        if (typeof loadSources !== 'undefined') loadSources();
        break;
      case 'database-config':
        if (typeof loadDatabaseConfig !== 'undefined') loadDatabaseConfig();
        break;
      case 'contexts':
        if (typeof loadContexts !== 'undefined') loadContexts();
        break;
      case 'templates':
        if (typeof loadTemplates !== 'undefined') loadTemplates();
        if (typeof loadTemplateRightPanel !== 'undefined') loadTemplateRightPanel();
        break;
      case 'todos':
        if (typeof loadToDos !== 'undefined') loadToDos();
        break;
      case 'brainstorming':
        if (typeof loadIdeas !== 'undefined') loadIdeas();
        break;
      case 'priority-board':
        if (typeof loadBoard !== 'undefined') loadBoard();
        break;
      case 'reporting':
        if (typeof loadActiveReportingSubtab !== 'undefined') loadActiveReportingSubtab();
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
