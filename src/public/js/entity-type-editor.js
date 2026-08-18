/**
 * Entity Type Editor Modal
 * Handles creating and editing entity types with fields and relationships
 */

let currentEntityTypeModal = null;
let currentEditingType = null;

async function openEntityTypeEditor(typeId = null) {
  if (typeId) {
    // Load existing type
    try {
      const response = await fetch(`/api/entity-types/${typeId}`);
      const result = await response.json();
      if (result.success) {
        currentEditingType = result.data;
        showEntityTypeEditorModal(result.data);
      }
    } catch (error) {
      console.error('Error loading entity type:', error);
      app.notify('Error loading entity type', 'danger');
    }
  } else {
    // New type
    currentEditingType = null;
    showEntityTypeEditorModal(null);
  }
}

function showEntityTypeEditorModal(type) {
  const isNew = !type;
  const title = isNew ? 'Create New Entity Type' : `Edit: ${type.label}`;

  const content = document.createElement('div');
  content.innerHTML = `
    <form id="entityTypeForm">
      <div class="row mb-3">
        <div class="col-md-6">
          <label class="form-label">Name *</label>
          <input type="text" class="form-control" id="typeName" placeholder="e.g., Project, Task" value="${type?.label || ''}" required>
        </div>
        <div class="col-md-6">
          <label class="form-label">Singular Form *</label>
          <input type="text" class="form-control" id="typeSingular" placeholder="e.g., Project, Task" value="${type?.label_singular || ''}" required>
        </div>
      </div>

      <div class="row mb-3">
        <div class="col-md-6">
          <label class="form-label">Icon (Emoji)</label>
          <input type="text" class="form-control" id="typeIcon" placeholder="😊" value="${type?.icon || ''}" maxlength="5">
        </div>
        <div class="col-md-6">
          <label class="form-label">Supports Hierarchy</label>
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="typeHierarchy" ${type?.supports_hierarchy ? 'checked' : ''}>
            <label class="form-check-label" for="typeHierarchy">
              Items can have parents/children of the same type
            </label>
          </div>
        </div>
      </div>

      <!-- Fields Section -->
      <div class="mb-3">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h6 class="mb-0">Fields</h6>
          <button type="button" class="btn btn-sm btn-outline-primary" id="addFieldBtn">+ Add Field</button>
        </div>
        <div id="fieldsList" style="max-height: 300px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; padding: 10px;">
          <!-- Fields will be added here -->
        </div>
      </div>

      <!-- Relationships Section -->
      <div class="mb-3">
        <h6>Type Relationships</h6>
        <div class="row">
          <div class="col-md-6">
            <label class="form-label">Can have parents:</label>
            <div id="parentTypesList" style="max-height: 200px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; padding: 8px;">
              <!-- Parent types will be listed here -->
            </div>
          </div>
          <div class="col-md-6">
            <label class="form-label">Can have children:</label>
            <div id="childTypesList" style="max-height: 200px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; padding: 8px;">
              <!-- Child types will be listed here -->
            </div>
          </div>
        </div>
      </div>
    </form>
  `;

  const footer = document.createElement('div');
  footer.innerHTML = `
    <button type="button" class="btn btn-secondary" id="entityTypeCancelBtn">Cancel</button>
    <button type="button" class="btn btn-danger me-2" id="entityTypeDeleteBtn" style="display: ${isNew ? 'none' : 'inline-block'};">Delete</button>
    <button type="button" class="btn btn-primary" id="entityTypeSaveBtn">Save</button>
  `;

  currentEntityTypeModal = new DraggableModal({
    title,
    width: 700,
    height: 600,
    content,
    footer,
    onClose: () => {
      currentEntityTypeModal = null;
      currentEditingType = null;
    }
  });

  currentEntityTypeModal.open();

  // Load types for relationships
  loadTypeRelationships(type);

  // Setup event handlers
  document.getElementById('entityTypeCancelBtn').addEventListener('click', () => currentEntityTypeModal.close());
  document.getElementById('entityTypeSaveBtn').addEventListener('click', saveEntityType);

  if (!isNew) {
    document.getElementById('entityTypeDeleteBtn').addEventListener('click', deleteEntityType);
  }

  document.getElementById('addFieldBtn').addEventListener('click', addFieldRow);

  // Load existing fields if editing
  if (type && type.fields && type.fields.length > 0) {
    type.fields.forEach(field => {
      addFieldRow(field);
    });
  }
}

