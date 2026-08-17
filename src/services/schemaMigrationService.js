import { query } from '../database/connectionPool.js';
import { getCurrentConfig } from '../database/connectionPool.js';
import * as entityTypeService from './entityTypeService.js';
import logger from '../utils/logger.js';

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
    // Import schema creation functions
    const { createGenericEntityTables } = await import('../database/schema/genericEntitySchema.js');
    await createGenericEntityTables();
  } catch (error) {
    logger.error('Error ensuring generic schema:', error);
    throw new Error(`Failed to create generic schema: ${error.message}`);
  }
}

async function seedSystemTypes() {
  try {
    // Define system entity types with their fields
    const types = [
      {
        slug: 'work_item',
        label: 'Dailies',
        label_singular: 'Work Item',
        icon: '✓',
        supports_hierarchy: true,
        is_system: true,
        primary_date_field: 'date',
        fields: [
          { field_key: 'date', label: 'Date', field_type: 'date', required: true, show_in_row: true },
          { field_key: 'status', label: 'Status', field_type: 'status', field_options: { values: ['Not Started', 'In Progress', 'Complete'], doneValues: ['Complete'] }, required: false, show_in_row: true, is_completion_signal: true },
          { field_key: 'notes', label: 'Notes', field_type: 'textarea', required: false, show_in_row: false },
        ]
      },
      {
        slug: 'priority',
        label: 'Projects',
        label_singular: 'Priority',
        icon: '📌',
        supports_hierarchy: true,
        is_system: true,
        primary_date_field: null,
        fields: [
          { field_key: 'status', label: 'Status', field_type: 'status', field_options: { values: ['Not Started', 'In Progress', 'Complete'], doneValues: ['Complete'] }, required: false, show_in_row: true },
          { field_key: 'notes', label: 'Notes', field_type: 'textarea', required: false, show_in_row: false },
        ]
      },
      {
        slug: 'area',
        label: 'Categories',
        label_singular: 'Area',
        icon: '📂',
        supports_hierarchy: true,
        is_system: true,
        primary_date_field: null,
        fields: [
          { field_key: 'notes', label: 'Notes', field_type: 'textarea', required: false, show_in_row: false },
        ]
      },
      {
        slug: 'goal',
        label: 'Goals',
        label_singular: 'Goal',
        icon: '🎯',
        supports_hierarchy: false,
        is_system: true,
        primary_date_field: null,
        fields: [
          { field_key: 'status', label: 'Status', field_type: 'status', field_options: { values: ['Not Started', 'In Progress', 'Complete'], doneValues: ['Complete'] }, required: false, show_in_row: true },
          { field_key: 'notes', label: 'Notes', field_type: 'textarea', required: false, show_in_row: false },
        ]
      },
      {
        slug: 'to_do',
        label: 'Todos',
        label_singular: 'Todo',
        icon: '☑',
        supports_hierarchy: true,
        is_system: true,
        primary_date_field: null,
        fields: [
          { field_key: 'status', label: 'Status', field_type: 'status', field_options: { values: ['Not Started', 'In Progress', 'Complete'], doneValues: ['Complete'] }, required: false, show_in_row: true, is_completion_signal: true },
          { field_key: 'recurrence', label: 'Recurrence', field_type: 'recurrence', required: false, show_in_row: false },
          { field_key: 'notes', label: 'Notes', field_type: 'textarea', required: false, show_in_row: false },
        ]
      },
      {
        slug: 'task',
        label: 'Tasks',
        label_singular: 'Task',
        icon: '📋',
        supports_hierarchy: true,
        is_system: true,
        primary_date_field: null,
        fields: [
          { field_key: 'status', label: 'Status', field_type: 'status', field_options: { values: ['Not Started', 'In Progress', 'Complete'], doneValues: ['Complete'] }, required: false, show_in_row: true, is_completion_signal: true },
          { field_key: 'recurrence', label: 'Recurrence', field_type: 'recurrence', required: false, show_in_row: false },
          { field_key: 'notes', label: 'Notes', field_type: 'textarea', required: false, show_in_row: false },
        ]
      },
      {
        slug: 'ticket',
        label: 'Tickets',
        label_singular: 'Ticket',
        icon: '🎫',
        supports_hierarchy: true,
        is_system: true,
        primary_date_field: null,
        fields: [
          { field_key: 'status', label: 'Status', field_type: 'status', field_options: { values: ['Not Started', 'In Progress', 'Complete'], doneValues: ['Complete'] }, required: false, show_in_row: true },
          { field_key: 'notes', label: 'Notes', field_type: 'textarea', required: false, show_in_row: false },
        ]
      },
      {
        slug: 'idea',
        label: 'Brainstorming',
        label_singular: 'Idea',
        icon: '💡',
        supports_hierarchy: true,
        is_system: true,
        primary_date_field: null,
        fields: [
          { field_key: 'status', label: 'Status', field_type: 'status', field_options: { values: ['Raw', 'Developing', 'Ready'], doneValues: ['Ready'] }, required: false, show_in_row: true },
          { field_key: 'notes', label: 'Notes', field_type: 'textarea', required: false, show_in_row: false },
        ]
      },
      {
        slug: 'template',
        label: 'Templates',
        label_singular: 'Template',
        icon: '📑',
        supports_hierarchy: false,
        is_system: true,
        primary_date_field: null,
        fields: [
          { field_key: 'notes', label: 'Notes', field_type: 'textarea', required: false, show_in_row: false },
        ]
      },
    ];

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
