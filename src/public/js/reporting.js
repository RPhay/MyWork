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
    const [prioRes, categoryRes] = await Promise.all([
      fetch('/api/priorities'),
      fetch('/api/categories'),
    ]);
    const prioResult = await prioRes.json();
    const categoryResult = await categoryRes.json();

    const projects = (prioResult.success && app.flattenTree(prioResult.data)) || [];
    const categories = (categoryResult.success && app.flattenTree(categoryResult.data)) || [];

    document.getElementById('rptWiProject').innerHTML = '<option value="">All</option>' +
      projects.map(p => `<option value="${p.id}">${'  '.repeat(p.depth)}${app.escapeHtml(p.title)}</option>`).join('');

    document.getElementById('rptWiCategory').innerHTML = '<option value="">All</option>' +
      categories.map(a => `<option value="${a.id}">${'  '.repeat(a.depth)}${app.escapeHtml(a.name)}</option>`).join('');
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
  const categoryId = document.getElementById('rptWiCategory').value;

  const params = new URLSearchParams({ startDate, endDate });
  if (status) params.set('status', status);
  if (priorityId) params.set('priorityId', priorityId);
  if (categoryId) params.set('categoryId', categoryId);

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
          <td>${(item.categories || []).map(a => app.escapeHtml(a.path || a.name)).join(', ') || '&mdash;'}</td>
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
  // Same as the status report below: the defaults and the listeners are wiring
  // and stay unconditional, but the two READS wait until the Reporting tab is
  // on screen. loadFilterOptions() pulls the category list and loadSummary()
  // runs the aggregate - both on every page load, for a tab most loads never
  // open. The subtab click handler and loadTabData() both reload on the way in.
  // Only the filter options. The summary itself is loadTabData()'s job - it
  // reloads the active subtab on every switch to Reporting, the first one
  // included - so loading it here too just fetched the same aggregate twice on
  // the way in. The filter dropdowns are not in that path and are needed once.
  app.whenVisible('tab-reporting', loadFilterOptions);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initReporting);
} else {
  initReporting();
}

// ===== Status Report =====
//
// One page answering what a status report is conventionally expected to answer:
// where things stand, what got done, what is next, and what needs a decision.
// The older sub-tabs report work items in a range; this one reports the whole
// portfolio, which is what most of the app now holds.

const RAG_LABEL = { green: 'On track', amber: 'Needs watching', red: 'Needs attention', grey: 'No data' };
const RAG_CLASS = { green: 'success', amber: 'warning', red: 'danger', grey: 'secondary' };

function ragBadge(rag) {
  return `<span class="badge bg-${RAG_CLASS[rag] || 'secondary'}">${RAG_LABEL[rag] || rag}</span>`;
}

function statusTile(label, value, hint) {
  return `
    <div class="col-6 col-md">
      <div class="card h-100"><div class="card-body py-2">
        <div class="text-muted small">${app.escapeHtml(label)}</div>
        <div class="fs-4">${app.escapeHtml(String(value))}</div>
        ${hint ? `<div class="text-muted" style="font-size:.75rem">${app.escapeHtml(hint)}</div>` : ''}
      </div></div>
    </div>`;
}

function emptyNote(text) {
  return `<p class="text-muted mb-0">${app.escapeHtml(text)}</p>`;
}

