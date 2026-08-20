#!/usr/bin/env node

/**
 * Phase 7: Tasks Migration Script
 * - Migrate tasks to entities (type=task)
 * - Create hierarchy relationships (parent_id)
 * - Preserve recurrence JSON
 * - Create associations to work items (via work_task_associations)
 * - Remap quotes.object_id for task references
 */

import { query } from '../src/database/connectionPool.js';

async function migrateTasks() {
  console.log('🚀 Phase 7: Migrating Tasks...\n');

  const taskTypeId = 7; // From Phase 0 seeding

  // Get all contexts for tasks
  const contexts = await query('SELECT DISTINCT context_id FROM tasks WHERE context_id IS NOT NULL');
  console.log(`  📍 Found ${contexts.length} contexts with tasks`);

  const taskMappings = new Map(); // old_task_id -> new_entity_id

  for (const context of contexts) {
    const contextId = context.context_id;

    // Step 1: Migrate tasks
    const tasks = await query(
      'SELECT id, title, notes, parent_id, status, recurrence FROM tasks WHERE context_id = ? ORDER BY id',
      [contextId]
    );
    console.log(`\n  Context ${contextId}: Migrating ${tasks.length} tasks...`);

    for (const task of tasks) {
      const result = await query(
        'INSERT INTO entities (entity_type_id, context_id, title, order_index) VALUES (?, ?, ?, ?)',
        [taskTypeId, contextId, task.title, task.id]
      );
      const newEntityId = result.insertId;
      taskMappings.set(`${contextId}_${task.id}`, newEntityId);

      // Set fields from task columns
      if (task.notes) {
        await query(
          'INSERT INTO entity_field_values (entity_id, field_key, value_long) VALUES (?, ?, ?)',
          [newEntityId, 'notes', task.notes]
        );
      }

      if (task.status) {
        await query(
          'INSERT INTO entity_field_values (entity_id, field_key, value_text) VALUES (?, ?, ?)',
          [newEntityId, 'status', task.status]
        );
      }

      // Preserve recurrence JSON
      if (task.recurrence) {
        await query(
          'INSERT INTO entity_field_values (entity_id, field_key, value_json) VALUES (?, ?, ?)',
          [newEntityId, 'recurrence', task.recurrence]
        );
      }
    }

    // Step 2: Create hierarchy relationships between tasks
    for (const task of tasks) {
      if (task.parent_id) {
        const parentKey = `${contextId}_${task.parent_id}`;
        const childKey = `${contextId}_${task.id}`;
        const parentEntityId = taskMappings.get(parentKey);
        const childEntityId = taskMappings.get(childKey);

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

    console.log(`    ✅ Migrated ${tasks.length} tasks to entities`);
  }

  // Step 3: Remap quotes.object_id for tasks
  console.log(`\n  📝 Remapping quotes.object_id for tasks...`);
  const taskQuotes = await query("SELECT id, object_id FROM quotes WHERE object_type = 'task' ORDER BY id");
  console.log(`    Found ${taskQuotes.length} quotes referencing tasks`);

  let remappedCount = 0;
  for (const quote of taskQuotes) {
    for (const [key, newId] of taskMappings) {
      const [contextId, oldTaskId] = key.split('_');
      if (parseInt(oldTaskId) === quote.object_id) {
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

  // Step 4: Summary
  console.log(`\n✨ Phase 7 Complete!`);
  const totalTasks = Array.from(taskMappings.keys()).length;
  console.log(`   - ${totalTasks} tasks → entities`);
  console.log(`   - Recurrence JSON preserved`);
  console.log(`   - ${remappedCount} quotes remapped`);
}

async function main() {
  try {
    await migrateTasks();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
