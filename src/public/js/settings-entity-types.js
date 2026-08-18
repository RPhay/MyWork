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
  }
}

function createTypeListItem(type, isReadonly) {
  const item = document.createElement('div');
  item.className = `type-list-item ${isReadonly ? 'readonly' : ''}`;

  let categoryBadge = '';
  if (type.type_category && type.type_category !== 'editable') {
    categoryBadge = `<span class="type-badge ${type.type_category}">${type.type_category}</span>`;
  }

  item.innerHTML = `
    <div class="type-list-item-left">
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
        <button class="btn btn-sm btn-outline-primary type-edit-btn" title="Edit type">
          <i class="bi bi-pencil"></i> Edit
        </button>
      ` : `
        <span class="text-muted" style="font-size: 0.9em;">Read-only</span>
      `}
    </div>
  `;

  if (!isReadonly) {
    item.addEventListener('click', () => window.openEntityTypeEditor(type.id));
  }

  return item;
}

function initEntityTypesTab() {
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
