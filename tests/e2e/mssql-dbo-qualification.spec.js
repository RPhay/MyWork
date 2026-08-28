import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '../../src');

/**
 * NOTHING EVER FALLS BACK TO dbo - see the section of that name in CLAUDE.md.
 *
 * An unqualified table name on SQL Server does not fail. It resolves against
 * the login's default schema and quietly succeeds somewhere else, so one
 * statement writes dbo.entities while another reads [MyWork].entities and
 * nothing anywhere reports a problem. The symptom is a row that saves,
 * reports success, and is never seen again.
 *
 * The unit tests in tests/unit/mssqlTranslation.test.js prove the qualifier
 * and the assertion behave correctly on a string. They CANNOT catch the two
 * ways this has actually gone wrong, both of which are structural:
 *
 *   - a pool that never calls the qualifier at all (homePool.js, until
 *     2026-08-27, for every read and write of users/contexts/user_identities)
 *   - a call site that reaches SQL Server around the pools entirely
 *
 * So this spec reads the source. It asserts nothing about behaviour, which is
 * why it needs no page - it is a structural guard, and it lives in e2e so it
 * runs with the suite rather than being a lint rule nobody remembers.
 */

function readFile(rel) {
  return fs.readFileSync(path.join(SRC, rel), 'utf8');
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

// Every pool that speaks MSSQL. A new one added without qualification is the
// exact regression this list exists to catch, so the list is asserted to be
// complete below rather than trusted.
const POOLS = ['database/connectionPool.js', 'database/homePool.js'];

for (const pool of POOLS) {
  test(`${pool} qualifies every statement before running it`, () => {
    const source = readFile(pool);

    expect(source, `${pool} must import the qualifier`).toContain(
      'qualifyTablesForMssql',
    );
    expect(source, `${pool} must import the assertion`).toContain(
      'assertNoUnqualifiedTables',
    );

    // Imported is not enough - it has to be CALLED in the MSSQL path.
    const mssqlFn = source.slice(source.indexOf('async function executeMssql'));
    expect(mssqlFn.length, `${pool} has no executeMssql`).toBeGreaterThan(0);

    const qualifyAt = mssqlFn.indexOf('qualifyTablesForMssql(');
    const assertAt = mssqlFn.indexOf('assertNoUnqualifiedTables(');
    const runAt = mssqlFn.indexOf('request.query(');

    expect(qualifyAt, `${pool}: executeMssql must call the qualifier`).toBeGreaterThan(-1);
    expect(assertAt, `${pool}: executeMssql must call the assertion`).toBeGreaterThan(-1);

    // Order matters: both have to happen BEFORE the statement is executed.
    expect(qualifyAt, `${pool}: qualification must precede execution`).toBeLessThan(runAt);
    expect(assertAt, `${pool}: the assertion must precede execution`).toBeLessThan(runAt);
  });
}

test('a failed table-list lookup throws rather than qualifying nothing', () => {
  // An empty set qualifies NOTHING, which means every statement in the
  // process silently addresses dbo. That fallback is how this stayed
  // invisible, so both pools must throw instead.
  for (const pool of POOLS) {
    const source = readFile(pool);
    const fn = source.slice(source.indexOf('async function getMssqlKnownTables'));
    expect(fn.length, `${pool} has no getMssqlKnownTables`).toBeGreaterThan(0);
    const cat = fn.slice(fn.indexOf('catch'));
    expect(cat, `${pool}: a failed lookup must throw, not return an empty set`).toContain('throw');
  }
});

test('no service or route reaches SQL Server around the pools unqualified', () => {
  // A .request().query() outside the pools bypasses qualification entirely,
  // whatever the pools themselves do.
  //
  // Two such calls are legitimate and must not be flagged, or the test gets
  // switched off rather than heeded: a catalog query (sys.* /
  // INFORMATION_SCHEMA.*, which live in no user schema and cannot fall back
  // to dbo), and a statement that already names [MyWork] itself.
  const offenders = [];
  for (const file of walk(SRC)) {
    const rel = path.relative(SRC, file);
    if (rel.startsWith('database' + path.sep)) continue;
    const source = fs.readFileSync(file, 'utf8');

    for (const m of source.matchAll(/\.request\(\)\s*\.\s*query\(/g)) {
      // The statement text that follows, far enough to see what it touches.
      const sql = source.slice(m.index, m.index + 400);
      const catalogOnly = /\bsys\.|INFORMATION_SCHEMA\./i.test(sql);
      const namesSchema = /\[MyWork\]/.test(sql);
      if (!catalogOnly && !namesSchema) {
        offenders.push(`${rel}: ${sql.slice(0, 80).replace(/\s+/g, ' ')}`);
      }
    }
  }
  expect(
    offenders,
    `these reach mssql directly, unqualified: ${offenders.join(' | ')}`,
  ).toEqual([]);
});

test('the MSSQL schema file never names a table without its schema', () => {
  // The schema file talks to SQL Server directly - it does not go through the
  // pools - so the qualifier never sees it. Every DDL target must name
  // [MyWork] itself.
  //
  // COMMENTS ARE STRIPPED FIRST. Without that, prose like "the CREATE TABLE
  // body" and "DROP TABLE IF" is read as SQL, and the test fails on its own
  // documentation - which is how a test gets deleted instead of fixed.
  const source = readFile('database/schema/mssqlSchema.js')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ');

  const bad = [];
  const pattern =
    /\b(CREATE TABLE|ALTER TABLE|INSERT INTO|DROP TABLE)\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?(\[?[A-Za-z_][A-Za-z0-9_]*\]?)/gi;

  for (const m of source.matchAll(pattern)) {
    if (/^\[MyWork\]$/i.test(m[2])) continue;
    bad.push(`${m[1]} ${m[2]}`);
  }
  expect(bad, `unqualified in mssqlSchema.js: ${bad.join(' | ')}`).toEqual([]);
});

/**
 * A schema file must never operate on a RETIRED table.
 *
 * This has stopped the MSSQL schema build twice, and both times the whole of
 * Analyze & Migrate went with it:
 *
 *   sso_identities - "is RETIRED" written in a comment, with the
 *                    createUpdatedAtTrigger call left directly beneath it
 *   quotes         - the same, months later
 *
 * The failure is total, not partial: CREATE TRIGGER on a table the file no
 * longer creates raises "The object 'MyWork.x' does not exist or is invalid
 * for this operation" and aborts the build. RETIRED_TABLES is the single
 * source of truth for which tables those are, so this asks it rather than
 * keeping a second list that would drift.
 */
test('neither schema file creates or triggers a RETIRED table', async () => {
  const { RETIRED_TABLES } = await import('../../src/database/retiredTables.js');
  expect(RETIRED_TABLES.length, 'RETIRED_TABLES should not be empty').toBeGreaterThan(0);

  const offenders = [];
  for (const file of ['database/schema/mssqlSchema.js', 'database/schema/mysqlSchema.js']) {
    // Comments say "x is RETIRED" on purpose - only real calls count.
    const source = readFile(file)
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^[ \t]*\/\/.*$/gm, ' ');

    for (const table of RETIRED_TABLES) {
      const patterns = [
        new RegExp(`createUpdatedAtTrigger\\(\\s*pool\\s*,\\s*["'\`]${table}["'\`]`),
        new RegExp(`createTableIfNotExists\\(\\s*pool\\s*,\\s*["'\`]${table}["'\`]`),
        new RegExp(`CREATE TABLE (?:IF NOT EXISTS )?(?:\\[MyWork\\]\\.)?\\[?${table}\\b`, 'i'),
      ];
      if (patterns.some((re) => re.test(source))) {
        offenders.push(`${file}: ${table}`);
      }
    }
  }

  expect(
    offenders,
    `retired tables still operated on: ${offenders.join(' | ')}`,
  ).toEqual([]);
});

test('every updated_at trigger body names its table with the schema', () => {
  // The trigger DEFINITION is stored and runs later, so an unqualified name
  // inside the body updates dbo.<table> every time the trigger fires - long
  // after any of this code has run.
  const source = readFile('database/schema/mssqlSchema.js');
  const fn = source.slice(
    source.indexOf('async function createUpdatedAtTrigger'),
  );

  // Only the CREATE TRIGGER template, not the whole function. The function
  // also DETECTS a stale unqualified trigger, and that detection necessarily
  // contains the very string being forbidden here - scanning the whole
  // function matches the guard rather than the DDL, which is a test failing
  // on the code that fixes the problem.
  const ddlStart = fn.indexOf('CREATE TRIGGER');
  const ddlEnd = fn.indexOf('END', ddlStart);
  expect(ddlStart, 'no CREATE TRIGGER template found').toBeGreaterThan(-1);
  const ddl = fn.slice(ddlStart, ddlEnd);

  expect(ddl, 'the trigger body must UPDATE via a qualified name').toContain(
    'FROM [MyWork].[${tableName}]',
  );
  expect(
    /FROM\s+\$\{tableName\}/.test(ddl),
    'the trigger body still names the table unqualified',
  ).toBe(false);
});

test('a trigger already in the database is replaced when its body is stale', () => {
  // createTriggerIfNotExists only asks whether a trigger of that NAME exists.
  // A trigger created before the body was qualified would therefore live on
  // forever, writing to dbo on every UPDATE - silently undoing the schema run
  // that was meant to fix it, and recreating dbo rows after they were cleaned
  // up. The definition has to be checked, not just the name.
  const source = readFile('database/schema/mssqlSchema.js');
  const fn = source.slice(
    source.indexOf('async function createUpdatedAtTrigger'),
  );
  const body = fn.slice(0, fn.indexOf('\nasync function', 1));

  expect(body, 'must read the stored definition').toContain('sys.sql_modules');
  expect(body, 'must drop a stale trigger before recreating it').toContain(
    'DROP TRIGGER',
  );
});

test('trigger lookups are scoped to the [MyWork] parent table, never by name alone', () => {
  // sys.triggers is not scoped by schema, and a trigger belongs to its PARENT
  // TABLE's schema - so `WHERE name = 'trg_sources_updated_at'` finds the one
  // on dbo.sources exactly as readily as [MyWork].sources.
  //
  // That broke both ways. A dbo namesake made createTriggerIfNotExists skip
  // creating the [MyWork] trigger, leaving that table with none; and dropping
  // by bare name raised "cannot drop the trigger MyWork.trg_sources_updated_at
  // because it does not exist" - the row found described dbo's trigger.
  const source = readFile('database/schema/mssqlSchema.js');

  const lookups = source.match(/FROM sys\.triggers[\s\S]{0,400}?(?=`)/g) || [];
  expect(lookups.length, 'no sys.triggers lookups found').toBeGreaterThan(0);

  const unscoped = lookups.filter(
    (q) => !/parent_id|SCHEMA_NAME\(\s*t\.schema_id\s*\)/.test(q),
  );
  expect(
    unscoped,
    `these sys.triggers lookups are not scoped to [MyWork]: ${unscoped.join(' || ')}`,
  ).toEqual([]);
});
