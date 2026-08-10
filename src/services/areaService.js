import * as db from '../database/connectionPool.js';
import { NotFoundError, ValidationError, ConflictError } from '../config/errors.js';

export async function getAllAreas(contextId) {
  return await db.query('SELECT * FROM areas WHERE context_id = ? ORDER BY order_index ASC, name ASC', [contextId]);
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

export async function createArea(data, contextId) {
  const { name, description, parent_id } = data;

  if (!name) {
    throw new ValidationError('Area name is required');
  }

  const result = await db.queryOne('SELECT MAX(order_index) as maxOrder FROM areas WHERE context_id = ?', [contextId]);
  const nextOrder = (result?.maxOrder ?? -1) + 1;

  try {
    const areaId = await db.insert(
      'INSERT INTO areas (name, description, parent_id, order_index, context_id) VALUES (?, ?, ?, ?, ?)',
      [name, description || null, parent_id || null, nextOrder, contextId]
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
  const setClauses = [];
  const values = [];

  if (data.name !== undefined) {
    if (!data.name) {
      throw new ValidationError('Area name is required');
    }
    setClauses.push('name = ?');
    values.push(data.name);
  }
  if (data.description !== undefined) {
    setClauses.push('description = ?');
    values.push(data.description || null);
  }

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

  if (setClauses.length === 0) {
    return getAreaById(id);
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
  // Get all descendants that will be deleted
  const descendants = await getDescendantIds(id);
  const allIds = [Number(id), ...descendants];

  // Delete all associations for this area and its descendants
  const idPlaceholders = allIds.map(() => '?').join(',');
  await db.deleteRecord(`DELETE FROM work_area_associations WHERE area_id IN (${idPlaceholders})`, allIds);

  // Delete all descendants first
  if (descendants.size > 0) {
    const descendantIds = Array.from(descendants);
    const descendantPlaceholders = descendantIds.map(() => '?').join(',');
    await db.deleteRecord(`DELETE FROM areas WHERE id IN (${descendantPlaceholders})`, descendantIds);
  }

  // Delete the area itself
  const affectedRows = await db.deleteRecord('DELETE FROM areas WHERE id = ?', [id]);
  return affectedRows > 0;
}

// Used by the Categories tree: dragging a category between two siblings under
// the same parent (rather than onto one, which nests it instead).
export async function reorderAreasAmongSiblings(orderedIds, contextId) {
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update('UPDATE areas SET order_index = ? WHERE id = ?', [i, orderedIds[i]]);
  }

  return getAllAreas(contextId);
}