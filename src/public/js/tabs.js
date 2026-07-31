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
  }

  initializeTabContent() {
    // Initialize Dailies tab if it exists
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
      loadPrioritiesAndGoals();
    }

    // Initialize Projects tab if it exists
    if (typeof loadPriorities !== 'undefined') {
      loadPriorities();
      loadPriorityRightPanel();
    }

    // Initialize Areas tab if it exists
    if (typeof loadAreas !== 'undefined') {
      loadAreas();
    }

    // Initialize Goals tab if it exists
    if (typeof loadYearlyGoals !== 'undefined') {
      loadYearlyGoals();
    }

    // Initialize Data Sources tab if it exists
    if (typeof loadSources !== 'undefined') {
      loadSources();
    }

    // Initialize Database Configuration tab if it exists
    if (typeof loadDatabaseConfig !== 'undefined') {
      loadDatabaseConfig();
    }

    // Initialize Templates tab if it exists
    if (typeof loadTemplates !== 'undefined') {
      loadTemplates();
      loadTemplateRightPanel();
    }

    // Initialize To Dos tab if it exists
    if (typeof loadToDos !== 'undefined') {
      loadToDos();
    }

    // Initialize Priorities tab if it exists
    if (typeof loadBoard !== 'undefined') {
      loadBoard();
    }
  }

  setupTabButtons() {
    const tabButtons = document.querySelectorAll('[data-tab]');
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
    const tabButtons = document.querySelectorAll('[data-tab]');
    tabButtons.forEach(button => {
      button.classList.remove('active');
    });

    // Show selected tab
    const selectedPane = document.getElementById(`tab-${tabName}`);
    if (selectedPane) {
      selectedPane.classList.add('active');
    }

    // Add active class to button
    const selectedButton = document.querySelector(`[data-tab="${tabName}"]`);
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
        if (typeof loadPrioritiesAndGoals !== 'undefined') loadPrioritiesAndGoals();
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
