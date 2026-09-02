/**
 * "A hierarchical type can't nest under itself - dragging an item into its
 * own folder is refused with 'Relationship not allowed: hierarchy from
 * parent type N to child type N'."
 *
 * ensureSelfNestingRule() in entityTypeService.js is supposed to keep exactly
 * one entity_type_relationships row (parent_type_id = child_type_id = N,
 * relationship_kind = 'hierarchy') for every type with supports_hierarchy
 * set - written on create, and re-checked on every save so turning the flag
 * on later still backfills it. A folder is not a special case: it is an
 * ordinary row of the same type (is_folder = 1), so this ONE row is what
 * permits every same-type drop, folder or not.
 *
 * This asks the database directly whether that row is actually there, and -
 * on MSSQL - whether entity_type_relationships itself has landed in the
 * wrong SCHEMA (dbo vs [MyWork], see CLAUDE.md's "NOTHING EVER FALLS BACK TO
 * dbo" section), which is the other way a row can exist and still be
 * invisible to the app.
 *
 *   node scripts/diagnose-self-nesting.js --type <slug>
 *   node scripts/diagnose-self-nesting.js --id <id>
 *   node scripts/diagnose-self-nesting.js --id <id> --fix
 *
 * Read-only unless --fix is passed. --fix only ever INSERTs the single
 * missing self-nesting row (the exact statement ensureSelfNestingRule()
 * itself runs) - it never deletes or modifies anything else.
 */

import { query } from "../src/database/connectionPool.js";
import { getActiveContextId } from "../src/services/activeContextService.js";
import config from "../src/config/environment.js";

const args = process.argv.slice(2);
const argAfter = (flag) => {
  const i = args.indexOf(flag);
  return i === -1 ? null : args[i + 1];
};
const TYPE_SLUG = argAfter("--type");
const TYPE_ID = argAfter("--id");
const FIX = args.includes("--fix");

function line() {
  console.log("-".repeat(72));
}

async function reportSchemaPlacement() {
  const schemas = await query(`
    SELECT TABLE_SCHEMA, TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME = 'entity_type_relationships'
    ORDER BY TABLE_SCHEMA
  `);
  console.log("entity_type_relationships lives in:");
  for (const r of schemas) {
    console.log(`  ${r.TABLE_SCHEMA}.${r.TABLE_NAME}`);
  }
  if (schemas.length > 1) {
    console.log(
      "\n  ** The table exists in MORE THAN ONE schema. A row can land in dbo while\n" +
        "     the app reads [MyWork] exclusively - see 'NOTHING EVER FALLS BACK TO\n" +
        "     dbo' in CLAUDE.md. That would explain a row this script cannot find\n" +
        "     here but that a direct query against dbo might still show. **",
    );
  }
  console.log();
}

async function main() {
  if (!TYPE_SLUG && !TYPE_ID) {
    console.log(
      "Usage: node scripts/diagnose-self-nesting.js --type <slug>\n" +
        "   or: node scripts/diagnose-self-nesting.js --id <id> [--fix]",
    );
    process.exit(1);
  }

  const engine = config.database.type;
  console.log(`\nEngine: ${engine}`);
  const contextId = await getActiveContextId();
  console.log(`Active context: ${contextId}`);
  line();

  const types = TYPE_ID
    ? await query(
        "SELECT id, slug, label, supports_hierarchy, supports_folders FROM entity_types WHERE id = ?",
        [TYPE_ID],
      )
    : await query(
        "SELECT id, slug, label, supports_hierarchy, supports_folders FROM entity_types WHERE slug = ?",
        [TYPE_SLUG],
      );

  if (types.length === 0) {
    console.log(
      `No entity type found for ${TYPE_ID ? `id ${TYPE_ID}` : `slug '${TYPE_SLUG}'`} in this context's database.`,
    );
    return;
  }
  const type = types[0];
  console.log(`Type: ${type.label} (slug ${type.slug}, id ${type.id})`);
  console.log(`  supports_hierarchy = ${type.supports_hierarchy}`);
  console.log(`  supports_folders   = ${type.supports_folders}`);
  line();

  if (!type.supports_hierarchy) {
    console.log(
      "VERDICT: supports_hierarchy is OFF for this type in the database.\n" +
        "The Settings UI may be showing the checkbox checked without it having\n" +
        "actually saved - re-check it, Save, then run this script again.",
    );
    return;
  }

  // Every relationship row mentioning this type at all, either side - shows
  // the self-nesting row (if present) alongside anything else (e.g. "can be
  // dropped into a Template"), so a wrong-but-nonempty match is visible too.
  const allRels = await query(
    "SELECT id, parent_type_id, child_type_id, relationship_kind FROM entity_type_relationships WHERE parent_type_id = ? OR child_type_id = ?",
    [type.id, type.id],
  );
  console.log(`entity_type_relationships rows mentioning type ${type.id}:`);
  if (allRels.length === 0) {
    console.log("  (none)");
  } else {
    for (const r of allRels) {
      console.log(`  #${r.id}  parent=${r.parent_type_id}  child=${r.child_type_id}  kind=${r.relationship_kind}`);
    }
  }
  line();

  // The EXACT check ensureSelfNestingRule() runs before deciding whether to
  // insert - reproduced verbatim, so this reports what the app's own logic
  // saw rather than a looser approximation of it.
  const selfRow = await query(
    "SELECT id FROM entity_type_relationships WHERE parent_type_id = ? AND child_type_id = ? AND relationship_kind = 'hierarchy'",
    [type.id, type.id],
  );

  if (selfRow.length > 0) {
    console.log(`VERDICT: the self-nesting row EXISTS (id ${selfRow[0].id}).`);
    console.log(
      "If the drop is still refused, the running app is not seeing the row this\n" +
        "script just found - worth checking whether the browser has a stale copy of\n" +
        "this type's relationships (hard reload), or whether the live app pool is\n" +
        "pointed at a different database/context than this script used.",
    );
    line();
    if (engine === "mssql") await reportSchemaPlacement();
    return;
  }

  console.log("VERDICT: the self-nesting row is MISSING. This is why the drop is refused -");
  console.log(`entityRelationshipService has nothing permitting hierarchy from type ${type.id} to itself.`);
  line();

  if (engine === "mssql") await reportSchemaPlacement();

  if (FIX) {
    console.log(`Inserting the missing row (parent=${type.id}, child=${type.id}, kind=hierarchy)...`);
    await query(
      "INSERT INTO entity_type_relationships (parent_type_id, child_type_id, relationship_kind) VALUES (?, ?, 'hierarchy')",
      [type.id, type.id],
    );
    console.log("Done. Reload the app and try the drop again.");
  } else {
    console.log(`Run again with --fix to insert it: node scripts/diagnose-self-nesting.js --id ${type.id} --fix`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nFailed:", error.message);
    process.exit(1);
  });
