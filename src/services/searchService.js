import { query as queryPool } from '../database/connectionPool.js';
import { getActiveContextId } from './activeContextService.js';
import * as entityTypeService from './entityTypeService.js';

/**
 * Finding anything, by name, across every type at once.
 *
 * There was no search of any kind: ten types, hundreds of records, hierarchies
 * folded into folders, and the only way to reach a row was to remember which
 * tab it was on and scroll. This is the gap felt most often in ordinary use.
 *
 * The generic engine makes it one query rather than one per type - and one that
 * keeps working for a type invented next week, with no code change. Titles live
 * in `entities.title`; everything a user typed into a field lives in
 * `entity_field_values`, so both are searched and the match is reported so the
 * result can say WHY it matched.
 */

// Anything shorter matches most of the database and helps nobody.
const MIN_QUERY = 2;

// Written by the engine, never typed by a person - matching them would surface
// a record because its board column happened to contain the letters typed.
const INTERNAL_FIELD_KEYS = new Set([
  'board_bay', 'board_order', 'focus_slot', 'focus_seconds', 'focus_started_at',
]);

function escapeLike(term) {
  return term.replace(/[\\%_]/g, ch => `\\${ch}`);
}

/**
 * @param {string} term
 * @param {{ limit?: number, typeSlug?: string|null }} options
 */
export async function search(term, contextId = null, { limit = 30, typeSlug = null } = {}) {
  const trimmed = String(term || '').trim();
  if (trimmed.length < MIN_QUERY) return [];

  if (!contextId) contextId = await getActiveContextId();
  const like = `%${escapeLike(trimmed)}%`;

  // LIMIT takes a literal, not a placeholder: connectionPool runs statements
  // through mysql2's execute() (prepared statements), which rejects a bound
  // parameter there with "Incorrect arguments to mysqld_stmt_execute". Coerced
  // to a bounded integer, so it is still not user input reaching SQL.
  const rowCap = Math.max(1, Math.min(Math.floor(Number(limit) || 30), 100));

  const types = await entityTypeService.getAllEntityTypes();
  const typeBySlug = new Map(types.map(t => [t.slug, t]));

  // Two passes rather than one OR across a join: a title match and a field
  // match rank differently, and an OR would also multiply a row by however
  // many of its fields matched.
  const titleRows = await queryPool(
    `SELECT e.id, e.title, e.is_folder, et.slug AS type_slug, et.label AS type_label, et.icon AS type_icon
     FROM entities e
     JOIN entity_types et ON et.id = e.entity_type_id
     WHERE e.context_id = ? AND et.deleted_at IS NULL AND e.title LIKE ? ESCAPE '\\\\'
     ORDER BY CHAR_LENGTH(e.title), e.title
     LIMIT ${rowCap}`,
    [contextId, like]
  );

  const fieldRows = await queryPool(
    `SELECT e.id, e.title, e.is_folder, et.slug AS type_slug, et.label AS type_label,
            et.icon AS type_icon, v.field_key,
            COALESCE(v.value_text, LEFT(v.value_long, 200)) AS matched_value
     FROM entity_field_values v
     JOIN entities e ON e.id = v.entity_id
     JOIN entity_types et ON et.id = e.entity_type_id
     WHERE e.context_id = ? AND et.deleted_at IS NULL
       AND (v.value_text LIKE ? ESCAPE '\\\\' OR v.value_long LIKE ? ESCAPE '\\\\')
     ORDER BY e.title
     LIMIT ${rowCap}`,
    [contextId, like, like]
  );

  const results = new Map();

  for (const row of titleRows) {
    if (typeSlug && row.type_slug !== typeSlug) continue;
    results.set(row.id, {
      id: row.id,
      title: row.title,
      isFolder: !!row.is_folder,
      typeSlug: row.type_slug,
      typeLabel: row.type_label,
      icon: row.type_icon,
      matchedIn: 'title',
      context: null,
      // An exact hit, then a prefix, then anything else - so typing a full name
      // puts that record first rather than whatever happens to be shortest.
      rank: row.title.toLowerCase() === trimmed.toLowerCase() ? 0
        : row.title.toLowerCase().startsWith(trimmed.toLowerCase()) ? 1 : 2,
    });
  }

  for (const row of fieldRows) {
    if (INTERNAL_FIELD_KEYS.has(row.field_key)) continue;
    if (typeSlug && row.type_slug !== typeSlug) continue;
    // A title match already says everything a field match would.
    if (results.has(row.id)) continue;

    const type = typeBySlug.get(row.type_slug);
    const field = (type?.fields || []).find(f => f.field_key === row.field_key);

    results.set(row.id, {
      id: row.id,
      title: row.title,
      isFolder: !!row.is_folder,
      typeSlug: row.type_slug,
      typeLabel: row.type_label,
      icon: row.type_icon,
      matchedIn: field?.label || row.field_key,
      context: String(row.matched_value || '').slice(0, 120),
      rank: 3,
    });
  }

  return [...results.values()]
    .sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title))
    .slice(0, rowCap);
}
