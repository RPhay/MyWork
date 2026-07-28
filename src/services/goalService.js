import * as db from '../database/connectionPool.js';
import { NotFoundError, ValidationError } from '../config/errors.js';

export async function getGoalsByYear(year) {
  const goals = await db.query(
    'SELECT * FROM goals WHERE year = ? ORDER BY due_date ASC',
    [year]
  );
  return goals || [];
}

export async function getGoalById(id) {
  const goal = await db.queryOne(
    'SELECT * FROM goals WHERE id = ?',
    [id]
  );
  if (!goal) {
    throw new NotFoundError('Goal not found');
  }
  return goal;
}

export async function createGoal(data) {
  const { year, name, description, measurements, goal_updates, status, due_date, categories } = data;

  if (!name) {
    throw new ValidationError('Goal name is required');
  }

  const goalId = await db.insert(
    'INSERT INTO goals (year, name, description, measurements, goal_updates, status, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [year, name, description, measurements, goal_updates, status || 'Not Started', due_date]
  );

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

  await db.update(
    'UPDATE goals SET name = ?, description = ?, measurements = ?, goal_updates = ?, status = ?, due_date = ? WHERE id = ?',
    [name, description, measurements, goal_updates, status, due_date, id]
  );

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

export async function getCategories() {
  return await db.query('SELECT * FROM categories ORDER BY name ASC');
}
