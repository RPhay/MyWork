import * as db from '../database/connectionPool.js';
import { NotFoundError, ValidationError } from '../config/errors.js';
import { buildPathMap } from '../utils/hierarchyPath.js';
import * as recurrenceService from './recurrenceService.js';
import * as entityService from './entityService.js';
import * as entityTypeService from './entityTypeService.js';
// Called at three existing sites in this file and never imported, so any path
// reaching them without a contextId threw ReferenceError rather than falling
// back to the active context. entityService imports it the same way.
import { getActiveContextId } from './activeContextService.js';

// No time box is represented as NULL; anything else must be a positive whole number of minutes.
export function normalizeTimeBox(value) {
  if (value === undefined || value === null || value === '') return null;
  const minutes = Number(value);
  if (!Number.isInteger(minutes) || minutes <= 0) {
    throw new ValidationError('Time box must be a positive whole number of minutes, or left blank for no time box');
  }
  return minutes;
}

// A day (a "work item") is an `entities` row of type work_item as of Phase 10
// (scripts/phase10-migrate-work-items.js) - date/description/notes/emoji/
// status/time_box_minutes/start_time/worked_with_claude/recurring_from_*
// live in entity_field_values, not as columns on a work_items row. Every
// function below still takes and returns the exact flat shape it always has,
// so routes/api/dailies.js and every dailies-*.js file need no changes at all.

let workItemTypeIdCache = null;
async function getWorkItemTypeId() {
  if (workItemTypeIdCache) return workItemTypeIdCache;
  const type = await entityTypeService.getEntityType('daily');
  workItemTypeIdCache = type.id;
  return workItemTypeIdCache;
}

// entity + its {field: value} map -> the flat object every caller expects.
function toLegacyShape(entity, fields) {
  return {
    id: entity.id,
    date: fields.date ?? null,
    title: entity.title,
    description: fields.description ?? null,
    notes: fields.notes ?? null,
    emoji: fields.emoji ?? null,
    status: fields.status ?? 'Not Started',
    time_box_minutes: fields.time_box_minutes ?? null,
    order_index: entity.order_index,
    worked_with_claude: !!fields.worked_with_claude,
    start_time: fields.start_time ?? null,
    context_id: entity.context_id,
    recurring_from_todo_id: fields.recurring_from_todo_id ?? null,
    recurring_from_task_id: fields.recurring_from_task_id ?? null,
    created_at: entity.created_at,
    updated_at: entity.updated_at,
  };
}

async function attachFlattened(rows) {
  const fieldMap = await entityService.attachFieldValues(rows.map(r => r.id));
  return rows.map(e => toLegacyShape(e, fieldMap.get(e.id) || {}));
}

// The date field lives in entity_field_values, so "work items on this date"
// is a join, not a WHERE on work_items.date. Filtered at the SQL level
// (rather than fetched-then-JS-filtered) because mysql2 returns a DATE column
// as a Date object, not a string - comparing that to a 'YYYY-MM-DD' string in
// JS would never match.
async function getWorkItemEntitiesByDate(date, contextId) {
  const typeId = await getWorkItemTypeId();
  const rows = await db.query(
    `SELECT e.* FROM entities e
     JOIN entity_field_values v ON v.entity_id = e.id AND v.field_key = 'date'
     WHERE e.entity_type_id = ? AND e.context_id = ? AND e.deleted_at IS NULL AND v.value_date = ?
     ORDER BY e.order_index ASC, e.created_at ASC`,
    [typeId, contextId, date]
  );
  return attachFlattened(rows);
}

async function getWorkItemEntitiesByDateRange(startDate, endDate, contextId) {
  const typeId = await getWorkItemTypeId();
  const rows = await db.query(
    `SELECT e.* FROM entities e
     JOIN entity_field_values v ON v.entity_id = e.id AND v.field_key = 'date'
     WHERE e.entity_type_id = ? AND e.context_id = ? AND e.deleted_at IS NULL
       AND v.value_date >= ? AND v.value_date <= ?
     ORDER BY v.value_date ASC, e.order_index ASC, e.created_at ASC`,
    [typeId, contextId, startDate, endDate]
  );
  return attachFlattened(rows);
}

