/**
 * Entity Type Editor
 * Handles creating and editing entity types with fields and relationships.
 *
 * The lists this builds (fields, parent types, child types) must NOT be given
 * their own max-height/overflow. They sit inside the editor pane, which already
 * scrolls, and a capped inner box means scrolling a small region nested inside
 * two other scrolling regions. Let them render at full height.
 *
 * This file builds its HTML with template literals, so a stray backtick - in a
 * comment as easily as in code - terminates a template early and breaks the
 * whole file, which takes the type editor down completely rather than failing
 * locally. Run `node --check` on this file after editing it.
 */

let currentEntityTypeModal = null;
let entityTypeSplitPane = null;

// Collapses the right-hand editor pane and clears it, mirroring
// GenericEntity.close() on the typed pages.
function closeEntityTypeEditor() {
  const pane = document.getElementById('entityType-editor-pane');
  const actionsEl = document.getElementById('entityTypeEditorActions');
  if (pane) pane.innerHTML = '';
  if (actionsEl) actionsEl.innerHTML = '';
  currentEditingType = null;
  entityTypeSplitPane?.hideRightPane();
  window.syncTypeRowSelection?.();
}

// Built once, when the Entity Types tab first renders.
function initEntityTypeSplitPane() {
  if (entityTypeSplitPane || !document.getElementById('entityTypeSplitPane')) return;
  // 50/50: the type editor is a form with fields, relationships and choice
  // lists, so it needs as much room as the list beside it.
  entityTypeSplitPane = new SplitPane(
    'entityTypeSplitPane',
    'entityTypeListPane',
    'entityTypeDivider',
    'entityTypeEditorPane',
    50
  );
}
window.initEntityTypeSplitPane = initEntityTypeSplitPane;
window.closeEntityTypeEditor = closeEntityTypeEditor;
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
        window.syncTypeRowSelection?.();
      }
    } catch (error) {
      console.error('Error loading entity type:', error);
      app.notify('Error loading entity type', 'danger');
    }
  } else {
    // New type
    currentEditingType = null;
    showEntityTypeEditorModal(null);
    window.syncTypeRowSelection?.();
  }
}

