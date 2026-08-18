// Settings - Manage Entity Types (with draggable modal)

async function loadEntityTypes() {
  try {
    const response = await fetch('/api/entity-types');
    const result = await response.json();

    const typesList = document.getElementById('typesList');

    if (result.success && result.data && result.data.length > 0) {
      typesList.innerHTML = '';

      result.data.forEach(type => {
        const item = document.createElement('div');
        item.className = 'type-list-item';
        item.innerHTML = `
          <div class="type-list-item-left">
            <div class="type-icon">${type.icon || '📄'}</div>
            <div class="type-info">
              <h6 class="mb-0">${type.label}</h6>
              <small><span class="badge bg-secondary">${type.slug}</span></small>
              <small class="d-block mt-1">
                ${type.fields?.length || 0} fields
                ${type.supports_hierarchy ? ' • Supports hierarchy' : ''}
              </small>
            </div>
          </div>
          <div class="type-list-item-right">
            <button class="btn btn-sm btn-outline-primary type-edit-btn" title="Edit type">
              <i class="bi bi-pencil"></i> Edit
            </button>
          </div>
        `;

        item.addEventListener('click', () => openEntityTypeEditor(type.id));
        typesList.appendChild(item);
      });
    } else {
      typesList.innerHTML = '<div class="p-4 text-center text-muted">No entity types found</div>';
    }
  } catch (error) {
    console.error('Error loading entity types:', error);
    const typesList = document.getElementById('typesList');
    if (typesList) {
      typesList.innerHTML = '<div class="p-4 text-center text-danger">Error loading types</div>';
    }
  }
}

function initEntityTypesTab() {
  const createNewTypeBtn = document.getElementById('createNewTypeBtn');
  if (createNewTypeBtn) {
    createNewTypeBtn.addEventListener('click', () => {
      openEntityTypeEditor();
    });
  }

  loadEntityTypes();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEntityTypesTab);
} else {
  initEntityTypesTab();
}