function addFieldRow(field = null) {
  const fieldsList = document.getElementById('fieldsList');
  const fieldRow = document.createElement('div');
  fieldRow.className = 'field-row mb-2 p-2 bg-light rounded';
  fieldRow.draggable = true;

  const fieldOptions = field?.field_options ? (typeof field.field_options === 'string' ? JSON.parse(field.field_options) : field.field_options) : null;
  const optionsStr = fieldOptions?.values ? fieldOptions.values.join(', ') : '';

  fieldRow.innerHTML = `
    <div class="row g-2 align-items-center">
      <div class="col-auto">
        <span class="field-drag-handle" title="Drag to reorder" style="cursor: grab; user-select: none; font-size: 0.8em; color: #999;">⋮⋮</span>
      </div>
      <div class="col">
        <input type="text" class="form-control form-control-sm field-key" placeholder="field_name" value="${field?.field_key || ''}" required>
      </div>
      <div class="col">
        <input type="text" class="form-control form-control-sm field-label" placeholder="Label" value="${field?.label || ''}" required>
      </div>
      <div class="col">
        <select class="form-select form-select-sm field-type">
          <option value="text" ${field?.field_type === 'text' ? 'selected' : ''}>Text</option>
          <option value="textarea" ${field?.field_type === 'textarea' ? 'selected' : ''}>Long Text</option>
          <option value="number" ${field?.field_type === 'number' ? 'selected' : ''}>Number</option>
          <option value="date" ${field?.field_type === 'date' ? 'selected' : ''}>Date</option>
          <option value="url" ${field?.field_type === 'url' ? 'selected' : ''}>URL</option>
          <option value="select" ${field?.field_type === 'select' ? 'selected' : ''}>Dropdown</option>
          <option value="radio" ${field?.field_type === 'radio' ? 'selected' : ''}>Radio Buttons</option>
          <option value="checkbox" ${field?.field_type === 'checkbox' ? 'selected' : ''}>Checkbox</option>
        </select>
      </div>
      <div class="col field-options-col" style="display: ${['select', 'radio', 'checkbox'].includes(field?.field_type) ? 'block' : 'none'};">
        <input type="text" class="form-control form-control-sm field-options" placeholder="Options (comma-separated)" value="${optionsStr}">
      </div>
      <div class="col-auto">
        <button type="button" class="btn btn-sm btn-outline-danger remove-field-btn">×</button>
      </div>
    </div>
  `;

  fieldsList.appendChild(fieldRow);

  const fieldTypeSelect = fieldRow.querySelector('.field-type');
  const optionsCol = fieldRow.querySelector('.field-options-col');

  // Show/hide options input based on field type
  fieldTypeSelect.addEventListener('change', () => {
    if (['select', 'radio', 'checkbox'].includes(fieldTypeSelect.value)) {
      optionsCol.style.display = 'block';
    } else {
      optionsCol.style.display = 'none';
    }
  });

  // Remove button
  fieldRow.querySelector('.remove-field-btn').addEventListener('click', () => {
    fieldRow.remove();
  });

  // Drag and drop for reordering
  fieldRow.addEventListener('dragstart', (e) => {
    e.dataTransfer.effectAllowed = 'move';
    fieldRow.classList.add('dragging');
  });

  fieldRow.addEventListener('dragend', () => {
    fieldRow.classList.remove('dragging');
    document.querySelectorAll('.field-row').forEach(row => row.classList.remove('drag-over'));
  });

  fieldRow.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const draggingRow = document.querySelector('.field-row.dragging');
    if (draggingRow && draggingRow !== fieldRow) {
      fieldRow.classList.add('drag-over');
    }
  });

  fieldRow.addEventListener('dragleave', () => {
    fieldRow.classList.remove('drag-over');
  });

  fieldRow.addEventListener('drop', (e) => {
    e.preventDefault();
    const draggingRow = document.querySelector('.field-row.dragging');
    if (draggingRow && draggingRow !== fieldRow) {
      fieldRow.parentNode.insertBefore(draggingRow, fieldRow);
    }
  });
}

