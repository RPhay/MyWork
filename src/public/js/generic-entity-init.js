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

// Dailies names the things it can hold in the singular, and those names are not
// always the type slug. Anything absent falls through to the slug itself, so a
// user-defined type works without being listed here.
const DAILIES_DROP_TYPE = {
  to_do: 'todo',
};

// The same map read backwards: a dropped payload names its type the way Dailies
// does, and we need the type slug to check the rules and call the API.
const SLUG_FROM_DROP_TYPE = Object.fromEntries(
  Object.entries(DAILIES_DROP_TYPE).map(([slug, dropType]) => [dropType, slug])
);

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
    const typeResponse = await app.fetchRaw(`/api/entity-types/${typeSlug}`, {});
    if (!typeResponse.ok) throw new Error('Failed to fetch type schema');
    const typeData = await typeResponse.json();
    if (!typeData.success) throw new Error(typeData.message);
    const typeSchema = typeData.data;

    // Which types may be nested INSIDE this one, by slug. This is what lets a
    // row dragged from another tab land inside a template: templates declare
    // every editable type as an allowed child, ordinary types declare only
    // themselves. Nothing here is template-specific - it is read from the type
    // rules, so a user who allows Projects inside Categories gets that too.
    let allowedChildSlugs = new Set();
    try {
      const allTypesRes = await app.fetchRaw('/api/entity-types', {});
      const allTypes = (await allTypesRes.json()).data || [];
      const slugById = new Map(allTypes.map(t => [t.id, t.slug]));
      allowedChildSlugs = new Set(
        (typeSchema.relationships || [])
          .filter(r => r.relationship_kind === 'hierarchy' && r.parent_type_id === typeSchema.id)
          .map(r => slugById.get(r.child_type_id))
          .filter(Boolean)
      );
    } catch {
      allowedChildSlugs = new Set([typeSlug]);
    }

    // The type slug carried by a drag from another tab, or null if this drag
    // did not come from one (or is not allowed to land here).
    const incomingChildSlug = (e) => {
      const raw = e.dataTransfer?.getData('type');
      if (!raw) return null;
      const slug = SLUG_FROM_DROP_TYPE[raw] || raw;
      return allowedChildSlugs.has(slug) ? slug : null;
    };

    // A type that may contain other types needs their rows too, or the tree
    // shows a parent whose children are invisible. `contents` returns this
    // type's rows plus anything nested inside them, at any depth.
    const containsOtherTypes = [...allowedChildSlugs].some(slug => slug !== typeSlug);

    async function fetchAllEntities() {
      const endpoint = containsOtherTypes
        ? `/api/entities/${typeSlug}/contents`
        : `/api/entities/${typeSlug}`;
      const response = await app.fetchRaw(endpoint, {});
      if (!response.ok) throw new Error('Failed to fetch entities');
      const data = await response.json();
      if (!data.success) throw new Error(data.message);
      return data.data || [];
    }

    // Schema per entity, so a row nested inside a template renders with ITS own
    // icon and columns rather than the containing type's. Ordinary pages only
    // ever hold one type, so this resolves to the page's own schema for them.
    const schemaByTypeId = new Map([[typeSchema.id, typeSchema]]);
    if (containsOtherTypes) {
      try {
        const res = await app.fetchRaw('/api/entity-types', {});
        for (const t of ((await res.json()).data || [])) schemaByTypeId.set(t.id, t);
      } catch { /* fall back to the page's own schema */ }
    }
    const schemaForEntity = (entity) => schemaByTypeId.get(entity?.entity_type_id) || typeSchema;
    let entities = await fetchAllEntities();

    // Hierarchy (parent/child) lives entirely in entity_relationships - the
    // entities table itself has no parent column - so hierarchy types need a
    // separate fetch to know how to nest the tree at all.
    let relationships = [];
    async function fetchRelationships() {
      if (!typeSchema.supports_hierarchy) return [];
      const r = await app.fetchRaw(`/api/entities/${typeSlug}/relationships?kind=hierarchy`, {});
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
    // Cross-type drops target the whole pane, not just the inner list. The list
    // ends where its rows end, so a drop aimed at a row but landing a few pixels
    // off - in the pane's padding, or on the divider beside it - hit nothing at
    // all and the drag silently died.
    const dropPane = document.getElementById(`${typeSlug}ListPane`) || listContainer;

    // Columns available on this page. Ordinarily just this type's fields; on a
    // page that holds other types too (a template holding ideas, tickets and so
    // on) it is the union across every type actually present, so a dragged-in
    // row's fields can be shown as columns rather than being invisible.
    // Deduped by field_key: two types sharing `status` share one column.
    function mergedColumnSchema() {
      if (!containsOtherTypes) return typeSchema;

      const byKey = new Map((typeSchema.fields || []).map(f => [f.field_key, f]));
      const presentTypeIds = new Set(entities.map(e => e.entity_type_id));
      for (const typeId of presentTypeIds) {
        if (typeId === typeSchema.id) continue;
        for (const field of (schemaByTypeId.get(typeId)?.fields || [])) {
          if (!byKey.has(field.field_key)) byKey.set(field.field_key, field);
        }
      }
      return { ...typeSchema, fields: [...byKey.values()] };
    }

    // Render tree or list from the current `entities`/`relationships` arrays
    function renderList() {
      if (typeSchema.supports_hierarchy) {
        listContainer.innerHTML = GenericEntity.renderTree(entities, mergedColumnSchema(), relationships, schemaForEntity);
      } else {
        listContainer.innerHTML = GenericEntity.renderFlatList(entities, typeSchema);
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

    // Everything above is closure-scoped per tab, so code outside this file has
    // no way to say "that type's rows changed, reload it". The bespoke tabs used
    // to expose a global for that (loadTemplates, and friends); when those tabs
    // became generic ones the globals went away and their callers were left
    // behind `typeof` guards that could never be true again - silently doing
    // nothing. This registry is the replacement, so such a call either works or
    // fails loudly.
    (window.GenericEntityTabs ||= {
      refresh(slug) {
        const fn = this._bySlug[slug];
        if (fn) return fn();
        console.warn(`GenericEntityTabs.refresh: no tab for "${slug}"`);
      },
      _bySlug: {},
    })._bySlug[typeSlug] = refreshEntities;

    renderList();

    // Another view saved a record. Redraw if this page shows it - either it is
    // one of ours, or it is nested here as a reference. Without this, editing an
    // idea on the Ideas page left the same idea reading its old title inside
    // every template referencing it until a reload.
    document.addEventListener('entity-saved', async (e) => {
      const savedId = e.detail?.id;
      if (!savedId) return;
      const showsIt = entities.some(x => String(x.id) === String(savedId));
      if (!showsIt) return;
      // Skip the page that did the saving - it refreshes itself already.
      if (String(GenericEntity.getCurrentEntityId()) === String(savedId)
          && document.activeElement?.closest(`#${typeSlug}EditorPane`)) return;
      await refreshEntities();
    });

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

    // ----- Multi-select -----
    //
    // The pattern people already know from file managers:
    //   plain click        - select this one, open it in the editor
    //   Cmd/Ctrl + click   - add or remove this one from the selection
    //   Shift + click      - select everything between the anchor and this one
    //
    // Selection is view state, not data, so it lives here and is cleared by a
    // plain click. It is kept distinct from `.selected` (which means "open in
    // the editor") because the two answer different questions.
    const selectedIds = new Set();
    let selectionAnchor = null;

    // Rows in the order they appear, which is what a shift-range means.
    const visibleRowIds = () =>
      [...listContainer.querySelectorAll('.entity-row')].map(r => r.dataset.entityId);

    function paintSelection() {
      listContainer.querySelectorAll('.entity-row').forEach(r => {
        r.classList.toggle('multi-selected', selectedIds.has(r.dataset.entityId));
      });
      const bar = document.getElementById(`${typeSlug}SelectionBar`);
      if (bar) {
        bar.hidden = selectedIds.size < 2;
        const count = bar.querySelector('.selection-count');
        if (count) count.textContent = `${selectedIds.size} selected`;
      }
    }

    function clearSelection() {
      selectedIds.clear();
      selectionAnchor = null;
      paintSelection();
    }

    // Re-applied after every render, since renderList() rebuilds the rows.
    const originalRenderList = renderList;
    renderList = function () {
      originalRenderList();
      paintSelection();
    };

    function handleSelectionClick(e, row) {
      const id = row.dataset.entityId;

      if (e.shiftKey && selectionAnchor) {
        const ids = visibleRowIds();
        const from = ids.indexOf(selectionAnchor);
        const to = ids.indexOf(id);
        if (from !== -1 && to !== -1) {
          selectedIds.clear();
          for (const rid of ids.slice(Math.min(from, to), Math.max(from, to) + 1)) selectedIds.add(rid);
        }
        paintSelection();
        return true;   // handled: no editor change
      }

      if (e.metaKey || e.ctrlKey) {
        if (selectedIds.has(id)) selectedIds.delete(id);
        else selectedIds.add(id);
        selectionAnchor = id;
        paintSelection();
        return true;
      }

      // A plain click starts a fresh selection of one and falls through to the
      // editor, which is what it has always done.
      selectedIds.clear();
      selectedIds.add(id);
      selectionAnchor = id;
      paintSelection();
      return false;
    }

    // Deleting with a selection deletes the selection.
    async function deleteSelected() {
      const ids = [...selectedIds];
      if (ids.length < 2) return false;
      const ok = await app.confirm(
        `Delete ${ids.length} items? Anything nested under them will be deleted too.`,
        'Confirm Delete'
      );
      if (!ok) return true;

      for (const id of ids) {
        const res = await app.fetchRaw(`/api/entities/${typeSlug}/${id}`, {
          method: 'DELETE' });
        if (!res.ok) {
          const reason = await res.json().catch(() => null);
          app.notify(`Could not delete them all: ${reason?.message || res.status}`, 'danger');
          break;
        }
      }
      clearSelection();
      await refreshEntities();
      app.notify(`Deleted ${ids.length} items`, 'success');
      return true;
    }

    document.getElementById(`${typeSlug}SelectionBar`)?.addEventListener('click', async (e) => {
      if (e.target.closest('[data-action="delete-selected"]')) { await deleteSelected(); return; }
      if (e.target.closest('[data-action="clear-selection"]')) clearSelection();
    });

    // Escape clears a selection; Delete removes it. Only while this tab is the
    // active one, and never while typing into a field.
    document.addEventListener('keydown', async (e) => {
      if (!listContainer.closest('.tab-content-pane.active')) return;
      if (e.target.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'Escape' && selectedIds.size) { clearSelection(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 1) {
        e.preventDefault();
        await deleteSelected();
      }
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

      // ----- Header: sort, column chooser -----
      const sortBtn = e.target.closest('[data-action="sort-column"]');
      if (sortBtn) {
        const key = sortBtn.dataset.sortKey;
        const state = GenericEntity.readViewState(typeSlug);
        // Same column cycles asc -> desc -> unsorted, so there is a way back to
        // the manual drag order without clearing anything by hand.
        if (state.sortKey !== key) {
          state.sortKey = key; state.sortDir = 'asc';
        } else if (state.sortDir === 'asc') {
          state.sortDir = 'desc';
        } else {
          delete state.sortKey; delete state.sortDir;
        }
        GenericEntity.writeViewState(typeSlug, state);
        renderList();
        return;
      }

      const filtersToggle = e.target.closest('[data-action="toggle-filters"]');
      if (filtersToggle) {
        const state = GenericEntity.readViewState(typeSlug);
        state.showFilters = !state.showFilters;
        GenericEntity.writeViewState(typeSlug, state);
        renderList();
        return;
      }

      const filterBtn = e.target.closest('[data-action="open-filter-menu"]');
      if (filterBtn) {
        const menu = filterBtn.parentElement.querySelector('.entity-filter-menu');
        const wasOpen = menu && !menu.hidden;
        listContainer.querySelectorAll('.entity-filter-menu').forEach(m => { m.hidden = true; });
        if (menu && !wasOpen) positionMenu(filterBtn, menu);
        return;
      }

      const columnsBtn = e.target.closest('[data-action="toggle-columns"]');
      if (columnsBtn) {
        // closest(), not parentElement: the button now sits inside a .btn-group,
        // so its parent is the group and the menu is a sibling of that.
        const menu = columnsBtn.closest('.entity-header-actions')?.querySelector('.entity-columns-menu');
        const wasOpen = menu && !menu.hidden;
        if (menu) {
          menu.hidden = true;
          if (!wasOpen) positionMenu(columnsBtn, menu);
        }
        return;
      }

      // Clicking anywhere else closes an open chooser or filter menu.
      if (!e.target.closest('.entity-columns-menu')) {
        listContainer.querySelectorAll('.entity-columns-menu').forEach(m => { m.hidden = true; });
      }
      if (!e.target.closest('.entity-filter-menu')) {
        listContainer.querySelectorAll('.entity-filter-menu').forEach(m => { m.hidden = true; });
      }

      // Checkbox cell: tick or untick in place.
      const checkboxCell = e.target.closest('[data-action="toggle-checkbox"]');
      if (checkboxCell) {
        await saveFieldFromCell(
          checkboxCell.dataset.entityId,
          checkboxCell.dataset.fieldKey,
          checkboxCell.dataset.value !== '1',
          'Could not change that'
        );
        return;
      }

      // `emojis` cell: advance to the next emoji in the type's own set.
      const cycleEmoji = e.target.closest('[data-action="cycle-emoji"]');
      if (cycleEmoji) {
        const field = (typeSchema.fields || []).find(f => f.field_key === cycleEmoji.dataset.fieldKey);
        const set = field?.field_options?.values || [];
        if (!set.length) return;
        const next = set[(set.indexOf(cycleEmoji.dataset.value) + 1) % set.length];
        const response = await app.fetchRaw(`/api/entities/${typeSlug}/${cycleEmoji.dataset.entityId}`, {
          method: 'PUT',
          
          body: JSON.stringify({ fields: { [field.field_key]: next } })
        });
        if (response.ok) {
          await refreshEntities();
          GenericEntity.syncEditorFromRow(cycleEmoji.dataset.entityId, field.field_key, next);
          showRowInOpenEditor(cycleEmoji.dataset.entityId);
        } else {
          app.notify('Could not change that', 'danger');
        }
        return;
      }

      // Emoji cell: pick and save, without disturbing the editor.
      const emojiBtn = e.target.closest('[data-action="pick-emoji-cell"]');
      if (emojiBtn) {
        const picked = await app.pickEmoji(emojiBtn);
        if (picked === null) return;
        const response = await app.fetchRaw(`/api/entities/${typeSlug}/${emojiBtn.dataset.entityId}`, {
          method: 'PUT',
          
          body: JSON.stringify({ fields: { [emojiBtn.dataset.fieldKey]: picked || null } })
        });
        if (response.ok) {
          await refreshEntities();
          GenericEntity.syncEditorFromRow(emojiBtn.dataset.entityId, emojiBtn.dataset.fieldKey, picked);
          showRowInOpenEditor(emojiBtn.dataset.entityId);
        } else {
          app.notify('Could not set the emoji', 'danger');
        }
        return;
      }

      // Date cell: open a real calendar picker in place, and bring the row up
      // in the editor as well - the same pairing the status badge uses.
      const dateBtn = e.target.closest('[data-action="pick-date"]');
      if (dateBtn) {
        const cell = dateBtn.closest('.entity-cell');
        const current = dateBtn.dataset.value || '';
        cell.innerHTML = `<input type="date" class="row-date-input" value="${current}"
          data-entity-id="${dateBtn.dataset.entityId}" data-field-key="${dateBtn.dataset.fieldKey}">`;
        const input = cell.querySelector('.row-date-input');
        input.focus();
        // showPicker() opens the native calendar without a second click; it is
        // Chromium-only, so a failure just leaves a focused date input.
        try { input.showPicker(); } catch { /* not supported here */ }

        // Do NOT open the editor here. Opening it re-flows the tab and the
        // cell moves out from under the pointer mid-click. If the editor is
        // already open, point it at this row; if it is closed, leave it closed.
        showRowInOpenEditor(dateBtn.dataset.entityId);
        return;
      }

      // Status icon: cycle to the next value in the type's own list. Placed
      // before the row-click handler below, which opens the editor - the row
      // handler already ignores anything inside a [data-action] element.
      // Priority cycles through its ladder on click, like the status badge.
      // Only this field is sent, so nothing else on the row is disturbed.
      const priorityBtn = e.target.closest('[data-action="cycle-priority"]');
      if (priorityBtn) {
        const LEVELS = ['', 'Low', 'Medium', 'High', 'Critical'];
        const current = priorityBtn.dataset.priority || '';
        const next = LEVELS[(LEVELS.indexOf(current) + 1) % LEVELS.length];
        const fieldKey = priorityBtn.dataset.fieldKey;
        const changedId = priorityBtn.dataset.entityId;

        const response = await app.fetchRaw(`/api/entities/${typeSlug}/${changedId}`, {
          method: 'PUT',
          
          body: JSON.stringify({ fields: { [fieldKey]: next || null } })
        });
        if (response.ok) {
          await refreshEntities();
          if (String(GenericEntity.getCurrentEntityId()) === String(changedId)) {
            GenericEntity.syncEditorFromRow(changedId, fieldKey, next);
          }
        } else {
          app.notify('Could not change priority', 'danger');
        }
        return;
      }

      const statusBtn = e.target.closest('[data-action="cycle-status"]');
      if (statusBtn) {
        const field = (typeSchema.fields || []).find(
          f => f.field_key === statusBtn.dataset.fieldKey
        );
        const values = field?.field_options?.values || [];
        if (values.length === 0) return;

        const idx = values.indexOf(statusBtn.dataset.status);
        const next = values[(idx + 1) % values.length];

        const response = await app.fetchRaw(
          `/api/entities/${typeSlug}/${statusBtn.dataset.entityId}`,
          {
            method: 'PUT',
            
            // Only this field is sent: updateEntity iterates the keys it is
            // given, so the entity's other field values are untouched.
            body: JSON.stringify({ fields: { [field.field_key]: next } })
          }
        );
        if (response.ok) {
          await refreshEntities();
          const changedId = statusBtn.dataset.entityId;
          if (String(GenericEntity.getCurrentEntityId()) === String(changedId)) {
            GenericEntity.syncEditorFromRow(changedId, field.field_key, next);
          } else {
            showRowInOpenEditor(changedId);
          }
        } else {
          app.notify('Could not change status', 'danger');
        }
        return;
      }

      // Delete button (editing happens by clicking the row itself, below)
      const actionBtn = e.target.closest('[data-action="delete"]');
      if (actionBtn) {
        const row = actionBtn.closest('.entity-row');
        // With several rows selected, the bin deletes all of them.
        if (selectedIds.size > 1 && selectedIds.has(row?.dataset.entityId)) {
          await deleteSelected();
          return;
        }
        const isFolder = row?.dataset.isFolder === '1';
        const confirmed = await app.confirm(
          isFolder
            ? 'Delete this folder? Everything inside it will be deleted too.'
            : 'Delete this item? Anything nested under it will be deleted too.',
          'Confirm Delete'
        );
        if (confirmed) {
          const response = await app.fetchRaw(`/api/entities/${typeSlug}/${actionBtn.dataset.entityId}`, {
            method: 'DELETE' });
          if (response.ok) {
            app.notify('Deleted', 'success');
            await refreshEntities();
          } else {
            app.notify('Error deleting item', 'danger');
          }
        }
        return;
      }

      // Click on row itself: selection first, then the editor.
      const row = e.target.closest('.entity-row');
      if (row && !e.target.closest('[data-action]')) {
        if (handleSelectionClick(e, row)) return;   // modifier click: selection only
        const entityId = row.dataset.entityId;
        const entity = entities.find(x => x.id == entityId);
        // A row nested inside a template is of its own type, so edit it with
        // that type's fields - and save it back to that type's endpoint.
        if (entity) {
          const schema = schemaForEntity(entity);
          GenericEntity.populate(entity.id, entity, schema, typeSlug, schema.slug);
        }
      }
    });

    // Writes a single field from a cell control. Only that key is sent, so the
    // item's other values are untouched, and the editor is redirected only if
    // it is already open - a cell click never opens or closes it.
    async function saveFieldFromCell(entityId, fieldKey, value, failMessage) {
      const response = await app.fetchRaw(`/api/entities/${typeSlug}/${entityId}`, {
        method: 'PUT',
        
        body: JSON.stringify({ fields: { [fieldKey]: value } })
      });
      if (!response.ok) {
        const reason = await response.json().catch(() => null);
        app.notify(`${failMessage}: ${reason?.message || response.status}`, 'danger');
        return false;
      }
      await refreshEntities();
      GenericEntity.syncEditorFromRow(entityId, fieldKey, value);
      showRowInOpenEditor(entityId);
      return true;
    }

    // Cell controls (status badge, date picker) never open or close the
    // editor - that would move the very cell being clicked. They only redirect
    // an ALREADY-open editor to the row being touched.
    function showRowInOpenEditor(entityId) {
      if (GenericEntity.getCurrentEntityId() == null) return;
      if (String(GenericEntity.getCurrentEntityId()) === String(entityId)) return;
      const entity = entities.find(x => String(x.id) === String(entityId));
      if (entity) GenericEntity.populate(entity.id, entity, typeSchema, typeSlug);
    }

    // Fixed-position menus have to be placed by hand, since they are no longer
    // laid out relative to their button. Flipped upwards when there is not
    // enough room below.
    function positionMenu(btn, menu) {
      if (!btn || !menu) return;
      menu.style.visibility = 'hidden';
      menu.hidden = false;
      const b = btn.getBoundingClientRect();
      const m = menu.getBoundingClientRect();
      const below = window.innerHeight - b.bottom;
      const top = (below < m.height && b.top > m.height) ? b.top - m.height - 2 : b.bottom + 2;
      menu.style.top = `${Math.max(4, top)}px`;
      menu.style.left = `${Math.min(Math.max(4, b.left), window.innerWidth - m.width - 4)}px`;
      menu.style.visibility = '';
    }

    // ----- Column drag-reorder -----
    //
    // Columns are ordered by entity_type_fields.display_order - the same value
    // the field list in Settings > Entity Types reorders. Dragging here writes
    // it, so the two stay in step; there is no separate column-order store.
    let draggedColKey = null;

    const clearColIndicators = () => {
      listContainer.querySelectorAll('.col-drop-before, .col-drop-after')
        .forEach(el => el.classList.remove('col-drop-before', 'col-drop-after'));
    };

    listContainer.addEventListener('dragstart', (e) => {
      const cell = e.target.closest('.entity-header-cell[draggable="true"]');
      if (!cell) return;
      draggedColKey = cell.dataset.colKey;
      e.dataTransfer.effectAllowed = DRAG_EFFECT_ALLOWED;
      // Firefox needs data set or the drag never starts.
      e.dataTransfer.setData('text/plain', draggedColKey);
      cell.classList.add('col-dragging');
      // A header drag must not also start a row drag.
      e.stopPropagation();
    });

    listContainer.addEventListener('dragover', (e) => {
      if (!draggedColKey) return;
      const cell = e.target.closest('.entity-header-cell[draggable="true"]');
      if (!cell || cell.dataset.colKey === draggedColKey) return;
      e.preventDefault();
      e.stopPropagation();
      clearColIndicators();
      cell.classList.add(
        app.getHorizontalDropZone(e, cell) === 'before' ? 'col-drop-before' : 'col-drop-after'
      );
    });

    listContainer.addEventListener('dragend', () => {
      draggedColKey = null;
      clearColIndicators();
      listContainer.querySelectorAll('.col-dragging').forEach(el => el.classList.remove('col-dragging'));
    });

    listContainer.addEventListener('drop', async (e) => {
      if (!draggedColKey) return;
      const target = e.target.closest('.entity-header-cell[draggable="true"]');
      if (!target || target.dataset.colKey === draggedColKey) { clearColIndicators(); return; }
      e.preventDefault();
      e.stopPropagation();

      const position = app.getHorizontalDropZone(e, target);
      const movedKey = draggedColKey;
      draggedColKey = null;
      clearColIndicators();

      // The visible columns in their current order, Title included - Title is
      // not a field, so it is carried as a marker and persisted to the type's
      // title_order rather than to a field's display_order.
      const cols = GenericEntity.orderedColumns(typeSchema)
        .map(c => (c.isTitle ? { title: true } : c.field));

      const keyOf = (c) => (c.title ? 'title' : c.field_key);
      const from = cols.findIndex(c => keyOf(c) === movedKey);
      if (from === -1) return;
      const [moved] = cols.splice(from, 1);
      let to = cols.findIndex(c => keyOf(c) === target.dataset.colKey);
      if (to === -1) return;
      if (position === 'after') to += 1;
      cols.splice(to, 0, moved);

      // Hidden fields keep the display_order they already had; only the visible
      // columns are renumbered 0..n-1.
      for (const [i, c] of cols.entries()) {
        if (c.title) {
          if ((typeSchema.title_order || 0) === i) continue;
          const res = await app.fetchRaw(`/api/entity-types/${typeSchema.id}`, {
            method: 'PUT', body: JSON.stringify({ title_order: i })
          });
          if (!res.ok) { app.notify('Could not reorder columns', 'danger'); return; }
          typeSchema.title_order = i;
        } else {
          if ((c.display_order || 0) === i) continue;
          const res = await app.fetchRaw(`/api/entity-types/fields/${c.id}`, {
            method: 'PUT', body: JSON.stringify({ display_order: i })
          });
          if (!res.ok) { app.notify('Could not reorder columns', 'danger'); return; }
          c.display_order = i;   // keep the in-memory schema in step
        }
      }

      renderList();
      applyFieldOrderToOpenEditor();   // the editor is a view of the same value
    });

    // Closing the editor throws away any unsaved preview that was mirrored
    // into a row while editing - re-rendering restores the persisted values.
    document.addEventListener('entity-editor-closed', (e) => {
      if (e.detail?.typeSlug !== typeSlug) return;
      renderList();
    });

    // Filtering re-renders as you type. Debounced so a fast typist does not
    // rebuild the tree on every keystroke.
    let filterTimer = null;
    listContainer.addEventListener('input', (e) => {
      const input = e.target.closest('[data-action="filter-column"]');
      if (!input) return;
      const key = input.dataset.filterKey;
      const value = input.value;
      clearTimeout(filterTimer);
      // A dropdown selection is deliberate and complete, so apply it at once;
      // only free-text typing needs the debounce.
      const delay = input.tagName === 'SELECT' ? 0 : 250;
      filterTimer = setTimeout(() => {
        const state = GenericEntity.readViewState(typeSlug);
        state.filters = state.filters || {};
        if (value) state.filters[key] = value; else delete state.filters[key];
        GenericEntity.writeViewState(typeSlug, state);
        renderList();
        // Re-rendering replaces the control, so restore focus - and the caret,
        // but only for a text box: setSelectionRange does not exist on a
        // <select> and would throw.
        const again = listContainer.querySelector(`[data-filter-key="${CSS.escape(key)}"]`);
        if (again) {
          again.focus();
          if (typeof again.setSelectionRange === 'function') {
            again.setSelectionRange(again.value.length, again.value.length);
          }
        }
      }, delay);
    });

    // A fixed menu does not travel with the page, so scrolling closes it
    // rather than leaving it stranded away from its column.
    window.addEventListener('scroll', () => {
      listContainer.querySelectorAll('.entity-filter-menu, .entity-columns-menu')
        .forEach(m => { m.hidden = true; });
    }, true);

    // A dropdown/radio cell writes on change.
    listContainer.addEventListener('change', async (e) => {
      const choice = e.target.closest('[data-action="set-choice"]');
      if (!choice) return;
      await saveFieldFromCell(
        choice.dataset.entityId,
        choice.dataset.fieldKey,
        choice.value || null,
        'Could not change that'
      );
    });

    // Picking a date writes just that field and re-renders.
    listContainer.addEventListener('change', async (e) => {
      const input = e.target.closest('.row-date-input');
      if (!input) return;
      const response = await app.fetchRaw(`/api/entities/${typeSlug}/${input.dataset.entityId}`, {
        method: 'PUT',
        
        body: JSON.stringify({ fields: { [input.dataset.fieldKey]: input.value || null } })
      });
      if (response.ok) {
        await refreshEntities();
        GenericEntity.syncEditorFromRow(input.dataset.entityId, input.dataset.fieldKey, input.value);
      } else {
        app.notify('Could not set the date', 'danger');
        renderList();
      }
    });

    // Abandoning the picker without choosing restores the cell.
    listContainer.addEventListener('focusout', (e) => {
      if (!e.target.closest('.row-date-input')) return;
      setTimeout(() => {
        if (!listContainer.querySelector('.row-date-input:focus')) renderList();
      }, 150);
    });

    // Multi-select filters. The chosen values are stored as an array; an empty
    // array means All, which is the default state.
    listContainer.addEventListener('change', (e) => {
      const all = e.target.closest('[data-action="filter-all"]');
      const choice = e.target.closest('[data-action="filter-choice"]');
      if (!all && !choice) return;

      const key = (all || choice).dataset.filterKey;
      const state = GenericEntity.readViewState(typeSlug);
      state.filters = state.filters || {};
      const current = Array.isArray(state.filters[key]) ? state.filters[key] : [];

      let next;
      if (all) {
        next = [];                                  // All clears every choice
      } else if (choice.checked) {
        next = [...new Set([...current, choice.value])];
      } else {
        next = current.filter(v => v !== choice.value);
      }

      if (next.length === 0) delete state.filters[key];
      else state.filters[key] = next;
      GenericEntity.writeViewState(typeSlug, state);
      renderList();

      // Re-rendering rebuilds the menu, so reopen the one being used - and
      // place it again, since a fixed menu keeps no relationship to its button.
      const again = listContainer.querySelector(`[data-action="open-filter-menu"][data-filter-key="${CSS.escape(key)}"]`);
      positionMenu(again, again?.parentElement.querySelector('.entity-filter-menu'));
    });

    // The column chooser writes show_in_row on the field itself - the same
    // value the Column toggle in Settings > Entity Types writes.
    listContainer.addEventListener('change', async (e) => {
      const box = e.target.closest('[data-action="toggle-column"]');
      if (!box) return;
      const fieldId = box.dataset.fieldId;
      const field = (typeSchema.fields || []).find(f => String(f.id) === String(fieldId));
      if (!field) return;

      const response = await app.fetchRaw(`/api/entity-types/fields/${fieldId}`, {
        method: 'PUT',
        
        body: JSON.stringify({ show_in_row: box.checked })
      });

      if (response.ok) {
        field.show_in_row = box.checked;   // keep the in-memory schema in step
        renderList();
        syncColumnToggles(field.id, box.checked);
        positionMenu(
          listContainer.querySelector('[data-action="toggle-columns"]'),
          listContainer.querySelector('.entity-columns-menu')
        );   // both looked up fresh: renderList() replaced the old nodes
      } else {
        box.checked = !box.checked;
        app.notify('Could not change columns', 'danger');
      }
    });

    // ----- Editor field controls: column toggle and reordering -----
    //
    // These write entity_type_fields.show_in_row and display_order - the very
    // same values the header's column chooser and header drag write. Three
    // views, one pair of values; no per-view store that could disagree.
    const editorPane = document.getElementById(`${typeSlug}EditorPane`);

    // The same value is on screen in up to three places: the header's column
    // chooser, the editor's per-field switch, and the columns themselves. When
    // one changes them all, the others have to follow or they show stale state.
    function syncColumnToggles(fieldId, checked) {
      document
        .querySelectorAll(`.entity-columns-menu input[data-field-id="${fieldId}"]`)
        .forEach(el => { el.checked = checked; });
      document
        .querySelectorAll(`.editor-field[data-field-id="${fieldId}"] .editor-field-col`)
        .forEach(el => { el.checked = checked; });
    }

    async function putField(fieldId, body) {
      const res = await app.fetchRaw(`/api/entity-types/fields/${fieldId}`, {
        method: 'PUT',
        
        body: JSON.stringify(body) });
      return res.ok;
    }

    editorPane?.addEventListener('change', async (e) => {
      const box = e.target.closest('.editor-field-col, .editor-field-label');
      if (!box) return;
      const wrap = box.closest('.editor-field');
      const field = (typeSchema.fields || []).find(f => String(f.id) === String(wrap.dataset.fieldId));
      if (!field) return;

      const isColumn = box.classList.contains('editor-field-col');
      const key = isColumn ? 'show_in_row' : 'show_column_label';

      if (!(await putField(field.id, { [key]: box.checked }))) {
        box.checked = !box.checked;
        app.notify('Could not change that', 'danger');
        return;
      }
      field[key] = box.checked;
      renderList();   // the column, or its name, updates immediately
      if (isColumn) syncColumnToggles(field.id, box.checked);
    });

    let draggedField = null;

    editorPane?.addEventListener('dragstart', (e) => {
      // Drag from anywhere on the field EXCEPT its inputs, so selecting text
      // still works. Restricting it to the handle alone did not survive
      // contact: the handle is a small inline span and a drag begun on it does
      // not reliably start.
      if (e.target.closest('input, textarea, select, button, a')) return;
      const wrap = e.target.closest('.editor-field');
      if (!wrap) return;
      draggedField = wrap;
      wrap.classList.add('dragging');
      e.dataTransfer.effectAllowed = DRAG_EFFECT_ALLOWED;
      e.dataTransfer.setData('text/plain', wrap.dataset.fieldKey);
    });

    editorPane?.addEventListener('dragover', (e) => {
      if (!draggedField) return;
      const wrap = e.target.closest('.editor-field');
      if (!wrap || wrap === draggedField) return;
      e.preventDefault();
      editorPane.querySelectorAll('.drop-before, .drop-after')
        .forEach(el => el.classList.remove('drop-before', 'drop-after'));
      wrap.classList.add(app.getVerticalDropZone(e, wrap) === 'before' ? 'drop-before' : 'drop-after');
    });

    editorPane?.addEventListener('dragend', () => {
      draggedField?.classList.remove('dragging');
      draggedField = null;
      editorPane.querySelectorAll('.drop-before, .drop-after')
        .forEach(el => el.classList.remove('drop-before', 'drop-after'));
    });

    // Re-sorts an OPEN editor's fields to match display_order, by moving the
    // existing nodes rather than rebuilding the form - a rebuild would throw
    // away whatever is half-typed in the other fields, which is the same reason
    // the editor's own drag moves nodes instead of re-rendering.
    //
    // Needed because dragging a COLUMN header writes display_order but leaves
    // the editor's DOM as it was, so the two views disagreed until reopen.
    function applyFieldOrderToOpenEditor() {
      const pane = editorPane?.querySelector('.entity-editor-form');
      if (!pane) return;
      const nodes = [...pane.querySelectorAll('.editor-field')];
      if (nodes.length < 2) return;
      const orderOf = (el) => {
        const f = (typeSchema.fields || [])
          .find(x => String(x.id) === String(el.dataset.fieldId));
        return f ? (f.display_order || 0) : 0;
      };
      const parent = nodes[0].parentElement;
      nodes
        .slice()
        .sort((a, b) => orderOf(a) - orderOf(b))
        .forEach(el => parent.appendChild(el));
    }

    editorPane?.addEventListener('drop', async (e) => {
      if (!draggedField) return;
      const target = e.target.closest('.editor-field');
      if (!target || target === draggedField) return;
      e.preventDefault();

      const before = app.getVerticalDropZone(e, target) === 'before';
      // Moved in the DOM rather than by rebuilding the form: rebuilding would
      // discard whatever is being typed in the other fields.
      target.parentElement.insertBefore(draggedField, before ? target : target.nextSibling);
      draggedField.classList.remove('dragging');
      draggedField = null;
      editorPane.querySelectorAll('.drop-before, .drop-after')
        .forEach(el => el.classList.remove('drop-before', 'drop-after'));

      const order = [...editorPane.querySelectorAll('.editor-field')].map(el => el.dataset.fieldId);
      for (const [i, id] of order.entries()) {
        const field = (typeSchema.fields || []).find(f => String(f.id) === String(id));
        if (!field || (field.display_order || 0) === i) continue;
        if (!(await putField(id, { display_order: i }))) {
          app.notify('Could not reorder fields', 'danger');
          return;
        }
        field.display_order = i;
      }
      renderList();   // column order follows
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
    // Folders are a separate capability from nesting: a template nests freely
    // but has no folders, because the template row is already the container.
    const allowsFolders = typeSchema.supports_hierarchy
      && typeSchema.supports_folders !== 0 && typeSchema.supports_folders !== false;
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
      const response = await app.fetchRaw(`/api/entities/${typeSlug}/${entityId}`, {
        method: 'DELETE' });
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
        if (allowsFolders) {
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
      if (allowsFolders) {
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
      // Folders organise, they are not work - there is nothing to be "working
      // on" about a folder, so it cannot be pinned.
      if (!isFolder && window.FocusBar) {
        items.push({ separator: true });
        items.push({
          icon: '📌',
          label: window.FocusBar.has(entityId) ? 'Already on the focus bar' : 'Pin to focus bar',
          action: async () => {
            if (window.FocusBar.has(entityId)) return;
            try {
              await window.FocusBar.add(entityId);
              app.notify('Pinned to the focus bar', 'success');
            } catch (error) {
              app.notify(error.message || 'Could not pin that', 'danger');
            }
          },
        });
      }

      items.push({ separator: true });
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

    // ----- Dropping a link onto a row -----
    //
    // A URL dragged in from a browser tab, the address bar or another app is
    // appended to the target row's `links` field. Only rows of a type that
    // actually declares a links field accept the drop - hence "a type that
    // accepts links" is read from the schema, never assumed.
    //
    // This must not be confused with the two INTERNAL drags on this same
    // container (row reorder/nest, and column reorder). Internal drags never
    // carry text/uri-list, and both set their own state variable, so the guard
    // below checks all three.
    const linksField = () => (typeSchema.fields || []).find(f => f.field_type === 'links');

    const isExternalUrlDrag = (e) =>
      !draggedEntityId && !draggedColKey &&
      Array.from(e.dataTransfer?.types || []).some(t => t === 'text/uri-list' || t === 'text/plain');

    const firstUrl = (e) => {
      const raw = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain') || '';
      // text/uri-list may carry several lines and # comments.
      const line = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'))[0];
      if (!line) return null;
      try {
        const u = new URL(line);
        return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : null;
      } catch { return null; }
    };

    listContainer.addEventListener('dragover', (e) => {
      if (!linksField() || !isExternalUrlDrag(e)) return;
      const row = e.target.closest('.entity-row');
      if (!row || row.dataset.isFolder === '1') return;   // folders hold no field values
      acceptDrop(e, 'copy');
      e.stopPropagation();
      listContainer.querySelectorAll('.entity-link-drop-target')
        .forEach(el => el.classList.remove('entity-link-drop-target'));
      row.classList.add('entity-link-drop-target');
    });

    listContainer.addEventListener('drop', async (e) => {
      const field = linksField();
      if (!field || !isExternalUrlDrag(e)) return;
      const row = e.target.closest('.entity-row');
      if (!row || row.dataset.isFolder === '1') return;
      e.preventDefault();
      e.stopPropagation();
      row.classList.remove('entity-link-drop-target');

      const url = firstUrl(e);
      if (!url) { app.notify('That drop had no usable link in it', 'warning'); return; }

      const entity = entities.find(x => String(x.id) === String(row.dataset.entityId));
      const existing = Array.isArray(entity?.fields?.[field.field_key])
        ? entity.fields[field.field_key]
        : [];
      if (existing.some(l => l.url === url)) {
        app.notify('That link is already on this item', 'info');
        return;
      }

      // Name the link the way its browser tab is named. The title has to be
      // read server-side (a page's <title> is not readable cross-origin), and
      // that can fail - the site may be down, private, or serve no title - so
      // fall back to asking rather than storing a bare URL.
      let name = null;
      try {
        const r = await fetch(`/api/link-title?url=${encodeURIComponent(url)}`);
        if (r.ok) name = (await r.json())?.data?.title || null;
      } catch { /* fall through to asking */ }

      if (!name) {
        name = await app.prompt('That page did not give a name. What should this link be called?', {
          title: 'Name this link',
          defaultValue: (() => { try { return new URL(url).hostname; } catch { return url; } })(),
          placeholder: 'Link name',
        });
        if (name === null) return;   // cancelled: add nothing
      }

      const response = await app.fetchRaw(`/api/entities/${typeSlug}/${row.dataset.entityId}`, {
        method: 'PUT',
        
        // Only the links field is sent, so the item's other values are
        // untouched - updateEntity iterates the keys it is given.
        body: JSON.stringify({
          fields: { [field.field_key]: [...existing, { url, title: name }] }
        })
      });

      if (response.ok) {
        await refreshEntities();
        // If the editor is open on this row, rebuild it so the new link is
        // listed - the links field is built at populate() time and would
        // otherwise keep showing the old set until reopened.
        const fresh = entities.find(x => String(x.id) === String(row.dataset.entityId));
        if (fresh && String(GenericEntity.getCurrentEntityId()) === String(fresh.id)) {
          GenericEntity.close();
          GenericEntity.populate(fresh.id, fresh, typeSchema, typeSlug);
          renderList();
        }
        app.notify('Link added', 'success');
      } else {
        // Say WHY. A bare "could not add the link" is unactionable, and the
        // usual cause here is the dev server restarting mid-request.
        const reason = await response.json().catch(() => null);
        app.notify(
          `Could not add the link: ${reason?.message || `${response.status} ${response.statusText}`}`,
          'danger'
        );
      }
    });

    listContainer.addEventListener('dragleave', (e) => {
      const row = e.target.closest?.('.entity-row');
      if (row) row.classList.remove('entity-link-drop-target');
    });

    // Drag and drop
    let draggedEntityId = null;
    listContainer.addEventListener('dragstart', (e) => {
      const row = e.target.closest('.entity-row');
      if (row) {
        draggedEntityId = row.dataset.entityId;
        e.dataTransfer.effectAllowed = DRAG_EFFECT_ALLOWED;

        // Publish what the Dailies rail reads on drop (`type`, `id`, `name`).
        // Without these the row dragged fine within its own list but arrived at
        // Dailies carrying nothing, so dropping it silently did nothing.
        // Dailies keys off its own singular names, which are not always the
        // type slug - `to_do` is `todo` there.
        const dropType = DAILIES_DROP_TYPE[typeSlug] || typeSlug;
        const entity = entities.find(x => String(x.id) === String(draggedEntityId));
        // copyMove, not move: a cross-type drop asks for 'copy' (the row is being
        // placed somewhere else, not taken out of this list). With
        // effectAllowed='move' Chromium treats a 'copy' dropEffect as
        // incompatible and refuses the drop - every dragover was accepted and no
        // drop ever fired.
        e.dataTransfer.effectAllowed = DRAG_EFFECT_ALLOWED;
        e.dataTransfer.setData('type', dropType);
        e.dataTransfer.setData('id', String(draggedEntityId));
        e.dataTransfer.setData('name', entity?.title || '');
        // Firefox refuses to start a drag without a text/plain payload.
        e.dataTransfer.setData('text/plain', entity?.title || String(draggedEntityId));

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
      clearDropIndicators(row);       // dragDropUtils.js - one implementation
      row.classList.remove('entity-drop-target-nest');
    }

    // Chromium will not deliver a `drop` unless the target accepts the drag on
    // dragENTER as well as dragover. Accepting only on dragover produced a
    // dragstart -> dragover -> dragend sequence with no drop at all, which is
    // exactly what "I cannot drag anything onto a template" looked like.
    // Nesting a row dragged in from another tab. Shared by the pane-level and
    // list-level drop handlers so both routes behave identically.
    async function handleCrossTypeDrop(e, targetRow) {
      const childSlug = incomingChildSlug(e);
      const droppedId = Number(e.dataTransfer.getData('id'));
      const childName = e.dataTransfer.getData('name');
      if (!childSlug || !droppedId) return;

      // Copy or reference: a reference points at the original, so editing it
      // here edits the original; a copy is independent. Same question, same
      // wording, as dropping onto a day.
      const choice = await app.askCopyOrReference(childName);
      if (!choice) return;

      const csrf = document.body.dataset.csrfToken;
      try {
        let childId = droppedId;
        if (choice === 'copy') {
          const cloned = await app.fetchRaw(`/api/entities/${childSlug}/${droppedId}/clone`, {
            method: 'POST' });
          const cloneResult = await cloned.json();
          if (!cloneResult.success) throw new Error(cloneResult.message);
          childId = cloneResult.data.id;
        }
        // Onto a row: nest inside it. Onto empty space: make a new row of this
        // type named after what was dropped and nest it there - so dragging an
        // Idea onto an empty Templates list gives you a template containing
        // that idea, rather than doing nothing.
        let parentId = targetRow ? Number(targetRow.dataset.entityId) : null;
        if (!parentId) {
          const created = await app.fetchRaw(`/api/entities/${typeSlug}`, {
            method: 'POST',
            
            body: JSON.stringify({ title: childName || `New ${singular}` })
          });
          const result = await created.json();
          if (!result.success) throw new Error(result.message);
          parentId = result.data.id;
        }

        const linked = await app.fetchRaw(`/api/entities/${typeSlug}/${parentId}/relationships`, {
          method: 'POST',
          
          body: JSON.stringify({ parentEntityId: parentId, childEntityId: childId, relationshipKind: 'hierarchy' })
        });
        if (!linked.ok) throw new Error((await linked.json().catch(() => ({}))).message || 'Could not add it');

        localStorage.setItem(`entity-expanded-${parentId}`, 'true');
        await refreshEntities();
        app.notify(`Added ${childName || 'item'}`, 'success');
      } catch (error) {
        app.notify(error.message || 'Could not add that here', 'danger');
      }
    }

    dropPane.addEventListener('dragenter', (e) => {
      if (draggedEntityId) return;
      if (!e.dataTransfer?.types?.includes('type')) return;
      e.preventDefault();
    });

    // Cross-type drags are accepted across the whole pane; same-list reordering
    // stays on the list itself, where the row geometry it needs lives.
    dropPane.addEventListener('dragover', (e) => {
      if (draggedEntityId) return;
      if (!e.dataTransfer?.types?.includes('type')) return;
      acceptDrop(e, 'copy');
      const row = e.target.closest('.entity-row');
      listContainer.querySelectorAll('.entity-row').forEach(clearDropIndicator);
      if (row) row.classList.add('entity-drop-target-nest');
      else dropPane.classList.add('entity-list-drop-target');
    });

    dropPane.addEventListener('drop', async (e) => {
      if (draggedEntityId) return;
      e.preventDefault();
      dropPane.classList.remove('entity-list-drop-target');
      listContainer.querySelectorAll('.entity-row').forEach(clearDropIndicator);
      await handleCrossTypeDrop(e, e.target.closest('.entity-row'));
    });

    listContainer.addEventListener('dragover', (e) => {
      if (!draggedEntityId) {
        if (!e.dataTransfer?.types?.includes('type')) return;
        acceptDrop(e, 'copy');
        const row = e.target.closest('.entity-row');
        listContainer.querySelectorAll('.entity-row').forEach(clearDropIndicator);
        if (row) row.classList.add('entity-drop-target-nest');
        else listContainer.classList.add('entity-list-drop-target');
        return;
      }
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
        acceptDrop(e, 'move');
      }
    });

    listContainer.addEventListener('dragleave', (e) => {
      const row = e.target.closest('.entity-row');
      if (row) clearDropIndicator(row);
      if (!listContainer.contains(e.relatedTarget)) {
        listContainer.classList.remove('entity-list-drop-target');
      }
    });

    listContainer.addEventListener('drop', async (e) => {
      e.preventDefault();
      listContainer.classList.remove('entity-list-drop-target');
      const targetRow = e.target.closest('.entity-row');

      if (!draggedEntityId) return;   // handled by the pane-level listener

      if (!targetRow) return;
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
            await app.fetchRaw(`/api/entities/${typeSlug}/${sourceId}/relationships/${oldParentId}/${sourceId}?kind=hierarchy`, {
              method: 'DELETE' });
          }
          const response = await app.fetchRaw(`/api/entities/${typeSlug}/${sourceId}/relationships`, {
            method: 'POST',
            
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
              await app.fetchRaw(`/api/entities/${typeSlug}/${sourceId}/relationships/${oldParentId}/${sourceId}?kind=hierarchy`, {
                method: 'DELETE' });
            }
            if (newParentId !== null) {
              const reparentResponse = await app.fetchRaw(`/api/entities/${typeSlug}/${sourceId}/relationships`, {
                method: 'POST',
                
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

            const reorderResponse = await app.fetchRaw(`/api/entities/${typeSlug}/${newParentId}/relationships/reorder`, {
              method: 'PATCH',
              
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

            const reorderResponse = await app.fetchRaw(`/api/entities/${typeSlug}/reorder`, {
              method: 'PATCH',
              
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

          const reorderResponse = await app.fetchRaw(`/api/entities/${typeSlug}/reorder`, {
            method: 'PATCH',
            
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
          const response = await app.fetchRaw(`/api/entities/${typeSlug}/${saved.id}/relationships`, {
            method: 'POST',
            
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

        // Saving NEVER closes the editor - it stays open on what was just
        // saved, with Save and Cancel disabled because there is now nothing to
        // save and nothing to discard. Both re-enable on the next edit.
        if (wasCreate && saved?.id) {
          // Reset first: populate() treats being handed the id it already
          // holds as a request to toggle the editor shut.
          GenericEntity.close();
          await refreshEntities();
          GenericEntity.populate(saved.id, saved, typeSchema, typeSlug);
          renderList(); // re-render so the new row paints as selected
        } else {
          await refreshEntities();
          GenericEntity.markSaved();
        }
      } catch (error) {
        app.notify(error.message, 'danger');
      }
    });

    // Revert, not Cancel: it throws away the edits and reloads the record as
    // stored. The editor stays open on it - closing is done by clicking the
    // row again, the same gesture that opened it.
    document.getElementById(`${typeSlug}CloseBtn`)?.addEventListener('click', async () => {
      const id = GenericEntity.getCurrentEntityId();
      if (id == null) {
        // Nothing saved yet (a new item): there is no stored version to go back
        // to, so reverting is the same as discarding it.
        GenericEntity.close();
        return;
      }
      const entity = entities.find(x => String(x.id) === String(id));
      if (!entity) { GenericEntity.close(); return; }
      GenericEntity.close();
      GenericEntity.populate(entity.id, entity, typeSchema, typeSlug);
      renderList();
    });

    // Folder creation, available on every type that can nest - gated on the
    // type's own supports_hierarchy flag, never on which type it is. A folder
    // is just an is_folder row of this type, so it goes through the same
    // editor and the same save path as any other new item.
    const folderBtn = document.getElementById(`add${typeSlug}FolderBtn`);
    if (folderBtn) {
      if (typeSchema.supports_hierarchy && typeSchema.supports_folders !== 0 && typeSchema.supports_folders !== false) {
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
