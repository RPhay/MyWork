// Tab Management
class TabManager {
  constructor() {
    this.currentTab = window.APP_CONFIG?.activeTab || 'dailies';
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
      loadPrioritiesAndGoals();
    }
  }

  // Per-context tab visibility/order - dashboard.ejs only (Dailies is always
  // shown first regardless, so it's excluded from both the fetched settings
  // and the drag-reorder target). Settings' own top-level tabs are a separate,
  // fixed-order tab strip and never go through this.
  applyContextTabConfig() {
    this._applyContextTabConfig();
  }

  async _applyContextTabConfig() {
    const nav = document.getElementById('mainTabs');
    const dailiesTab = document.getElementById('dailies-tab');
    if (!nav || !dailiesTab) return;

    try {
      const activeResponse = await fetch('/api/active-context');
      const activeResult = await activeResponse.json();
      if (!activeResult.success) return;
      const contextId = activeResult.data.id;

      const settingsResponse = await fetch(`/api/context-tab-settings/${contextId}`);
      const settingsResult = await settingsResponse.json();
      if (!settingsResult.success) return;

      const byKey = new Map(settingsResult.data.map(s => [s.key, s]));

      Array.from(nav.querySelectorAll('li[data-tab]')).forEach(li => {
        const setting = byKey.get(li.dataset.tab);
        li.classList.toggle('d-none', !!setting && setting.visible === false);
      });

      // Reorder to match saved order_index, keeping Dailies first no matter what.
      const ordered = settingsResult.data
        .slice()
        .sort((a, b) => a.order_index - b.order_index)
        .map(s => nav.querySelector(`li[data-tab="${s.key}"]`))
        .filter(Boolean);
      ordered.forEach(li => nav.appendChild(li));

      app.bindTabDragReorder(nav, 'li[data-tab]', async (orderedKeys) => {
        try {
          const settings = orderedKeys.map(key => ({ key, visible: byKey.get(key)?.visible !== false }));
          await fetch(`/api/context-tab-settings/${contextId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': window.APP_CONFIG?.csrfToken
            },
            body: JSON.stringify({ settings })
          });
        } catch (error) {
          console.error('Error saving tab order:', error);
        }
      });
    } catch (error) {
      console.error('Error applying context tab config:', error);
    }
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

    // Store in sessionStorage
    sessionStorage.setItem('currentTab', tabName);
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

    const loads = [];

    switch (tabName) {
      case 'dailies':
        if (typeof loadWorkItems !== 'undefined') loads.push(window.loadingManager.withLoader(() => loadWorkItems()));
        if (typeof loadPrioritiesAndGoals !== 'undefined') loads.push(window.loadingManager.withLoader(() => loadPrioritiesAndGoals()));
        break;
      case 'my-priorities':
        if (typeof loadPriorities !== 'undefined') loads.push(window.loadingManager.withLoader(() => loadPriorities()));
        if (typeof loadPriorityRightPanel !== 'undefined') loads.push(window.loadingManager.withLoader(() => loadPriorityRightPanel()));
        break;
      case 'areas':
        if (typeof loadAreas !== 'undefined') loads.push(window.loadingManager.withLoader(() => loadAreas()));
        break;
      case 'yearly-goals':
        if (typeof loadYearlyGoals !== 'undefined') loads.push(window.loadingManager.withLoader(() => loadYearlyGoals()));
        break;
      case 'data-sources':
        if (typeof loadSources !== 'undefined') loads.push(window.loadingManager.withLoader(() => loadSources()));
        break;
      case 'database-config':
        if (typeof loadDatabaseConfig !== 'undefined') loads.push(window.loadingManager.withLoader(() => loadDatabaseConfig()));
        break;
      case 'contexts':
        if (typeof loadContexts !== 'undefined') loads.push(window.loadingManager.withLoader(() => loadContexts()));
        break;
      case 'templates':
        if (typeof loadTemplates !== 'undefined') loads.push(window.loadingManager.withLoader(() => loadTemplates()));
        if (typeof loadTemplateRightPanel !== 'undefined') loads.push(window.loadingManager.withLoader(() => loadTemplateRightPanel()));
        break;
      case 'todos':
        if (typeof loadToDos !== 'undefined') loads.push(window.loadingManager.withLoader(() => loadToDos()));
        break;
      case 'brainstorming':
        if (typeof loadIdeas !== 'undefined') loads.push(window.loadingManager.withLoader(() => loadIdeas()));
        break;
      case 'priority-board':
        if (typeof loadBoard !== 'undefined') loads.push(window.loadingManager.withLoader(() => loadBoard()));
        break;
      case 'reporting':
        if (typeof loadActiveReportingSubtab !== 'undefined') loads.push(window.loadingManager.withLoader(() => loadActiveReportingSubtab()));
        break;
    }

    Promise.all(loads).catch(error => {
      console.error('Error loading tab data:', error);
    });
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
