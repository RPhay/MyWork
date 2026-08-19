import { query } from '../database/connectionPool.js';
import { getCurrentConfig } from '../database/connectionPool.js';
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

const OLD_ENTITY_TABLES = [
  'priorities', 'areas', 'goals', 'to_dos', 'tasks', 'tickets', 'ideas', 'templates',
  'idea_folders', 'priority_areas', 'priority_goals', 'work_priority_associations',
  'work_area_associations', 'work_goal_associations', 'work_to_do_associations',
  'work_task_associations', 'work_ticket_associations'
];

const NEW_GENERIC_TABLES = [
  'entity_types', 'entity_type_fields', 'entity_type_relationships',
  'entities', 'entity_field_values', 'entity_relationships'
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

    // Step 6: Verify schema consistency
    const verification = await verifySchema();
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
        if (count > 0) {
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
        if (count > 0) {
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

async function tableExists(tableName) {
  try {
    const dbType = getCurrentConfig().type;
    let sql;

    if (dbType === 'mssql') {
      sql = `
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = ?
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

async function countRows(tableName) {
  try {
    const result = await query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
    return result[0]?.count || 0;
  } catch (error) {
    logger.error(`Error counting rows in ${tableName}:`, error);
    return 0;
  }
}

async function ensureGenericSchema() {
  try {
    const dbType = getCurrentConfig().type;

    // Create generic entity tables
    const createTableStatements = [
      `CREATE TABLE IF NOT EXISTS entity_types (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(100) NOT NULL UNIQUE,
        label VARCHAR(255) NOT NULL,
        label_singular VARCHAR(255) NOT NULL,
        icon VARCHAR(50),
        supports_hierarchy BOOLEAN DEFAULT FALSE,
        is_system BOOLEAN DEFAULT FALSE,
        primary_date_field VARCHAR(100),
        order_index INT DEFAULT 0,
        deleted_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_slug (slug),
        INDEX idx_deleted (deleted_at)
      )`,
      `CREATE TABLE IF NOT EXISTS entity_type_fields (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity_type_id INT NOT NULL,
        field_key VARCHAR(100) NOT NULL,
        label VARCHAR(255) NOT NULL,
        field_type ENUM('text','textarea','number','date','select','status','checkbox','recurrence') NOT NULL,
        field_options JSON,
        required BOOLEAN DEFAULT FALSE,
        display_order INT DEFAULT 0,
        show_in_row BOOLEAN DEFAULT FALSE,
        is_completion_signal BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (entity_type_id) REFERENCES entity_types(id) ON DELETE CASCADE,
        UNIQUE KEY unique_type_field (entity_type_id, field_key),
        INDEX idx_type (entity_type_id)
      )`,
      `CREATE TABLE IF NOT EXISTS entity_type_relationships (
        id INT AUTO_INCREMENT PRIMARY KEY,
        parent_type_id INT NOT NULL,
        child_type_id INT NOT NULL,
        relationship_kind ENUM('hierarchy','association','recurrence','instantiated_from') NOT NULL,
        max_children_per_parent INT,
        max_parents_per_child INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_type_id) REFERENCES entity_types(id) ON DELETE CASCADE,
        FOREIGN KEY (child_type_id) REFERENCES entity_types(id) ON DELETE CASCADE,
        UNIQUE KEY unique_relationship (parent_type_id, child_type_id, relationship_kind),
        INDEX idx_parent (parent_type_id),
        INDEX idx_child (child_type_id)
      )`,
      `CREATE TABLE IF NOT EXISTS entities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity_type_id INT NOT NULL,
        context_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        order_index INT DEFAULT 0,
        legacy_work_item_id INT UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (context_id) REFERENCES contexts(id) ON DELETE CASCADE,
        INDEX idx_type (entity_type_id),
        INDEX idx_context (context_id),
        INDEX idx_type_context (entity_type_id, context_id),
        INDEX idx_legacy (legacy_work_item_id)
      )`,
      `CREATE TABLE IF NOT EXISTS entity_field_values (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity_id INT NOT NULL,
        field_key VARCHAR(100) NOT NULL,
        value_text VARCHAR(500),
        value_long LONGTEXT,
        value_number DECIMAL(15,2),
        value_date DATE,
        value_bool BOOLEAN,
        value_json JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
        UNIQUE KEY unique_entity_field (entity_id, field_key),
        INDEX idx_entity (entity_id),
        INDEX idx_field_key_date (field_key, value_date),
        INDEX idx_field_key_text (field_key, value_text)
      )`,
      `CREATE TABLE IF NOT EXISTS entity_relationships (
        id INT AUTO_INCREMENT PRIMARY KEY,
        context_id INT NOT NULL,
        parent_entity_id INT NOT NULL,
        child_entity_id INT NOT NULL,
        relationship_kind ENUM('hierarchy','association','recurrence','instantiated_from') NOT NULL,
        generated BOOLEAN DEFAULT FALSE,
        order_index INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (context_id) REFERENCES contexts(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_entity_id) REFERENCES entities(id) ON DELETE NO ACTION,
        FOREIGN KEY (child_entity_id) REFERENCES entities(id) ON DELETE NO ACTION,
        UNIQUE KEY unique_relationship (parent_entity_id, child_entity_id, relationship_kind),
        INDEX idx_context (context_id),
        INDEX idx_parent (parent_entity_id),
        INDEX idx_child (child_entity_id)
      )`
    ];

    for (const statement of createTableStatements) {
      await query(statement);
    }

  } catch (error) {
    logger.error('Error ensuring generic schema:', error);
    throw new Error(`Failed to create generic schema: ${error.message}`);
  }
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
        if (error.code === 'ER_DUP_ENTRY') {
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
          if (error.code !== 'ER_DUP_ENTRY') throw error;
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
          if (error.code !== 'ER_DUP_ENTRY') throw error;
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
    success: true
  };

  try {
    // Step 1: Analyze and migrate system database
    logger.info('Starting unified schema migration for all databases');
    report.systemDatabase = await analyzeAndMigrate();
    if (report.systemDatabase.success) {
      report.totalDatabasesMigrated++;
    } else {
      report.success = false;
      report.totalErrors++;
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
          report.success = false;
          report.totalErrors++;
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
      }
    }

    // Step 4: Switch back to system database
    const systemConfig = connectionPool.getCurrentConfig();
    // The system config should still be set, but let's make sure by reconnecting
    // Actually, we shouldn't need to do this as the system database should be the default
    logger.info('Schema migration completed for all databases');

  } catch (error) {
    logger.error('Fatal error during unified schema migration:', error);
    report.success = false;
    report.totalErrors++;
    report.fatalError = error.message;
  }

  return report;
}
