import {
  rewriteInsertIgnoreForMssql,
  rewriteJsonExtractForMssql,
  rewriteLimitForMssql,
  rewriteNowForMssql,
  rewriteUpsertForMssql,
  toNamedParams,
  qualifyTablesForMssql,
  assertNoUnqualifiedTables,
} from '../../src/database/mssqlTranslation.js';

/**
 * This layer is a few dozen lines standing between MySQL-flavoured SQL and an
 * entire second dialect, and nothing tested it. That is how the generic
 * engine's only field-write path shipped emitting ON DUPLICATE KEY UPDATE -
 * MSSQL connected, built its schema, and then threw on every save.
 *
 * The upsert case below is that exact statement.
 */

describe('rewriteUpsertForMssql', () => {
  // Verbatim from entityService.setEntityFieldValue - the single write path for
  // every field value in the app.
  const FIELD_VALUE_UPSERT =
    'INSERT INTO entity_field_values (entity_id, field_key, value_text, value_long, value_number, value_date, value_bool, value_json) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE ' +
    'value_text = VALUES(value_text), value_long = VALUES(value_long), value_number = VALUES(value_number), ' +
    'value_date = VALUES(value_date), value_bool = VALUES(value_bool), value_json = VALUES(value_json)';

  const values = [7, 'priority', 'High', null, null, null, null, null];

  it('becomes a MERGE keyed on the columns that are not updated', () => {
    const { sql } = rewriteUpsertForMssql(FIELD_VALUE_UPSERT, values);

    expect(sql).toMatch(/^MERGE entity_field_values AS target/);
    // entity_id + field_key are inserted but never updated, so they are the key
    // - which matches the table's unique_entity_field index.
    expect(sql).toContain('ON target.entity_id = source.entity_id AND target.field_key = source.field_key');
    expect(sql).toContain('WHEN MATCHED THEN UPDATE SET target.value_text = source.value_text');
    expect(sql).toContain('WHEN NOT MATCHED THEN INSERT');
    expect(sql).not.toMatch(/ON DUPLICATE KEY/i);
    // T-SQL requires MERGE to be terminated.
    expect(sql.trim().endsWith(';')).toBe(true);
  });

  it('keeps the parameters positional and unduplicated', () => {
    const { sql, values: out } = rewriteUpsertForMssql(FIELD_VALUE_UPSERT, values);
    expect(out).toEqual(values);
    expect((sql.match(/\?/g) || []).length).toBe(values.length);
  });

  it('leaves statements it does not recognise completely alone', () => {
    const plain = 'INSERT INTO entities (title) VALUES (?)';
    expect(rewriteUpsertForMssql(plain, ['x'])).toEqual({ sql: plain, values: ['x'] });
  });

  it('refuses to translate an assignment form the app does not emit', () => {
    // `col = col + 1` is not `col = VALUES(col)`; translating it by guesswork
    // would silently compute the wrong value.
    const odd = 'INSERT INTO t (a, b) VALUES (?, ?) ON DUPLICATE KEY UPDATE b = b + 1';
    expect(rewriteUpsertForMssql(odd, [1, 2]).sql).toBe(odd);
  });

  it('refuses when every column is updated, since nothing identifies the row', () => {
    const noKey = 'INSERT INTO t (a) VALUES (?) ON DUPLICATE KEY UPDATE a = VALUES(a)';
    expect(rewriteUpsertForMssql(noKey, [1]).sql).toBe(noKey);
  });
});

describe('rewriteLimitForMssql', () => {
  it('becomes OFFSET/FETCH', () => {
    expect(rewriteLimitForMssql('SELECT * FROM t ORDER BY id LIMIT 5'))
      .toBe('SELECT * FROM t ORDER BY id OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY');
  });

  it('supplies an ORDER BY when there is none, because FETCH requires one', () => {
    expect(rewriteLimitForMssql('SELECT * FROM t LIMIT 1'))
      .toBe('SELECT * FROM t ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY');
  });

  it('leaves a query without a row cap alone', () => {
    const sql = 'SELECT * FROM t WHERE name = ?';
    expect(rewriteLimitForMssql(sql)).toBe(sql);
  });
});

