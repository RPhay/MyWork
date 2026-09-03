// Settings - Manage Entity Types

async function loadEntityTypesUI() {
  try {
    const response = await fetch('/api/entity-types');
    const result = await response.json();

    if (result.success && result.data && result.data.length > 0) {
      // Separate types by category, then split editable types again by
      // is_system - built-in (seeded) types can have their fields edited
      // like any other, but softDeleteEntityType() refuses to delete one, so
      // they read as a different kind of thing from a type someone typed
      // "New Type" and made themselves.
      // Custom Tabs (is_workspace) are a third split, not a fourth category -
      // they are still type_category 'editable', is_system false, exactly
      // like a custom type. What sets a tab apart is is_workspace: no fields
      // of its own, and it holds rows of any OTHER editable type instead.
      const editableTypes = result.data.filter(t => t.type_category === 'editable' || !t.type_category);
      const readonlyTypes = result.data.filter(t => t.type_category !== 'editable' && t.type_category);
      const builtInTypes = editableTypes.filter(t => t.is_system);
      const customTypes = editableTypes.filter(t => !t.is_system && !t.is_workspace);
      const customTabs = editableTypes.filter(t => !t.is_system && t.is_workspace);

      // All three lists' elements, resolved once - initTypeReordering() on
      // any one of them needs to read the OTHERS' current order too (see the
      // comment on that function), not just the list a drop happened in.
      const builtInList = document.getElementById('builtInTypesList');
      const customList = document.getElementById('customTypesList');
      const customTabsList = document.getElementById('customTabsList');
      const allLists = [builtInList, customList, customTabsList].filter(Boolean);

      const renderList = (list, types, emptyMessage) => {
        if (!list) return;
        if (types.length > 0) {
          list.innerHTML = '';
          types.forEach(type => list.appendChild(createTypeListItem(type, false)));
          initTypeReordering(list, allLists);
        } else {
          list.innerHTML = `<div class="p-4 text-center text-muted">${emptyMessage}</div>`;
        }
      };
      renderList(builtInList, builtInTypes, 'No built-in types.');
      renderList(customList, customTypes, 'No custom types yet. Create one to get started.');
      renderList(customTabsList, customTabs, 'No custom tabs yet. Create one to get started.');

      // Render readonly types
      const readonlyList = document.getElementById('readonlyTypesList');
      if (readonlyList) {
        if (readonlyTypes.length > 0) {
          readonlyList.innerHTML = '';
          readonlyTypes.forEach(type => {
            readonlyList.appendChild(createTypeListItem(type, true));
          });
        } else {
          readonlyList.innerHTML = '<div class="p-4 text-center text-muted">No templates or special types yet.</div>';
        }
      }
    }
  } catch (error) {
    console.error('Error loading entity types:', error);
    for (const elId of ['builtInTypesList', 'customTypesList', 'customTabsList', 'readonlyTypesList']) {
      const list = document.getElementById(elId);
      if (list) list.innerHTML = '<div class="p-4 text-center text-danger">Error loading types</div>';
    }
  } finally {
    syncTypeRowSelection();
  }
}

// Marks the row of whatever the editor currently has open. Called on open, on
// close, and after the lists re-render, which rebuilds every row from scratch.
function syncTypeRowSelection() {
  const id = currentEditingType?.id;
  const row =
    id != null
      ? document.querySelector(`.type-list-item[data-type-id="${id}"]`)
      : null;
  app.selectRow(row, '.type-list-item');
}

