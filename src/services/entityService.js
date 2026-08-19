import { query as queryPool } from '../database/connectionPool.js';
import { getActiveContextId, setActiveContextId } from './activeContextService.js';
import { ValidationError, NotFoundError } from '../config/errors.js';
import * as entityTypeService from './entityTypeService.js';
import * as entityRelationshipService from './entityRelationshipService.js';
import { getNextOccurrenceDate, generateWorkItemsForDate } from './recurrenceService.js';

/**
 * Generic entity CRUD service (content DB, per-context).
 * All entity instances (work items, priorities, areas, todos, etc.) live in the entities table,
 * discriminated by entity_type_id. Field values live in entity_field_values (EAV pattern).
 */

// Batch-load entities with all their field values
async function attachFieldValues(entityIds) {
  if (entityIds.length === 0) return new Map();

  // One placeholder per id, not `IN (?)` with an array: connectionPool.js runs
  // statements through mysql2's execute() (prepared statements), which does not
  // expand an array into an IN list the way query() does. `IN (?)` silently
  // matched nothing, so every entity came back with empty `fields` no matter
  // what was stored.
  const placeholders = entityIds.map(() => '?').join(', ');
  const values = await queryPool(
    `SELECT * FROM entity_field_values WHERE entity_id IN (${placeholders})`,
    entityIds
  );

  const map = new Map();
  for (const row of values) {
    if (!map.has(row.entity_id)) map.set(row.entity_id, {});
    const entity = map.get(row.entity_id);

    // Find the non-null value across all typed columns
    if (row.value_text !== null) entity[row.field_key] = row.value_text;
    else if (row.value_long !== null) entity[row.field_key] = row.value_long;
    // value_number is DECIMAL(15,2), which mysql2 returns as a STRING - a year
    // came back as "2026.00" and rendered that way in its column. Coerce to a
    // real number so display, sorting and sum roll-ups all get one.
    else if (row.value_number !== null) entity[row.field_key] = Number(row.value_number);
    else if (row.value_date !== null) entity[row.field_key] = row.value_date;
    else if (row.value_bool !== null) entity[row.field_key] = row.value_bool === 1;
    // mysql2 already parses JSON columns into objects/arrays, so only parse
    // when the driver handed back a raw string (as MSSQL's NVARCHAR does).
    // Blindly parsing threw "Unexpected token 'o', \"[object Obj\"..." on every
    // JSON-valued field - which is every `links` and `recurrence` value.
    else if (row.value_json !== null) {
      entity[row.field_key] = typeof row.value_json === 'string'
        ? JSON.parse(row.value_json)
        : row.value_json;
    }
  }

  return map;
}

// The junction tables that point at entities.id, and the column that does so.
// Kept in sync with the "Legacy <-> entity association bridge" block in
// mysqlSchema.js / mssqlSchema.js.
const BRIDGE_JUNCTION_COLUMNS = [
  ['work_area_associations', 'area_id'],
  ['work_goal_associations', 'goal_id'],
  ['work_idea_associations', 'idea_id'],
  ['priority_areas', 'area_id'],
  ['priority_goals', 'goal_id'],
  ['template_areas', 'area_id'],
  ['template_goals', 'goal_id'],
];

// Legacy bridge: areas, goals and ideas are entities now, but workItemService,
// priorityService and workItemTemplateService still reach them through legacy
// junction tables and hand the result to hierarchyPath.js#buildPathMap, which
// wants the old self-referencing row shape ({id, <label>, parent_id}).
// `entities` has no parent column - hierarchy lives in entity_relationships -
// so the parent is joined back in here and aliased to match.
//
// Deliberately not context-filtered, matching the `SELECT id, name, parent_id
// FROM areas` it replaces: entity ids are globally unique, and a path only
// needs to resolve, not to be scoped.
export async function getEntityPathLookup(entityTypeSlug) {
  return queryPool(
    `SELECT e.id, e.title AS name, er.parent_entity_id AS parent_id
     FROM entities e
     JOIN entity_types et ON et.id = e.entity_type_id
     LEFT JOIN entity_relationships er
       ON er.child_entity_id = e.id AND er.relationship_kind = 'hierarchy'
     WHERE et.slug = ? AND et.deleted_at IS NULL`,
    [entityTypeSlug]
  );
}

// Get all entities of a type in the current context
export async function getAllEntities(entityTypeSlug, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();

  const type = await entityTypeService.getEntityType(entityTypeSlug);

  const entities = await queryPool(
    'SELECT * FROM entities WHERE entity_type_id = ? AND context_id = ? ORDER BY order_index, id',
    [type.id, contextId]
  );

  const fieldMap = await attachFieldValues(entities.map(e => e.id));
  for (const entity of entities) {
    entity.fields = fieldMap.get(entity.id) || {};
  }

  return entities;
}

