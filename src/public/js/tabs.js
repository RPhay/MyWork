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

  // Rails: Dailies and Templates are panes that sit beside the current type
  // tab rather than being pages of their own. Two panes show at a time, drawn
  // from three participants in a fixed left-to-right order - Dailies,
  // Templates, the type tab:
  //
  //   Dailies + type      -> Dailies   | type
  //   Templates + type    -> Templates | type
  //   Dailies + Templates -> Dailies   | Templates   (the type is hidden)
  //
  // So each rail toggles independently; turning both on is what hides the type
  // content, and the left slot goes to whichever rail comes first in that
  // order. Both rails are always in the DOM, so each initialises on page load.
  setupRails() {
    // Three things can sit beside what you are working on. Only two panes show
    // at once, drawn from these plus the current tab, in this left-to-right
    // order.
    const RAILS = ['work_item', 'template', 'priority-board'];
    const KEY = (slug) => `rail:${slug}`;
    const WIDTH_KEY = 'appRailWidth';

    const isOn = (slug) => localStorage.getItem(KEY(slug)) === 'true';
    // Dailies starts on, matching how the rail behaved when it was the only
    // one; Templates starts off.
    if (localStorage.getItem(KEY('work_item')) === null) {
      localStorage.setItem(KEY('work_item'), 'true');
    }

    const shell = document.getElementById('appShell');
    const content = document.getElementById('mainTabContent');

    const apply = () => {
      // A full-width view owns the screen: no rails, no dividers, and the tab
      // content takes everything.
      const on = this.fullWidthTab ? [] : RAILS.filter(isOn);
      // Both rails on means they are the two panes and the type stands down.
      const showContent = on.length < 2;
      const panes = showContent ? [...on, 'content'] : on;

      RAILS.forEach((slug) => {
        document.getElementById(`rail-${slug}`)?.classList.toggle('active', on.includes(slug));
        document.querySelectorAll(`button[data-rail-toggle="${slug}"]`)
          .forEach((btn) => btn.classList.toggle('active', on.includes(slug)));
      });
      content?.classList.toggle('rail-hidden', !showContent);
      // With both rails up the type stands down, so no type tab is selected -
      // nothing of that type is on screen to be "current".
      this.contentHidden = !showContent;
      this.syncTabHighlight();

      // A divider belongs after a rail only when another pane follows it.
      RAILS.forEach((slug) => {
        const idx = panes.indexOf(slug);
        const divider = document.getElementById(`railDivider-${slug}`);
        divider?.classList.toggle('active', idx !== -1 && idx < panes.length - 1);
      });

      document.body.dataset.activeRails = on.join(',');
      document.body.classList.toggle('rail-open', on.length > 0);
      applyWidth(storedWidth());
    };

    // One stored width, applied to whichever pane is currently leftmost - the
    // rails share a slot, so one setting is the honest model. Stored as a
    // percentage so it still makes sense at a different window size; falls back
    // to the old Dailies-only key so an existing preference carries over.
    const storedWidth = () => {
      const pct = parseFloat(
        localStorage.getItem(WIDTH_KEY) ?? localStorage.getItem('dailiesRailWidth')
      );
      return Number.isFinite(pct) ? pct : 50;
    };

    const applyWidth = (pct) => {
      const first = RAILS.filter(isOn)[0];
      RAILS.forEach((slug) => {
        const el = document.getElementById(`rail-${slug}`);
        if (el) el.style.flex = slug === first ? `0 0 ${pct}%` : '1 1 auto';
      });
    };

    // Dragging any visible divider resizes the leftmost pane.
    RAILS.forEach((slug) => {
      const divider = document.getElementById(`railDivider-${slug}`);
      if (!divider || !shell) return;
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
        const first = document.getElementById(`rail-${RAILS.filter(isOn)[0]}`);
        if (!first) return;
        const box = shell.getBoundingClientRect();
        const pct = (first.getBoundingClientRect().width / box.width) * 100;
        localStorage.setItem(WIDTH_KEY, String(Math.round(pct * 10) / 10));
      });
    });

    // The calendar inside the Dailies rail has its own toggle, since the Work
    // Picker tab it used to share space with is gone.
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

    document.querySelectorAll('button[data-rail-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const slug = btn.dataset.railToggle;
        localStorage.setItem(KEY(slug), String(!isOn(slug)));
        apply();
      });
    });

    // showTab re-runs this when moving between a full-width view and a normal
    // tab, so the rails hide and come back without touching the stored toggles.
    this.applyRails = apply;

    this.closeRail = (slug) => {
      if (!isOn(slug)) return;
      localStorage.setItem(KEY(slug), 'false');
      apply();
    };

    apply();
  }

  // The one place a type tab is marked selected. showTab() and setupRails()
  // both route through it so they cannot disagree about whether a type is
  // current - it is only current when its content is actually showing.
  syncTabHighlight() {
    document.querySelectorAll('button[data-tab]').forEach((btn) => {
      btn.classList.toggle('active', !this.contentHidden && btn.dataset.tab === this.currentTab);
    });
  }

  init() {
    this.setupRails();
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
        const response = await app.fetchRaw('/api/entity-types/reorder', {
          method: 'PATCH',
          
          body: JSON.stringify({ orderedIds }) });
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
        // Both rails up means the type has nowhere to render. Asking for a type
        // is a request to see it, so the right-hand rail (Templates) stands
        // down and the type takes that slot.
        if (this.contentHidden) this.closeRail?.('template');
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

    this.currentTab = tabName;

    // Some views want the whole screen (Reporting: tables, charts and a
    // portfolio breakdown, unreadable beside a rail). The rails stand down
    // while such a tab is open and come back exactly as they were on leaving -
    // the toggles are untouched, so nothing is forgotten.
    const button = document.querySelector(`button[data-tab="${tabName}"]`);
    this.fullWidthTab = button?.dataset.fullwidth === 'true';
    document.body.classList.toggle('fullwidth-tab', !!this.fullWidthTab);
    this.applyRails?.();

    // Highlighting goes through the shared rule, which refuses to mark a type
    // current while both rails are up and its content is hidden.
    this.syncTabHighlight();

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
