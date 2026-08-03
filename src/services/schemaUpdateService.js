const { connectionPool } = require('../database/connectionPool');
const { mysqlSchema, mssqlSchema } = require('../database/schema');

async function checkAndUpdateSchema(contextId) {
  const conn = await connectionPool.getConnection();

  try {
    const results = {
      tablesCreated: [],
      columnsAdded: [],
      indexesAdded: [],
      errors: []
    };

    // Get the current schema definition based on database type
    const dbType = connectionPool.getConfig().type || 'mysql';
    const schemaDefinition = dbType === 'mysql' ? mysqlSchema : mssqlSchema;

    // For each table in schema definition
    for (const tableName in schemaDefinition) {
      const tableSchema = schemaDefinition[tableName];

      try {
        // Check if table exists
        const tableExists = await tableExistsInDatabase(conn, tableName, dbType);

        if (!tableExists) {
          // Create the table
          const createTableSql = buildCreateTableSQL(tableName, tableSchema, dbType);
          await conn.execute(createTableSql);
          results.tablesCreated.push(tableName);
        } else {
          // Check for missing columns
          const existingColumns = await getTableColumns(conn, tableName, dbType);

          for (const columnName in tableSchema.columns) {
            const columnDef = tableSchema.columns[columnName];

            if (!existingColumns.has(columnName)) {
              // Add the column
              const alterSql = buildAlterTableSQL(tableName, columnName, columnDef, dbType);
              await conn.execute(alterSql);
              results.columnsAdded.push({ table: tableName, column: columnName });
            }
          }

          // Check for missing indexes
          if (tableSchema.indexes) {
            const existingIndexes = await getTableIndexes(conn, tableName, dbType);

            for (const indexDef of tableSchema.indexes) {
              const indexName = indexDef.name || `idx_${tableName}_${indexDef.columns.join('_')}`;

              if (!existingIndexes.has(indexName)) {
                const createIndexSql = buildCreateIndexSQL(tableName, indexDef, dbType);
                await conn.execute(createIndexSql);
                results.indexesAdded.push({ table: tableName, index: indexName });
              }
            }
          }
        }
      } catch (error) {
        results.errors.push({
          table: tableName,
          message: error.message
        });
      }
    }

    return results;
  } finally {
    conn.release();
  }
}

async function tableExistsInDatabase(conn, tableName, dbType) {
  try {
    if (dbType === 'mysql') {
      const [rows] = await conn.execute(
        `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [tableName]
      );
      return rows.length > 0;
    } else {
      const [rows] = await conn.execute(
        `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = SCHEMA_NAME() AND TABLE_NAME = ?`,
        [tableName]
      );
      return rows.length > 0;
    }
  } catch (error) {
    return false;
  }
}

async function getTableColumns(conn, tableName, dbType) {
  try {
    if (dbType === 'mysql') {
      const [rows] = await conn.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [tableName]
      );
      return new Set(rows.map(r => r.COLUMN_NAME));
    } else {
      const [rows] = await conn.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = SCHEMA_NAME() AND TABLE_NAME = ?`,
        [tableName]
      );
      return new Set(rows.map(r => r.COLUMN_NAME));
    }
  } catch (error) {
    return new Set();
  }
}

async function getTableIndexes(conn, tableName, dbType) {
  try {
    if (dbType === 'mysql') {
      const [rows] = await conn.execute(
        `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME != 'PRIMARY'`,
        [tableName]
      );
      return new Set(rows.map(r => r.INDEX_NAME));
    } else {
      const [rows] = await conn.execute(
        `SELECT name FROM sys.indexes WHERE object_id = OBJECT_ID(?) AND name != 'PK_' + ?`,
        [tableName, tableName]
      );
      return new Set(rows.map(r => r.name));
    }
  } catch (error) {
    return new Set();
  }
}

function buildCreateTableSQL(tableName, tableSchema, dbType) {
  const columns = [];

  for (const columnName in tableSchema.columns) {
    const def = tableSchema.columns[columnName];
    const columnSQL = buildColumnDefinition(columnName, def, dbType);
    columns.push(columnSQL);
  }

  if (tableSchema.primaryKey) {
    const pkName = dbType === 'mysql' ? 'PRIMARY KEY' : 'PRIMARY KEY';
    columns.push(`${pkName} (${tableSchema.primaryKey})`);
  }

  if (tableSchema.foreignKeys) {
    for (const fk of tableSchema.foreignKeys) {
      columns.push(buildForeignKeyDefinition(fk, dbType));
    }
  }

  const columnSQL = columns.join(',\n  ');

  if (dbType === 'mysql') {
    return `CREATE TABLE IF NOT EXISTS ${tableName} (\n  ${columnSQL}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;
  } else {
    return `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = '${tableName}') BEGIN CREATE TABLE ${tableName} (\n  ${columnSQL}\n) END;`;
  }
}

function buildColumnDefinition(columnName, def, dbType) {
  let sql = `${columnName} ${def.type}`;

  if (def.length) sql += `(${def.length})`;
  if (def.unsigned) sql += ' UNSIGNED';
  if (def.nullable === false) sql += ' NOT NULL';
  if (def.default !== undefined) {
    if (typeof def.default === 'string') {
      sql += ` DEFAULT '${def.default}'`;
    } else {
      sql += ` DEFAULT ${def.default}`;
    }
  }
  if (def.autoIncrement) sql += ' AUTO_INCREMENT';

  return sql;
}

function buildForeignKeyDefinition(fk, dbType) {
  const columns = Array.isArray(fk.columns) ? fk.columns.join(',') : fk.columns;
  const refColumns = Array.isArray(fk.references.columns) ? fk.references.columns.join(',') : fk.references.columns;

  if (dbType === 'mysql') {
    return `FOREIGN KEY (${columns}) REFERENCES ${fk.references.table}(${refColumns})`;
  } else {
    return `FOREIGN KEY (${columns}) REFERENCES ${fk.references.table}(${refColumns})`;
  }
}

function buildAlterTableSQL(tableName, columnName, columnDef, dbType) {
  const columnSQL = buildColumnDefinition(columnName, columnDef, dbType);

  if (dbType === 'mysql') {
    return `ALTER TABLE ${tableName} ADD COLUMN ${columnSQL};`;
  } else {
    return `ALTER TABLE ${tableName} ADD ${columnSQL};`;
  }
}

function buildCreateIndexSQL(tableName, indexDef, dbType) {
  const indexName = indexDef.name || `idx_${tableName}_${indexDef.columns.join('_')}`;
  const columns = Array.isArray(indexDef.columns) ? indexDef.columns.join(',') : indexDef.columns;
  const isUnique = indexDef.unique ? 'UNIQUE' : '';

  if (dbType === 'mysql') {
    return `CREATE ${isUnique} INDEX ${indexName} ON ${tableName}(${columns});`;
  } else {
    return `CREATE ${isUnique} INDEX ${indexName} ON ${tableName}(${columns});`;
  }
}

module.exports = { checkAndUpdateSchema };
