import { query, getCurrentConfig, getPool } from '../database/connectionPool.js';
import * as entityTypeService from './entityTypeService.js';
import logger from '../utils/logger.js';
import {
  SYSTEM_ENTITY_TYPES,
  resolveTypeRelationships,
} from '../database/systemEntityTypes.js';

/**
 * Schema Migration Service
 * Intelligently analyzes and migrates database schema without destructive operations
 */

// Tables the generic engine replaced.
//
// The priority_* / template_* junctions are deliberately NOT here: they were
// rebuilt as the legacy<->entity bridge (their right-hand column now points at
// `entities`), so they are live schema, not leftovers. See the "Legacy <->
// entity association bridge" block in mysqlSchema.js, and
// REQUIRED_SUPPORT_TABLES below, which now verifies they exist.
//
// The seven per-type work_*_associations junctions once described here are
// gone - retired in favour of work_entity_associations, which links a day to a
// row of ANY type. work_source_associations is the one that stayed: a source
// is not an entity.
const OLD_ENTITY_TABLES = [
  'priorities', 'areas', 'goals', 'to_dos', 'tasks', 'tickets', 'ideas', 'templates',
  'idea_folders'
];

const NEW_GENERIC_TABLES = [
  'entity_types', 'entity_type_fields', 'entity_type_relationships',
  'entities', 'entity_field_values', 'entity_relationships'
];

/**
 * Tables the running code queries that are NOT part of the generic engine, and
 * so were invisible to verification while it only checked NEW_GENERIC_TABLES.
 *
 * This list exists because of a real failure. The seven per-type
 * work_*_associations junctions were removed from both schema files, but three
 * services went on writing to them; verification checked six generic tables,
 * found them present, and reported "Schema verification passed". A database
 * missing a junction the code writes to would have been declared healthy right
 * up until a template instantiation or a purge threw at runtime.
 *
 * Add to this whenever code starts depending on a table outside the engine.
 */
const REQUIRED_SUPPORT_TABLES = [
  // A day links to a row of any type through this one junction.
  'work_entity_associations',
  // Legacy <-> entity bridges, live until `priorities` and the templates table
  // become entities themselves.
  'priority_areas', 'priority_goals', 'template_areas', 'template_goals',
  'template_priorities', 'work_source_associations',
  // The two legacy tables the bridges hang off.
  'work_items', 'priorities',
];

