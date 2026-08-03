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