async function nextOrderIndexForDate(date, contextId) {
  const typeId = await getWorkItemTypeId();
  const result = await db.queryOne(
    `SELECT MAX(e.order_index) as maxOrder FROM entities e
     JOIN entity_field_values v ON v.entity_id = e.id AND v.field_key = 'date'
     WHERE e.entity_type_id = ? AND e.context_id = ? AND e.deleted_at IS NULL AND v.value_date = ?`,
    [typeId, contextId, date]
  );
  return (result?.maxOrder ?? -1) + 1;
}

async function attachAssociations(items) {
  if (items.length === 0) return items;

  const ids = items.map(i => i.id);

  // The seven per-type junctions are gone: every link a day holds lives in
  // work_entity_associations now, so these lists are DERIVED from that one
  // place rather than read from seven tables that no longer receive writes.
  // The shape is otherwise unchanged; the Categories list is `categories` now,
  // renamed from `areas` along with the type's slug.
  const [allPriorities, allCategories] = await Promise.all([
    // Projects and Areas are entities, and their hierarchy lives in
    // entity_relationships rather than a parent_id column - the lookup reshapes
    // it so buildPathMap below still works unchanged.
    entityService.getEntityPathLookup('priority'),
    entityService.getEntityPathLookup('category'),
  ]);

  // Any type at all, including ones created by the user, plus whatever is
  // nested inside them.
  const genericChildren = await getEntityAssociations(ids);

  const priorityPaths = buildPathMap(allPriorities, 'title');
  const categoryPaths = buildPathMap(allCategories);

  // Which associated records are copies rather than references. A copy was
  // cloned from something (an instantiated_from edge); a reference points at
  // the original, so editing it edits the original. Dailies badges the two
  // differently, since that difference is invisible otherwise.
  const associatedEntityIds = [...genericChildren.values()].flat().map(r => r.id);
  const copies = await entityService.findClonedEntityIds(associatedEntityIds).catch(() => new Set());

  // One list per type, cut from the generic children. Only the DIRECT children
  // (depth 0) appear in these: they describe what was put on the day, and the
  // tree beneath them is `entities`.
  const ofType = (item, slug) => (genericChildren.get(item.id) || [])
    .filter(c => c.type_slug === slug && c.depth === 0);

  return items.map(item => ({
    ...item,
    priorities: ofType(item, 'priority')
      .map(r => ({ id: r.id, title: r.title, path: priorityPaths.get(r.id) || r.title, isCopy: copies.has(r.id) })),
    goals: ofType(item, 'goal')
      .map(r => ({ id: r.id, name: r.title, isCopy: copies.has(r.id) })),
    categories: ofType(item, 'category')
      .map(r => ({ id: r.id, name: r.title, path: categoryPaths.get(r.id) || r.title, isCopy: copies.has(r.id) })),
    templates: ofType(item, 'template').map(r => ({ id: r.id, title: r.title })),
    todos: ofType(item, 'to_do').map(r => ({ id: r.id, title: r.title })),
    tasks: ofType(item, 'task').map(r => ({ id: r.id, title: r.title })),
    tickets: ofType(item, 'ticket').map(r => ({ id: r.id, title: r.title })),
    ideas: ofType(item, 'idea').map(r => ({ id: r.id, title: r.title, isCopy: copies.has(r.id) })),
    // Every child, at any depth, whatever its type - the list the eight above
    // are cut from.
    entities: (genericChildren.get(item.id) || []).map(r => ({
      id: r.id,
      title: r.title,
      typeSlug: r.type_slug,
      typeLabel: r.label_singular,
      icon: r.icon,
      isFolder: !!r.is_folder,
      depth: r.depth,
      isCopy: copies.has(r.id),
    })),
  }));
}

export async function getWorkItemsByDate(date, contextId) {
  // Generate any recurring items due on this date
  await recurrenceService.generateWorkItemsForDate(date, contextId);

  const items = await getWorkItemEntitiesByDate(date, contextId);
  return attachAssociations(items);
}