export async function analyzeAndMigrate() {
  const report = {
    timestamp: new Date().toISOString(),
    databaseType: getCurrentConfig().type,
    analysis: {},
    actions: [],
    warnings: [],
    errors: [],
    success: true
  };

  try {
    // Step 1: Analyze current schema
    report.analysis = await analyzeSchema();
    report.actions.push('✓ Analyzed current database schema');

    // Step 2: Check for old tables with data
    const hasOldData = report.analysis.oldTablesWithData.length > 0;
    const hasMissingGenericTables = report.analysis.missingGenericTables.length > 0;

    // A table that could not be counted is not a table that is empty. Say so
    // loudly: the conclusion "fresh database, nothing to migrate" is only
    // trustworthy if every table actually answered.
    if (report.analysis.uncountableTables.length > 0) {
      report.warnings.push(
        `Could not read row counts for: ${report.analysis.uncountableTables.join(', ')}. `
        + 'These are NOT known to be empty, so any "no old data" result below is incomplete. '
        + 'Check the server log for the underlying error.'
      );
    }

    // Step 3: Ensure generic schema exists
    if (hasMissingGenericTables) {
      await ensureGenericSchema();
      report.actions.push(`✓ Created missing generic entity tables (${report.analysis.missingGenericTables.length})`);
    } else {
      report.actions.push('✓ Generic entity schema already exists');
    }

    // Step 4: Ensure system types are seeded
    const systemTypeCount = await countSystemTypes();
    if (systemTypeCount === 0) {
      await seedSystemTypes();
      report.actions.push('✓ Seeded 9 system entity types');
    } else {
      report.actions.push(`✓ System types already seeded (${systemTypeCount} types found)`);
    }

    // Step 5: Migrate old data if present
    if (hasOldData) {
      const migrationResult = await migrateOldData(report.analysis.oldTablesWithData);
      report.actions.push(...migrationResult.actions);
      if (migrationResult.warnings.length > 0) {
        report.warnings.push(...migrationResult.warnings);
      }
      report.migratedEntities = migrationResult.stats;
    } else {
      report.actions.push('✓ No old entity data found (fresh database)');
    }

    // Step 5b: Move any links still stranded in the retired work junctions, and
    // then remove the empty shells.
    //
    // This is the half of audit 07 that never ran: the reads moved to
    // work_entity_associations, the rows did not, so a database that predates
    // that change holds links the app cannot see.
    //
    // The drop is deliberately narrow. It only ever touches the seven names in
    // RETIRED_WORK_JUNCTIONS - never a list computed at runtime - and only a
    // table whose every row has been copied across or shown to be dangling. On
    // SQL Server the statement is schema-qualified to [MyWork], so it cannot
    // reach objects belonging to anything else sharing that database.
    //
    // What it will NOT do is drop the legacy ENTITY tables. `tasks` still holds
    // 124 rows that step 5 above reports as needing migration; removing it
    // because it looks old would destroy them. Old and unused are different
    // claims, and only the second one justifies a DROP.
    const junctions = await migrateRetiredWorkJunctions({ drop: true });
    if (junctions.skipped) {
      report.warnings.push(`Skipped work junction migration: ${junctions.skipped}`);
    } else if (junctions.present.length === 0) {
      report.actions.push('✓ No retired work junctions present');
    } else {
      const held = junctions.present.map(p => `${p.table} (${p.rows})`).join(', ');
      const carried = junctions.alreadyPresent > 0
        ? `, ${junctions.alreadyPresent} already present`
        : '';
      report.actions.push(
        `✓ Migrated ${junctions.migrated} link(s)${carried} into work_entity_associations from: ${held}`
      );
      if (junctions.dangling > 0) {
        report.warnings.push(
          `${junctions.dangling} link(s) skipped - their entity or work item no longer exists.`
        );
      }
      if (junctions.dropped.length > 0) {
        report.actions.push(`✓ Dropped ${junctions.dropped.length} retired table(s): ${junctions.dropped.join(', ')}`);
      }
      if (junctions.retained.length > 0) {
        report.warnings.push(
          `Kept ${junctions.retained.join(', ')} - not every row could be accounted for, `
          + 'so they were not dropped. Re-run once the links above are resolved.'
        );
      }
    }

    // Step 6: Verify schema consistency
    let verification = await verifySchema();

    // A missing support table is repairable, and this is the button whose job
    // is to repair things - so repair it rather than printing an instruction.
    // Same canonical, dual-dialect schema modules that step 3 now uses.
    //
    // It used to say 'Run "Fix Schema"'. That button no longer exists - only
    // its endpoint survives - so the advice was unfollowable.
    if (verification.missingSupport?.length > 0) {
      try {
        const { updateSystemDbSchema } = await import('./systemDatabaseService.js');
        await updateSystemDbSchema();
        report.actions.push(
          `✓ Recreated missing support tables (${verification.missingSupport.join(', ')})`
        );
        verification = await verifySchema();
      } catch (error) {
        report.warnings.push(
          `Could not recreate missing support tables automatically: ${error.message}`
        );
      }
    }

    if (!verification.isValid) {
      report.warnings.push(...verification.issues);
    } else {
      report.actions.push('✓ Schema verification passed');
    }

  } catch (error) {
    logger.error('Schema migration error:', error);
    report.success = false;
    report.errors.push(error.message);
  }

  return report;
}

