let activeReportingSubtab = 'summary';

const STATUS_COLORS = {
  'Not Started': '#6c757d',
  'In Progress': '#ffc107',
  'Complete': '#198754',
};

function statusBadgeColor(status) {
  if (status === 'Complete') return 'success';
  if (status === 'In Progress') return 'warning';
  return 'secondary';
}

function formatMinutes(minutes) {
  if (!minutes) return '0m';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function setDefaultDateRange(startId, endId) {
  const now = new Date();
  document.getElementById(startId).value = isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  document.getElementById(endId).value = isoDate(now);
}

// Chart.js requires the previous instance on a <canvas> to be destroyed
// before creating a new one, or it throws/leaks - every re-render (filter
// change, tab re-activation) goes through here.
const chartInstances = {};
function renderChart(canvasId, config) {
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
  }
  const ctx = document.getElementById(canvasId).getContext('2d');
  chartInstances[canvasId] = new Chart(ctx, config);
}

function statusDoughnut(canvasId, statusCounts) {
  renderChart(canvasId, {
    type: 'doughnut',
    data: {
      labels: Object.keys(statusCounts),
      datasets: [{
        data: Object.values(statusCounts),
        backgroundColor: Object.keys(statusCounts).map(s => STATUS_COLORS[s] || '#0d6efd'),
      }],
    },
    options: { plugins: { legend: { position: 'bottom' } } },
  });
}

function countByStatus(rows) {
  const counts = { 'Not Started': 0, 'In Progress': 0, 'Complete': 0 };
  rows.forEach(r => { if (counts[r.status] !== undefined) counts[r.status] += 1; });
  return counts;
}

// ---- Sub-tab switching ----

function initReportingSubTabs() {
  const nav = document.getElementById('rptReportingSubTabs');

  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-subtab]');
    if (!btn) return;

    nav.querySelectorAll('button[data-subtab]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const target = btn.dataset.subtab;
    activeReportingSubtab = target;
    document.querySelectorAll('.reporting-subtab-pane').forEach(pane => {
      pane.classList.toggle('d-none', pane.dataset.subtabPane !== target);
    });

    loadActiveReportingSubtab();
  });
}

function loadActiveReportingSubtab() {
  switch (activeReportingSubtab) {
    case 'summary': loadSummary(); break;
    case 'work-items': loadWorkItemsReport(); break;
    case 'goals': loadGoalsReport(); break;
    case 'by-project': loadByProjectReport(); break;
    case 'by-category': loadByCategoryReport(); break;
    case 'todos-ideas': loadToDosIdeasReport(); break;
  }
}

// ---- Time Summary ----

function renderTopList(rows) {
  if (!rows || rows.length === 0) return '<p class="text-muted small">No data in this range</p>';
  return `<ul class="list-unstyled mb-0">${rows.map(r => `
    <li class="d-flex justify-content-between border-bottom py-1">
      <span>${app.escapeHtml(r.label)}</span>
      <span class="text-muted">${formatMinutes(r.totalMinutes)} &middot; ${r.itemCount}</span>
    </li>
  `).join('')}</ul>`;
}

