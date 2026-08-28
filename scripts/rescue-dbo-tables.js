/**
 * Move anything stranded in dbo into [MyWork], and drop the dbo copies.
 *
 * NOTHING EVER FALLS BACK TO dbo - see CLAUDE.md. The code now qualifies
 * every statement and refuses to run one that does not, but that only stops
 * NEW writes going astray. Rows written to dbo.<table> while the pools were
 * unqualified are still sitting there, invisible to an app that now reads
 * [MyWork] exclusively. Only moving them gets them back.
 *
 * Three cases, handled differently because they are genuinely different:
 *
 *   dbo table, no [MyWork] twin   -> TRANSFER the whole table into [MyWork].
 *                                    Nothing is copied and nothing is lost.
 *   dbo table WITH a twin, dbo empty
 *                                 -> drop the dbo copy. It is a decoy.
 *   dbo table WITH a twin, both hold rows
 *                                 -> COPY the dbo rows in, then drop dbo.
 *                                    Identity columns are preserved where the
 *                                    id is free, and reported where it is not
 *                                    rather than silently renumbered.
 *
 * DRY RUN BY DEFAULT. Prints the plan and writes nothing:
 *
 *   node scripts/rescue-dbo-tables.js
 *   node scripts/rescue-dbo-tables.js --apply
 *
 * Take a database backup before --apply. This moves data.
 */

import config from "../src/config/environment.js";
import { query } from "../src/database/connectionPool.js";

const APPLY = process.argv.includes("--apply");

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
      ? "TRANSFER"
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
  console.log(
    Number(left[0].c) === 0
      ? "\ndbo is empty. Re-run scripts/verify-mssql.js to confirm.\n"
      : `\n${left[0].c} table(s) still in dbo - see the messages above.\n`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nFailed:", error.message);
    process.exit(1);
  });