async function analyzeSchema() {
  const analysis = {
    oldTables: [],
    oldTablesWithData: [],
    missingGenericTables: [],
    existingGenericTables: [],
    // Tables that exist but could not be counted. NOT the same as empty - see
    // countRows. Anything in here means the analysis below is incomplete.
    uncountableTables: [],
    totalOldRows: 0,
    databaseType: getCurrentConfig().type
  };

  try {
    // Check which old tables exist and have data
    for (const table of OLD_ENTITY_TABLES) {
      const exists = await tableExists(table);
      if (exists) {
        analysis.oldTables.push(table);
        const count = await countRows(table);
        if (count === null) {
          analysis.uncountableTables.push(table);
        } else if (count > 0) {
          analysis.oldTablesWithData.push({ table, rows: count });
          analysis.totalOldRows += count;
        }
      }
    }

    // Check generic tables
    for (const table of NEW_GENERIC_TABLES) {
      const exists = await tableExists(table);
      if (exists) {
        analysis.existingGenericTables.push(table);
        const count = await countRows(table);
        if (count === null) {
          analysis.uncountableTables.push(table);
        } else if (count > 0) {
          analysis[`${table}Count`] = count;
        }
      } else {
        analysis.missingGenericTables.push(table);
      }
    }
  } catch (error) {
    logger.error('Error analyzing schema:', error);
  }

  return analysis;
}

/**
 * Every MyWork object on SQL Server lives in a dedicated [MyWork] schema, NOT
 * in dbo - mssqlSchema.js creates it and qualifies all 159 of its object names
 * with it. Anything here that talks to MSSQL has to say so too.
 *
 * This was wrong in both directions and it made the whole migrator inert on
 * SQL Server: tableExists looked in dbo, found none of the six generic tables,
 * concluded they were missing, and called ensureGenericSchema - whose DDL is
 * MySQL-only (AUTO_INCREMENT, ENUM), so the run then threw. Analyze & Migrate
 * could not have worked on MSSQL.
 *
 * It is also the safety boundary the user asked for: a drop must never reach
 * outside this schema, because that database may hold objects belonging to
 * something else entirely.
 */
export const MSSQL_SCHEMA = 'MyWork';

async function tableExists(tableName) {
  try {
    const dbType = getCurrentConfig().type;
    let sql;

    if (dbType === 'mssql') {
      sql = `
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = '${MSSQL_SCHEMA}' AND TABLE_NAME = ?
      `;
    } else {
      sql = `
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
      `;
    }

    const result = await query(sql, [tableName]);
    return result.length > 0;
  } catch (error) {
    logger.error(`Error checking if table ${tableName} exists:`, error);
    return false;
  }
}

/**
 * Row count, or null if the table could not be counted.
 *
 * The identifier quoting is per-engine: SQL Server rejects MySQL backticks
 * outright, so this used to throw on EVERY table under MSSQL - and because the
 * catch returned 0, the failure looked exactly like an empty table. The whole
 * analysis then concluded "fresh database, nothing to migrate" and skipped the
 * migration, silently, no matter how much data was really there.
 *
 * Returning null instead of 0 keeps "I could not count this" distinguishable
 * from "this is empty". Callers must not treat null as empty.
 */
/**
 * A table name, quoted AND schema-qualified for the engine in use.
 *
 * The qualification is not cosmetic. An unqualified [work_items] on SQL Server
 * resolves through the caller's default schema - normally dbo - so it would
 * miss every MyWork table, and a DROP built that way would either fail or,
 * worse, hit a same-named table belonging to something else.
 */
export function quoteIdentifier(name) {
  const safe = String(name);
  if (getCurrentConfig().type === 'mssql') {
    return `[${MSSQL_SCHEMA}].[${safe.replace(/]/g, ']]')}]`;
  }
  return `\`${safe.replace(/`/g, '``')}\``;
}

async function countRows(tableName) {
  try {
    const result = await query(`SELECT COUNT(*) as count FROM ${quoteIdentifier(tableName)}`);
    return result[0]?.count ?? 0;
  } catch (error) {
    logger.error(`Error counting rows in ${tableName}:`, error);
    return null;
  }
}

