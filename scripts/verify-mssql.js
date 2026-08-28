/**
 * Prove an MSSQL install is actually correct, by running it.
 *
 * This project's rule is that a T-SQL translation is verified by RUNNING it,
 * not by reading it - four build-stopping faults shipped past review before
 * that was written down. This script is that run, in one command.
 *
 * It checks, in order:
 *
 *   1. The connection works and reports which database it is on.
 *   2. The schema applies (idempotent - safe to re-run).
 *   3. EVERY table lives in [MyWork] and NONE in dbo. Nothing ever falls back
 *      to dbo: an unqualified name does not fail there, it resolves against
 *      the login's default schema and quietly succeeds somewhere else, so a
 *      row saves, reports success, and is never seen again.
 *   4. The tables today's work added are present with their columns, trigger
 *      and filtered unique index.
 *   5. A real create -> list -> delete round trip through the app's own
 *      services, which is the thing that was reported broken.
 *
 * Read-only apart from step 2 (schema, idempotent) and step 5, which deletes
 * everything it creates. Nothing else is written.
 *
 *   node scripts/verify-mssql.js
 *
 * Exits non-zero if any check fails, so it can gate a deploy.
 */

import config from "../src/config/environment.js";
import { query } from "../src/database/connectionPool.js";
import * as db from "../src/database/homePool.js";
import * as entityService from "../src/services/entityService.js";
import { getActiveContextId } from "../src/services/activeContextService.js";

const PREFIX = "ZZZ verify-mssql";
let failures = 0;

function pass(label, detail = "") {
  console.log(`  PASS  ${label}${detail ? " - " + detail : ""}`);
}
function fail(label, detail = "") {
  failures += 1;
  console.log(`  FAIL  ${label}${detail ? " - " + detail : ""}`);
}
function section(title) {
  console.log(`\n${title}`);
  console.log("-".repeat(72));
}

