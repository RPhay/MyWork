/**
 * Generic Entity Tab Initialization
 * Handles initialization for all editable type tabs (Areas, Goals, Todos, Tasks, Tickets, Ideas)
 */

// Track which types have been initialized to avoid re-initialization
const initializedTypes = new Set();

// Wait for GenericEntity to be defined, then initialize
function waitForGenericEntity() {
  if (typeof GenericEntity !== 'undefined') {
    console.log('[GenericEntity-Init] GenericEntity is defined, initializing tabs');
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initAllGenericTabs);
    } else {
      setTimeout(initAllGenericTabs, 100);
    }
  } else {
    console.log('[GenericEntity-Init] GenericEntity not yet defined, waiting...');
    setTimeout(waitForGenericEntity, 100);
  }
}

// Start waiting
waitForGenericEntity();

async function initAllGenericTabs() {
  console.log('[GenericEntity-Init] initAllGenericTabs called');
  // Find all elements with data-entity-type attribute
  const tabElements = document.querySelectorAll('[data-entity-type]');
  console.log('[GenericEntity-Init] Found', tabElements.length, 'tab elements');
  for (const el of tabElements) {
    const typeSlug = el.dataset.entityType;
    const typeName = el.dataset.typeName;
    // Only initialize each type once
    if (typeSlug && typeName && !initializedTypes.has(typeSlug)) {
      console.log('[GenericEntity-Init] Initializing', typeSlug);
      initializedTypes.add(typeSlug);
      await initGenericEntityTab(typeSlug, typeName);
    }
  }
  console.log('[GenericEntity-Init] initAllGenericTabs complete');
}