describe('the rewrites already in place', () => {
  it('turns INSERT IGNORE into a guarded insert', () => {
    const { sql, values } = rewriteInsertIgnoreForMssql(
      'INSERT IGNORE INTO t (a, b) VALUES (?, ?)', [1, 2]);
    expect(sql).toMatch(/^IF NOT EXISTS \(SELECT 1 FROM t WHERE a = \? AND b = \?\) INSERT INTO t/);
    expect(values).toEqual([1, 2, 1, 2]);
  });

  it('dedupes on the real UNIQUE KEY, not every inserted column', () => {
    // work_entity_associations' key is (daily_id, entity_id) - order_index
    // is payload, not identity. Checking it too means a re-drag that only
    // changes order_index looks like "no existing row" and the INSERT that
    // follows then hits the real UNIQUE KEY and throws, instead of no-oping.
    const { sql, values } = rewriteInsertIgnoreForMssql(
      'INSERT IGNORE INTO work_entity_associations (daily_id, entity_id, order_index) VALUES (?, ?, ?)',
      [1, 2, 5],
    );
    expect(sql).toBe(
      'IF NOT EXISTS (SELECT 1 FROM work_entity_associations WHERE daily_id = ? AND entity_id = ?) ' +
        'INSERT INTO work_entity_associations (daily_id, entity_id, order_index) VALUES (?, ?, ?)',
    );
    expect(values).toEqual([1, 2, 1, 2, 5]);
  });

  it('handles a VALUES list that mixes placeholders with inline literals', () => {
    // entityService.js's clone flow writes relationship_kind, is_generated and
    // order_index as literals rather than placeholders. The old placeholder
    // count check (3 '?' vs 6 columns) bailed out entirely here, leaving a
    // MySQL-only INSERT IGNORE sent verbatim to MSSQL - guaranteed syntax error.
    const { sql, values } = rewriteInsertIgnoreForMssql(
      "INSERT IGNORE INTO entity_relationships (context_id, parent_entity_id, child_entity_id, relationship_kind, is_generated, order_index) VALUES (?, ?, ?, 'instantiated_from', 1, 0)",
      [10, 20, 30],
    );
    expect(sql).toBe(
      'IF NOT EXISTS (SELECT 1 FROM entity_relationships WHERE parent_entity_id = ? AND child_entity_id = ? AND relationship_kind = \'instantiated_from\') ' +
        "INSERT INTO entity_relationships (context_id, parent_entity_id, child_entity_id, relationship_kind, is_generated, order_index) VALUES (?, ?, ?, 'instantiated_from', 1, 0)",
    );
    expect(values).toEqual([20, 30, 10, 20, 30]);
  });

  it('swaps NOW() for the T-SQL equivalent', () => {
    expect(rewriteNowForMssql('UPDATE t SET updated_at = NOW()'))
      .toBe('UPDATE t SET updated_at = SYSUTCDATETIME()');
  });

  it('rewrites a JSON boolean comparison', () => {
    expect(rewriteJsonExtractForMssql("SELECT 1 WHERE JSON_EXTRACT(r, '$.enabled') = true"))
      .toBe("SELECT 1 WHERE JSON_VALUE(r, '$.enabled') = 'true'");
  });

  it('names the placeholders in order', () => {
    const { translatedSql, params } = toNamedParams('SELECT * FROM t WHERE a = ? AND b = ?', [1, 'x']);
    expect(translatedSql).toBe('SELECT * FROM t WHERE a = @p0 AND b = @p1');
    expect(params).toEqual({ p0: 1, p1: 'x' });
  });
});

describe('qualifyTablesForMssql', () => {
  // Only names confirmed to exist in [MyWork] are ever rewritten. That is the
  // safety property: an alias, a CTE or a column cannot be mistaken for a
  // table, because none of them will be in this set.
  const known = new Set(['contexts', 'entities', 'entity_types', 'entity_field_values']);

  it('qualifies a bare table in FROM', () => {
    expect(qualifyTablesForMssql('SELECT * FROM contexts WHERE id = ?', known))
      .toBe('SELECT * FROM [MyWork].[contexts] WHERE id = ?');
  });

  it('qualifies every table in a join, leaving aliases alone', () => {
    expect(qualifyTablesForMssql(
      'SELECT e.* FROM entities e JOIN entity_types t ON t.id = e.entity_type_id', known))
      .toBe('SELECT e.* FROM [MyWork].[entities] e JOIN [MyWork].[entity_types] t ON t.id = e.entity_type_id');
  });

  it('qualifies INSERT INTO, UPDATE and DELETE FROM', () => {
    expect(qualifyTablesForMssql('INSERT INTO contexts (name) VALUES (?)', known))
      .toBe('INSERT INTO [MyWork].[contexts] (name) VALUES (?)');
    expect(qualifyTablesForMssql('UPDATE contexts SET name = ?', known))
      .toBe('UPDATE [MyWork].[contexts] SET name = ?');
    expect(qualifyTablesForMssql('DELETE FROM entity_field_values WHERE entity_id = ?', known))
      .toBe('DELETE FROM [MyWork].[entity_field_values] WHERE entity_id = ?');
  });

  it('leaves an already-qualified name unchanged', () => {
    const sql = 'SELECT * FROM [MyWork].[contexts]';
    expect(qualifyTablesForMssql(sql, known)).toBe(sql);
  });

  // The whole point: a table that is not ours must never be dragged into
  // MyWork, and dbo objects must be left completely alone.
  it('leaves unknown tables alone', () => {
    const sql = 'SELECT * FROM some_other_table';
    expect(qualifyTablesForMssql(sql, known)).toBe(sql);
  });

  it('rewrites nothing when the table list is empty or missing', () => {
    const sql = 'SELECT * FROM contexts';
    expect(qualifyTablesForMssql(sql, new Set())).toBe(sql);
    expect(qualifyTablesForMssql(sql, null)).toBe(sql);
  });
});

