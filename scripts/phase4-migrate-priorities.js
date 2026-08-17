#!/usr/bin/env node

/**
 * Phase 4: Priorities/Projects Migration Script
 * - Migrate priorities to entities (type=priority)
 * - Create hierarchy relationships (parent_id)
 * - Create associations to goals (via priority_goals - already deleted in Phase 3)
 * - Create associations to work items (via work_priority_associations)
 * - Remap quotes.object_id for priority references
 */

import { query } from '../src/database/connectionPool.js';

async function migratePriorities() {
  console.log('🚀 Phase 4: Migrating Priorities/Projects...\n');

  const priorityTypeId = 3; // From Phase 0 seeding
  const contextId = 1; // Priorities are global, use context 1

  // Step 1: Migrate priorities
  const priorities = await query(
    'SELECT id, title, source_id, parent_id, notes, status, order_index FROM priorities ORDER BY id'
  );
  console.log(`  🎯 Migrating ${priorities.length} priorities...`);

  const priorityMappings = new Map(); // old_priority_id -> new_entity_id

  for (const priority of priorities) {
    const result = await query(
      'INSERT INTO entities (entity_type_id, context_id, title, order_index) VALUES (?, ?, ?, ?)',
      [priorityTypeId, contextId, priority.title, priority.order_index || priority.id]
    );
    const newEntityId = result.insertId;
    priorityMappings.set(priority.id, newEntityId);

    // Set fields from priority columns
    if (priority.notes) {
      await query(
        'INSERT INTO entity_field_values (entity_id, field_key, value_long) VALUES (?, ?, ?)',
        [newEntityId, 'notes', priority.notes]
      );
    }

    if (priority.status) {
      await query(
        'INSERT INTO entity_field_values (entity_id, field_key, value_text) VALUES (?, ?, ?)',
        [newEntityId, 'status', priority.status]
      );
    }
  }

  console.log(`    ✅ Migrated ${priorities.length} priorities to entities`);

  // Step 2: Create hierarchy relationships between priorities
  for (const priority of priorities) {
    if (priority.parent_id) {
      const oldParentKey = priority.parent_id;
      const oldChildKey = priority.id;
      const parentEntityId = priorityMappings.get(oldParentKey);
      const childEntityId = priorityMappings.get(oldChildKey);

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

  // Step 3: Create associations from work items to priorities (via work_priority_associations)
  const workPriorityAssocs = await query('SELECT work_item_id, priority_id FROM work_priority_associations');
  let workItemAssocCount = 0;
  for (const assoc of workPriorityAssocs) {
    const priorityEntityId = priorityMappings.get(assoc.priority_id);
    if (priorityEntityId) {
      try {
        await query(
          'INSERT INTO entity_relationships (context_id, parent_entity_id, child_entity_id, relationship_kind, is_generated, order_index) VALUES (?, ?, ?, ?, ?, ?)',
          [contextId, assoc.work_item_id, priorityEntityId, 'association', 0, 0]
        );
        workItemAssocCount++;
      } catch (error) {
        if (error.code !== 'ER_DUP_ENTRY') throw error;
      }
    }
  }
  if (workItemAssocCount > 0) {
    console.log(`    ✅ Created ${workItemAssocCount} work-item-priority associations`);
  }

  // Step 4: Remap quotes.object_id for priorities
  console.log(`\n  📝 Remapping quotes.object_id for priorities...`);
  const priorityQuotes = await query("SELECT id, object_id FROM quotes WHERE object_type = 'priority' ORDER BY id");
  console.log(`    Found ${priorityQuotes.length} quotes referencing priorities`);

  let remappedCount = 0;
  for (const quote of priorityQuotes) {
    const priorityEntityId = priorityMappings.get(quote.object_id);
    if (priorityEntityId) {
      await query(
        'UPDATE quotes SET object_id = ?, object_type = ? WHERE id = ?',
        [priorityEntityId, 'entity', quote.id]
      );
      remappedCount++;
    }
  }
  console.log(`    ✅ Remapped ${remappedCount} quote references`);

  // Step 5: Summary
  console.log(`\n✨ Phase 4 Complete!`);
  console.log(`   - ${priorities.length} priorities → entities`);
  console.log(`   - ${workItemAssocCount} work-item associations`);
  console.log(`   - ${remappedCount} quotes remapped`);
  console.log(`\nNext: Drop old tables from schema and verify`);
}

async function main() {
  try {
    await migratePriorities();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
