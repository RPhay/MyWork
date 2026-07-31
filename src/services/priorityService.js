import * as db from '../database/connectionPool.js';
import { NotFoundError, ValidationError, ConflictError } from '../config/errors.js';
import { buildPathMap } from '../utils/hierarchyPath.js';

async function attachAssociations(priorities) {
  if (priorities.length === 0) return priorities;

  const ids = priorities.map(p => p.id);
  const placeholders = ids.map(() => '?').join(',');

  const [areaRows, goalRows, allAreas] = await Promise.all([
    db.query(
      `SELECT pa.priority_id, a.id, a.name
       FROM priority_areas pa
       JOIN areas a ON pa.area_id = a.id
       WHERE pa.priority_id IN (${placeholders})`,
      ids
    ),
    db.query(
      `SELECT pg.priority_id, g.id, g.name
       FROM priority_goals pg
       JOIN goals g ON pg.goal_id = g.id
       WHERE pg.priority_id IN (${placeholders})`,
      ids
    ),
    db.query('SELECT id, name, parent_id FROM areas'),
  ]);

  const areaPaths = buildPathMap(allAreas);

  return priorities.map(priority => ({
    ...priority,
    areas: areaRows
      .filter(r => r.priority_id === priority.id)
      .map(r => ({ id: r.id, name: r.name, path: areaPaths.get(r.id) || r.name })),
    goals: goalRows
      .filter(r => r.priority_id === priority.id)
      .map(r => ({ id: r.id, name: r.name })),
  }));
}

export async function getAllPriorities(contextId) {
  const priorities = await db.query('SELECT * FROM priorities WHERE context_id = ? ORDER BY order_index ASC', [contextId]);
  return attachAssociations(priorities);
}

export async function getPriorityById(id) {
  const priority = await db.queryOne('SELECT * FROM priorities WHERE id = ?', [id]);
  if (!priority) {
    throw new NotFoundError('Priority not found');
  }
  const [withAssociations] = await attachAssociations([priority]);
  return withAssociations;
}

async function getDescendantIds(id) {
  const all = await db.query('SELECT id, parent_id FROM priorities');
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

async function setAreaAssociations(priorityId, areaIds) {
  await db.query('DELETE FROM priority_areas WHERE priority_id = ?', [priorityId]);
  for (const areaId of areaIds) {
    await db.insert('INSERT INTO priority_areas (priority_id, area_id) VALUES (?, ?)', [priorityId, areaId]);
  }
}

async function setGoalAssociations(priorityId, goalIds) {
  await db.query('DELETE FROM priority_goals WHERE priority_id = ?', [priorityId]);
  for (const goalId of goalIds) {
    await db.insert('INSERT INTO priority_goals (priority_id, goal_id) VALUES (?, ?)', [priorityId, goalId]);
  }
}

export async function createPriority(data, contextId) {
  const { title, source_id, parent_id, notes, area_ids, goal_ids, status } = data;

  if (!title) {
    throw new ValidationError('Priority title is required');
  }

  // Get the max order index
  const result = await db.queryOne('SELECT MAX(order_index) as maxOrder FROM priorities WHERE context_id = ?', [contextId]);
  const nextOrder = (result?.maxOrder || 0) + 1;

  let priorityId;
  try {
    priorityId = await db.insert(
      'INSERT INTO priorities (title, source_id, parent_id, notes, status, order_index, context_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title, source_id || null, parent_id || null, notes ?? null, status || 'Not Started', nextOrder, contextId]
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new ConflictError('A priority with that title already exists');
    }
    throw error;
  }

  if (Array.isArray(area_ids) && area_ids.length > 0) {
    await setAreaAssociations(priorityId, area_ids);
  }
  if (Array.isArray(goal_ids) && goal_ids.length > 0) {
    await setGoalAssociations(priorityId, goal_ids);
  }

  return getPriorityById(priorityId);
}

export async function updatePriority(id, data) {
  // Every field below is only touched when the caller explicitly provided it, so
  // partial updates (like drag-to-reparent sending only parent_id) never clobber
  // fields they didn't mean to change.
  const setClauses = [];
  const values = [];

  if (data.title !== undefined) {
    if (!data.title) {
      throw new ValidationError('Priority title is required');
    }
    setClauses.push('title = ?');
    values.push(data.title);
  }

  if (data.source_id !== undefined) {
    setClauses.push('source_id = ?');
    values.push(data.source_id || null);
  }

  if (data.notes !== undefined) {
    setClauses.push('notes = ?');
    values.push(data.notes ?? null);
  }

  if (data.status !== undefined) {
    setClauses.push('status = ?');
    values.push(data.status || 'Not Started');
  }

  if (data.parent_id !== undefined) {
    const parentId = data.parent_id || null;

    if (parentId) {
      if (Number(parentId) === Number(id)) {
        throw new ValidationError('A project cannot be its own parent');
      }
      const descendants = await getDescendantIds(id);
      if (descendants.has(Number(parentId))) {
        throw new ValidationError('Cannot set a sub-project as the parent of its own ancestor');
      }
    }

    setClauses.push('parent_id = ?');
    values.push(parentId);
  }

  if (data.is_weekly !== undefined) {
    setClauses.push('is_weekly = ?');
    values.push(!!data.is_weekly);
  }

  if (setClauses.length > 0) {
    values.push(id);
    try {
      await db.update(`UPDATE priorities SET ${setClauses.join(', ')} WHERE id = ?`, values);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictError('A priority with that title already exists');
      }
      throw error;
    }
  }

  if (data.area_ids !== undefined) {
    await setAreaAssociations(id, Array.isArray(data.area_ids) ? data.area_ids : []);
  }
  if (data.goal_ids !== undefined) {
    await setGoalAssociations(id, Array.isArray(data.goal_ids) ? data.goal_ids : []);
  }

  return getPriorityById(id);
}