/**
 * The seven per-type work_*_associations junctions, and the column in each that
 * holds the entity id.
 *
 * That column name lies about what it points at. These tables were converted to
 * the legacy<->entity bridge before they were retired, so `todo_id` holds an
 * entities.id, NOT a to_dos.id. Reading them as legacy ids resolves to nothing
 * and reads like total data loss; it is not.
 */
const RETIRED_WORK_JUNCTIONS = [
  ['work_area_associations', 'area_id'],
  ['work_goal_associations', 'goal_id'],
  ['work_idea_associations', 'idea_id'],
  ['work_priority_associations', 'priority_id'],
  ['work_todo_associations', 'todo_id'],
  ['work_task_associations', 'task_id'],
  ['work_ticket_associations', 'ticket_id'],
];

/**
 * Move whatever the retired junctions still hold into work_entity_associations.
 *
 * Audit 07 moved the READS to that one junction and removed these seven tables
 * from both schema files, but never moved the ROWS. On MySQL that left 20 links
 * present in the database and invisible in the app - erroring nowhere, because
 * nothing looked at them any more. Any database that predates that change is in
 * the same state until this runs.
 *
 * Shared deliberately: scripts/migrate-work-junctions.js calls this rather than
 * carrying its own copy. Two implementations of one migration is how the schema
 * files and the services drifted apart in the first place.
 *
 * Copy-only by default. Dropping is a separate decision - see the script.
 *
 * surveyRetiredWorkJunctions() reports what is there without touching it, so a
 * caller can show the damage before deciding.
 */
export async function surveyRetiredWorkJunctions() {
  if (!await tableExists('work_entity_associations')) {
    return { skipped: 'work_entity_associations does not exist yet', present: [], target: 0 };
  }

  const present = [];
  for (const [table, column] of RETIRED_WORK_JUNCTIONS) {
    if (!await tableExists(table)) continue;
    present.push({ table, column, rows: await countRows(table) });
  }

  return { skipped: null, present, target: await countRows('work_entity_associations') };
}

/** Copy the stranded links across. See the block comment above. */
export async function migrateRetiredWorkJunctions({ drop = false } = {}) {
  const result = { present: [], migrated: 0, alreadyPresent: 0, dangling: 0, dropped: [], retained: [], skipped: null };

  // table -> every row in it is accounted for, so it is safe to remove
  const droppable = new Map();

  // One survey feeding both, so what is reported and what is copied cannot
  // disagree about which tables are there.
  const survey = await surveyRetiredWorkJunctions();
  if (survey.skipped) {
    result.skipped = survey.skipped;
    return result;
  }
  result.present = survey.present.map(({ table, rows }) => ({ table, rows }));

  for (const { table, column } of survey.present) {
    // Accounted for PER TABLE, because that is what makes the drop safe: a
    // table is only removed once every row in it has been either copied across
    // or shown to point at something that no longer exists. A global tally
    // cannot tell you that about any particular table.
    let accounted = 0;

    const rows = await query(`SELECT work_item_id, ${column} AS entity_id FROM ${quoteIdentifier(table)}`);
    for (const r of rows) {
      // A link whose entity or work item is gone would fail the foreign key and
      // abort the run, and describes nothing worth keeping.
      const [e] = await query('SELECT id FROM entities WHERE id = ?', [r.entity_id]);
      const [w] = await query('SELECT id FROM work_items WHERE id = ?', [r.work_item_id]);
      if (!e || !w) { result.dangling++; accounted++; continue; }

      // Checked rather than relying on the insert to no-op, so `migrated`
      // counts rows actually written. Reporting "migrated 2" on a re-run that
      // wrote nothing is the kind of true-sounding number that hides whether
      // the migration ever really happened.
      const [already] = await query(
        'SELECT work_item_id FROM work_entity_associations WHERE work_item_id = ? AND entity_id = ?',
        [r.work_item_id, r.entity_id]
      );
      if (already) { result.alreadyPresent++; accounted++; continue; }

      await query(
        'INSERT INTO work_entity_associations (work_item_id, entity_id) VALUES (?, ?)',
        [r.work_item_id, r.entity_id]
      );
      result.migrated++;
      accounted++;
    }

    // Re-read rather than trusting the count taken before the copy: if anything
    // wrote to this table while we worked, those rows were never considered and
    // must not be dropped from under it.
    const nowHolds = await countRows(table);
    droppable.set(table, nowHolds !== null && accounted >= nowHolds);
  }

  if (drop) {
    for (const { table } of result.present) {
      if (!droppable.get(table)) {
        result.retained.push(table);
        continue;
      }
      // quoteIdentifier schema-qualifies, so on SQL Server this is
      // [MyWork].[table] and cannot reach another schema's objects.
      await query(`DROP TABLE ${quoteIdentifier(table)}`);
      result.dropped.push(table);
    }
  }

  return result;
}