export async function getWorkItemsByDateRange(startDate, endDate, contextId) {
  const items = await getWorkItemEntitiesByDateRange(startDate, endDate, contextId);
  return attachAssociations(items);
}

export async function reorderWorkItems(date, orderedIds, contextId) {
  await entityService.reorderEntitiesBySiblings(orderedIds, contextId);
  return getWorkItemsByDate(date, contextId);
}

export async function getWorkItemById(id) {
  let entity;
  try {
    entity = await entityService.getEntityById(id);
  } catch {
    throw new NotFoundError('Work item not found');
  }
  const flat = toLegacyShape(entity, entity.fields || {});
  const [withAssociations] = await attachAssociations([flat]);
  return withAssociations;
}

export async function createWorkItem(data, contextId) {
  const { date, title, description, notes, emoji, status, goal_ids, priority_ids, source_id, time_box_minutes, start_time } = data;

  if (!date || !title) {
    throw new ValidationError('Date and title are required');
  }

  const nextOrder = await nextOrderIndexForDate(date, contextId);

  const created = await entityService.createEntity('daily', {
    title,
    order_index: nextOrder,
    fields: {
      date,
      description: description ?? null,
      notes: notes ?? null,
      emoji: emoji ?? null,
      status: status || 'Not Started',
      time_box_minutes: normalizeTimeBox(time_box_minutes),
      start_time: start_time || null,
    },
  }, contextId);
  const dailyId = created.id;

  // Goals and projects passed at creation are just children, like anything
  // else on a day - one junction, so a caller can pass any type's ids.
  for (const entityId of [...(goal_ids || []), ...(priority_ids || [])]) {
    await db.query(
      'INSERT IGNORE INTO work_entity_associations (daily_id, entity_id) VALUES (?, ?)',
      [dailyId, entityId]
    );
  }

  // Add source association
  if (source_id) {
    await db.insert(
      'INSERT INTO work_source_associations (daily_id, source_id) VALUES (?, ?)',
      [dailyId, source_id]
    );
  }

  return getWorkItemById(dailyId);
}

export async function updateWorkItem(id, data) {
  const { goal_ids, priority_ids, source_id, title, description, notes, emoji, status, time_box_minutes, start_time } = data;

  const update = {};
  if (title !== undefined) update.title = title;

  const fields = {};
  if (description !== undefined) fields.description = description ?? null;
  if (notes !== undefined) fields.notes = notes ?? null;
  if (emoji !== undefined) fields.emoji = emoji || null;
  if (status !== undefined) fields.status = status;
  if (time_box_minutes !== undefined) fields.time_box_minutes = normalizeTimeBox(time_box_minutes);
  if (start_time !== undefined) fields.start_time = start_time || null;
  if (Object.keys(fields).length > 0) update.fields = fields;

  if (Object.keys(update).length > 0) {
    await entityService.updateEntity(id, update);
  }

  // Goals and projects are children like any other, through the one junction.
  // Passing either list REPLACES that type's children, which is what the
  // per-type delete-then-insert did before.
  for (const [slug, ids] of [['goal', goal_ids], ['priority', priority_ids]]) {
    if (ids === undefined || !Array.isArray(ids)) continue;
    await db.query(
      `DELETE wea FROM work_entity_associations wea
       JOIN entities e ON e.id = wea.entity_id
       JOIN entity_types t ON t.id = e.entity_type_id
       WHERE wea.daily_id = ? AND t.slug = ?`,
      [id, slug]
    );
    for (const entityId of ids) {
      await db.query(
        'INSERT IGNORE INTO work_entity_associations (daily_id, entity_id) VALUES (?, ?)',
        [id, entityId]
      );
    }
  }

  if (source_id !== undefined) {
    await db.query('DELETE FROM work_source_associations WHERE daily_id = ?', [id]);
    if (source_id) {
      await db.insert(
        'INSERT INTO work_source_associations (daily_id, source_id) VALUES (?, ?)',
        [id, source_id]
      );
    }
  }

  return getWorkItemById(id);
}