export async function deletePriority(id) {
  const affectedRows = await db.deleteRecord('DELETE FROM priorities WHERE id = ?', [id]);
  return affectedRows > 0;
}

const VALID_STATUSES = ['Not Started', 'In Progress', 'Complete'];

export async function updatePriorityStatus(id, status) {
  if (!VALID_STATUSES.includes(status)) {
    throw new ValidationError('Invalid status value');
  }

  await db.update('UPDATE priorities SET status = ? WHERE id = ?', [status, id]);
  return getPriorityById(id);
}

// Rewrites order_index for the given ids (0..n, in the given order) - order_index
// is a single global ranking across all top-level priorities, shared by the
// Projects tree, the Priority Board, and Weekly Priorities, so reordering in any
// one of them is immediately reflected in the others. `draggedId`/`updates` are
// optional: when a drag also changes the item's status (Priority Board bay move)
// or weekly membership (adding/removing from Weekly Priorities), those fields are
// set on just that one item in the same pass.
export async function reorderPrioritiesAmongSiblings(orderedIds, draggedId, updates) {
  if (draggedId && updates && Object.keys(updates).length > 0) {
    const setClauses = [];
    const values = [];

    if (updates.status !== undefined) {
      if (!VALID_STATUSES.includes(updates.status)) {
        throw new ValidationError('Invalid status value');
      }
      setClauses.push('status = ?');
      values.push(updates.status);
    }

    if (updates.is_weekly !== undefined) {
      setClauses.push('is_weekly = ?');
      values.push(!!updates.is_weekly);
    }

    if (setClauses.length > 0) {
      values.push(draggedId);
      await db.update(`UPDATE priorities SET ${setClauses.join(', ')} WHERE id = ?`, values);
    }
  }

  for (let i = 0; i < orderedIds.length; i++) {
    await db.update('UPDATE priorities SET order_index = ? WHERE id = ?', [i, orderedIds[i]]);
  }

  return getAllPriorities();
}

// Single add/remove association endpoints, used by dragging a category or goal
// chip from the Projects page's right panel onto a project/sub-project - unlike
// setAreaAssociations/setGoalAssociations (full replace, used by the edit form),
// these only add or remove the one association being dragged.
export async function addAreaAssociation(priorityId, areaId) {
  await db.query(
    'INSERT IGNORE INTO priority_areas (priority_id, area_id) VALUES (?, ?)',
    [priorityId, areaId]
  );
  return getPriorityById(priorityId);
}

export async function removeAreaAssociation(priorityId, areaId) {
  await db.deleteRecord(
    'DELETE FROM priority_areas WHERE priority_id = ? AND area_id = ?',
    [priorityId, areaId]
  );
}

export async function addGoalAssociation(priorityId, goalId) {
  await db.query(
    'INSERT IGNORE INTO priority_goals (priority_id, goal_id) VALUES (?, ?)',
    [priorityId, goalId]
  );
  return getPriorityById(priorityId);
}

export async function removeGoalAssociation(priorityId, goalId) {
  await db.deleteRecord(
    'DELETE FROM priority_goals WHERE priority_id = ? AND goal_id = ?',
    [priorityId, goalId]
  );
}