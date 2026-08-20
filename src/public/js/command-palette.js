// Search, and a keyboard path to the things that were drag-only.
//
// Two gaps closed by one surface. There was no search of any kind - ten types
// and hundreds of records reachable only by remembering which tab they were on
// and scrolling. And every way of placing a record (onto the board, onto the
// focus bar, into today) was drag-exclusive: slow with a mouse, impossible
// without one, and testable only by simulating a physical drag.
//
// Opens with Cmd/Ctrl-K. Type to search everything; type > for commands.

(function () {
  const DEBOUNCE_MS = 140;

  let overlay = null;
  let input = null;
  let listEl = null;
  let rows = [];
  let active = 0;
  let debounce = null;
  let lastQuery = '';

  const isMac = navigator.platform.toUpperCase().includes('MAC');

  function tabsAvailable() {
    return [...document.querySelectorAll('[data-tab]')].map(btn => ({
      slug: btn.dataset.tab,
      label: (btn.textContent || '').trim(),
    })).filter(t => t.slug && t.label);
  }

  // Commands are generated from what the page actually offers, so a type
  // invented next week gets its "Open" and "New" entries with no code change.
  function commandsFor(term) {
    const commands = [];
    for (const tab of tabsAvailable()) {
      commands.push({
        kind: 'command',
        title: `Open ${tab.label}`,
        hint: 'Tab',
        run: () => { window.location.search = `?tab=${encodeURIComponent(tab.slug)}`; },
      });
    }
    if (window.RecentlyDeleted) {
      commands.push({
        kind: 'command',
        title: 'Recently deleted',
        hint: 'Restore',
        run: () => window.RecentlyDeleted.open(),
      });
    }
    commands.push({
      kind: 'command',
      title: 'Open Settings',
      hint: 'Page',
      run: () => { window.location.href = '/settings'; },
    });

    const needle = term.replace(/^>\s*/, '').toLowerCase();
    return needle
      ? commands.filter(c => c.title.toLowerCase().includes(needle))
      : commands;
  }

  function actionsFor(result) {
    const actions = [];
    // The keyboard equivalents of the drags. Each is the same call the drop
    // handler makes, so there is one behaviour with two ways in.
    if (!result.isFolder && window.FocusBar) {
      actions.push({
        label: 'Pin to focus bar',
        icon: '📌',
        run: async () => {
          await window.FocusBar.add(result.id);
          app.notify('Pinned to the focus bar', 'success');
        },
      });
    }
    if (!result.isFolder) {
      actions.push({
        label: 'Add to priorities',
        icon: '📋',
        run: async () => {
          await app.fetch('/api/priority-board/items', {
            method: 'POST',
            body: JSON.stringify({ entityId: result.id, bay: 'Not Started' }),
          });
          app.notify('Added to priorities', 'success');
        },
      });
    }
    return actions;
  }

  function open() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.className = 'cmdk-overlay';
    overlay.innerHTML = `
      <div class="cmdk" role="dialog" aria-modal="true" aria-label="Search and commands">
        <input class="cmdk-input" type="text" autocomplete="off" spellcheck="false"
               placeholder="Search everything, or type >  for commands" aria-label="Search">
        <div class="cmdk-list" role="listbox"></div>
        <div class="cmdk-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>⇥</kbd> actions</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    input = overlay.querySelector('.cmdk-input');
    listEl = overlay.querySelector('.cmdk-list');

    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) close();
    });
    input.addEventListener('input', onType);
    input.addEventListener('keydown', onKey);
    listEl.addEventListener('click', (e) => {
      const row = e.target.closest('.cmdk-row');
      if (!row) return;
      active = Number(row.dataset.index);
      choose();
    });

    input.focus();
    render([{ kind: 'hint', title: 'Type at least two characters to search' }]);
  }

  function close() {
    overlay?.remove();
    overlay = null;
    rows = [];
    active = 0;
    lastQuery = '';
  }

  function onType() {
    const term = input.value.trim();
    clearTimeout(debounce);

    if (term.startsWith('>')) {
      rows = commandsFor(term);
      active = 0;
      render(rows.length ? rows : [{ kind: 'hint', title: 'No matching command' }]);
      return;
    }

    if (term.length < 2) {
      rows = [];
      render([{ kind: 'hint', title: 'Type at least two characters to search' }]);
      return;
    }

    // One request per pause, not per keystroke, and a stale response never
    // overwrites a newer one.
    debounce = setTimeout(async () => {
      lastQuery = term;
      try {
        const data = await app.fetchData(`/api/search?q=${encodeURIComponent(term)}`);
        if (lastQuery !== term || !overlay) return;
        rows = (data || []).map(r => ({ kind: 'result', ...r }));
        active = 0;
        render(rows.length ? rows : [{ kind: 'hint', title: `Nothing matches “${term}”` }]);
      } catch (error) {
        console.error('Search failed:', error);
      }
    }, DEBOUNCE_MS);
  }

  function render(items) {
    listEl.innerHTML = items.map((item, i) => {
      if (item.kind === 'hint') {
        return `<div class="cmdk-hint">${app.escapeHtml(item.title)}</div>`;
      }
      if (item.kind === 'command') {
        return `
          <div class="cmdk-row ${i === active ? 'active' : ''}" data-index="${i}" role="option">
            <span class="cmdk-icon">⌘</span>
            <span class="cmdk-main"><span class="cmdk-title">${app.escapeHtml(item.title)}</span></span>
            <span class="cmdk-type">${app.escapeHtml(item.hint || '')}</span>
          </div>`;
      }
      const why = item.matchedIn && item.matchedIn !== 'title'
        ? `<span class="cmdk-why">${app.escapeHtml(item.matchedIn)}: ${app.escapeHtml(item.context || '')}</span>`
        : '';
      return `
        <div class="cmdk-row ${i === active ? 'active' : ''}" data-index="${i}" role="option">
          <span class="cmdk-icon">${item.isFolder ? '📁' : (item.icon || '')}</span>
          <span class="cmdk-main">
            <span class="cmdk-title">${app.escapeHtml(item.title)}</span>
            ${why}
          </span>
          <span class="cmdk-type">${app.escapeHtml(item.typeLabel || '')}</span>
        </div>`;
    }).join('');

    listEl.querySelector('.cmdk-row.active')?.scrollIntoView({ block: 'nearest' });
  }

  function move(delta) {
    if (rows.length === 0) return;
    active = (active + delta + rows.length) % rows.length;
    render(rows);
  }

  function choose() {
    const item = rows[active];
    if (!item) return;
    if (item.kind === 'command') {
      close();
      item.run();
      return;
    }
    // Open the record where it lives: its own tab, with the row selected.
    close();
    window.location.search = `?tab=${encodeURIComponent(item.typeSlug)}&focus=${item.id}`;
  }

  function showActions() {
    const item = rows[active];
    if (!item || item.kind !== 'result') return;
    const actions = actionsFor(item);
    if (actions.length === 0) return;

    rows = actions.map(a => ({
      kind: 'command',
      title: `${a.label} — ${item.title}`,
      hint: 'Action',
      run: async () => {
        try {
          await a.run();
        } catch (error) {
          app.notify(error.message || 'That did not work', 'danger');
        }
      },
    }));
    active = 0;
    render(rows);
  }

  function onKey(e) {
    switch (e.key) {
      case 'Escape': e.preventDefault(); close(); break;
      case 'ArrowDown': e.preventDefault(); move(1); break;
      case 'ArrowUp': e.preventDefault(); move(-1); break;
      case 'Tab': e.preventDefault(); showActions(); break;
      case 'Enter': e.preventDefault(); choose(); break;
      default: break;
    }
  }

  document.addEventListener('keydown', (e) => {
    const combo = isMac ? e.metaKey : e.ctrlKey;
    if (combo && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      overlay ? close() : open();
    }
  });

  // A record opened from search should be visible when its tab loads, not
  // somewhere down a collapsed tree.
  function revealRequestedRow() {
    const wanted = new URLSearchParams(window.location.search).get('focus');
    if (!wanted) return;
    let tries = 0;
    const timer = setInterval(() => {
      const row = document.querySelector(`.entity-row[data-entity-id="${wanted}"]`);
      if (row) {
        clearInterval(timer);
        row.scrollIntoView({ block: 'center' });
        row.classList.add('search-hit');
        setTimeout(() => row.classList.remove('search-hit'), 2400);
      } else if (++tries > 40) {
        clearInterval(timer);
      }
    }, 150);
  }

  window.CommandPalette = { open, close };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', revealRequestedRow);
  } else {
    revealRequestedRow();
  }
})();