// Soft delete (entityService.deleteEntity) rather than the old hard DELETE -
// a removed day now goes to Recently Deleted like every other type, instead
// of vanishing outright. A missing id returns false rather than throwing,
// matching the original DELETE-affected-zero-rows behaviour.
export async function deleteWorkItem(id) {
  try {
    await entityService.deleteEntity(id);
    return true;
  } catch {
    return false;
  }
}

const VALID_STATUSES = ['Not Started', 'In Progress', 'Complete'];

export async function updateWorkItemStatus(id, status) {
  if (!VALID_STATUSES.includes(status)) {
    throw new ValidationError('Invalid status value');
  }

  const workItem = await getWorkItemById(id);

  await entityService.updateEntity(id, { fields: { status } });

  // If marking a recurring item as complete, generate the next occurrence
  if (status === 'Complete' && (workItem.recurring_from_todo_id || workItem.recurring_from_task_id)) {
    await recurrenceService.generateNextRecurrenceForCompletedItem(workItem);
  }

  return getWorkItemById(id);
}

export async function updateWorkItemNotes(id, notes) {
  await entityService.updateEntity(id, { fields: { notes: notes ?? null } });
  return getWorkItemById(id);
}

export async function updateWorkItemEmoji(id, emoji) {
  await entityService.updateEntity(id, { fields: { emoji: emoji || null } });
  return getWorkItemById(id);
}

export async function updateWorkItemTimeBox(id, timeBoxMinutes) {
  await entityService.updateEntity(id, { fields: { time_box_minutes: normalizeTimeBox(timeBoxMinutes) } });
  return getWorkItemById(id);
}

export async function toggleWorkItemClaude(id) {
  const item = await getWorkItemById(id);
  const newValue = !item.worked_with_claude;
  await entityService.updateEntity(id, { fields: { worked_with_claude: newValue } });
  return getWorkItemById(id);
}

export async function moveWorkItem(id, date) {
  if (!date) {
    throw new ValidationError('Date is required');
  }

  const existing = await getWorkItemById(id);
  const nextOrder = await nextOrderIndexForDate(date, existing.context_id);
  await entityService.updateEntity(id, { order_index: nextOrder, fields: { date } });
  return getWorkItemById(id);
}

export async function cloneWorkItem(id, date) {
  if (!date) {
    throw new ValidationError('Date is required');
  }

  const original = await getWorkItemById(id);
  const nextOrder = await nextOrderIndexForDate(date, original.context_id);

  // Not entityService.cloneEntity: that deep-clones the whole hierarchy
  // subtree via entity_relationships, which is not what cloning a day does -
  // a day's children are shallow-copied references (work_entity_associations
  // rows), not new entities of their own.
  const created = await entityService.createEntity('daily', {
    title: original.title,
    order_index: nextOrder,
    fields: {
      date,
      description: original.description,
      notes: original.notes,
      emoji: original.emoji,
      status: 'Not Started',
      time_box_minutes: original.time_box_minutes,
    },
  }, original.context_id);

  // One junction, so cloning copies every child whatever its type - including
  // types that did not exist when this was written. Eight loops over eight
  // tables could only ever copy the eight it knew about.
  const children = await db.query(
    'SELECT entity_id, order_index FROM work_entity_associations WHERE daily_id = ? ORDER BY order_index, id',
    [id]
  );
  for (const c of children) {
    await db.query(
      'INSERT IGNORE INTO work_entity_associations (daily_id, entity_id, order_index) VALUES (?, ?, ?)',
      [created.id, c.entity_id, c.order_index ?? 0]
    );
  }

  return getWorkItemById(created.id);
}

/**
 * Put ANY entity on a work item, whatever its type - including a type invented
 * after this was written.
 *
 * The seven association tables above each hard-code one type, which is why a
 * user-created type could not be put on a day at all: no table existed for it,
 * and none could be added from the app. This one junction covers every type.
 *
 * INSERT IGNORE is rewritten for MSSQL in mssqlTranslation.js.
 */
