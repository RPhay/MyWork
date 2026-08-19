import * as workItemService from './workItemService.js';
import * as toDoService from './toDoService.js';
import * as entityService from './entityService.js';
import * as entityRelationshipService from './entityRelationshipService.js';
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
  // Goals are entities now. The report renders `name`/`due_date`/`status`/
  // `categories`, so flatten the entity into that shape rather than changing
  // the frontend. `year`, `due_date` and `categories` were columns on the old
  // `goals` table that the goal entity type doesn't define - they only appear
  // if a user adds fields with those keys, so each is filtered/emitted
  // defensively instead of being assumed present.
  const entities = await entityService.getAllEntities('goal', contextId);

  let goals = entities.map(g => ({
    id: g.id,
    name: g.title,
    status: g.fields?.status || '',
    due_date: g.fields?.due_date || null,
    year: g.fields?.year ?? null,
    categories: [],
  }));

  if (goals.some(g => g.year !== null)) {
    goals = goals.filter(g => Number(g.year) === Number(year));
  }
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

  // Ideas are entities now, and an "idea folder" is an idea entity with
  // is_folder = 1 rather than a row in a separate idea_folders table. An
  // idea's folder is therefore its hierarchy parent, which lives in
  // entity_relationships, not a folder_id column.
  const [toDos, ideas, ideaHierarchy] = await Promise.all([
    toDoService.getAllToDos(contextId),
    entityService.getAllEntities('idea', contextId),
    entityRelationshipService.getRelationshipsForType('idea', contextId, 'hierarchy'),
  ]);

  const ideaById = new Map(ideas.map(i => [i.id, i]));
  const ideaParentId = new Map(ideaHierarchy.map(r => [r.child_entity_id, r.parent_entity_id]));
  const toDoById = new Map(toDos.map(t => [t.id, t]));

  // For todos with a parent, get the parent's title to display as a "folder"
  function getToDoParentName(todo) {
    if (!todo.parent_id) return null;
    const parent = toDoById.get(todo.parent_id);
    return parent ? parent.title : null;
  }

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
      folder: getToDoParentName(t),
      createdAt: t.created_at,
      doneCount: (t.items || []).filter(i => i.is_done).length,
      totalCount: (t.items || []).length,
    }));

  const ideaRows = ideas
    // Folders organize the report's rows; they aren't rows themselves.
    .filter(i => !i.is_folder && inRange(i.created_at))
    .map(i => {
      const parent = ideaById.get(ideaParentId.get(i.id));
      return {
        type: 'Idea',
        id: i.id,
        title: i.title,
        folder: parent ? parent.title : null,
        createdAt: i.created_at,
        // Idea checklists ("items") were a column-level feature of the old
        // ideas table and have no equivalent on the entity yet.
        doneCount: 0,
        totalCount: 0,
      };
    });

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
