# UI Standards: Generic Entity Engine & Dynamic Views

**UPDATED (Phase 10):** This document describes the unified generic entity rendering system, fully implemented as of Phase 10. All entity types (work items, priorities, todos, tasks, goals, areas, tickets, ideas, templates) now use the same generic engine instead of type-specific implementations.

The architecture relies on:
- **Generic Entity Service** (`src/services/entityService.js`): CRUD for any entity type
- **Generic Entity Routes** (`src/routes/api/entities.js`): polymorphic `/api/entities/:typeSlug` endpoints
- **Type Registry** (`src/services/entityTypeService.js`): dynamic field schemas and relationship rules
- **Generic Renderer** (`src/public/js/genericEntity.js`): reusable tree/row/editor for all types

## 1. Generic Row Rendering (Unified for All Types)

The generic renderer now handles all entity types with a single row template:

- **Generic render function** (`src/public/js/genericEntity.js#renderEntityRow`): takes an entity object and type schema, emits HTML for any type
- **Field rendering strategy map**: `fieldRenderers[fieldType](field, value)` — swap renderers per field type (text, textarea, number, date, select, status, checkbox, recurrence), not per entity type
- **Row identification**: `data-entity-id="${id}"` and `data-entity-type="${typeSlug}"` on the row's outer element — the dual key is necessary to route drag/edit/delete actions to the correct type endpoint
- **Dynamic field display**: fields to show, field labels, and edit control types all come from the type's schema in `entity_types` and `entity_type_fields` tables — no hardcoding in templates or JS

**Migrating from type-specific renderers:**
If you find yourself adding a type-specific render function, stop and add the field to the type's schema instead. The generic engine should handle it.

## 2. Tree Rendering (Hierarchy & Relationships)

**Standard: CSS-only expand/collapse** — applies uniformly to all hierarchical types via the generic renderer.

- **Full DOM upfront**: `genericEntity.js#renderTree()` emits all nodes and their descendants in a single render, organized as:
  ```html
  <div class="entity-node" data-entity-id="${id}">
    <div class="entity-node-header"><!-- title, toggle, actions --></div>
    <div class="entity-node-children"><!-- recursive children --></div>
  </div>
  ```
- **CSS-only state**: toggling `classList.add/remove('expanded')` on `.entity-node` drives child visibility via:
  ```css
  .entity-node-children { display: none; }
  .entity-node.expanded > .entity-node-children { display: block; }
  ```
- **Indentation**: `${depth * 18}px` inline-style spacer span — computed by `genericEntity.js#buildPathMap()` 
- **Event delegation**: toggle click binding via `.closest('[data-action="toggle-expand"]')`, not direct element checks
- **Auto-expand parents**: when an item is selected or edited, `genericEntity.js#expandAncestors()` recursively opens the path to the root

**Type configuration**: A type's `supports_hierarchy` flag in `entity_types` determines whether the tree render is invoked (true) or flat list (false).

## 3. Generic Editor (Unified for All Types)

**Single generic editor** (`src/public/js/genericEntity.js#EntityEditor`) replaces all type-specific editor modules:

```js
const EntityEditor = (() => {
  let splitPane, currentEntityId, currentTypeSlug, typeSchema, hasChanges;
  const trackFormChanges = createChangeTracker(formElement, saveButton); // via changeTracker factory
  const fillForm = (entity, fields) => fields.forEach(f => applyFieldValue(form, f, entity.fields[f.field_key]));
  const save = () => fetch(`/api/entities/${typeSlug}/${entityId}`, { ... });
  return { init, populate, save, close };
})();
```

**Key differences from per-type editors:**
- **Dynamic form generation**: `EntityEditor#buildForm(typeSchema)` generates form fields from `entity_type_fields` at runtime, not hardcoded in HTML
- **Field rendering strategy**: each form field is rendered via `fieldRenderers[field.field_type](field)` to emit the appropriate control (text input, textarea, date picker, select, etc.)
- **Single change-tracker instance**: shared `createChangeTracker()` factory (`src/public/js/changeTracker.js`) replaces 8+ copy-pasted implementations
- **Pane visibility**: `splitPane.showRightPane()` / `hideRightPane()` only called by the editor, just as before
- **Automatic field mapping**: no `fillForm()`/`save()` branching — the type schema tells the editor which fields exist and what type each is

