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

// `/api/entity-types` returns EVERY type's whole schema - the same ~45KB - and
// every tab was asking for it on its own: once to work out which types may nest
// inside it, and a SECOND time for the types that can hold other types. Nine
// type tabs plus the three rails made that 16 identical requests, each parsed
// separately, on a single page load.
//
// One promise, shared: the first caller fetches and everyone else awaits the
// same result. Cleared on failure so a later caller can try again rather than
// inheriting one bad response for the life of the page.
//
// The array is shared rather than copied per caller, which is safe because
// nothing mutates it. A tab's OWN live schema never comes from here - that is
// the separate `/api/entity-types/:slug` fetch, and it is the object the
// column-header drag renumbers. See the schemaByTypeId comment below, which
// depends on those being two different objects.
let allEntityTypesPromise = null;
function fetchAllEntityTypes() {
  if (!allEntityTypesPromise) {
    allEntityTypesPromise = app.fetchRaw('/api/entity-types', {})
      .then((r) => r.json())
      .then((j) => j.data || [])
      .catch((error) => {
        allEntityTypesPromise = null;
        throw error;
      });
  }
  return allEntityTypesPromise;
}

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
    // Out of the ONE shared list, not a request per tab. `/api/entity-types`
    // carries every type's fields AND relationships, which is everything the
    // single-type endpoint returned - so nine tabs each fetching
    // /api/entity-types/:slug was nine requests re-reading what one response
    // already held.
    //
    // This also means every tab now points at the SAME object for a given
    // type, which is what the schemaByTypeId comment below wanted all along:
    // the bug it describes was a stale COPY shadowing the live schema, and
    // there is no second copy to go stale any more. Column order stays one
    // value across the page, which is what column-reorder-editor-sync asserts.
    const allTypes = await fetchAllEntityTypes();
    const typeSchema = allTypes.find(t => t.slug === typeSlug);
    if (!typeSchema) throw new Error(`No such entity type: ${typeSlug}`);

    // Which types may be nested INSIDE this one, by slug. This is what lets a
    // row dragged from another tab land inside a template: templates declare
    // every editable type as an allowed child, ordinary types declare only
    // themselves. Nothing here is template-specific - it is read from the type
    // rules, so a user who allows Projects inside Categories gets that too.
    let allowedChildSlugs = new Set();
    try {
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
        for (const t of allTypes) {
          // NEVER replace the page's own schema with this snapshot.
          //
          // Line above seeds the map with the LIVE `typeSchema` - the object the
          // column-header drag mutates when it renumbers display_order. Letting
          // this loop overwrite that entry swapped the live object for a copy
          // taken at load, so after a drag the columns re-rendered in the new
          // order (they read `typeSchema`) while the editor still opened in the
          // old one (it reads this map, via schemaForEntity). It came back only
          // on reload, which is exactly what column-reorder-editor-sync.spec
          // asserts must not happen: column order and editor field order are
          // ONE value.
          //
          // Only types OTHER than this page's are wanted here anyway - the whole
          // point of the map is rendering a nested row of a different type.
          if (t.id === typeSchema.id) continue;
          schemaByTypeId.set(t.id, t);
        }
      } catch { /* fall back to the page's own schema */ }
    }
    const schemaForEntity = (entity) => schemaByTypeId.get(entity?.entity_type_id) || typeSchema;

    // NOT fetched here. Nine type tabs and three rails all render into the DOM
    // up front - that is what makes switching instant - but only one type pane
    // and its rails are ever ON SCREEN, and every one of the others was
    // fetching its full row set and hierarchy at page load anyway. See
    // ensureLoaded() below: the rows are fetched the first time this pane is
    // actually shown, and never for a tab nobody opens.
    let entities = [];

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

    // Set by the selection code below, which needs to repaint after every
    // render. No-op until then, so render order does not matter.
    let afterRender = () => {};

    // Render tree or list from the current `entities`/`relationships` arrays
    function renderList() {
      if (typeSchema.supports_hierarchy) {
        listContainer.innerHTML = GenericEntity.renderTree(entities, mergedColumnSchema(), relationships, schemaForEntity);
      } else {
        listContainer.innerHTML = GenericEntity.renderFlatList(entities, typeSchema);
      }
      // Width-dependent, so it can only run once the markup is in the document.
      GenericEntity.fitColumns(listContainer, mergedColumnSchema());
      afterRender();
    }

    // The pane's width is not fixed - the Dailies rail is draggable, and that
    // is the case that produced four-pixel columns before any of this existed.
    // Re-fit on resize rather than only on render.
    if (typeof ResizeObserver !== 'undefined') {
      let fitPending = false;
      new ResizeObserver(() => {
        if (fitPending) return;                    // coalesce a drag's many ticks
        fitPending = true;
        requestAnimationFrame(() => {
          fitPending = false;
          GenericEntity.fitColumns(listContainer, mergedColumnSchema());
        });
      }).observe(listContainer);
    }

    // Re-fetch and re-render in place after a create/edit/delete/move, instead
    // of location.reload() - which was slow, jarring, and made a successful
    // save look like it had done nothing until the reload caught up.
    // Two refreshes in flight at once can come back in either order, and the
    // one that lands LAST wins whether or not it is the newest. Every cell
    // control refreshes after its write, so clicking along a row starts one
    // per click - and a response fetched before a write, arriving after it,
    // put `entities` back to how they were and repainted the row with the old
    // value. The editor had the new one (it is updated directly), so the two
    // disagreed, differently on each run: the cell that lost the race moved
    // around between select, checkbox, radio and emojis.
    //
    // Stamp each refresh and let only the newest apply. An older response is
    // dropped rather than rendered; the newer one it lost to is already on its
    // way with the same data plus whatever happened since.
    let refreshSeq = 0;
    async function refreshEntities() {
      const mine = ++refreshSeq;
      // Together, not one after the other. Neither read depends on the other,
      // so awaiting them in sequence spent two round trips' latency where one
      // would do - and this sits on the path of every create, every delete and
      // every cell click, behind which nothing is painted at all. Cheap on a
      // local MySQL socket; the whole delay on a machine talking to a SQL
      // Server across a network.
      const [fetched, fetchedRelationships] = await Promise.all([
        fetchAllEntities(),
        fetchRelationships(),
      ]);
      if (mine !== refreshSeq) return;   // superseded while we were waiting
      entities = fetched;
      relationships = fetchedRelationships;
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
      // Refreshing a tab that has never been shown would fetch its rows to
      // repaint a pane nobody is looking at - and would put back exactly the
      // page-load fetching ensureLoaded() exists to avoid. It has nothing
      // stale to correct, because it has nothing; it loads fresh when opened.
      activate(slug) {
        return this._activate[slug]?.();
      },
      _bySlug: {},
      _activate: {},
    });
    window.GenericEntityTabs._bySlug[typeSlug] = () => (loaded ? refreshEntities() : undefined);
    window.GenericEntityTabs._activate[typeSlug] = ensureLoaded;

    // The rows are fetched the first time this pane is on screen, and once.
    //
    // `loaded` is what every other path checks; `loadingPromise` is what makes
    // a second trigger during the fetch await the first rather than start a
    // second one - the observer below and tabs.js#loadTabData can both fire for
    // the same switch.
    let loaded = false;
    let loadingPromise = null;
    async function ensureLoaded() {
      if (loaded) return;
      if (loadingPromise) return loadingPromise;
      loadingPromise = (async () => {
        await refreshEntities();          // both fetches in parallel, then renders
        loaded = true;
        restoreOpenEditor();
      })();
      try {
        await loadingPromise;
      } finally {
        loadingPromise = null;
      }
    }

    // A refresh should not close whatever was open. The record's identity was
    // remembered when the editor opened; if that row is still here, put it back.
    // Deliberately after the first render, so the row it selects already exists.
    // Only the visible tab restores. A hidden pane opening an editor would put
    // a second #entity-editor-form in the DOM and hand the singleton to a tab
    // nobody is looking at.
    function restoreOpenEditor() {
      const pane = document.getElementById(`tab-${typeSlug}`);
      const isShowing = !!pane && (pane.classList.contains('active') || pane.offsetParent !== null);
      const reopenId = isShowing ? GenericEntity.recallOpenEditor(typeSlug) : null;
      if (reopenId == null) return;
      const reopen = entities.find(x => String(x.id) === String(reopenId));
      // Gone (deleted elsewhere, or filtered out of this type) - forget it
      // rather than leaving a pointer that can never resolve.
      if (reopen) GenericEntity.populate(reopen.id, reopen, typeSchema, typeSlug);
      else GenericEntity.forgetOpenEditor(typeSlug);
    }

    // What counts as "shown" is deliberately NOT a list of tab names. A type
    // pane is on screen when it is the current tab, and a rail (Dailies,
    // Templates, Priorities) is on screen beside whatever tab is current, and
    // both can change from a tab click, a rail toggle, a pop-out window or a
    // restored layout. An IntersectionObserver answers the question the app
    // actually cares about - is this pane visible - without any of those paths
    // having to remember to say so.
    //
    // Watch the PANE, never the list. An unloaded list is empty and therefore
    // zero-height, and a zero-area target never reports as intersecting - so
    // observing it asks "is this visible" of the very element that cannot
    // become visible until it loads. The Templates rail sat empty on screen
    // because of exactly that. The pane has size whether or not anything is in
    // it, and it is display:none when put away, which is the real signal.
    //
    // The rails have no `tab-<slug>` pane at all (Dailies and Templates are
    // rails, not tabs), so the list pane is the one element every type has.
    const visibilityAnchor =
      document.getElementById(`${typeSlug}ListPane`) ||
      document.getElementById(`tab-${typeSlug}`) ||
      listContainer;

    app.whenVisible(visibilityAnchor, ensureLoaded);

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

    // Someone changed a tree elsewhere. Redraw if this page shows either end of
    // it: the row may have moved into or out of something visible here.
    document.addEventListener('entity-structure-changed', async (e) => {
      const { childId, parentId } = e.detail || {};
      const shows = (id) => id != null && entities.some(x => String(x.id) === String(id));
      if (!shows(childId) && !shows(parentId)) return;
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
    // Registered as a hook rather than by reassigning renderList itself: that
    // is a function DECLARATION, so overwriting it worked only by grace of
    // sloppy mode and left two live bindings for one name.
    afterRender = paintSelection;

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
    // Move every selected row somewhere else. A drag carries one row, so this is
    // the only way to re-file a batch - and re-filing a quarter's work is
    // exactly what a selection is for.
    async function moveSelected() {
      const ids = [...selectedIds];
      if (ids.length === 0) return;

      // Only folders can receive, plus the top level. A row cannot be moved
      // into itself or into anything it contains, or the tree would detach.
      const forbidden = new Set(ids.map(String));
      for (const id of ids) {
        for (const desc of descendantsOf(Number(id))) forbidden.add(String(desc));
      }

      const targets = entities
        .filter(x => x.is_folder && !forbidden.has(String(x.id)))
        .sort((a, b) => (a.title || '').localeCompare(b.title || ''));

      const choice = await app.choose({
        title: `Move ${ids.length} row${ids.length === 1 ? '' : 's'}`,
        message: 'Where should they go?',
        options: [
          { value: '', label: 'Top level (out of any folder)' },
          ...targets.map(t => ({ value: String(t.id), label: t.title })),
        ],
      });
      if (choice === null || choice === undefined) return;

      for (const id of ids) {
        // Detach from wherever it is, then attach if a folder was chosen.
        const parent = relationships.find(r => String(r.child_entity_id) === String(id));
        if (parent) {
          await app.fetchRaw(
            `/api/entities/${typeSlug}/${parent.parent_entity_id}/relationships/${parent.parent_entity_id}/${id}?kind=hierarchy`,
            { method: 'DELETE' }).catch(() => {});
        }
        if (choice) {
          await app.fetchRaw(`/api/entities/${typeSlug}/${id}/relationships`, {
            method: 'POST',
            body: JSON.stringify({ parentEntityId: Number(choice), childEntityId: Number(id), relationshipKind: 'hierarchy' }),
          }).catch(() => {});
        }
      }

      clearSelection();
      await refreshEntities();
      document.dispatchEvent(new CustomEvent('entity-structure-changed', {
        detail: { typeSlug, parentId: choice ? Number(choice) : null },
      }));
      app.notify(`Moved ${ids.length} row${ids.length === 1 ? '' : 's'}`, 'success');
    }

    // Everything below a row, so a move cannot put a row inside its own subtree.
    function descendantsOf(rootId) {
      const out = [];
      let frontier = [rootId];
      const seen = new Set([rootId]);
      while (frontier.length) {
        const next = [];
        for (const rel of relationships) {
          if (!frontier.includes(rel.parent_entity_id)) continue;
          if (seen.has(rel.child_entity_id)) continue;
          seen.add(rel.child_entity_id);
          out.push(rel.child_entity_id);
          next.push(rel.child_entity_id);
        }
        frontier = next;
      }
      return out;
    }

    async function deleteSelected() {
      const ids = [...selectedIds];
      if (ids.length < 2) return false;
      const ok = await app.confirm(
        `Delete ${ids.length} items? Anything nested under them will be deleted too.`,
        'Confirm Delete'
      );
      if (!ok) return true;

      const failedIds = [];
      let succeeded = 0;
      for (const id of ids) {
        const res = await app.fetchRaw(`/api/entities/${typeSlug}/${id}`, {
          method: 'DELETE' });
        if (res.ok) {
          succeeded++;
        } else {
          const reason = await res.json().catch(() => null);
          failedIds.push(id);
          app.notify(`Could not delete item ${id}: ${reason?.message || res.status}`, 'danger');
        }
      }

      if (failedIds.length) {
        // Keep only the failures selected, so the same action can be retried
        // on just what didn't go through.
        selectedIds.clear();
        for (const id of failedIds) selectedIds.add(id);
        app.notify(`Deleted ${succeeded} of ${ids.length} items`, 'danger');
      } else {
        clearSelection();
        app.notify(`Deleted ${succeeded} items`, 'success');
      }
      await refreshEntities();
      return true;
    }

    document.getElementById(`${typeSlug}SelectionBar`)?.addEventListener('click', async (e) => {
      if (e.target.closest('[data-action="delete-selected"]')) { await deleteSelected(); return; }
      if (e.target.closest('[data-action="move-selected"]')) { await moveSelected(); return; }
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
        toggleExpanded(e.target.closest('[data-action="toggle-expand"]').closest('.entity-node'));
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

      // ----- Saved views -----
      const viewsBtn = e.target.closest('[data-action="toggle-views"]');
      if (viewsBtn) {
        const menu = viewsBtn.closest('.entity-header-actions')?.querySelector('.entity-views-menu');
        if (menu) {
          renderSavedViews(menu);
          menu.hidden = !menu.hidden;
          if (!menu.hidden) positionMenu(viewsBtn, menu);
        }
        return;
      }

      if (e.target.closest('[data-action="save-view"]')) {
        const name = await app.prompt(
          'Filters, sorting and column order, under a name.',
          { title: 'Save this view', placeholder: 'e.g. My open tickets' });
        if (!name) return;
        GenericEntity.saveCurrentView(typeSlug, name);
        const menu = listContainer.querySelector('.entity-views-menu');
        if (menu) renderSavedViews(menu);
        app.notify(`Saved "${name}"`, 'success');
        return;
      }

      const applyView = e.target.closest('[data-action="apply-view"]');
      if (applyView) {
        if (GenericEntity.applySavedView(typeSlug, applyView.dataset.viewName)) {
          renderList();
          const menu = listContainer.querySelector('.entity-views-menu');
          if (menu) menu.hidden = true;
        }
        return;
      }

      const dropView = e.target.closest('[data-action="delete-view"]');
      if (dropView) {
        GenericEntity.deleteSavedView(typeSlug, dropView.dataset.viewName);
        const menu = dropView.closest('.entity-views-menu');
        if (menu) renderSavedViews(menu);
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

      // A title being renamed in place owns its own clicks: putting the caret
      // in it, or dragging over the text to select part of it, must not also
      // select the row or redirect the editor out from under the rename.
      if (e.target.closest('.entity-title-editing')) return;

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
        const cycleEntity = entities.find(x => String(x.id) === String(cycleEmoji.dataset.entityId));
        const cycleSchema = cycleEntity ? schemaForEntity(cycleEntity) : typeSchema;
        const field = (cycleSchema.fields || []).find(f => f.field_key === cycleEmoji.dataset.fieldKey);
        const set = field?.field_options?.values || [];
        if (!set.length) return;
        const next = set[(set.indexOf(cycleEmoji.dataset.value) + 1) % set.length];
        await saveFieldFromCell(cycleEmoji.dataset.entityId, field.field_key, next,
          'Could not change that');
        return;
      }

      // Emoji cell: pick and save, without disturbing the editor.
      const emojiBtn = e.target.closest('[data-action="pick-emoji-cell"]');
      if (emojiBtn) {
        const picked = await app.pickEmoji(emojiBtn);
        if (picked === null) return;
        const pickEntity = entities.find(x => String(x.id) === String(emojiBtn.dataset.entityId));
        const pickSlug = (pickEntity && schemaForEntity(pickEntity)?.slug) || typeSlug;
        const response = await app.fetchRaw(`/api/entities/${pickSlug}/${emojiBtn.dataset.entityId}`, {
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
      const timeBoxBtn = e.target.closest('[data-action="cycle-timebox-field"]');
      if (timeBoxBtn) {
        const tbEntity = entities.find(x => String(x.id) === String(timeBoxBtn.dataset.entityId));
        const tbSchema = tbEntity ? schemaForEntity(tbEntity) : typeSchema;
        const field = (tbSchema.fields || []).find(f => f.field_key === timeBoxBtn.dataset.fieldKey);
        const LEVELS = GenericEntity.cellChoices(field) || [''];
        const current = timeBoxBtn.dataset.value || '';
        const next = LEVELS[(LEVELS.indexOf(current) + 1) % LEVELS.length];
        await saveFieldFromCell(timeBoxBtn.dataset.entityId, timeBoxBtn.dataset.fieldKey,
          next === '' ? null : next, 'Could not change the time box');
        return;
      }

      // The AI toggle flips in place, like the one in Dailies. Only this
      // field is sent, so nothing else on the row is disturbed.
      const claudeBtn = e.target.closest('[data-action="toggle-claude-field"]');
      if (claudeBtn) {
        const now = claudeBtn.dataset.value === '1';
        await saveFieldFromCell(claudeBtn.dataset.entityId, claudeBtn.dataset.fieldKey,
          !now, 'Could not change whether AI was used');
        return;
      }

      // Worked Time starts/stops the clock, the same one the pin bar's own
      // chip uses (they're the same focus_seconds/focus_started_at fields) -
      // this works whether or not the item happens to be pinned. Goes through
      // /api/focus, not saveFieldFromCell, because starting one clock also
      // has to stop whatever else is running.
      const timerBtn = e.target.closest('[data-action="toggle-timer-field"]');
      if (timerBtn) {
        try {
          await app.fetch(`/api/focus/${timerBtn.dataset.entityId}/toggle`, { method: 'POST' });
          await refreshEntities();
        } catch (error) {
          app.notify(error.message || 'Could not change the clock', 'danger');
        }
        return;
      }

      // Priority and status go through saveFieldFromCell like every other cell
      // control. They each used to carry their own copy of the PUT-then-refresh
      // dance, which is how they came to differ from it - and from each other -
      // over what to do about the open editor.
      const priorityBtn = e.target.closest('[data-action="cycle-priority"]');
      if (priorityBtn) {
        // Shared with the right-click menu, so the two cannot disagree.
        const LEVELS = GenericEntity.cellChoices({ field_type: 'priority' })
          || ['', 'Low', 'Medium', 'High', 'Critical'];
        const current = priorityBtn.dataset.priority || '';
        const next = LEVELS[(LEVELS.indexOf(current) + 1) % LEVELS.length];
        await saveFieldFromCell(priorityBtn.dataset.entityId, priorityBtn.dataset.fieldKey,
          next || null, 'Could not change priority');
        return;
      }

      const statusBtn = e.target.closest('[data-action="cycle-status"]');
      if (statusBtn) {
        const statusEntity = entities.find(x => String(x.id) === String(statusBtn.dataset.entityId));
        const statusSchema = statusEntity ? schemaForEntity(statusEntity) : typeSchema;
        const field = (statusSchema.fields || []).find(
          f => f.field_key === statusBtn.dataset.fieldKey
        );
        const values = field?.field_options?.values || [];
        if (values.length === 0) return;

        const idx = values.indexOf(statusBtn.dataset.status);
        const next = values[(idx + 1) % values.length];
        await saveFieldFromCell(statusBtn.dataset.entityId, field.field_key,
          next, 'Could not change status');
        return;
      }

      // Remove: a REFERENCE is the original record shown here, so taking it off
      // this page means cutting the edge that put it here, never deleting it.
      // Deleting a row that is only referenced would destroy it on its own page
      // as well, which is not what "remove it from this template" means.
      const unlinkBtn = e.target.closest('[data-action="unlink"]');
      if (unlinkBtn) {
        const row = unlinkBtn.closest('.entity-row');
        const childId = unlinkBtn.dataset.entityId;
        // row.parentElement is this row's OWN .entity-node - renderTree()
        // wraps a row as the first child of its own node, not its parent's -
        // so closest('.entity-node') from there matched immediately and
        // returned the row's own node. parentId came out equal to childId,
        // the DELETE below matched no relationship row (there is no edge
        // from an entity to itself), and the click did nothing: no error,
        // nothing removed. Escaping to the enclosing .entity-node-children
        // first is what actually reaches the ANCESTOR's node; :scope > keeps
        // it to that node's OWN row rather than the first .entity-row found
        // anywhere inside it (which, for a parent with its own children,
        // would still find one, just not necessarily this one's parent).
        const parentRow = row?.closest('.entity-node-children')?.closest('.entity-node')
          ?.querySelector(':scope > .entity-row');
        const parentId = parentRow?.dataset.entityId;
        if (!parentId) { app.notify('Could not tell what to remove it from', 'danger'); return; }

        // The route is /:typeSlug/:id/relationships/:parentId/:childId - the
        // :id segment is unused by the handler but part of the path.
        const res = await app.fetchRaw(
          `/api/entities/${typeSlug}/${parentId}/relationships/${parentId}/${childId}?kind=hierarchy`,
          { method: 'DELETE' });
        if (!res.ok) {
          app.notify('Could not remove it', 'danger');
          return;
        }
        await refreshEntities();
        document.dispatchEvent(new CustomEvent('entity-structure-changed', {
          detail: { typeSlug, parentId, childId },
        }));
        return;
      }

      // Edit icon: the same gesture as double-clicking the row, for anyone who
      // would rather click a visible control than remember the double-click.
      // Shares populate()'s own toggle-close behaviour, so clicking it again
      // on an already-open row closes the editor exactly like a second
      // double-click would.
      const editBtn = e.target.closest('[data-action="edit-row"]');
      if (editBtn) {
        const entity = entities.find(x => x.id == editBtn.dataset.entityId);
        if (entity) {
          const schema = schemaForEntity(entity);
          GenericEntity.populate(entity.id, entity, schema, typeSlug, schema.slug);
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
        // Delegates to deleteEntity rather than repeating it. This block used
        // to be a second copy of that function - same confirm, same request,
        // but nothing about the editor - so the row's bin and the context
        // menu's "Delete" behaved differently, and a fix applied to one did
        // not reach the other. There is one delete now.
        await deleteEntity(actionBtn.dataset.entityId, row?.dataset.isFolder === '1');
        return;
      }

      // A folder's status is a ROLL-UP of what is inside it, not a value of its
      // own - there is nothing to change by clicking it. It carries no
      // data-action for that reason, so a click on it used to fall through to
      // the row and toggle the editor, which is not what aiming at a status
      // means. Cells that show a rolled-up value swallow the click instead.
      if (e.target.closest('.is-rollup')) return;

      // Click on the row itself: select it, and if the editor is already open
      // on something, follow the click into it. There is no double-click any
      // more - it used to be what opened the editor, disambiguated from a
      // plain click's deferred expand/collapse by a timer, but a single click
      // does both jobs now (expand/collapse moved to its own arrow, see
      // [data-action="toggle-expand"] above). Opening the editor from fully
      // closed is still the pencil icon's job, not a plain click's - a click
      // on the list should be safe to make without committing to editing
      // something.
      const row = e.target.closest('.entity-row');
      if (row && !e.target.closest('[data-action]')) {
        if (handleSelectionClick(e, row)) return;   // modifier click: selection only
        const openId = GenericEntity.getCurrentEntityId();
        // Only redirect into a DIFFERENT row. populate() on the row already
        // open toggles it closed (that's what the pencil icon relies on) -
        // without this guard, the second click of an ordinary double-click
        // landed on the row this same handler had just opened a moment
        // earlier, and closed it again right back.
        if (openId != null && String(openId) !== String(row.dataset.entityId)) {
          const entity = entities.find(x => x.id == row.dataset.entityId);
          // A row nested inside a template is of its own type, so edit it
          // with that type's fields - and save it back to that type's
          // endpoint.
          if (entity) {
            const schema = schemaForEntity(entity);
            GenericEntity.populate(entity.id, entity, schema, typeSlug, schema.slug);
          }
        }
      }
    });

    // Notes are the one field that still opens on double-click, in its own
    // small modal rather than the full row editor - the same gesture the
    // Dailies rail uses for the same field.
    listContainer.addEventListener('dblclick', (e) => {
      // Double-clicking the title renames it where it sits. The editor is
      // still the way to change anything else, and still the way to change the
      // title if that is where you already are - this is for the one field you
      // most often want to correct without opening anything. Nothing else on
      // the row claims a double-click (opening the editor stopped being one
      // when expand/collapse moved onto its own arrow), so there is nothing
      // for it to fight with.
      const titleEl = e.target.closest('.entity-cell-title .entity-title');
      if (titleEl) {
        e.preventDefault();
        startInlineRename(titleEl);
        return;
      }

      const notesBtn = e.target.closest('[data-action="edit-notes-field"]');
      if (notesBtn) {
        const entity = entities.find(x => x.id == notesBtn.dataset.entityId);
        openNotesEditor({
          entityId: notesBtn.dataset.entityId,
          fieldKey: notesBtn.dataset.fieldKey,
          fieldType: notesBtn.dataset.fieldType,
          // Field values hang off `fields`, not the entity itself.
          current: entity?.fields?.[notesBtn.dataset.fieldKey] ?? '',
        });
        return;
      }

      // popStickyNote lives in dragDropUtils.js - shared with Dailies (see
      // dailies-list-events.js), which is not a generic tab and shares none
      // of this closure's own state.
      const stickyBtn = e.target.closest('[data-action="pop-sticky"]');
      if (stickyBtn) {
        const entity = entities.find(x => x.id == stickyBtn.dataset.entityId);
        if (entity) popStickyNote(entity.id, schemaForEntity(entity).slug, stickyBtn.dataset.fieldKey, e);
      }
    });

    // Turns a row's title into an editable box in place. Enter or clicking away
    // commits, Escape puts the old text back, and an empty title is refused
    // rather than saved - `title` is required, and a row with no text is a row
    // you cannot find again.
    //
    // The row is draggable, and a draggable ancestor swallows the text
    // selection a caret needs (the browser starts a drag instead of a
    // selection), so dragging is turned off for the duration and restored
    // afterwards - including when the rename is abandoned.
    function startInlineRename(titleEl) {
      if (titleEl.classList.contains('entity-title-editing')) return;
      const row = titleEl.closest('.entity-row');
      const entityId = row?.dataset.entityId;
      if (!entityId) return;

      const original = titleEl.textContent;
      const wasDraggable = row.draggable;
      row.draggable = false;
      titleEl.classList.add('entity-title-editing');
      // plaintext-only keeps a paste from bringing markup in with it. Not every
      // engine has it; 'true' is the fallback, and the trim on commit covers
      // what it lets through.
      try { titleEl.contentEditable = 'plaintext-only'; } catch { /* below */ }
      if (!titleEl.isContentEditable) titleEl.contentEditable = 'true';
      titleEl.spellcheck = false;
      titleEl.focus();

      // The whole title starts selected, so typing replaces it and a click
      // places the caret - what renaming a file does everywhere else.
      const range = document.createRange();
      range.selectNodeContents(titleEl);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);

      let settled = false;
      const finish = async (commit) => {
        if (settled) return;
        settled = true;
        titleEl.removeEventListener('keydown', onKeyDown);
        titleEl.removeEventListener('blur', onBlur);
        titleEl.contentEditable = 'false';
        titleEl.classList.remove('entity-title-editing');
        row.draggable = wasDraggable;
        window.getSelection()?.removeAllRanges();

        const next = titleEl.textContent.replace(/\s+/g, ' ').trim();
        if (!commit || next === '' || next === original) {
          titleEl.textContent = original;
          return;
        }
        await renameEntity(entityId, next, original, titleEl);
      };
      const onKeyDown = (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); finish(true); }
        else if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
      };
      const onBlur = () => finish(true);
      titleEl.addEventListener('keydown', onKeyDown);
      titleEl.addEventListener('blur', onBlur);
    }

    // Optimistic, for the same reason the cell writes are: the new text is
    // already on screen and reverting is cheap. Saves through the row's OWN
    // type, so renaming an idea nested inside a template writes to the idea.
    async function renameEntity(entityId, title, original, titleEl) {
      const entity = entities.find(x => String(x.id) === String(entityId));
      if (entity) {
        entity.title = title;
        GenericEntity.setEntities(entities);
      }
      // The editor is a second view of the same record: if it is open on this
      // row it has to show the new title, WITHOUT counting as an edit - the
      // value is already being saved, and arming Revert would offer to undo
      // something that is not pending. Re-baselining the form is what keeps
      // the next keystroke from diffing against a title that is no longer
      // stored.
      if (String(GenericEntity.getCurrentEntityId()) === String(entityId)) {
        GenericEntity.syncEditorFromRow(entityId, 'title', title);
        GenericEntity.resyncBaseline();
      }

      const saveSlug = (entity && schemaForEntity(entity)?.slug) || typeSlug;
      const response = await app.fetchRaw(`/api/entities/${saveSlug}/${entityId}`, {
        method: 'PUT',

        body: JSON.stringify({ title })
      });
      if (!response.ok) {
        const reason = await response.json().catch(() => null);
        app.notify(`Could not rename it: ${reason?.message || response.status}`, 'danger');
        if (entity) {
          entity.title = original;
          GenericEntity.setEntities(entities);
        }
        titleEl.textContent = original;
        if (String(GenericEntity.getCurrentEntityId()) === String(entityId)) {
          GenericEntity.syncEditorFromRow(entityId, 'title', original);
          GenericEntity.resyncBaseline();
        }
        return;
      }
      // The same record can be on screen elsewhere - listed on its own page
      // while referenced inside a template - so tell the other views.
      document.dispatchEvent(new CustomEvent('entity-saved', {
        detail: { id: Number(entityId), slug: saveSlug }
      }));
    }

    // Writes a single field from a cell control. Only that key is sent, so the
    // item's other values are untouched, and the editor is redirected only if
    // it is already open - a cell click never opens or closes it.
    //
    // OPTIMISTIC, and that is the point of it. Every cell control used to await
    // the PUT and then `await refreshEntities()` - a second and third round
    // trip that re-read every row of the type AND every hierarchy edge - before
    // one cell changed on screen. Nothing appeared to happen until all three
    // landed, so clicking along a row was three requests per click, and on a
    // connection that is not local (or an engine where each statement is its
    // own round trip) that is the difference between instant and unusable.
    //
    // The new value is already known here, so the list repaints from memory
    // first and the write goes out behind it. Roll-ups stay right because
    // renderList() recomputes them from the same in-memory rows. A write that
    // FAILS puts the old value back and says so - which is the one thing an
    // optimistic paint owes you.
    async function saveFieldFromCell(entityId, fieldKey, value, failMessage) {
      const entity = entities.find(x => String(x.id) === String(entityId));
      const before = entity?.fields?.[fieldKey];
      if (entity) {
        (entity.fields ||= {})[fieldKey] = value;
        GenericEntity.setEntities(entities);
        renderList();
      }
      GenericEntity.syncEditorFromRow(entityId, fieldKey, value);
      showRowInOpenEditor(entityId);

      // Saves through the row's OWN type, the same as renameEntity - a row
      // nested here that belongs to a different type must be written to
      // that type's endpoint, not this tab's.
      const saveSlug = (entity && schemaForEntity(entity)?.slug) || typeSlug;
      const response = await app.fetchRaw(`/api/entities/${saveSlug}/${entityId}`, {
        method: 'PUT',

        body: JSON.stringify({ fields: { [fieldKey]: value } })
      });
      if (!response.ok) {
        const reason = await response.json().catch(() => null);
        app.notify(`${failMessage}: ${reason?.message || response.status}`, 'danger');
        if (entity) {
          entity.fields[fieldKey] = before;
          GenericEntity.setEntities(entities);
          renderList();
          GenericEntity.syncEditorFromRow(entityId, fieldKey, before ?? null);
        }
        return false;
      }
      return true;
    }

    // A box to read and write one notes field in, opened from its row glyph.
    //
    // Built here rather than added to every typed tab's markup: the tabs all
    // render from one generic template, so markup added for this would have to
    // be added once and be correct for every type. One element, created on
    // first use and reused after, is the same thing with nothing to keep in
    // sync. Saves through saveFieldFromCell, so a note written here reaches the
    // record by exactly the path every other cell control uses.
    function openNotesEditor({ entityId, fieldKey, fieldType, current }) {
      const mine = fieldType === 'notes';
      let host = document.getElementById('entityNotesEditor');
      if (!host) {
        host = document.createElement('div');
        host.id = 'entityNotesEditor';
        host.className = 'modal fade';
        host.tabIndex = -1;
        host.innerHTML = `
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
              <div class="modal-header border-bottom">
                <h6 class="modal-title mb-0" id="entityNotesEditorTitle"></h6>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <textarea id="entityNotesEditorText" class="form-control" rows="10"></textarea>
              </div>
              <div class="modal-footer border-top">
                <button type="button" class="btn btn-sm btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-sm btn-outline-success" id="entityNotesEditorSave">Save</button>
              </div>
            </div>
          </div>`;
        document.body.appendChild(host);
      }

      host.querySelector('#entityNotesEditorTitle').textContent =
        mine ? 'Notes' : 'Claude Notes';
      const box = host.querySelector('#entityNotesEditorText');
      box.value = current ?? '';
      box.placeholder = mine ? 'Your own notes' : 'Notes written by Claude';

      const modal = bootstrap.Modal.getOrCreateInstance(host);
      const saveBtn = host.querySelector('#entityNotesEditorSave');
      // Replaced rather than added to: the element is reused across every row
      // and both fields, so a listener left behind would save the previous
      // row's field as well as this one.
      const fresh = saveBtn.cloneNode(true);
      saveBtn.replaceWith(fresh);
      fresh.addEventListener('click', async () => {
        const text = box.value;
        modal.hide();
        await saveFieldFromCell(entityId, fieldKey, text === '' ? null : text,
          mine ? 'Could not save the notes' : 'Could not save the Claude notes');
      });
      modal.show();
    }

    // Cell controls (status badge, date picker) never open or close the
    // editor - that would move the very cell being clicked. They only redirect
    // an ALREADY-open editor to the row being touched.
    function showRowInOpenEditor(entityId) {
      if (GenericEntity.getCurrentEntityId() == null) return;
      if (String(GenericEntity.getCurrentEntityId()) === String(entityId)) return;
      const entity = entities.find(x => String(x.id) === String(entityId));
      if (entity) {
        const schema = schemaForEntity(entity);
        GenericEntity.populate(entity.id, entity, schema, typeSlug, schema.slug);
      }
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

      // Title is a pseudo-column: its place among the columns is `title_order`,
      // not a field's display_order, so it is written separately.
      const titleIndex = cols.findIndex(c => c.title);
      if (titleIndex !== -1 && (typeSchema.title_order || 0) !== titleIndex) {
        const res = await app.fetchRaw(`/api/entity-types/${typeSchema.id}`, {
          method: 'PUT', body: JSON.stringify({ title_order: titleIndex })
        });
        if (!res.ok) { app.notify('Could not reorder columns', 'danger'); return; }
        typeSchema.title_order = titleIndex;
      }

      // Renumber EVERY field, not only the visible ones.
      //
      // Hidden fields used to keep whatever display_order they already had
      // while the visible columns were renumbered 0..n-1, so the two sets
      // collided: `priority` ended up holding 1,1,2,2,3,3. Ordering is
      // `ORDER BY display_order, id`, so once values tie the id decides, and
      // the editor's field order became arbitrary - drifting again every time
      // a drag rewrote part of the sequence. It also made
      // scripts/capture-type-defaults.js non-deterministic, which is how a
      // test's column order nearly shipped as the committed defaults.
      //
      // Visible columns take their new order first, then the hidden fields
      // follow in the order they already had. Every value stays unique.
      const visible = cols.filter(c => !c.title);
      const hidden = (typeSchema.fields || [])
        .filter(f => !visible.some(v => v.id === f.id))
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0) || a.id - b.id);

      for (const [i, c] of [...visible, ...hidden].entries()) {
        if ((c.display_order || 0) === i) continue;
        const res = await app.fetchRaw(`/api/entity-types/fields/${c.id}`, {
          method: 'PUT', body: JSON.stringify({ display_order: i })
        });
        if (!res.ok) { app.notify('Could not reorder columns', 'danger'); return; }
        c.display_order = i;   // keep the in-memory schema in step
        const inSchema = (typeSchema.fields || []).find(f => f.id === c.id);
        if (inSchema) inSchema.display_order = i;
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
      await saveFieldFromCell(input.dataset.entityId, input.dataset.fieldKey,
        input.value || null, 'Could not set the date');
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
      // The OPEN entity's own schema, not this tab's - a nested cross-type
      // row (a ServiceNow record inside a Task, say) is a different type, and
      // its field ids do not exist in `typeSchema.fields`. Looking there
      // found nothing, so toggling a nested row's own column visibility
      // silently did nothing at all: the checkbox flipped, nothing saved,
      // and it reverted on the next render.
      const openSchema = GenericEntity.getCurrentSchema() || typeSchema;
      const field = (openSchema.fields || []).find(f => String(f.id) === String(wrap.dataset.fieldId));
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
      wrap.classList.add(dropZone(e, wrap) === 'before' ? 'drop-before' : 'drop-after');
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

      const before = dropZone(e, target) === 'before';
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
    // is_workspace is checked directly, not just inferred from the absence of
    // a self-nesting rule: an install whose workspace tab was created before
    // that rule stopped being written still carries the stale row, and this
    // is the one place left that trusted it instead of the flag itself.
    const canNestOwnType = typeSchema.supports_hierarchy && !typeSchema.is_workspace && hierarchyChildTypeIds.includes(typeSchema.id);
    // Folders are a separate capability from nesting: a template nests freely
    // but has no folders, because the template row is already the container.
    const allowsFolders = typeSchema.supports_hierarchy
      && typeSchema.supports_folders !== 0 && typeSchema.supports_folders !== false;
    const singular = typeSchema.label_singular || typeName;

    // Cross-type children: every OTHER type this type already allows as a
    // hierarchy child - reusing `allowedChildSlugs`, the same set that gates
    // accepting a cross-type drag/drop and fetching `/contents`, so the menu
    // never offers a nesting the app would then refuse. Own-type nesting is
    // the "New <Singular> inside" item above; this is everything else in
    // that same allowed-child set.
    const crossTypeChildTypes = typeSchema.supports_hierarchy
      ? [...allowedChildSlugs]
          .filter(slug => slug !== typeSlug)
          .map(slug => allTypes.find(t => t.slug === slug))
          .filter(Boolean)
      : [];

    // Creates a new entity of a DIFFERENT type and nests it under `parentId`
    // in one step - the menu equivalent of dragging an existing row of that
    // type in from its own tab (handleCrossTypeDrop below), except the row
    // does not exist yet. No editor opens for it: this tab has no editor for
    // another type, same reasoning as the cross-type drop.
    async function createCrossTypeChild(childType, parentId) {
      try {
        const created = await app.fetchRaw(`/api/entities/${childType.slug}`, {
          method: 'POST',
          body: JSON.stringify({ title: `New ${childType.label_singular || childType.label}` }),
        });
        const result = await created.json();
        if (!result.success) {
          app.notify(result.message || 'Could not create it', 'danger');
          return;
        }
        const linked = await app.fetchRaw(`/api/entities/${typeSlug}/${parentId}/relationships`, {
          method: 'POST',
          body: JSON.stringify({
            parentEntityId: parentId, childEntityId: result.data.id, relationshipKind: 'hierarchy',
          }),
        });
        if (!linked.ok) {
          throw new Error((await linked.json().catch(() => ({}))).message || 'Could not nest it there');
        }
        const linkResult = await linked.json();
        localStorage.setItem(`entity-expanded-${parentId}`, 'true');
        // Appended locally rather than a refreshEntities() round trip - both
        // the new row and its relationship edge are already the exact
        // objects the two requests above just returned, so re-fetching the
        // whole type over again just to draw one more nested row was the
        // entire delay between picking a type in "+ Artifact" and it
        // actually showing up.
        entities.push(result.data);
        if (linkResult.data) relationships.push(linkResult.data);
        GenericEntity.setEntities(entities);
        renderList();
        document.dispatchEvent(new CustomEvent('entity-structure-changed', {
          detail: { typeSlug: childType.slug, parentId },
        }));
        app.notify(`Added ${childType.label_singular || childType.label}`, 'success');
      } catch (error) {
        app.notify(error.message || 'Could not create that', 'danger');
      }
    }

    // Dragging a record in from an external ServiceNow browser tab never
    // carries the internal 'type' key beginDrag() sets - it is not this
    // app's drag protocol, just whatever the browser itself puts on a
    // dragged link. looksLikeExternalLinkDrag / externalLinkDropPayload /
    // createServiceNowRecord live in dragDropUtils.js, shared with Dailies'
    // own drop handler (dailies-list-events.js), which needs the identical
    // detection but attaches the result differently (linkChild/putEntityOnDay
    // rather than a hierarchy relationship POST).

    // Same shape as createCrossTypeChild above, for the one type that arrives
    // by drag from OUTSIDE the app rather than a menu pick or another tab.
    async function createServiceNowDrop(payload, parentId) {
      try {
        const created = await createServiceNowRecord(payload);
        if (!created) return; // createServiceNowRecord already notified

        const linked = await app.fetchRaw(`/api/entities/${typeSlug}/${parentId}/relationships`, {
          method: 'POST',
          body: JSON.stringify({
            parentEntityId: parentId, childEntityId: created.id, relationshipKind: 'hierarchy',
          }),
        });
        if (!linked.ok) {
          throw new Error((await linked.json().catch(() => ({}))).message || 'Could not nest it there');
        }
        const linkResult = await linked.json();
        localStorage.setItem(`entity-expanded-${parentId}`, 'true');
        entities.push(created);
        if (linkResult.data) relationships.push(linkResult.data);
        GenericEntity.setEntities(entities);
        renderList();
        document.dispatchEvent(new CustomEvent('entity-structure-changed', {
          detail: { typeSlug: 'servicenow', parentId },
        }));
        app.notify('Added ServiceNow record', 'success');
      } catch (error) {
        app.notify(error.message || 'Could not add that here', 'danger');
      }
    }

    // Which OTHER types this row could legally become, given where it
    // actually sits. A nested row may only become a type its real PARENT
    // already allows as a hierarchy child - the same test the server applies
    // in convertEntityType() - so the menu never offers a move the request
    // would just be refused for. A root-level row (no hierarchy parent) may
    // become any other editable type, since nothing constrains what sits at
    // the top of a type's own list today either.
    function convertTargetTypesFor(entity) {
      if (!entity) return [];

      const parentRel = relationships.find(r => r.child_entity_id === entity.id);
      let allowedTypeIds = null; // null = unconstrained (root-level)
      if (parentRel) {
        const parent = entities.find(x => x.id === parentRel.parent_entity_id);
        const parentType = parent && allTypes.find(t => t.id === parent.entity_type_id);
        if (!parentType) return []; // can't establish legality here - offer nothing
        allowedTypeIds = new Set(
          (parentType.relationships || [])
            .filter(r => r.relationship_kind === 'hierarchy' && r.parent_type_id === parentType.id)
            .map(r => r.child_type_id)
        );
      }

      return allTypes.filter(t => {
        if (t.id === entity.entity_type_id) return false;
        if (t.slug === 'folder') return false; // internal container type, never a real target
        if (t.is_workspace) return false; // an organising space, not a content type
        if ((t.type_category || 'editable') !== 'editable') return false;
        if (entity.is_folder && !t.supports_hierarchy) return false;
        return allowedTypeIds === null || allowedTypeIds.has(t.id);
      });
    }

    // Changes what type the row IS, keeping its id, position and field
    // values (server-side: entityService.convertEntityType). The row then
    // belongs to a different type's tab, so this one closes its editor if it
    // was open on the entity rather than leave it pointed at a record about
    // to disappear from the list.
    async function convertEntity(entity, newType) {
      try {
        const response = await app.fetchRaw(`/api/entities/${typeSlug}/${entity.id}/convert-type`, {
          method: 'PUT',
          body: JSON.stringify({ newTypeSlug: newType.slug }),
        });
        const result = await response.json();
        if (!result.success) {
          app.notify(result.message || 'Could not convert it', 'danger');
          return;
        }
        if (String(GenericEntity.getCurrentEntityId()) === String(entity.id)) {
          GenericEntity.close();
        }
        await refreshEntities();
        document.dispatchEvent(new CustomEvent('entity-structure-changed', {
          detail: { typeSlug: newType.slug, convertedId: entity.id },
        }));
        app.notify(`Converted to ${newType.label_singular || newType.label}`, 'success');
      } catch (error) {
        app.notify(error.message || 'Could not convert it', 'danger');
      }
    }

    let pendingParentId = null; // set when creating something "inside" a row

    // The [data-action="toggle-expand"] arrow's handler goes through here.
    function toggleExpanded(node) {
      if (!node) return;
      node.classList.toggle('expanded');
      localStorage.setItem(`entity-expanded-${node.dataset.entityId}`,
        node.classList.contains('expanded') ? 'true' : 'false');
    }
    let menuEl = null;

    // When the current menu opened, so the scroll that brought its row into view
    // is not mistaken for the user scrolling away from it.
    let menuOpenedAt = 0;

    // Redrawn each time it opens, so a view saved in another tab of the same
    // browser shows up without a reload.
    function renderSavedViews(menu) {
      const list = menu.querySelector('.entity-views-list');
      if (!list) return;
      const views = GenericEntity.readSavedViews(typeSlug);
      list.innerHTML = views.length
        ? views.map(v => `
            <label class="entity-column-option entity-view-option">
              <button type="button" class="entity-view-apply" data-action="apply-view"
                      data-view-name="${escapeAttr(v.name)}">${escapeHtml(v.name)}</button>
              <button type="button" class="entity-view-delete" data-action="delete-view"
                      data-view-name="${escapeAttr(v.name)}" title="Forget this view">&times;</button>
            </label>`).join('')
        : '<div class="text-muted small px-2 py-1">Nothing saved yet</div>';
    }

    // Local copies: this file has no escaping helpers of its own, and a view
    // name is user input that goes straight into markup.
    function escapeHtml(text) {
      return String(text ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    const escapeAttr = escapeHtml;

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
        // A flyout, not a plain button - "Convert to..." is the only caller
        // today. Reuses the same .context-menu-submenu-group / .context-menu-
        // submenu markup and CSS the hand-written Dailies menu already has
        // (dailies.ejs), click-to-toggle rather than hover for the same
        // reason that one is: hover flyouts fire on the mouse PASSING THROUGH
        // on the way to something else.
        if (item.submenu) {
          const group = document.createElement('div');
          group.className = 'context-menu-submenu-group';

          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'context-menu-item has-submenu';
          btn.innerHTML = `<span>${item.icon || ''}</span>`
            + `<span class="${item.labelClass || ''}">${item.label}</span>`
            + '<span style="margin-left:auto;">&rsaquo;</span>';

          const sub = document.createElement('div');
          sub.className = 'context-menu-submenu d-none';
          for (const subItem of item.submenu) {
            const subBtn = document.createElement('button');
            subBtn.type = 'button';
            subBtn.className = 'context-menu-item';
            subBtn.innerHTML = `<span>${subItem.icon || ''}</span>`
              + `<span class="${subItem.labelClass || ''}">${subItem.label}</span>`;
            subBtn.addEventListener('click', async (e) => {
              e.stopPropagation();
              closeContextMenu();
              await subItem.action();
            });
            sub.appendChild(subBtn);
          }

          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const wasHidden = sub.classList.contains('d-none');
            menuEl.querySelectorAll('.context-menu-submenu').forEach(m => m.classList.add('d-none'));
            if (wasHidden) sub.classList.remove('d-none');
          });

          group.appendChild(btn);
          group.appendChild(sub);
          menuEl.appendChild(group);
          continue;
        }
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'context-menu-item';
        btn.innerHTML = `<span>${item.icon || ''}</span>`
          + `<span class="${item.labelClass || ''}">${item.label}</span>`;
        btn.addEventListener('click', async () => {
          closeContextMenu();
          await item.action();
        });
        menuEl.appendChild(btn);
      }
      document.body.appendChild(menuEl);
      menuOpenedAt = Date.now();

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
        // Where to put the editor if the row being deleted is the open one.
        //
        // Closing it was wrong in the same way leaving it open was: the
        // editor's whole job is to show the selected row, and after a delete
        // there is still a selected row - the next one. Worked out BEFORE the
        // refresh, while the deleted row's position is still known; afterwards
        // there is nothing to be "next to".
        const wasOpen =
          String(GenericEntity.getCurrentEntityId()) === String(entityId);
        let successor = null;
        if (wasOpen) {
          // DEDUPED, and with the deleted row removed from the candidates.
          //
          // A row can be in the DOM more than once - the same entity nested
          // under a folder as well as at root - so a raw list contains
          // duplicates, and order[at + 1] then lands on the row being
          // deleted. The editor stayed on the item that had just gone.
          const order = [
            ...new Set(
              Array.from(
                document.querySelectorAll(`#${typeSlug}EntityList [data-entity-id]`),
              ).map((el) => el.dataset.entityId),
            ),
          ];
          const at = order.indexOf(String(entityId));
          const candidates = order.filter((id) => String(id) !== String(entityId));
          if (at !== -1 && candidates.length) {
            // The row that visually takes the deleted one's place: the next
            // surviving row below, else the nearest above.
            successor =
              order.slice(at + 1).find((id) => String(id) !== String(entityId)) ??
              order
                .slice(0, at)
                .reverse()
                .find((id) => String(id) !== String(entityId)) ??
              null;
          }
        }

        app.notify('Deleted', 'success');
        await refreshEntities();
        // Nothing else fires on a plain delete - create/update go through
        // 'entity-saved', reparenting through 'entity-structure-changed' -
        // so the tab-count badge needs telling separately.
        document.dispatchEvent(new CustomEvent('entity-structure-changed', {
          detail: { typeSlug, deletedId: entityId },
        }));

        if (wasOpen) {
          // Deleting the last row leaves nothing to select, so the editor
          // closes - there is no row for it to be showing.
          const entity =
            successor != null && String(successor) !== String(entityId)
              ? entities.find((x) => String(x.id) === String(successor))
              : null;
          if (entity) {
            const successorSchema = schemaForEntity(entity);
            GenericEntity.populate(entity.id, entity, successorSchema, typeSlug, successorSchema.slug, { force: true });
            renderList(); // paint the successor as selected
          } else {
            GenericEntity.close();
          }
        }
      } else {
        app.notify('Error deleting item', 'danger');
      }
    }

    // Which cell controls change value when clicked. Right-clicking one offers
    // the whole set instead of making you click through it - reaching "Failed"
    // from "Not Started" was four clicks and passed through three states that
    // each got saved on the way.
    const VALUE_CELL_ACTIONS = [
      'cycle-status', 'cycle-priority', 'cycle-timebox-field', 'toggle-checkbox', 'set-choice',
      // Two states is still a set. Notes are NOT here: they hold text, not one
      // of a fixed list, so there is nothing for a menu to offer.
      'toggle-claude-field',
    ].map(a => `[data-action="${a}"]`).join(', ');

    // Emoji cells are deliberately NOT in that list: right-clicking one does
    // exactly what left-clicking does (cycle the set, or open the picker).
    const EMOJI_CELL_ACTIONS = '[data-action="cycle-emoji"], [data-action="pick-emoji-cell"]';

    function valueCellMenuItems(control) {
      const fieldKey = control.dataset.fieldKey;
      const entityId = Number(control.dataset.entityId);
      const menuEntity = entities.find(x => x.id === entityId);
      const menuSchema = menuEntity ? schemaForEntity(menuEntity) : typeSchema;
      const field = (menuSchema.fields || []).find(f => f.field_key === fieldKey);
      const choices = GenericEntity.cellChoices(field);
      if (!field || !entityId || !choices?.length) return [];

      // What the cell holds now, read from whichever attribute it publishes.
      const d = control.dataset;
      // Each cell publishes its value under a different attribute: the checkbox
      // as data-value '1'/'0', status as data-status, priority as data-priority,
      // and a <select> only through its own .value.
      const current = field.field_type === 'checkbox' ? d.value === '1'
        : field.field_type === 'timebox' ? (d.value ?? '')
        : field.field_type === 'status' ? (d.status ?? '')
        : field.field_type === 'priority' ? (d.priority ?? '')
        : (d.value ?? control.value ?? '');

      // With rows multi-selected, the menu acts on ALL of them if the one you
      // opened it from is part of that selection. Setting fifteen rows to
      // Complete one at a time is the kind of thing multi-select exists for,
      // and this needs no new UI to say so - the count in the label does.
      // selectedIds holds row.dataset.entityId - STRINGS - while this reads the
      // same attribute through Number(). A Set of strings never `has` a number,
      // so the bulk path silently never triggered.
      const selected = selectedIds.has(String(entityId)) && selectedIds.size > 1;
      const targets = selected ? [...selectedIds] : [entityId];
      const suffix = targets.length > 1 ? `  (${targets.length} rows)` : '';

      return choices.map(v => ({
        icon: String(v) === String(current) ? '✓' : '\u00a0',
        label: GenericEntity.choiceLabel(field, v) + suffix,
        // Statuses carry their state colour here too - a menu of them should
        // read the same as the cell it was opened from.
        labelClass: GenericEntity.choiceClass(field, v),
        action: async () => {
          for (const id of targets) {
            await saveFieldFromCell(id, fieldKey, v === '' ? null : v,
              `Could not change ${field.label}`);
          }
        },
      }));
    }

    listContainer.addEventListener('contextmenu', (e) => {
      const row = e.target.closest('.entity-row');
      e.preventDefault();

      const emojiCell = e.target.closest(EMOJI_CELL_ACTIONS);
      if (emojiCell) { emojiCell.click(); return; }

      // A value cell answers for itself before the row's own menu is offered.
      const valueCell = e.target.closest(VALUE_CELL_ACTIONS);
      if (valueCell) {
        const items = valueCellMenuItems(valueCell);
        if (items.length) { openContextMenu(e.clientX, e.clientY, items); return; }
      }

      if (!row) {
        // Empty space: create at the top level. A workspace tab has no
        // content of its own - same reasoning as the toolbar's "+ <Tab>"
        // button above - so only folders belong here, not a native row.
        const items = typeSchema.is_workspace ? [] : [{ icon: '➕', label: `New ${singular}`, action: () => startCreate() }];
        if (allowsFolders) {
          items.push({ icon: '📁', label: 'New Folder', action: () => startCreate({ isFolder: true }) });
        }
        openContextMenu(e.clientX, e.clientY, items);
        return;
      }

      const entityId = Number(row.dataset.entityId);
      const isFolder = row.dataset.isFolder === '1';
      const entity = entities.find(x => x.id === entityId);

      // Right-clicking selects the row it is aimed at, so the menu that opens
      // visibly belongs to something. Without this you could act on a row while
      // a different one stayed highlighted.
      // No renderList() here. populate() repaints the selection itself, and a
      // re-render resets the list's scrollTop - the scroll event that follows
      // is delivered asynchronously, so it arrived AFTER the menu had opened
      // and the scroll handler closed it again. The menu appeared empty.
      if (entity && String(GenericEntity.getCurrentEntityId()) !== String(entityId)) {
        GenericEntity.populate(entity.id, entity, typeSchema, typeSlug);
      }

      const items = [];

      // Every creatable type this row can hold - its own type plus whatever
      // cross-type children it allows - under one "+ Artifact" flyout rather
      // than each as its own top-level entry. A type with several allowed
      // children used to list "New Category inside", "New Goal inside",
      // "New Azure DevOps Work Item inside" ... as separate rows before
      // Edit/Delete even appeared; folding them into a submenu is the same
      // fix "Convert to..." already got for the same reason.
      const artifactOptions = [];
      if (canNestOwnType) {
        artifactOptions.push({ icon: '➕', label: `New ${singular}`, action: () => startCreate({ parentId: entityId }) });
      }
      for (const childType of crossTypeChildTypes) {
        artifactOptions.push({
          icon: childType.icon || '➕',
          label: `New ${childType.label_singular || childType.label}`,
          action: () => createCrossTypeChild(childType, entityId),
        });
      }
      if (artifactOptions.length > 0) {
        items.push({ icon: '➕', label: 'Artifact', submenu: artifactOptions });
      }
      // Folders stay a separate, top-level entry - a folder organises rows of
      // this row's own type, it is not itself one of the creatable "artifact"
      // types the submenu above lists.
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

      const convertTargets = entity ? convertTargetTypesFor(entity) : [];
      if (convertTargets.length > 0) {
        items.push({ separator: true });
        items.push({
          icon: '🔄',
          label: 'Convert to...',
          submenu: convertTargets.map(t => ({
            icon: t.icon || '',
            label: t.label_singular || t.label,
            action: () => convertEntity(entity, t),
          })),
        });
      }
      // Folders can be pinned as well: "the thing I am working on" is often a
      // whole folder of work, and refusing it was a judgement about how someone
      // should work rather than a limit of the feature.
      //
      // Templates cannot: a template is a pattern you stamp out, not work you
      // do. The server refuses it too - this only keeps the menu honest.
      if (window.FocusBar && typeSlug !== 'template') {
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
    // Scrolling dismisses the menu, because it is positioned in viewport
    // coordinates and would otherwise sit where the row no longer is.
    //
    // But scroll events are delivered ASYNCHRONOUSLY: bringing a row into view
    // and right-clicking it delivers that scroll AFTER the menu has opened, so
    // the menu was dismissed the instant it appeared - reliably, for any row
    // far enough down the list to need scrolling to reach.
    window.addEventListener('scroll', () => {
      if (Date.now() - menuOpenedAt < 350) return;   // the scroll that got us here
      closeContextMenu();
    }, true);

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
    // Which row+zone currently carries the indicator, so a dragover that
    // lands on the exact same spot as the last one is a no-op. `dragover`
    // fires continuously while the pointer sits still (and on every pixel of
    // movement besides), so without this every one of those ticks re-scanned
    // the whole list and re-toggled classes it had just set a moment before -
    // fighting `.entity-row`'s own `transition: background-color 0.2s` into
    // restarting on every tick, which is what made the indicator look like it
    // was flickering/chasing the cursor rather than sitting still under it.
    let lastHoverKey = null;
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

        row.classList.add('entity-row-dragging');

        // A small dark pill naming the row, in place of the browser's default
        // drag image - a semi-transparent screenshot of the row as it looked
        // at that instant, anchored wherever the cursor happened to grab it,
        // which on a wide table routinely showed half a row cut off rather
        // than anything recognisable. Built fresh per drag and removed again
        // once the browser has captured it (setDragImage only needs the node
        // to exist for a single paint).
        const ghost = document.createElement('div');
        ghost.className = 'entity-drag-ghost';
        ghost.textContent = entity?.title || 'Untitled';
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 12, 16);
        setTimeout(() => ghost.remove(), 0);
      }
    });

    listContainer.addEventListener('dragend', (e) => {
      const row = e.target.closest('.entity-row');
      if (row) row.classList.remove('entity-row-dragging');
      draggedEntityId = null;
      lastHoverKey = null;
    });

    // Drop zone within a row: top/bottom band = reorder as a sibling
    // before/after that row; middle band (hierarchy types only) = nest as
    // its child - the tree drag-drop pattern the per-type pages used before
    // they were replaced by this engine.
    // The geometry lives in dragDropUtils.js with the rest of the drag protocol
    // (finding 05); this only says which shape THIS list is.
    function dropZoneFor(e, row) {
      return dropZone(e, row, { nesting: !!typeSchema.supports_hierarchy });
    }

    // NOT clearDropIndicators(row) from dragDropUtils.js - that function's
    // `root` parameter is searched with querySelectorAll, so passing a ROW as
    // root looks for the indicator classes among the row's DESCENDANTS. They
    // live on the row itself, so that call was always a no-op here: every
    // dragover in a same-list drag called this once per row via
    // `.forEach(clearDropIndicator)` and never actually removed a
    // before/after line from any of them. Moving the pointer from one row to
    // another, or from the top band of a row to the bottom, left the stale
    // line behind AND drew the new one - multiple indicators on screen at
    // once, which is exactly what "the drag looks broken" looks like.
    function clearDropIndicator(row) {
      row.classList.remove('drop-indicator-before', 'drop-indicator-after', 'entity-drop-target-nest');
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

      try {
        let childId = droppedId;
        if (choice === 'copy') {
          const cloned = await app.fetchRaw(`/api/entities/${childSlug}/${droppedId}/clone`, {
            method: 'POST' });
          const cloneResult = await cloned.json();
          if (!cloneResult.success) throw new Error(cloneResult.message);
          childId = cloneResult.data.id;
        }
        // Must be dropped INTO a row. This used to invent a container when you
        // dropped on empty space - drag an Idea at the Templates list and you
        // got a new template named after the idea - which made templates appear
        // by accident and meant the list filled up with one-item templates.
        //
        // A template is made deliberately with "+ Template", the way a folder
        // is, and then things are dropped into it; the template itself is the
        // reusable thing you drop onto a day.
        const parentId = targetRow ? Number(targetRow.dataset.entityId) : null;
        if (!parentId) {
          app.notify(`Drop it onto a ${singular.toLowerCase()} - use "+ ${singular}" to make one first`, 'info');
          return;
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

    // A type only accepts an external ServiceNow drag if it already allows a
    // servicenow row as a hierarchy child - the same rule that gates the
    // "+ Artifact" menu's own ServiceNow entry, so a drop never succeeds
    // somewhere the menu would have refused it.
    const acceptsServiceNowDrop = allowedChildSlugs.has('servicenow');

    dropPane.addEventListener('dragenter', (e) => {
      if (draggedEntityId) return;
      if (e.dataTransfer?.types?.includes('type')) { e.preventDefault(); return; }
      if (acceptsServiceNowDrop && looksLikeExternalLinkDrag(e.dataTransfer)) e.preventDefault();
    });

    // Cross-type drags are accepted across the whole pane; same-list reordering
    // stays on the list itself, where the row geometry it needs lives.
    dropPane.addEventListener('dragover', (e) => {
      if (draggedEntityId) return;
      const isInternal = e.dataTransfer?.types?.includes('type');
      if (!isInternal && !(acceptsServiceNowDrop && looksLikeExternalLinkDrag(e.dataTransfer))) return;
      acceptDrop(e, 'copy');
      const row = e.target.closest('.entity-row');
      listContainer.querySelectorAll('.entity-row').forEach(clearDropIndicator);
      if (row) row.classList.add('entity-drop-target-nest');
      else dropPane.classList.add('entity-list-drop-target');
    });

    dropPane.addEventListener('drop', async (e) => {
      if (draggedEntityId) return;
      const isInternal = e.dataTransfer?.types?.includes('type');
      if (!isInternal && !(acceptsServiceNowDrop && looksLikeExternalLinkDrag(e.dataTransfer))) return;
      e.preventDefault();
      dropPane.classList.remove('entity-list-drop-target');
      listContainer.querySelectorAll('.entity-row').forEach(clearDropIndicator);
      if (!isInternal) {
        const payload = externalLinkDropPayload(e.dataTransfer);
        if (!payload) { app.notify("Couldn't read anything usable from that drop", 'info'); return; }
        const row = e.target.closest('.entity-row');
        const parentId = row ? Number(row.dataset.entityId) : null;
        if (!parentId) {
          app.notify(`Drop it onto a ${singular.toLowerCase()} - use "+ ${singular}" to make one first`, 'info');
          return;
        }
        await createServiceNowDrop(payload, parentId);
        return;
      }
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
        const zone = dropZoneFor(e, row);
        const hoverKey = `${row.dataset.entityId}:${zone}`;
        // The indicator classes are already exactly right for this spot -
        // dragover must still call acceptDrop() below on every tick (that's
        // what keeps the browser willing to fire `drop` at all), but redoing
        // the class churn for a spot that hasn't changed is what produced the
        // flicker.
        if (hoverKey !== lastHoverKey) {
          lastHoverKey = hoverKey;
          listContainer.querySelectorAll('.entity-row').forEach(clearDropIndicator);
          if (zone === 'nest') {
            row.classList.add('entity-drop-target-nest');
          } else {
            row.classList.add(zone === 'before' ? 'drop-indicator-before' : 'drop-indicator-after');
          }
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
      lastHoverKey = null;
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
        // A reference IS the record, so its position and its parentage are
        // shared state. Anywhere else showing it - a template, a day, the
        // board - has to hear about the move or it keeps drawing the old tree.
        document.dispatchEvent(new CustomEvent('entity-structure-changed', {
          detail: { typeSlug, childId: sourceId, parentId: targetId },
        }));
      } catch (error) {
        console.error('Error moving entity:', error);
        app.notify(error.message || 'Error moving entity', 'danger');
      }
    });

    // There is no Save button - genericEntity.js debounces a save after every
    // change and fires 'entity-autosave-due' when one is due, whether that is
    // the debounce timer, a switch to another record, or the editor closing.
    // This is that same save, just no longer behind a click.
    const performAutoSave = async () => {
      try {
        // Null before the save means this was a create, not an edit.
        const wasCreate = GenericEntity.getCurrentEntityId() === null;
        const saved = await GenericEntity.save();
        // No "Saved" toast - autosave fires often enough (every debounced
        // change) that one would be constant noise. A failure still notifies,
        // in the catch below, since that's the one autosave outcome worth
        // interrupting for.

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
        // saved, with Revert disabled because there is nothing left to
        // discard. It re-enables on the next edit.
        if (wasCreate && saved?.id) {
          // Still reachable from paths that open the editor on an unsaved
          // blank (the context menu's "New ... inside"). No longer closes
          // first: populate takes force, so the editor stays on screen
          // throughout instead of blinking shut and open again.
          await refreshEntities();
          GenericEntity.populate(saved.id, saved, typeSchema, typeSlug, undefined, { force: true });
          // Same as createAndOpen(): refreshEntities() has already rendered,
          // and populate() marks the row selected without rebuilding the list.
        } else {
          // markSaved BEFORE the refresh, not after. refreshEntities() is a
          // round trip, and any edit made while it was in flight had already
          // re-armed Revert - then this landed and disabled it again, with
          // nothing left to re-enable it.
          GenericEntity.markSaved();
          await refreshEntities();
        }
      } catch (error) {
        app.notify(error.message, 'danger');
      }
    };

    document.addEventListener('entity-autosave-due', (e) => {
      if (e.detail?.typeSlug !== typeSlug) return;
      performAutoSave();
    });

    // Revert, not Cancel: it throws away the edits and reloads the record as
    // stored. The editor stays open on it - closing is done by clicking the
    // row again, the same gesture that opened it.
    document.getElementById(`${typeSlug}CloseBtn`)?.addEventListener('click', async () => {
      // Must run before reading getCurrentEntityId()/close()/populate() below -
      // it clears hasChanges so none of them mistake this discard for a
      // record switch and autosave the very thing Revert is throwing away.
      GenericEntity.discardChanges();
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
        folderBtn.addEventListener('click', () => createAndOpen({ is_folder: true }));
      } else {
        folderBtn.remove();
      }
    }

    // Add new entity.
    //
    // The row is CREATED immediately, rather than the editor opening on an
    // unsaved blank. Two things follow from that and both were the point:
    // the new row appears in the list straight away and can be seen to be
    // selected, and every subsequent Save is an EDIT - so the editor stays
    // put instead of closing and reopening, which is what the create-save
    // path had to do to get around populate()'s toggle.
    //
    // A title is required by the server, so the row is created with the
    // type's own name as a placeholder and the title box is selected, so
    // typing replaces it.
    async function createAndOpen(extra = {}) {
      try {
        const response = await app.fetchRaw(`/api/entities/${typeSlug}`, {
          method: 'POST',
          // label_singular, not the tab's label - "New Projects" for one
          // project reads as a mistake, because it is one.
          body: JSON.stringify({
            title: `New ${extra.is_folder ? 'Folder' : typeSchema.label_singular || typeName}`,
            ...extra,
          }),
        });
        const result = await response.json();
        if (!result.success) {
          app.notify(result.message || 'Could not create it', 'danger');
          return;
        }

        // Appended locally rather than a refreshEntities() round trip - the
        // POST above already returned the complete row (entityService's
        // createEntity reads it back via getEntityById), so re-fetching every
        // OTHER row of the type just to draw this one was the entire visible
        // delay between clicking "+ <Type>" and anything appearing. On a
        // 127-row type that delay was seconds, not the "immediate" a create
        // button should be.
        entities.push(result.data);
        GenericEntity.setEntities(entities);
        renderList();
        // force: this may be the id the editor already holds (create, delete,
        // create again reuses nothing, but a reopened editor might), and
        // without it populate would read the request as "close".
        GenericEntity.populate(result.data.id, result.data, typeSchema, typeSlug, undefined, { force: true });
        document.dispatchEvent(new CustomEvent('entity-structure-changed', {
          detail: { typeSlug, createdId: result.data.id },
        }));

        // Select the placeholder rather than clearing it: the row already
        // exists and needs SOME title, so leaving the box empty would save an
        // untitled row the moment anything else changed.
        const titleInput = document
          .getElementById(`${typeSlug}-editor-pane`)
          ?.querySelector('input[name="title"]');
        if (titleInput) {
          titleInput.focus();
          titleInput.select();
        }
      } catch (error) {
        console.error(`Error creating ${typeSlug}:`, error);
        app.notify('Could not create it', 'danger');
      }
    }

    // A workspace tab is a container, not a content type - "+ <Tab>" would
    // create a native row of the tab's own type, which is exactly what
    // is_workspace exists to rule out. Only "+ Folder" and rows of OTHER
    // types (drag, or the row context menu's "+ Artifact") belong here.
    const addOwnTypeBtn = document.getElementById(`add${typeSlug}Btn`);
    if (addOwnTypeBtn) {
      if (typeSchema.is_workspace) {
        addOwnTypeBtn.remove();
      } else {
        addOwnTypeBtn.addEventListener('click', () => createAndOpen());
      }
    }

  } catch (error) {
    console.error(`Error initializing ${typeSlug} tab:`, error);
    const container = document.getElementById(`${typeSlug}EntityList`);
    if (container) {
      container.innerHTML = `<div class="alert alert-danger">Error loading ${typeName}: ${error.message}</div>`;
    }
  }
}
