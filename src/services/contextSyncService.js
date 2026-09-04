// Compare two contexts' databases and carry a type's STRUCTURE from one to the
// other - the type's own settings, its fields, its nesting rules, and
// optionally its records.
//
// The one rule the whole file is built around: **nothing on the target is ever
// deleted.** Not a type, not a field, not a record. The point of the feature is
// to set Categories up the way you want on one machine and have that shape
// appear on the other, WITHOUT touching the categories already living there. So
// every operation is an insert or an update; there is no delete path, and
// `only_in_target` is a thing the diff reports and the apply step skips.
//
// Records are matched by PATH, not by id. Ids are per-database facts and two
// contexts hand out different ones for the same row; the path (the chain of
// titles from the root) is what a person means when they say "that category is
// already there". A path that exists on the target is left exactly as it is.

import { withContextPair } from '../database/contextConnection.js';
import { ValidationError, NotFoundError } from '../config/errors.js';
import * as db from '../database/homePool.js';

// Type columns worth comparing. Deliberately excludes id, timestamps and
// deleted_at: ids are per-database, timestamps are noise, and a type deleted on
// one side is not a reason to delete it on the other.
const TYPE_KEYS = [
  'label', 'label_singular', 'icon', 'type_category', 'external_source',
  'supports_hierarchy', 'supports_folders', 'primary_date_field',
  'order_index', 'is_visible', 'template_structure',
];

// Field columns worth comparing. `show_in_row` IS included - which columns show
// on a row is exactly the kind of layout choice being ported.
const FIELD_KEYS = [
  'label', 'field_type', 'field_options', 'required', 'display_order',
  'show_in_row', 'is_completion_signal', 'rollup', 'show_column_label',
];

// ---- reading one side --------------------------------------------------------

async function readTypes(conn) {
  const types = await conn.query(
    `SELECT id, slug, label, label_singular, icon, type_category, external_source,
            template_structure, supports_hierarchy, supports_folders, is_system,
            primary_date_field, order_index, is_visible
       FROM ${conn.t('entity_types')}
      WHERE deleted_at IS NULL
      ORDER BY order_index, slug`,
  );

  const fields = await conn.query(
    `SELECT entity_type_id, field_key, label, field_type, field_options, required,
            display_order, show_in_row, is_completion_signal, rollup, show_column_label
       FROM ${conn.t('entity_type_fields')}
      ORDER BY entity_type_id, display_order`,
  );

  // Nesting rules travel as slugs, since ids differ between databases.
  const rules = await conn.query(
    `SELECT p.slug AS parent_slug, c.slug AS child_slug, r.relationship_kind,
            r.max_children_per_parent, r.max_parents_per_child
       FROM ${conn.t('entity_type_relationships')} r
       JOIN ${conn.t('entity_types')} p ON p.id = r.parent_type_id
       JOIN ${conn.t('entity_types')} c ON c.id = r.child_type_id`,
  );

  const byId = new Map(types.map((t) => [t.id, t]));
  for (const type of types) type.fields = [];
  for (const field of fields) byId.get(field.entity_type_id)?.fields.push(field);
  for (const type of types) {
    type.rules = rules.filter(
      (r) => r.parent_slug === type.slug || r.child_slug === type.slug,
    );
  }
  return types;
}

// ---- comparing ---------------------------------------------------------------

// Booleans arrive as 1/0 from MySQL and true/false from MSSQL, and JSON columns
// as a string on one and an object on the other. Comparing raw values reported
// every type as different on a cross-engine pair, which is precisely the pair
// this feature exists for.
function normalise(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try { return JSON.stringify(JSON.parse(trimmed)); } catch { return trimmed; }
    }
    return trimmed;
  }
  return value;
}

function diffKeys(keys, source, target) {
  const changes = [];
  for (const key of keys) {
    const a = normalise(source?.[key]);
    const b = normalise(target?.[key]);
    if (String(a) !== String(b)) changes.push({ key, source: a, target: b });
  }
  return changes;
}

