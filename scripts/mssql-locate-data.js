#!/usr/bin/env node

/**
 * "All my data is missing" on SQL Server - find out where it actually went.
 *
 * Run this BEFORE changing anything. It only reads.
 *
 *   node scripts/mssql-locate-data.js
 *
 * The likely answer, and the reason this script exists:
 *
 * Every MyWork object on SQL Server is supposed to live in the [MyWork] schema,
 * and createMssqlSchema decides whether a table needs creating by looking ONLY
 * in that schema:
 *
 *     SELECT COUNT(*) FROM sys.tables
 *     WHERE name = 'entities' AND SCHEMA_NAME(schema_id) = 'MyWork'
 *
 * If a database's tables were created in `dbo` instead - by an older build, a
 * restore, or a hand-run script - that check finds nothing, so the schema build
 * creates a SECOND, EMPTY set of tables in [MyWork]. It then points the login's
 * DEFAULT_SCHEMA at [MyWork]. From that moment the app reads the new empty
 * tables while every row sits untouched in dbo.
 *
 * Nothing is deleted by that sequence. The data is in the other schema.
 *
 * This prints the row counts per schema so you can see which one is real. If
 * dbo holds your data, DO NOT let anything drop it - the fix is to move the
 * data into [MyWork], or to point the user's default schema back at dbo, and
 * that decision needs a person.
 */

import mssql from 'mssql';
import config from '../src/config/environment.js';

const KEY_TABLES = [
  'entities', 'entity_types', 'entity_field_values', 'entity_relationships',
  'work_items', 'priorities', 'contexts', 'work_entity_associations',
];

async function main() {
  const db = config.database;
  if (db.type !== 'mssql') {
    console.log(`DB_TYPE is "${db.type}", not mssql. Point this at the SQL Server install.`);
    process.exit(1);
  }

  const pool = await new mssql.ConnectionPool({
    server: db.host,
    port: db.port ? Number(db.port) : 1433,
    user: db.user,
    password: db.password,
    database: db.name,
    options: {
      encrypt: db.mssqlEncrypt,
      trustServerCertificate: db.mssqlTrustServerCertificate,
    },
    connectionTimeout: 30000,
    requestTimeout: 120000,
  }).connect();

  try {
    const who = await pool.request().query(
      'SELECT USER_NAME() AS usr, SCHEMA_NAME() AS defaultSchema, DB_NAME() AS db'
    );
    const { usr, defaultSchema, db: dbName } = who.recordset[0];
    console.log(`\nDatabase : ${dbName}`);
    console.log(`Login    : ${usr}`);
    console.log(`Default schema: ${defaultSchema}`);
    if (defaultSchema !== 'MyWork') {
      console.log('  ^ unqualified queries resolve HERE first, then dbo - never [MyWork].');
    }

    const schemas = await pool.request().query(`
      SELECT s.name AS schemaName, COUNT(t.object_id) AS tableCount
      FROM sys.schemas s
      LEFT JOIN sys.tables t ON t.schema_id = s.schema_id
      WHERE s.name NOT IN ('sys','INFORMATION_SCHEMA','guest','db_owner','db_accessadmin',
                           'db_securityadmin','db_ddladmin','db_backupoperator',
                           'db_datareader','db_datawriter','db_denydatareader','db_denydatawriter')
      GROUP BY s.name
      HAVING COUNT(t.object_id) > 0
      ORDER BY s.name
    `);

    console.log('\nSchemas holding tables:');
    for (const r of schemas.recordset) {
      console.log(`  ${r.schemaName.padEnd(12)} ${r.tableCount} table(s)`);
    }

    console.log('\nRow counts for the tables that matter:\n');
    const header = ['table', ...schemas.recordset.map(s => s.schemaName)];
    console.log('  ' + header[0].padEnd(28) + header.slice(1).map(h => h.padStart(12)).join(''));
    console.log('  ' + '-'.repeat(28 + 12 * (header.length - 1)));

    const totals = {};
    for (const table of KEY_TABLES) {
      const cells = [];
      for (const s of schemas.recordset) {
        const exists = await pool.request().query(
          `SELECT COUNT(*) AS c FROM sys.tables
           WHERE name = '${table}' AND SCHEMA_NAME(schema_id) = '${s.schemaName}'`
        );
        if (exists.recordset[0].c === 0) { cells.push('-'); continue; }
        const n = await pool.request().query(
          `SELECT COUNT(*) AS c FROM [${s.schemaName}].[${table}]`
        );
        const count = n.recordset[0].c;
        totals[s.schemaName] = (totals[s.schemaName] || 0) + count;
        cells.push(String(count));
      }
      console.log('  ' + table.padEnd(28) + cells.map(c => c.padStart(12)).join(''));
    }

    console.log('\n  ' + 'TOTAL'.padEnd(28)
      + schemas.recordset.map(s => String(totals[s.schemaName] || 0).padStart(12)).join(''));

    const populated = Object.entries(totals).filter(([, n]) => n > 0).map(([s]) => s);
    console.log('');
    if (populated.length > 1) {
      console.log(`Your rows are split across: ${populated.join(', ')}.`);
      console.log('That is the "missing data" - two parallel sets of tables. Nothing was');
      console.log('deleted. Decide which schema is authoritative before running anything');
      console.log('that drops tables.');
    } else if (populated.length === 1 && populated[0] !== defaultSchema) {
      console.log(`All your rows are in [${populated[0]}], but this login reads [${defaultSchema}]`);
      console.log('first. That is why the app looks empty. The data is intact.');
    } else if (populated.length === 1) {
      console.log(`All rows are in [${populated[0]}], which is where this login reads. If the`);
      console.log('app still looks empty the cause is elsewhere - say so and include this output.');
    } else {
      console.log('No rows found in any schema. If this database used to have data, restore');
      console.log('from backup rather than running the schema tools against it.');
    }
  } finally {
    await pool.close();
  }
}

main().catch(err => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
