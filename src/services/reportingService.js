import * as workItemService from './workItemService.js';
import * as goalService from './goalService.js';
import * as toDoService from './toDoService.js';
import * as ideaService from './ideaService.js';
import * as toDoFolderService from './toDoFolderService.js';
import * as ideaFolderService from './ideaFolderService.js';
import { ValidationError } from '../config/errors.js';

// Read-only aggregation over existing entities - no new tables. Only
// work_items (date) and goals (due_date/year) have a real business date, so
// Projects/Categories are reported via linked Work Item activity in the
// selected range rather than a date field of their own (they don't have
// one), and To Dos/Ideas use created_at as the closest available date.
// Aggregation happens in JS over already-fetched rows, matching the app's
// existing convention (see dailies.js#calendarDayTotals) rather than SQL
// SUM/GROUP BY, which nothing in this codebase does today.

function requireDateRange(startDate, endDate) {
  if (!startDate || !endDate) {
    throw new ValidationError('startDate and endDate are required');
  }
}

export async function getWorkItemsReport(contextId, { startDate, endDate, status, priorityId, areaId } = {}) {
  requireDateRange(startDate, endDate);
  let items = await workItemService.getWorkItemsByDateRange(startDate, endDate, contextId);

  if (status) items = items.filter(i => i.status === status);
  if (priorityId) items = items.filter(i => i.priorities.some(p => String(p.id) === String(priorityId)));
  if (areaId) items = items.filter(i => i.areas.some(a => String(a.id) === String(areaId)));

  return items;
}

export async function getGoalsReport(contextId, { year, status } = {}) {
  if (!year) {
    throw new ValidationError('year is required');
  }
  let goals = await goalService.getGoalsByYear(Number(year), contextId);
  if (status) goals = goals.filter(g => g.status === status);
  return goals;
}

// Buckets already-fetched work items by whichever entity they're linked to
// via `field` ('priorities' or 'areas') - an item linked to more than one
// counts toward each, matching the many-to-many associations the rest of
// the app already treats this way. Items with no link land in a single
// "(Unassigned)" bucket.
function bucketByLinked(items, field) {
  const buckets = new Map();

  for (const item of items) {
    const links = item[field];
    const minutes = item.time_box_minutes || 0;

    if (!links || links.length === 0) {
      const existing = buckets.get('unassigned') || { id: null, label: '(Unassigned)', itemCount: 0, totalMinutes: 0 };
      existing.itemCount += 1;
      existing.totalMinutes += minutes;
      buckets.set('unassigned', existing);
      continue;
    }

    for (const link of links) {
      const existing = buckets.get(link.id) || {
        id: link.id,
        label: link.path || link.title || link.name,
        itemCount: 0,
        totalMinutes: 0,
      };
      existing.itemCount += 1;
      existing.totalMinutes += minutes;
      buckets.set(link.id, existing);
    }
  }

  return Array.from(buckets.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);
}

export async function getProjectBreakdown(contextId, { startDate, endDate } = {}) {
  const items = await getWorkItemsReport(contextId, { startDate, endDate });
  return bucketByLinked(items, 'priorities');
}

export async function getCategoryBreakdown(contextId, { startDate, endDate } = {}) {
  const items = await getWorkItemsReport(contextId, { startDate, endDate });
  return bucketByLinked(items, 'areas');
}

export async function getToDosIdeasReport(contextId, { startDate, endDate } = {}) {
  requireDateRange(startDate, endDate);

  const [toDos, ideas, toDoFolders, ideaFolders] = await Promise.all([
    toDoService.getAllToDos(contextId),
    ideaService.getAllIdeas(contextId),
    toDoFolderService.getAllFolders(contextId),
    ideaFolderService.getAllFolders(contextId),
  ]);

  const toDoFolderById = new Map(toDoFolders.map(f => [f.id, f.name]));
  const ideaFolderById = new Map(ideaFolders.map(f => [f.id, f.name]));

  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const inRange = (createdAt) => {
    const d = new Date(createdAt);
    return d >= start && d <= end;
  };

  const toDoRows = toDos
    .filter(t => inRange(t.created_at))
    .map(t => ({
      type: 'To Do',
      id: t.id,
      title: t.title,
      folder: t.folder_id ? (toDoFolderById.get(t.folder_id) || null) : null,
      createdAt: t.created_at,
      doneCount: (t.items || []).filter(i => i.is_done).length,
      totalCount: (t.items || []).length,
    }));

  const ideaRows = ideas
    .filter(i => inRange(i.created_at))
    .map(i => ({
      type: 'Idea',
      id: i.id,
      title: i.title,
      folder: i.folder_id ? (ideaFolderById.get(i.folder_id) || null) : null,
      createdAt: i.created_at,
      doneCount: (i.items || []).filter(x => x.is_done).length,
      totalCount: (i.items || []).length,
    }));

  return [...toDoRows, ...ideaRows].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function dayKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

export async function getTimeSummary(contextId, { startDate, endDate } = {}) {
  const items = await getWorkItemsReport(contextId, { startDate, endDate });

  const totalMinutes = items.reduce((sum, i) => sum + (i.time_box_minutes || 0), 0);

  const statusCounts = { 'Not Started': 0, 'In Progress': 0, 'Complete': 0 };
  for (const item of items) {
    if (statusCounts[item.status] !== undefined) statusCounts[item.status] += 1;
  }

  const dayTotals = new Map();
  for (const item of items) {
    const key = dayKey(item.date);
    dayTotals.set(key, (dayTotals.get(key) || 0) + (item.time_box_minutes || 0));
  }
  const byDay = Array.from(dayTotals.entries())
    .map(([date, minutes]) => ({ date, minutes }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalMinutes,
    itemCount: items.length,
    statusCounts,
    byDay,
    topProjects: bucketByLinked(items, 'priorities').slice(0, 5),
    topCategories: bucketByLinked(items, 'areas').slice(0, 5),
  };
}