function showEntityTypeEditorModal(type) {
  const isNew = !type;
  // Nothing when editing: the type is selected in the list beside this pane, so
  // "Edit: X" repeated it. Creating has no selection to read, so it keeps a label.
  const title = isNew ? 'Create New Entity Type' : '';

  const content = document.createElement('div');
  content.innerHTML = `
    <form id="entityTypeForm">
      <div class="row mb-3 align-items-end">
        <div class="col-auto">
          <label class="form-label" title="Shown on the tab and beside every row. Avoid folder-like emoji - folders already use one.">Icon</label>
          <div>
            <button type="button" class="btn btn-outline-secondary type-icon-btn" id="typeIconBtn"
                    title="Click to choose an icon">${type?.icon || '❓'}</button>
            <input type="hidden" id="typeIcon" value="${type?.icon || ''}">
          </div>
        </div>
        <div class="col">
          <label class="form-label">Name *</label>
          <input type="text" class="form-control" id="typeName" placeholder="e.g., Project, Task" value="${type?.label || ''}" required>
        </div>
        <div class="col">
          <label class="form-label">Singular Form *</label>
          <input type="text" class="form-control" id="typeSingular" placeholder="e.g., Project, Task" value="${type?.label_singular || ''}" required>
        </div>
      </div>

      <!-- Fields Section -->
      <div class="mb-3">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h6 class="mb-0">Fields</h6>
          <button type="button" class="btn btn-sm btn-outline-primary" id="addFieldBtn" title="Add a field to this type. It appears in the editor for every row, and can be shown as a column.">+ Add Field</button>
        </div>
        <div id="fieldsList" style="border: 1px solid #ddd; border-radius: 4px; padding: 10px;">
          <!-- Fields will be added here -->
        </div>
      </div>

      <!-- Hierarchy sits with the relationships it governs: it decides whether
           a type can nest inside itself at all. -->
      <div class="mb-3">
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" id="typeHierarchy" ${type?.supports_hierarchy ? 'checked' : ''}>
          <label class="form-check-label" for="typeHierarchy">
            <strong>Supports Hierarchy</strong> - items can have parents/children of the same type
          </label>
        </div>
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" id="typeFolders" ${type === null || type === undefined || type.supports_folders === undefined || type.supports_folders ? 'checked' : ''}>
          <label class="form-check-label" for="typeFolders"
                 title="Folders group rows of this type. Turn it off for a type that is already a container - a template holds its contents directly, so a folder inside one adds nothing.">
            <strong>Can contain folders</strong> - off for types that are containers in their own right
          </label>
        </div>
      </div>

      <!-- Relationships Section -->
      <div class="mb-3">
        <h6>Type Relationships</h6>
        <div class="row">
          <div class="col-md-6">
            <label class="form-label" title="Types a row of this type may sit inside. Dailies is never listed - it is always implicitly a parent.">Can have parents:</label>
            <div id="parentTypesList" style="border: 1px solid #ddd; border-radius: 4px; padding: 8px;">
              <!-- Parent types will be listed here -->
            </div>
          </div>
          <div class="col-md-6">
            <label class="form-label" title="Types that may sit inside a row of this type.">Can have children:</label>
            <div id="childTypesList" style="border: 1px solid #ddd; border-radius: 4px; padding: 8px;">
              <!-- Child types will be listed here -->
            </div>
          </div>
        </div>
      </div>
    </form>
  `;

  const footer = document.createElement('div');
  footer.innerHTML = `
    <div class="btn-group" role="group" style="display: inline-flex; gap: 2px;">
      <button type="button" class="btn btn-sm btn-outline-secondary" id="entityTypeSaveBtn">Save</button>
      <button type="button" class="btn btn-sm btn-outline-secondary" id="entityTypeCancelBtn">Cancel</button>
      <button type="button" class="btn btn-sm btn-outline-danger" id="entityTypeDeleteBtn" style="display: ${isNew ? 'none' : 'inline-block'};">Delete</button>
    </div>
  `;

  // Rendered into the split-pane on the right rather than a floating modal, so
  // editing a type looks and behaves like editing anything else in this app.
  const pane = document.getElementById('entityType-editor-pane');
  const titleEl = document.getElementById('entityTypeEditorTitle');
  const actionsEl = document.getElementById('entityTypeEditorActions');
  if (!pane || !titleEl || !actionsEl) {
    console.error('[EntityTypeEditor] editor pane not found');
    return;
  }

  titleEl.textContent = title;
  pane.innerHTML = '';
  pane.appendChild(content);
  actionsEl.innerHTML = '';
  while (footer.firstChild) actionsEl.appendChild(footer.firstChild);

  entityTypeSplitPane?.showRightPane(50);   // half the width, matching init

  // Load types for relationships
  loadTypeRelationships(type);

  // Setup event handlers
  document.getElementById('entityTypeCancelBtn').addEventListener('click', closeEntityTypeEditor);
  document.getElementById('entityTypeSaveBtn').addEventListener('click', saveEntityType);

  if (!isNew) {
    document.getElementById('entityTypeDeleteBtn').addEventListener('click', deleteEntityType);
  }

  document.getElementById('addFieldBtn').addEventListener('click', addFieldRow);

  const iconBtn = document.getElementById('typeIconBtn');
  iconBtn?.addEventListener('click', () => openIconPicker(iconBtn, document.getElementById('typeIcon')));

  // Load existing fields if editing
  if (type && type.fields && type.fields.length > 0) {
    type.fields.forEach(field => {
      addFieldRow(field);
    });
  }
}

