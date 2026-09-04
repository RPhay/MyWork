import { getActiveContextId } from './activeContextService.js';
import * as entityTypeService from './entityTypeService.js';
import * as entityService from './entityService.js';
import * as dailyService from './dailyService.js';

/**
 * Reporting across every entity type, not just work items.
 *
 * The reporting that existed before this only ever read the legacy `work_items`
 * table, so it went
 * blank the moment a day had nothing on it and said nothing at all about the
 * hundreds of projects, categories, goals and ideas the app now holds.
 *
 * The shape follows what a status report to management is conventionally
 * expected to answer, which is consistent across the templates surveyed
 * (Atlassian, Teamwork, monday.com, ProjectManager):
 *
 *   - where things stand overall, at a glance (RAG);
 *   - what actually got done this period (outcomes, not activity);
 *   - what is coming next, and when;
 *   - what is stuck or slipping and needs a decision.
 *
 * Everything is derived from the generic entity engine, so a type a user invents
 * tomorrow is reported on with no code change.
 */

// A status field's own field_options say which values mean "done"; fall back to
// the conventional name so a type that never set doneValues still reports.
function doneValuesFor(field) {
  const options = typeof field?.field_options === 'string'
    ? JSON.parse(field.field_options)
    : field?.field_options;
  const done = options?.doneValues;
  return new Set((done && done.length ? done : ['Complete', 'Done', 'Ready']).map(String));
}

function statusValuesFor(field) {
  const options = typeof field?.field_options === 'string'
    ? JSON.parse(field.field_options)
    : field?.field_options;
  return options?.values || [];
}

// RAG for one bucket of things. Green when most of it is done and nothing has
// stalled, red when a lot is untouched, amber in between. Deliberately simple
// and stated in the payload, so nobody has to guess how a colour was reached.
function ragFor({ total, done, notStarted, overdue }) {
  if (total === 0) return { rag: 'grey', why: 'nothing to report' };
  const donePct = done / total;
  const notStartedPct = notStarted / total;
  if (overdue > 0) return { rag: 'red', why: `${overdue} past its date` };
  if (notStartedPct >= 0.5) return { rag: 'red', why: `${Math.round(notStartedPct * 100)}% not started` };
  if (donePct >= 0.7) return { rag: 'green', why: `${Math.round(donePct * 100)}% complete` };
  if (donePct >= 0.3) return { rag: 'amber', why: `${Math.round(donePct * 100)}% complete` };
  return { rag: 'amber', why: `${Math.round(donePct * 100)}% complete` };
}

export const isoDay = (value) => (value ? new Date(value).toISOString().slice(0, 10) : null);

/**
 * One row per editable type: how many there are, how they break down by status,
 * how many finished inside the window, and a RAG.
 */
export async function getPortfolio(contextId = null, { startDate, endDate } = {}) {
  if (!contextId) contextId = await getActiveContextId();

  const types = (await entityTypeService.getAllEntityTypes('editable'))
    .filter(t => t.slug !== 'daily' && t.slug !== 'template');

  const today = isoDay(new Date());
  const rows = [];

  for (const type of types) {
    const entities = await entityService.getAllEntities(type.slug, contextId);
    const items = entities.filter(e => !e.is_folder);       // folders organise, they are not work
    const statusField = (type.fields || []).find(f => f.field_type === 'status');
    const dateField = (type.fields || []).find(f => f.field_type === 'date');
    const done = statusField ? doneValuesFor(statusField) : new Set();

    const byStatus = {};
    for (const value of statusValuesFor(statusField)) byStatus[value] = 0;

    let doneCount = 0;
    let notStarted = 0;
    let overdue = 0;
    let completedInRange = 0;

    for (const item of items) {
      const status = statusField ? (item.fields?.[statusField.field_key] || '') : '';
      if (status) byStatus[status] = (byStatus[status] || 0) + 1;

      if (done.has(status)) {
        doneCount++;
        // Completion has no timestamp of its own, so "finished this period" is
        // approximated by when the record last changed. Stated here rather than
        // implied, because it is an approximation.
        const changed = isoDay(item.updated_at);
        if (startDate && endDate && changed >= startDate && changed <= endDate) completedInRange++;
      } else {
        if (!status || /not.?started|^raw$|^new$/i.test(status)) notStarted++;
        const due = dateField ? item.fields?.[dateField.field_key] : null;
        if (due && isoDay(due) < today) overdue++;
      }
    }

    rows.push({
      slug: type.slug,
      label: type.label,
      icon: type.icon,
      total: items.length,
      done: doneCount,
      notStarted,
      overdue,
      completedInRange,
      byStatus,
      dateFieldKey: dateField?.field_key || null,
      ...ragFor({ total: items.length, done: doneCount, notStarted, overdue }),
    });
  }

  return rows;
}

/**
 * What actually got done in the window. Work items carry a real date, so they
 * are the honest source for "this period"; typed records are included by last
 * change, which is the closest thing they have.
 */