function createTypeListItem(type, isReadonly) {
  const item = document.createElement('div');
  item.className = `type-list-item ${isReadonly ? 'readonly' : ''}`;
  item.dataset.typeId = type.id;

  let categoryBadge = '';
  if (type.type_category && type.type_category !== 'editable') {
    categoryBadge = `<span class="type-badge ${type.type_category}">${type.type_category}</span>`;
  }

  // Editable types are draggable: their order here is entity_types.order_index,
  // which is also the dashboard's tab order.
  if (!isReadonly) {
    item.draggable = true;
    item.dataset.typeId = type.id;
  }

  const isVisible = type.is_visible === undefined || !!type.is_visible;

  item.innerHTML = `
    <div class="type-list-item-left">
      ${!isReadonly ? '<span class="type-drag-handle" title="Drag to reorder. This is the order the tabs appear in on the main page.">⋮⋮</span>' : ''}
      <div class="type-icon">${type.icon || '📄'}</div>
      <div class="type-info">
        <h6 class="mb-0">${type.label}${categoryBadge}</h6>
        <small><span class="badge bg-secondary">${type.slug}</span></small>
        <small class="d-block mt-1">
          ${type.is_workspace
            ? 'Holds rows of any other type'
            : `${type.fields?.length || 0} fields${type.supports_hierarchy ? ' • Supports hierarchy' : ''}`}
        </small>
      </div>
    </div>
    <div class="type-list-item-right">
      ${!isReadonly ? `
        <div class="form-check form-switch me-3" title="Show or hide this type&apos;s tab on the main page. Hiding a type keeps its records - it just stops showing the tab.">
          <input class="form-check-input type-visible-toggle" type="checkbox" ${isVisible ? 'checked' : ''}>
          <label class="form-check-label small text-muted">${isVisible ? 'Enabled' : 'Disabled'}</label>
        </div>
      ` : `
        <span class="text-muted me-3" style="font-size: 0.9em;">Read-only</span>
      `}
      <!-- Read-only describes whether you can EDIT the type here, not whether
           its settings can be put back. A read-only type still has an icon, a
           label and fields that can drift, so it gets the same button. -->
      <button type="button" class="btn btn-sm btn-outline-secondary type-revert-btn me-2"
              title="Put this type's icon, labels and field settings back to the saved defaults. Records are not touched, and fields the defaults do not know about are left alone.">
        <i class="bi bi-arrow-counterclockwise"></i>
      </button>
    </div>
  `;

  if (!isReadonly) {
    // The toggle and the drag handle must not also open the editor.
    item.querySelector('.type-visible-toggle')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const enabled = e.target.checked;
      const label = e.target.parentElement.querySelector('.form-check-label');
      if (label) label.textContent = enabled ? 'Enabled' : 'Disabled';
      try {
        const response = await app.fetchRaw(`/api/entity-types/${type.id}`, {
          method: 'PUT',
          
          body: JSON.stringify({ is_visible: enabled }) });
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        app.notify(`${type.label} ${enabled ? 'enabled' : 'disabled'}`, 'success');
      } catch (error) {
        e.target.checked = !enabled;
        if (label) label.textContent = !enabled ? 'Enabled' : 'Disabled';
        app.notify(error.message || 'Could not change visibility', 'danger');
      }
    });

  }

  // Outside the block above on purpose: a read-only type opens the editor too.
  // Being unable to CHANGE a type is not a reason to be unable to LOOK at it -
  // its fields, its icon and its labels are worth reading, and until now the
  // only way to see them was the API. The editor disables itself for these; see
  // applyReadOnly in entity-type-editor.js.
  item.addEventListener('click', (e) => {
    if (e.target.closest('.type-visible-toggle, .type-drag-handle, .type-revert-btn')) return;
    window.openEntityTypeEditor(type.id);
  });

  // Outside the block above on purpose: read-only types get this too.
  item.querySelector('.type-revert-btn')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const btn = e.currentTarget;

    // Says what it does AND what it does not, because "revert" is the kind of
    // word people reasonably expect to destroy something.
    const ok = await app.confirm(
      'This puts the icon, labels and field settings back to the saved defaults. '
      + 'Your records are not touched, and any field the defaults do not know '
      + 'about is left exactly as it is.',
      `Revert ${type.label} to defaults?`
    );
    if (!ok) return;

    btn.disabled = true;
    try {
      const result = await app.fetch(`/api/entity-types/${type.id}/revert`, { method: 'POST' });
      app.notify(result.message || `${type.label} reverted`, 'success');
      await loadEntityTypesUI();
    } catch (error) {
      app.notify(error.message || 'Could not revert this type', 'danger');
    } finally {
      btn.disabled = false;
    }
  });

  return item;
}

