import * as db from '../database/connectionPool.js';
import { NotFoundError, ValidationError } from '../config/errors.js';

export async function getAllFolders(contextId) {
  return await db.query('SELECT * FROM to_do_folders WHERE context_id = ? OR context_id IS NULL ORDER BY name ASC', [contextId]);
}

export async function getFolderById(id) {
  const folder = await db.queryOne('SELECT * FROM to_do_folders WHERE id = ?', [id]);
  if (!folder) {
    throw new NotFoundError('Folder not found');
  }
  return folder;
}

async function getDescendantIds(id) {
  const all = await db.query('SELECT id, parent_id FROM to_do_folders');
  const descendants = new Set();
  const queue = [Number(id)];

  while (queue.length > 0) {
    const current = queue.pop();
    for (const row of all) {
      if (row.parent_id === current && !descendants.has(row.id)) {
        descendants.add(row.id);
        queue.push(row.id);
      }
    }
  }

  return descendants;
}

export async function createFolder(data, contextId) {
  const { name, parent_id } = data;

  if (!name) {
    throw new ValidationError('Folder name is required');
  }

  const folderId = await db.insert(
    'INSERT INTO to_do_folders (name, parent_id, context_id) VALUES (?, ?, ?)',
    [name, parent_id || null, contextId]
  );

  return getFolderById(folderId);
}

export async function updateFolder(id, data) {
  const { name } = data;

  if (!name) {
    throw new ValidationError('Folder name is required');
  }

  const setClauses = ['name = ?'];
  const values = [name];

  // Only touch parent_id when the caller explicitly provided it (e.g. drag-to-reparent).
  if (data.parent_id !== undefined) {
    const parentId = data.parent_id || null;

    if (parentId) {
      if (Number(parentId) === Number(id)) {
        throw new ValidationError('A folder cannot be its own parent');
      }
      const descendants = await getDescendantIds(id);
      if (descendants.has(Number(parentId))) {
        throw new ValidationError('Cannot set a sub-folder as the parent of its own ancestor');
      }
    }

    setClauses.push('parent_id = ?');
    values.push(parentId);
  }

  values.push(id);

  await db.update(`UPDATE to_do_folders SET ${setClauses.join(', ')} WHERE id = ?`, values);

  return getFolderById(id);
}

export async function deleteFolder(id) {
  const affectedRows = await db.deleteRecord('DELETE FROM to_do_folders WHERE id = ?', [id]);
  return affectedRows > 0;
}
