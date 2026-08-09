import * as db from '../database/connectionPool.js';
import { NotFoundError, ValidationError } from '../config/errors.js';

const VALID_TODO_STATUSES = ['incomplete', 'complete', 'failed', 'skipped'];

async function attachItems(toDos) {
  if (toDos.length === 0) return toDos;

  const ids = toDos.map(t => t.id);
  const placeholders = ids.map(() => '?').join(',');

  const items = await db.query(
    `SELECT * FROM to_do_items WHERE to_do_id IN (${placeholders}) ORDER BY order_index ASC, id ASC`,
    ids
  );

  return toDos.map(toDo => ({
    ...toDo,
    items: items.filter(i => i.to_do_id === toDo.id),
  }));
}

async function replaceItems(toDoId, items) {
  await db.query('DELETE FROM to_do_items WHERE to_do_id = ?', [toDoId]);

  if (Array.isArray(items)) {
    for (let i = 0; i < items.length; i++) {
      const { text, is_done } = items[i];
      if (!text) continue;
      await db.insert(
        'INSERT INTO to_do_items (to_do_id, text, is_done, order_index) VALUES (?, ?, ?, ?)',
        [toDoId, text, !!is_done, i]
      );
    }
  }
}

export async function getAllToDos(contextId) {
  const toDos = await db.query('SELECT * FROM to_dos WHERE context_id = ? OR context_id IS NULL ORDER BY created_at DESC', [contextId]);
  return attachItems(toDos);
}

export async function getToDoById(id) {
  const toDo = await db.queryOne('SELECT * FROM to_dos WHERE id = ?', [id]);
  if (!toDo) {
    throw new NotFoundError('To do not found');
  }
  const [withItems] = await attachItems([toDo]);
  return withItems;
}

export async function createToDo(data, contextId) {
  const { title, notes, folder_id, priority_id, items } = data;

  if (!title) {
    throw new ValidationError('To do title is required');
  }

  const toDoId = await db.insert(
    'INSERT INTO to_dos (title, notes, folder_id, priority_id, context_id) VALUES (?, ?, ?, ?, ?)',
    [title, notes ?? null, folder_id || null, priority_id || null, contextId]
  );

  if (items !== undefined) {
    await replaceItems(toDoId, items);
  }

  return getToDoById(toDoId);
}

export async function updateToDo(id, data) {
  const setClauses = [];
  const values = [];

  if (data.title !== undefined) {
    if (!data.title) {
      throw new ValidationError('To do title is required');
    }
    setClauses.push('title = ?');
    values.push(data.title);
  }
  if (data.notes !== undefined) {
    setClauses.push('notes = ?');
    values.push(data.notes ?? null);
  }

  // Only touch folder_id when the caller explicitly provided it (e.g. drag-to-file),
  // so a plain title/notes edit from the modal leaves the current folder untouched.
  if (data.folder_id !== undefined) {
    setClauses.push('folder_id = ?');
    values.push(data.folder_id || null);
  }

  // priority_id (Projects-tab association) is intentionally separate from folder_id
  // (Todos-tab folder) so linking/unlinking a project has no effect on Todos-tab
  // organization, and vice versa.
  if (data.priority_id !== undefined) {
    setClauses.push('priority_id = ?');
    values.push(data.priority_id || null);
  }

  if (data.status !== undefined) {
    if (!VALID_TODO_STATUSES.includes(data.status)) {
      throw new ValidationError('Invalid to do status');
    }
    setClauses.push('status = ?');
    values.push(data.status);
  }

  if (setClauses.length > 0) {
    values.push(id);
    await db.update(`UPDATE to_dos SET ${setClauses.join(', ')} WHERE id = ?`, values);
  }

  // Only touch items when the caller explicitly provided them, so operations like
  // drag-to-file (which only sends title/notes/folder_id) don't wipe the checklist.
  if (data.items !== undefined) {
    await replaceItems(id, data.items);
  }

  return getToDoById(id);
}

export async function deleteToDo(id) {
  const affectedRows = await db.deleteRecord('DELETE FROM to_dos WHERE id = ?', [id]);
  return affectedRows > 0;
}
