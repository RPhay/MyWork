// Miscellaneous settings. Currently one subtab: the colours offered when you
// right-click an item on the focus bar.
//
// Stored in localStorage, the same place the theme editor keeps its
// preferences - it is an appearance choice, not data. The consequence worth
// knowing: it is per browser, so a second machine starts from the defaults.

(function () {
  const KEY = 'focusColourPalette';

  // Pale on purpose: the chip's text is dark, and it has to stay readable on
  // whatever is chosen here.
  const DEFAULTS = [
    { color: '#ffe0e0', label: 'Blocked' },
    { color: '#ffedd5', label: 'Waiting' },
    { color: '#fff7cc', label: 'Needs attention' },
    { color: '#dcfce7', label: 'On track' },
    { color: '#dbeafe', label: 'In review' },
    { color: '#ede9fe', label: 'Someday' },
    { color: '#e5e7eb', label: 'Parked' },
  ];

  function read() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (Array.isArray(saved) && saved.length) return saved;
    } catch { /* fall through to defaults */ }
    return DEFAULTS;
  }

  function rowHtml(entry) {
    return `
      <tr>
        <td><input type="color" class="form-control form-control-color misc-colour" value="${entry.color}"></td>
        <td><input type="text" class="form-control form-control-sm misc-label" value="${(entry.label || '').replace(/"/g, '&quot;')}" placeholder="What it means"></td>
        <td><button type="button" class="btn btn-sm btn-outline-danger misc-remove" title="Remove">&times;</button></td>
      </tr>`;
  }

  function render(entries) {
    const body = document.getElementById('focusColourRows');
    if (body) body.innerHTML = entries.map(rowHtml).join('');
  }

  function collect() {
    return [...document.querySelectorAll('#focusColourRows tr')].map(tr => ({
      color: tr.querySelector('.misc-colour').value,
      label: tr.querySelector('.misc-label').value.trim(),
    })).filter(e => e.color);
  }

  function init() {
    const pane = document.getElementById('miscSettings');
    if (!pane) return;
    render(read());

    document.getElementById('addFocusColourBtn')?.addEventListener('click', () => {
      document.getElementById('focusColourRows')
        .insertAdjacentHTML('beforeend', rowHtml({ color: '#dbeafe', label: '' }));
    });

    document.getElementById('focusColourRows')?.addEventListener('click', (e) => {
      if (e.target.closest('.misc-remove')) e.target.closest('tr').remove();
    });

    document.getElementById('saveFocusColoursBtn')?.addEventListener('click', () => {
      localStorage.setItem(KEY, JSON.stringify(collect()));
      app.notify('Focus colours saved', 'success');
    });

    document.getElementById('resetFocusColoursBtn')?.addEventListener('click', () => {
      localStorage.removeItem(KEY);
      render(DEFAULTS);
      app.notify('Focus colours reset', 'info');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
