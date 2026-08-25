import { randomUUID } from 'node:crypto';
import { query as queryPool } from '../database/connectionPool.js';
import { getActiveContextId } from './activeContextService.js';
import { ValidationError, NotFoundError } from '../config/errors.js';
import * as entityTypeService from './entityTypeService.js';
import * as entityRelationshipService from './entityRelationshipService.js';
import { getNextOccurrenceDate, generateWorkItemsForDate } from './recurrenceService.js';

/**
 * Generic entity CRUD service (content DB, per-context).
 * All entity instances (dailies, priorities, categories, todos, etc.) live in the entities table,
 * discriminated by entity_type_id. Field values live in entity_field_values (EAV pattern).
 */

// Batch-load entities with all their field values. Exported for
// dailyService.js, which needs the same entity_id -> {field: value} shape
// for queries the generic getAllEntities/getEntitiesByFieldKey don't cover
// (filtering work_item entities by an exact date or date range).
export async function attachFieldValues(entityIds) {
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
//
// The three work_*_associations entries that used to head this list are gone:
// a day's links all live in work_entity_associations now. They were left here
// after the tables were removed from both schema files, so a purge would have
// thrown "table doesn't exist" on any database where that removal had actually
// been applied - which is the only reason it never fired on MySQL.
const BRIDGE_JUNCTION_COLUMNS = [
  ['priority_areas', 'area_id'],
  ['priority_goals', 'goal_id'],
  ['template_areas', 'area_id'],
  ['template_goals', 'goal_id'],
  ['work_entity_associations', 'entity_id'],
  // Since the Phase 10 work_items -> entities migration, daily_id is ALSO
  // an entities.id (a "day" is itself a work_item entity) - so purging a
  // work_item entity has to clear rows where it's on either side, not just
  // the entity_id side.
  ['work_entity_associations', 'daily_id'],
  ['work_source_associations', 'daily_id'],
  // A record put straight onto a day. MySQL cascades this one, but MSSQL
  // declares it NO ACTION - entities is already the target of a cascading FK
  // and a second would be "multiple cascade paths" - so on MSSQL the delete
  // fails with the row still referenced unless it is cleared here first.
  ['daily_entities', 'entity_id'],
];

// Legacy bridge: categories, goals and ideas are entities now, but dailyService,
// priorityService and dailyTemplateService still reach them through legacy
// junction tables and hand the result to hierarchyPath.js#buildPathMap, which
// wants the old self-referencing row shape ({id, <label>, parent_id}).
// `entities` has no parent column - hierarchy lives in entity_relationships -
// so the parent is joined back in here and aliased to match.
//
// Deliberately not context-filtered, matching the `SELECT id, name, parent_id
// FROM areas` it replaced: entity ids are globally unique, and a path only
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
    'SELECT * FROM entities WHERE entity_type_id = ? AND context_id = ? AND deleted_at IS NULL ORDER BY order_index, id',
    [type.id, contextId]
  );

  const fieldMap = await attachFieldValues(entities.map(e => e.id));
  for (const entity of entities) {
    entity.fields = fieldMap.get(entity.id) || {};
  }

  return entities;
}

/**
 * Every entity in the context that has a value stored for `fieldKey`, whatever
 * its type, with its type joined on.
 *
 * This exists so that "find the handful of rows that are on the board" is three
 * queries instead of one per type. The board and the reports used to loop every
 * editable type calling getAllEntities - which loads EVERY row of that type
 * plus all of its field values - and then filter in JavaScript. That is the
 * whole dataset walked to find a dozen rows, and it was invisible only because
 * the dataset is small.
 *
 * `entity_field_values` already carries idx_field_key_text(field_key,
 * value_text), so the lookup is indexed rather than a scan.
 */