function compareFields(sourceType, targetType) {
  const targetByKey = new Map((targetType?.fields || []).map((f) => [f.field_key, f]));
  const seen = new Set();
  const fields = [];

  for (const field of sourceType?.fields || []) {
    seen.add(field.field_key);
    const match = targetByKey.get(field.field_key);
    if (!match) {
      fields.push({ field_key: field.field_key, label: field.label, status: 'only_in_source', changes: [] });
      continue;
    }
    const changes = diffKeys(FIELD_KEYS, field, match);
    fields.push({
      field_key: field.field_key,
      label: field.label,
      status: changes.length ? 'differs' : 'identical',
      changes,
    });
  }

  // Reported so you can SEE what the target has that the source does not. The
  // apply step never acts on these - see the file header.
  for (const field of targetType?.fields || []) {
    if (!seen.has(field.field_key)) {
      fields.push({ field_key: field.field_key, label: field.label, status: 'only_in_target', changes: [] });
    }
  }
  return fields;
}

function compareRules(sourceType, targetType) {
  const key = (r) => `${r.parent_slug}>${r.child_slug}:${r.relationship_kind}`;
  const targetKeys = new Set((targetType?.rules || []).map(key));
  const sourceKeys = new Set((sourceType?.rules || []).map(key));
  const rules = [];
  for (const r of sourceType?.rules || []) {
    if (!targetKeys.has(key(r))) rules.push({ ...r, status: 'only_in_source' });
  }
  for (const r of targetType?.rules || []) {
    if (!sourceKeys.has(key(r))) rules.push({ ...r, status: 'only_in_target' });
  }
  return rules;
}

/**
 * What differs between two contexts, type by type.
 *
 * `includeRecords` adds a per-type record count and how many rows would be
 * added - it walks the record tree on both sides, so it costs a lot more than
 * the structure comparison and is off unless asked for.
 */
export async function compareContexts(sourceContextId, targetContextId, options = {}) {
  const { includeRecords = false } = options;
  const [sourceCtx, targetCtx] = await Promise.all([
    getContextRow(sourceContextId),
    getContextRow(targetContextId),
  ]);

  return withContextPair(sourceContextId, targetContextId, async (source, target) => {
    const sourceTypes = await readTypes(source);
    const targetTypes = await readTypes(target);
    // Resolved once, not per type: it is a lookup against `contexts`, and doing
    // it inside the loop meant one round trip per type on both connections.
    const localIds = includeRecords
      ? {
        sourceLocalId: await resolveLocalContextId(source, sourceCtx.name),
        targetLocalId: await resolveLocalContextId(target, targetCtx.name),
      }
      : {};
    const targetBySlug = new Map(targetTypes.map((t) => [t.slug, t]));
    const seen = new Set();
    const types = [];

    for (const sourceType of sourceTypes) {
      seen.add(sourceType.slug);
      const targetType = targetBySlug.get(sourceType.slug);
      const typeChanges = targetType ? diffKeys(TYPE_KEYS, sourceType, targetType) : [];
      const fields = compareFields(sourceType, targetType);
      const rules = compareRules(sourceType, targetType);

      const structurallyDiffers = Boolean(
        typeChanges.length
        || fields.some((f) => f.status === 'only_in_source' || f.status === 'differs')
        || rules.some((r) => r.status === 'only_in_source'),
      );

      const entry = {
        slug: sourceType.slug,
        label: sourceType.label,
        icon: sourceType.icon,
        is_system: Boolean(sourceType.is_system),
        status: !targetType ? 'only_in_source' : (structurallyDiffers ? 'differs' : 'identical'),
        typeChanges,
        fields,
        rules,
      };

      if (includeRecords) {
        entry.records = await compareRecords(source, target, sourceType, targetType, localIds);
      }
      types.push(entry);
    }

    for (const targetType of targetTypes) {
      if (seen.has(targetType.slug)) continue;
      types.push({
        slug: targetType.slug,
        label: targetType.label,
        icon: targetType.icon,
        is_system: Boolean(targetType.is_system),
        status: 'only_in_target',
        typeChanges: [],
        fields: (targetType.fields || []).map((f) => ({
          field_key: f.field_key, label: f.label, status: 'only_in_target', changes: [],
        })),
        rules: [],
      });
    }

    return {
      source: { id: Number(sourceContextId), name: sourceCtx.name, dbType: source.type, database: source.database },
      target: { id: Number(targetContextId), name: targetCtx.name, dbType: target.type, database: target.database },
      includeRecords,
      types,
    };
  });
}