// Which roll-up modes make sense per field type. A type absent from this table
// is never offered a roll-up at all - that is how "only where it makes sense"
// is enforced structurally rather than by asking the user to be careful.
const ROLLUP_MODES = {
  status: [
    { value: '', label: 'No roll-up' },
    { value: 'status', label: 'Roll up: status of children' },
  ],
  number: [
    { value: '', label: 'No roll-up' },
    { value: 'sum', label: 'Roll up: sum' },
    { value: 'min', label: 'Roll up: minimum' },
    { value: 'max', label: 'Roll up: maximum' },
    { value: 'avg', label: 'Roll up: average' },
  ],
  date: [
    { value: '', label: 'No roll-up' },
    { value: 'min', label: 'Roll up: earliest' },
    { value: 'max', label: 'Roll up: latest' },
  ],
  checkbox: [
    { value: '', label: 'No roll-up' },
    { value: 'all', label: 'Roll up: all children' },
    { value: 'any', label: 'Roll up: any child' },
  ],
};

// Icons to choose from. Deliberately excludes 📁 and 📂: every hierarchical
// type can hold folders, which render with 📁, so a folder-like type icon makes
// items and the folders containing them indistinguishable. That rule is stated
// in src/database/systemEntityTypes.js and enforced by the schema seeders.
const ICON_CHOICES = [
  // Work + planning
  '⭐', '📍', '🎯', '✅', '☑️', '📝', '🗒️', '📋', '📌', '🔖', '🏷️', '🎟️',
  '📅', '📆', '🗓️', '⏰', '⏳', '⌛', '🔔', '🔕', '🚩', '🏁', '🎌',
  // Ideas + knowledge
  '💡', '🧠', '🔍', '🔎', '📖', '📚', '📓', '📔', '📕', '📗', '📘', '📙',
  '✏️', '🖊️', '🖍️', '🧾', '📄', '📃', '🗂️', '🗃️', '🗄️',
  // Build + technical
  '🚀', '🔧', '🛠️', '⚙️', '🧰', '🔩', '🪛', '🧱', '🏗️', '🖥️', '💻', '⌨️',
  '🖱️', '💾', '💿', '🗜️', '🔌', '🔋', '📡', '🛰️', '🧪', '🔬', '⚗️',
  // Status + signals
  '🔥', '⚡', '❗', '❓', '⚠️', '🚦', '🚧', '🛑', '✋', '👀', '🐛', '🩹',
  '♻️', '🔄', '🔁', '⏩', '⏸️', '▶️',
  // Data + money
  '📊', '📈', '📉', '🧮', '💰', '💳', '🏦', '💵',
  // People + comms
  '👤', '👥', '🤝', '💬', '🗣️', '📞', '☎️', '✉️', '📧', '📢', '📣', '🎧',
  // Places + things
  '🏠', '🏢', '🏛️', '🏭', '🌍', '🌐', '🧭', '🗺️', '✈️', '🚗', '🚚', '⛵',
  // Misc
  '🎨', '🎬', '🎵', '🎮', '🕹️', '🏆', '🥇', '🎁', '❤️', '⭕', '🔵', '🟢',
  '🟡', '🟠', '🔴', '🟣', '⚫', '⚪', '🔺', '🔷', '⬛', '⬜', '🧩', '🪄',
  '🔒', '🔑', '🛡️', '☁️', '🌙', '☀️', '🌱', '🌳', '🍀', '🧊', '🪵', '📦',
];