/**
 * NOTHING FALLS BACK TO dbo.
 *
 * An unqualified name on SQL Server does not fail - it resolves against the
 * login's default schema and quietly succeeds somewhere else, so a row saves,
 * reports success, and is never seen again. These guard the two ways that has
 * actually happened. See the dbo section in CLAUDE.md.
 */
describe('nothing falls back to dbo', () => {
  const known = new Set(['entities', 'contexts', 'users', 'entity_field_values']);

  // The bug: qualifyTablesForMssql used indexOf(match) to look at what
  // followed a match, which finds the FIRST occurrence of that text. A
  // statement naming the same table twice had its second occurrence tested
  // against the first one's surroundings.
  it('qualifies EVERY occurrence when a table is named more than once', () => {
    const sql =
      'SELECT * FROM entities e JOIN entities p ON p.id = e.parent_id';
    const out = qualifyTablesForMssql(sql, known);
    expect(out).toBe(
      'SELECT * FROM [MyWork].[entities] e JOIN [MyWork].[entities] p ON p.id = e.parent_id',
    );
    expect(() => assertNoUnqualifiedTables(out, known)).not.toThrow();
  });

  it('qualifies an INSERT target, not just a FROM', () => {
    const out = qualifyTablesForMssql(
      'INSERT INTO entities (title) VALUES (?)',
      known,
    );
    expect(out).toBe('INSERT INTO [MyWork].[entities] (title) VALUES (?)');
  });

  it('qualifies UPDATE and DELETE targets', () => {
    expect(qualifyTablesForMssql('UPDATE entities SET title = ?', known)).toBe(
      'UPDATE [MyWork].[entities] SET title = ?',
    );
    expect(
      qualifyTablesForMssql('DELETE FROM entities WHERE id = ?', known),
    ).toBe('DELETE FROM [MyWork].[entities] WHERE id = ?');
  });

  it('THROWS rather than letting an unqualified table through', () => {
    expect(() =>
      assertNoUnqualifiedTables('SELECT * FROM entities', known),
    ).toThrow(/entities/);
    expect(() =>
      assertNoUnqualifiedTables('INSERT INTO users (name) VALUES (?)', known),
    ).toThrow(/users/);
  });

  it('names every offending table, so one fix does not hide the next', () => {
    expect(() =>
      assertNoUnqualifiedTables(
        'SELECT * FROM entities JOIN contexts ON 1=1',
        known,
      ),
    ).toThrow(/entities, contexts/);
  });

  it('accepts a fully qualified statement', () => {
    expect(() =>
      assertNoUnqualifiedTables(
        'SELECT * FROM [MyWork].[entities] JOIN [MyWork].[contexts] ON 1=1',
        known,
      ),
    ).not.toThrow();
  });

  it('leaves tables that are not ours alone, and does not object to them', () => {
    const sql = 'SELECT * FROM sys.tables JOIN some_other_table ON 1=1';
    expect(qualifyTablesForMssql(sql, known)).toBe(sql);
    expect(() => assertNoUnqualifiedTables(sql, known)).not.toThrow();
  });

  // A rewrite that introduces a table reference of its own must still be
  // qualifiable - the upsert becomes a MERGE naming its target.
  it('qualifies a table reference introduced by an earlier rewrite', () => {
    const { sql } = rewriteUpsertForMssql(
      'INSERT INTO entity_field_values (entity_id, value_text) VALUES (?, ?) ON DUPLICATE KEY UPDATE value_text = VALUES(value_text)',
      [1, 'x'],
    );
    const out = qualifyTablesForMssql(sql, known);
    expect(() => assertNoUnqualifiedTables(out, known)).not.toThrow();
    expect(out).toContain('[MyWork].[entity_field_values]');
  });
});