async function main() {
  section("1. Connection");
  if (config.database.type !== "mssql") {
    console.log(
      `  This install is '${config.database.type}', not mssql.\n` +
        "  Run this on the SQL Server machine - there is nothing to verify here.",
    );
    process.exit(0);
  }
  const who = await query(
    "SELECT DB_NAME() AS db, SCHEMA_NAME() AS default_schema, SUSER_SNAME() AS login",
  );
  pass("connected", `db=${who[0].db} default_schema=${who[0].default_schema}`);
  if (String(who[0].default_schema).toLowerCase() === "dbo") {
    console.log(
      "  NOTE: the login's default schema is dbo. That is exactly why every\n" +
        "  statement must name [MyWork] explicitly - an unqualified one would\n" +
        "  silently land in dbo.",
    );
  }

  section("2. Schema applies");
  try {
    const { createMssqlSchema } = await import(
      "../src/database/schema/mssqlSchema.js"
    );
    const mssql = await import("mssql");
    const pool = await new mssql.default.ConnectionPool({
      server: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.name,
      options: { encrypt: true, trustServerCertificate: true },
    }).connect();
    await createMssqlSchema(pool);
    await pool.close();
    pass("createMssqlSchema ran without error");
  } catch (error) {
    fail("createMssqlSchema threw", error.message);
  }

  section("3. Nothing lives in dbo");
  const tables = await query(`
    SELECT TABLE_SCHEMA AS s, TABLE_NAME AS t
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
  `);
  const inDbo = tables.filter((r) => String(r.s).toLowerCase() === "dbo");
  const inMyWork = tables.filter((r) => String(r.s).toLowerCase() === "mywork");
  pass("tables in [MyWork]", String(inMyWork.length));
  if (inDbo.length === 0) {
    pass("tables in dbo", "none, which is the only acceptable answer");
  } else {
    fail("tables in dbo", inDbo.map((r) => r.t).join(", "));
    const both = inDbo.filter((d) =>
      inMyWork.some((m) => m.t.toLowerCase() === d.t.toLowerCase()),
    );
    if (both.length) {
      console.log(
        `        ** ${both.map((r) => r.t).join(", ")} exist in BOTH schemas.\n` +
          "        One statement writes dbo, another reads [MyWork]. This is\n" +
          "        the cause of 'it saved but it never appeared'.\n" +
          "        Fix with: node scripts/rescue-dbo-tables.js **",
      );
    }
  }

  section("4. Today's schema additions");
  const need = ["users", "contexts", "entities", "user_identities"];
  for (const t of need) {
    const found = inMyWork.some((r) => r.t.toLowerCase() === t);
    found ? pass(`[MyWork].[${t}]`) : fail(`[MyWork].[${t}] missing`);
  }

  const userCols = await query(`
    SELECT COLUMN_NAME AS c FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'MyWork' AND TABLE_NAME = 'users'
  `);
  userCols.some((r) => r.c === "email")
    ? pass("users.email present")
    : fail("users.email missing");

  const idx = await query(`
    SELECT name, has_filter FROM sys.indexes
    WHERE object_id = OBJECT_ID('[MyWork].[users]') AND name = 'unique_users_email'
  `);
  if (idx.length === 0) {
    fail("unique_users_email index missing");
  } else if (!idx[0].has_filter) {
    // Unfiltered UNIQUE permits exactly ONE null on SQL Server, so the second
    // profile without an address would be rejected.
    fail("unique_users_email is NOT filtered", "a second profile with no email will be rejected");
  } else {
    pass("unique_users_email is a filtered unique index");
  }

  const trig = await query(`
    SELECT name FROM sys.triggers WHERE parent_id = OBJECT_ID('[MyWork].[user_identities]')
  `);
  trig.length
    ? pass("user_identities updated_at trigger", trig[0].name)
    : fail("user_identities has no updated_at trigger");

  const staleTrig = await query(`
    SELECT name FROM sys.triggers WHERE name LIKE '%sso_identities%'
  `);
  staleTrig.length === 0
    ? pass("no leftover sso_identities trigger")
    : fail("leftover sso_identities trigger", staleTrig.map((r) => r.name).join(", "));

  section("5. Create -> list -> delete, through the app's own services");
  let created = null;
  try {
    const contextId = await getActiveContextId();
    created = await entityService.createEntity(
      "category",
      { title: `${PREFIX} category` },
      contextId,
    );
    created?.id
      ? pass("createEntity returned a row", `id ${created.id}`)
      : fail("createEntity returned no id", "SCOPE_IDENTITY did not come back");

    const listed = await entityService.getAllEntities("category", contextId);
    listed.some((e) => e.id === created.id)
      ? pass("the new row IS returned by the list query")
      : fail(
          "the new row is NOT in the list",
          "this is the reported bug - run scripts/diagnose-missing-entity.js",
        );

    // Field values go through the upsert, whose MERGE target was unqualified
    // until 2026-08-27. Exercised explicitly because nothing else here does.
    await entityService.updateEntity(created.id, {
      fields: { description: "verify-mssql probe" },
    });
    const reread = await entityService.getEntityById(created.id, contextId);
    reread?.fields?.description === "verify-mssql probe"
      ? pass("field value round-tripped through the MERGE upsert")
      : fail("field value did not round-trip", JSON.stringify(reread?.fields));
  } catch (error) {
    fail("round trip threw", error.message);
  } finally {
    if (created?.id) {
      await query("DELETE FROM entity_field_values WHERE entity_id = ?", [created.id]);
      await query("DELETE FROM entities WHERE id = ?", [created.id]);
      const left = await query("SELECT COUNT(*) AS c FROM entities WHERE title LIKE ?", [`${PREFIX}%`]);
      Number(left[0].c) === 0
        ? pass("test row removed")
        : fail("test rows left behind", String(left[0].c));
    }
  }

  section(failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
  console.log();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\nverify-mssql failed to run:", error.message);
  process.exit(1);
});
