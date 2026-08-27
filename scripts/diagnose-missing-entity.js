/**
 * "It saved, but it isn't in the list."
 *
 * Splits that symptom into its three possible causes, on EITHER engine, by
 * asking the database directly rather than trusting the app:
 *
 *   1. The row is not there        -> the INSERT did not land where we think.
 *   2. The row is there but the LIST query does not return it -> the filters
 *      (context_id, deleted_at, entity_type_id) disagree with what was saved.
 *   3. Both are fine               -> the server is right and the browser is
 *      not refreshing; a page reload would show it.
 *
 * On SQL Server it also reports WHICH SCHEMA each table is in. This project's
 * rule is that everything lives in [MyWork] and never dbo, and an unqualified
 * name falls back to dbo silently - so an INSERT landing in dbo.entities while
 * the SELECT reads [MyWork].entities produces exactly this symptom.
 *
 *   node scripts/diagnose-missing-entity.js
 *   node scripts/diagnose-missing-entity.js --type category
 *
 * Read-only. It writes nothing.
 */

import { query } from "../src/database/connectionPool.js";
import { getActiveContextId } from "../src/services/activeContextService.js";
import * as entityService from "../src/services/entityService.js";
import config from "../src/config/environment.js";

const args = process.argv.slice(2);
const typeIdx = args.indexOf("--type");
const TYPE_SLUG = typeIdx === -1 ? "category" : args[typeIdx + 1];

function line() {
  console.log("-".repeat(72));
}

async function main() {
  const engine = config.database.type;
  console.log(`\nEngine: ${engine}`);
  const contextId = await getActiveContextId();
  console.log(`Active context: ${contextId}`);
  line();

  if (engine === "mssql") {
    // Which schema do the tables actually live in? Two rows for the same
    // table name is the smoking gun for the dbo/[MyWork] split.
    const schemas = await query(`
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME IN ('entities','entity_field_values','entity_types')
      ORDER BY TABLE_NAME, TABLE_SCHEMA
    `);
    console.log("Tables and their schemas:");
    for (const r of schemas) {
      console.log(`  ${r.TABLE_SCHEMA}.${r.TABLE_NAME}`);
    }
    const dupes = schemas.filter(
      (r, _i, all) =>
        all.filter((x) => x.TABLE_NAME === r.TABLE_NAME).length > 1,
    );
    if (dupes.length) {
      console.log(
        "\n  ** The same table exists in TWO schemas. That alone explains a row\n" +
          "     that saves and never appears: one statement writes to dbo and\n" +
          "     another reads [MyWork]. **",
      );
    }
    line();
  }

  const types = await query(
    "SELECT id, slug, label FROM entity_types WHERE slug = ?",
    [TYPE_SLUG],
  );
  if (types.length === 0) {
    console.log(`No entity type '${TYPE_SLUG}'.`);
    return;
  }
  const type = types[0];
  console.log(`Type: ${type.label} (slug ${type.slug}, id ${type.id})`);

  // 1. Newest rows of that type, ignoring EVERY filter the list applies.
  const raw = await query(
    "SELECT id, title, context_id, entity_type_id, deleted_at, order_index, created_at " +
      "FROM entities WHERE entity_type_id = ? ORDER BY id DESC",
    [type.id],
  ).catch(async () => {
    // TOP/LIMIT differ; fall back to no cap rather than guessing.
    return query(
      "SELECT id, title, context_id, entity_type_id, deleted_at, order_index, created_at " +
        "FROM entities WHERE entity_type_id = ? ORDER BY id DESC",
      [type.id],
    );
  });

  const newest = raw.slice(0, 5);
  console.log(`\nNewest ${newest.length} row(s) of this type, unfiltered:`);
  for (const r of newest) {
    console.log(
      `  #${r.id} ${JSON.stringify(r.title)} context=${r.context_id} ` +
        `deleted=${r.deleted_at ? "YES" : "no"} order=${r.order_index}`,
    );
  }

  // 2. What the app's own list call returns.
  const listed = await entityService.getAllEntities(TYPE_SLUG, contextId);
  const listedIds = new Set(listed.map((e) => e.id));
  console.log(`\nThe list query returns ${listed.length} row(s).`);

  const missing = newest.filter((r) => !listedIds.has(r.id));
  line();
  if (missing.length === 0) {
    console.log(
      "VERDICT: every recent row IS returned by the list query.\n" +
        "The server is right, so the browser is not refreshing after a save -\n" +
        "reloading the page should show them.",
    );
  } else {
    console.log("VERDICT: rows exist but the list query does NOT return them:");
    for (const r of missing) {
      const why = [];
      if (r.deleted_at) why.push("deleted_at is set");
      if (String(r.context_id) !== String(contextId))
        why.push(`context_id ${r.context_id} != active ${contextId}`);
      console.log(
        `  #${r.id} ${JSON.stringify(r.title)} - ${why.join(", ") || "no obvious filter mismatch"}`,
      );
    }
  }
  line();
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nFailed:", error.message);
    process.exit(1);
  });