// Opens under the icon button; picking writes the hidden input the form reads.
function openIconPicker(btn, hiddenInput) {
  document.querySelectorAll('.type-icon-picker').forEach(el => el.remove());

  const picker = document.createElement('div');
  picker.className = 'type-icon-picker';
  picker.innerHTML = ICON_CHOICES
    .map(i => '<button type="button" class="type-icon-choice" data-icon="' + i + '">' + i + '</button>')
    .join('');
  document.body.appendChild(picker);

  const b = btn.getBoundingClientRect();
  const p = picker.getBoundingClientRect();
  picker.style.top = (b.bottom + window.innerHeight - b.bottom > p.height ? b.bottom + 4 : b.top - p.height - 4) + 'px';
  picker.style.left = Math.min(b.left, window.innerWidth - p.width - 8) + 'px';

  picker.addEventListener('click', (e) => {
    const choice = e.target.closest('.type-icon-choice');
    if (!choice) return;
    hiddenInput.value = choice.dataset.icon;
    btn.textContent = choice.dataset.icon;
    hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
    picker.remove();
  });

  const away = (e) => {
    if (picker.contains(e.target) || e.target === btn) return;
    picker.remove();
    document.removeEventListener('mousedown', away);
  };
  setTimeout(() => document.addEventListener('mousedown', away), 0);
}

// The emoji a field is configured with: the single default for `emoji`, or the
// whole set for `emojis`. Rendered as plain text so it round-trips through the
// hidden input without any encoding games.
function EMOJI_CONFIG_OF(field) {
  const o = field?.field_options || {};
  if (field?.field_type === 'emojis') return (o.values || []).join('');
  if (field?.field_type === 'emoji') return o.default || '';
  return '';
}

// Field types whose choices are edited as a list rather than a comma string.
// `status` is included deliberately: without it a user-created status field had
// no way to declare its values at all, so it saved with none and the row badge
// had nothing to show.
const LIST_TYPES = ['select', 'radio', 'status'];

