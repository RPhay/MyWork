import { query } from '../database/connectionPool.js';
import { ValidationError, NotFoundError, ConflictError } from '../config/errors.js';
import { SYSTEM_ENTITY_TYPES } from '../database/systemEntityTypes.js';
// A captured snapshot of a working configuration - see revertSystemType.
import typeDefaults from '../database/typeDefaults.json' with { type: 'json' };

/**
 * Entity type service: CRUD for type definitions (home DB, global, structural).
 * Types are soft-deleted only (deleted_at timestamp) to avoid orphaning entities
 * in content DBs that aren't currently live.
 */

// Every field type the schema allows. MUST stay identical to the field_type
// ENUM in mysqlSchema.js / mssqlSchema.js.
//
// This list previously lived inline in createEntityTypeField and had drifted:
// it omitted 'duration' and 'timebox', so creating a field of either was
// rejected as invalid while 23 such fields already existed and were in daily
// use (Worked Time and Time Box are on every type). Meanwhile
// updateEntityTypeField validated nothing at all, so the same value the create
// path refused could be written by an update. One list, both paths, and
// entity-type-integrity.spec.js compares it against the ENUM and against the
// type editor's <option> list so a future drift fails a test rather than
// corrupting a save.
export const VALID_FIELD_TYPES = [
  'text', 'textarea', 'number', 'date', 'url', 'links', 'select', 'radio',
  'checkbox', 'status', 'priority', 'recurrence', 'emoji', 'emojis',
  'duration', 'timebox',
  // Dailies carries these on every work item, made available to any type:
  // your own notes, and whether AI was used on it at all.
  'notes', 'worked_with_claude',
];

// Get all active (non-deleted) entity types with their fields
export async function getAllEntityTypes(category = null) {
  let sql = 'SELECT * FROM entity_types WHERE deleted_at IS NULL';
  const params = [];

  if (category) {
    sql += ' AND type_category = ?';
    params.push(category);
  }

  sql += ' ORDER BY order_index, id';
  const rows = await query(sql, params);

  // Load fields for each type
  for (const type of rows) {
    const fields = await getEntityTypeFields(type.id);
    type.fields = fields;
  }

  return rows;
}

// Get entity types by category
export async function getEntityTypesByCategory(category) {
  return getAllEntityTypes(category);
}

// Get all editable types (user-created and system types)
export async function getEditableEntityTypes() {
  return getEntityTypesByCategory('editable');
}