// ---- records -----------------------------------------------------------------

/**
 * The context's own id INSIDE a given database.
 *
 * `entities.context_id` is a foreign key into that database's own `contexts`
 * table, so the number is a per-database fact - the same context is id 3 in one
 * and id 1 in the other. Matching by name is what makes the two ends line up;
 * a single-context database is accepted on sight, since there is nothing else
 * it could mean.
 */
async function resolveLocalContextId(conn, contextName) {
  const byName = await conn.query(
    `SELECT id FROM ${conn.t('contexts')} WHERE name = ?`,
    [contextName],
  );
  if (byName.length) return byName[0].id;

  const all = await conn.query(`SELECT id FROM ${conn.t('contexts')}`);
  if (all.length === 1) return all[0].id;

  throw new ValidationError(
    `Could not find a context named "${contextName}" in ${conn.database}, and it holds `
    + `${all.length} contexts, so there is no single obvious one to use. Rename the `
    + `context to match, or sync structure only.`,
  );
}

// One row's identity across databases: its title, and the titles of everything
// above it. Two contexts give the same category different ids, so an id-based
// match would import every row again on every run.
//
// The tree is NOT a parent_id column - `entities` has none. Nesting lives in
// `entity_relationships` under relationship_kind='hierarchy', which is also
// where a row's position among its siblings is kept.
async function readRecordPaths(conn, typeId, localContextId) {
  if (!typeId || !localContextId) return new Map();
  const rows = await conn.query(
    `SELECT id, title, is_folder, order_index
       FROM ${conn.t('entities')}
      WHERE entity_type_id = ? AND context_id = ? AND deleted_at IS NULL`,
    [typeId, localContextId],
  );
  if (!rows.length) return new Map();

  const links = await conn.query(
    `SELECT parent_entity_id, child_entity_id, order_index
       FROM ${conn.t('entity_relationships')}
      WHERE context_id = ? AND relationship_kind = 'hierarchy'`,
    [localContextId],
  );

  const byId = new Map(rows.map((r) => [r.id, r]));
  const parentOf = new Map();
  for (const link of links) {
    if (byId.has(link.child_entity_id)) parentOf.set(link.child_entity_id, link.parent_entity_id);
  }

  const paths = new Map();
  // The parent CHAIN, as an array of titles - not a joined string. A title
  // containing " / " (a real, saved value) used to be indistinguishable from
  // the separator itself: "A / B" as one row's own title and "B" nested under
  // a folder titled "A" produced the identical joined path, so the two were
  // treated as the same record and one silently never synced. Keyed here by
  // JSON.stringify(chain) instead, which is unambiguous for any array of
  // strings - joining with " / " happens only where a path is DISPLAYED.
  const pathArrOf = (row, guard = 0) => {
    if (!row || guard > 50) return [];            // guard: a cycle must not hang the compare
    const title = String(row.title ?? '').trim();
    const parentId = parentOf.get(row.id);
    // A parent outside this type (or already deleted) makes this row a root
    // here rather than an orphan with an unresolvable path.
    if (!parentId || !byId.has(parentId)) return [title];
    return [...pathArrOf(byId.get(parentId), guard + 1), title];
  };

  for (const row of rows) {
    row.parentId = parentOf.get(row.id) ?? null;
    row.pathArr = pathArrOf(row);
    paths.set(JSON.stringify(row.pathArr), row);
  }
  return paths;
}

