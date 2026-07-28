import * as db from '../database/connectionPool.js';
import { NotFoundError, ValidationError } from '../config/errors.js';

export async function getAllPriorities() {
  return await db.query('SELECT * FROM priorities ORDER BY order_index ASC');
}

export async function getPriorityById(id) {
  const priority = await db.queryOne('SELECT * FROM priorities WHERE id = ?', [id]);
  if (!priority) {
    throw new NotFoundError('Priority not found');
  }
  return priority;
}

export async function createPriority(data) {
  const { title, source_id, notes } = data;

  if (!title) {
    throw new ValidationError('Priority title is required');
  }

  // Get the max order index
  const result = await db.queryOne('SELECT MAX(order_index) as maxOrder FROM priorities');
  const nextOrder = (result?.maxOrder || 0) + 1;

  const priorityId = await db.insert(
    'INSERT INTO priorities (title, source_id, notes, order_index) VALUES (?, ?, ?, ?)',
    [title, source_id || null, notes, nextOrder]
  );

  return getPriorityById(priorityId);
}

export async function updatePriority(id, data) {
  const { title, source_id, notes } = data;

  await db.update(
    'UPDATE priorities SET title = ?, source_id = ?, notes = ? WHERE id = ?',
    [title, source_id || null, notes, id]
  );

  return getPriorityById(id);
}

export async function deletePriority(id) {
  const affectedRows = await db.deleteRecord('DELETE FROM priorities WHERE id = ?', [id]);
  return affectedRows > 0;
}

export async function reorderPriority(id, newIndex) {
  // Get current order
  const priority = await getPriorityById(id);
  const currentIndex = priority.order_index;

  if (currentIndex === newIndex) {
    return priority;
  }

  if (newIndex < currentIndex) {
    // Moving up - increment all priorities between newIndex and currentIndex
    await db.update(
      'UPDATE priorities SET order_index = order_index + 1 WHERE order_index >= ? AND order_index < ? AND id != ?',
      [newIndex, currentIndex, id]
    );
  } else {
    // Moving down - decrement all priorities between currentIndex and newIndex
    await db.update(
      'UPDATE priorities SET order_index = order_index - 1 WHERE order_index > ? AND order_index <= ? AND id != ?',
      [currentIndex, newIndex, id]
    );
  }

  // Update the priority's order
  await db.update('UPDATE priorities SET order_index = ? WHERE id = ?', [newIndex, id]);

  return getPriorityById(id);
}