// Get all template types
export async function getTemplateEntityTypes() {
  return getEntityTypesByCategory('template');
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

// A type that says it supports hierarchy needs the rule that actually permits
// the edge: entityRelationshipService rejects any nesting that no
// entity_type_relationships row allows. Without it a page renders a tree whose
// every drag-to-nest is refused - the flag is set, but nothing can move.
async function ensureSelfNestingRule(typeId) {
  const existing = await query(
    "SELECT id FROM entity_type_relationships WHERE parent_type_id = ? AND child_type_id = ? AND relationship_kind = 'hierarchy'",
    [typeId, typeId]
  );
  if (existing.length > 0) return;
  await query(
    "INSERT INTO entity_type_relationships (parent_type_id, child_type_id, relationship_kind) VALUES (?, ?, 'hierarchy')",
    [typeId, typeId]
  );
}

/**
 * A template may contain any editable type. That rule is enumerated as a row
 * per child type, which means it can only ever list the types that existed when
 * it was written - so a type created afterwards could not be dropped into a
 * template at all, silently, because the drop is gated on these rules.
 *
 * Adding the row when the type is created is what makes "any editable type"
 * true rather than "the eight we happened to ship with".
 */
async function ensureContainerRules(typeId, typeCategory) {
  if (typeCategory && typeCategory !== 'editable') return;

  const containers = await query(
    "SELECT id FROM entity_types WHERE slug = 'template' AND deleted_at IS NULL"
  );
  for (const container of containers) {
    if (container.id === typeId) continue;
    const existing = await query(
      "SELECT id FROM entity_type_relationships WHERE parent_type_id = ? AND child_type_id = ? AND relationship_kind = 'hierarchy'",
      [container.id, typeId]
    );
    if (existing.length > 0) continue;
    await query(
      "INSERT INTO entity_type_relationships (parent_type_id, child_type_id, relationship_kind) VALUES (?, ?, 'hierarchy')",
      [container.id, typeId]
    );
  }
}

// Create a new entity type
export async function createEntityType(data) {
  if (!data.slug) throw new ValidationError('slug is required');
  if (!data.label) throw new ValidationError('label is required');
  if (!data.label_singular) throw new ValidationError('label_singular is required');
  // primary_date_field is optional. It used to be required for everything
  // except work_item, which contradicted the seeded types - priority, area,
  // goal, to_do, task, ticket, idea and template all carry null - so a
  // user-created type was held to a stricter rule than any built-in one, and
  // creating a type from Settings failed outright.

  const validCategories = ['editable', 'template', 'external'];
  const typeCategory = data.type_category || 'editable';
  if (!validCategories.includes(typeCategory)) {
    throw new ValidationError(`invalid type_category: ${typeCategory}`);
  }

  // Normalise to snake_case, matching every built-in slug (work_item, to_do,
  // priority). This used to force kebab-case, so a type created here got
  // `my-thing` while the seeded types used `my_thing` - two conventions for the
  // same identifier, and the seeded ones would not have survived a round trip
  // through this function.
  const slug = data.slug.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_|_$/g, '');

  try {
    const result = await query(
      'INSERT INTO entity_types (slug, label, label_singular, icon, type_category, external_source, template_structure, supports_hierarchy, is_system, primary_date_field, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [slug, data.label, data.label_singular, data.icon || null, typeCategory, data.external_source || null, data.template_structure ? JSON.stringify(data.template_structure) : null, data.supports_hierarchy ? 1 : 0, data.is_system ? 1 : 0, data.primary_date_field || null, data.order_index || 0]
    );

    const typeId = result.insertId;

    // Create fields if provided
    if (data.fields && Array.isArray(data.fields)) {
      for (let i = 0; i < data.fields.length; i++) {
        const fieldData = { ...data.fields[i], display_order: i };
        await createEntityTypeField(typeId, fieldData);
      }
    }

    if (data.supports_hierarchy) await ensureSelfNestingRule(typeId);
    // ...and it can be put inside a template, like every other editable type.
    await ensureContainerRules(typeId, data.type_category);

    return getEntityType(typeId);
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
  const allowedFields = ['label', 'label_singular', 'icon', 'supports_hierarchy', 'supports_folders', 'primary_date_field', 'order_index', 'is_visible', 'type_category', 'external_source', 'template_structure', 'title_order'];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates.push(`${field} = ?`);
      if (field === 'supports_hierarchy' || field === 'supports_folders' || field === 'is_visible') {
        values.push(data[field] ? 1 : 0);
      } else if (field === 'template_structure') {
        values.push(data[field] ? JSON.stringify(data[field]) : null);
      } else {
        values.push(data[field]);
      }
    }
  }

  if (updates.length > 0) {
    values.push(id);
    await query(
      `UPDATE entity_types SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }

  // Turning hierarchy ON has to bring its rule with it, or the flag is a
  // promise the engine will refuse to keep. Turning it off deliberately leaves
  // the rule in place: it may have been created by hand, and an unused rule is
  // harmless while a deleted one is not recoverable.
  if (data.supports_hierarchy) await ensureSelfNestingRule(id);

  // Handle fields if provided.
  //
  // Reconciled by field_key rather than dropped and recreated. The wipe-then-
  // recreate version destroyed anything the caller didn't send back verbatim:
  // the Settings form had no <option> for `status`/`recurrence`, so saving a
  // type rewrote those fields to `text` and dropped every field the form
  // couldn't render. Metadata the caller omits (field_options,
  // is_completion_signal) is now carried over from the existing field instead
  // of being reset.
  if (data.fields && Array.isArray(data.fields)) {
    const existing = await getEntityTypeFields(id);
    const existingByKey = new Map(existing.map(f => [f.field_key, f]));
    const keptKeys = new Set();

    for (let i = 0; i < data.fields.length; i++) {
      const incoming = { ...data.fields[i], display_order: i };
      const normalizedKey = String(incoming.field_key || '')
        .toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_|_$/g, '');
      const prior = existingByKey.get(normalizedKey);

      if (!prior) {
        await createEntityTypeField(id, incoming);
        keptKeys.add(normalizedKey);
        continue;
      }

      keptKeys.add(normalizedKey);
      await updateEntityTypeField(prior.id, {
        label: incoming.label ?? prior.label,
        field_type: incoming.field_type ?? prior.field_type,
        field_options: incoming.field_options !== undefined
          ? incoming.field_options
          : (typeof prior.field_options === 'string' ? JSON.parse(prior.field_options) : prior.field_options),
        required: incoming.required !== undefined ? incoming.required : prior.required,
        display_order: i,
        show_in_row: incoming.show_in_row !== undefined ? incoming.show_in_row : prior.show_in_row,
        rollup: incoming.rollup !== undefined ? incoming.rollup : prior.rollup,
        show_column_label: incoming.show_column_label !== undefined
          ? incoming.show_column_label
          : prior.show_column_label,
        is_completion_signal: incoming.is_completion_signal !== undefined
          ? incoming.is_completion_signal
          : prior.is_completion_signal,
      });
    }

    for (const field of existing) {
      if (!keptKeys.has(field.field_key)) {
        await query('DELETE FROM entity_type_fields WHERE id = ?', [field.id]);
      }
    }
  }

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

  // 'url' is one named link; 'links' is 0-n named links stored as a JSON
  // array of {url, title} - it replaces the per-type priority_links /
  // task_links / ticket_links / to_do_links tables, which existed only because
  // there was no generic way to say "this type has links".
  if (!VALID_FIELD_TYPES.includes(data.field_type)) {
    throw new ValidationError(`Invalid field_type. Must be one of: ${VALID_FIELD_TYPES.join(', ')}`);
  }

  const fieldKey = data.field_key.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_|_$/g, '');

  try {
    const result = await query(
      'INSERT INTO entity_type_fields (entity_type_id, field_key, label, field_type, field_options, required, display_order, show_in_row, is_completion_signal, rollup, show_column_label) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        entityTypeId,
        fieldKey,
        data.label,
        data.field_type,
        data.field_options ? JSON.stringify(data.field_options) : null,
        data.required ? 1 : 0,
        data.display_order || 0,
        data.show_in_row ? 1 : 0,
        data.is_completion_signal ? 1 : 0,
        data.rollup || null,
        data.show_column_label === undefined ? 1 : (data.show_column_label ? 1 : 0)
      ]
    );
    const rows = await query('SELECT * FROM entity_type_fields WHERE id = ?', [result.insertId]);
    return rows[0];
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw new ConflictError(`Field already exists: ${fieldKey}`);
    throw error;
  }
}

// Update a field
export async function updateEntityTypeField(fieldId, data) {
  // Update validated nothing while create validated against a list, so a
  // field_type the create path refused could still be written by an update.
  if (data.field_type !== undefined && !VALID_FIELD_TYPES.includes(data.field_type)) {
    throw new ValidationError(`Invalid field_type. Must be one of: ${VALID_FIELD_TYPES.join(', ')}`);
  }

  const updates = [];
  const values = [];
  const allowedFields = ['label', 'field_type', 'field_options', 'required', 'display_order', 'show_in_row', 'is_completion_signal', 'rollup', 'show_column_label'];

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
    const rows = await query('SELECT * FROM entity_type_fields WHERE id = ?', [fieldId]);
    return rows[0];
  }

  values.push(fieldId);
  await query(
    `UPDATE entity_type_fields SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
  const rows = await query('SELECT * FROM entity_type_fields WHERE id = ?', [fieldId]);
  return rows[0];
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
    const result = await query(
      'INSERT INTO entity_type_relationships (parent_type_id, child_type_id, relationship_kind, max_children_per_parent, max_parents_per_child) VALUES (?, ?, ?, ?, ?)',
      [data.parent_type_id, data.child_type_id, data.relationship_kind, data.max_children_per_parent || null, data.max_parents_per_child || null]
    );
    const rows = await query('SELECT * FROM entity_type_relationships WHERE id = ?', [result.insertId]);
    return rows[0];
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
    const rows = await query('SELECT * FROM entity_type_relationships WHERE id = ?', [ruleId]);
    return rows[0];
  }

  values.push(ruleId);
  await query(
    `UPDATE entity_type_relationships SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
  const rows = await query('SELECT * FROM entity_type_relationships WHERE id = ?', [ruleId]);
  return rows[0];
}

// Delete a relationship rule
export async function deleteEntityTypeRelationship(ruleId) {
  await query('DELETE FROM entity_type_relationships WHERE id = ?', [ruleId]);
}

/**
 * What "Revert to defaults" restores.
 *
 * Read from src/database/typeDefaults.json - a snapshot of a real, working
 * configuration, captured by scripts/capture-type-defaults.js - and NOT from
 * the seed definitions in systemEntityTypes.js. The seed describes how to
 * CREATE a type that does not exist; it had drifted from the configuration
 * actually in use (different labels, `focus_seconds` typed differently), and it
 * cannot describe a user-created type at all. Reverting to it would have
 * quietly undone real settings and refused to help with half the types on the
 * page.
 *
 * The snapshot is committed, so "defaults" mean the same thing on every
 * machine. Re-capture it whenever the current configuration is the one worth
 * keeping.
 */
const TYPE_DEFAULTS = Object.fromEntries(
  (typeDefaults.types || []).map((t) => [t.slug, t])
);

export function getTypeDefaults(slug) {
  return TYPE_DEFAULTS[slug] || null;
}

export function hasTypeDefaults(slug) {
  return Boolean(TYPE_DEFAULTS[slug]);
}

/**
 * Restore one type to its captured configuration.
 *
 * Fields are matched by field_key: a default field that is missing gets
 * created, one that exists has its settings written back. Fields NOT in the
 * defaults are reported but deliberately left alone - `entity_field_values`
 * rows are keyed by field_key, so dropping a field silently orphans whatever
 * every record stored in it. Losing data is not a thing a button labelled
 * "revert settings" should do; the caller is told what is extra and can remove
 * it deliberately.
 *
 * Works for any type with a snapshot, not just system ones - a type the user
 * created is exactly as worth restoring.
 */
export async function revertSystemType(id) {
  const type = await getEntityType(id);

  const defaults = TYPE_DEFAULTS[type.slug];
  if (!defaults) {
    throw new ValidationError(
      `No captured defaults for "${type.slug}". Run scripts/capture-type-defaults.js `
      + 'on a machine where this type is configured the way you want it.'
    );
  }

  await query(
    `UPDATE entity_types
        SET label = ?, label_singular = ?, icon = ?, supports_hierarchy = ?,
            primary_date_field = ?, is_visible = ?, title_order = ?, supports_folders = ?
      WHERE id = ?`,
    [
      defaults.label,
      defaults.label_singular,
      defaults.icon,
      defaults.supports_hierarchy ? 1 : 0,
      defaults.primary_date_field || null,
      defaults.is_visible ? 1 : 0,
      defaults.title_order ?? null,
      defaults.supports_folders ? 1 : 0,
      id,
    ]
  );

  const live = await query(
    'SELECT * FROM entity_type_fields WHERE entity_type_id = ?', [id]
  );
  const liveByKey = new Map(live.map((f) => [f.field_key, f]));

  const restored = [];
  const created = [];

  for (const f of defaults.fields || []) {
    const options = f.field_options === null || f.field_options === undefined
      ? null
      : (typeof f.field_options === 'string' ? f.field_options : JSON.stringify(f.field_options));

    if (liveByKey.has(f.field_key)) {
      await query(
        `UPDATE entity_type_fields
            SET label = ?, field_type = ?, field_options = ?, required = ?,
                display_order = ?, show_in_row = ?, is_completion_signal = ?,
                rollup = ?, show_column_label = ?
          WHERE entity_type_id = ? AND field_key = ?`,
        [f.label, f.field_type, options, f.required ? 1 : 0, f.display_order ?? 0,
         f.show_in_row ? 1 : 0, f.is_completion_signal ? 1 : 0, f.rollup ?? null,
         f.show_column_label ? 1 : 0, id, f.field_key]
      );
      restored.push(f.field_key);
    } else {
      await query(
        `INSERT INTO entity_type_fields
           (entity_type_id, field_key, label, field_type, field_options, required,
            display_order, show_in_row, is_completion_signal, rollup, show_column_label)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, f.field_key, f.label, f.field_type, options, f.required ? 1 : 0,
         f.display_order ?? 0, f.show_in_row ? 1 : 0, f.is_completion_signal ? 1 : 0,
         f.rollup ?? null, f.show_column_label ? 1 : 0]
      );
      created.push(f.field_key);
    }
  }

  const defaultKeys = new Set((defaults.fields || []).map((f) => f.field_key));
  const extra = live.filter((f) => !defaultKeys.has(f.field_key)).map((f) => f.field_key);

  const result = await getEntityType(id);
  return { ...result, revert: { restored, created, extra, capturedAt: typeDefaults.capturedAt } };
}

