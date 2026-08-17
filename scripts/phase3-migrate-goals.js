#!/usr/bin/env node

/**
 * Phase 3: Goals Migration Script
 * - Migrate goals to entities (type=goal)
 * - Create associations to priorities (via priority_goals junction)
 * - Create associations to areas (via goal_associations junction)
 * - Remap quotes.object_id for goal references
 * - Track old→new id mappings
 */

import { query } from '../src/database/connectionPool.js';

async function migrateGoals() {
  console.log('🚀 Phase 3: Migrating Goals...\n');

  const goalTypeId = 5; // From Phase 0 seeding
  const contextId = 1; // Goals are global, use context 1

  console.log(`  Querying goals...`);

  // Step 1: Migrate goals
  const goals = await query('SELECT id, year, name, description, measurements, goal_updates, status, due_date, order_index FROM goals ORDER BY id');
  console.log(`  📊 Migrating ${goals.length} goals...`);

  const goalMappings = new Map(); // old_goal_id -> new_entity_id

  for (const goal of goals) {
    const result = await query(
      'INSERT INTO entities (entity_type_id, context_id, title, order_index) VALUES (?, ?, ?, ?)',
      [goalTypeId, contextId, goal.name, goal.order_index || goal.id]
    );
    const newEntityId = result.insertId;
    goalMappings.set(goal.id, newEntityId);

    // Set fields from goal columns
    if (goal.description) {
      await query(
        'INSERT INTO entity_field_values (entity_id, field_key, value_long) VALUES (?, ?, ?)',
        [newEntityId, 'notes', goal.description]
      );
    }

    if (goal.status) {
      await query(
        'INSERT INTO entity_field_values (entity_id, field_key, value_text) VALUES (?, ?, ?)',
        [newEntityId, 'status', goal.status]
      );
    }

    if (goal.due_date) {
      await query(
        'INSERT INTO entity_field_values (entity_id, field_key, value_date) VALUES (?, ?, ?)',
        [newEntityId, 'due_date', goal.due_date]
      );
    }

    if (goal.year) {
      await query(
        'INSERT INTO entity_field_values (entity_id, field_key, value_number) VALUES (?, ?, ?)',
        [newEntityId, 'year', goal.year]
      );
    }

    if (goal.measurements) {
      await query(
        'INSERT INTO entity_field_values (entity_id, field_key, value_long) VALUES (?, ?, ?)',
        [newEntityId, 'measurements', goal.measurements]
      );
    }

    if (goal.goal_updates) {
      await query(
        'INSERT INTO entity_field_values (entity_id, field_key, value_long) VALUES (?, ?, ?)',
        [newEntityId, 'goal_updates', goal.goal_updates]
      );
    }
  }

  console.log(`    ✅ Migrated ${goals.length} goals to entities`);

  // Step 2: Create associations from goals to priorities (via priority_goals)
  const priorityGoalAssocs = await query('SELECT priority_id, goal_id FROM priority_goals');
  let priorityAssocCount = 0;
  for (const assoc of priorityGoalAssocs) {
    const goalEntityId = goalMappings.get(assoc.goal_id);
    if (goalEntityId) {
      try {
        await query(
          'INSERT INTO entity_relationships (context_id, parent_entity_id, child_entity_id, relationship_kind, is_generated, order_index) VALUES (?, ?, ?, ?, ?, ?)',
          [contextId, assoc.priority_id, goalEntityId, 'association', 0, 0]
        );
        priorityAssocCount++;
      } catch (error) {
        if (error.code !== 'ER_DUP_ENTRY') throw error;
      }
    }
  }
  if (priorityAssocCount > 0) {
    console.log(`    ✅ Created ${priorityAssocCount} priority-goal associations`);
  }

  // Step 3: Create associations from work items to goals (via work_goal_associations)
  const workGoalAssocs = await query('SELECT work_item_id, goal_id FROM work_goal_associations');
  let workItemAssocCount = 0;
  for (const assoc of workGoalAssocs) {
    const goalEntityId = goalMappings.get(assoc.goal_id);
    if (goalEntityId) {
      try {
        await query(
          'INSERT INTO entity_relationships (context_id, parent_entity_id, child_entity_id, relationship_kind, is_generated, order_index) VALUES (?, ?, ?, ?, ?, ?)',
          [contextId, assoc.work_item_id, goalEntityId, 'association', 0, 0]
        );
        workItemAssocCount++;
      } catch (error) {
        if (error.code !== 'ER_DUP_ENTRY') throw error;
      }
    }
  }
  if (workItemAssocCount > 0) {
    console.log(`    ✅ Created ${workItemAssocCount} work-item-goal associations`);
  }

  // Step 4: Remap quotes.object_id for goals
  console.log(`\n  📝 Remapping quotes.object_id for goals...`);
  const goalQuotes = await query("SELECT id, object_id FROM quotes WHERE object_type = 'goal' ORDER BY id");
  console.log(`    Found ${goalQuotes.length} quotes referencing goals`);

  let remappedCount = 0;
  for (const quote of goalQuotes) {
    const goalEntityId = goalMappings.get(quote.object_id);
    if (goalEntityId) {
      await query(
        'UPDATE quotes SET object_id = ?, object_type = ? WHERE id = ?',
        [goalEntityId, 'entity', quote.id]
      );
      remappedCount++;
    }
  }
  console.log(`    ✅ Remapped ${remappedCount} quote references`);

  // Step 5: Summary
  console.log(`\n✨ Phase 3 Complete!`);
  console.log(`   - ${goals.length} goals → entities`);
  console.log(`   - ${priorityAssocCount} priority associations`);
  console.log(`   - ${workItemAssocCount} work-item associations`);
  console.log(`   - ${remappedCount} quotes remapped`);
  console.log(`\nNext: Drop old tables from schema and verify`);
}

async function main() {
  try {
    await migrateGoals();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
