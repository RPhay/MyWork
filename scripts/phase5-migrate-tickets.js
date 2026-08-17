#!/usr/bin/env node

/**
 * Phase 5: Tickets Migration Script
 * - Migrate tickets to entities (type=ticket)
 * - Create associations to priorities (via ticket.priority_id)
 * - Create associations to work items (via work_ticket_associations)
 * - Remap quotes.object_id for ticket references
 */

import { query } from '../src/database/connectionPool.js';

async function migrateTickets() {
  console.log('🚀 Phase 5: Migrating Tickets...\n');

  const ticketTypeId = 8; // From Phase 0 seeding

  // Get all contexts for tickets
  const contexts = await query('SELECT DISTINCT context_id FROM tickets WHERE context_id IS NOT NULL');
  console.log(`  📍 Found ${contexts.length} contexts with tickets`);

  const ticketMappings = new Map(); // old_ticket_id -> new_entity_id

  for (const context of contexts) {
    const contextId = context.context_id;

    // Step 1: Migrate tickets
    const tickets = await query(
      'SELECT id, title, notes, ticket_type, priority_id FROM tickets WHERE context_id = ? ORDER BY id',
      [contextId]
    );
    console.log(`\n  Context ${contextId}: Migrating ${tickets.length} tickets...`);

    for (const ticket of tickets) {
      const result = await query(
        'INSERT INTO entities (entity_type_id, context_id, title, order_index) VALUES (?, ?, ?, ?)',
        [ticketTypeId, contextId, ticket.title, ticket.id]
      );
      const newEntityId = result.insertId;
      ticketMappings.set(`${contextId}_${ticket.id}`, newEntityId);

      // Set fields from ticket columns
      if (ticket.notes) {
        await query(
          'INSERT INTO entity_field_values (entity_id, field_key, value_long) VALUES (?, ?, ?)',
          [newEntityId, 'notes', ticket.notes]
        );
      }

      if (ticket.ticket_type) {
        await query(
          'INSERT INTO entity_field_values (entity_id, field_key, value_text) VALUES (?, ?, ?)',
          [newEntityId, 'ticket_type', ticket.ticket_type]
        );
      }

      // Create association to priority if exists
      if (ticket.priority_id) {
        try {
          await query(
            'INSERT INTO entity_relationships (context_id, parent_entity_id, child_entity_id, relationship_kind, is_generated, order_index) VALUES (?, ?, ?, ?, ?, ?)',
            [contextId, ticket.priority_id, newEntityId, 'association', 0, 0]
          );
        } catch (error) {
          if (error.code !== 'ER_DUP_ENTRY') throw error;
        }
      }
    }

    console.log(`    ✅ Migrated ${tickets.length} tickets to entities`);

    // Step 2: Create associations from work items to tickets (via work_ticket_associations)
    const workTicketAssocs = await query(
      'SELECT work_item_id, ticket_id FROM work_ticket_associations WHERE work_item_id IN (SELECT id FROM work_items WHERE context_id = ?)',
      [contextId]
    );
    let workItemAssocCount = 0;
    for (const assoc of workTicketAssocs) {
      const ticketKey = `${contextId}_${assoc.ticket_id}`;
      const ticketEntityId = ticketMappings.get(ticketKey);
      if (ticketEntityId) {
        try {
          await query(
            'INSERT INTO entity_relationships (context_id, parent_entity_id, child_entity_id, relationship_kind, is_generated, order_index) VALUES (?, ?, ?, ?, ?, ?)',
            [contextId, assoc.work_item_id, ticketEntityId, 'association', 0, 0]
          );
          workItemAssocCount++;
        } catch (error) {
          if (error.code !== 'ER_DUP_ENTRY') throw error;
        }
      }
    }
    if (workItemAssocCount > 0) {
      console.log(`    ✅ Created ${workItemAssocCount} work-item-ticket associations`);
    }
  }

  // Step 3: Remap quotes.object_id for tickets
  console.log(`\n  📝 Remapping quotes.object_id for tickets...`);
  const ticketQuotes = await query("SELECT id, object_id FROM quotes WHERE object_type = 'ticket' ORDER BY id");
  console.log(`    Found ${ticketQuotes.length} quotes referencing tickets`);

  let remappedCount = 0;
  for (const quote of ticketQuotes) {
    // Find context for this ticket (scan all mapped tickets)
    for (const [key, newId] of ticketMappings) {
      const [contextId, oldTicketId] = key.split('_');
      if (parseInt(oldTicketId) === quote.object_id) {
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
  console.log(`\n✨ Phase 5 Complete!`);
  const totalTickets = Array.from(ticketMappings.keys()).length;
  console.log(`   - ${totalTickets} tickets → entities`);
  console.log(`   - Quote references remapped`);
  console.log(`\nNext: Drop old tables from schema and verify`);
}

async function main() {
  try {
    await migrateTickets();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