async function initGenericEntityTab(typeSlug, typeName) {
  try {
    // Fetch type schema and additional schemas for mixed-type tabs (like area with folders)
    const typeResponse = await fetch(`/api/entity-types/${typeSlug}`, {
      headers: { 'X-CSRF-Token': document.body.dataset.csrfToken }
    });
    if (!typeResponse.ok) throw new Error('Failed to fetch type schema');
    const typeData = await typeResponse.json();
    if (!typeData.success) throw new Error(typeData.message);
    const typeSchema = typeData.data;

    // For area tab, also fetch folder schema
    let typeSchemas = { [typeSchema.id]: typeSchema };
    if (typeSlug === 'area') {
      const folderResponse = await fetch('/api/entity-types/folder', {
        headers: { 'X-CSRF-Token': document.body.dataset.csrfToken }
      });
      if (folderResponse.ok) {
        const folderData = await folderResponse.json();
        if (folderData.success) {
          typeSchemas[folderData.data.id] = folderData.data;
        }
      }
    }

    // Helper to get correct schema for an entity based on its type
    function getSchemaForEntity(entity) {
      return typeSchemas[entity.entity_type_id] || typeSchema;
    }

    // Fetch entities (special case: area also fetches folders)
    async function fetchAllEntities() {
      const response = await fetch(`/api/entities/${typeSlug}`, {
        headers: { 'X-CSRF-Token': document.body.dataset.csrfToken }
      });
      if (!response.ok) throw new Error('Failed to fetch entities');
      const data = await response.json();
      if (!data.success) throw new Error(data.message);
      let allEntities = data.data || [];

      // For area (categories), also fetch folders
      if (typeSlug === 'area') {
        const folderResponse = await fetch('/api/entities/folder', {
          headers: { 'X-CSRF-Token': document.body.dataset.csrfToken }
        });
        if (folderResponse.ok) {
          const folderData = await folderResponse.json();
          if (folderData.success) {
            allEntities = [...allEntities, ...(folderData.data || [])];
          }
        }
      }
      return allEntities;
    }
    let entities = await fetchAllEntities();

    // Hierarchy (parent/child) lives entirely in entity_relationships - the
    // entities table itself has no parent column - so hierarchy types need a
    // separate fetch to know how to nest the tree at all.
    let relationships = [];
    async function fetchRelationships() {
      if (!typeSchema.supports_hierarchy) return [];
      const r = await fetch(`/api/entities/${typeSlug}/relationships?kind=hierarchy`, {
        headers: { 'X-CSRF-Token': document.body.dataset.csrfToken }
      });
      const result = await r.json();
      let rels = result.success ? result.data : [];

      // For area, also fetch folder relationships
      if (typeSlug === 'area') {
        const folderRels = await fetch('/api/entities/folder/relationships?kind=hierarchy', {
          headers: { 'X-CSRF-Token': document.body.dataset.csrfToken }
        });
        const folderResult = await folderRels.json();
        if (folderResult.success) {
          rels = [...rels, ...(folderResult.data || [])];
        }
      }
      return rels;
    }
    relationships = await fetchRelationships();

    // Initialize split pane
    const splitPane = new SplitPane(
      `${typeSlug}SplitPane`,
      `${typeSlug}ListPane`,
      `${typeSlug}Divider`,
      `${typeSlug}EditorPane`
    );

    // Initialize GenericEntity
    GenericEntity.init(typeSlug, typeSchema, splitPane);
    GenericEntity.setEntities(entities);

    const listContainer = document.getElementById(`${typeSlug}EntityList`);

    // Render tree or list from the current `entities`/`relationships` arrays
    function renderList() {
      if (typeSchema.supports_hierarchy) {
        // For mixed-type tabs, use the schema from typeSchemas map
        listContainer.innerHTML = GenericEntity.renderTree(entities, typeSchema, relationships, getSchemaForEntity);
      } else {
        listContainer.innerHTML = entities.map(e => GenericEntity.renderRow(e, typeSchema, 0)).join('');
      }
    }

    // Re-fetch and re-render in place after a create/edit/delete/move, instead
    // of location.reload() - which was slow, jarring, and made a successful
    // save look like it had done nothing until the reload caught up.
    async function refreshEntities() {
      entities = await fetchAllEntities();
      relationships = await fetchRelationships();
      GenericEntity.setEntities(entities);
      renderList();
    }

    renderList();

    // Expand/collapse handlers
    document.getElementById(`expandAll${typeSlug}Btn`)?.addEventListener('click', () => {
      listContainer.querySelectorAll('.entity-node').forEach(n => {
        n.classList.add('expanded');
        localStorage.setItem(`entity-expanded-${n.dataset.entityId}`, 'true');
      });
    });

    document.getElementById(`collapseAll${typeSlug}Btn`)?.addEventListener('click', () => {
      listContainer.querySelectorAll('.entity-node').forEach(n => {
        n.classList.remove('expanded');
        localStorage.setItem(`entity-expanded-${n.dataset.entityId}`, 'false');
      });
    });

    // Row click to open/close editor
    listContainer.addEventListener('click', async (e) => {
      // Toggle expand
      if (e.target.closest('[data-action="toggle-expand"]')) {
        const node = e.target.closest('[data-action="toggle-expand"]').closest('.entity-node');
        node.classList.toggle('expanded');
        localStorage.setItem(`entity-expanded-${node.dataset.entityId}`,
          node.classList.contains('expanded') ? 'true' : 'false');
        return;
      }

      // Delete button (editing happens by clicking the row itself, below)
      const actionBtn = e.target.closest('[data-action="delete"]');
      if (actionBtn) {
        if (confirm('Delete this item?')) {
          const response = await fetch(`/api/entities/${typeSlug}/${actionBtn.dataset.entityId}`, {
            method: 'DELETE',
            headers: { 'X-CSRF-Token': document.body.dataset.csrfToken }
          });
          if (response.ok) {
            app.notify('Deleted', 'success');
            await refreshEntities();
          } else {
            app.notify('Error deleting item', 'danger');
          }
        }
        return;
      }

      // Click on row itself to open editor (toggle close on same row)
      const row = e.target.closest('.entity-row');
      if (row && !e.target.closest('[data-action]')) {
        const entityId = row.dataset.entityId;
        const entity = entities.find(x => x.id == entityId);
        GenericEntity.populate(entity.id, entity, typeSchema, typeSlug);
      }
    });

    // Drag and drop
    let draggedEntityId = null;
    listContainer.addEventListener('dragstart', (e) => {
      const row = e.target.closest('.entity-row');
      if (row) {
        draggedEntityId = row.dataset.entityId;
        e.dataTransfer.effectAllowed = 'move';
        row.style.opacity = '0.5';
      }
    });

    listContainer.addEventListener('dragend', (e) => {
      const row = e.target.closest('.entity-row');
      if (row) row.style.opacity = '1';
      draggedEntityId = null;
    });

    // Drop zone within a row: top/bottom band = reorder as a sibling
    // before/after that row; middle band (hierarchy types only) = nest as
    // its child. Mirrors the areas.js/priorities.js tree drag-drop pattern.
    function dropZoneFor(e, row) {
      return typeSchema.supports_hierarchy ? app.getTreeDropZone(e, row) : app.getVerticalDropZone(e, row);
    }

    function clearDropIndicator(row) {
      row.classList.remove('drop-indicator-before', 'drop-indicator-after', 'entity-drop-target-nest');
    }

    listContainer.addEventListener('dragover', (e) => {
      if (!draggedEntityId) return;
      e.preventDefault();
      const row = e.target.closest('.entity-row');
      if (row) {
        listContainer.querySelectorAll('.entity-row').forEach(clearDropIndicator);
        const zone = dropZoneFor(e, row);
        if (zone === 'nest') {
          row.classList.add('entity-drop-target-nest');
        } else {
          row.classList.add(zone === 'before' ? 'drop-indicator-before' : 'drop-indicator-after');
        }
        e.dataTransfer.dropEffect = 'move';
      }
    });

    listContainer.addEventListener('dragleave', (e) => {
      const row = e.target.closest('.entity-row');
      if (row) clearDropIndicator(row);
    });

    listContainer.addEventListener('drop', async (e) => {
      e.preventDefault();
      const targetRow = e.target.closest('.entity-row');
      if (!targetRow || !draggedEntityId) return;
      clearDropIndicator(targetRow);

      const targetId = parseInt(targetRow.dataset.entityId, 10);
      const sourceId = parseInt(draggedEntityId, 10);
      if (targetId === sourceId) return;

      const zone = dropZoneFor(e, targetRow);
      const csrfToken = document.body.dataset.csrfToken;

      // Hierarchy parent is only meaningful for hierarchy-supporting types;
      // it lives in entity_relationships, not on the entity itself.
      const hierarchyParentOf = (id) => {
        const rel = relationships.find(r => r.child_entity_id === id);
        return rel ? rel.parent_entity_id : null;
      };

      try {
        if (zone === 'nest') {
          const oldParentId = hierarchyParentOf(sourceId);
          if (oldParentId !== null && oldParentId !== targetId) {
            await fetch(`/api/entities/${typeSlug}/${sourceId}/relationships/${oldParentId}/${sourceId}?kind=hierarchy`, {
              method: 'DELETE',
              headers: { 'X-CSRF-Token': csrfToken }
            });
          }
          const response = await fetch(`/api/entities/${typeSlug}/${sourceId}/relationships`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
            body: JSON.stringify({ parentEntityId: targetId, childEntityId: sourceId, relationshipKind: 'hierarchy' })
          });
          if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || 'Move failed');
        } else if (typeSchema.supports_hierarchy) {
          // Reorder as a sibling of the target within its hierarchy parent
          // (moving the dragged item there first if it came from elsewhere,
          // or off a parent entirely if the target is top-level).
          const newParentId = hierarchyParentOf(targetId);
          const oldParentId = hierarchyParentOf(sourceId);

          if (oldParentId !== newParentId) {
            if (oldParentId !== null) {
              await fetch(`/api/entities/${typeSlug}/${sourceId}/relationships/${oldParentId}/${sourceId}?kind=hierarchy`, {
                method: 'DELETE',
                headers: { 'X-CSRF-Token': csrfToken }
              });
            }
            if (newParentId !== null) {
              const reparentResponse = await fetch(`/api/entities/${typeSlug}/${sourceId}/relationships`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                body: JSON.stringify({ parentEntityId: newParentId, childEntityId: sourceId, relationshipKind: 'hierarchy' })
              });
              if (!reparentResponse.ok) throw new Error('Move failed');
            }
          }

          if (newParentId !== null) {
            const siblingIds = relationships
              .filter(r => r.parent_entity_id === newParentId && r.child_entity_id !== sourceId)
              .map(r => r.child_entity_id);
            const targetIdx = siblingIds.indexOf(targetId);
            siblingIds.splice(zone === 'before' ? targetIdx : targetIdx + 1, 0, sourceId);

            const reorderResponse = await fetch(`/api/entities/${typeSlug}/${newParentId}/relationships/reorder`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
              body: JSON.stringify({ orderedChildIds: siblingIds, kind: 'hierarchy' })
            });
            if (!reorderResponse.ok) throw new Error('Reorder failed');
          } else {
            // Top-level siblings order via entities.order_index, same as flat types.
            const childIds = new Set(relationships.map(r => r.child_entity_id));
            const siblingIds = entities
              .filter(x => !childIds.has(x.id) && x.id !== sourceId)
              .sort((a, b) => a.order_index - b.order_index)
              .map(x => x.id);
            const targetIdx = siblingIds.indexOf(targetId);
            siblingIds.splice(zone === 'before' ? targetIdx : targetIdx + 1, 0, sourceId);

            const reorderResponse = await fetch(`/api/entities/${typeSlug}/reorder`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
              body: JSON.stringify({ orderedIds: siblingIds })
            });
            if (!reorderResponse.ok) throw new Error('Reorder failed');
          }
        } else {
          // Flat (non-hierarchy) type: always a plain order_index reorder.
          const siblingIds = entities
            .filter(x => x.id !== sourceId)
            .sort((a, b) => a.order_index - b.order_index)
            .map(x => x.id);
          const targetIdx = siblingIds.indexOf(targetId);
          siblingIds.splice(zone === 'before' ? targetIdx : targetIdx + 1, 0, sourceId);

          const reorderResponse = await fetch(`/api/entities/${typeSlug}/reorder`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
            body: JSON.stringify({ orderedIds: siblingIds })
          });
          if (!reorderResponse.ok) throw new Error('Reorder failed');
        }
        await refreshEntities();
      } catch (error) {
        console.error('Error moving entity:', error);
        app.notify(error.message || 'Error moving entity', 'danger');
      }
    });

    // Editor buttons
    document.getElementById(`${typeSlug}SaveBtn`)?.addEventListener('click', async () => {
      try {
        await GenericEntity.save();
        app.notify('Saved successfully', 'success');
        GenericEntity.close();
        await refreshEntities();
      } catch (error) {
        app.notify(error.message, 'danger');
      }
    });

    document.getElementById(`${typeSlug}CloseBtn`)?.addEventListener('click', () => {
      GenericEntity.close();
    });

    // Folder creation (only for categories)
    if (typeSlug === 'area') {
      document.getElementById(`add${typeSlug}FolderBtn`)?.addEventListener('click', async () => {
        const folderName = prompt('Folder name:');
        if (!folderName) return;

        try {
          const response = await fetch('/api/entities/folder', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': document.body.dataset.csrfToken
            },
            body: JSON.stringify({ title: folderName })
          });

          const result = await response.json();
          if (result.success) {
            app.notify('Folder created', 'success');
            await refreshEntities();
          } else {
            app.notify('Error: ' + result.message, 'danger');
          }
        } catch (error) {
          console.error('Error creating folder:', error);
          app.notify('Error creating folder', 'danger');
        }
      });
    }

    // Add new entity
    const addBtn = document.getElementById(`add${typeSlug}Btn`);
    if (addBtn) {
      console.log('[GenericEntity-Init] Registering add button for', typeSlug);
      addBtn.addEventListener('click', () => {
        console.log('[GenericEntity-Init] Add button clicked for', typeSlug);
        GenericEntity.populate(null, {}, typeSchema, typeSlug);
      });
    } else {
      console.error('[GenericEntity-Init] Add button not found:', `add${typeSlug}Btn`);
    }

  } catch (error) {
    console.error(`Error initializing ${typeSlug} tab:`, error);
    const container = document.getElementById(`${typeSlug}EntityList`);
    if (container) {
      container.innerHTML = `<div class="alert alert-danger">Error loading ${typeName}: ${error.message}</div>`;
    }
  }
}
