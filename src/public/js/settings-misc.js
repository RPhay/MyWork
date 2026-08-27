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

  // ===== Sub-tabs =====
  function initSubTabs() {
    const tabs = document.getElementById('miscSubTabs');
    if (!tabs) return;
    tabs.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-misc-tab]');
      if (!btn) return;
      const want = btn.dataset.miscTab;
      tabs.querySelectorAll('[data-misc-tab]').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.misc-subpane').forEach(p => {
        p.hidden = p.dataset.miscPane !== want;
      });
    });
  }

  // ===== Status digest =====
  //
  // Nothing is sent from here. The digest is written on a schedule and kept;
  // "Open in mail client" hands it to whatever the person already uses, so no
  // credentials live in this app and nothing leaves the machine unless they
  // press send themselves.
  async function initDigest() {
    const pane = document.querySelector('[data-misc-pane="status-digest"]');
    if (!pane) return;

    const el = (id) => document.getElementById(id);
    const paint = (data) => {
      const s = data.schedule || {};
      el('digestEnabled').checked = !!s.enabled;
      el('digestDay').value = String(s.dayOfWeek ?? 5);
      el('digestTime').value = s.time || '16:00';
      el('digestDays').value = String(s.days ?? 7);

      const latest = data.latest;
      el('digestPreview').hidden = !latest;
      if (!latest) return;
      el('digestSubject').textContent = latest.subject || 'Status update';
      el('digestWhen').textContent = latest.generatedAt
        ? `written ${new Date(latest.generatedAt).toLocaleString()}`
        : '';
      el('digestBody').value = latest.body || '';
      el('mailDigestBtn').href =
        `mailto:?subject=${encodeURIComponent(latest.subject || '')}&body=${encodeURIComponent(latest.body || '')}`;
    };

    const load = async () => {
      const res = await app.fetchRaw('/api/status-digest', {});
      const body = await res.json();
      if (body.success) paint(body.data);
    };

    el('saveDigestBtn')?.addEventListener('click', async () => {
      await app.fetchRaw('/api/status-digest/schedule', {
        method: 'PUT',
        body: JSON.stringify({
          enabled: el('digestEnabled').checked,
          dayOfWeek: Number(el('digestDay').value),
          time: el('digestTime').value,
          days: Number(el('digestDays').value),
        }),
      });
      app.notify('Schedule saved', 'success');
    });

    el('runDigestBtn')?.addEventListener('click', async () => {
      const res = await app.fetchRaw('/api/status-digest/run', { method: 'POST' });
      const body = await res.json();
      if (!body.success) { app.notify(body.message || 'Could not write it', 'danger'); return; }
      await load();
      app.notify('Digest written', 'success');
    });

    el('copyDigestBtn')?.addEventListener('click', async () => {
      await navigator.clipboard.writeText(el('digestBody').value).catch(() => {});
      app.notify('Copied', 'info');
    });

    await load();
  }

  // ===== Focus monitors =====
  //
  // Numbering, per-monitor label/layout, and showNumbers - saved server-side
  // via /api/focus-monitors, following the status digest's pattern, since
  // these should be the same on every machine, unlike the colours above.
  // Which items sit on which monitor lives on the items themselves and is not
  // configured here - and neither is HOW MANY monitors exist: `count` in the
  // GET/PUT response is server-derived (the highest monitor number anything
  // is currently pinned to), not a setting this pane writes. The row table
  // below is read-only in how many rows it shows; only the label/layout cells
  // in it are editable.
  async function initMonitors() {
    const pane = document.querySelector('[data-misc-pane="focus-monitors"]');
    if (!pane) return;

    const el = (id) => document.getElementById(id);
    const blankMonitor = () => ({ label: '', layout: 'side-by-side' });
    let state = { count: 0, showNumbers: false, maxMonitors: 32, monitors: [] };

    function rowHtml(n, m) {
      return `
        <tr data-monitor-row="${n}">
          <td>${n}</td>
          <td><input type="text" class="form-control form-control-sm monitor-label" maxlength="40"
                     value="${(m.label || '').replace(/"/g, '&quot;')}" placeholder="e.g. Today"></td>
          <td>
            <select class="form-select form-select-sm monitor-layout">
              <option value="side-by-side" ${m.layout !== 'stacked' ? 'selected' : ''}>Side by side</option>
              <option value="stacked" ${m.layout === 'stacked' ? 'selected' : ''}>Stacked</option>
            </select>
          </td>
        </tr>`;
    }

    // Whatever is currently typed for rows 1..count, back into state.
    function collectRows() {
      document.querySelectorAll('#monitorRows tr[data-monitor-row]').forEach(tr => {
        const n = Number(tr.dataset.monitorRow);
        state.monitors[n - 1] = {
          label: tr.querySelector('.monitor-label').value,
          layout: tr.querySelector('.monitor-layout').value,
        };
      });
    }

    function renderRows() {
      el('monitorRows').innerHTML = Array.from({ length: state.count }, (_, i) =>
        rowHtml(i + 1, state.monitors[i] || blankMonitor())).join('');
      el('monitorRowsEmpty').hidden = state.count > 0;
    }

    function paint(data) {
      const max = Number(data.maxMonitors) || 32;
      state = {
        count: Math.max(0, Number(data.count) || 0),
        showNumbers: !!data.showNumbers,
        maxMonitors: max,
        monitors: Array.from({ length: max }, (_, i) => data.monitors?.[i] || blankMonitor()),
      };
      el('monitorShowNumbers').checked = state.showNumbers;
      renderRows();
    }

    const load = async () => {
      const res = await app.fetchRaw('/api/focus-monitors', {});
      const body = await res.json();
      if (body.success) paint(body.data);
    };

    el('saveMonitorsBtn')?.addEventListener('click', async () => {
      collectRows();
      state.showNumbers = el('monitorShowNumbers').checked;

      const res = await app.fetchRaw('/api/focus-monitors', { method: 'PUT', body: JSON.stringify(state) });
      const body = await res.json();
      if (!body.success) { app.notify(body.message || 'Could not save', 'danger'); return; }

      paint(body.data);
      app.notify('Focus monitors saved', 'success');
      document.dispatchEvent(new CustomEvent('focus-monitors-changed'));
    });

    await load();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init(); initSubTabs(); initDigest(); initMonitors(); });
  } else {
    init(); initSubTabs(); initDigest(); initMonitors();
  }
})();