export async function getEntitiesByFieldKey(fieldKey, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();

  const rows = await queryPool(
    `SELECT e.*, et.slug AS type_slug, et.label AS type_label, et.icon AS type_icon
     FROM entity_field_values v
     JOIN entities e ON e.id = v.entity_id
     JOIN entity_types et ON et.id = e.entity_type_id
     WHERE v.field_key = ?
       AND e.context_id = ?
       AND et.deleted_at IS NULL
       AND e.deleted_at IS NULL
       AND (v.value_text IS NOT NULL OR v.value_long IS NOT NULL
            OR v.value_number IS NOT NULL OR v.value_date IS NOT NULL
            OR v.value_bool IS NOT NULL OR v.value_json IS NOT NULL)
     ORDER BY e.id`,
    [fieldKey, contextId]
  );

  const fieldMap = await attachFieldValues(rows.map(e => e.id));
  for (const entity of rows) entity.fields = fieldMap.get(entity.id) || {};

  return rows;
}

// Entities of ANOTHER type that sit inside one of this type. Only templates
// have such children today (they may contain any editable type), but this is
// driven by the data, not by the slug: any type whose rules permit a cross-type
// child gets the same treatment.
//
// Walks down, so a template containing a project containing its sub-projects
// returns all of them - the tree is rendered from this list, and a node whose
// parent is missing from it simply does not appear.
export async function getNestedEntitiesOfOtherTypes(entityTypeSlug, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();

  const type = await entityTypeService.getEntityType(entityTypeSlug);
  const seen = new Set();
  const collected = [];

  let frontier = (await queryPool(
    'SELECT id FROM entities WHERE entity_type_id = ? AND context_id = ? AND deleted_at IS NULL',
    [type.id, contextId]
  )).map(r => r.id);

  while (frontier.length > 0) {
    const placeholders = frontier.map(() => '?').join(', ');
    const children = await queryPool(
      `SELECT DISTINCT er.child_entity_id AS id
       FROM entity_relationships er
       WHERE er.relationship_kind = 'hierarchy' AND er.context_id = ?
         AND er.parent_entity_id IN (${placeholders})`,
      [contextId, ...frontier]
    );

    const next = [];
    for (const row of children) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      next.push(row.id);
    }
    if (next.length === 0) break;

    const nextPlaceholders = next.map(() => '?').join(', ');
    const rows = await queryPool(
      `SELECT * FROM entities WHERE id IN (${nextPlaceholders}) AND entity_type_id <> ? AND deleted_at IS NULL`,
      [...next, type.id]
    );
    collected.push(...rows);
    frontier = next;
  }

  if (collected.length > 0) {
    const fieldMap = await attachFieldValues(collected.map(e => e.id));
    // Which of these are copies rather than references. A copy was cloned from
    // something (an instantiated_from edge); a reference IS the original, so
    // editing it changes it everywhere it appears. The UI badges the two
    // differently because that difference is invisible otherwise.
    const copies = await findClonedEntityIds(collected.map(e => e.id), contextId);
    for (const entity of collected) {
      entity.fields = fieldMap.get(entity.id) || {};
      entity.is_copy = copies.has(entity.id);
    }
  }

  return collected;
}