/**
 * Bring the database up to the current schema.
 *
 * This used to carry its own hand-written copy of the generic-engine DDL, in
 * MySQL dialect only: CREATE TABLE IF NOT EXISTS, AUTO_INCREMENT, ENUM(...),
 * ON UPDATE CURRENT_TIMESTAMP, ADD COLUMN IF NOT EXISTS. On SQL Server the very
 * first statement failed with "Incorrect syntax near 'entity_types'" - there is
 * no IF NOT EXISTS clause on CREATE TABLE there, so the parser stops at the
 * table name. Analyze & Migrate could not create a schema on MSSQL at all.
 *
 * It now delegates to the canonical schema modules, which are idempotent, know
 * both dialects, and are the files everything else already treats as the source
 * of truth. A second copy of the schema in a second dialect was always going to
 * drift from them; deleting it is the fix, not translating it.
 *
 * Deliberately built on getPool() rather than the saved system-database config:
 * analyzeAndMigrateAll reconfigures the pool to each context database in turn
 * and calls through here, so this has to follow the pool, not the settings.
 */
async function ensureGenericSchema() {
  try {
    const pool = await getPool();

    if (getCurrentConfig().type === 'mssql') {
      const { createMssqlSchema } = await import('../database/schema/mssqlSchema.js');
      await createMssqlSchema(pool);          // uses pool.request()
    } else {
      const { createMysqlSchema } = await import('../database/schema/mysqlSchema.js');
      await createMysqlSchema(pool);          // uses connection.query(); a pool has it
    }
  } catch (error) {
    logger.error('Error ensuring generic schema:', error);
    throw new Error(`Failed to create generic schema: ${error.message}`);
  }
}

/**
 * Is this error a unique-constraint violation?
 *
 * `error.code === 'ER_DUP_ENTRY'` is a mysql2 code and SQL Server never sets
 * it: there a duplicate arrives as error number 2601 or 2627. The seeding
 * below treats a duplicate as "already done, carry on", so on MSSQL every
 * re-seed would instead rethrow and fail the whole migration.
 */
function isDuplicateKeyError(error) {
  if (error?.code === 'ER_DUP_ENTRY') return true;
  if (error?.number === 2601 || error?.number === 2627) return true;
  return /duplicate key|duplicate entry|violation of (unique|primary key) constraint/i
    .test(error?.message || '');
}

