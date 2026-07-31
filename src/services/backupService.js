import * as db from '../database/connectionPool.js';
import { ValidationError } from '../config/errors.js';

// Every MyWork table, in FK-dependency order (parents before children). Import
// disables FK checks anyway (so exact ordering isn't load-bearing for inserts),
// but DELETE still runs in reverse of this order to avoid transient violations.
const TABLES = [
  'contexts',
  'sources',
  'categories',
  'areas',
  'years',
  'goals',
  'goal_categories',
  'priorities',
  'priority_areas',
  'priority_goals',
  'work_items',
  'work_goal_associations',
  'work_priority_associations',
  'work_area_associations',
  'work_source_associations',
  'work_item_templates',
  'template_areas',
  'template_goals',
  'template_priorities',
  'to_do_folders',
  'to_dos',
  'to_do_items',
  'idea_folders',
  'ideas',
  'idea_items',
  'context_tab_settings',
];

export async function exportDatabase() {
  const tables = {};

  for (const table of TABLES) {
    tables[table] = await db.query(`SELECT * FROM \`${table}\``);
  }

  return {
    app: 'MyWork',
    version: 1,
    exportedAt: new Date().toISOString(),
    tables,
  };
}

// Date/datetime columns round-trip through JSON as ISO 8601 strings (e.g.
// "2026-07-30T00:00:00.000Z"), which mysql2 rejects as a raw string parameter -
// it wants a Date object (or its own MySQL-formatted string) for those columns.
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/;

// JSON columns (e.g. sources.config) come back from a SELECT as parsed JS
// objects; re-stringify anything object-like (but not Date/null) before it goes
// back into a parameterized INSERT.
function serializeValue(value) {
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    return JSON.stringify(value);
  }
  if (typeof value === 'string' && ISO_DATETIME_RE.test(value)) {
    return new Date(value);
  }
  return value;
}

export async function importDatabase(payload) {
  if (!payload || typeof payload !== 'object' || !payload.tables) {
    throw new ValidationError('That file doesn\'t look like a MyWork backup');
  }

  const pool = await db.getPool();
  const connection = await pool.getConnection();

  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.beginTransaction();

    for (const table of [...TABLES].reverse()) {
      await connection.query(`DELETE FROM \`${table}\``);
    }

    let rowsImported = 0;

    for (const table of TABLES) {
      const rows = payload.tables[table] || [];
      let maxId = 0;

      for (const row of rows) {
        const columns = Object.keys(row);
        const placeholders = columns.map(() => '?').join(',');
        const values = columns.map(c => serializeValue(row[c]));

        await connection.query(
          `INSERT INTO \`${table}\` (${columns.map(c => `\`${c}\``).join(',')}) VALUES (${placeholders})`,
          values
        );

        if (typeof row.id === 'number' && row.id > maxId) {
          maxId = row.id;
        }
      }

      rowsImported += rows.length;

      if (maxId > 0) {
        await connection.query(`ALTER TABLE \`${table}\` AUTO_INCREMENT = ${maxId + 1}`);
      }
    }

    await connection.commit();
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    return { tablesImported: TABLES.length, rowsImported };
  } catch (error) {
    await connection.rollback();
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    throw error;
  } finally {
    connection.release();
  }
}