// Get a single entity by ID
export async function getEntityById(entityId, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();

  const rows = await queryPool(
    'SELECT * FROM entities WHERE id = ? AND context_id = ?',
    [entityId, contextId]
  );

  if (rows.length === 0) throw new NotFoundError(`Entity not found: ${entityId}`);

  const entity = rows[0];
  const fieldMap = await attachFieldValues([entity.id]);
  entity.fields = fieldMap.get(entity.id) || {};

  return entity;
}

// Create a new entity
export async function createEntity(entityTypeSlug, data, contextId = null) {
  if (!data.title) throw new ValidationError('title is required');
  if (!contextId) contextId = await getActiveContextId();

  const type = await entityTypeService.getEntityType(entityTypeSlug);
  const fields = await entityTypeService.getEntityTypeFields(type.id);

  // Validate required fields
  for (const field of fields) {
    if (field.required && (data.fields?.[field.field_key] === undefined || data.fields[field.field_key] === null || data.fields[field.field_key] === '')) {
      throw new ValidationError(`${field.label} is required`);
    }
  }

  // Compute order_index if not provided
  let orderIndex = data.order_index;
  if (orderIndex === undefined) {
    const maxResult = await queryPool(
      'SELECT MAX(order_index) as max_idx FROM entities WHERE entity_type_id = ? AND context_id = ?',
      [type.id, contextId]
    );
    orderIndex = (maxResult[0].max_idx || 0) + 1;
  }

  const result = await queryPool(
    'INSERT INTO entities (entity_type_id, context_id, title, order_index, is_folder) VALUES (?, ?, ?, ?, ?)',
    [type.id, contextId, data.title, orderIndex, data.is_folder ? 1 : 0]
  );

  const entity = await getEntityById(result.insertId, contextId);

  // Upsert field values
  if (data.fields) {
    for (const [fieldKey, value] of Object.entries(data.fields)) {
      if (value !== null && value !== undefined && value !== '') {
        await setEntityFieldValue(entity.id, fieldKey, value, contextId);
      }
    }
    // Reload after setting fields
    return getEntityById(entity.id, contextId);
  }

  return entity;
}