// Chain -> display string, only ever for something a human reads.
function displayPath(pathArr) {
  return (pathArr || []).join(' / ');
}

async function compareRecords(source, target, sourceType, targetType, ctx) {
  const sourcePaths = await readRecordPaths(source, sourceType?.id, ctx.sourceLocalId);
  const targetPaths = await readRecordPaths(target, targetType?.id, ctx.targetLocalId);
  const toAdd = [...sourcePaths.keys()].filter((p) => !targetPaths.has(p));
  return {
    sourceCount: sourcePaths.size,
    targetCount: targetPaths.size,
    toAdd: toAdd.length,
    // A sample, not the list: a type with thousands of rows would otherwise
    // push a thousand-line payload into the compare screen.
    sample: toAdd.slice(0, 10).map((p) => displayPath(sourcePaths.get(p).pathArr)),
  };
}

async function getContextRow(contextId) {
  const rows = await db.query('SELECT id, name FROM contexts WHERE id = ?', [contextId]);
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) throw new NotFoundError(`Context ${contextId} not found`);
  return list[0];
}

export { readTypes, readRecordPaths, resolveLocalContextId, normalise, diffKeys };

// ---- applying ----------------------------------------------------------------

// The engines disagree about how you get the id of a row you just inserted, and
// neither answer is portable. Kept in one place so the insert helpers below read
// the same on both.
async function insertReturningId(conn, table, columns, values) {
  const placeholders = columns.map(() => '?').join(', ');
  const columnList = columns.join(', ');
  if (conn.type === 'mssql') {
    const rows = await conn.query(
      `INSERT INTO ${conn.t(table)} (${columnList}) OUTPUT INSERTED.id VALUES (${placeholders})`,
      values,
    );
    return rows[0]?.id;
  }
  const result = await conn.query(
    `INSERT INTO ${conn.t(table)} (${columnList}) VALUES (${placeholders})`,
    values,
  );
  return result?.insertId;
}

