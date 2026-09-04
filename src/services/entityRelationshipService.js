import { query as queryPool } from '../database/connectionPool.js';
import { getActiveContextId } from './activeContextService.js';
import { ValidationError, NotFoundError } from '../config/errors.js';

/**
 * Generic relationship service: manages all edges between entities.
 * This is the single source of truth for all entity-to-entity links:
 * - Hierarchy (parent/child nesting within types)
 * - Association (linking different types, e.g., work items to priorities)
 * - Recurrence (auto-generated instances from recurrence sources)
 * - InstantiatedFrom (e.g., work items created from templates)
 *
 * CRITICAL: This is the ONLY service allowed to write to entity_relationships.
 * All writes MUST validate against entity_type_relationships rules.
 */

// Get all relationships for an entity (incoming and outgoing)
export async function getEntityRelationships(entityId, contextId = null, kind = null) {
  if (!contextId) contextId = await getActiveContextId();

  let query = 'SELECT * FROM entity_relationships WHERE context_id = ? AND (parent_entity_id = ? OR child_entity_id = ?)';
  const params = [contextId, entityId, entityId];

  if (kind) {
    query += ' AND relationship_kind = ?';
    params.push(kind);
  }

  const relationships = await queryPool(query, params);
  return relationships;
}

// Every edge of a kind whose PARENT is of this type - used by the generic tree
// renderer, which otherwise has no way to know parent/child links (entities
// carries no parent column; that is entity_relationships' job) without an N+1
// query per row.
//
// This used to require child and parent to share a type, back when nesting was
// always same-type. Templates broke that assumption: a template may contain any
// editable type, so its children were created correctly and then filtered out
// of the very query the tree renders from - the row simply never appeared.
// Which types may nest in which is enforced at write time by
// validateRelationship, so there is nothing for this read to re-police.
/**
 * Every edge in the trees this type's rows own - at any depth, whatever type
 * the nodes are.
 *
 * This used to filter on the PARENT's type, which was only ever correct for a
 * type that contains its own kind. A template holding a Project returned the
 * template->project edge and stopped: the project's own children came back from
 * /contents as entities, but with no edge to place them by, so a row dropped
 * into a template arrived stripped of its tree. Same for anything else that
 * accepts foreign children.
 *
 * For an ordinary type the result is unchanged - its descendants are its own
 * kind, so "parent is of this type" and "parent is in the subtree" describe the
 * same edges.
 */
export async function getRelationshipsForType(typeSlug, contextId = null, kind = 'hierarchy') {
  if (!contextId) contextId = await getActiveContextId();

  const roots = await queryPool(
    `SELECT e.id FROM entities e
     JOIN entity_types et ON et.id = e.entity_type_id
     WHERE et.slug = ? AND e.context_id = ? AND e.deleted_at IS NULL`,
    [typeSlug, contextId]
  );
  if (roots.length === 0) return [];

  const edges = [];
  const seenParents = new Set();
  let frontier = roots.map(r => r.id);

  // Walked rather than joined: the depth is not known, and a single query
  // cannot express "and their children, and theirs" portably.
  while (frontier.length > 0) {
    const placeholders = frontier.map(() => '?').join(', ');
    const rows = await queryPool(
      `SELECT er.parent_entity_id, er.child_entity_id, er.order_index
       FROM entity_relationships er
       JOIN entities child_e ON child_e.id = er.child_entity_id
       WHERE er.context_id = ? AND er.relationship_kind = ?
         AND er.parent_entity_id IN (${placeholders})
         AND child_e.deleted_at IS NULL
       ORDER BY er.parent_entity_id, er.order_index, er.id`,
      [contextId, kind, ...frontier]
    );

    frontier.forEach(id => seenParents.add(id));
    edges.push(...rows);

    // A cycle would otherwise loop forever; only unvisited children go on.
    frontier = [...new Set(rows.map(r => r.child_entity_id))].filter(id => !seenParents.has(id));
  }

  return edges;
}

