import * as db from '../database/connectionPool.js';
import { NotFoundError, ValidationError } from '../config/errors.js';
import { buildPathMap } from '../utils/hierarchyPath.js';
import * as recurrenceService from './recurrenceService.js';
import * as entityService from './entityService.js';
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

async function attachAssociations(items) {
  if (items.length === 0) return items;

  const ids = items.map(i => i.id);
  const placeholders = ids.map(() => '?').join(',');

  // The seven per-type junctions are gone: every link a day holds lives in
  // work_entity_associations now, so these lists are DERIVED from that one
  // place rather than read from seven tables that no longer receive writes.
  // The shape is unchanged, because Reporting reads `priorities` and `areas`.
  const [allPriorities, allAreas] = await Promise.all([
    // Projects and Areas are entities, and their hierarchy lives in
    // entity_relationships rather than a parent_id column - the lookup reshapes
    // it so buildPathMap below still works unchanged.
    entityService.getEntityPathLookup('priority'),
    entityService.getEntityPathLookup('area'),
  ]);

  // Any type at all, including ones created by the user, plus whatever is
  // nested inside them.
  const genericChildren = await getEntityAssociations(ids);

  const priorityPaths = buildPathMap(allPriorities, 'title');
  const areaPaths = buildPathMap(allAreas);

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
    areas: ofType(item, 'area')
      .map(r => ({ id: r.id, name: r.title, path: areaPaths.get(r.id) || r.title, isCopy: copies.has(r.id) })),
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

  const items = await db.query(
    'SELECT * FROM work_items WHERE date = ? AND context_id = ? ORDER BY order_index ASC, created_at ASC',
    [date, contextId]
  );
  return attachAssociations(items);
}

export async function getWorkItemsByDateRange(startDate, endDate, contextId) {
  const items = await db.query(
    'SELECT * FROM work_items WHERE date >= ? AND date <= ? AND context_id = ? ORDER BY date ASC, order_index ASC, created_at ASC',
    [startDate, endDate, contextId]
  );
  return attachAssociations(items);
}

export async function reorderWorkItems(date, orderedIds, contextId) {
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(
      'UPDATE work_items SET order_index = ? WHERE id = ? AND date = ?',
      [i, orderedIds[i], date]
    );
  }
  return getWorkItemsByDate(date, contextId);
}

export async function getWorkItemById(id) {
  const workItem = await db.queryOne('SELECT * FROM work_items WHERE id = ?', [id]);
  if (!workItem) {
    throw new NotFoundError('Work item not found');
  }
  const [withAssociations] = await attachAssociations([workItem]);
  return withAssociations;
}

export async function createWorkItem(data, contextId) {
  const { date, title, description, notes, emoji, status, goal_ids, priority_ids, source_id, time_box_minutes, start_time } = data;

  if (!date || !title) {
    throw new ValidationError('Date and title are required');
  }

  const result = await db.queryOne('SELECT MAX(order_index) as maxOrder FROM work_items WHERE date = ? AND context_id = ?', [date, contextId]);
  const nextOrder = (result?.maxOrder ?? -1) + 1;

  const workItemId = await db.insert(
    'INSERT INTO work_items (date, title, description, notes, emoji, status, time_box_minutes, start_time, order_index, context_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [date, title, description ?? null, notes ?? null, emoji ?? null, status || 'Not Started', normalizeTimeBox(time_box_minutes), start_time || null, nextOrder, contextId]
  );

  // Goals and projects passed at creation are just children, like anything
  // else on a day - one junction, so a caller can pass any type's ids.
  for (const entityId of [...(goal_ids || []), ...(priority_ids || [])]) {
    await db.query(
      'INSERT IGNORE INTO work_entity_associations (work_item_id, entity_id) VALUES (?, ?)',
      [workItemId, entityId]
    );
  }

  // Add source association
  if (source_id) {
    await db.insert(
      'INSERT INTO work_source_associations (work_item_id, source_id) VALUES (?, ?)',
      [workItemId, source_id]
    );
  }

  return getWorkItemById(workItemId);
}

