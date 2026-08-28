/**
 * Move anything stranded in dbo into [MyWork], and drop the dbo copies.
 *
 * THE dbo SCHEMA ITSELF IS NEVER DROPPED. Every destructive statement in this
 * file is DROP TABLE, DROP CONSTRAINT, or ALTER SCHEMA TRANSFER against a
 * NAMED table - there is no DROP SCHEMA anywhere, and dbo is a schema SQL
 * Server requires. Only the specific tables listed in the plan are touched,
 * and each is dumped to disk immediately before it goes.
 *
 * NOTHING EVER FALLS BACK TO dbo - see CLAUDE.md. The code now qualifies
 * every statement and refuses to run one that does not, but that only stops
 * NEW writes going astray. Rows written to dbo.<table> while the pools were
 * unqualified are still sitting there, invisible to an app that now reads
 * [MyWork] exclusively. Only moving them gets them back.
 *
 * ONLY A TWIN CAUSES THE BUG, and that is the whole basis of what this
 * touches. A table that exists in BOTH dbo and [MyWork] is one the app reads
 * from [MyWork] and has been writing to dbo; those two halves have to become
 * one. A dbo table with NO twin is not that - it is something older (`areas`,
 * from before Areas became Categories, is the likely shape) and the app does
 * not read it under either schema. Sweeping those into [MyWork] would
 * resurrect names the retired-table tooling expects to be gone, so they are
 * REPORTED AND LEFT ALONE unless you ask for them by name.
 *
 *   twin, dbo copy empty      -> drop the dbo copy. It is a decoy.
 *   twin, dbo copy holds rows -> COPY the rows into [MyWork], then drop dbo.
 *                                Identity values are preserved where the id
 *                                is free; a clash is REPORTED, never
 *                                silently renumbered.
 *   no twin                   -> listed, untouched. --include-orphans
 *                                TRANSFERS them into [MyWork] instead
 *                                (moved, not copied - no renumbering, and no
 *                                window where the rows exist twice).
 *
 * DRY RUN BY DEFAULT. Prints the plan and writes nothing:
 *
 *   node scripts/rescue-dbo-tables.js
 *   node scripts/rescue-dbo-tables.js --apply
 *   node scripts/rescue-dbo-tables.js --include-orphans --apply
 *   node scripts/rescue-dbo-tables.js --force --apply
 *   node scripts/rescue-dbo-tables.js --drop-dbo-tables --apply
 *
 * --drop-dbo-tables copies NOTHING. Every dbo table is dumped and dropped, treating
 * [MyWork] as already correct. The blunt option, and the right one when the
 * dbo copies are known to be worthless - but it discards their rows, so read
 * the previews before using it.
 *
 * --force resolves an id CLASH by keeping [MyWork]'s row and discarding
 * dbo's. Rows whose ids do not clash are still copied, so only the contested
 * ones are lost, and the dump written before the drop holds every dbo row
 * regardless. Look at the previews first: for a lookup table like `years` the
 * two rows are almost certainly the same data, but for `contexts` it decides
 * which side's context you keep.
 *
 * Take a database backup before --apply. This moves data.
 */

import fs from "fs";
import path from "path";
import config from "../src/config/environment.js";
import { query } from "../src/database/connectionPool.js";

const APPLY = process.argv.includes("--apply");
const INCLUDE_ORPHANS = process.argv.includes("--include-orphans");
// Drop a dbo copy even when some of its ids already exist in [MyWork].
// Non-clashing rows are still copied; the clashing ones are DISCARDED, and
// [MyWork]'s version of that id is the one that survives.
const FORCE = process.argv.includes("--force");
// Copy NOTHING. Dump every dbo table and drop it, treating [MyWork] as
// already correct. The blunt option, for when the dbo copies are known to be
// worthless and the only thing wanted is them gone.
const DROP_DBO_TABLES = process.argv.includes("--drop-dbo-tables");


// Nothing in dbo is dropped before its rows are on disk.
//
// This runs on a machine whose output cannot easily be reviewed first, so
// "read the dry run and decide" is not available. A dump costs a file and
// makes every drop reversible, which is the property that actually matters
// when the plan cannot be checked in advance.
async function dumpBeforeDrop(table) {
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `dbo-rescue-${table}.json`);
  const rows = await query(`SELECT * FROM [dbo].[${table}]`);
  fs.writeFileSync(file, JSON.stringify(rows, null, 1));
  return { file, count: rows.length };
}


// What is actually IN a table, briefly.
//
// The plan's row counts say how much is on each side but not WHICH side is
// the real one, and that is the only question worth asking before merging
// two populated tables. A handful of rows answers it at a glance - an empty
// [MyWork].contexts beside a dbo.contexts holding your actual contexts is
// obvious the moment you can see them, and invisible from counts alone.
const PREVIEW_ROWS = 5;

