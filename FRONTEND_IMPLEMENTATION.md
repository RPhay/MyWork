# Generic Entity Frontend - Implementation Guide

## ✅ Completed (Available Now)

### Core Components
- **genericEntity.js**: Full renderer for rows, trees, editors, forms
- **changeTracker.js**: Reusable change tracking factory
- **generic-entity.css**: Styling for all entity UI

### Field Renderers (Ready)
- text, textarea, number, date, select, status, checkbox, recurrence

### Features Implemented
- Dynamic form generation from type schema
- Tree rendering with CSS-only expand/collapse
- Batch field value collection from forms
- Change tracking across all editors
- Responsive design

## ⏳ Remaining (Template Provided Below)

### 1. Dashboard Tab Loop (src/views/pages/dashboard.ejs)

Replace hardcoded 11 tabs with:
```ejs
<% types.forEach(type => { %>
  <li class="nav-item" data-tab="<%= type.slug %>">
    <a class="nav-link" href="#tab-<%= type.slug %>">
      <span class="<%= type.icon %>"></span>
      <%= type.label %>
    </a>
  </li>
<% }); %>

<% types.forEach(type => { %>
  <div id="tab-<%= type.slug %>" class="tab-pane fade" role="tabpanel">
    <div class="<%= type.slug %>-split-pane" id="<%= type.slug %>-container"></div>
  </div>
<% }); %>
```

Pass `types` to view from dashboard route:
```js
const types = await entityTypeService.getAllEntityTypes();
res.render('pages/dashboard', { types, ... });
```

Initialize generic renderer for each type:
```js
document.querySelectorAll('[data-entity-type]').forEach(container => {
  const typeSlug = container.dataset.entityType;
  // Fetch type schema via /api/entity-types/:typeSlug
  // Initialize GenericEntity for that type
  // Fetch entities and render
});
```

### 2. Settings UI - Custom Type Creation (src/views/tabs/settings-types.ejs)

```ejs
<div class="settings-section">
  <h3>Manage Entity Types</h3>
  
  <form id="create-type-form">
    <div class="form-group">
      <label>Type Name *</label>
      <input type="text" name="label" required>
    </div>
    
    <div class="form-group">
      <label>Slug (auto-kebab-case)</label>
      <input type="text" name="slug" readonly>
    </div>
    
    <div class="form-group">
      <label>Icon</label>
      <input type="text" name="icon" placeholder="emoji or icon class">
    </div>
    
    <div class="form-group">
      <label>
        <input type="checkbox" name="supports_hierarchy">
        Supports Hierarchy (parent/child nesting)
      </label>
    </div>
    
    <h4>Fields</h4>
    <div id="fields-container">
      <!-- Dynamically added -->
    </div>
    <button type="button" onclick="addFieldRow()">+ Add Field</button>
    
    <button type="submit" class="btn btn-primary">Create Type</button>
  </form>
  
  <div id="existing-types">
    <!-- List editable existing types -->
  </div>
</div>
```

Wire up in settings.js:
```js
document.getElementById('create-type-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const typeData = collectFormData(e.target);
  const response = await app.fetch('/api/entity-types', { method: 'POST', body: JSON.stringify(typeData) });
  if (response.success) {
    app.notify('Type created! Refresh to see new tab.', 'success');
    location.reload(); // Auto-add tab
  }
});
```

### 3. Recurrence Integration (src/services/entityService.js + daily flow)

Wire into work item completion:
```js
async function updateEntity(entityId, data, contextId) {
  // ... existing update code ...
  
  // Check if completion field changed to "complete"
  if (data.status === 'complete') {
    const entity = await getEntityById(entityId, contextId);
    if (entity.recurring_from_todo_id || entity.recurring_from_task_id) {
      const sourceId = entity.recurring_from_todo_id || entity.recurring_from_task_id;
      const sourceEntity = await getEntityById(sourceId, contextId);
      const recurrence = sourceEntity.fields?.recurrence;
      
      if (recurrence && recurrence.enabled) {
        // Generate next occurrence
        await generateNextRecurrence(sourceEntity, contextId);
      }
    }
  }
}
```

### 4. Calendar View (src/public/js/calendarView.js)

```js
const CalendarView = {
  init: (typeSlug, typeSchema, containerElement) => {
    // Read dateField from typeSchema.primary_date_field
    // Build month grid
    // Render entities as colored dots or tags
    // Support click-to-expand entity
  },
  
  render: (entities) => {
    // Group entities by date
    // Paint calendar grid
    // Add click handlers
  }
};
```

Attach to tab when type has `primary_date_field`:
```js
if (typeSchema.primary_date_field) {
  CalendarView.init(typeSlug, typeSchema, container);
}
```

## Integration Checklist

- [ ] Route passes entity types to dashboard.ejs
- [ ] Dashboard.ejs loops over types instead of hardcoding
- [ ] Dashboard.js initializes GenericEntity for each type
- [ ] Settings form wired to POST /api/entity-types
- [ ] Settings form shows existing types
- [ ] Recurrence check wired into work-item completion
- [ ] Calendar view created and integrated
- [ ] Type schema caching to avoid repeated API calls
- [ ] Test end-to-end: create type → see tab → add entity → tree render

## Database Queries Needed

Already exist in entityService.js and entityRelationshipService.js:
- getEntityType(slug) - for type schema
- getAllEntities(typeSlug, contextId) - for list
- createEntity(typeSlug, data) - for CRUD
- getEntityRelationships(entityId, contextId) - for relationships

## Performance Notes

- Cache type schemas in session/localStorage after first fetch
- Paginate large entity lists (implement limit/offset in /api/entities)
- Index on (entity_type_id, context_id, order_index) for list queries
- Consider virtual scrolling for trees with 1000+ nodes

## Next Steps After MVP

1. Export/import custom types (JSON)
2. Type templates (clone built-in types)
3. Field validation rules in schema
4. Bulk operations (batch update, delete)
5. Search across all types
6. Type-specific webhooks/integrations
