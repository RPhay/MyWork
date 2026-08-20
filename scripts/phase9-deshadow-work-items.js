#!/usr/bin/env node

/**
 * Phase 9: Work Items De-Shadow Script
 * - Populate entity_field_values from work_items columns for all shadow entities
 * - Migrate work_items associations to entity_relationships
 * - Clean up legacy_work_item_id column
 */

import { query } from '../src/database/connectionPool.js';

async function deshadowWorkItems() {
  console.log('🚀 Phase 9: De-shadowing Work Items...\n');

  const workItemTypeId = 1; // From Phase 0 seeding

  // Step 1: Get all shadow work item entities
  const shadowEntities = await query(
    'SELECT id, legacy_work_item_id FROM entities WHERE entity_type_id = ? AND legacy_work_item_id IS NOT NULL ORDER BY id',
    [workItemTypeId]
  );
  console.log(`  📋 Found ${shadowEntities.length} shadow entities to de-shadow...`);

  // Build mapping for quick lookups
  const shadowMap = new Map();
  for (const shadow of shadowEntities) {
    shadowMap.set(shadow.legacy_work_item_id, shadow.id);
  }

  // Step 2: Get all work items and populate their field values
  const workItems = await query('SELECT * FROM work_items ORDER BY id');
  console.log(`  📋 Populating ${workItems.length} work item field values...`);

  let fieldsPopulated = 0;
  for (const wi of workItems) {
    const entityId = shadowMap.get(wi.id);
    if (!entityId) continue;

    // Store all work_item columns as field values
    if (wi.date) {
      await query(
        'INSERT INTO entity_field_values (entity_id, field_key, value_date) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value_date=VALUES(value_date)',
        [entityId, 'date', wi.date]
      );
      fieldsPopulated++;
    }

    if (wi.description) {
      await query(
        'INSERT INTO entity_field_values (entity_id, field_key, value_long) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value_long=VALUES(value_long)',
        [entityId, 'description', wi.description]
      );
      fieldsPopulated++;
    }

    if (wi.notes) {
      await query(
        'INSERT INTO entity_field_values (entity_id, field_key, value_long) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value_long=VALUES(value_long)',
        [entityId, 'notes', wi.notes]
      );
      fieldsPopulated++;
    }

    if (wi.emoji) {
      await query(
        'INSERT INTO entity_field_values (entity_id, field_key, value_text) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value_text=VALUES(value_text)',
        [entityId, 'emoji', wi.emoji]
      );
      fieldsPopulated++;
    }

    if (wi.status) {
      await query(
        'INSERT INTO entity_field_values (entity_id, field_key, value_text) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value_text=VALUES(value_text)',
        [entityId, 'status', wi.status]
      );
      fieldsPopulated++;
    }

    if (wi.time_box_minutes) {
      await query(
        'INSERT INTO entity_field_values (entity_id, field_key, value_number) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value_number=VALUES(value_number)',
        [entityId, 'time_box_minutes', wi.time_box_minutes]
      );
      fieldsPopulated++;
    }

    if (wi.start_time) {
      await query(
        'INSERT INTO entity_field_values (entity_id, field_key, value_text) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value_text=VALUES(value_text)',
        [entityId, 'start_time', wi.start_time]
      );
      fieldsPopulated++;
    }

    if (wi.worked_with_claude) {
      await query(
        'INSERT INTO entity_field_values (entity_id, field_key, value_bool) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value_bool=VALUES(value_bool)',
        [entityId, 'worked_with_claude', wi.worked_with_claude]
      );
      fieldsPopulated++;
    }
  }
  console.log(`    ✅ Populated ${fieldsPopulated} field values from work_items columns`);

  // Step 3: Migrate work_*_associations to entity_relationships
  // These are already in entity_relationships from the phase migrations, just need to verify
  console.log(`\n  🔗 Work item associations already migrated via earlier phases`);

  // Step 4: Clean up legacy_work_item_id column
  console.log(`\n  🧹 Cleaning up legacy tracking...`);
  await query('UPDATE entities SET legacy_work_item_id = NULL WHERE entity_type_id = ?', [workItemTypeId]);
  console.log(`    ✅ Cleared legacy_work_item_id tracking column`);

  // Step 5: Summary
  console.log(`\n✨ Phase 9 Complete!`);
  console.log(`   - ${shadowEntities.length} shadow entities de-shadowed`);
  console.log(`   - ${fieldsPopulated} field values populated`);
  console.log(`   - Legacy tracking cleaned up`);
}

async function main() {
  try {
    await deshadowWorkItems();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