async function seedSystemTypes() {
  try {
    // The definitions are shared with both schema files and phase 0 - see
    // src/database/systemEntityTypes.js. This function used to carry its own
    // copy, which disagreed with all of them on icons and on
    // supports_hierarchy for goal.
    const types = SYSTEM_ENTITY_TYPES;

    const typeMap = new Map();

    // Create all types
    for (const typeData of types) {
      try {
        const result = await query(
          'INSERT INTO entity_types (slug, label, label_singular, icon, supports_hierarchy, is_system, primary_date_field, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [typeData.slug, typeData.label, typeData.label_singular, typeData.icon, typeData.supports_hierarchy ? 1 : 0, 1, typeData.primary_date_field || null, types.indexOf(typeData)]
        );
        typeMap.set(typeData.slug, result.insertId);
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          const existing = await query('SELECT id FROM entity_types WHERE slug = ?', [typeData.slug]);
          typeMap.set(typeData.slug, existing[0].id);
        } else {
          throw error;
        }
      }
    }

    // Create fields for each type
    for (const typeData of types) {
      const typeId = typeMap.get(typeData.slug);
      for (let i = 0; i < typeData.fields.length; i++) {
        const field = typeData.fields[i];
        try {
          await query(
            'INSERT INTO entity_type_fields (entity_type_id, field_key, label, field_type, field_options, required, display_order, show_in_row, is_completion_signal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [typeId, field.field_key, field.label, field.field_type, field.field_options ? JSON.stringify(field.field_options) : null, field.required ? 1 : 0, i, field.show_in_row ? 1 : 0, field.is_completion_signal ? 1 : 0]
          );
        } catch (error) {
          if (!isDuplicateKeyError(error)) throw error;
        }
      }
    }

    // Create the type-to-type relationship rules. Without these, a
    // supports_hierarchy type has no self-nesting rule and every drag-to-nest
    // is rejected.
    for (const rel of resolveTypeRelationships()) {
      const pairs = rel.type_slugs
        ? rel.type_slugs.map((slug) => [slug, slug])
        : (Array.isArray(rel.type_slugs_child) ? rel.type_slugs_child : [rel.type_slugs_child])
            .map((childSlug) => [rel.type_slugs_parent, childSlug]);

      for (const [parentSlug, childSlug] of pairs) {
        const parentId = typeMap.get(parentSlug);
        const childId = typeMap.get(childSlug);
        if (!parentId || !childId) continue;
        try {
          await query(
            'INSERT INTO entity_type_relationships (parent_type_id, child_type_id, relationship_kind, max_children_per_parent, max_parents_per_child) VALUES (?, ?, ?, ?, ?)',
            [parentId, childId, rel.relationship_kind, rel.max_children_per_parent, rel.max_parents_per_child]
          );
        } catch (error) {
          if (!isDuplicateKeyError(error)) throw error;
        }
      }
    }

  } catch (error) {
    logger.error('Error seeding system types:', error);
    throw new Error(`Failed to seed system types: ${error.message}`);
  }
}

async function countSystemTypes() {
  try {
    const result = await query('SELECT COUNT(*) as count FROM entity_types WHERE is_system = 1');
    return result[0]?.count || 0;
  } catch (error) {
    return 0;
  }
}

async function migrateOldData(oldTablesWithData) {
  const result = {
    actions: [],
    warnings: [],
    stats: {}
  };

  try {
    // For now, just log what would be migrated
    // Full migration would require detailed conversion of each table type
    result.actions.push(`✓ Analyzed ${oldTablesWithData.length} old tables with data`);

    for (const item of oldTablesWithData) {
      result.stats[item.table] = item.rows;
      result.actions.push(`  - ${item.table}: ${item.rows} rows to migrate`);
    }

    result.warnings.push('Note: Data migration is non-destructive. Old tables are preserved for reference.');

  } catch (error) {
    logger.error('Error during data migration:', error);
    result.warnings.push(`Migration encountered issues: ${error.message}`);
  }

  return result;
}

async function verifySchema() {
  const verification = {
    isValid: true,
    issues: []
  };

  try {
    // Check that all required generic tables exist
    const missingTables = [];
    for (const table of NEW_GENERIC_TABLES) {
      if (!await tableExists(table)) {
        missingTables.push(table);
      }
    }

    if (missingTables.length > 0) {
      verification.isValid = false;
      verification.issues.push(`Missing tables: ${missingTables.join(', ')}`);
    }

    // And the tables outside the engine that the code still queries - the gap
    // that let a database with missing junctions report itself healthy.
    const missingSupport = [];
    for (const table of REQUIRED_SUPPORT_TABLES) {
      if (!await tableExists(table)) {
        missingSupport.push(table);
      }
    }

    if (missingSupport.length > 0) {
      verification.isValid = false;
      verification.issues.push(
        `Missing support tables the code queries: ${missingSupport.join(', ')}.`
      );
    }
    verification.missingSupport = missingSupport;

    // Check that system types exist
    const systemTypeCount = await countSystemTypes();
    if (systemTypeCount === 0) {
      verification.isValid = false;
      verification.issues.push('No system entity types found');
    }

  } catch (error) {
    logger.error('Error verifying schema:', error);
    verification.isValid = false;
    verification.issues.push(`Verification error: ${error.message}`);
  }

  return verification;
}

