import * as db from '../database/connectionPool.js';
import { NotFoundError, ValidationError, ConflictError } from '../config/errors.js';

async function attachCategories(goals) {
  if (goals.length === 0) return goals;

  const ids = goals.map(g => g.id);
  const placeholders = ids.map(() => '?').join(',');

  const rows = await db.query(
    `SELECT gc.goal_id, c.id, c.name
     FROM goal_categories gc
     JOIN categories c ON gc.category_id = c.id
     WHERE gc.goal_id IN (${placeholders})`,
    ids
  );

  return goals.map(goal => ({
    ...goal,
    categories: rows
      .filter(r => r.goal_id === goal.id)
      .map(r => ({ id: r.id, name: r.name })),
  }));
}

export async function getGoalsByYear(year) {
  const goals = await db.query(
    'SELECT * FROM goals WHERE year = ? ORDER BY order_index ASC, due_date ASC',
    [year]
  );
  return attachCategories(goals || []);
}

export async function getGoalById(id) {
  const goal = await db.queryOne(
    'SELECT * FROM goals WHERE id = ?',
    [id]
  );
  if (!goal) {
    throw new NotFoundError('Goal not found');
  }
  const [withCategories] = await attachCategories([goal]);
  return withCategories;
}

export async function createGoal(data) {
  const { year, name, description, measurements, goal_updates, status, due_date, categories } = data;

  if (!name) {
    throw new ValidationError('Goal name is required');
  }

  const orderResult = await db.queryOne('SELECT MAX(order_index) as maxOrder FROM goals');
  const nextOrder = (orderResult?.maxOrder ?? -1) + 1;

  let goalId;
  try {
    goalId = await db.insert(
      'INSERT INTO goals (year, name, description, measurements, goal_updates, status, due_date, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [year, name, description ?? null, measurements ?? null, goal_updates ?? null, status || 'Not Started', due_date || null, nextOrder]
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new ConflictError('A goal with that name already exists for this year');
    }
    throw error;
  }

  // Add categories
  if (categories && Array.isArray(categories)) {
    for (const categoryId of categories) {
      await db.insert(
        'INSERT INTO goal_categories (goal_id, category_id) VALUES (?, ?)',
        [goalId, categoryId]
      );
    }
  }

  return getGoalById(goalId);
}

export async function updateGoal(id, data) {
  const { name, description, measurements, goal_updates, status, due_date, categories } = data;

  try {
    await db.update(
      'UPDATE goals SET name = ?, description = ?, measurements = ?, goal_updates = ?, status = ?, due_date = ? WHERE id = ?',
      [name, description ?? null, measurements ?? null, goal_updates ?? null, status || 'Not Started', due_date || null, id]
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new ConflictError('A goal with that name already exists for this year');
    }
    throw error;
  }

  // Update categories
  if (categories && Array.isArray(categories)) {
    await db.query('DELETE FROM goal_categories WHERE goal_id = ?', [id]);
    for (const categoryId of categories) {
      await db.insert(
        'INSERT INTO goal_categories (goal_id, category_id) VALUES (?, ?)',
        [id, categoryId]
      );
    }
  }

  return getGoalById(id);
}

export async function deleteGoal(id) {
  const affectedRows = await db.deleteRecord('DELETE FROM goals WHERE id = ?', [id]);
  return affectedRows > 0;
}

const VALID_STATUSES = ['Not Started', 'In Progress', 'Complete'];

export async function updateGoalStatus(id, status) {
  if (!VALID_STATUSES.includes(status)) {
    throw new ValidationError('Invalid status value');
  }

  await db.update('UPDATE goals SET status = ? WHERE id = ?', [status, id]);
  return getGoalById(id);
}

// Used by the Yearly Goals list: dragging a goal between two others to reorder it
export async function reorderGoals(orderedIds) {
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update('UPDATE goals SET order_index = ? WHERE id = ?', [i, orderedIds[i]]);
  }
}

export async function getCategories() {
  return await db.query('SELECT * FROM categories ORDER BY name ASC');
}
