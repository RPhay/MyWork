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