function addFieldRow(field = null) {
  const fieldsList = document.getElementById('fieldsList');
  const fieldRow = document.createElement('div');
  fieldRow.className = 'field-row mb-2 p-2 bg-light rounded';
  fieldRow.draggable = true;

  const fieldOptions = field?.field_options ? (typeof field.field_options === 'string' ? JSON.parse(field.field_options) : field.field_options) : null;
  const optionsStr = fieldOptions?.values ? fieldOptions.values.join(', ') : '';

  // Every field type the generic renderer supports must appear in the
  // field-type select below. A select element falls back to its first option
  // when the current value is not listed, so a missing option silently
  // rewrites the field's type on save - status and recurrence were both
  // missing, which downgraded them to text and dropped the rest of the type's
  // fields. Keep this list in sync with fieldRenderers in genericEntity.js.
  //
  // The markup below is a template literal: never use backticks inside it or
  // in comments placed within it.

  // Fields the engine owns. Worked Time accumulates from the focus clock, the
  // board and focus bar keep their own bookkeeping here, and a type that loses
  // one stops working in a way that shows up nowhere until the feature is
  // used. They are editable - rename Worked Time if you like - but not
  // removable.
  const LOCKED_FIELD_KEYS = new Set([
    'focus_seconds', 'focus_slot', 'focus_started_at', 'focus_color',
    'board_bay', 'board_order',
  ]);
  const isLocked = LOCKED_FIELD_KEYS.has(field?.field_key);

  fieldRow.innerHTML = `
    <div class="row g-2 align-items-center">
      <div class="col-auto">
        <span class="field-drag-handle" title="Drag to reorder" style="cursor: grab; user-select: none; font-size: 0.8em; color: #999;">⋮⋮</span>
      </div>
      <div class="col">
        <input type="text" class="form-control form-control-sm field-label" placeholder="Field name" value="${field?.label || ''}" required>
        <input type="hidden" class="field-key" value="${field?.field_key || ''}">
      </div>
      <div class="col">
        <select class="form-select form-select-sm field-type">
          <option value="text" ${field?.field_type === 'text' ? 'selected' : ''}>Text</option>
          <option value="textarea" ${field?.field_type === 'textarea' ? 'selected' : ''}>Long Text</option>
          <option value="number" ${field?.field_type === 'number' ? 'selected' : ''}>Number</option>
          <option value="duration" ${field?.field_type === 'duration' ? 'selected' : ''}>Duration (worked time)</option>
          <option value="date" ${field?.field_type === 'date' ? 'selected' : ''}>Date</option>
          <option value="url" ${field?.field_type === 'url' ? 'selected' : ''}>URL (single link)</option>
          <option value="links" ${field?.field_type === 'links' ? 'selected' : ''}>Links (multiple, named)</option>
          <option value="select" ${field?.field_type === 'select' ? 'selected' : ''}>Dropdown</option>
          <option value="radio" ${field?.field_type === 'radio' ? 'selected' : ''}>Radio Buttons</option>
          <option value="checkbox" ${field?.field_type === 'checkbox' ? 'selected' : ''}>Checkbox</option>
          <option value="status" ${field?.field_type === 'status' ? 'selected' : ''}>Status</option>
          <option value="priority" ${field?.field_type === 'priority' ? 'selected' : ''}>Priority (Low to Critical)</option>
          <option value="emoji" ${field?.field_type === 'emoji' ? 'selected' : ''}>Emoji (free pick)</option>
          <option value="emojis" ${field?.field_type === 'emojis' ? 'selected' : ''}>Emojis (cycle through a set)</option>
        </select>
      </div>
      <div class="col-auto field-emoji-col" style="display: ${['emoji', 'emojis'].includes(field?.field_type) ? 'block' : 'none'};">
        <span class="field-emoji-list">${EMOJI_CONFIG_OF(field)}</span>
        <button type="button" class="btn btn-sm btn-outline-secondary field-emoji-add" title="Add an emoji">+</button>
        <input type="hidden" class="field-emoji-values" value="${EMOJI_CONFIG_OF(field)}">
      </div>
      <div class="col field-options-col" style="display: ${LIST_TYPES.includes(field?.field_type) ? 'block' : 'none'};">
        <div class="d-flex gap-1 align-items-center">
          <select class="form-select form-select-sm field-options-list" title="The choices this field offers"></select>
          <button type="button" class="btn btn-sm btn-outline-secondary field-option-add" title="Add a choice">+</button>
          <button type="button" class="btn btn-sm btn-outline-danger field-option-del" title="Remove the selected choice">&minus;</button>
        </div>
        <input type="hidden" class="field-options" value="${optionsStr}">
      </div>
      <div class="col field-checkbox-options-col" style="display: ${field?.field_type === 'checkbox' ? 'block' : 'none'};">
        <input type="text" class="form-control form-control-sm field-checkbox-options" placeholder="Options (comma-separated)" value="${field?.field_type === 'checkbox' ? optionsStr : ''}">
      </div>
      <div class="col-auto field-rollup-col" style="display: ${ROLLUP_MODES[field?.field_type] ? 'block' : 'none'};">
        <select class="form-select form-select-sm field-rollup" title="How a folder derives this field from the items inside it">
          ${(ROLLUP_MODES[field?.field_type] || []).map(m =>
            '<option value="' + m.value + '"' + (field?.rollup === m.value ? ' selected' : '') + '>' + m.label + '</option>'
          ).join('')}
        </select>
      </div>
      <div class="col-auto ms-auto">
        <div class="form-check form-switch" title="Show this field as a column in the row">
          <input class="form-check-input field-show-in-row" type="checkbox" ${field?.show_in_row ? 'checked' : ''}>
          <label class="form-check-label small text-muted">Column</label>
        </div>
      </div>
      <div class="col-auto">
        <div class="form-check form-switch" title="Show this column's name in the header">
          <input class="form-check-input field-show-label" type="checkbox" ${field?.show_column_label !== 0 && field?.show_column_label !== false ? 'checked' : ''}>
          <label class="form-check-label small text-muted">Name</label>
        </div>
      </div>
      <div class="col-auto">
        ${isLocked
          ? '<span class="field-locked" title="Kept by the app - this field cannot be removed">🔒</span>'
          : '<button type="button" class="btn btn-sm btn-outline-danger remove-field-btn">×</button>'}
      </div>
    </div>
  `;

  fieldsList.appendChild(fieldRow);

  const fieldTypeSelect = fieldRow.querySelector('.field-type');
  const optionsCol = fieldRow.querySelector('.field-options-col');

  // Show/hide options input based on field type
  // ----- choice list (dropdown / radio / status) -----
  const optionsHidden = fieldRow.querySelector('.field-options');
  const optionsList = fieldRow.querySelector('.field-options-list');

  const readOptions = () =>
    optionsHidden.value.split(',').map(v => v.trim()).filter(Boolean);

  const paintOptions = () => {
    const vals = readOptions();
    optionsList.innerHTML = vals.length
      ? vals.map(v => `<option value="${v.replace(/"/g, '&quot;')}">${v}</option>`).join('')
      : '<option value="">(no choices yet)</option>';
  };
  paintOptions();

  fieldRow.querySelector('.field-option-add').addEventListener('click', async () => {
    const value = await app.prompt('What should this choice be called?', {
      title: 'Add a choice', placeholder: 'e.g. In Review',
    });
    if (!value) return;
    const vals = readOptions();
    if (vals.includes(value)) return;
    optionsHidden.value = [...vals, value].join(', ');
    paintOptions();
    optionsList.value = value;
  });

  fieldRow.querySelector('.field-option-del').addEventListener('click', () => {
    const chosen = optionsList.value;
    if (!chosen) return;
    optionsHidden.value = readOptions().filter(v => v !== chosen).join(', ');
    paintOptions();
  });

  const emojiCol = fieldRow.querySelector('.field-emoji-col');
  const emojiList = fieldRow.querySelector('.field-emoji-list');
  const emojiValues = fieldRow.querySelector('.field-emoji-values');

  fieldRow.querySelector('.field-emoji-add').addEventListener('click', async (ev) => {
    const picked = await app.pickEmoji(ev.currentTarget);
    if (picked === null) return;
    if (!picked) { emojiValues.value = ''; emojiList.textContent = ''; return; }
    // `emoji` holds one default; `emojis` accumulates the set to cycle through.
    emojiValues.value = fieldTypeSelect.value === 'emojis'
      ? [...new Set([...Array.from(emojiValues.value), picked])].join('')
      : picked;
    emojiList.textContent = emojiValues.value;
  });

  // Clicking an emoji in the list removes it from the set.
  emojiList.addEventListener('click', (ev) => {
    if (fieldTypeSelect.value !== 'emojis') return;
    const chars = Array.from(emojiValues.value);
    if (!chars.length) return;
    chars.pop();
    emojiValues.value = chars.join('');
    emojiList.textContent = emojiValues.value;
  });

  // A status field's roles (which value means done, failed, ignored) have no UI
  // here, but they MUST survive a save. Stashed on the row rather than written
  // into the markup, so no escaping question arises. Without this, saving a type
  // rebuilt field_options from the visible inputs alone and silently dropped
  // them - which is how types ended up with doneValues = ['Ignored'].
  fieldRow.dataset.statusRoles = JSON.stringify({
    doneValues: fieldOptions?.doneValues || null,
    failedValues: fieldOptions?.failedValues || null,
    ignoredValues: fieldOptions?.ignoredValues || null,
  });

  const rollupCol = fieldRow.querySelector('.field-rollup-col');
  const rollupSelect = fieldRow.querySelector('.field-rollup');

  const checkboxOptionsCol = fieldRow.querySelector('.field-checkbox-options-col');

  fieldTypeSelect.addEventListener('change', () => {
    optionsCol.style.display = LIST_TYPES.includes(fieldTypeSelect.value) ? 'block' : 'none';
    checkboxOptionsCol.style.display = fieldTypeSelect.value === 'checkbox' ? 'block' : 'none';

    // Re-offer only the modes valid for the new type. Without this, changing a
    // number field to text would leave a stale 'sum' selected and saved.
    emojiCol.style.display = ['emoji', 'emojis'].includes(fieldTypeSelect.value) ? 'block' : 'none';

    const modes = ROLLUP_MODES[fieldTypeSelect.value];
    rollupCol.style.display = modes ? 'block' : 'none';
    rollupSelect.innerHTML = (modes || [])
      .map(m => '<option value="' + m.value + '">' + m.label + '</option>')
      .join('');
    if (!modes) rollupSelect.value = '';
  });

  // Remove button
  // Locked fields render a padlock in place of the button, so there is nothing
  // to bind here.
  fieldRow.querySelector('.remove-field-btn')?.addEventListener('click', () => {
    fieldRow.remove();
  });

  // Drag and drop for reordering
  fieldRow.addEventListener('dragstart', (e) => {
    e.dataTransfer.effectAllowed = DRAG_EFFECT_ALLOWED;
    fieldRow.classList.add('dragging');
  });

  fieldRow.addEventListener('dragend', () => {
    fieldRow.classList.remove('dragging');
    document.querySelectorAll('.field-row').forEach(row => row.classList.remove('drag-over'));
  });

  fieldRow.addEventListener('dragover', (e) => {
    acceptDrop(e, 'move');
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

// Which types can appear in the "Can have parents" / "Can have children" lists.
//
// Excluded, and why:
//  - Dailies (work_item) and the daily type: a daily is never a child of
//    anything, and it is implicitly a parent of everything, so offering it in
//    either list is either wrong or a no-op the user has to keep re-ticking.
//  - Outlook Calendar (type_category 'external'): an import source, not a
//    regular type - it has no place in hand-authored relationship rules.
function canBeRelated(t) {
  if (t.type_category === 'external') return false;
  if (t.type_category === 'daily') return false;
  if (t.slug === 'work_item') return false;
  return true;
}

async function loadTypeRelationships(type) {
  try {
    const response = await fetch('/api/entity-types');
    const result = await response.json();
    if (result.success) {
      const types = result.data || [];
      const otherTypes = types.filter(t => (!type || t.id !== type.id) && canBeRelated(t));

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
    // A new type needs a slug and the form has no field for one - it is derived
    // from the Name, the same way a field's storage key is derived from its
    // label. Creating a type failed with "slug is required" without this.
    //
    // Only ever sent when CREATING. An existing type's slug is its identity -
    // tabs, ?tab= URLs, relationship rules and the generic engine all key off
    // it - so renaming a type must never move it.
    ...(currentEditingType ? {} : {
      slug: document.getElementById('typeName').value
        .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
    }),
    label: document.getElementById('typeName').value,
    label_singular: document.getElementById('typeSingular').value,
    icon: document.getElementById('typeIcon').value || null,
    supports_hierarchy: document.getElementById('typeHierarchy').checked,
    supports_folders: document.getElementById('typeFolders')?.checked ?? true,
    fields: Array.from(document.querySelectorAll('.field-row')).map(row => {
      const fieldType = row.querySelector('.field-type').value;
      // The storage key is derived from the label rather than typed twice.
      // It is only ever set for a NEW field: changing an existing field's key
      // would orphan every value already stored under the old one, so the
      // hidden input keeps it once assigned. entityTypeService normalises it
      // the same way.
      const label = row.querySelector('.field-label').value;
      const keyInput = row.querySelector('.field-key');
      if (!keyInput.value) {
        keyInput.value = label.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_|_$/g, '');
      }
      const fieldData = {
        field_key: keyInput.value,
        label,
        field_type: fieldType,
        // Which columns a page shows is this one value, edited either here or
        // through the column chooser on the page itself - one value, two views.
        show_in_row: row.querySelector('.field-show-in-row').checked,
        show_column_label: row.querySelector('.field-show-label').checked,
        // A status field with no roll-up mode leaves every folder of that type
        // blank no matter what it contains, which is never what someone means
        // by adding a status. The select is empty until its type is chosen, so
        // saving before touching it used to store null - default it instead.
        rollup: row.querySelector('.field-rollup')?.value
          || (fieldType === 'status' ? 'status' : null)
      };

      // Emoji configuration: one default, or the set to cycle through.
      if (fieldType === 'emoji' || fieldType === 'emojis') {
        const chars = Array.from(row.querySelector('.field-emoji-values').value || '');
        if (chars.length) {
          fieldData.field_options = fieldType === 'emojis'
            ? { values: chars }
            : { default: chars[0] };
        }
      }

      // Choices for the list types, and for checkbox from its own input.
      if (LIST_TYPES.includes(fieldType) || fieldType === 'checkbox') {
        const input = fieldType === 'checkbox'
          ? row.querySelector('.field-checkbox-options')
          : row.querySelector('.field-options');
        if (input && input.value.trim()) {
          const values = input.value.split(',').map(v => v.trim()).filter(v => v);
          if (values.length > 0) {
            fieldData.field_options = { values };
            // A status needs to know which value means finished, failed or
            // ignored - the row badge, the colours and the folder roll-up all
            // key off those, not off position.
            //
            // Previously this set doneValues to the LAST value and wrote
            // nothing else, which was wrong twice over: it discarded whatever
            // the field already knew, and the standard ladder ends in
            // "Ignored", so every saved type came back claiming Ignored meant
            // done - showing Complete and Failed as merely in-progress.
            if (fieldType === 'status') {
              let prev = {};
              try { prev = JSON.parse(row.dataset.statusRoles || '{}'); } catch { prev = {}; }
              // Keep only roles whose value still exists in the list.
              const keep = (l) => (Array.isArray(l) ? l.filter(v => values.includes(v)) : []);
              const byName = (re) => values.filter(v => re.test(v));

              const done = keep(prev.doneValues).length ? keep(prev.doneValues)
                : (byName(/^(complete|completed|done|ready|finished|closed)$/i).length
                    ? byName(/^(complete|completed|done|ready|finished|closed)$/i)
                    : [values[values.length - 1]]);
              const failed = keep(prev.failedValues).length ? keep(prev.failedValues) : byName(/^(failed|failure|blocked)$/i);
              const ignored = keep(prev.ignoredValues).length ? keep(prev.ignoredValues) : byName(/^(ignored|ignore|skipped|parked)$/i);

              fieldData.field_options.doneValues = done;
              if (failed.length) fieldData.field_options.failedValues = failed;
              if (ignored.length) fieldData.field_options.ignoredValues = ignored;
            }
          }
        }
      }

      return fieldData;
    })
  };

  try {
    const url = currentEditingType ? `/api/entity-types/${currentEditingType.id}` : '/api/entity-types';
    const method = currentEditingType ? 'PUT' : 'POST';

    const response = await app.fetchRaw(url, {
      method,
      
      body: JSON.stringify(typeData)
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Entity type saved', 'success');
      // Stay open on what was just saved. This used to close the editor and
      // reload the whole page, which threw away your place for every edit.
      const savedId = result.data?.id || currentEditingType?.id;
      await loadEntityTypesUI();
      if (savedId) await openEntityTypeEditor(savedId);
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
  if (!(await app.confirm(`Delete entity type "${currentEditingType.label}"?`, 'Confirm Delete'))) return;

  try {
    const response = await app.fetchRaw(`/api/entity-types/${currentEditingType.id}`, {
      method: 'DELETE' });

    const result = await response.json();
    if (result.success) {
      app.notify('Entity type deleted', 'success');
      // Deleting genuinely has nothing left to show, so this one does close.
      closeEntityTypeEditor();
      await loadEntityTypesUI();
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error deleting entity type:', error);
    app.notify('Error deleting entity type', 'danger');
  }
}