// Get children of an entity (for hierarchy or association)
export async function getEntityChildren(parentEntityId, contextId = null, kind = 'hierarchy') {
  if (!contextId) contextId = await getActiveContextId();

  // Deleted children excluded - none of this function's callers (the
  // children API route, dailyTemplateService's associationsFor,
  // instantiateTemplate) want a soft-deleted row treated as still there; the
  // sibling getRelationshipsForType() above already filters the same way.
  const relationships = await queryPool(
    'SELECT er.*, e.title, e.entity_type_id FROM entity_relationships er JOIN entities e ON e.id = er.child_entity_id AND e.deleted_at IS NULL WHERE er.parent_entity_id = ? AND er.context_id = ? AND er.relationship_kind = ? ORDER BY er.order_index, er.id',
    [parentEntityId, contextId, kind]
  );

  return relationships;
}

// Get parents of an entity
export async function getEntityParents(childEntityId, contextId = null, kind = 'hierarchy') {
  if (!contextId) contextId = await getActiveContextId();

  const relationships = await queryPool(
    'SELECT er.*, e.title, e.entity_type_id FROM entity_relationships er JOIN entities e ON e.id = er.parent_entity_id WHERE er.child_entity_id = ? AND er.context_id = ? AND er.relationship_kind = ? ORDER BY er.id',
    [childEntityId, contextId, kind]
  );

  return relationships;
}

// Every entity below `entityId` in the hierarchy. Breadth-first, and tolerant
// of a pre-existing cycle in the data (the `seen` set doubles as the guard).
async function getDescendantIds(entityId, contextId) {
  const seen = new Set();
  const queue = [Number(entityId)];

  while (queue.length > 0) {
    const currentId = queue.shift();
    const children = await queryPool(
      "SELECT child_entity_id FROM entity_relationships WHERE parent_entity_id = ? AND context_id = ? AND relationship_kind = 'hierarchy'",
      [currentId, contextId]
    );
    for (const child of children) {
      if (seen.has(child.child_entity_id)) continue;
      seen.add(child.child_entity_id);
      queue.push(child.child_entity_id);
    }
  }

  return seen;
}

// Validate a relationship against the type rules
async function validateRelationship(parentEntityId, childEntityId, relationshipKind, contextId) {
  // Get entity type IDs
  const parentRows = await queryPool('SELECT entity_type_id FROM entities WHERE id = ? AND context_id = ?', [parentEntityId, contextId]);
  const childRows = await queryPool('SELECT entity_type_id FROM entities WHERE id = ? AND context_id = ?', [childEntityId, contextId]);

  if (!parentRows[0] || !childRows[0]) throw new NotFoundError('Entity not found');

  const parentTypeId = parentRows[0].entity_type_id;
  const childTypeId = childRows[0].entity_type_id;

  // Check if this relationship type is allowed
  const rules = await queryPool(
    'SELECT * FROM entity_type_relationships WHERE parent_type_id = ? AND child_type_id = ? AND relationship_kind = ?',
    [parentTypeId, childTypeId, relationshipKind]
  );

  if (rules.length === 0) {
    throw new ValidationError(`Relationship not allowed: ${relationshipKind} from parent type ${parentTypeId} to child type ${childTypeId}`);
  }

  // Nothing stopped an item being dragged into its own descendant, which made
  // a node its own ancestor. Nothing detected it either - the cycle only
  // surfaced later, as "Maximum call stack size exceeded" out of
  // hierarchyPath.js#buildPathMap, taking Dailies, Projects and Reporting down
  // together. Reject the edge at the source. (priorityService.js#updatePriority
  // has the same guard for the legacy parent_id column.)
  if (relationshipKind === 'hierarchy') {
    if (Number(parentEntityId) === Number(childEntityId)) {
      throw new ValidationError('An item cannot be its own parent');
    }
    const descendants = await getDescendantIds(childEntityId, contextId);
    if (descendants.has(Number(parentEntityId))) {
      throw new ValidationError('Cannot move an item inside one of its own descendants');
    }
  }

  const rule = rules[0];

  // Check cardinality constraints
  if (rule.max_parents_per_child) {
    const currentParents = await queryPool(
      'SELECT COUNT(*) as cnt FROM entity_relationships WHERE child_entity_id = ? AND relationship_kind = ? AND context_id = ?',
      [childEntityId, relationshipKind, contextId]
    );
    if (currentParents[0].cnt >= rule.max_parents_per_child) {
      throw new ValidationError(`Entity can have at most ${rule.max_parents_per_child} parent(s) for ${relationshipKind} relationships`);
    }
  }

  if (rule.max_children_per_parent) {
    const currentChildren = await queryPool(
      'SELECT COUNT(*) as cnt FROM entity_relationships WHERE parent_entity_id = ? AND relationship_kind = ? AND context_id = ?',
      [parentEntityId, relationshipKind, contextId]
    );
    if (currentChildren[0].cnt >= rule.max_children_per_parent) {
      throw new ValidationError(`Entity can have at most ${rule.max_children_per_parent} child(ren) for ${relationshipKind} relationships`);
    }
  }

  return rule;
}

