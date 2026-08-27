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

  // Rails and the type pane: what may share the screen, and how you ask.
  //
  // Four panes exist - three rails (Dailies, Templates, Priorities) and the
  // type pane, which holds whichever type tab is current. TWO show at a time,
  // in a fixed left-to-right order:
  //
  //   Dailies | Templates | Priorities | type
  //
  // Every pair is legal EXCEPT Templates + Priorities, which never sit
  // together. One plain click on any tab in the bar - rail or type - decides
  // the layout, by one rule:
  //
  //   not showing            -> it joins what is on screen, if the two may
  //                             share; otherwise it takes the screen alone
  //   showing beside another -> it takes the screen alone
  //   showing on its own     -> the pane that stepped aside comes back
  //
  // The last two make ONE tab a toggle between the pair and that pane alone:
  //   Dailies alone -> click Categories -> Dailies | Categories
  //                 -> click Categories -> Categories
  //                 -> click Categories -> Dailies | Categories ...
  // and clicking the OTHER tab of a pair collapses to that half instead, so
  // either tab of a pair is a way in and out of it. No modifier key anywhere,
  // and no click leaves a blank screen. (Clicking a type tab OTHER than the
  // current one is a switch, not a toggle - the pane stays where it is and
  // changes what it holds.)
  //
  // Both rails are always in the DOM, so each initialises on page load.
  setupRails() {
    const RAILS = ['daily', 'template', 'priority-board'];
    // The type pane is a participant like the rails, so the rule above can be
    // written once for all four rather than twice with two sets of edge cases.
    const CONTENT = 'content';
    const KEY = (slug) => `rail:${slug}`;
    const WIDTH_KEY = 'appRailWidth';
    // Whether the type pane is showing. Stored beside the rail toggles, because
    // it is the same kind of choice - which panes you want - and losing it on a
    // refresh put a pane back that had deliberately been put away.
    const CONTENT_KEY = 'typePaneVisible';
    // Which pane was asked for most recently. It settles the one question the
    // rule above leaves open: when an incoming pane could join either of two
    // already on screen, the older one is the one that steps out.
    const MRU_KEY = 'paneRecency';

    // The only pair that may not share the screen.
    const NEVER_TOGETHER = [['template', 'priority-board']];
    const canPair = (a, b) =>
      a !== b && !NEVER_TOGETHER.some((pair) => pair.includes(a) && pair.includes(b));

    const isOn = (slug) => localStorage.getItem(KEY(slug)) === 'true';
    // Dailies starts on, matching how the rail behaved when it was the only
    // one; Templates starts off.
    if (localStorage.getItem(KEY('daily')) === null) {
      localStorage.setItem(KEY('daily'), 'true');
    }

    const shell = document.getElementById('appShell');
    const content = document.getElementById('mainTabContent');

    // Restored before the first apply(), or the first paint would show the pane
    // and then hide it.
    if (this.contentVisible === undefined) {
      this.contentVisible = localStorage.getItem(CONTENT_KEY) !== 'false';
    }

    let mru = (() => {
      try {
        const stored = JSON.parse(localStorage.getItem(MRU_KEY));
        return Array.isArray(stored) ? stored.filter((p) => [...RAILS, CONTENT].includes(p)) : [];
      } catch { return []; }
    })();
    const touch = (pane) => {
      mru = [pane, ...mru.filter((p) => p !== pane)];
      try { localStorage.setItem(MRU_KEY, JSON.stringify(mru)); } catch { /* storage off */ }
    };
    const rank = (pane) => (mru.indexOf(pane) === -1 ? Number.MAX_SAFE_INTEGER : mru.indexOf(pane));
    const byRecency = (panes) => [...panes].sort((a, b) => rank(a) - rank(b));

    // Set while an editor is open elsewhere in the file (focusPaneForEditor),
    // to force exactly one pane on screen without touching the stored rail
    // preferences below - an editor abandoned by navigating away rather than
    // being closed properly (a reload, a click to another tab) must not leave
    // the real preference permanently overwritten with this transient one.
    let editorForcedPane = null;

    // What is ACTUALLY on screen, left to right. Every decision below is made
    // against this rather than against the stored flags, which can disagree
    // with it - a rail is stored as open while a full-width view is up, and
    // apply() clamps to two panes whatever the flags say.
    const visiblePanes = () => {
      if (editorForcedPane) return [editorForcedPane];
      const on = this.fullWidthTab ? [] : RAILS.filter(isOn);
      const showContent = this.fullWidthTab
        ? true
        : (this.contentVisible !== false && on.length < 2);
      return showContent ? [...on, CONTENT] : on;
    };

    const apply = () => {
      const panes = visiblePanes();
      const on = panes.filter((p) => p !== CONTENT);
      const showContent = panes.includes(CONTENT);

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

    // The stored width splits TWO panes. With only one on screen there is
    // nothing to split, so it takes the lot - putting the type pane away used to
    // leave the rail at half width with dead space beside it.
    const applyWidth = (pct) => {
      const panes = visiblePanes();
      const first = panes[0];
      const alone = panes.length === 1;
      RAILS.forEach((slug) => {
        const el = document.getElementById(`rail-${slug}`);
        if (!el) return;
        el.style.flex = slug === first
          ? (alone ? '1 1 auto' : `0 0 ${pct}%`)
          : '1 1 auto';
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

    const setRail = (slug, on) => localStorage.setItem(KEY(slug), String(on));
    // One place that writes it, so no path can change it without storing it.
    const setContentVisible = (on) => {
      this.contentVisible = on;
      localStorage.setItem(CONTENT_KEY, String(on));
    };
    this.setContentVisible = setContentVisible;

    // Put exactly these panes on screen and nothing else.
    const setPanes = (panes) => {
      RAILS.forEach((slug) => setRail(slug, panes.includes(slug)));
      setContentVisible(panes.includes(CONTENT));
    };
    this.setPanes = setPanes;

    // An open editor commands the screen: every other pane steps aside, the
    // same way half of a pair does on a click (see the rule above showPane) -
    // this is that same "takes the screen alone" outcome, triggered by an
    // editor opening rather than a click. `pane` is a RAIL slug or CONTENT.
    // The panes on screen when the editor opened are remembered so closing it
    // brings them back exactly as they were, the way the stepped-aside pane
    // always has.
    let panesBeforeEditor = null;
    this.focusPaneForEditor = (pane) => {
      if (panesBeforeEditor === null) panesBeforeEditor = visiblePanes();
      editorForcedPane = pane;
      apply();
    };
    this.restorePanesAfterEditor = () => {
      if (panesBeforeEditor === null) return;
      editorForcedPane = null;
      panesBeforeEditor = null;
      apply();
    };

    // The one rule, applied to whichever tab was clicked - see the comment
    // above setupRails().
    const showPane = (target) => {
      // A real click is the user overriding whatever an open editor forced -
      // otherwise the click would be silently swallowed, since visiblePanes()
      // would keep reporting only the forced pane no matter what was clicked.
      editorForcedPane = null;
      panesBeforeEditor = null;

      const before = visiblePanes();

      if (this.fullWidthTab) {
        // A full-width view (Reporting) shares with nothing, so asking for any
        // other pane is asking to leave it. Its own tab has nowhere to go.
        if (target === CONTENT) return;
        this.fullWidthTab = false;
        document.body.classList.remove('fullwidth-tab');
        setPanes([target]);
      } else if (before.includes(target) && before.length > 1) {
        // Half of a pair takes the screen. The half that steps aside is
        // recorded as the freshest pane NOT showing, which is what the branch
        // below then brings back - without this it was only remembered if it
        // had been clicked at some point, so collapsing onto a rail beside a
        // type pane you had never clicked brought Dailies back instead of it.
        const stepped = before.find((p) => p !== target);
        setPanes([target]);
        if (stepped) touch(stepped);
      } else if (before.includes(target)) {
        // Already the only pane on screen: the click asks for the pane that
        // stepped aside to come back. That is the most recently asked-for pane
        // that is NOT showing and that this one may share with - which, after a
        // collapse, is exactly the half that just left.
        const partner = byRecency([...RAILS, CONTENT].filter((p) => p !== target))
          .find((p) => canPair(p, target));
        if (!partner) return;                        // nothing may join it
        setPanes([target, partner]);
      } else {
        // Not showing: it joins what IS, preferring the pane asked for most
        // recently; if neither will have it, it takes the screen alone.
        const partner = byRecency(before).find((p) => canPair(p, target));
        setPanes(partner ? [target, partner] : [target]);
      }
      // Deliberately AFTER the choice above, and never applied to the partner:
      // the target sitting at the head of the recency list with the partner
      // just behind it is what makes one tab alternate between the pair and
      // itself alone, indefinitely.
      touch(target);
      apply();
    };
    this.showPane = showPane;
    this.paneShowing = (pane) => visiblePanes().includes(pane);
    this.touchPane = touch;

    document.querySelectorAll('button[data-rail-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => showPane(btn.dataset.railToggle));
    });

    // showTab re-runs this when moving between a full-width view and a normal
    // tab, so the rails hide and come back without touching the stored toggles.
    this.applyRails = apply;

    this.closeRail = (slug) => {
      if (!isOn(slug)) return;
      setRail(slug, false);
      if (!visiblePanes().length) setContentVisible(true);   // never a blank screen
      apply();
    };

    apply();
  }

  // The one place a type tab is marked selected. showTab() and setupRails()
  // both route through it so they cannot disagree about whether a type is
  // current - it is only current when its content is actually showing.
  syncTabHighlight() {
    document.querySelectorAll('button[data-tab]').forEach((btn) => {
      btn.classList.toggle('active',
        this.contentVisible !== false && !this.contentHidden && btn.dataset.tab === this.currentTab);
    });
  }

  init() {
    this.setupRails();
    this.setupTabButtons();
    this.setupTabMenus();
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

  // ===== Tab context menus =====
  //
  // Right-clicking a tab offers what you would otherwise have to open the tab
  // to do: make something, expand or collapse its tree, or give it the screen.
  // The actions differ by what the tab IS - a type, a rail, or a full-width
  // view - because "meaningful" is not the same list for each.
  setupTabMenus() {
    let menuEl = null;
    const close = () => { menuEl?.remove(); menuEl = null; };

    const open = (x, y, items) => {
      close();
      if (!items.length) return;
      menuEl = document.createElement('div');
      menuEl.className = 'context-menu tab-context-menu';
      for (const item of items) {
        if (item.separator) {
          menuEl.insertAdjacentHTML('beforeend', '<hr style="margin:4px 0;">');
          continue;
        }
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'context-menu-item';
        btn.innerHTML = `<span>${item.icon || ''}</span><span>${item.label}</span>`;
        btn.addEventListener('click', async () => { close(); await item.action(); });
        menuEl.appendChild(btn);
      }
      document.body.appendChild(menuEl);
      const r = menuEl.getBoundingClientRect();
      menuEl.style.left = `${Math.min(x, window.innerWidth - r.width - 8)}px`;
      menuEl.style.top = `${Math.min(y, window.innerHeight - r.height - 8)}px`;
    };

    // A tab's text includes its icon span and the whitespace around it, so
    // reading textContent straight gave labels like "New 💡\n   Idea".
    const tabLabel = (btn) => [...btn.childNodes]
      .filter(n => !(n.nodeType === 1 && n.classList?.contains('tab-icon')))
      .map(n => n.textContent || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Right-clicking a tab should not also leave it half-selected, so each
    // action says explicitly what it does to the screen.
    const showOnly = (fn) => () => {
      this.fullWidthTab = false;
      this.setPanes?.(['content']);
      this.touchPane?.('content');
      fn();
      this.applyRails?.();
    };

    document.addEventListener('mousedown', (e) => {
      if (menuEl && !menuEl.contains(e.target) && e.button !== 2) close();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    // --- type tabs ---
    document.querySelectorAll('button[data-tab]').forEach((btn) => {
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const slug = btn.dataset.tab;
        const label = tabLabel(btn);
        const isFullWidth = btn.dataset.fullwidth === 'true';
        const items = [];

        if (!isFullWidth) {
          // The buttons these drive live inside the tab, so it has to be the
          // tab on screen before they mean anything.
          items.push({
            // No "New": the ➕ already says it, the same way the tab's own
            // button reads "+ Task" rather than "+ New Task".
            icon: '➕', label: `${label.replace(/s$/, '')}`,
            action: showOnly(() => {
              this.switchTab(slug);
              setTimeout(() => document.getElementById(`add${slug}Btn`)?.click(), 250);
            }),
          });
          if (document.getElementById(`add${slug}FolderBtn`)) {
            items.push({
              icon: '📁', label: 'New Folder',
              action: showOnly(() => {
                this.switchTab(slug);
                setTimeout(() => document.getElementById(`add${slug}FolderBtn`)?.click(), 250);
              }),
            });
          }
          items.push({ separator: true });
          items.push({
            icon: '⬇️', label: 'Expand',
            action: () => { this.switchTab(slug); setTimeout(() => document.getElementById(`expandAll${slug}Btn`)?.click(), 250); },
          });
          items.push({
            icon: '⬆️', label: 'Collapse',
            action: () => { this.switchTab(slug); setTimeout(() => document.getElementById(`collapseAll${slug}Btn`)?.click(), 250); },
          });
          items.push({ separator: true });
        }

        items.push({ icon: '🔲', label: 'Show only this', action: showOnly(() => this.switchTab(slug)) });
        if (!isFullWidth) {
          items.push({ icon: '⚙️', label: 'Edit this type…', action: () => {
            window.location.href = `/settings?tab=entity-types&type=${encodeURIComponent(slug)}`;
          } });
        }
        open(e.clientX, e.clientY, items);
      });
    });

    // --- rail tabs ---
    document.querySelectorAll('button[data-rail-toggle]').forEach((btn) => {
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const slug = btn.dataset.railToggle;
        const label = tabLabel(btn);
        const items = [
          { icon: '🔲', label: 'Show only this', action: () => {
            this.fullWidthTab = false;
            this.setPanes?.([slug]);
            this.touchPane?.(slug);
            this.applyRails?.();
          } },
        ];

        // Dailies is the one rail the others may sit beside.
        if (slug !== 'daily') {
          items.push({ icon: '📅', label: `Show beside Dailies`, action: () => {
            this.fullWidthTab = false;
            this.setPanes?.([slug, 'daily']);
            this.touchPane?.(slug);
            this.applyRails?.();
          } });
        }

        items.push({ separator: true });
        items.push({ icon: '✕', label: `Close ${label}`, action: () => this.closeRail?.(slug) });
        open(e.clientX, e.clientY, items);
      });
    });
  }

  setupTabButtons() {
    // button[data-tab] specifically - some tab <li> wrappers also carry a
    // data-tab attribute (for drag-reorder addressing), and matching those
    // too would double-fire this handler on every click via event bubbling.
    const tabButtons = document.querySelectorAll('button[data-tab]');
    tabButtons.forEach(button => {
      // Two clicks means "just this": every rail stands down and the type has
      // the screen to itself. One click still pairs it with whatever rail is
      // open, which is the common case.
      button.addEventListener('dblclick', (e) => {
        e.preventDefault();
        this.fullWidthTab = false;
        this.setPanes?.(['content']);
        this.touchPane?.('content');
        this.switchTab(button.dataset.tab);
        this.applyRails?.();
      });

      button.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = button.dataset.tab;

        // A full-width view (Reporting) shares with nothing, so it never goes
        // through the pairing rule - it simply takes the screen. Its tab is
        // still the current tab after you leave it by asking for a rail, so
        // "already showing" has to mean the full-width view is actually up,
        // not just that its name is in currentTab; without that, clicking
        // Reporting a second time paired it with a rail at half width.
        if (button.dataset.fullwidth === 'true') {
          if (this.fullWidthTab) return;
          this.switchTab(tab);            // showTab() stands the rails down
          return;
        }

        // A type tab is the type pane's tab, so it follows the same one rule as
        // the rails (see setupRails) - with one exception: clicking a type
        // OTHER than the one showing is a switch, not a toggle. The pane stays
        // exactly where it is and changes which type it holds, so switching
        // types never closes the rail beside it.
        if (tab !== this.currentTab) {
          this.switchTab(tab);            // showTab() re-applies the panes
          if (this.paneShowing?.('content')) {
            this.touchPane?.('content');  // asked for, so it wins the next tie
          } else {
            this.showPane?.('content');   // it was put away - bring it back
          }
          return;
        }

        // The type already showing: beside a rail it takes the screen, on its
        // own it stays as it is.
        this.showPane?.('content');
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
      // Never fall back to 'daily': it is a RAIL, it has no pane, and
      // showTab() on it leaves the type pane empty - which looks exactly
      // like the app failing to load. Falling back to the tab this page
      // opened on keeps something real on screen.
      const tab = e.state?.tab || window.APP_CONFIG?.activeTab || this.currentTab;
      if (tab && document.querySelector(`button[data-tab="${CSS.escape(tab)}"]`)) {
        this.showTab(tab);
      }
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