// Drag to reorder editable types. Persists entity_types.order_index, which the
// dashboard reads to order its tabs - so this list and the tab bar stay in
// sync in both directions.
//
// order_index is ONE sequence shared by every editable type, built-in and
// custom alike - reorderEntityTypes() sets it to the given array's position
// (0, 1, 2, ...) for exactly the ids it is given, and leaves every other type
// untouched. Built-in and Custom are two separate lists on screen, but a drop
// in EITHER one has to submit the position of EVERY editable type, or the
// list just dragged in would renumber itself 0..N and collide with whatever
// the OTHER list already holds at those same numbers - two types tied for
// order_index 0 is not "unsorted", it is silently wrong, and which of them
// the dashboard tab bar puts first becomes an id tie-break nobody chose.
// Concatenating both lists' current DOM order keeps one one consistent
// sequence and, as a side effect, keeps built-ins sorted ahead of customs in
// the tab bar - which is also the more predictable result to look at here.
function initTypeReordering(listEl, allLists) {
  let dragged = null;

  const orderedIdsAcrossLists = () => allLists.flatMap((el) =>
    [...el.querySelectorAll('.type-list-item[draggable="true"]')].map((item) => Number(item.dataset.typeId))
  );

  listEl.addEventListener('dragstart', (e) => {
    dragged = e.target.closest('.type-list-item[draggable="true"]');
    if (dragged) {
      e.dataTransfer.effectAllowed = DRAG_EFFECT_ALLOWED;
      dragged.style.opacity = '0.5';
    }
  });

  listEl.addEventListener('dragend', () => {
    if (dragged) dragged.style.opacity = '1';
    dragged = null;
  });

  listEl.addEventListener('dragover', (e) => {
    if (!dragged) return;
    e.preventDefault();
    const target = e.target.closest('.type-list-item[draggable="true"]');
    if (!target || target === dragged) return;
    const box = target.getBoundingClientRect();
    const after = (e.clientY - box.top) > box.height / 2;
    listEl.insertBefore(dragged, after ? target.nextSibling : target);
  });

  listEl.addEventListener('drop', async (e) => {
    e.preventDefault();
    const orderedIds = orderedIdsAcrossLists();
    try {
      const response = await app.fetchRaw('/api/entity-types/reorder', {
        method: 'PATCH',

        body: JSON.stringify({ orderedIds }) });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);
      app.notify('Tab order updated', 'success');
    } catch (error) {
      app.notify(error.message || 'Could not save the new order', 'danger');
      loadEntityTypesUI();
    }
  });
}

function initEntityTypesTab() {
  // The editor lives in the right-hand pane of this tab's split view.
  if (typeof initEntityTypeSplitPane === 'function') initEntityTypeSplitPane();

  const createBtn = document.getElementById('createNewTypeBtn');
  if (createBtn) {
    createBtn.addEventListener('click', () => window.openEntityTypeEditor());
  }

  const createTabBtn = document.getElementById('createNewTabBtn');
  if (createTabBtn) {
    createTabBtn.addEventListener('click', () => window.openEntityTypeEditor(null, { workspace: true }));
  }

  const revertAllBtn = document.getElementById('revertAllTypesBtn');
  if (revertAllBtn) {
    revertAllBtn.addEventListener('click', async () => {
      const ok = await app.confirm(
        'Every type gets its icon, labels and field settings put back to the saved '
        + 'defaults. Your records are not touched, and any field the defaults do not '
        + 'know about is left exactly as it is.',
        'Restore all types to defaults?'
      );
      if (!ok) return;

      revertAllBtn.disabled = true;
      const original = revertAllBtn.innerHTML;
      revertAllBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Restoring...';
      try {
        const data = await app.fetchData('/api/entity-types/revert-all', { method: 'POST' });
        await loadEntityTypesUI();

        // Report per type rather than a single number: "restored 11" hides that
        // two were skipped for having no defaults, which is the thing worth
        // knowing.
        const lines = [`Restored ${data.reverted.length} type(s).`];
        if (data.skipped.length) {
          lines.push('', 'Skipped (no saved defaults - created after the last capture):');
          for (const s of data.skipped) lines.push(`  • ${s.label || s.slug}`);
        }
        const withExtras = data.reverted.filter(r => r.extra.length);
        if (withExtras.length) {
          lines.push('', 'Left alone because the defaults do not list them:');
          for (const r of withExtras) lines.push(`  • ${r.label}: ${r.extra.join(', ')}`);
        }
        if (data.failed.length) {
          lines.push('', 'Failed:');
          for (const f of data.failed) lines.push(`  • ${f.label || f.slug}: ${f.error}`);
        }

        await app.alert(lines.join('\n'), 'Restore complete');
      } catch (error) {
        app.notify(error.message || 'Could not restore types', 'danger');
      } finally {
        revertAllBtn.disabled = false;
        revertAllBtn.innerHTML = original;
      }
    });
  }

  loadEntityTypesUI();
}

// Initialize when ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEntityTypesTab);
} else {
  initEntityTypesTab();
}
