import * as db from '../database/connectionPool.js';
import { NotFoundError, ValidationError, ConflictError } from '../config/errors.js';

export async function getAllAreas() {
  return await db.query('SELECT * FROM areas ORDER BY order_index ASC, name ASC');
}

export async function getAreaById(id) {
  const area = await db.queryOne('SELECT * FROM areas WHERE id = ?', [id]);
  if (!area) {
    throw new NotFoundError('Area not found');
  }
  return area;
}

async function getDescendantIds(id) {
  const all = await db.query('SELECT id, parent_id FROM areas');
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

export async function createArea(data) {
  const { name, description, parent_id } = data;

  if (!name) {
    throw new ValidationError('Area name is required');
  }

  const result = await db.queryOne('SELECT MAX(order_index) as maxOrder FROM areas');
  const nextOrder = (result?.maxOrder ?? -1) + 1;

  try {
    const areaId = await db.insert(
      'INSERT INTO areas (name, description, parent_id, order_index) VALUES (?, ?, ?, ?)',
      [name, description || null, parent_id || null, nextOrder]
    );

    return getAreaById(areaId);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new ConflictError('An area with that name already exists');
    }
    throw error;
  }
}

export async function updateArea(id, data) {
  const { name, description } = data;

  if (!name) {
    throw new ValidationError('Area name is required');
  }

  const setClauses = ['name = ?', 'description = ?'];
  const values = [name, description || null];

  // Only touch parent_id when the caller explicitly provided it (e.g. drag-to-reparent).
  // A plain name/description edit from the modal must leave the current parent alone.
  if (data.parent_id !== undefined) {
    const parentId = data.parent_id || null;

    if (parentId) {
      if (Number(parentId) === Number(id)) {
        throw new ValidationError('An area cannot be its own parent');
      }
      const descendants = await getDescendantIds(id);
      if (descendants.has(Number(parentId))) {
        throw new ValidationError('Cannot set a sub-area as the parent of its own ancestor');
      }
    }

    setClauses.push('parent_id = ?');
    values.push(parentId);
  }

  values.push(id);

  try {
    await db.update(`UPDATE areas SET ${setClauses.join(', ')} WHERE id = ?`, values);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new ConflictError('An area with that name already exists');
    }
    throw error;
  }

  return getAreaById(id);
}

export async function deleteArea(id) {
  const affectedRows = await db.deleteRecord('DELETE FROM areas WHERE id = ?', [id]);
  return affectedRows > 0;
}

// Used by the Categories tree: dragging a category between two siblings under
// the same parent (rather than onto one, which nests it instead).
export async function reorderAreasAmongSiblings(orderedIds) {
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update('UPDATE areas SET order_index = ? WHERE id = ?', [i, orderedIds[i]]);
  }

  return getAllAreas();
}