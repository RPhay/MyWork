/**
 * Move anything stranded in dbo into [MyWork], and drop the dbo copies.
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
 *
 * Take a database backup before --apply. This moves data.
 */

import config from "../src/config/environment.js";
import { query } from "../src/database/connectionPool.js";

const APPLY = process.argv.includes("--apply");
const INCLUDE_ORPHANS = process.argv.includes("--include-orphans");

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

    const action = !twin
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
  }
  line();

  const skipped = plan.filter((p) => p.action.startsWith("SKIP"));
  if (skipped.length) {
    console.log(
      "\nLeft alone (no [MyWork] twin, so not the cause of the bug): " +
        skipped.map((p) => `${p.table} (${p.count} rows)`).join(", ") +
        "\nThese are older tables the app does not read under either schema." +
        "\nPass --include-orphans to move them into [MyWork] as well.",
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
        await query(`DROP TABLE [dbo].[${p.table}]`);
        console.log(`  dropped empty dbo.${p.table}`);
        continue;
      }

      // COPY-THEN-DROP
      const cols = await query(
        `SELECT COLUMN_NAME AS c FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION`,
        [p.table],
      );
      const names = cols.map((r) => `[${r.c}]`).join(", ");

      const clash = await query(
        `SELECT COUNT(*) AS c FROM [dbo].[${p.table}] d
         WHERE EXISTS (SELECT 1 FROM [MyWork].[${p.table}] m WHERE m.id = d.id)`,
      ).catch(() => [{ c: 0 }]);

      if (Number(clash[0].c) > 0) {
        console.log(
          `  SKIPPED dbo.${p.table} - ${clash[0].c} row(s) share an id with` +
            " [MyWork]. Reconcile by hand; this script will not renumber data.",
        );
        continue;
      }

      const hasIdentity = await query(
        `SELECT COUNT(*) AS c FROM sys.identity_columns
         WHERE object_id = OBJECT_ID('[MyWork].[${p.table}]')`,
      );
      const identity = Number(hasIdentity[0].c) > 0;

      if (identity) await query(`SET IDENTITY_INSERT [MyWork].[${p.table}] ON`);
      await query(
        `INSERT INTO [MyWork].[${p.table}] (${names})
         SELECT ${names} FROM [dbo].[${p.table}]`,
      );
      if (identity) await query(`SET IDENTITY_INSERT [MyWork].[${p.table}] OFF`);

      await query(`DROP TABLE [dbo].[${p.table}]`);
      console.log(`  copied ${p.count} row(s) from dbo.${p.table}, dropped dbo copy`);
    } catch (error) {
      console.log(`  FAILED on ${p.table}: ${error.message}`);
    }
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