// Add a relationship edge
export async function addRelationship(parentEntityId, childEntityId, relationshipKind, contextId = null, isGenerated = false) {
  if (!contextId) contextId = await getActiveContextId();

  // Validate against type rules
  await validateRelationship(parentEntityId, childEntityId, relationshipKind, contextId);

  // Check for duplicates
  const existing = await queryPool(
    'SELECT * FROM entity_relationships WHERE parent_entity_id = ? AND child_entity_id = ? AND relationship_kind = ? AND context_id = ?',
    [parentEntityId, childEntityId, relationshipKind, contextId]
  );

  if (existing.length > 0) {
    return existing[0]; // Already exists
  }

  const result = await queryPool(
    'INSERT INTO entity_relationships (context_id, parent_entity_id, child_entity_id, relationship_kind, is_generated) VALUES (?, ?, ?, ?, ?)',
    [contextId, parentEntityId, childEntityId, relationshipKind, isGenerated ? 1 : 0]
  );

  const relationship = await queryPool(
    'SELECT * FROM entity_relationships WHERE id = ?',
    [result.insertId]
  );

  return relationship[0];
}

// Remove a relationship edge
export async function removeRelationship(parentEntityId, childEntityId, relationshipKind, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();

  const result = await queryPool(
    'DELETE FROM entity_relationships WHERE parent_entity_id = ? AND child_entity_id = ? AND relationship_kind = ? AND context_id = ?',
    [parentEntityId, childEntityId, relationshipKind, contextId]
  );

  return result.affectedRows > 0;
}

// Cascade delete: remove all relationships and descendants for an entity
export async function cascadeDeleteEntity(entityId, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();

  // BFS to find all descendants
  const descendants = new Set([entityId]);
  const queue = [entityId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    const children = await queryPool(
      'SELECT child_entity_id FROM entity_relationships WHERE parent_entity_id = ? AND context_id = ? AND relationship_kind = ?',
      [currentId, contextId, 'hierarchy']
    );

    for (const child of children) {
      if (!descendants.has(child.child_entity_id)) {
        descendants.add(child.child_entity_id);
        queue.push(child.child_entity_id);
      }
    }
  }

  // Delete all edges involving descendants (manual cascade, since FK is NO ACTION)
  for (const descendantId of descendants) {
    await queryPool(
      'DELETE FROM entity_relationships WHERE (parent_entity_id = ? OR child_entity_id = ?) AND context_id = ?',
      [descendantId, descendantId, contextId]
    );
  }

  // Entities themselves are deleted by their own FK cascade delete
  return Array.from(descendants);
}

// Reorder siblings (same parent)
export async function reorderSiblings(parentEntityId, orderedChildIds, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();

  for (let i = 0; i < orderedChildIds.length; i++) {
    await queryPool(
      'UPDATE entity_relationships SET order_index = ? WHERE parent_entity_id = ? AND child_entity_id = ? AND context_id = ?',
      [i, parentEntityId, orderedChildIds[i], contextId]
    );
  }
}
