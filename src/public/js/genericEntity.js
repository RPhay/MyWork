/**
 * Generic Entity Engine - Unified renderer for all entity types
 * Handles: rows, trees, editors, and field rendering for any entity type
 */

const GenericEntity = (() => {
  let currentTypeSlug, typeSchema, splitPane, currentEntityId, hasChanges, currentIsFolder = false, allEntities = [];
  const splitPanesByType = {}; // Store splitPane instances per type
  let currentSaveBtn = null; // Track current save button element

  // Field values are user text and land inside HTML attributes and markup, so
  // they're escaped rather than interpolated raw.
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
  const escapeAttr = escapeHtml;

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
    // A single named URL. The field's own label names it ("Repo", "Spec"...),
    // so one type can carry several distinct url fields.
    url: (field, value = '') => `
      <div class="form-group">
        <label>${field.label}</label>
        <input type="url" name="${field.field_key}" value="${escapeAttr(value)}" class="form-control" placeholder="https://example.com" data-field-type="url">
      </div>
    `,
    radio: (field, value = '') => {
      const choices = field.field_options?.choices || [];
      return `
        <div class="form-group">
          <label>${field.label}</label>
          <div data-field-type="radio" data-field-key="${field.field_key}">
            ${choices.map((c, i) => `
              <div class="form-check">
                <input class="form-check-input" type="radio" name="${field.field_key}" id="${field.field_key}-${i}" value="${escapeAttr(c)}" ${c === value ? 'checked' : ''}>
                <label class="form-check-label" for="${field.field_key}-${i}">${escapeHtml(c)}</label>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    },
    // 0-n named URLs. Stored as a JSON array of {url, title} in value_json, so
    // it needs no table of its own - the per-type *_links tables this replaces
    // (priority_links, task_links, ticket_links, to_do_links) each existed only
    // because there was no generic way to express "this type has links".
    links: (field, value = null) => {
      const links = Array.isArray(value) ? value : [];
      const row = (link = { url: '', title: '' }) => `
        <div class="entity-link-row" style="display:flex; gap:4px; margin-bottom:4px;">
          <input type="url" class="form-control entity-link-url" value="${escapeAttr(link.url || '')}" placeholder="https://example.com" style="flex:2;">
          <input type="text" class="form-control entity-link-title" value="${escapeAttr(link.title || '')}" placeholder="Name (optional)" style="flex:1;">
          <button type="button" class="btn btn-outline-danger btn-sm" data-action="remove-link" title="Remove link" aria-label="Remove link">&times;</button>
        </div>
      `;
      return `
        <div class="form-group" data-field-type="links" data-field-key="${field.field_key}">
          <label>${field.label}</label>
          <div class="entity-links-list">${links.map(row).join('')}</div>
          <button type="button" class="btn btn-outline-secondary btn-sm" data-action="add-link">
            <i class="bi bi-plus-lg"></i> Add link
          </button>
        </div>
      `;
    },
    recurrence: (field, value = null) => `
      <div class="form-group">
        <label>${field.label}</label>
        <textarea name="${field.field_key}" class="form-control" data-field-type="recurrence" placeholder="JSON recurrence config">${value ? JSON.stringify(JSON.parse(value), null, 2) : ''}</textarea>
      </div>
    `,
  };

  // A folder is not a separate entity type - it's a row of the page's own type
  // carrying entities.is_folder = 1. That's what keeps every typed page on one
  // code path: folders are page-scoped for free, and the type's existing
  // self-nesting hierarchy rule already permits types under types, types under
  // folders, and folders under folders with no extra rules. The icon swap and
  // the title-only form below are the only two places anything is folder-aware.
  const FOLDER_ICON = '📁';

  // ========== ROW RENDERING ==========
  function renderEntityRow(entity, typeSchema, depth = 0, hasChildren = false) {
    const isFolder = !!entity.is_folder;
    const icon = isFolder ? FOLDER_ICON : typeSchema.icon;
    // Folders carry no field values, so a folder row is just its name.
    const fields = isFolder ? '' : (typeSchema.fields || [])
      .filter(f => f.show_in_row)
      .map(f => {
        const value = entity.fields?.[f.field_key];
        if (value === null || value === undefined || value === '') return '';

        // Links are an array of {url, title}; anything else stringifies fine.
        if (f.field_type === 'links' && Array.isArray(value)) {
          return value.map(l => `
            <a class="row-field entity-row-link" href="${escapeAttr(l.url)}" target="_blank" rel="noopener noreferrer" title="${escapeAttr(l.url)}">
              <i class="bi bi-link-45deg"></i>${escapeHtml(l.title || l.url)}
            </a>
          `).join('');
        }
        if (f.field_type === 'url') {
          return `<a class="row-field entity-row-link" href="${escapeAttr(value)}" target="_blank" rel="noopener noreferrer"><i class="bi bi-link-45deg"></i>${escapeHtml(value)}</a>`;
        }
        return `<span class="row-field">${escapeHtml(value)}</span>`;
      })
      .join(' ');

    const indent = `<span style="display:inline-block; width: ${depth * 18}px; flex: none;"></span>`;
    const isExpanded = localStorage.getItem(`entity-expanded-${entity.id}`) !== 'false';
    // Whatever the editor currently has open is the selected row.
    const isSelected = currentEntityId != null && String(currentEntityId) === String(entity.id);

    return `
      <div class="entity-row ${isExpanded ? 'expanded' : ''} ${isFolder ? 'entity-row-folder' : ''} ${isSelected ? 'selected' : ''}" data-entity-id="${entity.id}" data-entity-type="${typeSchema.slug}" data-is-folder="${isFolder ? '1' : '0'}" data-depth="${depth}" draggable="true">
        <div class="entity-row-content">
          ${indent}
          ${hasChildren ? `<span class="entity-toggle" data-action="toggle-expand">▶</span>` : '<span style="width: 18px; display: inline-block;"></span>'}
          ${icon ? `<span class="entity-row-icon">${icon}</span>` : ''}
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
    // A folder only organizes - it has no field values of its own, so its
    // editor is the name and nothing else, for every type alike.
    const fields = entity.is_folder ? [] : (typeSchema.fields || []);
    return `
      <form id="entity-editor-form" class="entity-editor-form" onsubmit="return false;">
        <div class="form-group">
          <label>${entity.is_folder ? 'Folder Name' : 'Title'} *</label>
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

  // Field values go under `fields`, not alongside `title` - that's the shape
  // entityService.js#createEntity/updateEntity reads. They used to be returned
  // flat, which meant every field value (notes, status, recurrence) was
  // silently dropped on save for every type.
  function collectFormValues(typeSchema, isFolder = false) {
    const form = document.getElementById('entity-editor-form');
    const formData = new FormData(form);
    const data = { title: formData.get('title'), is_folder: isFolder, fields: {} };

    if (isFolder) return data;

    for (const field of typeSchema.fields || []) {
      const value = formData.get(field.field_key);
      if (field.field_type === 'links') {
        // Not a FormData field - the rows are built by the links renderer.
        const container = form.querySelector(`[data-field-type="links"][data-field-key="${field.field_key}"]`);
        const links = Array.from(container?.querySelectorAll('.entity-link-row') || [])
          .map(r => ({
            url: r.querySelector('.entity-link-url')?.value.trim() || '',
            title: r.querySelector('.entity-link-title')?.value.trim() || '',
          }))
          .filter(l => l.url);
        // An empty list clears the field rather than storing [].
        data.fields[field.field_key] = links.length > 0 ? links : null;
      } else if (field.field_type === 'checkbox') {
        data.fields[field.field_key] = formData.get(field.field_key) === 'on';
      } else if (field.field_type === 'number') {
        data.fields[field.field_key] = value ? parseFloat(value) : null;
      } else if (field.field_type === 'recurrence') {
        data.fields[field.field_key] = value ? JSON.parse(value) : null;
      } else {
        data.fields[field.field_key] = value || null;
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

      // Add/remove rows for `links` fields. Delegated, so it covers every
      // links field on the form without per-field wiring.
      form.addEventListener('click', (e) => {
        const addBtn = e.target.closest('[data-action="add-link"]');
        if (addBtn) {
          const list = addBtn.closest('[data-field-type="links"]')?.querySelector('.entity-links-list');
          if (!list) return;
          list.insertAdjacentHTML('beforeend', `
            <div class="entity-link-row" style="display:flex; gap:4px; margin-bottom:4px;">
              <input type="url" class="form-control entity-link-url" placeholder="https://example.com" style="flex:2;">
              <input type="text" class="form-control entity-link-title" placeholder="Name (optional)" style="flex:1;">
              <button type="button" class="btn btn-outline-danger btn-sm" data-action="remove-link" title="Remove link" aria-label="Remove link">&times;</button>
            </div>
          `);
          list.querySelector('.entity-link-row:last-child .entity-link-url')?.focus();
          markChanged();
          return;
        }

        const removeBtn = e.target.closest('[data-action="remove-link"]');
        if (removeBtn) {
          removeBtn.closest('.entity-link-row')?.remove();
          markChanged();
        }
      });
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
      // Toggle close: if clicking same entity with no changes, close the editor
      if (currentEntityId === entityId && entityId !== null) {
        if (hasChanges) {
          return; // Don't close if there are unsaved changes
        }
        GenericEntity.close();
        return;
      }

      currentEntityId = entityId;
      hasChanges = false;
      currentIsFolder = !!entity.is_folder;
      typeSchema = typeConfig;

      // Use provided typeSlug or fall back to currentTypeSlug
      const typeSlugToUse = typeSlugOverride || currentTypeSlug;
      // Update currentTypeSlug if we're populating a different type
      if (typeSlugOverride) {
        currentTypeSlug = typeSlugOverride;
      }

      const formHtml = buildForm(typeConfig, entity);
      const editorPaneId = `${typeSlugToUse}-editor-pane`;
      const editorPane = document.getElementById(editorPaneId);
      if (!editorPane) {
        console.error(`[GenericEntity] editor pane not found: #${editorPaneId}`);
        return;
      }
      editorPane.innerHTML = formHtml;
      // Track the save button for this type
      currentSaveBtn = document.getElementById(`${typeSlugToUse}SaveBtn`);
      // Nothing has been edited yet, so there is nothing to save. Without this
      // the button kept whatever state it was left in - once any edit enabled
      // it, it stayed enabled for every item opened afterwards.
      if (currentSaveBtn) currentSaveBtn.disabled = true;
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
      const data = collectFormValues(typeSchema, currentIsFolder);
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
      currentIsFolder = false;
      // Clear the editor content
      const editorPaneId = `${currentTypeSlug}-editor-pane`;
      const editorPane = document.getElementById(editorPaneId);
      if (editorPane) editorPane.innerHTML = '';
      // Hide the pane
      const typeSplitPane = splitPanesByType[currentTypeSlug];
      if (typeSplitPane) typeSplitPane.hideRightPane();
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
