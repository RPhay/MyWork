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
    // Fetch type schema
    const typeResponse = await fetch(`/api/entity-types/${typeSlug}`, {
      headers: { 'X-CSRF-Token': document.body.dataset.csrfToken }
    });
    if (!typeResponse.ok) throw new Error('Failed to fetch type schema');
    const typeData = await typeResponse.json();
    if (!typeData.success) throw new Error(typeData.message);
    const typeSchema = typeData.data;

    // Fetch entities
    const entitiesResponse = await fetch(`/api/entities/${typeSlug}`, {
      headers: { 'X-CSRF-Token': document.body.dataset.csrfToken }
    });
    if (!entitiesResponse.ok) throw new Error('Failed to fetch entities');
    const entitiesData = await entitiesResponse.json();
    if (!entitiesData.success) throw new Error(entitiesData.message);
    const entities = entitiesData.data || [];

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

    // Render tree or list
    const listContainer = document.getElementById(`${typeSlug}EntityList`);
    if (typeSchema.supports_hierarchy) {
      listContainer.innerHTML = GenericEntity.renderTree(entities, typeSchema);
    } else {
      listContainer.innerHTML = entities.map(e => GenericEntity.renderRow(e, typeSchema, 0)).join('');
    }

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

      // Edit/delete buttons
      const actionBtn = e.target.closest('[data-action="edit"], [data-action="delete"]');
      if (actionBtn) {
        if (actionBtn.dataset.action === 'edit') {
          const entity = entities.find(x => x.id == actionBtn.dataset.entityId);
          GenericEntity.populate(entity.id, entity, typeSchema, typeSlug);
        } else if (actionBtn.dataset.action === 'delete') {
          if (confirm('Delete this item?')) {
            const response = await fetch(`/api/entities/${typeSlug}/${actionBtn.dataset.entityId}`, {
              method: 'DELETE',
              headers: { 'X-CSRF-Token': document.body.dataset.csrfToken }
            });
            if (response.ok) location.reload();
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

    listContainer.addEventListener('dragover', (e) => {
      if (!draggedEntityId) return;
      e.preventDefault();
      const row = e.target.closest('.entity-row');
      if (row) {
        row.style.borderTop = '2px solid #0d6efd';
        e.dataTransfer.dropEffect = 'move';
      }
    });

    listContainer.addEventListener('dragleave', (e) => {
      const row = e.target.closest('.entity-row');
      if (row) row.style.borderTop = '';
    });

    listContainer.addEventListener('drop', async (e) => {
      e.preventDefault();
      const targetRow = e.target.closest('.entity-row');
      if (!targetRow || !draggedEntityId) return;

      targetRow.style.borderTop = '';
      const targetId = targetRow.dataset.entityId;

      try {
        const response = await fetch(`/api/entities/${typeSlug}/${draggedEntityId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': document.body.dataset.csrfToken
          },
          body: JSON.stringify({ parent_entity_id: parseInt(targetId) })
        });
        if (response.ok) location.reload();
      } catch (error) {
        console.error('Error moving entity:', error);
        app.notify('Error moving entity', 'danger');
      }
    });

    // Editor buttons
    document.getElementById(`${typeSlug}SaveBtn`)?.addEventListener('click', async () => {
      try {
        const saved = await GenericEntity.save();
        app.notify('Saved successfully', 'success');
        GenericEntity.close();
        location.reload();
      } catch (error) {
        app.notify(error.message, 'danger');
      }
    });

    document.getElementById(`${typeSlug}CloseBtn`)?.addEventListener('click', () => {
      GenericEntity.close();
    });

    // Folder creation
    document.getElementById(`add${typeSlug}FolderBtn`)?.addEventListener('click', async () => {
      const folderName = prompt('Folder name:');
      if (!folderName) return;

      try {
        const response = await fetch(`/api/entities/${typeSlug}`, {
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
          location.reload();
        } else {
          app.notify('Error: ' + result.message, 'danger');
        }
      } catch (error) {
        console.error('Error creating folder:', error);
        app.notify('Error creating folder', 'danger');
      }
    });

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