/**
 * Restore every type that has a captured default.
 *
 * Runs per type and keeps going when one fails, rather than aborting the batch:
 * a single bad type should not decide the fate of the other ten, and stopping
 * halfway would leave the page in a state that is neither the old one nor the
 * new one. Every outcome is reported.
 *
 * A live type with no snapshot is skipped and named - it was created after the
 * last capture, so there is nothing to restore it to, and inventing something
 * would be worse than doing nothing.
 */
export async function revertAllTypes() {
  const types = await query(
    'SELECT id, slug, label FROM entity_types WHERE deleted_at IS NULL ORDER BY order_index, id'
  );

  const reverted = [];
  const skipped = [];
  const failed = [];

  for (const t of types) {
    if (!TYPE_DEFAULTS[t.slug]) {
      skipped.push({ slug: t.slug, label: t.label, reason: 'no captured defaults' });
      continue;
    }
    try {
      const r = await revertSystemType(t.id);
      reverted.push({
        slug: t.slug,
        label: t.label,
        restored: r.revert.restored.length,
        created: r.revert.created.length,
        extra: r.revert.extra,
      });
    } catch (error) {
      failed.push({ slug: t.slug, label: t.label, error: error.message });
    }
  }

  return { reverted, skipped, failed, capturedAt: typeDefaults.capturedAt };
}

// Rewrites order_index across types (0..n in the given order). This is the same
// ordering the dashboard renders its tabs in, so dragging types in Settings and
// the tab order on the main page are two views of one value.
export async function reorderEntityTypes(orderedIds) {
  for (let i = 0; i < orderedIds.length; i++) {
    await query('UPDATE entity_types SET order_index = ? WHERE id = ?', [i, orderedIds[i]]);
  }
}
