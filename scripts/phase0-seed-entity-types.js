#!/usr/bin/env node

/**
 * Phase 0 Seeding Script
 * - Creates 9 system entity types with their field definitions
 * - Sets up type-to-type relationship rules
 * - Creates shadow entity rows for existing work_items (legacy_work_item_id mapping)
 */

import { query, getCurrentConfig } from '../src/database/connectionPool.js';

// The type definitions live in src/database/systemEntityTypes.js so that this
// script, both schema files and schemaMigrationService all seed identically.
// They used to be four separate copies that disagreed.
import {
  SYSTEM_ENTITY_TYPES as types,
  resolveTypeRelationships,
} from '../src/database/systemEntityTypes.js';

const relationships = resolveTypeRelationships();

async function seedTypes() {
  console.log('🌱 Phase 0: Seeding entity types...');

  const typeMap = new Map(); // slug -> id

  // 1. Create all types
  for (const typeData of types) {
    try {
      const result = await query(
        'INSERT INTO entity_types (slug, label, label_singular, icon, supports_hierarchy, is_system, primary_date_field, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [typeData.slug, typeData.label, typeData.label_singular, typeData.icon, typeData.supports_hierarchy ? 1 : 0, typeData.is_system ? 1 : 0, typeData.primary_date_field || null, types.indexOf(typeData)]
      );
      typeMap.set(typeData.slug, result.insertId);
      console.log(`✅ Created type: ${typeData.label} (${typeData.slug})`);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        const existing = await query('SELECT id FROM entity_types WHERE slug = ?', [typeData.slug]);
        typeMap.set(typeData.slug, existing[0].id);
        console.log(`⏭️  Type already exists: ${typeData.label}`);
      } else {
        throw error;
      }
    }
  }

  // 2. Create fields for each type
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
    console.log(`✅ Created ${typeData.fields.length} fields for ${typeData.label}`);
  }

  // 3. Create relationship rules
  for (const rel of relationships) {
    if (rel.type_slugs) {
      // Self-nesting hierarchy rules
      for (const slug of rel.type_slugs) {
        const typeId = typeMap.get(slug);
        try {
          await query(
            'INSERT INTO entity_type_relationships (parent_type_id, child_type_id, relationship_kind, max_children_per_parent, max_parents_per_child) VALUES (?, ?, ?, ?, ?)',
            [typeId, typeId, rel.relationship_kind, rel.max_children_per_parent, rel.max_parents_per_child]
          );
        } catch (error) {
          if (error.code !== 'ER_DUP_ENTRY') throw error;
        }
      }
      console.log(`✅ Created self-nesting ${rel.relationship_kind} rules for: ${rel.type_slugs.join(', ')}`);
    } else if (rel.type_slugs_parent && rel.type_slugs_child) {
      // Cross-type relationship rules
      const parentTypeId = typeMap.get(rel.type_slugs_parent);
      const childSlugs = Array.isArray(rel.type_slugs_child) ? rel.type_slugs_child : [rel.type_slugs_child];

      for (const childSlug of childSlugs) {
        const childTypeId = typeMap.get(childSlug);
        try {
          await query(
            'INSERT INTO entity_type_relationships (parent_type_id, child_type_id, relationship_kind, max_children_per_parent, max_parents_per_child) VALUES (?, ?, ?, ?, ?)',
            [parentTypeId, childTypeId, rel.relationship_kind, rel.max_children_per_parent, rel.max_parents_per_child]
          );
        } catch (error) {
          if (error.code !== 'ER_DUP_ENTRY') throw error;
        }
      }
      console.log(`✅ Created ${rel.relationship_kind} rules: ${rel.type_slugs_parent} → ${childSlugs.join(', ')}`);
    }
  }

  console.log('\n🌱 Phase 0 Part 2: Creating shadow entity rows for existing work_items...');

  // 4. Create shadow entities for existing work_items
  const workItemTypeId = typeMap.get('work_item');
  const workItems = await query('SELECT id, title FROM work_items ORDER BY id');

  let shadowCount = 0;
  for (const item of workItems) {
    try {
      const result = await query(
        'INSERT INTO entities (entity_type_id, context_id, title, legacy_work_item_id, order_index) SELECT ?, context_id, ?, ?, id FROM work_items WHERE id = ?',
        [workItemTypeId, item.title, item.id, item.id]
      );
      shadowCount++;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        // Shadow already exists
      } else {
        throw error;
      }
    }
  }
  console.log(`✅ Created ${shadowCount} shadow entity rows for work_items`);

  console.log('\n✨ Phase 0 seeding complete!');
  console.log(`   - ${types.length} entity types`);
  console.log(`   - ${types.reduce((sum, t) => sum + t.fields.length, 0)} fields`);
  console.log(`   - ${shadowCount} shadow work_item entities`);
}

async function main() {
  try {
    const config = getCurrentConfig();
    console.log(`📦 Using database: ${config.database.host}/${config.database.database}`);
    await seedTypes();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