export async function updateWorkItem(id, data) {
  const { goal_ids, priority_ids, source_id } = data;

  const setClauses = [];
  const values = [];

  if (data.title !== undefined) {
    setClauses.push('title = ?');
    values.push(data.title);
  }
  if (data.description !== undefined) {
    setClauses.push('description = ?');
    values.push(data.description ?? null);
  }
  if (data.notes !== undefined) {
    setClauses.push('notes = ?');
    values.push(data.notes ?? null);
  }
  if (data.emoji !== undefined) {
    setClauses.push('emoji = ?');
    values.push(data.emoji || null);
  }
  if (data.status !== undefined) {
    setClauses.push('status = ?');
    values.push(data.status);
  }
  if (data.time_box_minutes !== undefined) {
    setClauses.push('time_box_minutes = ?');
    values.push(normalizeTimeBox(data.time_box_minutes));
  }
  if (data.start_time !== undefined) {
    setClauses.push('start_time = ?');
    values.push(data.start_time || null);
  }

  if (setClauses.length > 0) {
    values.push(id);
    await db.update(`UPDATE work_items SET ${setClauses.join(', ')} WHERE id = ?`, values);
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
       WHERE wea.work_item_id = ? AND t.slug = ?`,
      [id, slug]
    );
    for (const entityId of ids) {
      await db.query(
        'INSERT IGNORE INTO work_entity_associations (work_item_id, entity_id) VALUES (?, ?)',
        [id, entityId]
      );
    }
  }

  if (source_id !== undefined) {
    await db.query('DELETE FROM work_source_associations WHERE work_item_id = ?', [id]);
    if (source_id) {
      await db.insert(
        'INSERT INTO work_source_associations (work_item_id, source_id) VALUES (?, ?)',
        [id, source_id]
      );
    }
  }

  return getWorkItemById(id);
}

export async function deleteWorkItem(id) {
  const affectedRows = await db.deleteRecord('DELETE FROM work_items WHERE id = ?', [id]);
  return affectedRows > 0;
}

const VALID_STATUSES = ['Not Started', 'In Progress', 'Complete'];

export async function updateWorkItemStatus(id, status) {
  if (!VALID_STATUSES.includes(status)) {
    throw new ValidationError('Invalid status value');
  }

  const workItem = await getWorkItemById(id);

  await db.update('UPDATE work_items SET status = ? WHERE id = ?', [status, id]);

  // If marking a recurring item as complete, generate the next occurrence
  if (status === 'Complete' && (workItem.recurring_from_todo_id || workItem.recurring_from_task_id)) {
    await recurrenceService.generateNextRecurrenceForCompletedItem(workItem);
  }

  return getWorkItemById(id);
}

export async function updateWorkItemNotes(id, notes) {
  await db.update('UPDATE work_items SET notes = ? WHERE id = ?', [notes ?? null, id]);
  return getWorkItemById(id);
}

export async function updateWorkItemEmoji(id, emoji) {
  await db.update('UPDATE work_items SET emoji = ? WHERE id = ?', [emoji || null, id]);
  return getWorkItemById(id);
}

export async function updateWorkItemTimeBox(id, timeBoxMinutes) {
  await db.update('UPDATE work_items SET time_box_minutes = ? WHERE id = ?', [normalizeTimeBox(timeBoxMinutes), id]);
  return getWorkItemById(id);
}

export async function toggleWorkItemClaude(id) {
  const item = await getWorkItemById(id);
  const newValue = !item.worked_with_claude;
  await db.update('UPDATE work_items SET worked_with_claude = ? WHERE id = ?', [newValue, id]);
  return getWorkItemById(id);
}

async function nextOrderIndexForDate(date, contextId) {
  const result = await db.queryOne('SELECT MAX(order_index) as maxOrder FROM work_items WHERE date = ? AND context_id = ?', [date, contextId]);
  return (result?.maxOrder ?? -1) + 1;
}

export async function moveWorkItem(id, date) {
  if (!date) {
    throw new ValidationError('Date is required');
  }

  const existing = await getWorkItemById(id);
  const nextOrder = await nextOrderIndexForDate(date, existing.context_id);
  await db.update('UPDATE work_items SET date = ?, order_index = ? WHERE id = ?', [date, nextOrder, id]);
  return getWorkItemById(id);
}

export async function cloneWorkItem(id, date) {
  if (!date) {
    throw new ValidationError('Date is required');
  }

  const original = await getWorkItemById(id);
  const nextOrder = await nextOrderIndexForDate(date, original.context_id);

  const newId = await db.insert(
    'INSERT INTO work_items (date, title, description, notes, emoji, status, time_box_minutes, order_index, context_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [date, original.title, original.description, original.notes, original.emoji, 'Not Started', original.time_box_minutes, nextOrder, original.context_id]
  );

  // One junction, so cloning copies every child whatever its type - including
  // types that did not exist when this was written. Eight loops over eight
  // tables could only ever copy the eight it knew about.
  const children = await db.query(
    'SELECT entity_id, order_index FROM work_entity_associations WHERE work_item_id = ? ORDER BY order_index, id',
    [id]
  );
  for (const c of children) {
    await db.query(
      'INSERT IGNORE INTO work_entity_associations (work_item_id, entity_id, order_index) VALUES (?, ?, ?)',
      [newId, c.entity_id, c.order_index ?? 0]
    );
  }

  return getWorkItemById(newId);
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
export async function addEntityAssociation(workItemId, entityId) {
  await db.query(
    'INSERT IGNORE INTO work_entity_associations (work_item_id, entity_id) VALUES (?, ?)',
    [workItemId, entityId]
  );
  return getWorkItemById(workItemId);
}

/**
 * Left-to-right, top-to-bottom order of one work item's children. Slots are
 * renumbered from 0 in the order given, so the caller sends what it wants to
 * see rather than computing indexes.
 */
export async function reorderEntityAssociations(workItemId, orderedIds) {
  const ids = (orderedIds || []).map(Number).filter(Number.isFinite);
  for (const [i, entityId] of ids.entries()) {
    await db.query(
      'UPDATE work_entity_associations SET order_index = ? WHERE work_item_id = ? AND entity_id = ?',
      [i, workItemId, entityId]
    );
  }
  return getWorkItemById(workItemId);
}

export async function removeEntityAssociation(workItemId, entityId) {
  await db.deleteRecord(
    'DELETE FROM work_entity_associations WHERE work_item_id = ? AND entity_id = ?',
    [workItemId, entityId]
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
export async function getEntityAssociations(workItemIds) {
  if (workItemIds.length === 0) return new Map();
  const placeholders = workItemIds.map(() => '?').join(',');

  const direct = await db.query(
    `SELECT wea.work_item_id, e.id, e.title, e.is_folder, t.slug AS type_slug,
            t.label_singular, t.icon
     FROM work_entity_associations wea
     JOIN entities e ON e.id = wea.entity_id
     JOIN entity_types t ON t.id = e.entity_type_id
     WHERE wea.work_item_id IN (${placeholders}) AND e.deleted_at IS NULL
     ORDER BY wea.order_index, wea.id`,
    workItemIds
  );

  const byWorkItem = new Map();
  for (const row of direct) {
    if (!byWorkItem.has(row.work_item_id)) byWorkItem.set(row.work_item_id, []);
    byWorkItem.get(row.work_item_id).push({ ...row, depth: 0 });
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

export async function addPriorityAssociation(workItemId, priorityId) {
  return addEntityAssociation(workItemId, priorityId);
}

export async function removePriorityAssociation(workItemId, priorityId) {
  return removeEntityAssociation(workItemId, priorityId);
}

export async function addGoalAssociation(workItemId, goalId) {
  return addEntityAssociation(workItemId, goalId);
}

export async function removeGoalAssociation(workItemId, goalId) {
  return removeEntityAssociation(workItemId, goalId);
}

export async function addAreaAssociation(workItemId, areaId) {
  return addEntityAssociation(workItemId, areaId);
}

export async function removeAreaAssociation(workItemId, areaId) {
  return removeEntityAssociation(workItemId, areaId);
}

export async function addTemplateAssociation(workItemId, templateId) {
  return addEntityAssociation(workItemId, templateId);
}

export async function removeTemplateAssociation(workItemId, templateId) {
  return removeEntityAssociation(workItemId, templateId);
}

export async function addTodoAssociation(workItemId, todoId) {
  return addEntityAssociation(workItemId, todoId);
}

export async function removeTodoAssociation(workItemId, todoId) {
  return removeEntityAssociation(workItemId, todoId);
}

export async function addTaskAssociation(workItemId, taskId) {
  return addEntityAssociation(workItemId, taskId);
}

export async function removeTaskAssociation(workItemId, taskId) {
  return removeEntityAssociation(workItemId, taskId);
}

export async function addTicketAssociation(workItemId, ticketId) {
  return addEntityAssociation(workItemId, ticketId);
}

export async function removeTicketAssociation(workItemId, ticketId) {
  return removeEntityAssociation(workItemId, ticketId);
}

export async function addIdeaAssociation(workItemId, ideaId) {
  return addEntityAssociation(workItemId, ideaId);
}

export async function removeIdeaAssociation(workItemId, ideaId) {
  return removeEntityAssociation(workItemId, ideaId);
}