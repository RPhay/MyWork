import * as db from '../database/connectionPool.js';
import { NotFoundError, ValidationError } from '../config/errors.js';
import { buildPathMap } from '../utils/hierarchyPath.js';
import * as entityService from './entityService.js';
import * as entityRelationshipService from './entityRelationshipService.js';
import { getActiveContextId } from './activeContextService.js';

async function attachAssociations(priorities) {
  if (priorities.length === 0) return priorities;

  const ids = priorities.map(p => p.id);
  const placeholders = ids.map(() => '?').join(',');

  const [categoryRows, goalRows, allCategories] = await Promise.all([
    // Areas and goals are entities now (Phases 2-3); priority_areas /
    // priority_goals bridge the legacy priorities table to them. `title` is
    // aliased to `name` to keep the response shape the frontend expects.
    db.query(
      `SELECT pa.priority_id, a.id, a.title AS name
       FROM priority_areas pa
       JOIN entities a ON pa.area_id = a.id
       WHERE pa.priority_id IN (${placeholders})`,
      ids
    ),
    db.query(
      `SELECT pg.priority_id, g.id, g.title AS name
       FROM priority_goals pg
       JOIN entities g ON pg.goal_id = g.id
       WHERE pg.priority_id IN (${placeholders})`,
      ids
    ),
    entityService.getEntityPathLookup('category'),
  ]);

  const categoryPaths = buildPathMap(allCategories);

  return priorities.map(priority => ({
    ...priority,
    categories: categoryRows
      .filter(r => r.priority_id === priority.id)
      .map(r => ({ id: r.id, name: r.name, path: categoryPaths.get(r.id) || r.name })),
    goals: goalRows
      .filter(r => r.priority_id === priority.id)
      .map(r => ({ id: r.id, name: r.name })),
  }));
}

// Projects moved onto the generic entity engine (Phase 4), so the storage is
// `entities` + `entity_field_values` + `entity_relationships`. Everything below
// keeps the old row shape - flat `notes`/`status` fields and a synthesized
// `parent_id` - because several frontend files still read priorities that way
// (Priority Board, Dailies, Reporting, Templates, Brainstorming and two
// editors). Nothing about /api/priorities changed for them.
async function toPriorityRows(entities, contextId) {
  if (entities.length === 0) return [];

  const hierarchy = await db.query(
    `SELECT er.parent_entity_id, er.child_entity_id
     FROM entity_relationships er
     JOIN entities c ON c.id = er.child_entity_id
     JOIN entity_types t ON t.id = c.entity_type_id
     WHERE t.slug = 'priority' AND er.relationship_kind = 'hierarchy' AND er.context_id = ?`,
    [contextId]
  );
  const parentOf = new Map(hierarchy.map(r => [r.child_entity_id, r.parent_entity_id]));

  return entities.map(e => ({
    id: e.id,
    title: e.title,
    parent_id: parentOf.get(e.id) ?? null,
    order_index: e.order_index,
    context_id: e.context_id,
    notes: e.fields?.notes ?? null,
    status: e.fields?.status ?? 'Not Started',
    source_id: e.fields?.source_id ?? null,
    created_at: e.created_at,
    updated_at: e.updated_at,
  }));
}

export async function getAllPriorities(contextId) {
  if (!contextId) contextId = await getActiveContextId();
  const entities = await entityService.getAllEntities('priority', contextId);
  const rows = await toPriorityRows(entities, contextId);
  rows.sort((a, b) => a.order_index - b.order_index);
  return attachAssociations(rows);
}

export async function getPriorityById(id) {
  const contextId = await getActiveContextId();
  let entity;
  try {
    entity = await entityService.getEntityById(Number(id), contextId);
  } catch {
    throw new NotFoundError('Priority not found');
  }
  const [row] = await toPriorityRows([entity], contextId);
  const [withAssociations] = await attachAssociations([row]);
  return withAssociations;
}

async function getDescendantIds(id) {
  const contextId = await getActiveContextId();
  return entityService.getDescendantIds(Number(id), contextId);
}

