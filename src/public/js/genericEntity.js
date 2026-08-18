/**
 * Generic Entity Type Controller
 * Handles all editable entity types with common UI patterns:
 * - Folder hierarchy (if supported)
 * - Column visibility toggle
 * - Sorting and filtering
 * - Inline and detail editing
 */

let currentEntities = [];
let currentType = null;
let currentFolder = null;
let columnVisibility = {};
let sortField = null;
let sortDirection = 'asc';
let filterText = '';
let filterValues = {};
let currentEditingEntity = null;

async function initializeGenericEntity() {
  const typeSlug = window.genericEntityTypeSlug;
  const typeName = window.genericEntityTypeName;
  const supportsHierarchy = window.genericEntitySupportsHierarchy;
  const typeFields = window.genericEntityTypeFields || [];

  currentType = {
    slug: typeSlug,
    name: typeName,
    supportsHierarchy: supportsHierarchy,
    fields: typeFields
  };

  // Initialize column visibility from localStorage
  const savedColumns = localStorage.getItem(`entityColumns_${typeSlug}`);
  if (savedColumns) {
    columnVisibility = JSON.parse(savedColumns);
  } else {
    // Default: show all columns except notes
    typeFields.forEach(field => {
      columnVisibility[field.field_key] = field.field_key !== 'notes';
    });
    saveColumnVisibility();
  }

  // Attach event listeners
  document.getElementById('createEntityBtn')?.addEventListener('click', () => createNewEntity());
  document.getElementById('newFolderBtn')?.addEventListener('click', () => createNewFolder());
  document.getElementById('columnToggleBtn')?.addEventListener('click', () => showColumnModal());
  document.getElementById('closeDetailBtn')?.addEventListener('click', () => closeDetailPane());
  document.getElementById('saveEntityBtn')?.addEventListener('click', () => saveCurrentEntity());
  document.getElementById('deleteEntityBtn')?.addEventListener('click', () => deleteCurrentEntity());
  document.getElementById('searchInput')?.addEventListener('input', (e) => {
    filterText = e.target.value.toLowerCase();
    renderTable();
  });

  // Setup column modal
  setupColumnModal();

  // Load initial data
  await loadEntities();
  renderTable();
  if (supportsHierarchy) {
    renderFolders();
  }
}

async function loadEntities() {
  try {
    const response = await fetch(`/api/entities/${currentType.slug}`);
    const result = await response.json();
    if (result.success) {
      currentEntities = result.data || [];
    } else {
      console.error('Error loading entities:', result.message);
      currentEntities = [];
    }
  } catch (error) {
    console.error('Error loading entities:', error);
    currentEntities = [];
  }
}

function getVisibleColumns() {
  return currentType.fields.filter(field => columnVisibility[field.field_key]);
}

function renderTable() {
  const tableHeader = document.getElementById('tableHeader');
  const tableBody = document.getElementById('entityTableBody');

  // Clear and build header
  tableHeader.innerHTML = '';
  const visibleColumns = getVisibleColumns();

  const titleHeader = document.createElement('th');
  titleHeader.textContent = 'Title';
  titleHeader.style.cursor = 'pointer';
  titleHeader.addEventListener('click', () => toggleSort('title'));
  tableHeader.appendChild(titleHeader);

  visibleColumns.forEach(field => {
    const th = document.createElement('th');
    th.style.cursor = 'pointer';
    th.innerHTML = `${field.label}`;
    if (sortField === field.field_key) {
      th.innerHTML += ` <span class="column-sort-indicator">${sortDirection === 'asc' ? '↑' : '↓'}</span>`;
    }
    th.addEventListener('click', () => toggleSort(field.field_key));
    tableHeader.appendChild(th);
  });

  // Filter and render body
  let filteredEntities = filterEntities(currentEntities);
  sortEntities(filteredEntities);

  if (filteredEntities.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="100%" class="text-center text-muted p-4">No items</td></tr>';
    return;
  }

  tableBody.innerHTML = '';
  filteredEntities.forEach(entity => {
    const row = document.createElement('tr');
    row.dataset.entityId = entity.id;
    row.addEventListener('click', () => showDetailPane(entity));

    // Title column
    const titleCell = document.createElement('td');
    titleCell.innerHTML = `<strong>${app.escapeHtml(entity.title)}</strong>`;
    row.appendChild(titleCell);

    // Other columns
    visibleColumns.forEach(field => {
      const cell = document.createElement('td');
      const value = getFieldValue(entity, field.field_key);
      cell.textContent = formatFieldValue(value, field.field_type);
      row.appendChild(cell);
    });

    tableBody.appendChild(row);
  });
}

