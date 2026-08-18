import { query } from '../database/connectionPool.js';
import { ValidationError, NotFoundError, ConflictError } from '../config/errors.js';

/**
 * Entity type service: CRUD for type definitions (home DB, global, structural).
 * Types are soft-deleted only (deleted_at timestamp) to avoid orphaning entities
 * in content DBs that aren't currently live.
 */

// Get all active (non-deleted) entity types with their fields
export async function getAllEntityTypes() {
  const rows = await query(
    'SELECT * FROM entity_types WHERE deleted_at IS NULL ORDER BY order_index, id'
  );

  // Load fields for each type
  for (const type of rows) {
    const fields = await getEntityTypeFields(type.id);
    type.fields = fields;
  }

  return rows;
}

// Get a single type by ID or slug
export async function getEntityType(idOrSlug) {
  const isId = !isNaN(idOrSlug);
  const rows = await query(
    `SELECT * FROM entity_types WHERE ${isId ? 'id' : 'slug'} = ? AND deleted_at IS NULL`,
    [idOrSlug]
  );
  if (rows.length === 0) throw new NotFoundError(`Entity type not found: ${idOrSlug}`);
  return rows[0];
}

// Get a type with all its fields and relationships (full schema)
export async function getEntityTypeWithSchema(idOrSlug) {
  const type = await getEntityType(idOrSlug);
  const fields = await getEntityTypeFields(type.id);
  const relationships = await getEntityTypeRelationships(type.id);
  return { ...type, fields, relationships };
}

// Create a new entity type
export async function createEntityType(data) {
  if (!data.slug) throw new ValidationError('slug is required');
  if (!data.label) throw new ValidationError('label is required');
  if (!data.label_singular) throw new ValidationError('label_singular is required');
  if (!data.primary_date_field && data.slug !== 'work_item') {
    throw new ValidationError('primary_date_field is required for non-Work-Item types');
  }

  // Normalize slug to kebab-case
  const slug = data.slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  try {
    const [result] = await query(
      'INSERT INTO entity_types (slug, label, label_singular, icon, supports_hierarchy, is_system, primary_date_field, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [slug, data.label, data.label_singular, data.icon || null, data.supports_hierarchy ? 1 : 0, data.is_system ? 1 : 0, data.primary_date_field || null, data.order_index || 0]
    );
    return getEntityType(result.insertId);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw new ConflictError(`slug already exists: ${slug}`);
    throw error;
  }
}

// Update an entity type
export async function updateEntityType(id, data) {
  const type = await getEntityType(id);
  if (type.is_system && data.slug && data.slug !== type.slug) {
    throw new ValidationError('Cannot change slug of a system type');
  }

  const updates = [];
  const values = [];
  const allowedFields = ['label', 'label_singular', 'icon', 'supports_hierarchy', 'primary_date_field', 'order_index'];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(field === 'supports_hierarchy' ? (data[field] ? 1 : 0) : data[field]);
    }
  }

  if (updates.length === 0) return type;

  values.push(id);
  await query(
    `UPDATE entity_types SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
  return getEntityType(id);
}

// Soft-delete an entity type
export async function softDeleteEntityType(id) {
  const type = await getEntityType(id);
  if (type.is_system) throw new ValidationError('Cannot delete system types');

  await query(
    'UPDATE entity_types SET deleted_at = NOW() WHERE id = ?',
    [id]
  );
}

// Get fields for a type
export async function getEntityTypeFields(entityTypeId) {
  const rows = await query(
    'SELECT * FROM entity_type_fields WHERE entity_type_id = ? ORDER BY display_order, id',
    [entityTypeId]
  );
  return rows;
}

// Create a field for a type
export async function createEntityTypeField(entityTypeId, data) {
  if (!data.field_key) throw new ValidationError('field_key is required');
  if (!data.label) throw new ValidationError('label is required');
  if (!data.field_type) throw new ValidationError('field_type is required');

  const validFieldTypes = ['text', 'textarea', 'number', 'date', 'select', 'status', 'checkbox', 'recurrence'];
  if (!validFieldTypes.includes(data.field_type)) {
    throw new ValidationError(`Invalid field_type. Must be one of: ${validFieldTypes.join(', ')}`);
  }

  const fieldKey = data.field_key.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_|_$/g, '');

  try {
    const [result] = await query(
      'INSERT INTO entity_type_fields (entity_type_id, field_key, label, field_type, field_options, required, display_order, show_in_row, is_completion_signal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        entityTypeId,
        fieldKey,
        data.label,
        data.field_type,
        data.field_options ? JSON.stringify(data.field_options) : null,
        data.required ? 1 : 0,
        data.display_order || 0,
        data.show_in_row ? 1 : 0,
        data.is_completion_signal ? 1 : 0
      ]
    );
    const [field] = await query('SELECT * FROM entity_type_fields WHERE id = ?', [result.insertId]);
    return field[0];
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw new ConflictError(`Field already exists: ${fieldKey}`);
    throw error;
  }
}

// Update a field
export async function updateEntityTypeField(fieldId, data) {
  const updates = [];
  const values = [];
  const allowedFields = ['label', 'field_options', 'required', 'display_order', 'show_in_row', 'is_completion_signal'];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates.push(`${field} = ?`);
      if (field === 'field_options') {
        values.push(data[field] ? JSON.stringify(data[field]) : null);
      } else if (['required', 'show_in_row', 'is_completion_signal'].includes(field)) {
        values.push(data[field] ? 1 : 0);
      } else {
        values.push(data[field]);
      }
    }
  }

  if (updates.length === 0) {
    const [field] = await query('SELECT * FROM entity_type_fields WHERE id = ?', [fieldId]);
    return field[0];
  }

  values.push(fieldId);
  await query(
    `UPDATE entity_type_fields SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
  const [field] = await query('SELECT * FROM entity_type_fields WHERE id = ?', [fieldId]);
  return field[0];
}

