import * as db from '../database/connectionPool.js';
import { NotFoundError, ValidationError } from '../config/errors.js';

async function attachLinks(tasks) {
  if (tasks.length === 0) return tasks;

  const ids = tasks.map(t => t.id);
  const placeholders = ids.map(() => '?').join(',');

  const links = await db.query(
    `SELECT * FROM task_links WHERE task_id IN (${placeholders}) ORDER BY order_index ASC, id ASC`,
    ids
  );

  return tasks.map(task => ({
    ...task,
    links: links.filter(l => l.task_id === task.id),
  }));
}

async function replaceLinks(taskId, links) {
  await db.query('DELETE FROM task_links WHERE task_id = ?', [taskId]);

  if (Array.isArray(links)) {
    for (let i = 0; i < links.length; i++) {
      const { url, title } = links[i];
      if (!url) continue;
      await db.insert(
        'INSERT INTO task_links (task_id, url, title, order_index) VALUES (?, ?, ?, ?)',
        [taskId, url, title || null, i]
      );
    }
  }
}

export async function getAllTasks(contextId) {
  const tasks = await db.query('SELECT * FROM tasks WHERE context_id = ? ORDER BY created_at DESC', [contextId]);
  return attachLinks(tasks);
}

export async function getTaskById(id) {
  const task = await db.queryOne('SELECT * FROM tasks WHERE id = ?', [id]);
  if (!task) {
    throw new NotFoundError('Task not found');
  }
  const [withLinks] = await attachLinks([task]);
  return withLinks;
}

export async function createTask(data, contextId) {
  const { title, notes, links } = data;

  if (!title) {
    throw new ValidationError('Task title is required');
  }

  const taskId = await db.insert(
    'INSERT INTO tasks (title, notes, context_id) VALUES (?, ?, ?)',
    [title, notes ?? null, contextId]
  );

  if (links !== undefined) {
    await replaceLinks(taskId, links);
  }

  return getTaskById(taskId);
}

export async function updateTask(id, data) {
  const setClauses = [];
  const values = [];

  if (data.title !== undefined) {
    if (!data.title) {
      throw new ValidationError('Task title is required');
    }
    setClauses.push('title = ?');
    values.push(data.title);
  }
  if (data.notes !== undefined) {
    setClauses.push('notes = ?');
    values.push(data.notes ?? null);
  }

  if (setClauses.length > 0) {
    values.push(id);
    await db.update(`UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`, values);
  }

  if (data.links !== undefined) {
    await replaceLinks(id, data.links);
  }

  return getTaskById(id);
}

export async function deleteTask(id) {
  const affectedRows = await db.deleteRecord('DELETE FROM tasks WHERE id = ?', [id]);
  return affectedRows > 0;
}
