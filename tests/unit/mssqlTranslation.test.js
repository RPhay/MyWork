import {
  rewriteInsertIgnoreForMssql,
  rewriteJsonExtractForMssql,
  rewriteLimitForMssql,
  rewriteNowForMssql,
  rewriteUpsertForMssql,
  toNamedParams,
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