export async function addEntityAssociation(dailyId, entityId) {
  await db.query(
    'INSERT IGNORE INTO work_entity_associations (daily_id, entity_id) VALUES (?, ?)',
    [dailyId, entityId]
  );
  return getWorkItemById(dailyId);
}

/**
 * Left-to-right, top-to-bottom order of one work item's children. Slots are
 * renumbered from 0 in the order given, so the caller sends what it wants to
 * see rather than computing indexes.
 */
export async function reorderEntityAssociations(dailyId, orderedIds) {
  const ids = (orderedIds || []).map(Number).filter(Number.isFinite);
  for (const [i, entityId] of ids.entries()) {
    await db.query(
      'UPDATE work_entity_associations SET order_index = ? WHERE daily_id = ? AND entity_id = ?',
      [i, dailyId, entityId]
    );
  }
  return getWorkItemById(dailyId);
}

export async function removeEntityAssociation(dailyId, entityId) {
  await db.deleteRecord(
    'DELETE FROM work_entity_associations WHERE daily_id = ? AND entity_id = ?',
    [dailyId, entityId]
  );
}

/**
 * The generic children of these work items, with their own type's slug, label
 * and icon - so Dailies can render a row of a type it knows nothing about.
 *
 * Descendants come too, at their real depth: a row dropped onto a day used to
 * arrive stripped of everything inside it. The walk stops at rows already seen,
 * so a cycle cannot spin.
 */
export async function getEntityAssociations(dailyIds) {
  if (dailyIds.length === 0) return new Map();
  const placeholders = dailyIds.map(() => '?').join(',');

  const direct = await db.query(
    `SELECT wea.daily_id, e.id, e.title, e.is_folder, t.slug AS type_slug,
            t.label_singular, t.icon
     FROM work_entity_associations wea
     JOIN entities e ON e.id = wea.entity_id
     JOIN entity_types t ON t.id = e.entity_type_id
     WHERE wea.daily_id IN (${placeholders}) AND e.deleted_at IS NULL
     ORDER BY wea.order_index, wea.id`,
    dailyIds
  );

  const byWorkItem = new Map();
  for (const row of direct) {
    if (!byWorkItem.has(row.daily_id)) byWorkItem.set(row.daily_id, []);
    byWorkItem.get(row.daily_id).push({ ...row, depth: 0 });
  }

  return expandNested(byWorkItem);
}

// Everything nested inside a set of root entities, level by level, appended to
// that root's own list carrying the depth it was found at.
//
// Shared by a day's WORK ITEMS and by the records put straight on the day, so
// the two cannot come to disagree about what "and its contents" means - which
// they would, being the same walk written twice.
async function expandNested(byKey) {
  for (const [key, roots] of byKey) {
    const seen = new Set(roots.map(r => r.id));
    let frontier = roots.map(r => r.id);
    let depth = 1;

    while (frontier.length > 0) {
      const ph = frontier.map(() => '?').join(',');
      const kids = await db.query(
        `SELECT er.parent_entity_id, e.id, e.title, e.is_folder, t.slug AS type_slug,
                t.label_singular, t.icon
         FROM entity_relationships er
         JOIN entities e ON e.id = er.child_entity_id
         JOIN entity_types t ON t.id = e.entity_type_id
         WHERE er.relationship_kind = 'hierarchy'
           AND er.parent_entity_id IN (${ph})
           AND e.deleted_at IS NULL
         ORDER BY er.order_index, er.id`,
        frontier
      );

      const next = [];
      for (const kid of kids) {
        if (seen.has(kid.id)) continue;
        seen.add(kid.id);
        byKey.get(key).push({ ...kid, depth });
        next.push(kid.id);
      }
      frontier = next;
      depth += 1;
    }
  }

  return byKey;
}

