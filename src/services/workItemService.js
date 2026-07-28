import * as db from '../database/connectionPool.js';
import { NotFoundError, ValidationError } from '../config/errors.js';

export async function getWorkItemsByDate(date) {
  return await db.query(
    'SELECT * FROM work_items WHERE date = ? ORDER BY created_at ASC',
    [date]
  );
}

export async function getWorkItemsByDateRange(startDate, endDate) {
  return await db.query(
    'SELECT * FROM work_items WHERE date >= ? AND date <= ? ORDER BY date ASC, created_at ASC',
    [startDate, endDate]
  );
}

export async function getWorkItemById(id) {
  const workItem = await db.queryOne('SELECT * FROM work_items WHERE id = ?', [id]);
  if (!workItem) {
    throw new NotFoundError('Work item not found');
  }
  return workItem;
}

export async function createWorkItem(data) {
  const { date, title, description, status, goal_ids, priority_ids, source_id } = data;

  if (!date || !title) {
    throw new ValidationError('Date and title are required');
  }

  const workItemId = await db.insert(
    'INSERT INTO work_items (date, title, description, status) VALUES (?, ?, ?, ?)',
    [date, title, description, status || 'Not Started']
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
  const { title, description, status, goal_ids, priority_ids, source_id } = data;

  await db.update(
    'UPDATE work_items SET title = ?, description = ?, status = ? WHERE id = ?',
    [title, description, status, id]
  );

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
