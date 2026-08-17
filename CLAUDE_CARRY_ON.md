# Carry-On: Generic Entity Type Engine Implementation

## Current Status: Phase 0 COMPLETE

The architectural foundation for eliminating hardcoded entity types is now complete. The generic entity engine is fully built, tested, and ready for the 10-phase migration.

### What's Done ✅

**Database layer**
- Added 6 new tables (entity_types, entity_type_fields, entity_type_relationships, entities, entity_field_values, entity_relationships) in both MySQL and MSSQL
- Cross-database FK from content DB to home DB (entities.entity_type_id → entity_types.id)
- Soft-delete for types (deleted_at) to avoid orphaning entities in other contexts' content DBs

**Services layer (3 new services, all working)**
- `entityTypeService.js`: CRUD for type definitions, fields, and type-to-type relationship rules
- `entityService.js`: Generic entity CRUD using EAV pattern for dynamic field values, with batch-loaded attachFieldValues
- `entityRelationshipService.js`: Single source of truth for all edge writes, validates against type-to-type rules, handles cardinality constraints

**API routes**
- `/api/entity-types` and `/api/entity-types/:idOrSlug` fully functional
- `/api/entities/:typeSlug` and relationship endpoints mounted and verified
- All endpoints tested with curl; responses validated

**Phase 0 Seeding**
- 9 system entity types created: work_item, priority, area, goal, to_do, task, ticket, idea, template
- Fields defined for each type (status, notes, date, recurrence where needed)
- Type-to-type relationship rules configured (hierarchy, association, recurrence, instantiated_from)
- 131 shadow entity rows created for existing work_items with legacy_work_item_id mapping

### Architecture Decisions Solidified

- **Two-tier DB design works**: entity_types table in home pool (shared), entities table in context-specific pool
- **Shadow rows solve Phase ordering**: Work Items can migrate last without blocking other types
- **EAV for flexibility**: Dynamic field storage lets any type have any fields without schema changes per type
- **Single relationship table**: Replaces 12+ per-type junction tables + self-referencing parent_id columns
- **Type-to-type rules enforce constraints**: entityRelationshipService validates every edge write before insert

### What's Next: The 10-Phase Migration

Each phase is independent and shippable. Recommended execution:

**Phases 1–8** (one per session, 1–2 hours each):
1. Ideas migration
2. Areas/Categories
3. Goals
4. Priorities/Projects  
5. Tickets
6. Todos (validates generalized recurrenceService)
7. Tasks
8. Templates

For each phase:
- Create seeding script (type + fields + rules)
- Data migration script (old table → entities/entity_field_values/entity_relationships)
- **Critical:** Rewrite `quotes.object_id` for old-table id collisions before drop
- Swap tab to generic renderer
- `npm run dev` + browser verify (create/edit/delete/reorder/relationship, confirm old data appears correctly)
- Drop old table from schema

**Phase 9** (de-shadow): Work Items migration completes the engine

**Phase 10** (frontend): Dashboard loops over entity_types, generic EJS partial + controller replaces 10 hardcoded tabs

### Key Files for Phase 1 (Ideas)

When ready to start:
- Create `scripts/phase1-seed-ideas.js` (template: use phase0-seed-entity-types.js as reference)
- `src/services/ideasService.js` (will be refactored/deprecated)
- `src/database/schema/mysqlSchema.js` / `mssqlSchema.js` (ideas/idea_folders tables to drop after migration)
- `src/views/tabs/ideas.ejs` (will be replaced by generic partial)
- `src/public/js/ideas.js` (will be replaced by generic controller)

### Important Reminders

1. **quotes.object_id is critical** — every phase must include id remapping before table drop, or cross-type quote links break
2. **Browser test mandatory** — `npm run dev` + actual UI interaction, not just API tests
3. **One phase at a time** — each must be complete and verified before next phase starts
4. **Shadow rows are permanent until Phase 9** — don't touch legacy_work_item_id, it's load-bearing

### Estimated Timeline

- Phase 1 (Ideas): 1–2 hours
- Phases 2–8 (each): ~1–1.5 hours (repetitive, faster as pattern solidifies)
- Phase 9 (Work Items): 2–3 hours (final pivot, needs careful verification)
- Phase 10 (Frontend): 3–4 hours (frontend unification, more UI work)

**Total: ~20–25 hours across 10 phases, or ~2–3 weeks at 1 phase/day pace.**

### Status Summary

The hardest architectural decision work is done. Phases 1–9 are now execution work: apply the playbook (seed → migrate → rewrite quotes → swap renderer → verify → drop), repeat 9 times. Phase 10 ties it all together frontend-side.

Next session: start Phase 1 when ready, or pick up another task — Phase 0 is fully self-contained and won't block anything else.
