// Pure SQL-translation helpers shared by homePool.js and connectionPool.js.

export function rewriteInsertIgnoreForMssql(sqlText, values) {
  const match = sqlText.match(
    /^\s*INSERT IGNORE INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)\s*$/i,
  );
  if (!match) return { sql: sqlText, values };

  const table = match[1];
  const columns = match[2].split(",").map((c) => c.trim());
  const placeholderCount = (match[3].match(/\?/g) || []).length;
  if (columns.length !== placeholderCount || columns.length !== values.length) {
    return { sql: sqlText, values };
  }

  const whereClause = columns.map((c) => `${c} = ?`).join(" AND ");
  const rewrittenSql = `IF NOT EXISTS (SELECT 1 FROM ${table} WHERE ${whereClause}) INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`;
  return { sql: rewrittenSql, values: [...values, ...values] };
}

// The rest of the app writes MySQL's NOW() for current-timestamp columns;
// MSSQL has no such function, so swap in its equivalent everywhere it appears.
export function rewriteNowForMssql(sqlText) {
  return sqlText.replace(/\bNOW\(\)/gi, "SYSUTCDATETIME()");
}

// The rest of the app reads JSON columns with MySQL's JSON_EXTRACT(), which
// returns a JSON boolean literal (comparable with `= true`); MSSQL's
// equivalent JSON_VALUE() returns text, so a `= true` comparison needs to
// become `= 'true'` too.
export function rewriteJsonExtractForMssql(sqlText) {
  return sqlText.replace(
    /JSON_EXTRACT\(([^,]+),\s*('[^']+')\)\s*=\s*true\b/gi,
    "JSON_VALUE($1, $2) = 'true'",
  );
}

export function toNamedParams(sqlText, values) {
  let i = 0;
  const params = {};
  const translatedSql = sqlText.replace(/\?/g, () => {
    const name = `p${i}`;
    params[name] = values[i];
    i += 1;
    return `@${name}`;
  });
  return { translatedSql, params };
}

// MySQL's `INSERT ... ON DUPLICATE KEY UPDATE col = VALUES(col)` is an upsert.
// T-SQL has no such clause, so this becomes MERGE against the table's unique
// key - which is the columns NOT being updated (the rest are the payload).
//
// This is not a nicety. `entityService.setEntityFieldValue` is the single write
// path for every field value in the generic entity engine, and it is written
// this way; until this rewrite existed, choosing MSSQL in Settings produced an
// app that connected, created its schema, and then threw on the first save of
// any field on any record.
export function rewriteUpsertForMssql(sqlText, values) {
  const match = sqlText.match(
    /^\s*INSERT INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)\s*ON DUPLICATE KEY UPDATE\s+(.+?)\s*$/is,
  );
  if (!match) return { sql: sqlText, values };

  const table = match[1];
  const columns = match[2].split(",").map((c) => c.trim());
  const placeholderCount = (match[3].match(/\?/g) || []).length;
  if (columns.length !== placeholderCount || columns.length !== values.length) {
    return { sql: sqlText, values };
  }

  // `a = VALUES(a), b = VALUES(b)` -> the columns that carry the payload. Any
  // other assignment form is not something this codebase emits; bail rather
  // than translate it wrongly.
  const assignments = match[4].split(",").map((a) => a.trim());
  const updateColumns = [];
  for (const assignment of assignments) {
    const m = assignment.match(/^([a-zA-Z0-9_]+)\s*=\s*VALUES\(\s*([a-zA-Z0-9_]+)\s*\)$/i);
    if (!m || m[1].toLowerCase() !== m[2].toLowerCase()) return { sql: sqlText, values };
    updateColumns.push(m[1]);
  }

  // Whatever is inserted but never updated is what identifies the row.
  const keyColumns = columns.filter(
    (c) => !updateColumns.some((u) => u.toLowerCase() === c.toLowerCase()),
  );
  if (keyColumns.length === 0) return { sql: sqlText, values };

  const src = columns.map((c) => `? AS ${c}`).join(", ");
  const on = keyColumns.map((c) => `target.${c} = source.${c}`).join(" AND ");
  const set = updateColumns.map((c) => `target.${c} = source.${c}`).join(", ");
  const insertCols = columns.join(", ");
  const insertVals = columns.map((c) => `source.${c}`).join(", ");

  const sql =
    `MERGE ${table} AS target ` +
    `USING (SELECT ${src}) AS source ON ${on} ` +
    `WHEN MATCHED THEN UPDATE SET ${set} ` +
    `WHEN NOT MATCHED THEN INSERT (${insertCols}) VALUES (${insertVals});`;

  return { sql, values };
}

// MySQL puts the row cap at the end; T-SQL needs OFFSET/FETCH, and that is only
// legal after an ORDER BY - so one is supplied when the query has none.
export function rewriteLimitForMssql(sqlText) {
  const match = sqlText.match(/\s+LIMIT\s+(\d+)\s*$/i);
  if (!match) return sqlText;

  const body = sqlText.slice(0, match.index);
  const ordered = /\bORDER\s+BY\b/i.test(body)
    ? body
    : `${body} ORDER BY (SELECT NULL)`;
  return `${ordered} OFFSET 0 ROWS FETCH NEXT ${match[1]} ROWS ONLY`;
}