async function loadTypeRelationships(type) {
  try {
    const response = await fetch('/api/entity-types');
    const result = await response.json();
    if (result.success) {
      const types = result.data || [];
      const otherTypes = types.filter(t => !type || t.id !== type.id);

      const parentList = document.getElementById('parentTypesList');
      const childList = document.getElementById('childTypesList');

      parentList.innerHTML = '';
      childList.innerHTML = '';

      otherTypes.forEach(t => {
        // Parent types
        const parentCheck = document.createElement('div');
        parentCheck.className = 'form-check';
        parentCheck.innerHTML = `
          <input class="form-check-input parent-type-check" type="checkbox" value="${t.id}" id="parent_${t.id}">
          <label class="form-check-label" for="parent_${t.id}">${t.label}</label>
        `;
        parentList.appendChild(parentCheck);

        // Child types
        const childCheck = document.createElement('div');
        childCheck.className = 'form-check';
        childCheck.innerHTML = `
          <input class="form-check-input child-type-check" type="checkbox" value="${t.id}" id="child_${t.id}">
          <label class="form-check-label" for="child_${t.id}">${t.label}</label>
        `;
        childList.appendChild(childCheck);
      });
    }
  } catch (error) {
    console.error('Error loading types:', error);
  }
}

async function saveEntityType() {
  const form = document.getElementById('entityTypeForm');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const typeData = {
    label: document.getElementById('typeName').value,
    label_singular: document.getElementById('typeSingular').value,
    icon: document.getElementById('typeIcon').value || null,
    supports_hierarchy: document.getElementById('typeHierarchy').checked,
    fields: Array.from(document.querySelectorAll('.field-row')).map(row => {
      const fieldType = row.querySelector('.field-type').value;
      const fieldData = {
        field_key: row.querySelector('.field-key').value,
        label: row.querySelector('.field-label').value,
        field_type: fieldType
      };

      // Add field_options for select, radio, checkbox fields
      if (['select', 'radio', 'checkbox'].includes(fieldType)) {
        const optionsInput = row.querySelector('.field-options');
        if (optionsInput && optionsInput.value.trim()) {
          const values = optionsInput.value.split(',').map(v => v.trim()).filter(v => v);
          if (values.length > 0) {
            fieldData.field_options = { values };
          }
        }
      }

      return fieldData;
    })
  };

  try {
    const url = currentEditingType ? `/api/entity-types/${currentEditingType.id}` : '/api/entity-types';
    const method = currentEditingType ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify(typeData)
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Entity type saved', 'success');
      currentEntityTypeModal.close();
      // Reload entity types
      location.reload();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error saving entity type:', error);
    app.notify('Error saving entity type', 'danger');
  }
}

async function deleteEntityType() {
  if (!currentEditingType) return;
  if (!confirm(`Delete entity type "${currentEditingType.label}"?`)) return;

  try {
    const response = await fetch(`/api/entity-types/${currentEditingType.id}`, {
      method: 'DELETE',
      headers: {
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      }
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Entity type deleted', 'success');
      currentEntityTypeModal.close();
      location.reload();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error deleting entity type:', error);
    app.notify('Error deleting entity type', 'danger');
  }
}