// Update an entity
export async function updateEntity(entityId, data, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();

  const entity = await getEntityById(entityId, contextId);

  const updates = [];
  const values = [];

  if (data.title !== undefined) {
    updates.push('title = ?');
    values.push(data.title);
  }
  if (data.order_index !== undefined) {
    updates.push('order_index = ?');
    values.push(data.order_index);
  }
  if (data.is_folder !== undefined) {
    updates.push('is_folder = ?');
    values.push(data.is_folder ? 1 : 0);
  }

  if (updates.length > 0) {
    values.push(entityId);
    await queryPool(
      `UPDATE entities SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }

  // Update field values
  if (data.fields) {
    for (const [fieldKey, value] of Object.entries(data.fields)) {
      if (value === null || value === undefined || value === '') {
        await queryPool(
          'DELETE FROM entity_field_values WHERE entity_id = ? AND field_key = ?',
          [entityId, fieldKey]
        );
      } else {
        await setEntityFieldValue(entityId, fieldKey, value, contextId);
      }
    }
  }

  const updatedEntity = await getEntityById(entityId, contextId);

  // Check for completion signal and trigger recurrence generation
  try {
    const typeSchema = await entityTypeService.getEntityTypeWithSchema(entity.entity_type_id);
    const completionSignalField = typeSchema.fields?.find(f => f.is_completion_signal);

    if (completionSignalField && data.fields?.[completionSignalField.field_key]) {
      const newValue = data.fields[completionSignalField.field_key];
      const doneValues = completionSignalField.field_options?.doneValues || [];

      // If status transitioned to a done value, trigger recurrence
      if (doneValues.includes(newValue)) {
        await triggerRecurrenceForCompletedEntity(updatedEntity, contextId);
      }
    }
  } catch (error) {
    // Log error but don't fail the update
    console.warn('Error checking recurrence for entity:', error.message);
  }

  return updatedEntity;
}

// Generate next recurrence when an entity is completed
async function triggerRecurrenceForCompletedEntity(entity, contextId) {
  try {
    // Find any recurrence relationship pointing to this entity
    const relationships = await queryPool(
      'SELECT * FROM entity_relationships WHERE child_entity_id = ? AND relationship_kind = ? AND context_id = ?',
      [entity.id, 'recurrence', contextId]
    );

    if (relationships.length === 0) return;

    for (const rel of relationships) {
      const sourceEntity = await getEntityById(rel.parent_entity_id, contextId);
      const typeSchema = await entityTypeService.getEntityTypeWithSchema(sourceEntity.entity_type_id);
      const recurrenceField = typeSchema.fields?.find(f => f.field_type === 'recurrence');

      if (recurrenceField && sourceEntity.fields?.[recurrenceField.field_key]) {
        const recurrence = sourceEntity.fields[recurrenceField.field_key];
        if (!recurrence || !recurrence.enabled) return;

        // Calculate next occurrence date
        const today = entity.fields?.date ? new Date(entity.fields.date) : new Date();
        const nextDate = getNextOccurrenceDate(recurrence, today);

        if (nextDate) {
          // For work items, use generateWorkItemsForDate to maintain compatibility
          if (typeSchema.slug === 'work_item') {
            // generateWorkItemsForDate will create work items for this date from recurring todos/tasks
            await generateWorkItemsForDate(nextDate, contextId);
          } else {
            // For other entity types, create a new entity directly
            const fieldsCopy = { ...sourceEntity.fields };
            if (typeSchema.primary_date_field) {
              fieldsCopy[typeSchema.primary_date_field] = nextDate;
            }

            const nextEntity = await createEntity(typeSchema.slug, {
              title: sourceEntity.title,
              fields: fieldsCopy
            }, contextId);

            // Link new entity to recurrence source with generated flag
            await entityRelationshipService.addRelationship(
              rel.parent_entity_id,
              nextEntity.id,
              'recurrence',
              contextId,
              true // isGenerated = true
            );
          }
        }
      }
    }
  } catch (error) {
    console.warn('Error generating next recurrence:', error.message);
  }
}

// Set a single field value
async function setEntityFieldValue(entityId, fieldKey, value, contextId) {
  // Determine which value column to use based on the field type
  // (In a real implementation, we'd fetch the field definition to know the type)
  // For now, we'll do a simple type detection

  let valueColumns = { value_text: null, value_long: null, value_number: null, value_date: null, value_bool: null, value_json: null };

  if (typeof value === 'boolean') {
    valueColumns.value_bool = value ? 1 : 0;
  } else if (typeof value === 'number') {
    valueColumns.value_number = value;
  } else if (value instanceof Date || /^\d{4}-\d{2}-\d{2}/.test(value)) {
    valueColumns.value_date = value;
  } else if (typeof value === 'object') {
    valueColumns.value_json = JSON.stringify(value);
  } else {
    // String/text — store as value_text if short, value_long if long
    const strValue = String(value);
    if (strValue.length > 500) {
      valueColumns.value_long = strValue;
    } else {
      valueColumns.value_text = strValue;
    }
  }

  await queryPool(
    'INSERT INTO entity_field_values (entity_id, field_key, value_text, value_long, value_number, value_date, value_bool, value_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE value_text = VALUES(value_text), value_long = VALUES(value_long), value_number = VALUES(value_number), value_date = VALUES(value_date), value_bool = VALUES(value_bool), value_json = VALUES(value_json)',
    [entityId, fieldKey, valueColumns.value_text, valueColumns.value_long, valueColumns.value_number, valueColumns.value_date, valueColumns.value_bool, valueColumns.value_json]
  );
}

// Delete an entity (cascade handled by DB FK)
export async function deleteEntity(entityId, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();

  const entity = await getEntityById(entityId, contextId);

  // Clear the legacy<->entity association bridge first. MySQL would cascade
  // these, but the MSSQL schema has to declare the entity side ON DELETE NO
  // ACTION (two cascading FKs into one junction hit "multiple cascade paths"),
  // so the delete would fail there. Doing it explicitly keeps both engines
  // behaving identically. Retire this alongside the bridge tables themselves.
  for (const [table, column] of BRIDGE_JUNCTION_COLUMNS) {
    await queryPool(`DELETE FROM ${table} WHERE ${column} = ?`, [entityId]);
  }

  await queryPool('DELETE FROM entities WHERE id = ?', [entityId]);
  return entity;
}

// Reorder siblings (same parent)
export async function reorderEntitiesBySiblings(orderedIds, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();

  for (let i = 0; i < orderedIds.length; i++) {
    await queryPool(
      'UPDATE entities SET order_index = ? WHERE id = ? AND context_id = ?',
      [i, orderedIds[i], contextId]
    );
  }
}

// Get descendant IDs (for hierarchy types)
export async function getDescendantIds(parentEntityId, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();

  const descendants = new Set([parentEntityId]);
  const queue = [parentEntityId];

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

  return Array.from(descendants);
}
