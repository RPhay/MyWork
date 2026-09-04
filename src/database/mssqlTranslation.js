// Pure SQL-translation helpers shared by homePool.js and connectionPool.js.

// The columns that actually enforce de-duplication for each table this
// codebase sends INSERT IGNORE against - i.e. the UNIQUE KEY declared for
// that table in mysqlSchema.js/mssqlSchema.js. MUST stay in sync with those
// two files (see CLAUDE.md's "Database schema changes must cover every
// supported database type" for why they're edited together - this map is a
// third place that same key needs to be reflected). A table missing here
// falls back to treating every inserted column as the key, which is only
// correct when the statement inserts nothing but the key columns themselves.
const INSERT_IGNORE_KEY_COLUMNS = {
  entity_relationships: ["parent_entity_id", "child_entity_id", "relationship_kind"],
  work_entity_associations: ["daily_id", "entity_id"],
  daily_entities: ["context_id", "date", "entity_id"],
  years: ["year"],
};

// Splits a VALUES(...) body into its top-level tokens - '?' or a literal
// (string/number/boolean) - without breaking on a comma inside a quoted
// string. This codebase's INSERT IGNORE statements sometimes inline literals
// alongside placeholders (e.g. a fixed relationship_kind), which a naive
// split(',') or an all-placeholders assumption both get wrong.
function splitValueTokens(valuesBody) {
  const tokens = [];
  let current = "";
  let inString = false;
  for (let i = 0; i < valuesBody.length; i += 1) {
    const ch = valuesBody[i];
    if (ch === "'") {
      inString = !inString;
      current += ch;
    } else if (ch === "," && !inString) {
      tokens.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim() !== "") tokens.push(current.trim());
  return tokens;
}

export function rewriteInsertIgnoreForMssql(sqlText, values) {
  const match = sqlText.match(
    /^\s*INSERT IGNORE INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)\s*$/i,
  );
  if (!match) return { sql: sqlText, values };

  const table = match[1];
  const columns = match[2].split(",").map((c) => c.trim());
  const valueTokens = splitValueTokens(match[3]);
  if (columns.length !== valueTokens.length) {
    return { sql: sqlText, values };
  }

  // Pair each column with its token, consuming one item off `values` for
  // every '?' in source order (mirrors how the driver would have bound them).
  let cursor = 0;
  const bound = columns.map((name, idx) => {
    const token = valueTokens[idx];
    if (token === "?") {
      const value = values[cursor];
      cursor += 1;
      return { name, isPlaceholder: true, value };
    }
    return { name, isPlaceholder: false, literal: token };
  });
  if (cursor !== values.length) return { sql: sqlText, values };

  const declaredKey = INSERT_IGNORE_KEY_COLUMNS[table.toLowerCase()];
  const keyColumns =
    declaredKey && declaredKey.every((c) => columns.includes(c))
      ? declaredKey
      : columns;

  const whereValues = [];
  const whereClause = keyColumns
    .map((c) => {
      const col = bound.find((b) => b.name === c);
      if (col.isPlaceholder) {
        whereValues.push(col.value);
        return `${c} = ?`;
      }
      return `${c} = ${col.literal}`;
    })
    .join(" AND ");

  const insertValues = [];
  const insertValueSql = bound
    .map((col) => {
      if (col.isPlaceholder) {
        insertValues.push(col.value);
        return "?";
      }
      return col.literal;
    })
    .join(", ");

  // WITH (UPDLOCK, HOLDLOCK): under the default READ COMMITTED isolation, the
  // SELECT's shared lock is released the instant it finishes, so two
  // concurrent connections can both see "not exists" and both proceed to
  // INSERT - the very race INSERT IGNORE exists to avoid, reintroduced by the
  // rewrite. HOLDLOCK holds that lock for the statement's duration
  // (serializable-equivalent for this one table reference); UPDLOCK makes it
  // exclusive up front instead of a shared lock upgrading later, which is
  // what avoids the two connections deadlocking each other on the upgrade.
  const rewrittenSql = `IF NOT EXISTS (SELECT 1 FROM ${table} WITH (UPDLOCK, HOLDLOCK) WHERE ${whereClause}) INSERT INTO ${table} (${columns.join(", ")}) VALUES (${insertValueSql})`;
  return { sql: rewrittenSql, values: [...whereValues, ...insertValues] };
}

// The rest of the app writes MySQL's NOW() for current-timestamp columns;
// MSSQL has no such function, so swap in its equivalent everywhere it appears.
export function rewriteNowForMssql(sqlText) {
  return sqlText.replace(/\bNOW\(\)/gi, "SYSUTCDATETIME()");
}