async function loadSummary() {
  const startDate = document.getElementById('rptSummaryStartDate').value;
  const endDate = document.getElementById('rptSummaryEndDate').value;
  if (!startDate || !endDate) return;

  try {
    const response = await fetch(`/api/reporting/summary?startDate=${startDate}&endDate=${endDate}`);
    const result = await response.json();
    if (!result.success) {
      app.notify('Error: ' + result.message, 'danger');
      return;
    }
    const data = result.data;

    document.getElementById('rptSummaryTotalTime').textContent = formatMinutes(data.totalMinutes);
    document.getElementById('rptSummaryItemCount').textContent = data.itemCount;

    statusDoughnut('rptSummaryStatusChart', data.statusCounts);

    renderChart('rptSummaryByDayChart', {
      type: 'bar',
      data: {
        labels: data.byDay.map(d => d.date.slice(5)),
        datasets: [{ label: 'Minutes', data: data.byDay.map(d => d.minutes), backgroundColor: '#0d6efd' }],
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
    });

    document.getElementById('rptSummaryTopProjects').innerHTML = renderTopList(data.topProjects);
    document.getElementById('rptSummaryTopCategories').innerHTML = renderTopList(data.topCategories);
  } catch (error) {
    console.error('Error loading time summary:', error);
    app.notify('Error loading time summary', 'danger');
  }
}

// ---- Work Items ----

async function loadFilterOptions() {
  try {
    const [prioRes, areaRes] = await Promise.all([
      fetch('/api/priorities'),
      fetch('/api/areas'),
    ]);
    const prioResult = await prioRes.json();
    const areaResult = await areaRes.json();

    const projects = (prioResult.success && app.flattenTree(prioResult.data)) || [];
    const areas = (areaResult.success && app.flattenTree(areaResult.data)) || [];

    document.getElementById('rptWiProject').innerHTML = '<option value="">All</option>' +
      projects.map(p => `<option value="${p.id}">${'  '.repeat(p.depth)}${app.escapeHtml(p.title)}</option>`).join('');

    document.getElementById('rptWiCategory').innerHTML = '<option value="">All</option>' +
      areas.map(a => `<option value="${a.id}">${'  '.repeat(a.depth)}${app.escapeHtml(a.name)}</option>`).join('');
  } catch (error) {
    console.error('Error loading filter options:', error);
  }
}

async function loadWorkItemsReport() {
  const startDate = document.getElementById('rptWiStartDate').value;
  const endDate = document.getElementById('rptWiEndDate').value;
  if (!startDate || !endDate) return;

  const status = document.getElementById('rptWiStatus').value;
  const priorityId = document.getElementById('rptWiProject').value;
  const areaId = document.getElementById('rptWiCategory').value;

  const params = new URLSearchParams({ startDate, endDate });
  if (status) params.set('status', status);
  if (priorityId) params.set('priorityId', priorityId);
  if (areaId) params.set('areaId', areaId);

  const tbody = document.getElementById('rptWiTableBody');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Loading&hellip;</td></tr>';

  try {
    const response = await fetch(`/api/reporting/work-items?${params}`);
    const result = await response.json();
    if (!result.success) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">${app.escapeHtml(result.message)}</td></tr>`;
      return;
    }

    const items = result.data;
    tbody.innerHTML = items.length === 0
      ? '<tr><td colspan="6" class="text-center text-muted">No work items in this range</td></tr>'
      : items.map(item => `
        <tr>
          <td>${app.escapeHtml((item.date || '').slice(0, 10))}</td>
          <td>${app.escapeHtml(item.title)}</td>
          <td>${(item.priorities || []).map(p => app.escapeHtml(p.path || p.title)).join(', ') || '&mdash;'}</td>
          <td>${(item.areas || []).map(a => app.escapeHtml(a.path || a.name)).join(', ') || '&mdash;'}</td>
          <td><span class="badge bg-${statusBadgeColor(item.status)}">${app.escapeHtml(item.status)}</span></td>
          <td>${item.time_box_minutes ? formatMinutes(item.time_box_minutes) : '&mdash;'}</td>
        </tr>
      `).join('');

    statusDoughnut('rptWiStatusChart', countByStatus(items));
  } catch (error) {
    console.error('Error loading work items report:', error);
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading work items</td></tr>';
  }
}

// ---- Goals ----

function initGoalsYearSelect() {
  const select = document.getElementById('rptGoalsYear');
  const currentYear = window.APP_CONFIG?.currentYear || new Date().getFullYear();
  const years = [];
  for (let y = currentYear + 1; y >= currentYear - 5; y--) years.push(y);
  select.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
  select.value = String(currentYear);
}

async function loadGoalsReport() {
  const year = document.getElementById('rptGoalsYear').value;
  const status = document.getElementById('rptGoalsStatus').value;

  const params = new URLSearchParams({ year });
  if (status) params.set('status', status);

  const tbody = document.getElementById('rptGoalsTableBody');
  tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Loading&hellip;</td></tr>';

  try {
    const response = await fetch(`/api/reporting/goals?${params}`);
    const result = await response.json();
    if (!result.success) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">${app.escapeHtml(result.message)}</td></tr>`;
      return;
    }

    const goals = result.data;
    tbody.innerHTML = goals.length === 0
      ? '<tr><td colspan="4" class="text-center text-muted">No goals for this year</td></tr>'
      : goals.map(g => `
        <tr>
          <td>${app.escapeHtml(g.name)}</td>
          <td>${g.due_date ? app.escapeHtml(String(g.due_date).slice(0, 10)) : '&mdash;'}</td>
          <td><span class="badge bg-${statusBadgeColor(g.status)}">${app.escapeHtml(g.status)}</span></td>
          <td>${(g.categories || []).map(c => app.escapeHtml(c.name)).join(', ') || '&mdash;'}</td>
        </tr>
      `).join('');

    statusDoughnut('rptGoalsStatusChart', countByStatus(goals));
  } catch (error) {
    console.error('Error loading goals report:', error);
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Error loading goals</td></tr>';
  }
}

// ---- By Project / By Category ----