export async function getAccomplishments(contextId = null, { startDate, endDate } = {}) {
  if (!contextId) contextId = await getActiveContextId();
  if (!startDate || !endDate) return [];

  const workItems = await dailyService.getWorkItemsByDateRange(startDate, endDate, contextId);
  const completed = workItems.filter(w => /complete|done/i.test(w.status || ''));

  return completed.map(w => ({
    date: isoDay(w.date),
    title: w.title,
    minutes: w.time_box_minutes || 0,
    projects: (w.priorities || []).map(p => p.path || p.title),
    categories: (w.categories || []).map(a => a.path || a.name),
    goals: (w.goals || []).map(g => g.name),
  }));
}

/**
 * What is coming: anything with a date field set at or after today, soonest
 * first. Answers "what happens next" without the reader opening the app.
 */
export async function getUpcoming(contextId = null, { days = 14 } = {}) {
  if (!contextId) contextId = await getActiveContextId();

  const today = isoDay(new Date());
  const horizon = isoDay(new Date(Date.now() + days * 86400000));

  const types = (await entityTypeService.getAllEntityTypes('editable'))
    .filter(t => (t.fields || []).some(f => f.field_type === 'date'));

  const upcoming = [];
  for (const type of types) {
    const dateField = (type.fields || []).find(f => f.field_type === 'date');
    const statusField = (type.fields || []).find(f => f.field_type === 'status');
    const done = statusField ? doneValuesFor(statusField) : new Set();

    for (const item of await entityService.getAllEntities(type.slug, contextId)) {
      if (item.is_folder) continue;
      const due = isoDay(item.fields?.[dateField.field_key]);
      if (!due || due < today || due > horizon) continue;
      const status = statusField ? (item.fields?.[statusField.field_key] || '') : '';
      if (done.has(status)) continue;
      upcoming.push({ type: type.label, icon: type.icon, title: item.title, due, status });
    }
  }

  return upcoming.sort((a, b) => a.due.localeCompare(b.due));
}

/**
 * What needs a decision: overdue, or untouched long enough to look stalled.
 * This is the section a manager reads first, so it names the record and says
 * why it is here rather than only flagging a colour.
 */
export async function getNeedsAttention(contextId = null, { stalledDays = 30 } = {}) {
  if (!contextId) contextId = await getActiveContextId();

  const today = isoDay(new Date());
  const stalledBefore = isoDay(new Date(Date.now() - stalledDays * 86400000));

  const types = (await entityTypeService.getAllEntityTypes('editable'))
    .filter(t => t.slug !== 'daily' && t.slug !== 'template');

  const flagged = [];
  for (const type of types) {
    const statusField = (type.fields || []).find(f => f.field_type === 'status');
    const dateField = (type.fields || []).find(f => f.field_type === 'date');
    const done = statusField ? doneValuesFor(statusField) : new Set();

    for (const item of await entityService.getAllEntities(type.slug, contextId)) {
      if (item.is_folder) continue;
      const status = statusField ? (item.fields?.[statusField.field_key] || '') : '';
      if (done.has(status)) continue;

      const due = dateField ? isoDay(item.fields?.[dateField.field_key]) : null;
      if (due && due < today) {
        flagged.push({ type: type.label, icon: type.icon, title: item.title, status, reason: `past its date (${due})`, severity: 'overdue' });
        continue;
      }
      if (isoDay(item.updated_at) < stalledBefore && /in.?progress/i.test(status)) {
        flagged.push({ type: type.label, icon: type.icon, title: item.title, status, reason: `in progress but untouched since ${isoDay(item.updated_at)}`, severity: 'stalled' });
      }
    }
  }

  const rank = { overdue: 0, stalled: 1 };
  return flagged.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** Everything a status report needs, in one call. */
export async function getExecutiveSummary(contextId = null, { startDate, endDate } = {}) {
  if (!contextId) contextId = await getActiveContextId();

  const [portfolio, accomplishments, upcoming, needsAttention] = await Promise.all([
    getPortfolio(contextId, { startDate, endDate }),
    getAccomplishments(contextId, { startDate, endDate }),
    getUpcoming(contextId, {}),
    getNeedsAttention(contextId, {}),
  ]);

  const totals = portfolio.reduce((acc, row) => ({
    total: acc.total + row.total,
    done: acc.done + row.done,
    overdue: acc.overdue + row.overdue,
    completedInRange: acc.completedInRange + row.completedInRange,
  }), { total: 0, done: 0, overdue: 0, completedInRange: 0 });

  // The headline colour is the worst of the parts: one red project makes the
  // portfolio red, which is the point of reporting it.
  const worst = portfolio.reduce((acc, row) =>
    row.rag === 'red' ? 'red' : (row.rag === 'amber' && acc !== 'red') ? 'amber' : acc,
    portfolio.length ? 'green' : 'grey');

  return {
    period: { startDate, endDate },
    generatedAt: new Date().toISOString(),
    headline: {
      rag: worst,
      ...totals,
      minutesLogged: accomplishments.reduce((sum, a) => sum + (a.minutes || 0), 0),
    },
    portfolio,
    accomplishments,
    upcoming,
    needsAttention,
  };
}
