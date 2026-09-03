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

// Engine-managed fields the user should never see, here or in a record's own
// row editor. Kept in step with INTERNAL_FIELD_KEYS in genericEntity.js -
// this file and that one run on different pages (Settings vs. a dashboard
// tab), neither loads the other's script, so there is no single object to
// import this from. A NARROWER set than LOCKED_FIELD_KEYS below: Worked Time
// is engine-written too and stays out of removal/deletion, but a person is
// meant to read and correct it by hand, so it is not hidden.
const HIDDEN_FIELD_KEYS = new Set([
  'focus_slot', 'focus_started_at', 'focus_color', 'focus_monitor',
  'board_bay', 'board_order',
]);

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

// Set only while CREATING via the "+ New Tab" action (settings-entity-
// types.js), never while editing an existing type - is_workspace is not
// something a save can change once a type exists (entityTypeService.js's
// updateEntityType ignores it), so this only needs to answer "am I building
// a new one right now."
let creatingAsWorkspace = false;

// Field keys the user REMOVED in this editing session.
//
// Deletion used to be signalled by absence: the row was taken out of the DOM,
// so the field was missing from the array, so the server deleted it. Absence
// meant two different things - "the user removed this" and "the form could not
// draw this" - and the server could not tell them apart. That is how fields the
// editor had no <option> for were destroyed, and how a save that ran before the
// field rows rendered would have taken everything with it.
//
// Now absence means nothing and this set means delete.
let removedFieldKeys = new Set();

async function openEntityTypeEditor(typeId = null, opts = {}) {
  removedFieldKeys = new Set();          // a fresh session removes nothing yet
  // Only meaningful when also creating (typeId is null) - reopening an
  // existing type after a save (openEntityTypeEditor(savedId), no opts)
  // correctly clears it back to false here.
  creatingAsWorkspace = !typeId && !!opts.workspace;
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
  const isWorkspace = isNew ? creatingAsWorkspace : !!type?.is_workspace;
  // Nothing when editing: the type is selected in the list beside this pane, so
  // "Edit: X" repeated it. Creating has no selection to read, so it keeps a label.
  const title = isNew ? (isWorkspace ? 'Create New Custom Tab' : 'Create New Entity Type') : '';

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

      ${isWorkspace ? `
        <!-- A custom tab has none of the sections below by design: no fields
             of its own (it holds rows of OTHER types, never its own), hierarchy
             and folders are forced on server-side because there is no other
             way to nest anything inside it, and it already holds every
             editable type automatically (ensureWorkspaceChildRules in
             entityTypeService.js) - there is nothing to hand-pick here. -->
        <div class="alert alert-secondary" role="note">
          <i class="bi bi-info-circle"></i>
          A custom tab has no fields of its own. Drag rows in from other tabs, or
          right-click inside it once created to add rows of any existing type.
        </div>
      ` : `
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
        <label class="form-label" title="Types that may sit inside a row of this type.">Can have children:</label>
        <div id="childTypesList" style="border: 1px solid #ddd; border-radius: 4px; padding: 8px;">
          <!-- Child types will be listed here -->
        </div>
      </div>
      `}
    </form>
  `;

  const footer = document.createElement('div');
  footer.innerHTML = `
    <div class="btn-group" role="group" style="display: inline-flex; gap: 2px;">
      <button type="button" class="btn btn-sm btn-outline-success" id="entityTypeSaveBtn">Save</button>
      <button type="button" class="btn btn-sm btn-outline-secondary" id="entityTypeCancelBtn">Cancel</button>
      <button type="button" class="btn btn-sm btn-outline-danger" id="entityTypeDeleteBtn" style="display: ${isNew || type?.is_system ? 'none' : 'inline-block'};">Delete</button>
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

  if (!isNew && !type?.is_system) {
    document.getElementById('entityTypeDeleteBtn').addEventListener('click', deleteEntityType);
  }

  // Not `addFieldRow` directly: addEventListener calls a handler with the
  // click Event as its first argument, and addFieldRow's `field = null`
  // default only applies when called with NO argument - so the row this
  // built out was never really "new", it was a field whose every property
  // read as undefined off an Event object. That happened to look right for
  // the type/name/lock fields (all read through `field?.x`, undefined either
  // way) and happened to look WRONG for anything checking `field` itself as
  // a boolean - the auto-default-name tracking below, and where the row gets
  // inserted.
  // Not rendered while CREATING a custom tab - see showEntityTypeEditorModal.
  document.getElementById('addFieldBtn')?.addEventListener('click', () => addFieldRow());

  const iconBtn = document.getElementById('typeIconBtn');
  iconBtn?.addEventListener('click', () => openIconPicker(iconBtn, document.getElementById('typeIcon')));

  // Load existing fields if editing. Internal ones are never rendered as a
  // row - see HIDDEN_FIELD_KEYS - which is safe to just omit: a field is only
  // ever deleted by entityTypeService because removed_field_keys named it, not
  // because a save's field list left it out (see updateEntityType).
  //
  // is_folder_field rows are the same story for every type EXCEPT Folder
  // itself: they are propagated COPIES of what the Folder type declares
  // (entityTypeService.js's propagateFolderField*()), not fields this type
  // defines. Editing one here would change it only for THIS type, which is
  // exactly the drift propagation exists to avoid - and because omission
  // never deletes, leaving the row out of this type's own field list is
  // enough; the copy is untouched. On the Folder type itself these rows ARE
  // the type's own fields (they are the master, is_folder_field is 0 there),
  // so nothing is hidden.
  if (type && type.fields && type.fields.length > 0) {
    type.fields.forEach(field => {
      if (HIDDEN_FIELD_KEYS.has(field.field_key)) return;
      if (field.is_folder_field && type.slug !== 'folder') return;
      addFieldRow(field);
    });
  }

  // LAST, after the field rows exist. Called before them it disabled the seven
  // controls in the form's header and left the ninety-odd inside the fields
  // untouched, which looks locked and is not.
  applyReadOnly(type);
}

