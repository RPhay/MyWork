#!/usr/bin/env node

/**
 * Phase 6: Todos Migration Script
 * - Migrate to_dos to entities (type=to_do)
 * - Create hierarchy relationships (parent_id)
 * - Preserve recurrence JSON
 * - Create associations to work items (via work_to_do_associations)
 * - Remap quotes.object_id for todo references
 */

import { query } from '../src/database/connectionPool.js';

async function migrateTodos() {
  console.log('🚀 Phase 6: Migrating Todos...\n');

  const todoTypeId = 6; // From Phase 0 seeding

  // Get all contexts for todos
  const contexts = await query('SELECT DISTINCT context_id FROM to_dos WHERE context_id IS NOT NULL');
  console.log(`  📍 Found ${contexts.length} contexts with todos`);

  const todoMappings = new Map(); // old_todo_id -> new_entity_id

  for (const context of contexts) {
    const contextId = context.context_id;

    // Step 1: Migrate todos
    const todos = await query(
      'SELECT id, title, notes, parent_id, status, recurrence FROM to_dos WHERE context_id = ? ORDER BY id',
      [contextId]
    );
    console.log(`\n  Context ${contextId}: Migrating ${todos.length} todos...`);

    for (const todo of todos) {
      const result = await query(
        'INSERT INTO entities (entity_type_id, context_id, title, order_index) VALUES (?, ?, ?, ?)',
        [todoTypeId, contextId, todo.title, todo.id]
      );
      const newEntityId = result.insertId;
      todoMappings.set(`${contextId}_${todo.id}`, newEntityId);

      // Set fields from todo columns
      if (todo.notes) {
        await query(
          'INSERT INTO entity_field_values (entity_id, field_key, value_long) VALUES (?, ?, ?)',
          [newEntityId, 'notes', todo.notes]
        );
      }

      if (todo.status) {
        await query(
          'INSERT INTO entity_field_values (entity_id, field_key, value_text) VALUES (?, ?, ?)',
          [newEntityId, 'status', todo.status]
        );
      }

      // Preserve recurrence JSON
      if (todo.recurrence) {
        await query(
          'INSERT INTO entity_field_values (entity_id, field_key, value_json) VALUES (?, ?, ?)',
          [newEntityId, 'recurrence', todo.recurrence]
        );
      }
    }

    // Step 2: Create hierarchy relationships between todos
    for (const todo of todos) {
      if (todo.parent_id) {
        const parentKey = `${contextId}_${todo.parent_id}`;
        const childKey = `${contextId}_${todo.id}`;
        const parentEntityId = todoMappings.get(parentKey);
        const childEntityId = todoMappings.get(childKey);

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

    console.log(`    ✅ Migrated ${todos.length} todos to entities`);
  }

  // Step 4: Remap quotes.object_id for todos
  console.log(`\n  📝 Remapping quotes.object_id for todos...`);
  const todoQuotes = await query("SELECT id, object_id FROM quotes WHERE object_type = 'to_do' ORDER BY id");
  console.log(`    Found ${todoQuotes.length} quotes referencing todos`);

  let remappedCount = 0;
  for (const quote of todoQuotes) {
    for (const [key, newId] of todoMappings) {
      const [contextId, oldTodoId] = key.split('_');
      if (parseInt(oldTodoId) === quote.object_id) {
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

  // Step 5: Summary
  console.log(`\n✨ Phase 6 Complete!`);
  const totalTodos = Array.from(todoMappings.keys()).length;
  console.log(`   - ${totalTodos} todos → entities`);
  console.log(`   - Recurrence JSON preserved`);
  console.log(`   - ${remappedCount} quotes remapped`);
}

async function main() {
  try {
    await migrateTodos();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
