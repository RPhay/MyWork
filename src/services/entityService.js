import { query as queryPool } from '../database/connectionPool.js';
import { getActiveContextId, setActiveContextId } from './activeContextService.js';
import { ValidationError, NotFoundError } from '../config/errors.js';
import * as entityTypeService from './entityTypeService.js';

/**
 * Generic entity CRUD service (content DB, per-context).
 * All entity instances (work items, priorities, areas, todos, etc.) live in the entities table,
 * discriminated by entity_type_id. Field values live in entity_field_values (EAV pattern).
 */

// Batch-load entities with all their field values
async function attachFieldValues(entityIds) {
  if (entityIds.length === 0) return new Map();

  const values = await queryPool(
    'SELECT * FROM entity_field_values WHERE entity_id IN (?)',
    [entityIds]
  );

  const map = new Map();
  for (const row of values) {
    if (!map.has(row.entity_id)) map.set(row.entity_id, {});
    const entity = map.get(row.entity_id);

    // Find the non-null value across all typed columns
    if (row.value_text !== null) entity[row.field_key] = row.value_text;
    else if (row.value_long !== null) entity[row.field_key] = row.value_long;
    else if (row.value_number !== null) entity[row.field_key] = row.value_number;
    else if (row.value_date !== null) entity[row.field_key] = row.value_date;
    else if (row.value_bool !== null) entity[row.field_key] = row.value_bool === 1;
    else if (row.value_json !== null) entity[row.field_key] = JSON.parse(row.value_json);
  }

  return map;
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
    'INSERT INTO entities (entity_type_id, context_id, title, order_index) VALUES (?, ?, ?, ?)',
    [type.id, contextId, data.title, orderIndex]
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

  return getEntityById(entityId, contextId);
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
