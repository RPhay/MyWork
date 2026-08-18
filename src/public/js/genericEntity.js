/**
 * Generic Entity Engine - Unified renderer for all entity types
 * Handles: rows, trees, editors, and field rendering for any entity type
 */

const GenericEntity = (() => {
  let currentTypeSlug, typeSchema, splitPane, currentEntityId, hasChanges, allEntities = [];
  const splitPanesByType = {}; // Store splitPane instances per type
  let currentSaveBtn = null; // Track current save button element

  // ========== FIELD RENDERERS STRATEGY MAP ==========
  const fieldRenderers = {
    text: (field, value = '') => `
      <div class="form-group">
        <label>${field.label}</label>
        <input type="text" name="${field.field_key}" value="${value || ''}" class="form-control" data-field-type="text">
      </div>
    `,
    textarea: (field, value = '') => `
      <div class="form-group">
        <label>${field.label}</label>
        <textarea name="${field.field_key}" class="form-control" data-field-type="textarea">${value || ''}</textarea>
      </div>
    `,
    number: (field, value = '') => `
      <div class="form-group">
        <label>${field.label}</label>
        <input type="number" name="${field.field_key}" value="${value || ''}" class="form-control" data-field-type="number">
      </div>
    `,
    date: (field, value = '') => `
      <div class="form-group">
        <label>${field.label}</label>
        <input type="date" name="${field.field_key}" value="${value || ''}" class="form-control" data-field-type="date">
      </div>
    `,
    select: (field, value = '') => `
      <div class="form-group">
        <label>${field.label}</label>
        <select name="${field.field_key}" class="form-control" data-field-type="select">
          <option value="">-- Select --</option>
          ${(field.field_options?.choices || []).map(c =>
            `<option value="${c}" ${c === value ? 'selected' : ''}>${c}</option>`
          ).join('')}
        </select>
      </div>
    `,
    status: (field, value = '') => {
      const statuses = field.field_options?.values || ['incomplete', 'in_progress', 'complete'];
      return `
        <div class="form-group">
          <label>${field.label}</label>
          <select name="${field.field_key}" class="form-control status-select" data-field-type="status">
            ${statuses.map(s =>
              `<option value="${s}" ${s === value ? 'selected' : ''}>${s}</option>`
            ).join('')}
          </select>
        </div>
      `;
    },
    checkbox: (field, value = false) => `
      <div class="form-group">
        <label>
          <input type="checkbox" name="${field.field_key}" class="form-check-input" ${value ? 'checked' : ''} data-field-type="checkbox">
          ${field.label}
        </label>
      </div>
    `,
    recurrence: (field, value = null) => `
      <div class="form-group">
        <label>${field.label}</label>
        <textarea name="${field.field_key}" class="form-control" data-field-type="recurrence" placeholder="JSON recurrence config">${value ? JSON.stringify(JSON.parse(value), null, 2) : ''}</textarea>
      </div>
    `,
  };

  // ========== ROW RENDERING ==========
  function renderEntityRow(entity, typeSchema, depth = 0, hasChildren = false) {
    const fields = (typeSchema.fields || [])
      .filter(f => f.show_in_row)
      .map(f => {
        const value = entity.fields?.[f.field_key] || '';
        return value ? `<span class="row-field">${value}</span>` : '';
      })
      .join(' ');

    const indent = `<span style="display:inline-block; width: ${depth * 18}px; flex: none;"></span>`;
    const isExpanded = localStorage.getItem(`entity-expanded-${entity.id}`) !== 'false';

    return `
      <div class="entity-row ${isExpanded ? 'expanded' : ''}" data-entity-id="${entity.id}" data-entity-type="${typeSchema.slug}" data-depth="${depth}" draggable="true">
        <div class="entity-row-content">
          ${indent}
          ${hasChildren ? `<span class="entity-toggle" data-action="toggle-expand">▶</span>` : '<span style="width: 18px; display: inline-block;"></span>'}
          ${entity.is_folder || hasChildren
            ? '<i class="bi bi-folder-fill entity-row-icon text-warning"></i>'
            : (typeSchema.icon ? `<span class="entity-row-icon">${typeSchema.icon}</span>` : '')}
          <span class="entity-title">${entity.title}</span>
          ${fields}
          <div class="entity-actions">
            <button class="btn btn-sm btn-danger" data-action="delete" data-entity-id="${entity.id}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
          </div>
        </div>
      </div>
    `;
  }

  // ========== TREE RENDERING ==========
  // `entities` carries no parent link of its own - the `entities` table has
  // no such column. Hierarchy lives entirely in entity_relationships
  // (kind='hierarchy'), fetched separately and passed in as `relationships`
  // ([{parent_entity_id, child_entity_id, order_index}, ...]).
  function renderTree(entities, typeSchema, relationships = []) {
    const entityMap = new Map(entities.map(e => [e.id, e]));

    const childrenByParent = new Map();
    const childIds = new Set();
    relationships.forEach((rel) => {
      if (!entityMap.has(rel.parent_entity_id) || !entityMap.has(rel.child_entity_id)) return;
      childIds.add(rel.child_entity_id);
      if (!childrenByParent.has(rel.parent_entity_id)) childrenByParent.set(rel.parent_entity_id, []);
      childrenByParent.get(rel.parent_entity_id).push(entityMap.get(rel.child_entity_id));
    });

    // Roots: entities that never appear as a child in a hierarchy relationship.
    const roots = entities.filter((e) => !childIds.has(e.id));

    function renderNode(entity, depth = 0) {
      const children = childrenByParent.get(entity.id) || [];
      const isExpanded = localStorage.getItem(`entity-expanded-${entity.id}`) !== 'false';

      const childrenHtml = children.length > 0 ? `
        <div class="entity-node-children ${isExpanded ? 'visible' : ''}">
          ${children.map(child => renderNode(child, depth + 1)).join('')}
        </div>
      ` : '';

      return `
        <div class="entity-node ${isExpanded ? 'expanded' : ''}" data-entity-id="${entity.id}">
          ${renderEntityRow(entity, typeSchema, depth, children.length > 0)}
          ${childrenHtml}
        </div>
      `;
    }

    return `<div class="entity-tree">${roots.map(r => renderNode(r)).join('')}</div>`;
  }

  // ========== EDITOR ==========
  function buildForm(typeSchema, entity = {}) {
    const fields = typeSchema.fields || [];
    return `
      <form id="entity-editor-form" class="entity-editor-form" onsubmit="return false;">
        <div class="form-group">
          <label>Title *</label>
          <input type="text" name="title" value="${entity.title || ''}" class="form-control" required>
        </div>
        ${fields.map(field => {
          const renderer = fieldRenderers[field.field_type] || fieldRenderers.text;
          const value = entity.fields?.[field.field_key];
          return renderer(field, value);
        }).join('')}
      </form>
    `;
  }

  function collectFormValues(typeSchema) {
    const form = document.getElementById('entity-editor-form');
    const formData = new FormData(form);
    const data = { title: formData.get('title') };

    for (const field of typeSchema.fields || []) {
      const value = formData.get(field.field_key);
      if (field.field_type === 'checkbox') {
        data[field.field_key] = formData.get(field.field_key) === 'on';
      } else if (field.field_type === 'number') {
        data[field.field_key] = value ? parseFloat(value) : null;
      } else if (field.field_type === 'recurrence') {
        data[field.field_key] = value ? JSON.parse(value) : null;
      } else {
        data[field.field_key] = value || null;
      }
    }
    return data;
  }

  function markChanged() {
    hasChanges = true;
    if (currentSaveBtn) {
      currentSaveBtn.disabled = false;
    }
  }

  function trackFormChanges() {
    const form = document.getElementById('entity-editor-form');
    if (form) {
      form.addEventListener('input', markChanged);
      form.addEventListener('change', markChanged);
      // Pressing Enter in a form field can submit the form natively
      // (navigating to the current URL with every field as a query param,
      // losing the tab/editor state) - the onsubmit="return false" on the
      // <form> guards against that, but Enter should still act like Save,
      // not silently do nothing. Handled on keydown rather than relying on
      // the 'submit' event, which isn't dispatched consistently for a form
      // with only one text field in every environment.
      form.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          document.getElementById(`${currentTypeSlug}SaveBtn`)?.click();
        }
      });
    }
  }

  // ========== PUBLIC API ==========
  return {
    init: (typeSlug, typeConfig, splitPaneInstance) => {
      currentTypeSlug = typeSlug;
      typeSchema = typeConfig;
      splitPane = splitPaneInstance;
      splitPanesByType[typeSlug] = splitPaneInstance; // Store per-type reference
    },

    renderRow: renderEntityRow,
    renderTree: renderTree,
    buildForm: buildForm,
    collectFormValues: collectFormValues,
    markChanged: markChanged,
    trackFormChanges: trackFormChanges,

    populate: (entityId, entity, typeConfig, typeSlugOverride) => {
      console.log(`[GenericEntity] populate called with typeSlugOverride=${typeSlugOverride}, entityId=${entityId}, currentEntityId=${currentEntityId}`);
      // Toggle close: if clicking same entity with no changes, close the editor
      if (currentEntityId === entityId && entityId !== null) {
        console.log(`[GenericEntity] Same entity, closing`);
        if (hasChanges) {
          return; // Don't close if there are unsaved changes
        }
        GenericEntity.close();
        return;
      }

      currentEntityId = entityId;
      hasChanges = false;
      typeSchema = typeConfig;

      // Use provided typeSlug or fall back to currentTypeSlug
      const typeSlugToUse = typeSlugOverride || currentTypeSlug;
      // Update currentTypeSlug if we're populating a different type
      if (typeSlugOverride) {
        currentTypeSlug = typeSlugOverride;
      }
      console.log(`[GenericEntity] typeSlugToUse=${typeSlugToUse}, splitPane exists=${!!splitPane}`);

      const formHtml = buildForm(typeConfig, entity);
      const editorPaneId = `${typeSlugToUse}-editor-pane`;
      const editorPane = document.getElementById(editorPaneId);
      if (!editorPane) {
        console.error(`[GenericEntity] FATAL: editorPane is null!`);
        return;
      }
      editorPane.innerHTML = formHtml;
      // Track the save button for this type
      currentSaveBtn = document.getElementById(`${typeSlugToUse}SaveBtn`);
      trackFormChanges();
      // Use the correct SplitPane for this type
      const typeSplitPane = splitPanesByType[typeSlugToUse];
      if (typeSplitPane) {
        typeSplitPane.showRightPane();
      } else {
        console.error(`[GenericEntity] No splitPane found for type ${typeSlugToUse}`);
      }
    },

    save: async () => {
      const data = collectFormValues(typeSchema);
      const url = currentEntityId
        ? `/api/entities/${currentTypeSlug}/${currentEntityId}`
        : `/api/entities/${currentTypeSlug}`;
      const method = currentEntityId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.APP_CONFIG?.csrfToken || ''
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      if (result.success) {
        hasChanges = false;
        return result.data;
      } else {
        throw new Error(result.message || 'Save failed');
      }
    },

    close: () => {
      currentEntityId = null;
      const typeSplitPane = splitPanesByType[currentTypeSlug];
      if (typeSplitPane) typeSplitPane.hideRightPane();
    },

    expandAncestors: (entityId, entities) => {
      const entity = entities.find(e => e.id === entityId);
      if (entity?.parent_entity_id) {
        localStorage.setItem(`entity-expanded-${entity.parent_entity_id}`, 'true');
        this.expandAncestors(entity.parent_entity_id, entities);
      }
    },

    setEntities: (entities) => {
      allEntities = entities;
    },

    getEntities: () => allEntities,

    getCurrentEntityId: () => currentEntityId,

    hasUnsavedChanges: () => hasChanges
  };
})();

// Export for use in views
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GenericEntity;
}