async function setAreaAssociations(priorityId, categoryIds) {
  await db.query('DELETE FROM priority_areas WHERE priority_id = ?', [priorityId]);
  for (const categoryId of categoryIds) {
    await db.insert('INSERT INTO priority_areas (priority_id, area_id) VALUES (?, ?)', [priorityId, categoryId]);
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
  if (!contextId) contextId = await getActiveContextId();

  const entity = await entityService.createEntity('priority', {
    title,
    fields: {
      notes: notes ?? null,
      status: status || 'Not Started',
      source_id: source_id || null,
    },
  }, contextId);

  const priorityId = entity.id;

  // Hierarchy is an edge, not a column. addRelationship validates it against
  // the type rules and rejects cycles.
  if (parent_id) {
    await entityRelationshipService.addRelationship(Number(parent_id), priorityId, 'hierarchy', contextId);
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
  const contextId = await getActiveContextId();
  const update = {};
  const fields = {};

  if (data.title !== undefined) {
    if (!data.title) {
      throw new ValidationError('Priority title is required');
    }
    update.title = data.title;
  }

  if (data.source_id !== undefined) fields.source_id = data.source_id || null;
  if (data.notes !== undefined) fields.notes = data.notes ?? null;
  if (data.status !== undefined) fields.status = data.status || 'Not Started';

  if (Object.keys(fields).length > 0) update.fields = fields;
  if (Object.keys(update).length > 0) {
    await entityService.updateEntity(Number(id), update, contextId);
  }

  // Reparenting is an edge swap. The cycle checks live in
  // entityRelationshipService now, but keep the project-specific wording.
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

    const currentParents = await entityRelationshipService.getEntityParents(Number(id), contextId, 'hierarchy');
    for (const rel of currentParents) {
      await entityRelationshipService.removeRelationship(rel.parent_entity_id, Number(id), 'hierarchy', contextId);
    }
    if (parentId) {
      await entityRelationshipService.addRelationship(Number(parentId), Number(id), 'hierarchy', contextId);
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
  const contextId = await getActiveContextId();
  // Cascade the subtree first: entity_relationships FKs are NO ACTION, so the
  // descendants and their edges have to go explicitly (same pattern the
  // generic entity delete route uses).
  const descendants = await entityRelationshipService.cascadeDeleteEntity(Number(id), contextId);
  for (const entityId of descendants) {
    await entityService.deleteEntity(entityId, contextId).catch(() => {});
  }
  return true;
}

const VALID_STATUSES = ['Not Started', 'In Progress', 'Complete'];

export async function updatePriorityStatus(id, status) {
  if (!VALID_STATUSES.includes(status)) {
    throw new ValidationError('Invalid status value');
  }

  await entityService.updateEntity(Number(id), { fields: { status } }, await getActiveContextId());
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
  const contextId = await getActiveContextId();

  if (draggedId && updates && Object.keys(updates).length > 0) {
    const fields = {};

    if (updates.status !== undefined) {
      if (!VALID_STATUSES.includes(updates.status)) {
        throw new ValidationError('Invalid status value');
      }
      fields.status = updates.status;
    }

    if (Object.keys(fields).length > 0) {
      await entityService.updateEntity(Number(draggedId), { fields }, contextId);
    }
  }

  // order_index stays a single global ranking across top-level projects, shared
  // by the Projects tree, the Priority Board and Weekly Priorities.
  await entityService.reorderEntitiesBySiblings(orderedIds.map(Number), contextId);

  return getAllPriorities(contextId);
}

// Single add/remove association endpoints, used by dragging a category or goal
// chip from the Projects page's right panel onto a project/sub-project - unlike
// setAreaAssociations/setGoalAssociations (full replace, used by the edit form),
// these only add or remove the one association being dragged.
export async function addCategoryAssociation(priorityId, categoryId) {
  await db.query(
    'INSERT IGNORE INTO priority_areas (priority_id, area_id) VALUES (?, ?)',
    [priorityId, categoryId]
  );
  return getPriorityById(priorityId);
}

export async function removeCategoryAssociation(priorityId, categoryId) {
  await db.deleteRecord(
    'DELETE FROM priority_areas WHERE priority_id = ? AND area_id = ?',
    [priorityId, categoryId]
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

// getLinksForPriority / addLinkToPriority removed: Projects carries links as a
// generic `links` field on the type now (see UI_STANDARDS.md), so the
// priority_links table and its endpoints are no longer read by anything.
