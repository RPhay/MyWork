#!/usr/bin/env node

/**
 * Phase 1: Ideas Migration Script
 * - Migrate idea_folders to entities (type=idea)
 * - Migrate ideas to entities (type=idea)
 * - Create hierarchy relationships (parent_id)
 * - Create associations to priorities
 * - Remap quotes.object_id for idea references
 * - Track old→new id mappings
 */

import { query } from '../src/database/connectionPool.js';
import { getActiveContextId } from '../src/services/activeContextService.js';

async function migrateIdeas() {
  console.log('🚀 Phase 1: Migrating Ideas...\n');

  const ideaTypeId = 9; // From Phase 0 seeding
  const priorityTypeId = 3; // From Phase 0 seeding

  // Get all contexts (ideas exist in context_id)
  const contexts = await query('SELECT DISTINCT context_id FROM ideas');
  console.log(`📍 Found ${contexts.length} contexts with ideas`);

  // Track id mappings for quotes.object_id rewriting
  const folderMappings = new Map(); // old_folder_id -> new_entity_id
  const ideaMappings = new Map();    // old_idea_id -> new_entity_id

  for (const context of contexts) {
    const contextId = context.context_id;
    console.log(`\n  Context ${contextId}:`);

    // Step 1: Migrate idea_folders
    const folders = await query('SELECT id, name, parent_id FROM idea_folders ORDER BY id');
    console.log(`    📁 Migrating ${folders.length} idea_folders...`);

    for (const folder of folders) {
      const result = await query(
        'INSERT INTO entities (entity_type_id, context_id, title, order_index) VALUES (?, ?, ?, ?)',
        [ideaTypeId, contextId, folder.name, folder.id]
      );
      folderMappings.set(`${contextId}_${folder.id}`, result.insertId);
    }

    // Step 2: Create hierarchy relationships between folders
    for (const folder of folders) {
      if (folder.parent_id) {
        const oldParentKey = `${contextId}_${folder.parent_id}`;
        const oldChildKey = `${contextId}_${folder.id}`;
        const parentEntityId = folderMappings.get(oldParentKey);
        const childEntityId = folderMappings.get(oldChildKey);

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

    // Step 3: Migrate ideas
    const ideas = await query(
      'SELECT id, title, notes, folder_id, priority_id FROM ideas WHERE context_id = ? ORDER BY id',
      [contextId]
    );
    console.log(`    💡 Migrating ${ideas.length} ideas...`);

    for (const idea of ideas) {
      const result = await query(
        'INSERT INTO entities (entity_type_id, context_id, title, order_index) VALUES (?, ?, ?, ?)',
        [ideaTypeId, contextId, idea.title, idea.id]
      );
      const newEntityId = result.insertId;
      ideaMappings.set(`${contextId}_${idea.id}`, newEntityId);

      // Set notes field
      if (idea.notes) {
        await query(
          'INSERT INTO entity_field_values (entity_id, field_key, value_long) VALUES (?, ?, ?)',
          [newEntityId, 'notes', idea.notes]
        );
      }

      // Create hierarchy relationship to folder (if folder exists)
      if (idea.folder_id) {
        const folderKey = `${contextId}_${idea.folder_id}`;
        const parentEntityId = folderMappings.get(folderKey);
        if (parentEntityId) {
          try {
            await query(
              'INSERT INTO entity_relationships (context_id, parent_entity_id, child_entity_id, relationship_kind, is_generated, order_index) VALUES (?, ?, ?, ?, ?, ?)',
              [contextId, parentEntityId, newEntityId, 'hierarchy', 0, 0]
            );
          } catch (error) {
            if (error.code !== 'ER_DUP_ENTRY') throw error;
          }
        }
      }

      // Create association to priority (if priority exists)
      if (idea.priority_id) {
        try {
          await query(
            'INSERT INTO entity_relationships (context_id, parent_entity_id, child_entity_id, relationship_kind, is_generated, order_index) VALUES (?, ?, ?, ?, ?, ?)',
            [contextId, newEntityId, idea.priority_id, 'association', 0, 0]
          );
        } catch (error) {
          if (error.code !== 'ER_DUP_ENTRY') throw error;
        }
      }
    }

    console.log(`    ✅ Migrated ${ideas.length} ideas + ${folders.length} folders to entities`);
  }

  // Step 4: Remap quotes.object_id for ideas
  console.log(`\n  📝 Remapping quotes.object_id for ideas...`);
  const ideaQuotes = await query("SELECT id, object_id FROM quotes WHERE object_type = 'idea' ORDER BY id");
  console.log(`    Found ${ideaQuotes.length} quotes referencing ideas`);

  let remappedCount = 0;
  for (const quote of ideaQuotes) {
    // Find the context for this quote (we need to look at what idea it references)
    // For now, assume it's in the active context or scan all
    for (const [key, newId] of ideaMappings) {
      const [contextId, oldIdeaId] = key.split('_');
      if (parseInt(oldIdeaId) === quote.object_id) {
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
  console.log(`\n✨ Phase 1 Complete!`);
  console.log(`   - ${folderMappings.size} idea_folders → entities`);
  console.log(`   - ${ideaMappings.size} ideas → entities`);
  console.log(`   - ${remappedCount} quotes remapped`);
  console.log(`   - Hierarchy relationships created`);
  console.log(`   - Priority associations created`);
  console.log(`\nNext: Drop old tables from schema and swap renderer`);
}

async function main() {
  try {
    await migrateIdeas();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