// Which roll-up modes make sense per field type. A type absent from this table
// is never offered a roll-up at all - that is how "only where it makes sense"
// is enforced structurally rather than by asking the user to be careful.
// A field whose type this list does not offer still has to come back UNCHANGED.
//
// Without an <option> for it nothing is selected, so the browser falls back to
// the first one - Text - and saving the type silently retypes the field. That
// is not hypothetical: it is how `status` and `recurrence` fields were rewritten
// to `text` once already, taking their options with them.
//
// The field_type ENUM is the authority on what may exist, and it is wider than
// this list on purpose: `recurrence` is a permitted value with no editor of its
// own because the feature was withdrawn. Anything in that position now gets a
// selected option naming itself, so a save is a no-op for it rather than a
// silent coercion.
function UNLISTED_TYPE_OPTION(field) {
  const type = field?.field_type;
  if (!type || KNOWN_FIELD_TYPES.includes(type)) return '';
  return `<option value="${app.escapeHtml(type)}" selected>${app.escapeHtml(type)} (kept as-is)</option>`;
}

// Exactly the values offered by the <select> above - kept beside it so the two
// cannot drift apart without the drift being obvious.
const KNOWN_FIELD_TYPES = [
  'text', 'textarea', 'number', 'duration', 'timebox', 'date', 'url', 'links',
  'select', 'radio', 'checkbox', 'status', 'priority', 'emoji', 'emojis',
  'notes', 'stickies', 'worked_with_claude', 'person', 'group',
];

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
  // A time box is minutes, so a folder can total what is planned inside it -
  // which is what `time_box_minutes` used to do before Dailies converged on
  // this field. Without an entry here the mode ships but cannot be seen or
  // changed.
  timebox: [
    { value: '', label: 'No roll-up' },
    { value: 'sum', label: 'Roll up: total time boxed' },
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
  // used. Locked, full stop - name, type, options, column visibility, all of
  // it - because any of those can break what writes to the field (a renamed
  // Worked Time is still what the focus clock accumulates into; a retyped
  // focus_color is still what the focus bar expects to read a hex string
  // from). The one thing still allowed is dragging it to a different
  // position - order is display-only and the engine does not care about it.
  // Draws the padlock. ENFORCEMENT is server-side, in entityTypeService's
  // ENGINE_OWNED_FIELD_KEYS - this list alone left the lock decorative, since
  // the save path deletes any field the payload merely omits. Keep the two in
  // step; `focus_monitor` was missing here while the focus bar wrote it.
  const LOCKED_FIELD_KEYS = new Set([
    'focus_seconds', 'focus_slot', 'focus_started_at', 'focus_color',
    'focus_monitor', 'board_bay', 'board_order',
  ]);
  const isLocked = LOCKED_FIELD_KEYS.has(field?.field_key);

  // A brand new row has no type of its own yet - default it to Text rather
  // than whatever the field-type <select> happens to list first now that its
  // options are alphabetical. Everything below keys off this instead of
  // `field?.field_type` directly, so a fresh row and a loaded one agree on
  // what "the current type" means.
  const effectiveType = field?.field_type || 'text';

  // What a new field is named before anyone types a name of their own -
  // keyed by field_type, so it reads as "this field holds a date" rather than
  // the placeholder "Field name". Kept in step with the <select> options
  // below by design (same value attributes), not by sharing one list with
  // them - those options carry parenthetical detail ("Duration (worked
  // time)") that makes a poor field name on its own.
  const DEFAULT_FIELD_LABEL = {
    text: 'Text', textarea: 'Long Text', number: 'Number', duration: 'Duration',
    timebox: 'Time Box', date: 'Date', url: 'URL', links: 'Links',
    select: 'Dropdown', radio: 'Choice', checkbox: 'Checkbox', status: 'Status',
    priority: 'Priority', emoji: 'Emoji', emojis: 'Emojis', notes: 'Notes',
    stickies: 'Sticky Note', worked_with_claude: 'AI', person: 'Person', group: 'Group',
  };

  fieldRow.innerHTML = `
    <div class="row g-2 align-items-center">
      <div class="col-auto">
        <span class="field-drag-handle" title="Drag to reorder" style="cursor: grab; user-select: none; font-size: 0.8em; color: #999;">⋮⋮</span>
      </div>
      <div class="col">
        <input type="text" class="form-control form-control-sm field-label" placeholder="Field name" value="${field?.label || DEFAULT_FIELD_LABEL[effectiveType] || ''}" required ${isLocked ? 'disabled' : ''}>
        <input type="hidden" class="field-key" value="${field?.field_key || ''}">
      </div>
      <div class="col">
        <select class="form-select form-select-sm field-type" ${isLocked ? 'disabled' : ''}>
          <option value="worked_with_claude" ${effectiveType === 'worked_with_claude' ? 'selected' : ''}>AI (yes/no toggle)</option>
          <option value="checkbox" ${effectiveType === 'checkbox' ? 'selected' : ''}>Checkbox</option>
          <option value="date" ${effectiveType === 'date' ? 'selected' : ''}>Date</option>
          <option value="select" ${effectiveType === 'select' ? 'selected' : ''}>Dropdown</option>
          <option value="duration" ${effectiveType === 'duration' ? 'selected' : ''}>Duration (worked time)</option>
          <option value="emoji" ${effectiveType === 'emoji' ? 'selected' : ''}>Emoji (free pick)</option>
          <option value="emojis" ${effectiveType === 'emojis' ? 'selected' : ''}>Emojis (cycle through a set)</option>
          <option value="group" ${effectiveType === 'group' ? 'selected' : ''}>Group (Entra ID search)</option>
          <option value="links" ${effectiveType === 'links' ? 'selected' : ''}>Links (multiple, named)</option>
          <option value="textarea" ${effectiveType === 'textarea' ? 'selected' : ''}>Long Text</option>
          <option value="notes" ${effectiveType === 'notes' ? 'selected' : ''}>Notes (your own)</option>
          <option value="number" ${effectiveType === 'number' ? 'selected' : ''}>Number</option>
          <option value="person" ${effectiveType === 'person' ? 'selected' : ''}>Person (Entra ID search)</option>
          <option value="priority" ${effectiveType === 'priority' ? 'selected' : ''}>Priority (Low to Critical)</option>
          <option value="radio" ${effectiveType === 'radio' ? 'selected' : ''}>Radio Buttons</option>
          <option value="status" ${effectiveType === 'status' ? 'selected' : ''}>Status</option>
          <option value="stickies" ${effectiveType === 'stickies' ? 'selected' : ''}>Sticky note (own floating window)</option>
          <option value="text" ${effectiveType === 'text' ? 'selected' : ''}>Text</option>
          <option value="timebox" ${effectiveType === 'timebox' ? 'selected' : ''}>Time Box (15m to 2h)</option>
          <option value="url" ${effectiveType === 'url' ? 'selected' : ''}>URL (single link)</option>
          ${UNLISTED_TYPE_OPTION(field)}
        </select>
      </div>
      <div class="col-auto field-emoji-col" style="display: ${['emoji', 'emojis'].includes(effectiveType) ? 'block' : 'none'};">
        <span class="field-emoji-list">${EMOJI_CONFIG_OF(field)}</span>
        <button type="button" class="btn btn-sm btn-outline-secondary field-emoji-add" title="Add an emoji" ${isLocked ? 'disabled' : ''}>+</button>
        <input type="hidden" class="field-emoji-values" value="${EMOJI_CONFIG_OF(field)}">
      </div>
      <div class="col field-options-col" style="display: ${LIST_TYPES.includes(effectiveType) ? 'block' : 'none'};">
        <div class="d-flex gap-1 align-items-center">
          <select class="form-select form-select-sm field-options-list" title="The choices this field offers" ${isLocked ? 'disabled' : ''}></select>
          <button type="button" class="btn btn-sm btn-outline-secondary field-option-add" title="Add a choice" ${isLocked ? 'disabled' : ''}>+</button>
          <button type="button" class="btn btn-sm btn-outline-danger field-option-del" title="Remove the selected choice" ${isLocked ? 'disabled' : ''}>&minus;</button>
        </div>
        <input type="hidden" class="field-options" value="${optionsStr}">
      </div>
      <div class="col field-checkbox-options-col" style="display: ${effectiveType === 'checkbox' ? 'block' : 'none'};">
        <input type="text" class="form-control form-control-sm field-checkbox-options" placeholder="Options (comma-separated)" value="${effectiveType === 'checkbox' ? optionsStr : ''}" ${isLocked ? 'disabled' : ''}>
      </div>
      <div class="col-auto field-rollup-col" style="display: ${ROLLUP_MODES[effectiveType] ? 'block' : 'none'};">
        <select class="form-select form-select-sm field-rollup" title="How a folder derives this field from the items inside it" ${isLocked ? 'disabled' : ''}>
          ${(ROLLUP_MODES[effectiveType] || []).map(m =>
            '<option value="' + m.value + '"' + (field?.rollup === m.value ? ' selected' : '') + '>' + m.label + '</option>'
          ).join('')}
        </select>
      </div>
      <div class="col-auto ms-auto">
        <div class="form-check form-switch" title="Show this field as a column in the row">
          <input class="form-check-input field-show-in-row" type="checkbox" ${field?.show_in_row ? 'checked' : ''} ${isLocked ? 'disabled' : ''}>
          <label class="form-check-label small text-muted">Column</label>
        </div>
      </div>
      <div class="col-auto">
        <div class="form-check form-switch" title="Show this column's name in the header">
          <input class="form-check-input field-show-label" type="checkbox" ${field?.show_column_label !== 0 && field?.show_column_label !== false ? 'checked' : ''} ${isLocked ? 'disabled' : ''}>
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

  // A stored field_type with no <option> must still round-trip.
  //
  // saveEntityType reads .field-type.value, and a <select> whose value matches
  // no option reports its FIRST option instead - 'text'. So opening a type in
  // Settings and pressing Save silently rewrote any field whose type the editor
  // could not render. That is how status and recurrence fields were destroyed
  // once already; the option list has since drifted again (the DB ENUM allows
  // 'recurrence', this <select> does not).
  //
  // Rather than chase the list, carry the unknown value: add an option for it so
  // the select round-trips the stored type untouched. It is disabled so nobody
  // can newly pick a type the editor has no UI for, but an existing field keeps
  // what it has.
  const typeSelect = fieldRow.querySelector('.field-type');
  const storedType = field?.field_type;
  if (storedType && !typeSelect.querySelector(`option[value="${storedType}"]`)) {
    const opt = document.createElement('option');
    opt.value = storedType;
    opt.textContent = `${storedType} (not editable here)`;
    opt.disabled = true;
    opt.selected = true;
    typeSelect.appendChild(opt);
  }

  // Loading an existing type calls this once per field, in the order that IS
  // the saved display_order - appending preserves it. "+ Add Field" calls it
  // with no field at all, and a brand new row belongs at the top: the fields
  // list can run long, and appending put a freshly added row wherever the
  // scroll happened to be, effectively invisible until you scrolled to find
  // it.
  if (field) {
    fieldsList.appendChild(fieldRow);
  } else {
    fieldsList.insertBefore(fieldRow, fieldsList.firstChild);
  }

  const fieldTypeSelect = fieldRow.querySelector('.field-type');
  const labelInput = fieldRow.querySelector('.field-label');
  const optionsCol = fieldRow.querySelector('.field-options-col');

  // The name tracks the type for as long as it still READS like a default -
  // a fresh row starts out that way by construction, and a saved field
  // qualifies too if it was never renamed off its type's default (someone
  // added a Date field and left it called "Date"). Changing the type then
  // updates the name the same way in both cases - one rule, not "new fields
  // only". A custom name never matches this, so it's never touched; typing
  // one turns tracking off for good, even if what's left matches a default by
  // coincidence (typing "Date" into a Date field should not keep rewriting
  // itself on every later type change).
  let labelIsAutoDefault = labelInput.value === (DEFAULT_FIELD_LABEL[effectiveType] || '');
  labelInput.addEventListener('input', () => { labelIsAutoDefault = false; });

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
  emojiList.addEventListener('click', () => {
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
    if (labelIsAutoDefault) {
      labelInput.value = DEFAULT_FIELD_LABEL[fieldTypeSelect.value] || '';
    }

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
    const key = fieldRow.querySelector('.field-key')?.value;
    if (key) removedFieldKeys.add(key);        // say so explicitly; see above
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

// Which types can appear in the "Can have children" list.
//
// Excluded, and why:
//  - Dailies (slug `daily`, formerly `work_item`): a daily is never a child
//    of anything, and it is
//    implicitly a parent of everything, so offering it in either list is
//    either wrong or a no-op the user has to keep re-ticking.
//  - Outlook Calendar (type_category 'external'): an import source, not a
//    regular type - it has no place in hand-authored relationship rules.
//  - Templates (type_category 'template'): a template becomes a daily by
//    being dragged onto the Dailies page, not by nesting under a hierarchy
//    rule - offering it here would let someone tick a box that the drag
//    protocol, not this screen, is what actually governs. Nothing may hold a
//    Template (see CLAUDE.md).
function canBeRelated(t) {
  if (t.type_category === 'external') return false;
  if (t.type_category === 'template') return false;
  if (t.slug === 'daily') return false;
  // 'folder' has no rows of its own - it exists only to define fields that
  // render on OTHER types' folder rows (see systemEntityTypes.js) - so it can
  // neither hold children nor be one.
  if (t.slug === 'folder') return false;
  // A workspace tab (a user-created custom tab like "Foo" - is_workspace) is
  // an organising space, not content - entityTypeService.js's
  // ensureWorkspaceChildRules() already grants it every editable type as a
  // child automatically, on both sides, so it has no place in this
  // hand-authored list either, same reasoning as Templates just above.
  if (t.is_workspace) return false;
  return true;
}

async function loadTypeRelationships(type) {
  try {
    const response = await fetch('/api/entity-types');
    const result = await response.json();
    if (result.success) {
      const types = result.data || [];
      const otherTypes = types.filter(t => (!type || t.id !== type.id) && canBeRelated(t));

      const childList = document.getElementById('childTypesList');
      // Not rendered while CREATING a custom tab - see showEntityTypeEditorModal.
      // It already holds every editable type automatically once saved
      // (ensureWorkspaceChildRules), so there is nothing to hand-pick here.
      if (!childList) return;

      childList.innerHTML = '';

      // Pre-check boxes against relationship rules already on this type, so
      // reopening the editor shows what was actually saved instead of always
      // starting blank.
      const relationships = (type?.relationships || []).filter(r => r.relationship_kind === 'hierarchy');
      const isChild = (t) => relationships.some(r => r.parent_type_id === type.id && r.child_type_id === t.id);

      otherTypes.forEach(t => {
        // Child types
        const childCheck = document.createElement('div');
        childCheck.className = 'form-check';
        childCheck.innerHTML = `
          <input class="form-check-input child-type-check" type="checkbox" value="${t.id}" id="child_${t.id}" ${type && isChild(t) ? 'checked' : ''}>
          <label class="form-check-label" for="child_${t.id}">${t.label}</label>
        `;
        childList.appendChild(childCheck);
      });
    }

    // These checkboxes arrive from their own fetch, LONG after the form was
    // built, so a read-only pass done at render time never sees them. Re-apply
    // here or a read-only type shows eighteen live checkboxes in an otherwise
    // locked editor - which is worse than not locking it at all, because it
    // looks safe.
    applyReadOnly(type);
  } catch (error) {
    console.error('Error loading types:', error);
  }
}

// Saving means diffing the "Can have children" checkboxes against what this
// type already had and only creating/deleting the difference - not resending
// the whole set every time.
async function saveTypeRelationships(typeId) {
  // The checkboxes are the ONLY record of what is wanted, and they arrive from
  // their own fetch after the form is built. Saving before they land means
  // reading "nothing is checked" and deleting every hierarchy rule the type
  // had - which is exactly what happened: six types lost their self-nesting
  // rule, and `priority` could no longer contain a sub-project.
  //
  // No checkboxes rendered at all means the section never loaded, which is not
  // the same as the user clearing it. Leave the rules alone.
  const rendered = document.querySelectorAll('.child-type-check').length;
  if (rendered === 0) {
    console.warn('[EntityTypeEditor] relationship checkboxes not loaded - leaving rules unchanged');
    return;
  }

  const desiredChildren = new Set(
    Array.from(document.querySelectorAll('.child-type-check:checked')).map(cb => Number(cb.value)));

  // SELF-nesting rules are excluded from the diff, and that is the whole bug
  // this guards against.
  //
  // The checkbox list excludes the type itself (`otherTypes`), so a rule where
  // parent and child are both this type can never be "desired" - it has no box
  // to tick. It IS in `existing`, so every save saw a rule nobody asked for and
  // deleted it. Pressing Save on a type therefore removed its ability to
  // contain its own kind: no sub-projects, no nested categories. Six types had
  // lost it before this was noticed.
  //
  // That rule belongs to `supports_hierarchy` and is maintained by
  // ensureSelfNestingRule on the server. This screen does not own it.
  const existing = (currentEditingType?.relationships || [])
    .filter(r => r.relationship_kind === 'hierarchy' && r.parent_type_id !== r.child_type_id);
  const existingChildren = new Map(existing.filter(r => r.parent_type_id === typeId).map(r => [r.child_type_id, r.id]));

  const creates = [];
  const deletes = [];
  for (const childId of desiredChildren) {
    if (!existingChildren.has(childId)) creates.push({ parent_type_id: typeId, child_type_id: childId, relationship_kind: 'hierarchy' });
  }
  for (const [childId, ruleId] of existingChildren) {
    if (!desiredChildren.has(childId)) deletes.push(ruleId);
  }

  for (const rule of creates) {
    try {
      await app.fetch('/api/entity-types/relationships', { method: 'POST', body: JSON.stringify(rule) });
    } catch (error) {
      // A given row now has exactly one editable path (this type's children
      // list, from this type's own editor) - the old "the other type's
      // parents list already created it" race is gone with that list. A
      // conflict here means a double-submitted Save (e.g. double-clicked);
      // swallow rather than surface, since the next load reflects the truth.
      console.warn('Could not create relationship rule:', error);
    }
  }
  for (const ruleId of deletes) {
    try {
      await app.fetch(`/api/entity-types/relationships/${ruleId}`, { method: 'DELETE' });
    } catch (error) {
      console.warn('Could not delete relationship rule:', error);
    }
  }
}


// What actually changed, rather than everything on screen.
//
// The editor used to send the type rebuilt from the DOM on every save, and the
// server trusted it. That is one design behind four separate incidents: the
// status roles were destroyed, Templates came back with supports_hierarchy = 0,
// fields the form could not draw were silently retyped to `text`, and every
// type's self-nesting rule was deleted. Each was fixed individually; each was
// the same shape - a value the form did not really know being sent as though it
// did.
//
// The live example, still latent: `rollup` is read from a <select> that only
// exists for field types in ROLLUP_MODES. For any other type the read yields ''
// and is sent as an explicit null, which the server writes. Today every field
// type that HAS a stored rollup also has a ROLLUP_MODES entry, so nothing is
// lost - but the moment one gains a rollup without an entry (exactly how
// `timebox` arrived) opening that type and pressing Save wipes it. That is the
// mechanism behind all 130 fields once reading rollup = NULL.
//
// Sending only differences ends the class instead of the instances: a property
// the form does not understand is one it cannot have changed, so it is not sent
// at all, and the server keeps what it had.
//
// The fields ARRAY is always sent whole and in order, even when only one entry
// changed. Its ORDER is the data - the server derives display_order from the
// index - so a partial array would silently reorder the type. Each entry is
// trimmed to its identity plus what differs.
function sameValue(a, b) {
  // The DOM says true/false, MySQL says 1/0, and an absent value arrives as
  // null, undefined or ''. Compare what they MEAN, or every save "changes"
  // every boolean and the diff achieves nothing.
  if (typeof a === 'boolean' || typeof b === 'boolean') return Boolean(a) === Boolean(b);
  const empty = (v) => v === null || v === undefined || v === '';
  if (empty(a) && empty(b)) return true;
  if (typeof a === 'object' || typeof b === 'object') {
    const norm = (v) => {
      if (empty(v)) return null;
      try { return JSON.stringify(typeof v === 'string' ? JSON.parse(v) : v); } catch { return String(v); }
    };
    return norm(a) === norm(b);
  }
  return String(a) === String(b);
}

const TYPE_PROPS = ['label', 'label_singular', 'icon', 'supports_hierarchy', 'supports_folders'];
const FIELD_PROPS = ['label', 'field_type', 'show_in_row', 'show_column_label', 'rollup', 'field_options'];

function onlyChanges(typeData, original) {
  if (!original) return typeData;              // creating: nothing to diff against

  const patch = {};
  for (const prop of TYPE_PROPS) {
    if (!sameValue(typeData[prop], original[prop])) patch[prop] = typeData[prop];
  }
  // Deletions are never inferred from absence - they are stated. Carried
  // through untouched.
  if (typeData.removed_field_keys?.length) patch.removed_field_keys = typeData.removed_field_keys;

  const priorByKey = new Map((original.fields || []).map((f) => [f.field_key, f]));
  let fieldChanged = (original.fields || []).length !== typeData.fields.length;

  patch.fields = typeData.fields.map((field, i) => {
    const prior = priorByKey.get(field.field_key);
    if (!prior) { fieldChanged = true; return field; }        // new: send it all
    if ((original.fields || [])[i]?.field_key !== field.field_key) fieldChanged = true;

    const trimmed = { field_key: field.field_key };
    for (const prop of FIELD_PROPS) {
      if (!sameValue(field[prop], prior[prop])) {
        trimmed[prop] = field[prop];
        fieldChanged = true;
      }
    }
    return trimmed;
  });

  // Nothing about the fields moved or differs: leave the whole array out, so a
  // save that only renamed the type does not touch a single field row.
  if (!fieldChanged && !patch.removed_field_keys) delete patch.fields;
  return patch;
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
    // Neither control is rendered while creating a custom tab - see
    // showEntityTypeEditorModal - and entityTypeService.js does not trust
    // either value from the client for one anyway, forcing both true itself.
    supports_hierarchy: document.getElementById('typeHierarchy')?.checked ?? true,
    supports_folders: document.getElementById('typeFolders')?.checked ?? true,
    // Only ever true when set by openEntityTypeEditor(null, {workspace:true})
    // and we are still CREATING - updateEntityType ignores this key entirely,
    // so it is harmless (and never sent - see onlyChanges) on an edit.
    is_workspace: !currentEditingType && creatingAsWorkspace,
    // Explicit deletions. The server never removes a field just because it is
    // missing from `fields` - see updateEntityType.
    removed_field_keys: [...removedFieldKeys],
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
      };

      // Roll-up is only CLAIMED for a field type that actually has the control.
      //
      // The select is rendered from ROLLUP_MODES; for any type not in it there
      // is no select, the read yields '', and this used to send an explicit
      // null - which the server faithfully wrote, wiping a stored roll-up the
      // form had never shown. Diffing the payload does not help, because a
      // fabricated null genuinely DIFFERS from the stored value and so reads as
      // a deliberate change.
      //
      // Omitting the key entirely is what makes it safe: the server treats
      // `undefined` as "not mentioned" and keeps what it had. A form cannot
      // have changed a control it never drew.
      if (ROLLUP_MODES[fieldType]) {
        // A status field with no roll-up mode leaves every folder of that type
        // blank no matter what it contains, which is never what someone means
        // by adding a status. The select is empty until its type is chosen, so
        // saving before touching it used to store null - default it instead.
        fieldData.rollup = row.querySelector('.field-rollup')?.value
          || (fieldType === 'status' ? 'status' : null);
      }

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

    // Only what changed - see onlyChanges. A create sends everything, because
    // there is nothing to differ from.
    const payload = onlyChanges(typeData, currentEditingType);

    const response = await app.fetchRaw(url, {
      method,
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Entity type saved', 'success');
      // Stay open on what was just saved. This used to close the editor and
      // reload the whole page, which threw away your place for every edit.
      const savedId = result.data?.id || currentEditingType?.id;
      if (savedId) await saveTypeRelationships(savedId);
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

/**
 * A read-only type opens for LOOKING, not for changing.
 *
 * The split is the same one the Settings lists use: `type_category` other than
 * `editable` - Templates and the external integrations. They can be read, and
 * nothing in the form can be touched.
 *
 * Disabled rather than hidden. Hiding the controls would hide the VALUES with
 * them, and the values are the reason to open it: which fields a Template has,
 * what its icon is, whether it nests. A disabled input still shows what it
 * holds.
 *
 * Save and Delete go, because neither can do anything here. Cancel stays - it
 * is the way out.
 */
function applyReadOnly(type) {
  const readOnly = Boolean(type?.type_category) && type.type_category !== 'editable';
  const pane = document.getElementById('entityType-editor-pane');
  const actions = document.getElementById('entityTypeEditorActions');
  if (!pane || !actions) return;

  pane.classList.toggle('type-editor-readonly', readOnly);
  if (!readOnly) return;

  for (const el of pane.querySelectorAll('input, select, textarea, button')) {
    el.disabled = true;
  }
  // Field rows are drag-sortable; a read-only type must not be reordered either.
  for (const row of pane.querySelectorAll('.field-row')) {
    row.draggable = false;
  }
  for (const id of ['entityTypeSaveBtn', 'entityTypeDeleteBtn']) {
    const btn = document.getElementById(id);
    if (btn) btn.style.display = 'none';
  }
  // Idempotent: this runs once after the fields render and again after the
  // relationship checkboxes arrive from their own fetch, and a banner that
  // appears twice is its own small bug.
  if (!pane.querySelector('.type-editor-readonly-note')) {
    const note = document.createElement('div');
    note.className = 'alert alert-secondary py-2 px-3 mb-3 type-editor-readonly-note';
    // Templates gets the reason, not just the rule. Its shape is not an
    // independent choice - a template dropped on a day becomes a DAILY carrying
    // what it held, so anything Dailies has that Templates lacks is lost in the
    // handover. That is why it follows Dailies, and why it cannot be edited
    // here (entityTypeService.syncTemplateFieldsFromDaily).
    note.innerHTML = type.slug === 'template'
      ? '<i class="bi bi-lock"></i> <strong>Templates follows Dailies.</strong> '
        + 'Any property you add to the Dailies type is added here automatically, '
        + 'so a template can carry it onto the day it is dropped on. That is why '
        + 'this type is read-only - edit <strong>Dailies</strong> instead.'
      : '<i class="bi bi-lock"></i> This type is read-only. '
        + 'You can see how it is set up, but not change it here.';
    pane.prepend(note);
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
