// Settings - Manage Entity Types

async function loadEntityTypesUI() {
  try {
    const response = await fetch('/api/entity-types');
    const result = await response.json();

    if (result.success && result.data && result.data.length > 0) {
      // Separate types by category
      const editableTypes = result.data.filter(t => t.type_category === 'editable' || !t.type_category);
      const readonlyTypes = result.data.filter(t => t.type_category !== 'editable' && t.type_category);

      // Render editable types
      const editableList = document.getElementById('editableTypesList');
      if (editableList) {
        if (editableTypes.length > 0) {
          editableList.innerHTML = '';
          editableTypes.forEach(type => {
            editableList.appendChild(createTypeListItem(type, false));
          });
          initTypeReordering(editableList);
        } else {
          editableList.innerHTML = '<div class="p-4 text-center text-muted">No editable types. Create one to get started.</div>';
        }
      }

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
    const editableList = document.getElementById('editableTypesList');
    if (editableList) {
      editableList.innerHTML = '<div class="p-4 text-center text-danger">Error loading types</div>';
    }
    const readonlyList = document.getElementById('readonlyTypesList');
    if (readonlyList) {
      readonlyList.innerHTML = '<div class="p-4 text-center text-danger">Error loading types</div>';
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
          ${type.fields?.length || 0} fields
          ${type.supports_hierarchy ? ' • Supports hierarchy' : ''}
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
        <span class="text-muted" style="font-size: 0.9em;">Read-only</span>
      `}
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

    item.addEventListener('click', (e) => {
      if (e.target.closest('.type-visible-toggle, .type-drag-handle')) return;
      window.openEntityTypeEditor(type.id);
    });
  }

  return item;
}

// Drag to reorder editable types. Persists entity_types.order_index, which the
// dashboard reads to order its tabs - so this list and the tab bar stay in sync
// in both directions.
function initTypeReordering(listEl) {
  let dragged = null;

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
    const orderedIds = [...listEl.querySelectorAll('.type-list-item[draggable="true"]')]
      .map(el => Number(el.dataset.typeId));
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

  loadEntityTypesUI();
}

// Initialize when ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEntityTypesTab);
} else {
  initEntityTypesTab();
}