// A value on its way into the target. MySQL hands JSON back as an object and
// MSSQL as a string; writing the object back would store "[object Object]".
function outbound(value) {
  if (value === undefined) return null;
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

async function upsertType(target, sourceType, targetType) {
  if (targetType) {
    const changes = diffKeys(TYPE_KEYS, sourceType, targetType);
    if (!changes.length) return { id: targetType.id, action: 'unchanged' };
    const sets = changes.map((c) => `${c.key} = ?`).join(', ');
    await target.query(
      `UPDATE ${target.t('entity_types')} SET ${sets} WHERE id = ?`,
      [...changes.map((c) => outbound(sourceType[c.key])), targetType.id],
    );
    return { id: targetType.id, action: 'updated', changed: changes.map((c) => c.key) };
  }

  const columns = ['slug', ...TYPE_KEYS, 'is_system'];
  const values = columns.map((key) => outbound(sourceType[key]));
  const id = await insertReturningId(target, 'entity_types', columns, values);
  return { id, action: 'created' };
}

async function syncFields(target, sourceType, targetType, targetTypeId) {
  const existing = new Map((targetType?.fields || []).map((f) => [f.field_key, f]));
  const added = [];
  const updated = [];

  for (const field of sourceType.fields || []) {
    const match = existing.get(field.field_key);
    if (!match) {
      const columns = ['entity_type_id', 'field_key', ...FIELD_KEYS];
      const values = [targetTypeId, field.field_key, ...FIELD_KEYS.map((k) => outbound(field[k]))];
      await insertReturningId(target, 'entity_type_fields', columns, values);
      added.push(field.field_key);
      continue;
    }
    const changes = diffKeys(FIELD_KEYS, field, match);
    if (!changes.length) continue;
    const sets = changes.map((c) => `${c.key} = ?`).join(', ');
    await target.query(
      `UPDATE ${target.t('entity_type_fields')} SET ${sets}
        WHERE entity_type_id = ? AND field_key = ?`,
      [...changes.map((c) => outbound(field[c.key])), targetTypeId, field.field_key],
    );
    updated.push(field.field_key);
  }
  // Fields only on the target are not touched. See the file header.
  return { added, updated };
}

async function syncRules(target, sourceType) {
  const idBySlug = new Map(
    (await target.query(`SELECT id, slug FROM ${target.t('entity_types')}`))
      .map((r) => [r.slug, r.id]),
  );
  const added = [];

  for (const rule of sourceType.rules || []) {
    const parentId = idBySlug.get(rule.parent_slug);
    const childId = idBySlug.get(rule.child_slug);
    // A rule pointing at a type that is not on the target yet is skipped rather
    // than invented - syncing that type will bring its own rules with it.
    if (!parentId || !childId) continue;

    const existing = await target.query(
      `SELECT id FROM ${target.t('entity_type_relationships')}
        WHERE parent_type_id = ? AND child_type_id = ? AND relationship_kind = ?`,
      [parentId, childId, rule.relationship_kind],
    );
    if (existing.length) continue;

    await insertReturningId(
      target,
      'entity_type_relationships',
      ['parent_type_id', 'child_type_id', 'relationship_kind', 'max_children_per_parent', 'max_parents_per_child'],
      [parentId, childId, rule.relationship_kind,
        outbound(rule.max_children_per_parent), outbound(rule.max_parents_per_child)],
    );
    added.push(`${rule.parent_slug} > ${rule.child_slug}`);
  }
  return added;
}

// Records, shallowest first, so a parent always exists before its children are
// placed under it. Only paths the target does not already have are created; a
// path it does have is left completely alone, values and all.
async function syncRecords(source, target, sourceTypeId, targetTypeId, ctx) {
  const sourcePaths = await readRecordPaths(source, sourceTypeId, ctx.sourceLocalId);
  const targetPaths = await readRecordPaths(target, targetTypeId, ctx.targetLocalId);

  const missing = [...sourcePaths.entries()]
    .filter(([path]) => !targetPaths.has(path))
    .sort((a, b) => a[1].pathArr.length - b[1].pathArr.length);

  if (!missing.length) return { added: 0, paths: [] };

  const values = await source.query(
    `SELECT efv.entity_id, efv.field_key, efv.value_text, efv.value_long, efv.value_number,
            efv.value_date, efv.value_bool, efv.value_json
       FROM ${source.t('entity_field_values')} efv
       JOIN ${source.t('entities')} e ON e.id = efv.entity_id
      WHERE e.entity_type_id = ? AND e.context_id = ?`,
    [sourceTypeId, ctx.sourceLocalId],
  );
  const valuesByEntity = new Map();
  for (const v of values) {
    if (!valuesByEntity.has(v.entity_id)) valuesByEntity.set(v.entity_id, []);
    valuesByEntity.get(v.entity_id).push(v);
  }

  // Path -> the id it now has on the target, so a child inserted later in this
  // same run can find the parent this run just created.
  const targetIdByPath = new Map(
    [...targetPaths.entries()].map(([path, row]) => [path, row.id]),
  );
  const added = [];

  for (const [path, row] of missing) {
    const newId = await insertReturningId(
      target,
      'entities',
      ['entity_type_id', 'context_id', 'title', 'order_index', 'is_folder'],
      [targetTypeId, ctx.targetLocalId, row.title, outbound(row.order_index) ?? 0, outbound(row.is_folder) ?? 0],
    );
    targetIdByPath.set(path, newId);

    const parentArr = row.pathArr.slice(0, -1);
    const parentPath = parentArr.length ? JSON.stringify(parentArr) : null;
    const parentId = parentPath ? targetIdByPath.get(parentPath) : null;
    if (parentId) {
      await target.query(
        `INSERT INTO ${target.t('entity_relationships')}
           (context_id, parent_entity_id, child_entity_id, relationship_kind, is_generated, order_index)
         VALUES (?, ?, ?, 'hierarchy', 0, ?)`,
        [ctx.targetLocalId, parentId, newId, outbound(row.order_index) ?? 0],
      );
    }

    for (const v of valuesByEntity.get(row.id) || []) {
      await target.query(
        `INSERT INTO ${target.t('entity_field_values')}
           (entity_id, field_key, value_text, value_long, value_number, value_date, value_bool, value_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId, v.field_key, outbound(v.value_text), outbound(v.value_long), outbound(v.value_number),
          outbound(v.value_date), outbound(v.value_bool), outbound(v.value_json)],
      );
    }
    added.push(displayPath(row.pathArr));
  }
  return { added: added.length, paths: added.slice(0, 20) };
}

/**
 * Carry the named types from one context to the other.
 *
 * `typeSlugs` is required and explicit: "sync everything" is not a gesture this
 * offers, because the whole point is that you looked at a diff and chose. Pass
 * `dryRun` to get the same report without writing anything.
 */
export async function applySync(sourceContextId, targetContextId, options = {}) {
  const { typeSlugs = [], includeRecords = false, dryRun = false } = options;
  if (!Array.isArray(typeSlugs) || !typeSlugs.length) {
    throw new ValidationError('Choose at least one type to sync');
  }

  const [sourceCtx, targetCtx] = await Promise.all([
    getContextRow(sourceContextId),
    getContextRow(targetContextId),
  ]);

  return withContextPair(sourceContextId, targetContextId, async (source, target) => {
    const sourceTypes = await readTypes(source);
    const sourceBySlug = new Map(sourceTypes.map((t) => [t.slug, t]));

    const unknown = typeSlugs.filter((slug) => !sourceBySlug.has(slug));
    if (unknown.length) {
      throw new NotFoundError(`Not in ${sourceCtx.name}: ${unknown.join(', ')}`);
    }

    const ctx = includeRecords
      ? {
        sourceLocalId: await resolveLocalContextId(source, sourceCtx.name),
        targetLocalId: await resolveLocalContextId(target, targetCtx.name),
      }
      : {};

    const results = [];
    for (const slug of typeSlugs) {
      const sourceType = sourceBySlug.get(slug);
      // Re-read per type rather than once up front: a type created earlier in
      // this same loop has to be visible to the rule sync of a later one.
      const targetType = (await readTypes(target)).find((t) => t.slug === slug);

      if (dryRun) {
        results.push({
          slug,
          action: targetType ? 'would update' : 'would create',
          fields: compareFields(sourceType, targetType)
            .filter((f) => f.status === 'only_in_source' || f.status === 'differs')
            .map((f) => f.field_key),
        });
        continue;
      }

      const typeResult = await upsertType(target, sourceType, targetType);
      const fieldResult = await syncFields(target, sourceType, targetType, typeResult.id);
      const ruleResult = await syncRules(target, sourceType);

      const entry = {
        slug,
        action: typeResult.action,
        changedColumns: typeResult.changed || [],
        fieldsAdded: fieldResult.added,
        fieldsUpdated: fieldResult.updated,
        rulesAdded: ruleResult,
      };

      if (includeRecords) {
        entry.records = await syncRecords(source, target, sourceType.id, typeResult.id, ctx);
      }
      results.push(entry);
    }

    return {
      source: { id: Number(sourceContextId), name: sourceCtx.name, dbType: source.type },
      target: { id: Number(targetContextId), name: targetCtx.name, dbType: target.type },
      dryRun,
      includeRecords,
      results,
    };
  });
}
