import * as db from '../database/connectionPool.js';
import { NotFoundError, ValidationError } from '../config/errors.js';
import * as recurrenceService from './recurrenceService.js';

const VALID_TASK_STATUSES = ['incomplete', 'complete', 'failed', 'skipped'];

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
    recurrence: task.recurrence ? JSON.parse(task.recurrence) : null,
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
  const { title, notes, parent_id, priority_id, links, recurrence } = data;

  if (!title) {
    throw new ValidationError('Task title is required');
  }

  if (recurrence) {
    recurrenceService.validateRecurrence(recurrence);
  }

  const taskId = await db.insert(
    'INSERT INTO tasks (title, notes, parent_id, priority_id, recurrence, context_id) VALUES (?, ?, ?, ?, ?, ?)',
    [title, notes ?? null, parent_id || null, priority_id || null, recurrence ? JSON.stringify(recurrence) : null, contextId]
  );

  if (links !== undefined) {
    await replaceLinks(taskId, links);
  }

  return getTaskById(taskId);
}

async function findAncestorChain(taskId) {
  const chain = [];
  let currentId = taskId;
  const visited = new Set();
  const MAX_CHAIN = 1000;

  while (currentId && chain.length < MAX_CHAIN) {
    if (visited.has(Number(currentId))) break;
    visited.add(Number(currentId));

    const task = await db.queryOne('SELECT id, parent_id FROM tasks WHERE id = ?', [currentId]);
    if (!task) break;

    chain.push(task);
    currentId = task.parent_id;
  }

  return chain;
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

  // Only touch parent_id when the caller explicitly provided it (e.g. drag-to-nest),
  // so a plain title/notes edit from the modal leaves the current parent untouched.
  if (data.parent_id !== undefined) {
    if (data.parent_id && Number(data.parent_id) === Number(id)) {
      throw new ValidationError('A task cannot be its own parent');
    }

    // Check if this would create a circular hierarchy that needs swapping
    if (data.parent_id) {
      const ancestorChain = await findAncestorChain(Number(data.parent_id));
      const isDescendant = ancestorChain.some(a => Number(a.id) === Number(id));

      if (isDescendant) {
        // Swap: the parent (id) should take the proposed parent's parent_id
        const proposedParent = await db.queryOne('SELECT parent_id FROM tasks WHERE id = ?', [data.parent_id]);

        // First, update the proposed parent's parent to point to the original parent
        await db.update('UPDATE tasks SET parent_id = ? WHERE id = ?', [id, data.parent_id]);

        // Then update the original parent to point to the proposed parent's old parent
        await db.update('UPDATE tasks SET parent_id = ? WHERE id = ?', [proposedParent?.parent_id || null, id]);

        return getTaskById(id);
      }
    }

    setClauses.push('parent_id = ?');
    values.push(data.parent_id || null);
  }

  // priority_id (Projects-tab association) is separate from parent_id
  // (nesting) so linking/unlinking a project has no effect on nesting.
  if (data.priority_id !== undefined) {
    setClauses.push('priority_id = ?');
    values.push(data.priority_id || null);
  }

  if (data.status !== undefined) {
    if (!VALID_TASK_STATUSES.includes(data.status)) {
      throw new ValidationError('Invalid task status');
    }
    setClauses.push('status = ?');
    values.push(data.status);
  }

  if (data.recurrence !== undefined) {
    if (data.recurrence) {
      recurrenceService.validateRecurrence(data.recurrence);
    }
    setClauses.push('recurrence = ?');
    values.push(data.recurrence ? JSON.stringify(data.recurrence) : null);
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