function filterEntities(entities) {
  return entities.filter(entity => {
    // Text search in title
    if (filterText && !entity.title.toLowerCase().includes(filterText)) {
      return false;
    }

    // Field-specific filters
    for (const [fieldKey, filterValue] of Object.entries(filterValues)) {
      if (filterValue) {
        const entityValue = getFieldValue(entity, fieldKey);
        if (!entityValue || !String(entityValue).toLowerCase().includes(String(filterValue).toLowerCase())) {
          return false;
        }
      }
    }

    // Folder filter
    if (currentFolder && entity.parent_id !== currentFolder) {
      return false;
    }

    return true;
  });
}

function getFieldValue(entity, fieldKey) {
  if (fieldKey === 'title') return entity.title;
  return entity[fieldKey] || '';
}

function formatFieldValue(value, fieldType) {
  if (!value) return '';
  if (fieldType === 'date') return new Date(value).toLocaleDateString();
  if (fieldType === 'number') return Number(value).toLocaleString();
  return String(value).substring(0, 50);
}

function toggleSort(fieldKey) {
  if (sortField === fieldKey) {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    sortField = fieldKey;
    sortDirection = 'asc';
  }
  renderTable();
}

function sortEntities(entities) {
  if (!sortField) return;

  entities.sort((a, b) => {
    let aVal = getFieldValue(a, sortField);
    let bVal = getFieldValue(b, sortField);

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
}

function setupColumnModal() {
  const columnCheckboxes = document.getElementById('columnCheckboxes');
  if (!columnCheckboxes) return;

  columnCheckboxes.innerHTML = '';
  currentType.fields.forEach(field => {
    const div = document.createElement('div');
    div.className = 'form-check';
    div.innerHTML = `
      <input class="form-check-input column-checkbox" type="checkbox" id="col_${field.field_key}"
             value="${field.field_key}" ${columnVisibility[field.field_key] ? 'checked' : ''}>
      <label class="form-check-label" for="col_${field.field_key}">
        ${field.label}
      </label>
    `;
    columnCheckboxes.appendChild(div);
  });

  document.querySelectorAll('.column-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      columnVisibility[e.target.value] = e.target.checked;
      saveColumnVisibility();
      renderTable();
    });
  });
}

function saveColumnVisibility() {
  localStorage.setItem(`entityColumns_${currentType.slug}`, JSON.stringify(columnVisibility));
}

function showColumnModal() {
  const modal = new bootstrap.Modal(document.getElementById('columnModal'));
  setupColumnModal();
  modal.show();
}

function renderFolders() {
  const folderTree = document.getElementById('folderTree');
  if (!folderTree) return;

  folderTree.innerHTML = '';
  const rootItems = currentEntities.filter(e => !e.parent_id);

  rootItems.forEach(item => {
    const div = document.createElement('div');
    div.className = 'tree-item';
    div.dataset.entityId = item.id;
    div.textContent = item.title;
    div.addEventListener('click', () => {
      currentFolder = item.id;
      document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
      div.classList.add('active');
      renderTable();
    });
    div.addEventListener('contextmenu', (e) => showContextMenu(e, item));
    folderTree.appendChild(div);
  });
}

function showDetailPane(entity) {
  currentEditingEntity = entity;
  const detailPane = document.getElementById('detailPane');
  const entityForm = document.getElementById('entityForm');

  entityForm.innerHTML = '';

  const titleGroup = document.createElement('div');
  titleGroup.className = 'form-group';
  titleGroup.innerHTML = `
    <label class="form-label">Title *</label>
    <input type="text" class="form-control" id="field_title" value="${app.escapeHtml(entity.title)}" required>
  `;
  entityForm.appendChild(titleGroup);

  currentType.fields.forEach(field => {
    const value = getFieldValue(entity, field.field_key) || '';
    const group = document.createElement('div');
    group.className = 'form-group';

    let input;
    if (field.field_type === 'textarea') {
      input = document.createElement('textarea');
      input.className = 'form-control';
      input.rows = 3;
      input.value = value;
    } else if (field.field_type === 'number') {
      input = document.createElement('input');
      input.type = 'number';
      input.className = 'form-control';
      input.value = value;
    } else if (field.field_type === 'date') {
      input = document.createElement('input');
      input.type = 'date';
      input.className = 'form-control';
      input.value = value;
    } else {
      input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-control';
      input.value = value;
    }

    input.id = `field_${field.field_key}`;
    input.name = field.field_key;

    group.innerHTML = `<label class="form-label">${field.label}</label>`;
    group.appendChild(input);
    entityForm.appendChild(group);
  });

  detailPane.style.display = 'block';
}