// Get a single entity by ID
export async function getEntityById(entityId, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();

  const rows = await queryPool(
    'SELECT * FROM entities WHERE id = ? AND context_id = ? AND deleted_at IS NULL',
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
      'SELECT MAX(order_index) as max_idx FROM entities WHERE entity_type_id = ? AND deleted_at IS NULL AND context_id = ?',
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
        await setEntityFieldValue(entity.id, fieldKey, value);
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
        await setEntityFieldValue(entityId, fieldKey, value);
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
          if (typeSchema.slug === 'daily') {
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
async function setEntityFieldValue(entityId, fieldKey, value) {
  // Determine which value column to use based on the field type
  // (In a real implementation, we'd fetch the field definition to know the type)
  // For now, we'll do a simple type detection

  let valueColumns = { value_text: null, value_long: null, value_number: null, value_date: null, value_bool: null, value_json: null };

  if (typeof value === 'boolean') {
    valueColumns.value_bool = value ? 1 : 0;
  } else if (typeof value === 'number') {
    valueColumns.value_number = value;
    // ANCHORED at both ends, and that matters. This used to be
    // /^\d{4}-\d{2}-\d{2}/, which matches the START of a string - so any text
    // merely BEGINNING with a date was routed into value_date and coerced by
    // the column to the date alone. "2026-08-22 spoke to Ryan" stored as
    // 2026-08-22 and the sentence was gone. Harmless while the only text
    // fields were titles; notes are exactly the field people start with a date.
    // Accepts a plain date or a full ISO timestamp, which is what a date field
    // actually sends, and nothing else.
  } else if (value instanceof Date || /^\d{4}-\d{2}-\d{2}(?:[T ][\d:.]+Z?)?$/.test(value)) {
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
/**
 * Delete an entity and everything nested under it - reversibly.
 *
 * Deleting a folder deliberately takes its contents, which is the intended
 * behaviour and exactly why there has to be a way back: a mis-click used to be
 * unrecoverable. Rows are stamped `deleted_at` rather than removed, every read
 * filters them out, and Recently Deleted can put the whole batch back.
 *
 * The batch matters. The cascade already computes the affected subtree, so all
 * of it is stamped with ONE timestamp - which is what makes "undo that delete"
 * mean the folder AND its contents rather than one row of it.
 */
export async function deleteEntity(entityId, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();

  const entity = await getEntityById(entityId, contextId);

  const affected = await collectSubtreeIds(entityId, contextId);
  // A batch id, not the timestamp, identifies what went together. deleted_at is
  // a DATETIME with one-second granularity, so two unrelated deletes in the
  // same second grouped into one batch - and restoring one brought back the
  // other. The id is unique per delete, whatever the clock says.
  const batch = randomUUID();
  const placeholders = affected.map(() => '?').join(', ');
  await queryPool(
    `UPDATE entities SET deleted_at = NOW(), deleted_batch = ?
     WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
    [batch, ...affected]
  );

  return { ...entity, deletedIds: affected, deletedBatch: batch };
}

/** Put back everything that went in the same delete. */
export async function restoreEntity(entityId, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();

  const rows = await queryPool(
    'SELECT deleted_batch FROM entities WHERE id = ? AND context_id = ?',
    [entityId, contextId]
  );
  if (rows.length === 0) throw new NotFoundError(`Entity not found: ${entityId}`);
  const batch = rows[0].deleted_batch;
  if (!batch) return { restored: 0 };

  // Same batch = same delete. Restoring a folder therefore brings back what was
  // inside it, and nothing that merely happened to be deleted at the same time.
  const result = await queryPool(
    'UPDATE entities SET deleted_at = NULL, deleted_batch = NULL WHERE context_id = ? AND deleted_batch = ?',
    [contextId, batch]
  );

  return { restored: result.affectedRows };
}

/** What is in the bin, newest first, one entry per delete rather than per row. */
export async function getDeletedEntities(contextId = null, { limit = 50 } = {}) {
  if (!contextId) contextId = await getActiveContextId();
  const cap = Math.max(1, Math.min(Math.floor(Number(limit) || 50), 200));

  const rows = await queryPool(
    `SELECT e.id, e.title, e.is_folder, e.deleted_at, e.deleted_batch,
            et.slug AS type_slug, et.label AS type_label, et.icon AS type_icon
     FROM entities e
     JOIN entity_types et ON et.id = e.entity_type_id
     WHERE e.context_id = ? AND e.deleted_at IS NOT NULL
     ORDER BY e.deleted_at DESC, e.id
     LIMIT ${cap}`,
    [contextId]
  );

  // Group by the batch, so a folder and its contents read as one undoable
  // action instead of forty separate rows.
  const batches = new Map();
  for (const row of rows) {
    const key = row.deleted_batch || `row-${row.id}`;
    if (!batches.has(key)) batches.set(key, { batch: key, deletedAt: row.deleted_at, items: [] });
    batches.get(key).items.push({
      id: row.id,
      title: row.title,
      isFolder: !!row.is_folder,
      typeSlug: row.type_slug,
      typeLabel: row.type_label,
      icon: row.type_icon,
    });
  }

  return [...batches.values()].map(b => ({
    ...b,
    // The row the delete was actually invoked on is the one to name.
    lead: b.items[0],
    alsoRemoved: b.items.length - 1,
  }));
}

/** Really delete - the bin's own "delete forever", and the only hard delete. */
export async function purgeEntity(entityId, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();

  const affected = await collectSubtreeIds(entityId, contextId, { includeDeleted: true });

  for (const [table, column] of BRIDGE_JUNCTION_COLUMNS) {
    for (const id of affected) {
      await queryPool(`DELETE FROM ${table} WHERE ${column} = ?`, [id]);
    }
  }

  const placeholders = affected.map(() => '?').join(', ');
  // Edges are kept through a soft delete so a restore can rebuild the tree;
  // a purge is where they finally go. The FK is NO ACTION on the MSSQL side,
  // so this is explicit rather than left to a cascade.
  await queryPool(
    `DELETE FROM entity_relationships
     WHERE parent_entity_id IN (${placeholders}) OR child_entity_id IN (${placeholders})`,
    [...affected, ...affected]
  );
  await queryPool(`DELETE FROM entities WHERE id IN (${placeholders})`, affected);
  return { purged: affected.length };
}

// The entity and everything below it, breadth-first, tolerant of a pre-existing
// cycle in the data (the `seen` set doubles as the guard).
async function collectSubtreeIds(entityId, contextId, { includeDeleted = false } = {}) {
  const seen = new Set([Number(entityId)]);
  const queue = [Number(entityId)];

  while (queue.length > 0) {
    const current = queue.shift();
    const children = await queryPool(
      `SELECT er.child_entity_id FROM entity_relationships er
       JOIN entities e ON e.id = er.child_entity_id
       WHERE er.parent_entity_id = ? AND er.context_id = ?
         AND er.relationship_kind = 'hierarchy'
         ${includeDeleted ? '' : 'AND e.deleted_at IS NULL'}`,
      [current, contextId]
    );
    for (const child of children) {
      if (seen.has(child.child_entity_id)) continue;
      seen.add(child.child_entity_id);
      queue.push(child.child_entity_id);
    }
  }

  return [...seen];
}

// Deep-clones an entity: the row, its field values, and everything nested under
// it, preserving the shape of the subtree. The clone is linked back to what it
// came from with an `instantiated_from` edge - the same relationship Templates
// already use to record "this was spawned from that" - which is how the UI
// later tells a copy from a reference.
//
// A copy is deliberately a real entity of the same type, not data smuggled onto
// the work item: it shows up on its own typed page and can be reopened, edited
// and nested like anything else. Editing it cannot affect the original, because
// they are separate rows.
export async function cloneEntity(entityId, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();

  const source = await getEntityById(entityId, contextId);
  const type = await entityTypeService.getEntityType(source.entity_type_id);

  // Whole subtree, parents before children, so a clone's parent always exists
  // by the time the child is created.
  const hierarchy = await queryPool(
    "SELECT parent_entity_id, child_entity_id, order_index FROM entity_relationships WHERE context_id = ? AND relationship_kind = 'hierarchy'",
    [contextId]
  );
  const childrenOf = new Map();
  for (const rel of hierarchy) {
    if (!childrenOf.has(rel.parent_entity_id)) childrenOf.set(rel.parent_entity_id, []);
    childrenOf.get(rel.parent_entity_id).push(rel);
  }

  const idMap = new Map();

  async function copyOne(originalId) {
    const original = await getEntityById(originalId, contextId);
    const copy = await createEntity(type.slug, {
      title: original.title,
      is_folder: original.is_folder,
      fields: original.fields || {},
    }, contextId);
    idMap.set(originalId, copy.id);

    // Every copy records what it was copied FROM, not just the root. The edge
    // is what makes a row read as a copy rather than a reference, and marking
    // only the root meant a deep copy arrived looking like one copy holding a
    // pile of references - which says the opposite of what happened: those
    // children are independent, and editing one changes nothing elsewhere.
    // is_generated marks it as machine-made rather than a link someone drew.
    await queryPool(
      "INSERT IGNORE INTO entity_relationships (context_id, parent_entity_id, child_entity_id, relationship_kind, is_generated, order_index) VALUES (?, ?, ?, 'instantiated_from', 1, 0)",
      [contextId, originalId, copy.id]
    );

    for (const rel of (childrenOf.get(originalId) || [])) {
      const childCopyId = await copyOne(rel.child_entity_id);
      await queryPool(
        "INSERT IGNORE INTO entity_relationships (context_id, parent_entity_id, child_entity_id, relationship_kind, is_generated, order_index) VALUES (?, ?, ?, 'hierarchy', 0, ?)",
        [contextId, copy.id, childCopyId, rel.order_index ?? 0]
      );
    }
    return copy.id;
  }

  // copyOne records the edge for every node it makes, the root included.
  const rootCopyId = await copyOne(entityId);

  return getEntityById(rootCopyId, contextId);
}

// The ids among `entityIds` that are copies - i.e. that were cloned from
// something. Used to badge a work item's children as copy vs reference.
export async function findClonedEntityIds(entityIds, contextId = null) {
  if (!entityIds || entityIds.length === 0) return new Set();
  if (!contextId) contextId = await getActiveContextId();

  const placeholders = entityIds.map(() => '?').join(', ');
  const rows = await queryPool(
    `SELECT child_entity_id FROM entity_relationships
     WHERE relationship_kind = 'instantiated_from' AND context_id = ?
       AND child_entity_id IN (${placeholders})`,
    [contextId, ...entityIds]
  );
  return new Set(rows.map(r => r.child_entity_id));
}

// Turn a template into work on a day. The work item takes the template's name,
// and every row the template holds is CLONED and associated to it - a template
// is always a full copy (that is what distinguishes it from a reference), so
// nothing done to the day's copy reaches back into the template.
//
// Association goes through work_entity_associations - the one junction that
// links a day to a row of ANY type. This used to be a map of seven per-type
// junctions, which meant a type invented after it was written could never be
// placed on a day: the lookup missed and the child was skipped in silence.
export async function instantiateTemplate(templateEntityId, date, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();

  const template = await getEntityById(templateEntityId, contextId);
  const children = await entityRelationshipService.getEntityChildren(templateEntityId, contextId, 'hierarchy');

  // Inlined rather than calling dailyService.createWorkItem: dailyService
  // already imports this file, so the reverse import would be circular.
  const workItem = await createEntity('daily', {
    title: template.title,
    order_index: 0,
    fields: { date, status: 'Not Started' },
  }, contextId);
  const dailyId = workItem.id;

  const copied = [];
  let order = 0;
  for (const child of children) {
    const type = await entityTypeService.getEntityType(child.entity_type_id);
    if (type.slug === 'template') continue;        // nested templates carry no work of their own

    const copy = await cloneEntity(child.child_entity_id, contextId);
    await queryPool(
      'INSERT IGNORE INTO work_entity_associations (daily_id, entity_id, order_index) VALUES (?, ?, ?)',
      [dailyId, copy.id, order++]
    );
    copied.push({ id: copy.id, title: copy.title, type: type.slug });
  }

  return { dailyId, title: template.title, date, copied };
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