async function previewTable(schema, table) {
  const cols = await query(
    `SELECT COLUMN_NAME AS c, DATA_TYPE AS t
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [schema, table],
  );
  if (cols.length === 0) return ["    (no columns)"];

  // Prefer the columns a person can recognise a row by. Falls back to the
  // first few, so a table with none of these still shows something.
  const preferred = ["id", "name", "title", "label", "slug", "email", "created_at"];
  const names = cols.map((r) => r.c);
  const shown = [
    ...preferred.filter((n) => names.includes(n)),
    ...names.filter((n) => !preferred.includes(n)),
  ].slice(0, 5);

  const select = shown.map((n) => `[${n}]`).join(", ");
  let rows;
  try {
    rows = await query(
      `SELECT TOP ${PREVIEW_ROWS} ${select} FROM [${schema}].[${table}]`,
    );
  } catch (error) {
    return [`    (could not read: ${error.message})`];
  }
  if (rows.length === 0) return ["    (empty)"];

  const fmt = (v) => {
    if (v === null || v === undefined) return "-";
    const str = v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
    return str.length > 28 ? str.slice(0, 27) + "\u2026" : str;
  };

  return [
    "    " + shown.join(" | "),
    ...rows.map((r) => "    " + shown.map((n) => fmt(r[n])).join(" | ")),
  ];
}

function line() {
  console.log("-".repeat(72));
}

async function main() {
  if (config.database.type !== "mssql") {
    console.log(
      `\nThis install is '${config.database.type}'. dbo is a SQL Server concept -` +
        " nothing to do here.\n",
    );
    return;
  }

  const tables = await query(`
    SELECT TABLE_SCHEMA AS s, TABLE_NAME AS t
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA IN ('dbo','MyWork')
    ORDER BY TABLE_NAME
  `);

  const dbo = tables.filter((r) => String(r.s).toLowerCase() === "dbo");
  const mine = new Set(
    tables
      .filter((r) => String(r.s).toLowerCase() === "mywork")
      .map((r) => r.t.toLowerCase()),
  );

  if (dbo.length === 0) {
    console.log("\nNothing in dbo. This install is clean.\n");
    return;
  }

  console.log(`\n${dbo.length} table(s) in dbo:`);
  line();

  const plan = [];
  for (const { t } of dbo) {
    const rows = await query(`SELECT COUNT(*) AS c FROM [dbo].[${t}]`);
    const count = Number(rows[0].c);
    const twin = mine.has(t.toLowerCase());
    let twinCount = null;
    if (twin) {
      const tw = await query(`SELECT COUNT(*) AS c FROM [MyWork].[${t}]`);
      twinCount = Number(tw[0].c);
    }

    const action = DROP_DBO_TABLES
      ? !twin && !INCLUDE_ORPHANS
        ? "SKIP (no twin)"
        : "DROP"
      : !twin
        ? INCLUDE_ORPHANS
          ? "TRANSFER"
          : "SKIP (no twin)"
        : count === 0
          ? "DROP"
          : "COPY-THEN-DROP";

    plan.push({ table: t, count, twin, twinCount, action });
    console.log(
      `  dbo.${t}  rows=${count}` +
        (twin ? `  [MyWork].${t} rows=${twinCount}` : "  (no [MyWork] twin)") +
        `  -> ${action}`,
    );

    // Show BOTH sides for a twin - which one holds the real data is the
    // whole question, and counts alone do not answer it.
    console.log(`    --- dbo.${t} ---`);
    for (const l of await previewTable("dbo", t)) console.log(l);
    if (twin) {
      console.log(`    --- [MyWork].${t} ---`);
      for (const l of await previewTable("MyWork", t)) console.log(l);
    }
    console.log("");
  }
  line();

  if (DROP_DBO_TABLES) {
    const losing = plan.filter((p) => p.action === "DROP" && p.count > 0);
    console.log(
      "\n** --drop-dbo-tables: nothing is copied. " +
        (losing.length
          ? losing.map((p) => `${p.table} (${p.count} rows)`).join(", ") +
            " will be dumped and DISCARDED."
          : "All the dbo copies are empty, so nothing is lost.") +
        "\n   [MyWork] is treated as already correct. Every dbo table is still" +
        "\n   dumped to data/dbo-rescue-<table>.json first. **",
    );
  }

  const skipped = plan.filter((p) => p.action.startsWith("SKIP"));
  if (skipped.length) {
    console.log(
      "\nLeft alone (no [MyWork] twin, so not the cause of the bug): " +
        skipped.map((p) => `${p.table} (${p.count} rows)`).join(", ") +
        "\nThese are older tables the app does not read under either schema." +
        "\nPass --include-orphans to move them into [MyWork] as well.",
    );
  }

  // Both sides holding rows is the one case that MERGES two populated tables
  // rather than moving one. Ids are checked for clashes and a clash refuses,
  // but non-clashing rows from both sides end up side by side - which for
  // contexts or users means duplicates to tidy, not data lost.
  const merging = plan.filter(
    (p) => p.action === "COPY-THEN-DROP" && p.twinCount > 0,
  );
  if (merging.length) {
    console.log(
      "\n** Both schemas hold rows for: " +
        merging.map((p) => `${p.table} (dbo ${p.count} / MyWork ${p.twinCount})`).join(", ") +
        "\n   These MERGE. Ids that clash refuse outright; ids that do not will" +
        "\n   sit alongside each other, so expect duplicates to tidy afterwards." +
        "\n   Every dbo table is dumped to data/dbo-rescue-<table>.json first. **",
    );
  }

  const risky = plan.filter((p) => p.action === "COPY-THEN-DROP");
  if (risky.length) {
    console.log(
      "\nBoth schemas hold rows for: " +
        risky.map((p) => p.table).join(", ") +
        "\nThose rows are COPIED into [MyWork]. Identity values are kept where\n" +
        "the id is free; a clash is reported, never silently renumbered.",
    );
  }

  if (!APPLY) {
    console.log("\nDRY RUN - nothing written. Re-run with --apply.\n");
    return;
  }

  console.log("\nApplying:");
  line();

  // ---- Phase 1: clear the foreign keys that make this impossible in place.
  //
  // Two different FK problems, and both stop the naive version dead:
  //
  //   DROP TABLE [dbo].[x] fails while any other dbo table points at it, and
  //   the drops have no safe order to be in - a cycle has none at all.
  //
  //   INSERT INTO [MyWork].[x] fails when a child row arrives before its
  //   parent, which is decided by the order tables happen to be listed in.
  //
  // Dropping dbo's own FKs is free: those tables are being removed anyway.
  // [MyWork]'s FKs are DISABLED for the copy and re-enabled WITH CHECK
  // afterwards, which re-validates every row rather than leaving the
  // constraint merely switched off.
  const dboKeys = await query(`
    SELECT fk.name AS fkName, t.name AS tableName
    FROM sys.foreign_keys fk
    JOIN sys.tables t ON t.object_id = fk.parent_object_id
    WHERE SCHEMA_NAME(t.schema_id) = 'dbo'
  `);
  for (const k of dboKeys) {
    try {
      await query(`ALTER TABLE [dbo].[${k.tableName}] DROP CONSTRAINT [${k.fkName}]`);
    } catch (error) {
      console.log(`  could not drop dbo FK ${k.fkName}: ${error.message}`);
    }
  }
  if (dboKeys.length) {
    console.log(`  dropped ${dboKeys.length} foreign key(s) inside dbo`);
  }

  const copyTargets = plan
    .filter((x) => x.action === "COPY-THEN-DROP")
    .map((x) => x.table);

  for (const t of copyTargets) {
    await query(`ALTER TABLE [MyWork].[${t}] NOCHECK CONSTRAINT ALL`).catch(
      () => {},
    );
  }

  // ---- Phase 2: move the data.
  for (const p of plan) {
    try {
      if (p.action.startsWith("SKIP")) continue;

      if (p.action === "TRANSFER") {
        // ALTER SCHEMA moves the table itself - no copy, no id renumbering,
        // no window where the rows exist twice.
        await query(`ALTER SCHEMA [MyWork] TRANSFER [dbo].[${p.table}]`);
        console.log(`  moved dbo.${p.table} -> [MyWork].${p.table} (${p.count} rows)`);
        continue;
      }

      if (p.action === "DROP") {
        const dump = await dumpBeforeDrop(p.table);
        await query(`DROP TABLE [dbo].[${p.table}]`);
        console.log(
          `  dropped dbo.${p.table} - ${dump.count} row(s) NOT copied, dumped to ${dump.file}`,
        );
        continue;
      }

      // COPY-THEN-DROP. Only the columns [MyWork] actually has: a dbo copy
      // can predate a column being added, or carry one since removed, and
      // naming dbo's list would fail on both.
      const cols = await query(
        `SELECT c.COLUMN_NAME AS c
         FROM INFORMATION_SCHEMA.COLUMNS c
         WHERE c.TABLE_SCHEMA = 'dbo' AND c.TABLE_NAME = ?
           AND EXISTS (
             SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS m
             WHERE m.TABLE_SCHEMA = 'MyWork' AND m.TABLE_NAME = c.TABLE_NAME
               AND m.COLUMN_NAME = c.COLUMN_NAME
           )
         ORDER BY c.ORDINAL_POSITION`,
        [p.table],
      );
      if (cols.length === 0) {
        console.log(`  SKIPPED ${p.table} - no columns in common with [MyWork]`);
        continue;
      }
      const names = cols.map((r) => `[${r.c}]`).join(", ");

      const clash = await query(
        `SELECT COUNT(*) AS c FROM [dbo].[${p.table}] d
         WHERE EXISTS (SELECT 1 FROM [MyWork].[${p.table}] m WHERE m.id = d.id)`,
      ).catch(() => [{ c: 0 }]);

      const clashCount = Number(clash[0].c);
      if (clashCount > 0 && !FORCE) {
        console.log(
          `  SKIPPED dbo.${p.table} - ${clashCount} row(s) share an id with` +
            " [MyWork]. Reconcile by hand, or re-run with --force to keep" +
            " [MyWork]'s version of those ids and discard dbo's.",
        );
        continue;
      }

      // --force: copy everything that does NOT clash, so only the genuinely
      // contested ids are lost, and say exactly how many those are. The dump
      // written just before the drop holds all of them either way.
      const onlyNew = clashCount > 0;
      if (onlyNew) {
        console.log(
          `  FORCED dbo.${p.table} - ${clashCount} row(s) share an id with` +
            " [MyWork] and will be DISCARDED ([MyWork] wins); the rest are copied.",
        );
      }

      const hasIdentity = await query(
        `SELECT COUNT(*) AS c FROM sys.identity_columns
         WHERE object_id = OBJECT_ID('[MyWork].[${p.table}]')`,
      );
      const identity = Number(hasIdentity[0].c) > 0;

      if (identity) await query(`SET IDENTITY_INSERT [MyWork].[${p.table}] ON`);
      try {
        await query(
          `INSERT INTO [MyWork].[${p.table}] (${names})
           SELECT ${names} FROM [dbo].[${p.table}] d` +
            (onlyNew
              ? ` WHERE NOT EXISTS (
                   SELECT 1 FROM [MyWork].[${p.table}] m WHERE m.id = d.id)`
              : ""),
        );
      } finally {
        if (identity) {
          await query(`SET IDENTITY_INSERT [MyWork].[${p.table}] OFF`).catch(() => {});
        }
      }

      const dump = await dumpBeforeDrop(p.table);
      await query(`DROP TABLE [dbo].[${p.table}]`);
      console.log(
        `  copied ${p.count} row(s) from dbo.${p.table}, dropped dbo copy` +
          ` (dump: ${dump.file})`,
      );
    } catch (error) {
      console.log(`  FAILED on ${p.table}: ${error.message}`);
    }
  }

  // ---- Phase 3: put [MyWork]'s constraints back, and CHECK them.
  //
  // WITH CHECK re-validates existing rows. A constraint left merely switched
  // off is worse than the problem this script fixes: the database stops
  // enforcing a rule while continuing to claim it. Anything that fails
  // validation is named, and the untrusted list is printed afterwards so a
  // failure here cannot pass unnoticed.
  for (const t of copyTargets) {
    try {
      await query(`ALTER TABLE [MyWork].[${t}] WITH CHECK CHECK CONSTRAINT ALL`);
    } catch (error) {
      console.log(
        `  ** [MyWork].[${t}] has rows its foreign keys reject: ${error.message}\n` +
          "     The copied rows reference parents that do not exist. Reconcile\n" +
          "     them, then re-run: ALTER TABLE ... WITH CHECK CHECK CONSTRAINT ALL",
      );
    }
  }

  const untrusted = await query(`
    SELECT t.name AS tableName, fk.name AS fkName
    FROM sys.foreign_keys fk
    JOIN sys.tables t ON t.object_id = fk.parent_object_id
    WHERE SCHEMA_NAME(t.schema_id) = 'MyWork'
      AND (fk.is_disabled = 1 OR fk.is_not_trusted = 1)
  `);
  if (untrusted.length) {
    line();
    console.log(
      `** ${untrusted.length} foreign key(s) in [MyWork] are disabled or not trusted:`,
    );
    for (const u of untrusted) {
      console.log(`   ${u.tableName}.${u.fkName}`);
    }
    console.log(
      "   SQL Server is no longer enforcing these. Fix the data they reject,\n" +
        "   then re-run WITH CHECK CHECK CONSTRAINT ALL on those tables.",
    );
  }

  const left = await query(`
    SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = 'dbo'
  `);
  line();
  const stillSkipped = plan.filter((p) => p.action.startsWith("SKIP")).length;
  console.log(
    Number(left[0].c) === 0
      ? "\ndbo is empty. Re-run scripts/verify-mssql.js to confirm.\n"
      : stillSkipped === Number(left[0].c)
        ? `\n${left[0].c} table(s) still in dbo, all of them deliberately skipped` +
          " orphans. The duplicate-table bug is fixed; those are a separate" +
          " decision.\n"
        : `\n${left[0].c} table(s) still in dbo - see the messages above.\n`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nFailed:", error.message);
    process.exit(1);
  });
