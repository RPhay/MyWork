// Settings - Manage Entity Types

document.addEventListener('DOMContentLoaded', async () => {
  let fieldIndex = 0;

  // Initialize fields container
  const fieldsContainer = document.getElementById('fieldsContainer');
  const addFieldBtn = document.getElementById('addFieldBtn');

  if (!fieldsContainer || !addFieldBtn) return; // Page not loaded

  // Add field function
  function addFieldRow(fieldData = {}) {
    const fieldId = fieldIndex++;
    const html = `
      <div class="field-row" data-field-index="${fieldId}">
        <input type="text" class="form-control" placeholder="Field key (auto from label)"
               value="${fieldData.field_key || ''}" readonly style="background-color: #e9ecef;">
        <input type="text" class="form-control field-label" placeholder="Label (e.g., Status)"
               value="${fieldData.label || ''}" required>
        <select class="form-control field-type" required>
          <option value="">-- Select Type --</option>
          <option value="text" ${fieldData.field_type === 'text' ? 'selected' : ''}>Text</option>
          <option value="textarea" ${fieldData.field_type === 'textarea' ? 'selected' : ''}>Long Text</option>
          <option value="number" ${fieldData.field_type === 'number' ? 'selected' : ''}>Number</option>
          <option value="date" ${fieldData.field_type === 'date' ? 'selected' : ''}>Date</option>
          <option value="select" ${fieldData.field_type === 'select' ? 'selected' : ''}>Select</option>
          <option value="status" ${fieldData.field_type === 'status' ? 'selected' : ''}>Status</option>
          <option value="checkbox" ${fieldData.field_type === 'checkbox' ? 'selected' : ''}>Checkbox</option>
        </select>
        <button type="button" class="btn btn-sm btn-danger remove-field">Remove</button>
      </div>
    `;
    fieldsContainer.insertAdjacentHTML('beforeend', html);

    // Auto-generate field key from label
    const labelInput = fieldsContainer.querySelector(`[data-field-index="${fieldId}"] .field-label`);
    const keyInput = fieldsContainer.querySelector(`[data-field-index="${fieldId}"] [readonly]`);
    labelInput.addEventListener('change', (e) => {
      keyInput.value = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    });

    // Remove button
    fieldsContainer.querySelector(`[data-field-index="${fieldId}"] .remove-field`).addEventListener('click', (e) => {
      e.target.closest('.field-row').remove();
    });
  }

  // Add field button
  addFieldBtn.addEventListener('click', () => addFieldRow());

  // Add one default field
  addFieldRow({ label: 'Status', field_type: 'status' });

  // Form submission
  document.getElementById('createTypeForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const typeData = {
      label: formData.get('label'),
      label_singular: formData.get('label_singular') || formData.get('label'),
      icon: formData.get('icon') || null,
      supports_hierarchy: formData.get('supports_hierarchy') ? true : false,
      fields: []
    };

    // Collect fields
    fieldsContainer.querySelectorAll('.field-row').forEach((row, index) => {
      const fieldKey = row.querySelector('[readonly]').value;
      const label = row.querySelector('.field-label').value;
      const fieldType = row.querySelector('.field-type').value;

      if (fieldKey && label && fieldType) {
        typeData.fields.push({
          field_key: fieldKey,
          label: label,
          field_type: fieldType,
          required: false,
          show_in_row: index < 2,
          display_order: index,
          is_completion_signal: fieldType === 'status' && index === 0
        });
      }
    });

    if (typeData.fields.length === 0) {
      app.notify('Please add at least one field', 'warning');
      return;
    }

    try {
      const response = await app.fetch('/api/entity-types', {
        method: 'POST',
        body: JSON.stringify(typeData)
      });

      if (response.success) {
        app.notify(`Type "${typeData.label}" created! Refreshing to show new tab...`, 'success');
        setTimeout(() => location.reload(), 1000);
      } else {
        app.notify(response.message || 'Failed to create type', 'danger');
      }
    } catch (error) {
      app.notify(error.message, 'danger');
    }
  });

  // Load and display system types
  try {
    const response = await fetch('/api/entity-types');
    const data = await response.json();

    if (data.success && data.data && data.data.length > 0) {
      const systemTypesList = document.getElementById('systemTypesList');
      systemTypesList.innerHTML = '';

      const systemTypes = data.data.filter(t => t.is_system);
      if (systemTypes.length === 0) {
        systemTypesList.innerHTML = '<p class="text-muted">No system types found.</p>';
        return;
      }

      systemTypes.forEach(type => {
        const fieldCount = type.fields?.length || 0;
        const hierarchyLabel = type.supports_hierarchy ? '🌳 Hierarchical' : '📋 Flat';
        const html = `
          <div class="type-item">
            <div style="display: flex; align-items: center; flex: 1;">
              <span class="type-icon">${type.icon || '📦'}</span>
              <div class="type-info">
                <strong>${type.label}</strong>
                <div class="type-slug">${type.slug}</div>
                <div class="type-fields">${fieldCount} fields • ${hierarchyLabel}</div>
              </div>
            </div>
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-sm btn-outline-primary edit-system-type" data-type-id="${type.id}">
                Edit
              </button>
              <button type="button" class="btn btn-sm btn-outline-warning revert-system-type" data-type-id="${type.id}">
                Revert
              </button>
            </div>
          </div>
        `;
        systemTypesList.insertAdjacentHTML('beforeend', html);
      });

      // Add edit click handlers
      document.querySelectorAll('.edit-system-type').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const typeId = e.target.dataset.typeId;
          const type = systemTypes.find(t => t.id == typeId);
          if (type) showEditSystemTypeModal(type, systemTypes);
        });
      });

      // Add revert click handlers
      document.querySelectorAll('.revert-system-type').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const typeId = e.target.dataset.typeId;
          const type = systemTypes.find(t => t.id == typeId);
          if (type && confirm(`Revert "${type.label}" to default settings?`)) {
            await revertSystemType(typeId);
          }
        });
      });
    } else {
      document.getElementById('systemTypesList').innerHTML =
        '<p class="text-muted">No system types available.</p>';
    }
  } catch (error) {
    console.error('Error loading system types:', error);
    document.getElementById('systemTypesList').innerHTML =
      `<p class="text-danger">Error loading types: ${error.message}</p>`;
  }

  // Edit system type modal
  function showEditSystemTypeModal(type, allTypes) {
    const modalHtml = `
      <div class="modal fade" id="editSystemTypeModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Edit System Type: ${type.label}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="editSystemTypeForm">
                <div class="mb-3">
                  <label for="editTypeIcon" class="form-label">Icon (emoji)</label>
                  <input type="text" class="form-control" id="editTypeIcon" maxlength="2" value="${type.icon || ''}">
                </div>
                <div class="mb-3">
                  <label class="form-label">Options</label>
                  <div class="form-check">
                    <input type="checkbox" class="form-check-input" id="editTypeHierarchy" ${type.supports_hierarchy ? 'checked' : ''}>
                    <label class="form-check-label" for="editTypeHierarchy">
                      Supports Hierarchy (parent/child nesting)
                    </label>
                  </div>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" id="saveEditSystemTypeBtn">Save Changes</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Remove old modal if exists
    const oldModal = document.getElementById('editSystemTypeModal');
    if (oldModal) oldModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('editSystemTypeModal'));

    document.getElementById('saveEditSystemTypeBtn').addEventListener('click', async () => {
      const icon = document.getElementById('editTypeIcon').value;
      const supportsHierarchy = document.getElementById('editTypeHierarchy').checked;

      try {
        const response = await app.fetch(`/api/entity-types/${type.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            icon: icon || null,
            supports_hierarchy: supportsHierarchy
          })
        });

        if (response.success) {
          app.notify(`Type "${type.label}" updated!`, 'success');
          modal.hide();
          setTimeout(() => location.reload(), 500);
        } else {
          app.notify(response.message || 'Failed to update type', 'danger');
        }
      } catch (error) {
        app.notify(error.message, 'danger');
      }
    });

    modal.show();
  }

  // Revert system type to defaults
  async function revertSystemType(typeId) {
    try {
      const response = await app.fetch(`/api/entity-types/${typeId}/revert`, {
        method: 'POST'
      });

      if (response.success) {
        app.notify('Type reverted to default settings!', 'success');
        setTimeout(() => location.reload(), 500);
      } else {
        app.notify(response.message || 'Failed to revert type', 'danger');
      }
    } catch (error) {
      app.notify(error.message, 'danger');
    }
  }
});
