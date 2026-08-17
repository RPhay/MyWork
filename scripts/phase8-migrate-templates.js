#!/usr/bin/env node

/**
 * Phase 8: Templates Migration Script
 * - Migrate templates to entities (type=template)
 * - Create associations to priorities (via template_priorities)
 * - Create instantiated_from relationships for template → work_item spawning
 * - Remap quotes.object_id for template references
 */

import { query } from '../src/database/connectionPool.js';

async function migrateTemplates() {
  console.log('🚀 Phase 8: Migrating Templates...\n');

  const templateTypeId = 9; // From Phase 0 seeding
  const contextId = 1; // Templates are global

  // Step 1: Migrate templates
  const templates = await query(
    'SELECT id, title, description, emoji, time_box_minutes, status FROM work_item_templates ORDER BY id'
  );
  console.log(`  📋 Migrating ${templates.length} templates...`);

  const templateMappings = new Map(); // old_template_id -> new_entity_id

  for (const template of templates) {
    const result = await query(
      'INSERT INTO entities (entity_type_id, context_id, title, order_index) VALUES (?, ?, ?, ?)',
      [templateTypeId, contextId, template.title, template.id]
    );
    const newEntityId = result.insertId;
    templateMappings.set(template.id, newEntityId);

    // Set fields from template columns
    if (template.description) {
      await query(
        'INSERT INTO entity_field_values (entity_id, field_key, value_long) VALUES (?, ?, ?)',
        [newEntityId, 'description', template.description]
      );
    }

    if (template.emoji) {
      await query(
        'INSERT INTO entity_field_values (entity_id, field_key, value_text) VALUES (?, ?, ?)',
        [newEntityId, 'emoji', template.emoji]
      );
    }

    if (template.time_box_minutes) {
      await query(
        'INSERT INTO entity_field_values (entity_id, field_key, value_number) VALUES (?, ?, ?)',
        [newEntityId, 'time_box_minutes', template.time_box_minutes]
      );
    }

    if (template.status) {
      await query(
        'INSERT INTO entity_field_values (entity_id, field_key, value_text) VALUES (?, ?, ?)',
        [newEntityId, 'status', template.status]
      );
    }
  }

  console.log(`    ✅ Migrated ${templates.length} templates to entities`);

  // Step 2: Create associations from work items to templates (via work_template_associations)
  const workTemplateAssocs = await query('SELECT work_item_id, template_id FROM work_template_associations');
  let workItemAssocCount = 0;
  for (const assoc of workTemplateAssocs) {
    const templateEntityId = templateMappings.get(assoc.template_id);
    if (templateEntityId) {
      try {
        await query(
          'INSERT INTO entity_relationships (context_id, parent_entity_id, child_entity_id, relationship_kind, is_generated, order_index) VALUES (?, ?, ?, ?, ?, ?)',
          [contextId, assoc.work_item_id, templateEntityId, 'instantiated_from', 0, 0]
        );
        workItemAssocCount++;
      } catch (error) {
        if (error.code !== 'ER_DUP_ENTRY') throw error;
      }
    }
  }
  if (workItemAssocCount > 0) {
    console.log(`    ✅ Created ${workItemAssocCount} template-to-work-item instantiation links`);
  }

  // Step 3: Remap quotes.object_id for templates
  console.log(`\n  📝 Remapping quotes.object_id for templates...`);
  const templateQuotes = await query("SELECT id, object_id FROM quotes WHERE object_type = 'template' ORDER BY id");
  console.log(`    Found ${templateQuotes.length} quotes referencing templates`);

  let remappedCount = 0;
  for (const quote of templateQuotes) {
    const newEntityId = templateMappings.get(quote.object_id);
    if (newEntityId) {
      await query(
        'UPDATE quotes SET object_id = ?, object_type = ? WHERE id = ?',
        [newEntityId, 'entity', quote.id]
      );
      remappedCount++;
    }
  }
  console.log(`    ✅ Remapped ${remappedCount} quote references`);

  // Step 4: Summary
  console.log(`\n✨ Phase 8 Complete!`);
  console.log(`   - ${templates.length} templates → entities`);
  console.log(`   - ${workItemAssocCount} instantiation links`);
  console.log(`   - ${remappedCount} quotes remapped`);
}

async function main() {
  try {
    await migrateTemplates();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