// The rest of the app writes MySQL's CHAR_LENGTH(); MSSQL has no such
// function, only LEN() - same signature (single string argument), no rewrite
// of the argument needed.
export function rewriteCharLengthForMssql(sqlText) {
  return sqlText.replace(/\bCHAR_LENGTH\(/gi, "LEN(");
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

// The schema every MyWork object lives in on SQL Server.
export const MSSQL_SCHEMA = "MyWork";

/**
 * Pin table references to [MyWork].
 *
 * Services write unqualified SQL ("SELECT * FROM contexts"). On SQL Server an
 * unqualified name resolves against the caller's DEFAULT_SCHEMA and THEN falls
 * back to dbo - silently. So a table missing from [MyWork] for any reason is
 * not an error, it is a read of a completely different table in dbo, and a
 * write goes there too. That is how one database ended up with its rows split
 * across both schemas: contexts existed in dbo, so every unqualified reference
 * found it.
 *
 * Qualifying explicitly removes the fallback: [MyWork].[contexts] either exists
 * or errors, and can never silently become dbo.contexts.
 *
 * `knownTables` is the set of table names actually present in [MyWork], read
 * from the database rather than hardcoded. That is the safety property: this
 * only ever rewrites a name it has confirmed exists there, so an alias, a CTE,
 * a column or a table that genuinely is not ours is left untouched. An empty
 * set rewrites nothing.
 */
// The keywords a table name can follow. DELETE/UPDATE take a name directly;
// everything else arrives via FROM, JOIN or INTO.
//
// MERGE is here because rewriteUpsertForMssql PRODUCES one - the upsert
// becomes `MERGE <table> AS target`, which is a table reference this file
// created itself. It was missing until 2026-08-27, so every field-value
// upsert on SQL Server named its target unqualified and resolved it against
// the login's default schema. A rewrite that introduces a table reference has
// to be qualifiable, and the unit tests now check that specifically.
const TABLE_REF_PATTERN =
  /\b(FROM|JOIN|INTO|UPDATE|TABLE|MERGE)\s+(\[?)([A-Za-z_][A-Za-z0-9_]*)(\]?)/gi;

export function qualifyTablesForMssql(sqlText, knownTables) {
  // An empty/missing table list is a FAILURE, not "qualify nothing" - see the
  // dbo section in CLAUDE.md. Returning the SQL unrewritten here used to mean
  // every statement in the process silently addressed dbo, invisibly, for as
  // long as the list stayed unreadable (or the schema didn't exist yet).
  if (!knownTables || knownTables.size === 0) {
    throw new Error(
      `Cannot qualify SQL for the ${MSSQL_SCHEMA} schema: no table list is available. ` +
        `Continuing would let table references resolve against dbo. SQL: ${sqlText.slice(0, 300)}`,
    );
  }

  return sqlText.replace(
    TABLE_REF_PATTERN,
    (match, keyword, openBracket, name, closeBracket, offset) => {
      if (!knownTables.has(name.toLowerCase())) return match;

      // Already qualified - "[MyWork].[x]" reaches here as the [MyWork] part,
      // and its table name is not in the set, so it is skipped above. This
      // guards the other direction: a name followed by a dot is a qualifier,
      // not a table.
      //
      // Uses the match's OFFSET, not indexOf(match). indexOf finds the FIRST
      // occurrence of that text, so in a statement naming the same table
      // twice, the second occurrence was tested against the first one's
      // surroundings - and could be left unqualified, which on SQL Server
      // means it silently addresses dbo.
      const after = sqlText.slice(offset + match.length);
      if (after.startsWith(".")) return match;

      return `${keyword} [${MSSQL_SCHEMA}].[${name}]`;
    },
  );
}

/**
 * Refuse to run a statement that still names a known table unqualified.
 *
 * The whole danger of this dialect is that an unqualified name does NOT
 * fail - it resolves against the login's default schema and quietly succeeds
 * somewhere else. A row saves, reports success, and is never seen again, and
 * nothing anywhere reports a problem.
 *
 * So the qualifier's output is CHECKED rather than trusted: a rewrite that
 * misses a case breaks loudly the first time it runs, instead of writing to
 * dbo for a month. See the `dbo` section in CLAUDE.md.
 */
export function assertNoUnqualifiedTables(sqlText, knownTables) {
  // Same reasoning as qualifyTablesForMssql above: an empty/missing list
  // means nothing can be verified as qualified, which is exactly the state
  // this check exists to catch, not wave through.
  if (!knownTables || knownTables.size === 0) {
    throw new Error(
      `Cannot verify SQL is qualified for the ${MSSQL_SCHEMA} schema: no table list is available. ` +
        `SQL: ${sqlText.slice(0, 300)}`,
    );
  }

  const offenders = [];
  for (const m of sqlText.matchAll(TABLE_REF_PATTERN)) {
    const name = m[3];
    if (!knownTables.has(name.toLowerCase())) continue;

    // A name followed by a dot is a schema qualifier, not a table.
    const after = sqlText.slice(m.index + m[0].length);
    if (after.startsWith(".")) continue;

    offenders.push(name);
  }

  if (offenders.length > 0) {
    throw new Error(
      `Refusing to run SQL that names ${[...new Set(offenders)].join(", ")} ` +
        `without the [${MSSQL_SCHEMA}] schema - an unqualified name silently ` +
        `resolves to dbo on SQL Server. SQL: ${sqlText.slice(0, 300)}`,
    );
  }

  return sqlText;
}
