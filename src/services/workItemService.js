import * as db from '../database/connectionPool.js';
import { NotFoundError, ValidationError } from '../config/errors.js';
import { buildPathMap } from '../utils/hierarchyPath.js';
import * as recurrenceService from './recurrenceService.js';

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

  const [priorityRows, goalRows, areaRows, allPriorities, allAreas] = await Promise.all([
    db.query(
      `SELECT wpa.work_item_id, p.id, p.title
       FROM work_priority_associations wpa
       JOIN priorities p ON wpa.priority_id = p.id
       WHERE wpa.work_item_id IN (${placeholders})`,
      ids
    ),
    db.query(
      `SELECT wga.work_item_id, g.id, g.name
       FROM work_goal_associations wga
       JOIN goals g ON wga.goal_id = g.id
       WHERE wga.work_item_id IN (${placeholders})`,
      ids
    ),
    db.query(
      `SELECT waa.work_item_id, a.id, a.name
       FROM work_area_associations waa
       JOIN areas a ON waa.area_id = a.id
       WHERE waa.work_item_id IN (${placeholders})`,
      ids
    ),
    db.query('SELECT id, title, parent_id FROM priorities'),
    db.query('SELECT id, name, parent_id FROM areas'),
  ]);

  const priorityPaths = buildPathMap(allPriorities, 'title');
  const areaPaths = buildPathMap(allAreas);

  return items.map(item => ({
    ...item,
    priorities: priorityRows
      .filter(r => r.work_item_id === item.id)
      .map(r => ({ id: r.id, title: r.title, path: priorityPaths.get(r.id) || r.title })),
    goals: goalRows
      .filter(r => r.work_item_id === item.id)
      .map(r => ({ id: r.id, name: r.name })),
    areas: areaRows
      .filter(r => r.work_item_id === item.id)
      .map(r => ({ id: r.id, name: r.name, path: areaPaths.get(r.id) || r.name })),
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

  // Add goal associations
  if (goal_ids && Array.isArray(goal_ids)) {
    for (const goalId of goal_ids) {
      await db.insert(
        'INSERT INTO work_goal_associations (work_item_id, goal_id) VALUES (?, ?)',
        [workItemId, goalId]
      );
    }
  }

  // Add priority associations
  if (priority_ids && Array.isArray(priority_ids)) {
    for (const priorityId of priority_ids) {
      await db.insert(
        'INSERT INTO work_priority_associations (work_item_id, priority_id) VALUES (?, ?)',
        [workItemId, priorityId]
      );
    }
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

  // Update associations
  if (goal_ids !== undefined) {
    await db.query('DELETE FROM work_goal_associations WHERE work_item_id = ?', [id]);
    if (Array.isArray(goal_ids)) {
      for (const goalId of goal_ids) {
        await db.insert(
          'INSERT INTO work_goal_associations (work_item_id, goal_id) VALUES (?, ?)',
          [id, goalId]
        );
      }
    }
  }

  if (priority_ids !== undefined) {
    await db.query('DELETE FROM work_priority_associations WHERE work_item_id = ?', [id]);
    if (Array.isArray(priority_ids)) {
      for (const priorityId of priority_ids) {
        await db.insert(
          'INSERT INTO work_priority_associations (work_item_id, priority_id) VALUES (?, ?)',
          [id, priorityId]
        );
      }
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

  for (const p of original.priorities) {
    await db.insert('INSERT INTO work_priority_associations (work_item_id, priority_id) VALUES (?, ?)', [newId, p.id]);
  }
  for (const g of original.goals) {
    await db.insert('INSERT INTO work_goal_associations (work_item_id, goal_id) VALUES (?, ?)', [newId, g.id]);
  }
  for (const a of original.areas) {
    await db.insert('INSERT INTO work_area_associations (work_item_id, area_id) VALUES (?, ?)', [newId, a.id]);
  }

  return getWorkItemById(newId);
}

export async function addPriorityAssociation(workItemId, priorityId) {
  await db.query(
    'INSERT IGNORE INTO work_priority_associations (work_item_id, priority_id) VALUES (?, ?)',
    [workItemId, priorityId]
  );
  return getWorkItemById(workItemId);
}

export async function removePriorityAssociation(workItemId, priorityId) {
  await db.deleteRecord(
    'DELETE FROM work_priority_associations WHERE work_item_id = ? AND priority_id = ?',
    [workItemId, priorityId]
  );
}

export async function addGoalAssociation(workItemId, goalId) {
  await db.query(
    'INSERT IGNORE INTO work_goal_associations (work_item_id, goal_id) VALUES (?, ?)',
    [workItemId, goalId]
  );
  return getWorkItemById(workItemId);
}

export async function removeGoalAssociation(workItemId, goalId) {
  await db.deleteRecord(
    'DELETE FROM work_goal_associations WHERE work_item_id = ? AND goal_id = ?',
    [workItemId, goalId]
  );
}

export async function addAreaAssociation(workItemId, areaId) {
  await db.query(
    'INSERT IGNORE INTO work_area_associations (work_item_id, area_id) VALUES (?, ?)',
    [workItemId, areaId]
  );
  return getWorkItemById(workItemId);
}

export async function removeAreaAssociation(workItemId, areaId) {
  await db.deleteRecord(
    'DELETE FROM work_area_associations WHERE work_item_id = ? AND area_id = ?',
    [workItemId, areaId]
  );
}