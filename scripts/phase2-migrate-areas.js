#!/usr/bin/env node

/**
 * Phase 2: Areas/Categories Migration Script
 * - Migrate areas to entities (type=area)
 * - Create hierarchy relationships (parent_id)
 * - Create associations to priorities (via priority_areas junction)
 * - Create associations to work items (via work_item_areas junction)
 * - Remap quotes.object_id for area references
 * - Track old→new id mappings
 */

import { query } from '../src/database/connectionPool.js';
import { getActiveContextId } from '../src/services/activeContextService.js';

async function migrateAreas() {
  console.log('🚀 Phase 2: Migrating Areas...\n');

  const areaTypeId = 4; // From Phase 0 seeding
  const priorityTypeId = 3;
  const workItemTypeId = 1;

  // Get all contexts (areas exist in context_id via work_item_area_associations)
  const contexts = await query('SELECT DISTINCT context_id FROM work_items WHERE context_id IS NOT NULL LIMIT 1') || [{ context_id: 1 }];
  console.log(`📍 Found ${contexts.length} contexts with areas`);

  // Track id mappings for quotes.object_id rewriting
  const areaMappings = new Map(); // old_area_id -> new_entity_id
  let totalPriorityAssocs = 0;
  let totalWorkItemAssocs = 0;

  for (const context of contexts) {
    const contextId = context.context_id;
    console.log(`\n  Context ${contextId}:`);

    // Step 1: Migrate areas
    const areas = await query('SELECT id, name, description, parent_id, order_index FROM areas ORDER BY id');
    console.log(`    📂 Migrating ${areas.length} areas...`);

    for (const area of areas) {
      const result = await query(
        'INSERT INTO entities (entity_type_id, context_id, title, order_index) VALUES (?, ?, ?, ?)',
        [areaTypeId, contextId, area.name, area.order_index || area.id]
      );
      const newEntityId = result.insertId;
      areaMappings.set(`${contextId}_${area.id}`, newEntityId);

      // Set description field
      if (area.description) {
        await query(
          'INSERT INTO entity_field_values (entity_id, field_key, value_long) VALUES (?, ?, ?)',
          [newEntityId, 'notes', area.description]
        );
      }
    }

    // Step 2: Create hierarchy relationships between areas
    for (const area of areas) {
      if (area.parent_id) {
        const oldParentKey = `${contextId}_${area.parent_id}`;
        const oldChildKey = `${contextId}_${area.id}`;
        const parentEntityId = areaMappings.get(oldParentKey);
        const childEntityId = areaMappings.get(oldChildKey);

        if (parentEntityId && childEntityId) {
          try {
            await query(
              'INSERT INTO entity_relationships (context_id, parent_entity_id, child_entity_id, relationship_kind, is_generated, order_index) VALUES (?, ?, ?, ?, ?, ?)',
              [contextId, parentEntityId, childEntityId, 'hierarchy', 0, 0]
            );
          } catch (error) {
            if (error.code !== 'ER_DUP_ENTRY') throw error;
          }
        }
      }
    }

    console.log(`    ✅ Migrated ${areas.length} areas to entities`);

    // Step 3: Create associations from areas to priorities (via priority_areas)
    const priorityAreaAssocs = await query('SELECT priority_id, area_id FROM priority_areas');
    let priorityAssocCount = 0;
    for (const assoc of priorityAreaAssocs) {
      const areaKey = `${contextId}_${assoc.area_id}`;
      const areaEntityId = areaMappings.get(areaKey);
      if (areaEntityId) {
        try {
          await query(
            'INSERT INTO entity_relationships (context_id, parent_entity_id, child_entity_id, relationship_kind, is_generated, order_index) VALUES (?, ?, ?, ?, ?, ?)',
            [contextId, areaEntityId, assoc.priority_id, 'association', 0, 0]
          );
          priorityAssocCount++;
        } catch (error) {
          if (error.code !== 'ER_DUP_ENTRY') throw error;
        }
      }
    }
    if (priorityAssocCount > 0) {
      console.log(`    ✅ Created ${priorityAssocCount} priority-area associations`);
      totalPriorityAssocs += priorityAssocCount;
    }

    // Step 4: Create associations from work items to areas (via work_area_associations)
    const workItemAreaAssocs = await query('SELECT work_item_id, area_id FROM work_area_associations');
    let workItemAssocCount = 0;
    for (const assoc of workItemAreaAssocs) {
      const areaKey = `${contextId}_${assoc.area_id}`;
      const areaEntityId = areaMappings.get(areaKey);
      if (areaEntityId) {
        try {
          await query(
            'INSERT INTO entity_relationships (context_id, parent_entity_id, child_entity_id, relationship_kind, is_generated, order_index) VALUES (?, ?, ?, ?, ?, ?)',
            [contextId, assoc.work_item_id, areaEntityId, 'association', 0, 0]
          );
          workItemAssocCount++;
        } catch (error) {
          if (error.code !== 'ER_DUP_ENTRY') throw error;
        }
      }
    }
    if (workItemAssocCount > 0) {
      console.log(`    ✅ Created ${workItemAssocCount} work-item-area associations`);
      totalWorkItemAssocs += workItemAssocCount;
    }
  }

  // Step 5: Remap quotes.object_id for areas
  console.log(`\n  📝 Remapping quotes.object_id for areas...`);
  const areaQuotes = await query("SELECT id, object_id FROM quotes WHERE object_type = 'area' ORDER BY id");
  console.log(`    Found ${areaQuotes.length} quotes referencing areas`);

  let remappedCount = 0;
  for (const quote of areaQuotes) {
    // Find the context and new id for this area
    for (const [key, newId] of areaMappings) {
      const [contextId, oldAreaId] = key.split('_');
      if (parseInt(oldAreaId) === quote.object_id) {
        await query(
          'UPDATE quotes SET object_id = ?, object_type = ? WHERE id = ?',
          [newId, 'entity', quote.id]
        );
        remappedCount++;
        break;
      }
    }
  }
  console.log(`    ✅ Remapped ${remappedCount} quote references`);

  // Step 6: Summary
  console.log(`\n✨ Phase 2 Complete!`);
  const totalAreas = Array.from(areaMappings.keys()).length;
  console.log(`   - ${totalAreas} areas → entities`);
  console.log(`   - ${totalPriorityAssocs} priority associations`);
  console.log(`   - ${totalWorkItemAssocs} work-item associations`);
  console.log(`   - ${remappedCount} quotes remapped`);
  console.log(`\nNext: Drop old tables from schema and verify`);
}

async function main() {
  try {
    await migrateAreas();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