async function loadStatusReport() {
  const startDate = document.getElementById('rptStatusStart')?.value;
  const endDate = document.getElementById('rptStatusEnd')?.value;
  if (!startDate || !endDate) return;

  try {
    const response = await fetch(`/api/reporting/executive-summary?startDate=${startDate}&endDate=${endDate}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.message);
    const report = result.data;

    const h = report.headline;
    document.getElementById('rptStatusHeadline').innerHTML = `
      <div class="col-12 col-md-auto">
        <div class="card h-100"><div class="card-body py-2">
          <div class="text-muted small">Overall</div>
          <div class="fs-5">${ragBadge(h.rag)}</div>
        </div></div>
      </div>
      ${statusTile('Finished this period', h.completedInRange)}
      ${statusTile('Complete', `${h.done} / ${h.total}`, 'of everything tracked')}
      ${statusTile('Past their date', h.overdue)}
      ${statusTile('Time logged', `${Math.round((h.minutesLogged / 60) * 10) / 10}h`)}`;

    // Done vs outstanding per type, so one bar reads as "how much of this is finished".
    renderChart('rptPortfolioChart', {
      type: 'bar',
      data: {
        labels: report.portfolio.map(r => r.label),
        datasets: [
          { label: 'Complete', data: report.portfolio.map(r => r.done), backgroundColor: '#198754' },
          { label: 'Outstanding', data: report.portfolio.map(r => r.total - r.done), backgroundColor: '#adb5bd' },
        ],
      },
      options: {
        responsive: true,
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
        plugins: { legend: { position: 'bottom' } },
      },
    });

    document.getElementById('rptPortfolioTable').innerHTML = report.portfolio.map(r => `
      <tr>
        <td>${r.icon ? app.escapeHtml(r.icon) + ' ' : ''}${app.escapeHtml(r.label)}</td>
        <td class="text-end">${r.done}</td>
        <td class="text-end">${r.total}</td>
        <td title="${app.escapeHtml(r.why)}">${ragBadge(r.rag)}</td>
      </tr>`).join('');

    document.getElementById('rptAccomplishments').innerHTML = report.accomplishments.length
      ? `<ul class="list-unstyled mb-0">${report.accomplishments.slice(0, 12).map(a => `
          <li class="mb-1"><span class="text-muted">${app.escapeHtml(a.date)}</span> ${app.escapeHtml(a.title)}
          ${a.projects.length ? `<span class="text-muted">· ${app.escapeHtml(a.projects.join(', '))}</span>` : ''}</li>`).join('')}</ul>`
      : emptyNote('Nothing recorded as complete in this period.');

    document.getElementById('rptUpcoming').innerHTML = report.upcoming.length
      ? `<ul class="list-unstyled mb-0">${report.upcoming.slice(0, 12).map(u => `
          <li class="mb-1"><span class="text-muted">${app.escapeHtml(u.due)}</span> ${app.escapeHtml(u.title)}
          <span class="text-muted">· ${app.escapeHtml(u.type)}</span></li>`).join('')}</ul>`
      : emptyNote('Nothing dated in the next two weeks.');

    document.getElementById('rptNeedsAttention').innerHTML = report.needsAttention.length
      ? `<ul class="list-unstyled mb-0">${report.needsAttention.slice(0, 12).map(n => `
          <li class="mb-1"><span class="badge bg-${n.severity === 'overdue' ? 'danger' : 'warning'} me-1">${app.escapeHtml(n.severity)}</span>
          ${app.escapeHtml(n.title)} <span class="text-muted">· ${app.escapeHtml(n.reason)}</span></li>`).join('')}</ul>`
      : emptyNote('Nothing overdue or stalled.');
  } catch (error) {
    console.error('Error loading status report:', error);
    app.notify(`Could not build the report: ${error.message}`, 'danger');
  }
}

function statusReportRange() {
  const startDate = document.getElementById('rptStatusStart')?.value || '';
  const endDate = document.getElementById('rptStatusEnd')?.value || '';
  return `startDate=${startDate}&endDate=${endDate}`;
}

// Exports are plain downloads, so the browser is pointed straight at them
// rather than the file being assembled in JS.
function downloadReport(format) {
  window.location.href = `/api/reporting/export/${format}?${statusReportRange()}`;
}

async function openEmailDraft() {
  try {
    const response = await fetch(`/api/reporting/email-draft?${statusReportRange()}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.message);

    document.getElementById('rptEmailSubject').value = result.data.subject;
    document.getElementById('rptEmailBody').value = result.data.body;
    document.getElementById('rptEmailSendBtn').dataset.mailto = result.data.mailto;
    new bootstrap.Modal(document.getElementById('rptEmailModal')).show();
  } catch (error) {
    app.notify(`Could not draft the email: ${error.message}`, 'danger');
  }
}

function initStatusReport() {
  setDefaultDateRange('rptStatusStart', 'rptStatusEnd');
  document.getElementById('rptStatusApplyBtn')?.addEventListener('click', loadStatusReport);
  document.getElementById('rptExportXlsxBtn')?.addEventListener('click', () => downloadReport('xlsx'));
  document.getElementById('rptExportPdfBtn')?.addEventListener('click', () => downloadReport('pdf'));
  document.getElementById('rptEmailBtn')?.addEventListener('click', openEmailDraft);

  document.getElementById('rptEmailCopyBtn')?.addEventListener('click', async () => {
    const body = document.getElementById('rptEmailBody').value;
    try {
      await navigator.clipboard.writeText(body);
      app.notify('Copied', 'success');
    } catch {
      document.getElementById('rptEmailBody').select();
      app.notify('Press Ctrl/Cmd-C to copy', 'info');
    }
  });

  // Hands the draft to whatever the machine uses for mail, with the edited text.
  document.getElementById('rptEmailSendBtn')?.addEventListener('click', () => {
    const subject = document.getElementById('rptEmailSubject').value;
    const body = document.getElementById('rptEmailBody').value;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  // Reporting is the most expensive read in the app - it aggregates - and it
  // was running on every page load whatever tab you opened. loadTabData()
  // already reloads it on the switch that actually shows it, so the eager
  // pass was never even the copy you ended up reading.
  app.whenVisible('tab-reporting', loadStatusReport);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStatusReport);
} else {
  initStatusReport();
}