async function loadBreakdownReport(endpoint, startDate, endDate, tbodyId, chartId) {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Loading&hellip;</td></tr>';

  try {
    const response = await fetch(`${endpoint}?startDate=${startDate}&endDate=${endDate}`);
    const result = await response.json();
    if (!result.success) {
      tbody.innerHTML = `<tr><td colspan="3" class="text-center text-danger">${app.escapeHtml(result.message)}</td></tr>`;
      return;
    }

    const rows = result.data;
    tbody.innerHTML = rows.length === 0
      ? '<tr><td colspan="3" class="text-center text-muted">No work items in this range</td></tr>'
      : rows.map(r => `
        <tr>
          <td>${app.escapeHtml(r.label)}</td>
          <td>${r.itemCount}</td>
          <td>${formatMinutes(r.totalMinutes)}</td>
        </tr>
      `).join('');

    renderChart(chartId, {
      type: 'bar',
      data: {
        labels: rows.map(r => r.label),
        datasets: [{ label: 'Minutes', data: rows.map(r => r.totalMinutes), backgroundColor: '#0d6efd' }],
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true } },
      },
    });
  } catch (error) {
    console.error('Error loading breakdown report:', error);
    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-danger">Error loading data</td></tr>';
  }
}

async function loadByProjectReport() {
  const startDate = document.getElementById('rptByProjectStartDate').value;
  const endDate = document.getElementById('rptByProjectEndDate').value;
  if (!startDate || !endDate) return;
  await loadBreakdownReport('/api/reporting/by-project', startDate, endDate, 'rptByProjectTableBody', 'rptByProjectChart');
}

async function loadByCategoryReport() {
  const startDate = document.getElementById('rptByCategoryStartDate').value;
  const endDate = document.getElementById('rptByCategoryEndDate').value;
  if (!startDate || !endDate) return;
  await loadBreakdownReport('/api/reporting/by-category', startDate, endDate, 'rptByCategoryTableBody', 'rptByCategoryChart');
}

// ---- To Dos & Ideas ----

async function loadToDosIdeasReport() {
  const startDate = document.getElementById('rptTiStartDate').value;
  const endDate = document.getElementById('rptTiEndDate').value;
  if (!startDate || !endDate) return;

  const tbody = document.getElementById('rptTiTableBody');
  tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Loading&hellip;</td></tr>';

  try {
    const response = await fetch(`/api/reporting/todos-ideas?startDate=${startDate}&endDate=${endDate}`);
    const result = await response.json();
    if (!result.success) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">${app.escapeHtml(result.message)}</td></tr>`;
      return;
    }

    const rows = result.data;
    tbody.innerHTML = rows.length === 0
      ? '<tr><td colspan="5" class="text-center text-muted">Nothing created in this range</td></tr>'
      : rows.map(r => `
        <tr>
          <td><span class="badge bg-secondary">${app.escapeHtml(r.type)}</span></td>
          <td>${app.escapeHtml(r.title)}</td>
          <td>${r.folder ? app.escapeHtml(r.folder) : '&mdash;'}</td>
          <td>${r.totalCount > 0 ? `${r.doneCount}/${r.totalCount}` : '&mdash;'}</td>
          <td>${app.escapeHtml(String(r.createdAt).slice(0, 10))}</td>
        </tr>
      `).join('');
  } catch (error) {
    console.error('Error loading to-dos/ideas report:', error);
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading data</td></tr>';
  }
}

// ---- Wiring ----

function initReportingEventListeners() {
  initReportingSubTabs();

  document.getElementById('rptSummaryApplyBtn').addEventListener('click', loadSummary);
  document.getElementById('rptWiApplyBtn').addEventListener('click', loadWorkItemsReport);
  document.getElementById('rptGoalsApplyBtn').addEventListener('click', loadGoalsReport);
  document.getElementById('rptByProjectApplyBtn').addEventListener('click', loadByProjectReport);
  document.getElementById('rptByCategoryApplyBtn').addEventListener('click', loadByCategoryReport);
  document.getElementById('rptTiApplyBtn').addEventListener('click', loadToDosIdeasReport);
}

function initReportingDefaults() {
  setDefaultDateRange('rptSummaryStartDate', 'rptSummaryEndDate');
  setDefaultDateRange('rptWiStartDate', 'rptWiEndDate');
  setDefaultDateRange('rptByProjectStartDate', 'rptByProjectEndDate');
  setDefaultDateRange('rptByCategoryStartDate', 'rptByCategoryEndDate');
  setDefaultDateRange('rptTiStartDate', 'rptTiEndDate');
  initGoalsYearSelect();
}

function initReporting() {
  initReportingDefaults();
  initReportingEventListeners();
  loadFilterOptions();
  loadSummary();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initReporting);
} else {
  initReporting();
}