function closeDetailPane() {
  document.getElementById('detailPane').style.display = 'none';
  currentEditingEntity = null;
}

async function saveCurrentEntity() {
  if (!currentEditingEntity) return;

  const formData = {
    title: document.getElementById('field_title').value
  };

  try {
    const response = await fetch(
      `/api/entities/${currentType.slug}/${currentEditingEntity.id}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.APP_CONFIG?.csrfToken
        },
        body: JSON.stringify(formData)
      }
    );

    const result = await response.json();
    if (result.success) {
      app.notify('Saved', 'success');
      await loadEntities();
      renderTable();
      closeDetailPane();
    }
  } catch (error) {
    console.error('Error saving entity:', error);
    app.notify('Error saving entity', 'danger');
  }
}

async function deleteCurrentEntity() {
  if (!currentEditingEntity) return;
  if (!confirm('Delete this item?')) return;

  try {
    const response = await fetch(
      `/api/entities/${currentType.slug}/${currentEditingEntity.id}`,
      {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': window.APP_CONFIG?.csrfToken
        }
      }
    );

    const result = await response.json();
    if (result.success) {
      app.notify('Deleted', 'success');
      await loadEntities();
      renderTable();
      closeDetailPane();
    }
  } catch (error) {
    console.error('Error deleting entity:', error);
  }
}

async function createNewEntity() {
  try {
    const response = await fetch(`/api/entities/${currentType.slug}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ title: 'New ' + currentType.name })
    });

    const result = await response.json();
    if (result.success) {
      await loadEntities();
      renderTable();
      showDetailPane(result.data);
    }
  } catch (error) {
    console.error('Error creating entity:', error);
  }
}

async function createNewFolder() {
  const name = prompt('Folder name:');
  if (!name) return;

  try {
    const response = await fetch(`/api/entities/${currentType.slug}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({ title: name })
    });

    const result = await response.json();
    if (result.success) {
      await loadEntities();
      renderFolders();
    }
  } catch (error) {
    console.error('Error creating folder:', error);
  }
}

function showContextMenu(e, entity) {
  e.preventDefault();
  e.stopPropagation();

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.cssText = `
    position: fixed;
    top: ${e.clientY}px;
    left: ${e.clientX}px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    z-index: 10000;
  `;

  menu.innerHTML = `
    <div style="padding: 4px 0;">
      <button class="context-menu-item" onclick="editEntity(${entity.id})">Edit</button>
      <button class="context-menu-item" onclick="deleteEntity(${entity.id})">Delete</button>
      <hr style="margin: 4px 0;">
      <button class="context-menu-item" onclick="addChild(${entity.id})">Add Child</button>
    </div>
  `;

  // Style items
  menu.querySelectorAll('.context-menu-item').forEach(btn => {
    btn.style.cssText = `
      display: block;
      width: 100%;
      padding: 8px 16px;
      border: none;
      background: none;
      text-align: left;
      cursor: pointer;
      font-size: 0.9rem;
    `;
    btn.addEventListener('mouseenter', (e) => e.target.style.background = '#f0f0f0');
    btn.addEventListener('mouseleave', (e) => e.target.style.background = 'none');
  });

  document.body.appendChild(menu);
  document.addEventListener('click', () => menu.remove(), { once: true });
}

function editEntity(id) {
  const entity = currentEntities.find(e => e.id === id);
  if (entity) showDetailPane(entity);
}

function deleteEntity(id) {
  const entity = currentEntities.find(e => e.id === id);
  if (entity) {
    currentEditingEntity = entity;
    deleteCurrentEntity();
  }
}

function addChild(parentId) {
  // Create new child entity under parent
  const childName = prompt('Item name:');
  if (!childName) return;

  fetch(`/api/entities/${currentType.slug}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': window.APP_CONFIG?.csrfToken
    },
    body: JSON.stringify({ title: childName, parent_id: parentId })
  }).then(res => res.json()).then(result => {
    if (result.success) {
      loadEntities().then(() => renderFolders());
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeGenericEntity);
} else {
  initializeGenericEntity();
}