// The records put on a day WITHOUT a work item wrapped round them, each with
// whatever is nested inside it - the same shape a work item's `entities` list
// has, so the list renderer draws both the same way.
export async function getDailyRootEntities(date, contextId) {
  if (!contextId) contextId = await getActiveContextId();

  const roots = await db.query(
    `SELECT de.id AS daily_id, de.order_index, e.id, e.title, e.is_folder,
            t.slug AS type_slug, t.label_singular, t.icon
     FROM daily_entities de
     JOIN entities e ON e.id = de.entity_id
     JOIN entity_types t ON t.id = e.entity_type_id
     WHERE de.date = ? AND de.context_id = ? AND e.deleted_at IS NULL
     ORDER BY de.order_index, de.id`,
    [date, contextId]
  );
  if (roots.length === 0) return [];

  // One bucket, because these all share a parent: the day itself.
  const byKey = new Map([['day', roots.map(r => ({ ...r, depth: 0 }))]]);
  await expandNested(byKey);
  const all = byKey.get('day');

  const copies = await entityService
    .findClonedEntityIds(all.map(r => r.id), contextId)
    .catch(() => new Set());

  return all.map(r => ({
    id: r.id,
    title: r.title,
    typeSlug: r.type_slug,
    typeLabel: r.label_singular,
    icon: r.icon,
    isFolder: !!r.is_folder,
    depth: r.depth,
    isCopy: copies.has(r.id),
  }));
}

// Put a record straight onto a day. Idempotent: dropping the same record on the
// same day twice leaves one row, it does not stack up.
export async function addEntityToDate(entityId, date, contextId) {
  if (!contextId) contextId = await getActiveContextId();
  const max = await db.queryOne(
    'SELECT MAX(order_index) as maxOrder FROM daily_entities WHERE date = ? AND context_id = ?',
    [date, contextId]
  );
  await db.query(
    'INSERT IGNORE INTO daily_entities (context_id, date, entity_id, order_index) VALUES (?, ?, ?, ?)',
    [contextId, date, entityId, (max?.maxOrder ?? -1) + 1]
  );
  return { entityId, date };
}

// Take it off the day. The RECORD is untouched - this is the same promise the
// unlink control on a day's child makes.
export async function removeEntityFromDate(entityId, date, contextId) {
  if (!contextId) contextId = await getActiveContextId();
  await db.query(
    'DELETE FROM daily_entities WHERE entity_id = ? AND date = ? AND context_id = ?',
    [entityId, date, contextId]
  );
  return { entityId, date };
}

export async function addPriorityAssociation(dailyId, priorityId) {
  return addEntityAssociation(dailyId, priorityId);
}

export async function removePriorityAssociation(dailyId, priorityId) {
  return removeEntityAssociation(dailyId, priorityId);
}

export async function addGoalAssociation(dailyId, goalId) {
  return addEntityAssociation(dailyId, goalId);
}

export async function removeGoalAssociation(dailyId, goalId) {
  return removeEntityAssociation(dailyId, goalId);
}

export async function addCategoryAssociation(dailyId, categoryId) {
  return addEntityAssociation(dailyId, categoryId);
}

export async function removeCategoryAssociation(dailyId, categoryId) {
  return removeEntityAssociation(dailyId, categoryId);
}

export async function addTemplateAssociation(dailyId, templateId) {
  return addEntityAssociation(dailyId, templateId);
}

export async function removeTemplateAssociation(dailyId, templateId) {
  return removeEntityAssociation(dailyId, templateId);
}

export async function addTodoAssociation(dailyId, todoId) {
  return addEntityAssociation(dailyId, todoId);
}

export async function removeTodoAssociation(dailyId, todoId) {
  return removeEntityAssociation(dailyId, todoId);
}

export async function addTaskAssociation(dailyId, taskId) {
  return addEntityAssociation(dailyId, taskId);
}

export async function removeTaskAssociation(dailyId, taskId) {
  return removeEntityAssociation(dailyId, taskId);
}

export async function addTicketAssociation(dailyId, ticketId) {
  return addEntityAssociation(dailyId, ticketId);
}

export async function removeTicketAssociation(dailyId, ticketId) {
  return removeEntityAssociation(dailyId, ticketId);
}

export async function addIdeaAssociation(dailyId, ideaId) {
  return addEntityAssociation(dailyId, ideaId);
}

export async function removeIdeaAssociation(dailyId, ideaId) {
  return removeEntityAssociation(dailyId, ideaId);
}
