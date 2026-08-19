/**
 * Generic Entity Tab Initialization
 *
 * Drives every editable type tab (Categories, Goals, Todos, Tasks, Tickets,
 * Ideas, and any type a user defines later) through one identical code path.
 *
 * There must be no branching on `typeSlug` anywhere in this file. Everything a
 * type does differently comes from its own row in `entity_types` and its fields
 * in `entity_type_fields` - `supports_hierarchy` decides tree vs flat list and
 * whether folders are offered, `fields` decides what the editor renders.
 * Special-casing a slug here is what previously gave Categories a "+ Folder"
 * button that Todos did not have; see the Folders section of UI_STANDARDS.md.
 */

// Track which types have been initialized to avoid re-initialization
const initializedTypes = new Set();

// Wait for GenericEntity to be defined, then initialize
function waitForGenericEntity() {
  if (typeof GenericEntity !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initAllGenericTabs);
    } else {
      setTimeout(initAllGenericTabs, 100);
    }
  } else {
    setTimeout(waitForGenericEntity, 100);
  }
}

// Start waiting
waitForGenericEntity();

async function initAllGenericTabs() {
  // Find all elements with data-entity-type attribute
  const tabElements = document.querySelectorAll('[data-entity-type]');
  for (const el of tabElements) {
    const typeSlug = el.dataset.entityType;
    const typeName = el.dataset.typeName;
    // Only initialize each type once
    if (typeSlug && typeName && !initializedTypes.has(typeSlug)) {
      initializedTypes.add(typeSlug);
      await initGenericEntityTab(typeSlug, typeName);
    }
  }
}

