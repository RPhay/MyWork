#!/usr/bin/env node

/**
 * One-off data fix: converge every typed page onto one behavior.
 *
 * Two things had drifted from what `phase0-seed-entity-types.js` intends:
 *
 * 1. `supports_hierarchy` was 0 for goal/task/ticket, so those tabs rendered
 *    as flat lists while area/to_do/idea/priority rendered as trees - the
 *    tree/flat split is the flag, so the pages genuinely behaved differently.
 *
 * 2. A separate `folder` entity type existed (with folder->area and
 *    folder->folder rules) as a second, competing folder design alongside the
 *    `entities.is_folder` column. It was only ever wired into the Categories
 *    tab and never held a single row. `is_folder` is the design that survives:
 *    a folder is a row of the page's own type, so folders are page-scoped for
 *    free and the existing self-nesting hierarchy rules already allow types
 *    under types, types under folders, and folders under folders.
 *
 * The seed script has been updated to match, so a fresh `db:init` comes out
 * right; this script is only for databases that predate that change.
 * Idempotent - safe to re-run.
 */

import { query, getCurrentConfig } from '../src/database/connectionPool.js';

const HIERARCHY_TYPES = ['area', 'goal', 'to_do', 'task', 'ticket', 'idea', 'priority'];

async function main() {
  const config = getCurrentConfig();
  console.log(`📦 Using database: ${config.database.host}/${config.database.database}`);

  // 1. Every typed page nests.
  const placeholders = HIERARCHY_TYPES.map(() => '?').join(', ');
  const flags = await query(
    `UPDATE entity_types SET supports_hierarchy = 1 WHERE slug IN (${placeholders})`,
    HIERARCHY_TYPES
  );
  console.log(`✅ supports_hierarchy = 1 for ${HIERARCHY_TYPES.join(', ')} (${flags.affectedRows} rows touched)`);

  // 1b. Templates DO nest, and are the one type that may contain any other
  //     type - that is what a template is. This previously set the flag to 0,
  //     from a time when templates had no containment rules to back it; both
  //     the flag and the rules now live in systemEntityTypes.js.
  const tmpl = await query("UPDATE entity_types SET supports_hierarchy = 1 WHERE slug = 'template'");
  console.log(`✅ supports_hierarchy = 1 for template (${tmpl.affectedRows} rows touched)`);

  // 2. Every hierarchical type needs a self-nesting rule or the relationship
  //    service rejects the edge. goal was the one missing.
  for (const slug of HIERARCHY_TYPES) {
    const rows = await query('SELECT id FROM entity_types WHERE slug = ? AND deleted_at IS NULL', [slug]);
    if (rows.length === 0) {
      console.log(`⏭️  No such type: ${slug}`);
      continue;
    }
    const typeId = rows[0].id;
    const existing = await query(
      "SELECT id FROM entity_type_relationships WHERE parent_type_id = ? AND child_type_id = ? AND relationship_kind = 'hierarchy'",
      [typeId, typeId]
    );
    if (existing.length > 0) continue;
    await query(
      "INSERT INTO entity_type_relationships (parent_type_id, child_type_id, relationship_kind) VALUES (?, ?, 'hierarchy')",
      [typeId, typeId]
    );
    console.log(`✅ Added self-nesting hierarchy rule: ${slug} → ${slug}`);
  }

  // 3. Retire the `folder` type. Refuse if it somehow holds rows - the whole
  //    reason this is safe is that it never did.
  const folderRows = await query("SELECT id FROM entity_types WHERE slug = 'folder'");
  if (folderRows.length === 0) {
    console.log('⏭️  No `folder` type to retire');
  } else {
    const folderTypeId = folderRows[0].id;
    const entityCount = await query('SELECT COUNT(*) AS n FROM entities WHERE entity_type_id = ?', [folderTypeId]);
    if (entityCount[0].n > 0) {
      throw new Error(
        `Refusing to retire the folder type: ${entityCount[0].n} entities still use it. ` +
        'Migrate them to is_folder = 1 rows of their page type first.'
      );
    }
    const rules = await query(
      'DELETE FROM entity_type_relationships WHERE parent_type_id = ? OR child_type_id = ?',
      [folderTypeId, folderTypeId]
    );
    await query('UPDATE entity_types SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL', [folderTypeId]);
    console.log(`✅ Retired the \`folder\` type (soft-deleted, ${rules.affectedRows} type-relationship rules removed)`);
  }

  console.log('\n✨ Done.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