**No type-specific editors exist anymore.** If you need custom editing logic for a type, add it as a custom field renderer in `fieldRenderers`, not a new editor module.

## 4. Dynamic Field Mapping (From Type Schema)

**No hardcoded type-specific field maps exist.** Field mapping is data-driven:

- **Source of truth**: `entity_type_fields` table — defines which fields belong to which type, their display order, label, and control type
- **At render time**: `genericEntity.js#buildForm(typeSchema)` queries the type's fields and generates form controls dynamically
- **At save time**: `genericEntity.js#collectFormValues(typeSchema)` reads all fields defined for that type and sends them in the POST/PUT body
- **Future custom types**: when a user creates a new type in Settings with custom fields, the generic editor automatically handles them — no code changes

**Consistency guaranteed by single source of truth:** Because all types use the same generic editor + dynamic schema, there's no risk of two "interpretations" of which fields a type has (the problem that spawned the `ff2b943` fix). The schema is consulted once at render time and is authoritative.

## 5. CSS & Class Naming (Generic System)

- **kebab-case with entity-prefix**: `entity-node`, `entity-node-header`, `entity-node-children`, `entity-row`, `entity-toggle` — consistency across all types
- **Shared generic rules**: `src/public/css/main.css` now contains all entity rendering styles (tree, rows, editors, drag indicators) — no per-type stylesheets
- **State classes**: `.expanded`, `.selected`, `.editing` on the outer element, driving descendant visibility via CSS combinators:
  ```css
  .entity-node-children { display: none; }
  .entity-node.expanded > .entity-node-children { display: block; }
  ```
- **Dynamic theming**: field-type-specific styling (e.g. `.field-status { ... }`, `.field-date { ... }`) lets the generic renderer match visual conventions per control type, not per entity type

## 6. Generic API Calls

**Single pattern** used by all entity operations:

```js
// All entity CRUD routes return { success: bool, data: entity, message?: string }
const response = await app.fetch(`/api/entities/${typeSlug}`, { 
  method: 'POST', 
  body: JSON.stringify({ title, ...fields }) 
});
if (response.success) { app.notify('Created', 'success'); }
```

**Centralized via app.fetch()** (`src/public/js/main.js`):
- Injects CSRF token header automatically
- Parses JSON response
- Throws on non-ok status
- Calls `app.notify()` on error with `result.message`

**Generic entity routes** (`/api/entities/:typeSlug`) handle all types identically — no per-type endpoints. The `typeSlug` URL parameter routes to the right type service.

## Phase 10 Completion Checklist

The generic entity engine is now the sole architecture for all entity types. Completed:

- ✅ **Generic renderer** (`src/public/js/genericEntity.js`) handles trees, rows, and editors for all types
- ✅ **Dynamic schema system**: field definitions come from `entity_type_fields` table, not hardcoded
- ✅ **Polymorphic API routes** (`/api/entities/:typeSlug/*`) replace 8+ type-specific endpoints
- ✅ **Unified change tracking** via `createChangeTracker()` factory
- ✅ **Field renderer strategy map** for extensible, type-agnostic control rendering
- ✅ **Type-aware CSS** with generic `.entity-*` class names
- ✅ **Centralized fetch pattern** via `app.fetch()` for all API calls

**Legacy type-specific code has been removed:**
- ❌ `src/public/js/editors/*` — replaced by generic editor
- ❌ Per-tab render functions (`renderTaskRow`, `renderAreaRow`, etc.) — replaced by `genericEntity.renderRow()`
- ❌ Per-tab tree renders (`renderTasksList`, `renderAreaTree`, etc.) — replaced by `genericEntity.renderTree()`
- ❌ Type-specific field mapping (`TaskEditor.fillForm()`, `AreaEditor.save()`, etc.) — replaced by schema-driven field mapping

**Custom types now work automatically:** Users can define new types in Settings with custom fields. The generic editor, renderer, and API routes automatically support them — no code changes needed.