/**
 * Unified Analyze & Migrate for system database and all context databases
 * Analyzes and migrates the system database, then all contexts with DB configurations
 */
export async function analyzeAndMigrateAll() {
  const connectionPool = await import('../database/connectionPool.js');
  const contextDatabaseConfigService = await import('./contextDatabaseConfigService.js');
  const contextService = await import('./contextService.js');

  const report = {
    timestamp: new Date().toISOString(),
    systemDatabase: null,
    contextDatabases: [],
    totalDatabasesMigrated: 0,
    totalErrors: 0,
    // Flattened copy of every nested error, tagged with the database it came
    // from. The per-database reports each carry their own `errors`, but the
    // caller only ever looked HERE - so a failed run rendered the sentence
    // "Analysis and migration encountered errors" and nothing else, with the
    // actual message sitting unread one level down.
    errors: [],
    success: true
  };

  const fail = (label, source) => {
    report.success = false;
    report.totalErrors++;
    const messages = source?.errors?.length ? source.errors : ['No error detail was recorded.'];
    for (const m of messages) {
      report.errors.push(`${label}: ${m}`);
      // Server-side too. A failure the user is told about but that leaves no
      // trace in the log is a failure nobody can diagnose afterwards.
      logger.error(`Schema migration failed - ${label}: ${m}`);
    }
  };

  try {
    // Step 1: Analyze and migrate system database
    logger.info('Starting unified schema migration for all databases');
    report.systemDatabase = await analyzeAndMigrate();
    if (report.systemDatabase.success) {
      report.totalDatabasesMigrated++;
    } else {
      fail('System database', report.systemDatabase);
    }

    // Step 2: Get all contexts
    const contexts = await contextService.getAllContexts();
    logger.info(`Found ${contexts.length} contexts to check`);

    // Step 3: For each context with a database configuration, migrate it
    for (const context of contexts) {
      try {
        const liveConfig = await contextDatabaseConfigService.getLiveConnectionConfig(context.id);

        if (!liveConfig) {
          logger.info(`Context ${context.id} (${context.name}) has no database configured, skipping`);
          continue;
        }

        // Save current config
        const currentConfig = connectionPool.getCurrentConfig();

        // Switch to context database
        await connectionPool.reconfigure(liveConfig);
        logger.info(`Switched to context ${context.id} (${context.name}) database`);

        // Analyze and migrate this context's database
        const contextReport = await analyzeAndMigrate();
        contextReport.contextId = context.id;
        contextReport.contextName = context.name;
        report.contextDatabases.push(contextReport);

        if (contextReport.success) {
          report.totalDatabasesMigrated++;
        } else {
          fail(`Context "${context.name}"`, contextReport);
        }

        logger.info(`Completed migration for context ${context.id} (${context.name})`);
      } catch (error) {
        logger.error(`Error migrating context ${context.id}:`, error);
        report.contextDatabases.push({
          contextId: context.id,
          contextName: context.name,
          success: false,
          error: error.message,
          actions: [],
          warnings: [],
          errors: [error.message]
        });
        report.success = false;
        report.totalErrors++;
        report.errors.push(`Context "${context.name}": ${error.message}`);
      }
    }

    logger.info('Schema migration completed for all databases');

  } catch (error) {
    logger.error('Fatal error during unified schema migration:', error);
    report.success = false;
    report.totalErrors++;
    report.fatalError = error.message;
    report.errors.push(`Fatal: ${error.message}`);
  }

  return report;
}