// Delete a field
export async function deleteEntityTypeField(fieldId) {
  await query('DELETE FROM entity_type_fields WHERE id = ?', [fieldId]);
}

// Get relationship rules for a type
export async function getEntityTypeRelationships(typeId) {
  const rows = await query(
    'SELECT * FROM entity_type_relationships WHERE parent_type_id = ? OR child_type_id = ?',
    [typeId, typeId]
  );
  return rows;
}

// Create a relationship rule
export async function createEntityTypeRelationship(data) {
  if (!data.parent_type_id) throw new ValidationError('parent_type_id is required');
  if (!data.child_type_id) throw new ValidationError('child_type_id is required');
  if (!data.relationship_kind) throw new ValidationError('relationship_kind is required');

  const validKinds = ['hierarchy', 'association', 'recurrence', 'instantiated_from'];
  if (!validKinds.includes(data.relationship_kind)) {
    throw new ValidationError(`Invalid relationship_kind. Must be one of: ${validKinds.join(', ')}`);
  }

  try {
    const [result] = await query(
      'INSERT INTO entity_type_relationships (parent_type_id, child_type_id, relationship_kind, max_children_per_parent, max_parents_per_child) VALUES (?, ?, ?, ?, ?)',
      [data.parent_type_id, data.child_type_id, data.relationship_kind, data.max_children_per_parent || null, data.max_parents_per_child || null]
    );
    const [rule] = await query('SELECT * FROM entity_type_relationships WHERE id = ?', [result.insertId]);
    return rule[0];
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new ConflictError('This relationship rule already exists');
    }
    throw error;
  }
}

// Update a relationship rule
export async function updateEntityTypeRelationship(ruleId, data) {
  const updates = [];
  const values = [];
  const allowedFields = ['max_children_per_parent', 'max_parents_per_child'];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(data[field]);
    }
  }

  if (updates.length === 0) {
    const [rule] = await query('SELECT * FROM entity_type_relationships WHERE id = ?', [ruleId]);
    return rule[0];
  }

  values.push(ruleId);
  await query(
    `UPDATE entity_type_relationships SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
  const [rule] = await query('SELECT * FROM entity_type_relationships WHERE id = ?', [ruleId]);
  return rule[0];
}

// Delete a relationship rule
export async function deleteEntityTypeRelationship(ruleId) {
  await query('DELETE FROM entity_type_relationships WHERE id = ?', [ruleId]);
}

// System type defaults (from phase0-seed-entity-types.js)
const SYSTEM_TYPE_DEFAULTS = {
  work_item: { label: 'Dailies', label_singular: 'Work Item', icon: '⭐', supports_hierarchy: true, primary_date_field: 'date' },
  priority: { label: 'Projects', label_singular: 'Priority', icon: '📍', supports_hierarchy: true, primary_date_field: null },
  area: { label: 'Categories', label_singular: 'Area', icon: '📁', supports_hierarchy: true, primary_date_field: null },
  goal: { label: 'Goals', label_singular: 'Goal', icon: '🎯', supports_hierarchy: false, primary_date_field: null },
  to_do: { label: 'Todos', label_singular: 'Todo', icon: '✅', supports_hierarchy: true, primary_date_field: null },
  task: { label: 'Tasks', label_singular: 'Task', icon: '📂', supports_hierarchy: true, primary_date_field: null },
  ticket: { label: 'Tickets', label_singular: 'Ticket', icon: '🎟️', supports_hierarchy: true, primary_date_field: null },
  idea: { label: 'Brainstorming', label_singular: 'Idea', icon: '💡', supports_hierarchy: true, primary_date_field: null },
  template: { label: 'Templates', label_singular: 'Template', icon: '📋', supports_hierarchy: false, primary_date_field: null }
};

// Revert a system type to its default settings
export async function revertSystemType(id) {
  const type = await getEntityType(id);
  if (!type.is_system) throw new ValidationError('Can only revert system types');

  const defaults = SYSTEM_TYPE_DEFAULTS[type.slug];
  if (!defaults) throw new ValidationError(`No default settings found for type: ${type.slug}`);

  const values = [defaults.label, defaults.label_singular, defaults.icon, defaults.supports_hierarchy ? 1 : 0, defaults.primary_date_field || null, id];
  await query(
    'UPDATE entity_types SET label = ?, label_singular = ?, icon = ?, supports_hierarchy = ?, primary_date_field = ? WHERE id = ?',
    values
  );

  return getEntityType(id);
}