async function initGenericEntityTab(typeSlug, typeName) {
  try {
    // One schema, one fetch, one code path - for every type. Folders are rows
    // of this same type carrying is_folder = 1, so there is no second type to
    // look up and nothing here keys off which type slug it happens to be.
    const typeResponse = await fetch(`/api/entity-types/${typeSlug}`, {
      headers: { 'X-CSRF-Token': document.body.dataset.csrfToken }
    });
    if (!typeResponse.ok) throw new Error('Failed to fetch type schema');
    const typeData = await typeResponse.json();
    if (!typeData.success) throw new Error(typeData.message);
    const typeSchema = typeData.data;

    async function fetchAllEntities() {
      const response = await fetch(`/api/entities/${typeSlug}`, {
        headers: { 'X-CSRF-Token': document.body.dataset.csrfToken }
      });
      if (!response.ok) throw new Error('Failed to fetch entities');
      const data = await response.json();
      if (!data.success) throw new Error(data.message);
      return data.data || [];
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
      return result.success ? result.data : [];
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
        listContainer.innerHTML = GenericEntity.renderTree(entities, typeSchema, relationships);
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
        const row = actionBtn.closest('.entity-row');
        const isFolder = row?.dataset.isFolder === '1';
        const confirmed = await app.confirm(
          isFolder
            ? 'Delete this folder? Everything inside it will be deleted too.'
            : 'Delete this item? Anything nested under it will be deleted too.',
          'Confirm Delete'
        );
        if (confirmed) {
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
        if (entity) GenericEntity.populate(entity.id, entity, typeSchema, typeSlug);
      }
    });

    // ===== Context menu =====
    //
    // Built from the type's own definition, never from its slug:
    //   - `supports_hierarchy` decides whether anything can go *inside* a row
    //     at all, which is what gates every "New ... inside" entry and folders.
    //   - the type's `hierarchy` relationship rules decide which types may be
    //     children, so a type that can't nest under itself won't offer it.
    // A type gains or loses menu entries by editing it in Settings.
    //
    // Cross-type children are deliberately not offered: this tab only has an
    // editor for its own type, so creating, say, a Goal inside a Project would
    // have nowhere to render. Those are association operations (drag from the
    // associate panel), not creations.
    const hierarchyChildTypeIds = (typeSchema.relationships || [])
      .filter(r => r.relationship_kind === 'hierarchy' && r.parent_type_id === typeSchema.id)
      .map(r => r.child_type_id);
    const canNestOwnType = typeSchema.supports_hierarchy && hierarchyChildTypeIds.includes(typeSchema.id);
    const singular = typeSchema.label_singular || typeName;

    let pendingParentId = null; // set when creating something "inside" a row
    let menuEl = null;

    function closeContextMenu() {
      menuEl?.remove();
      menuEl = null;
    }

    function openContextMenu(x, y, items) {
      closeContextMenu();
      if (items.length === 0) return;

      menuEl = document.createElement('div');
      // `entity-context-menu` distinguishes this from the hand-written Dailies
      // menu, which is always present in the DOM and also uses `context-menu`.
      menuEl.className = 'context-menu entity-context-menu';
      for (const item of items) {
        if (item.separator) {
          menuEl.insertAdjacentHTML('beforeend', '<hr style="margin:4px 0;">');
          continue;
        }
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'context-menu-item';
        btn.innerHTML = `<span>${item.icon || ''}</span><span>${item.label}</span>`;
        btn.addEventListener('click', async () => {
          closeContextMenu();
          await item.action();
        });
        menuEl.appendChild(btn);
      }
      document.body.appendChild(menuEl);

      // Keep it on screen when right-clicking near an edge.
      const rect = menuEl.getBoundingClientRect();
      menuEl.style.left = `${Math.min(x, window.innerWidth - rect.width - 8)}px`;
      menuEl.style.top = `${Math.min(y, window.innerHeight - rect.height - 8)}px`;
    }

    function startCreate({ parentId = null, isFolder = false } = {}) {
      pendingParentId = parentId;
      GenericEntity.close();
      GenericEntity.populate(null, isFolder ? { is_folder: true } : {}, typeSchema, typeSlug);
    }

    async function deleteEntity(entityId, isFolder) {
      const confirmed = await app.confirm(
        isFolder
          ? 'Delete this folder? Everything inside it will be deleted too.'
          : 'Delete this item? Anything nested under it will be deleted too.',
        'Confirm Delete'
      );
      if (!confirmed) return;
      const response = await fetch(`/api/entities/${typeSlug}/${entityId}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': document.body.dataset.csrfToken }
      });
      if (response.ok) {
        if (String(GenericEntity.getCurrentEntityId()) === String(entityId)) GenericEntity.close();
        app.notify('Deleted', 'success');
        await refreshEntities();
      } else {
        app.notify('Error deleting item', 'danger');
      }
    }

    listContainer.addEventListener('contextmenu', (e) => {
      const row = e.target.closest('.entity-row');
      e.preventDefault();

      if (!row) {
        // Empty space: create at the top level.
        const items = [{ icon: '➕', label: `New ${singular}`, action: () => startCreate() }];
        if (typeSchema.supports_hierarchy) {
          items.push({ icon: '📁', label: 'New Folder', action: () => startCreate({ isFolder: true }) });
        }
        openContextMenu(e.clientX, e.clientY, items);
        return;
      }

      const entityId = Number(row.dataset.entityId);
      const isFolder = row.dataset.isFolder === '1';
      const entity = entities.find(x => x.id === entityId);
      const items = [];

      if (canNestOwnType) {
        items.push({ icon: '➕', label: `New ${singular} inside`, action: () => startCreate({ parentId: entityId }) });
      }
      if (typeSchema.supports_hierarchy) {
        items.push({ icon: '📁', label: 'New Folder inside', action: () => startCreate({ parentId: entityId, isFolder: true }) });
      }
      if (items.length > 0) items.push({ separator: true });

      items.push({ icon: '✏️', label: isFolder ? 'Rename Folder' : `Edit ${singular}`, action: () => {
        if (entity) {
          GenericEntity.close();
          GenericEntity.populate(entity.id, entity, typeSchema, typeSlug);
          renderList();
        }
      } });
      items.push({ icon: '🗑️', label: isFolder ? 'Delete Folder' : `Delete ${singular}`, action: () => deleteEntity(entityId, isFolder) });

      openContextMenu(e.clientX, e.clientY, items);
    });

    // Dismiss on an outside press. Right-button presses are ignored because
    // the very gesture that opens the menu would otherwise close it again in
    // the same tick, and presses inside the menu are left to the item handlers.
    document.addEventListener('mousedown', (e) => {
      if (!menuEl || e.button === 2) return;
      if (menuEl.contains(e.target)) return;
      closeContextMenu();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeContextMenu(); });
    window.addEventListener('scroll', closeContextMenu, true);

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
        // Null before the save means this was a create, not an edit.
        const wasCreate = GenericEntity.getCurrentEntityId() === null;
        const saved = await GenericEntity.save();
        app.notify('Saved successfully', 'success');

        // "New ... inside" from the context menu records the row it was
        // launched from; the nesting edge can only be written once the child
        // exists, so it happens here rather than at menu-click time.
        if (wasCreate && saved?.id && pendingParentId) {
          const response = await fetch(`/api/entities/${typeSlug}/${saved.id}/relationships`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': document.body.dataset.csrfToken },
            body: JSON.stringify({ parentEntityId: pendingParentId, childEntityId: saved.id, relationshipKind: 'hierarchy' })
          });
          if (!response.ok) {
            const message = (await response.json().catch(() => ({}))).message;
            app.notify(message || 'Created, but could not nest it', 'warning');
          } else {
            localStorage.setItem(`entity-expanded-${pendingParentId}`, 'true');
          }
        }
        pendingParentId = null;

        if (wasCreate && saved?.id) {
          // Creating a new item or folder leaves the editor open on it, so you
          // can keep filling it in rather than having to find and reopen what
          // you just made. Reset first: populate() treats being handed the id
          // it already holds as a request to toggle the editor shut.
          GenericEntity.close();
          await refreshEntities();
          GenericEntity.populate(saved.id, saved, typeSchema, typeSlug);
          renderList(); // re-render so the new row paints as selected
        } else {
          GenericEntity.close();
          await refreshEntities();
        }
      } catch (error) {
        app.notify(error.message, 'danger');
      }
    });

    document.getElementById(`${typeSlug}CloseBtn`)?.addEventListener('click', () => {
      GenericEntity.close();
    });

    // Folder creation, available on every type that can nest - gated on the
    // type's own supports_hierarchy flag, never on which type it is. A folder
    // is just an is_folder row of this type, so it goes through the same
    // editor and the same save path as any other new item.
    const folderBtn = document.getElementById(`add${typeSlug}FolderBtn`);
    if (folderBtn) {
      if (typeSchema.supports_hierarchy) {
        folderBtn.addEventListener('click', () => {
          GenericEntity.populate(null, { is_folder: true }, typeSchema, typeSlug);
        });
      } else {
        folderBtn.remove();
      }
    }

    // Add new entity
    document.getElementById(`add${typeSlug}Btn`)?.addEventListener('click', () => {
      GenericEntity.populate(null, {}, typeSchema, typeSlug);
    });

  } catch (error) {
    console.error(`Error initializing ${typeSlug} tab:`, error);
    const container = document.getElementById(`${typeSlug}EntityList`);
    if (container) {
      container.innerHTML = `<div class="alert alert-danger">Error loading ${typeName}: ${error.message}</div>`;
    }
  }
}
