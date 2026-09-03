/**
 * Generic Entity Engine - Unified renderer for all entity types
 * Handles: rows, trees, editors, and field rendering for any entity type
 */

const GenericEntity = (() => {
  let currentTypeSlug, typeSchema, currentEntityId, hasChanges, currentIsFolder = false, currentSaveSlug = null, allEntities = [];
  const splitPanesByType = {}; // Store splitPane instances per type

  // Row editors have no Save button - a change autosaves this long after the
  // last keystroke, so a burst of typing lands one request, not one per key.
  const AUTO_SAVE_DELAY_MS = 800;
  let autoSaveTimer = null;

  // The one place that actually fires a save outside of a debounce tick:
  // switching records, closing the editor, or the timer itself all funnel
  // through this. Revert is the sole exception - it calls discardChanges()
  // first, which empties hasChanges before this would ever see it.
  function flushPendingAutoSave() {
    if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; }
    if (!hasChanges) return;
    // hasChanges is NOT cleared here - GenericEntity.save() clears it once the
    // request actually succeeds. Clearing it up front looked done the instant
    // this fired, so a failed save (a stale CSRF token, the network) silently
    // threw the edit away: Revert disabled itself and the row's unsaved mark
    // vanished even though nothing had reached the server.
    //
    // generic-entity-init.js owns the actual save (create-vs-update, linking
    // a pending parent, refreshing the list) - this only signals that it is
    // due, the same way 'entity-saved' and 'entity-structure-changed' do.
    document.dispatchEvent(new CustomEvent('entity-autosave-due', {
      detail: { typeSlug: currentTypeSlug, entityId: currentEntityId },
    }));
  }

  function scheduleAutoSave() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(flushPendingAutoSave, AUTO_SAVE_DELAY_MS);
  }

  // Field values are user text and land inside HTML attributes and markup, so
  // they're escaped rather than interpolated raw.
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
  const escapeAttr = escapeHtml;

  // ========== FIELD RENDERERS STRATEGY MAP ==========
  // A <select> must use Bootstrap's .form-select, not .form-control: only the
  // former draws the chevron, so a dropdown styled as .form-control is
  // indistinguishable from a single-line text input until it is clicked.
  // A field can declare a default in field_options.default. The literal token
  // 'currentYear' resolves at render time - a stored "2026" would go stale the
  // moment the year turned over.
  function resolveFieldDefault(field) {
    const d = field.field_options?.default;
    if (d === 'currentYear') return String(new Date().getFullYear());
    return d ?? '';
  }

  // Person / Group fields: a search box that live-searches Entra ID through
  // the server (app-only Graph token, see entraDirectoryService.js) as you
  // type, rather than offering author-defined choices the way select/radio
  // do. The picked value is {externalId, displayName, email}, stored the
  // same value_json way `links` already is - see collectFormValues below.
  function directoryFieldIcon(kind) {
    return kind === 'group' ? 'bi-people-fill' : 'bi-person-circle';
  }

  // A small initials avatar, the same idea Outlook/Teams use for a person
  // with no photo - gives each row and the picked chip something to anchor
  // on besides a line of text, which is what read as "just a plain list".
  function directoryInitials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function directoryAvatarHtml(name, kind) {
    return `<span class="entity-directory-avatar${kind === 'group' ? ' is-group' : ''}">${escapeHtml(directoryInitials(name))}</span>`;
  }

  const DIRECTORY_SEARCH_DEBOUNCE_MS = 140;
  // Per-INPUT, not one shared timer/query - a form can carry more than one
  // Person/Group field (an Assignee and an Approver, say), and a shared timer
  // would let typing in the second cancel a search still pending on the
  // first.
  const directorySearchTimers = new WeakMap();

  function renderDirectoryField(field, value, kind) {
    const picked = value && value.externalId ? value : null;
    const placeholder = kind === 'group' ? 'Search groups…' : 'Search people…';
    return `
      <div class="form-group entity-directory-field" data-field-type="${kind}" data-field-key="${escapeAttr(field.field_key)}">
        <input type="hidden" name="${field.field_key}" value="${picked ? escapeAttr(JSON.stringify(picked)) : ''}">
        <div class="entity-directory-picked"${picked ? '' : ' hidden'}>
          <span class="entity-directory-chip">
            ${picked ? directoryAvatarHtml(picked.displayName, kind) : ''}
            <span class="entity-directory-name">${picked ? escapeHtml(picked.displayName || '') : ''}</span>
            <button type="button" class="entity-directory-remove" data-action="directory-clear" title="Clear" aria-label="Clear"><i class="bi bi-x-lg"></i></button>
          </span>
        </div>
        <div class="entity-directory-search"${picked ? ' hidden' : ''}>
          <div class="entity-directory-input-wrap">
            <i class="bi ${directoryFieldIcon(kind)} entity-directory-search-icon"></i>
            <input type="text" class="form-control form-control-sm entity-directory-input" placeholder="${placeholder}" autocomplete="off">
          </div>
          <div class="entity-directory-results" hidden></div>
        </div>
      </div>
    `;
  }

  // Shared by the click handler and Enter-picks-the-active-row below, so a
  // mouse pick and a keyboard pick land in exactly the same state.
  function applyDirectoryPick(wrapper, picked) {
    if (!wrapper) return;
    const kind = wrapper.dataset.fieldType;
    const hidden = wrapper.querySelector('input[type="hidden"]');
    const chip = wrapper.querySelector('.entity-directory-chip');
    const pickedEl = wrapper.querySelector('.entity-directory-picked');
    const searchEl = wrapper.querySelector('.entity-directory-search');
    const resultsEl = wrapper.querySelector('.entity-directory-results');
    const inputEl = wrapper.querySelector('.entity-directory-input');
    if (hidden) hidden.value = JSON.stringify(picked);
    if (chip) {
      chip.innerHTML = `
        ${directoryAvatarHtml(picked.displayName, kind)}
        <span class="entity-directory-name">${escapeHtml(picked.displayName || '')}</span>
        <button type="button" class="entity-directory-remove" data-action="directory-clear" title="Clear" aria-label="Clear"><i class="bi bi-x-lg"></i></button>
      `;
    }
    if (pickedEl) pickedEl.hidden = false;
    if (searchEl) searchEl.hidden = true;
    if (inputEl) inputEl.value = '';
    if (resultsEl) { resultsEl.hidden = true; resultsEl.innerHTML = ''; }
    markChanged();
    mirrorEditorToRow();   // a row click/Enter fires no input/change event
  }

  const fieldRenderers = {
    text: (field, value = '') => `
      <div class="form-group">
        <input type="text" name="${field.field_key}" value="${value || ''}" class="form-control" data-field-type="text">
      </div>
    `,
    textarea: (field, value = '') => `
      <div class="form-group">
        <textarea name="${field.field_key}" class="form-control" rows="6" data-field-type="textarea">${value || ''}</textarea>
      </div>
    `,
    number: (field, value = '') => `
      <div class="form-group">
        <input type="number" name="${field.field_key}" value="${value || ''}" class="form-control" data-field-type="number">
      </div>
    `,
    // Every emoji in the set is shown at once with the current one marked,
    // rather than hidden behind a dropdown: the set is small and the glyphs ARE
    // the labels, so a select made you open it to see what the choices even
    // were. The hidden input is what the form collects and what
    // syncEditorFromRow writes, so the row cell and this stay in step.
    emojis: (field, value = '') => {
      const set = field.field_options?.values || [];
      const current = value || set[0] || '';
      return `
      <div class="form-group" data-field-type="emojis">
        <div class="option-choice-row" role="radiogroup" aria-label="${escapeAttr(field.label)}">
          ${set.map(e => `
            <button type="button" class="option-choice emoji-option${e === current ? ' selected' : ''}"
                    data-action="pick-option" data-value="${escapeAttr(e)}"
                    role="radio" aria-checked="${e === current}"
                    title="${escapeAttr(e)}">${escapeHtml(e)}</button>`).join('')}
        </div>
        <input type="hidden" name="${field.field_key}" value="${escapeAttr(current)}">
      </div>
    `;
    },
    emoji: (field, value = '') => `
      <div class="form-group">
        <div>
          <button type="button" class="btn btn-outline-secondary emoji-field-btn" data-action="pick-emoji-field"
                  data-field-key="${escapeAttr(field.field_key)}" title="Click to choose an emoji">${value || resolveFieldDefault(field) || '＋'}</button>
          <input type="hidden" name="${field.field_key}" value="${escapeAttr(value || '')}">
        </div>
      </div>
    `,
    date: (field, value = '') => `
      <div class="form-group">
        <input type="date" name="${field.field_key}" value="${isoDatePart(value)}" class="form-control" data-field-type="date">
      </div>
    `,
    select: (field, value = '') => {
      const current = (value === null || value === undefined || value === '')
        ? resolveFieldDefault(field)
        : String(value);
      const choices = field.field_options?.values || field.field_options?.choices || [];
      return `
      <div class="form-group">
        <select name="${field.field_key}" class="form-select" data-field-type="select">
          <option value="">-- Select --</option>
          ${choices.map(c =>
            `<option value="${c}" ${String(c) === current ? 'selected' : ''}>${c}</option>`
          ).join('')}
        </select>
      </div>
    `;
    },
    // Every status on screen at once, the current one boxed - same pattern as
    // the emojis field. The row's cell still CYCLES on click, which is right
    // there: a row has space for one badge, and cycling is the quickest way to
    // move an item on. The editor has room to show the whole ladder, and
    // picking beats cycling when the target is three steps away.
    //
    // No fill here: the state is carried by the TEXT colour, and the box marks
    // which one is current. Filled badges are the row's treatment, where one
    // badge has to be findable at a glance among many columns; a column of
    // five filled badges in the editor is just loud.
    status: (field, value = '') => {
      const statuses = field.field_options?.values || ['incomplete', 'in_progress', 'complete'];
      const current = statuses.includes(value) ? value : statuses[0];
      return `
        <div class="form-group" data-field-type="status">
          <div class="option-choice-row" role="radiogroup" aria-label="${escapeAttr(field.label)}">
            ${statuses.map(v => `
              <button type="button"
                      class="option-choice status-option status-role-${statusRole(field, v)}${v === current ? ' selected' : ''}"
                      data-action="pick-option" data-value="${escapeAttr(v)}"
                      role="radio" aria-checked="${v === current}"
                      title="${escapeAttr(v)}">${escapeHtml(v)}</button>`).join('')}
          </div>
          <input type="hidden" name="${field.field_key}" value="${escapeAttr(current)}">
        </div>
      `;
    },
    checkbox: (field, value = false) => `
      <div class="form-group">
        <input type="checkbox" name="${field.field_key}" class="form-check-input" ${value ? 'checked' : ''} data-field-type="checkbox">
      </div>
    `,
    // A single named URL. The field's own label names it ("Repo", "Spec"...),
    // so one type can carry several distinct url fields.
    url: (field, value = '') => `
      <div class="form-group">
        <input type="url" name="${field.field_key}" value="${escapeAttr(value)}" class="form-control" placeholder="https://example.com" data-field-type="url">
      </div>
    `,
    radio: (field, value = '') => {
      const choices = field.field_options?.choices || [];
      return `
        <div class="form-group">
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
    person: (field, value = null) => renderDirectoryField(field, value, 'person'),
    group: (field, value = null) => renderDirectoryField(field, value, 'group'),
    // 0-n named URLs. Stored as a JSON array of {url, title} in value_json, so
    // it needs no table of its own - the per-type *_links tables this replaces
    // (priority_links, task_links, ticket_links, to_do_links) each existed only
    // because there was no generic way to express "this type has links".
    links: (field, value = null) => {
      const links = Array.isArray(value) ? value : [];
      // A saved link reads as its NAME, hyperlinked, opening in a new tab. The
      // url/title inputs are still there - collectFormValues reads them - but
      // they stay out of the way behind the pencil until you want to change
      // something.
      const row = (link = { url: '', title: '' }, isNew = false) => `
        <div class="entity-link-row${isNew ? ' editing' : ''}">
          <div class="entity-link-display">
            <a class="entity-link-anchor" href="${escapeAttr(link.url || '#')}" target="_blank" rel="noopener noreferrer"
               title="${escapeAttr(link.url || '')}"><i class="bi bi-link-45deg"></i>${escapeHtml(link.title || link.url || 'Untitled link')}</a>
            <button type="button" class="btn btn-sm btn-link entity-link-edit-btn" data-action="edit-link"
                    title="Edit this link" aria-label="Edit this link"><i class="bi bi-pencil"></i></button>
            <button type="button" class="btn btn-sm btn-link text-danger" data-action="remove-link"
                    title="Remove link" aria-label="Remove link"><i class="bi bi-x-lg"></i></button>
          </div>
          <div class="entity-link-fields">
            <input type="url" class="form-control form-control-sm entity-link-url" value="${escapeAttr(link.url || '')}" placeholder="https://example.com">
            <input type="text" class="form-control form-control-sm entity-link-title" value="${escapeAttr(link.title || '')}" placeholder="Name">
          </div>
        </div>
      `;
      return `
        <div class="form-group" data-field-type="links" data-field-key="${field.field_key}">
          <div class="entity-links-list">${links.map(l => row(l)).join('')}</div>
          <button type="button" class="btn btn-outline-secondary btn-sm" data-action="add-link">
            <i class="bi bi-plus-lg"></i> Add link
          </button>
        </div>
      `;
    },
    // Same control as the cell: one icon, clicked to move up the ladder.
    priority: (field, value = '') => {
      const current = PRIORITY_LEVELS.includes(value) ? value : '';
      return `
      <div class="form-group" data-field-type="priority" data-cycle-values="${escapeAttr(JSON.stringify(PRIORITY_LEVELS))}">
        <div>
          <span class="priority-cell editor-cycle" data-cycle="priority" role="button" tabindex="0"
                title="${escapeAttr(PRIORITY_STYLE[current].label)} - click to change">
            ${priorityGlyph(current)}
            <span class="editor-cycle-label">${escapeHtml(PRIORITY_STYLE[current].label)}</span>
          </span>
        </div>
        <input type="hidden" name="${field.field_key}" value="${escapeAttr(current)}">
      </div>
      `;
    },
    // Every option shown at once with a box round the current one, exactly like
    // status. The row still cycles - there is no space there for seven choices -
    // but the editor has the room, and cycling is a poor way to pick a value
    // when you cannot see what the choices are without clicking through them.
    timebox: (field, value = '') => {
      const current = TIME_BOX_LEVELS.includes(value) ? value : '';
      return `
      <div class="form-group" data-field-type="timebox">
        <div class="option-choice-row" role="radiogroup" aria-label="${escapeAttr(field.label)}">
          ${TIME_BOX_LEVELS.map(v => `
            <button type="button"
                    class="option-choice timebox-option${v === current ? ' selected' : ''}"
                    data-action="pick-option" data-value="${escapeAttr(v)}"
                    role="radio" aria-checked="${v === current}"
                    title="${escapeAttr(timeBoxLabel(v))}">${escapeHtml(timeBoxLabel(v))}</button>`).join('')}
        </div>
        <input type="hidden" name="${field.field_key}" value="${escapeAttr(current)}">
      </div>
      `;
    },
    // The value the form collects is the hidden seconds; the visible box is a
    // readable rendering of it, parsed back on input.
    duration: (field, value = '') => `
      <div class="form-group" data-field-type="duration">
        <input type="text" class="form-control duration-input"
               value="${escapeAttr(formatDuration(value))}"
               placeholder="e.g. 1h 30m" title="Hours and minutes. A plain number means minutes.">
        <input type="hidden" name="${field.field_key}" value="${escapeAttr(value ?? '')}">
      </div>
    `,
    recurrence: (field, value = null) => `
      <div class="form-group">
        <textarea name="${field.field_key}" class="form-control" data-field-type="recurrence" placeholder="JSON recurrence config">${value ? JSON.stringify(JSON.parse(value), null, 2) : ''}</textarea>
      </div>
    `,
    // The three Dailies has always had on a work item. In the editor they are
    // ordinary controls - a box to type in, a box to tick. What makes them the
    // Dailies pattern is the ROW: a single glyph that lights up when there is
    // something there, so a list of fifty rows says which ones carry notes
    // without showing any of the text. See renderCellValue.
    notes: (field, value = '') => `
      <div class="form-group">
        <textarea name="${field.field_key}" class="form-control" rows="6" data-field-type="notes" placeholder="Your own notes">${value || ''}</textarea>
      </div>
    `,
    worked_with_claude: (field, value = false) => `
      <div class="form-group">
        <input type="checkbox" name="${field.field_key}" class="form-check-input" ${value ? 'checked' : ''} data-field-type="worked_with_claude">
      </div>
    `,
  };

  // A folder is not a separate entity type - it's a row of the page's own type
  // carrying entities.is_folder = 1. That's what keeps every typed page on one
  // code path: folders are page-scoped for free, and the type's existing
  // self-nesting hierarchy rule already permits types under types, types under
  // folders, and folders under folders with no extra rules. The icon swap and
  // the title-only form below are the only two places anything is folder-aware.
  // A row shows its type's OWN icon - the same emoji the tab bar shows, from
  // entity_types.icon. They have to match: a Project is a pushpin in the tab
  // strip, so it is a pushpin in the row.
  //
  // Emoji do vary in width at one font-size (a pushpin inks 7px against a
  // folder's 13.3px, measured on canvas), which no CSS can equalise. Matching
  // the tab bar is worth more than shaving that difference, so the size below
  // is set once for every icon in the row and the variance is left alone.
  const FOLDER_ICON = '📁';

  function rowIcon(slug, isFolder, typeIcon) {
    return isFolder ? FOLDER_ICON : (typeIcon || '');
  }

  // A status field renders as a clickable icon that cycles through the type's
  // OWN values, never a hardcoded list - Ideas run Raw/Developing/Ready while
  // everything else runs Not Started/In Progress/Complete, and a type edited in
  // Settings can define anything at all.
  //
  // The icon is chosen by the value's ROLE, not its name, so it works for any
  // vocabulary: first value = not started, a doneValue = done, anything in
  // between = in progress.
  function statusRole(field, value) {
    const values = field.field_options?.values || [];
    const doneValues = field.field_options?.doneValues || [];
    const failedValues = field.field_options?.failedValues || [];
    const ignoredValues = field.field_options?.ignoredValues || [];
    if (ignoredValues.includes(value)) return 'ignored';
    if (failedValues.includes(value)) return 'failed';
    if (doneValues.includes(value)) return 'done';
    if (values.indexOf(value) <= 0) return 'todo';
    return 'active';
  }

  // The concrete value a role maps back to, so a rolled-up folder only ever
  // displays a status its own type actually defines.
  function valueForRole(field, role) {
    const values = field.field_options?.values || [];
    if (role === 'done') return (field.field_options?.doneValues || [])[0] || null;
    if (role === 'failed') return (field.field_options?.failedValues || [])[0] || null;
    if (role === 'todo') return values[0] || null;
    return values.find(v => statusRole(field, v) === 'active') || null;
  }

  // Colour follows the same convention as the Templates rows' status badge:
  // secondary / warning / success, keyed by role rather than by literal value.
  function renderStatusToggle(entity, field, rawValue, derived = false) {
    const values = field.field_options?.values || [];
    if (values.length === 0) return '';

    // A folder has no status of its own - it shows what its children roll up
    // to. That badge must NOT be clickable: cycling it would try to store a
    // value on a row that deliberately has none.
    if (derived) {
      if (!rawValue) return '';
      const role = statusRole(field, rawValue);
      return `<span class="row-field status-badge status-cell status-role-${role} is-rollup"
              title="Rolled up from the items inside">${escapeHtml(rawValue)}</span>`;
    }

    // An unset status still gets a badge - otherwise a row could never be given
    // one by clicking, which is the whole point of the control.
    const current = rawValue || values[0];
    const role = statusRole(field, current);
    return `<span class="row-field status-badge status-cell status-role-${role}"
            data-action="cycle-status"
            data-entity-id="${entity.id}"
            data-field-key="${escapeAttr(field.field_key)}"
            data-status="${escapeAttr(current)}"
            role="button" tabindex="0"
            title="Click to change status">${escapeHtml(current)}</span>`;
  }

  // ===== Priority =====
  //
  // An ordered ladder rather than a free choice, so it sorts meaningfully and
  // reads at a glance. Blank is a real rung: most things have no priority, and
  // forcing one on every record would make the column meaningless.
  //
  // The iconography is the escalating chevron every issue tracker uses - down
  // for low, up for high, doubled for the top - so it reads without a legend.
  // Colour carries the same signal for anyone scanning rather than reading.
  // Field keys the engine writes for itself. They are real entity_type_fields
  // (so they store and query like anything else) but they are never rendered as
  // an editable control, and never offered as a column.
  // ===== Duration =====
  //
  // Stored as SECONDS, because that is what the focus clock accumulates and it
  // must stay one value whether it grew by stopwatch or was typed in. Shown and
  // typed as time, since nobody wants to read 5400 and work out that it is an
  // hour and a half.
  //
  // Accepts what people actually type: "1h 30m", "90m", "1:30", "2h", "45".
  // A bare number is MINUTES - it is the unit someone means when correcting a
  // worked time by hand.
  // Never blank: an unworked item reads "0h 0m", not empty. Blank looks like
  // the field is missing or broken, while a zero says plainly that nothing has
  // been logged against this yet.
  function formatDuration(seconds) {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    if (!total) return '0h 0m';
    const h = Math.floor(total / 3600);
    const m = Math.round((total % 3600) / 60);
    if (h && m) return `${h}h ${m}m`;
    if (h) return `${h}h`;
    return `${m}m`;
  }

  function parseDuration(text) {
    const raw = String(text ?? '').trim();
    if (!raw) return null;

    const clock = raw.match(/^(\d+):([0-5]?\d)$/);              // 1:30
    if (clock) return (Number(clock[1]) * 3600) + (Number(clock[2]) * 60);

    const units = [...raw.matchAll(/(\d+(?:\.\d+)?)\s*([hm])/gi)];
    if (units.length) {
      return Math.round(units.reduce((total, [, n, unit]) =>
        total + Number(n) * (unit.toLowerCase() === 'h' ? 3600 : 60), 0));
    }

    const bare = Number(raw);
    return Number.isFinite(bare) ? Math.round(bare * 60) : null;   // bare = minutes
  }

  const INTERNAL_FIELD_KEYS = new Set([
    'board_bay', 'board_order',
    // focus_seconds is deliberately NOT here: it is Worked Time, a property
    // people read and correct by hand. The rest are engine bookkeeping.
    'focus_slot', 'focus_started_at', 'focus_color', 'focus_monitor',
  ]);

  // How long something is MEANT to take. None first, so cycling always has a
  // way back to "not boxed" rather than trapping you in a value.
  const TIME_BOX_LEVELS = ['', '15m', '30m', '45m', '1h', '1.5h', '2h'];
  const timeBoxLabel = (v) => (v ? v : 'None');

  const PRIORITY_LEVELS = ['', 'Low', 'Medium', 'High', 'Critical'];

  // Signal bars, not chevrons. Priority is an INTENSITY, and rising bars read as
  // intensity at a glance the way reception does - you do not have to decode an
  // arrow's direction, and four filled bars is obviously more than one. Colour
  // carries the same signal redundantly, so it survives being skimmed.
  //
  // The bars are drawn in CSS rather than taken from bootstrap-icons'
  // bi-reception-* set. Those glyphs are designed for a status bar at 16px and
  // up; at the 14px a row icon is standardised to, their steps merge into a
  // smudge and Medium/High/Critical stop being tellable apart - which is why
  // this control has never read right. Four spans with explicit pixel widths
  // land on whole pixels at any size. The rounded box around them gives the
  // control a footprint, so a row's priority is findable before it is read.
  const PRIORITY_STYLE = {
    '':       { level: 0, color: '#adb5bd', label: 'No priority' },
    Low:      { level: 1, color: '#0d6efd', label: 'Low' },
    Medium:   { level: 2, color: '#fd7e14', label: 'Medium' },
    High:     { level: 3, color: '#dc3545', label: 'High' },
    Critical: { level: 4, color: '#a51d2d', label: 'Critical' },
  };

  function priorityGlyph(value, extraClass = '') {
    const style = PRIORITY_STYLE[value] || PRIORITY_STYLE[''];
    return `<span class="priority-glyph ${extraClass}" data-level="${style.level}"`
      + ` style="--priority-color:${style.color}" aria-hidden="true">`
      + '<i></i><i></i><i></i><i></i></span>';
  }

  function priorityCell(entity, field, rawValue) {
    const current = PRIORITY_LEVELS.includes(rawValue) ? rawValue : '';
    const next = PRIORITY_LEVELS[(PRIORITY_LEVELS.indexOf(current) + 1) % PRIORITY_LEVELS.length];
    const style = PRIORITY_STYLE[current];
    return `<span class="row-field priority-cell"
            data-action="cycle-priority"
            data-entity-id="${entity.id}"
            data-field-key="${escapeAttr(field.field_key)}"
            data-priority="${escapeAttr(current)}"
            role="button" tabindex="0"
            title="${escapeAttr(style.label)} - click for ${next ? PRIORITY_STYLE[next].label : 'none'}"
            >${priorityGlyph(current)}</span>`;
  }

  // ========== COLUMNS, SORTING, FILTERING ==========
  //
  // A page's columns are its type's fields with show_in_row = 1, in
  // display_order. That single value is edited in two places - the Column
  // toggle in Settings > Entity Types, and the chooser button in this header -
  // exactly like entity_types.order_index drives both the tab bar and the
  // Settings list. One value, two views; never a second per-page store that
  // can disagree with it.
  //
  // Sort and filter are per-browser view state, so they live in localStorage
  // and are keyed by type slug.

  function visibleColumns(typeSchema) {
    return (typeSchema.fields || [])
      .filter(f => f.show_in_row && !INTERNAL_FIELD_KEYS.has(f.field_key))
      .slice()
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  }

  // Every column in display order, Title included. Title is not a field, so its
  // position is entity_types.title_order, which interleaves with the fields'
  // display_order. Ties put Title first, which is where it starts.
  function orderedColumns(typeSchema) {
    const titleCol = {
      key: 'title',
      label: 'Title',
      isTitle: true,
      order: typeSchema.title_order || 0,
    };
    const fieldCols = visibleColumns(typeSchema).map(f => ({
      key: f.field_key,
      label: f.label,
      field: f,
      order: f.display_order || 0,
    }));
    return [titleCol, ...fieldCols].sort((a, b) =>
      a.order - b.order || (a.isTitle ? -1 : b.isTitle ? 1 : 0));
  }

  // Header and rows are both built from this, so they cannot drift.
  //
  // Nesting is shown INSIDE the Title cell - the indent, the expand arrow, the
  // icon and the title all travel together. The row itself never shifts and no
  // other column is affected, so every column stays under its own header
  // whatever the column order.
  //
  // The flexible track follows Title wherever it sits, but never below its
  // minimum - Title collapsing to nothing is what made it vanish when the
  // editor opened and narrowed the list.
  const INDENT_PX = 18;

  // Every track is a fraction of the space available, so the columns ALWAYS fit
  // the pane and the list never scrolls sideways. Fixed pixel bands were what
  // made it overflow once a type had more than a few columns; content now
  // ellipsises inside its cell instead of pushing the row wider.
  //
  // Title gets a double share because it carries the indent, arrow, icon and
  // name; `minmax(0, ...)` on every track is what lets them actually shrink -
  // a grid item's default min-width is auto, which would refuse to go below its
  // content and reintroduce the overflow.
  const TITLE_SHARE = 2;
  const TITLE_MIN_PX = 90;

  // A status column is sized to the longest value it can ever hold, rather than
  // taking an equal share of the row. Measured from a real badge rendered
  // offscreen with the same classes, so it accounts for the actual font,
  // padding and border instead of guessing at character widths. Cached per
  // value-set: the DOM work happens once, not on every render.
  const statusWidthCache = new Map();

  function choiceColumnPx(field) {
    const values = field.field_options?.values || field.field_options?.choices || [];
    if (!values.length) return null;

    const isBadge = field.field_type === 'status';
    const key = `${isBadge ? 'badge' : 'select'}:${values.join('|')}`;
    if (statusWidthCache.has(key)) return statusWidthCache.get(key);

    const probe = document.createElement(isBadge ? 'span' : 'select');
    probe.className = isBadge ? 'badge status-badge' : 'row-choice';
    probe.style.cssText = 'position:absolute; visibility:hidden; white-space:nowrap; width:auto;';
    document.body.appendChild(probe);

    let widest = 0;
    for (const v of values) {
      if (isBadge) {
        probe.textContent = v;
      } else {
        probe.innerHTML = `<option>${escapeHtml(v)}</option>`;
      }
      widest = Math.max(widest, probe.getBoundingClientRect().width);
    }
    probe.remove();

    // A select needs room for its own chevron on top of the text.
    const px = Math.ceil(widest) + (isBadge ? 2 : 28);
    statusWidthCache.set(key, px);
    return px;
  }

  // The last track holds the row's delete button AND, in the header, the
  // filter+columns button group. It is sized for the WIDER of the two: at 44px
  // the header group overhung the list by 12px and pushed past the pane edge.
  const ACTIONS_PX = 78;

  // A column is only as wide as its content needs. A checkbox is a box, a date
  // is ten characters - neither should take the same share as free text. Only
  // the open-ended types (text, links, url, ...) share the leftover space with
  // the title.
  const FIXED_COLUMN_PX = {
    checkbox: 44,
    emoji: 44,
    emojis: 44,
    number: 90,
    date: 120,
  };

  // A flexible column still needs room to be readable. Below this it is not a
  // narrow column, it is an unreadable stub - which is what the pane used to
  // produce: `90px 4.39px 90px 88px 4.4px ...`, several columns collapsed to
  // about four pixels with their content wrapping.
  //
  // This is also the track's own minimum, NOT just an input to the fit
  // decision. It was `minmax(0, 1fr)`, which let the browser shrink a track to
  // anything at all - so the fit pass could believe a column had 70px while the
  // grid handed it 51. A minimum the CSS does not enforce is not a minimum.
  const FLEX_MIN_PX = 90;

  // The title needs more room to fit before wrapping than the 90px floor its
  // track is allowed to shrink to. The floor keeps the name from vanishing
  // entirely; this is the width below which the column is not worth keeping at
  // the expense of another. Used ONLY for the fit decision - raising the CSS
  // floor instead would overflow the grid rather than drop a column.
  const TITLE_FIT_MIN_PX = 165;

  // One pass over the columns, giving both the CSS track and the width below
  // which that column stops being worth showing. Shared so the grid and the
  // fit decision can never disagree about how wide a column is.
  function columnTracks(typeSchema) {
    return orderedColumns(typeSchema).map(c => {
      // A floor, not zero: with many columns in a narrow pane the title track
      // collapsed to nothing and the row's name disappeared - which is exactly
      // what the earlier `minmax(0, 1fr)` did before, and it came back when the
      // Dailies rail took half the width.
      if (c.isTitle) {
        return {
          col: c,
          track: `minmax(${TITLE_MIN_PX}px, ${TITLE_SHARE}fr)`,
          minPx: TITLE_FIT_MIN_PX,
        };
      }
      const type = c.field?.field_type;

      // Measured from the real control, so it fits the longest value exactly.
      if (type === 'status' || type === 'select' || type === 'radio') {
        const px = choiceColumnPx(c.field);
        if (px) return { col: c, track: `${px}px`, minPx: px };
      }

      const fixed = FIXED_COLUMN_PX[type];
      if (fixed) return { col: c, track: `${fixed}px`, minPx: fixed };

      return { col: c, track: `minmax(${FLEX_MIN_PX}px, 1fr)`, minPx: FLEX_MIN_PX };
    });
  }

  function gridTemplate(typeSchema, keepKeys = null) {
    const tracks = columnTracks(typeSchema)
      .filter(t => !keepKeys || keepKeys.has(t.col.key))
      .map(t => t.track);
    return `${tracks.join(' ')} ${ACTIONS_PX}px`;
  }

  // Which columns survive at this width.
  //
  // Two rules were each right on their own and could not both hold: columns
  // never scroll horizontally, and text is never truncated. With more columns
  // than width they met, and the loser was legibility. The rule that bends is
  // now "every column is always shown" - below the width they need, the
  // lowest-priority ones are dropped rather than squeezed to nothing.
  //
  // Three tiers, dropped in order:
  //
  //   2  everything else   - goes first, from the RIGHT, so dropping follows
  //                          the column order already arranged rather than a
  //                          separate priority nobody set
  //   1  status            - goes only if tier 2 was not enough. It is the one
  //                          value shared by every type's vocabulary and the
  //                          thing folder roll-ups are read from
  //   0  title             - never goes; a row with no name is not a row
  //
  // Status is tier 1 rather than untouchable on purpose: a rail dragged very
  // narrow can leave less room than title and status together need, and a
  // column that cannot be dropped would overflow - reintroducing exactly the
  // sideways scroll this exists to avoid.
  //
  // Keyed on field_type === 'status', NOT on is_completion_signal: only 3 of
  // the 7 status fields carry that flag (daily, task, to_do), so protecting on
  // it silently did nothing for Goals, Ideas, Projects and Tickets.
  function fittedColumnKeys(typeSchema, availablePx) {
    const tracks = columnTracks(typeSchema);
    const budget = availablePx - ACTIONS_PX;
    if (!(budget > 0)) return new Set(tracks.map(t => t.col.key));

    const keep = tracks.map(t => t.col.key);
    const minOf = new Map(tracks.map(t => [t.col.key, t.minPx]));
    const tierOf = (key) => {
      if (key === 'title') return 0;
      const t = tracks.find(x => x.col.key === key);
      return t?.col.field?.field_type === 'status' ? 1 : 2;
    };

    const width = () => keep.reduce((sum, k) => sum + (minOf.get(k) || 0), 0);

    for (const tier of [2, 1]) {
      for (let i = keep.length - 1; i >= 0 && width() > budget; i -= 1) {
        if (tierOf(keep[i]) !== tier) continue;
        keep.splice(i, 1);
      }
    }
    return new Set(keep);
  }

  /**
   * Re-fit an already-rendered list to its current width.
   *
   * Runs on the real DOM rather than at render time because the width that
   * matters is the container's, and the markup is built as a string before it
   * has one. It is also what makes this respond to the Dailies rail being
   * dragged - the case that produced the four-pixel columns in the first place.
   */
  function fitColumns(listEl, typeSchema) {
    if (!listEl) return;
    const list = listEl.querySelector('.entity-list') || listEl;
    const available = list.clientWidth;
    if (!available) return;                       // hidden pane - nothing to fit

    const keep = fittedColumnKeys(typeSchema, available);
    list.style.setProperty('--entity-grid', gridTemplate(typeSchema, keep));

    // Header cells carry data-col-key, body cells data-col.
    for (const cell of list.querySelectorAll('[data-col-key], [data-col]')) {
      const key = cell.dataset.colKey ?? cell.dataset.col;
      if (key === undefined) continue;
      cell.classList.toggle('col-dropped', !keep.has(key));
    }
    list.classList.toggle('has-dropped-columns', keep.size < columnTracks(typeSchema).length);
  }

  // ========== FOLDER ROLL-UPS ==========
  //
  // A folder is a row of the page's own type with is_folder = 1 and NO field
  // values of its own. What it shows in a column is derived from the items
  // beneath it, at render time, and is never written to entity_field_values -
  // a stored copy would need invalidating on every descendant change, and this
  // codebase has been bitten repeatedly by two sources of truth for one value.
  //
  // Which fields roll up, and how, is declared per field in
  // entity_type_fields.rollup. NULL means no roll-up, which is the case for
  // every field type where an aggregate is meaningless.
  //
  // Computed as a memoised post-order walk rather than naive recursion:
  // buildPathMap blew the stack on a deep tree once already, and this walk has
  // the same exposure.
  function computeRollups(roots, childrenByParent, typeSchema) {
    const rollupFields = (typeSchema.fields || []).filter(f => f.rollup);
    const byEntity = new Map();
    if (rollupFields.length === 0) return byEntity;

    const order = [];
    const stack = roots.map(r => ({ entity: r }));
    const seen = new Set();
    while (stack.length) {
      const { entity } = stack.pop();
      if (seen.has(entity.id)) continue;
      seen.add(entity.id);
      order.push(entity);
      (childrenByParent.get(entity.id) || []).forEach(c => stack.push({ entity: c }));
    }

    // Deepest first, so a child's roll-up is ready before its parent needs it.
    for (let i = order.length - 1; i >= 0; i--) {
      const entity = order[i];
      if (!entity.is_folder) continue;
      const children = childrenByParent.get(entity.id) || [];
      const values = {};


      // Every descendant contributes, at any depth - not just direct children.
      // Items can nest under items, so a folder holding one item that itself
      // holds ten only saw the one before this. Folders hold no values of their
      // own and so contribute nothing directly; their descendants are reached
      // by the same walk.
      const descendants = [];
      const stack = [...children];
      while (stack.length) {
        const d = stack.pop();
        descendants.push(d);
        stack.push(...(childrenByParent.get(d.id) || []));
      }

      for (const f of rollupFields) {
        const contributions = descendants
          .filter(d => !d.is_folder)
          .map(d => d.fields?.[f.field_key])
          .filter(v => v !== null && v !== undefined && v !== '');

        values[f.field_key] = aggregate(f, contributions);
      }
      byEntity.set(entity.id, values);
    }
    return byEntity;
  }

  function aggregate(field, values) {
    if (values.length === 0) return null;          // empty folder stays blank

    switch (field.rollup) {
      case 'status': {
        // Ignored items are dropped before anything else, so a parked item
        // cannot hold a folder back.
        const roles = values
          .map(v => statusRole(field, v))
          .filter(r => r !== 'ignored');
        if (roles.length === 0) return null;
        if (roles.includes('failed')) return valueForRole(field, 'failed');
        if (roles.every(r => r === 'done')) return valueForRole(field, 'done');
        if (roles.every(r => r === 'todo')) return valueForRole(field, 'todo');
        return valueForRole(field, 'active');
      }
      case 'sum': return values.reduce((a, v) => a + Number(v), 0);
      case 'min': return values.slice().sort()[0];
      case 'max': return values.slice().sort().pop();
      case 'avg': return Math.round((values.reduce((a, v) => a + Number(v), 0) / values.length) * 100) / 100;
      case 'all': return values.every(Boolean);
      case 'any': return values.some(Boolean);
      default: return null;
    }
  }

  // What a row actually shows for a field: its own value, or - for a folder -
  // the rolled-up one. Used by rendering, sorting and filtering alike so all
  // three agree.
  function effectiveValue(entity, field, rollups) {
    if (entity.is_folder) return rollups?.get(entity.id)?.[field.field_key] ?? null;
    return entity.fields?.[field.field_key];
  }

  function viewStateKey(typeSlug) { return `entity-view-${typeSlug}`; }

  function readViewState(typeSlug) {
    try {
      return JSON.parse(localStorage.getItem(viewStateKey(typeSlug))) || {};
    } catch { return {}; }
  }

  function writeViewState(typeSlug, state) {
    localStorage.setItem(viewStateKey(typeSlug), JSON.stringify(state));
  }

  // ===== Saved views =====
  //
  // A view is the filters, sort and visible columns you already set up per type
  // - they simply had no name, so "my open tickets" or "this quarter's goals"
  // had to be rebuilt by hand every time. Saving one stores the same state
  // object under a name; applying one writes it back and re-renders.
  //
  // Per browser, like the view state it is made of. Column VISIBILITY is a
  // property of the type (show_in_row) rather than of the browser, so a view
  // records which columns it wants and applying it only changes the local
  // filters and sort - it does not silently rewrite the type for everyone.
  const savedViewsKey = (typeSlug) => `entityViews:${typeSlug}`;
  // The header carries a bookmark button beside the filter and column ones; it
  // lists what has been saved for this type and offers to save what is on
  // screen now.

  function readSavedViews(typeSlug) {
    try {
      const all = JSON.parse(localStorage.getItem(savedViewsKey(typeSlug)));
      return Array.isArray(all) ? all : [];
    } catch { return []; }
  }

  function writeSavedViews(typeSlug, views) {
    localStorage.setItem(savedViewsKey(typeSlug), JSON.stringify(views));
  }

  function saveCurrentView(typeSlug, name) {
    const views = readSavedViews(typeSlug).filter(v => v.name !== name);
    views.push({ name, state: readViewState(typeSlug) });
    views.sort((a, b) => a.name.localeCompare(b.name));
    writeSavedViews(typeSlug, views);
    return views;
  }

  function applySavedView(typeSlug, name) {
    const view = readSavedViews(typeSlug).find(v => v.name === name);
    if (!view) return false;
    writeViewState(typeSlug, view.state || {});
    return true;
  }

  function deleteSavedView(typeSlug, name) {
    const views = readSavedViews(typeSlug).filter(v => v.name !== name);
    writeSavedViews(typeSlug, views);
    return views;
  }

  // Sorting compares by the column's own semantics: a status sorts by its
  // position in the type's status list (Not Started before Complete), numbers
  // sort numerically, everything else compares as text.
  function compareBy(field, a, b, rollups) {
    const read = (e) => field.key === 'title'
      ? e.title
      : (field.def ? effectiveValue(e, field.def, rollups) : e.fields?.[field.key]);
    const av = read(a);
    const bv = read(b);

    const blankA = av === null || av === undefined || av === '';
    const blankB = bv === null || bv === undefined || bv === '';
    if (blankA && blankB) return 0;
    if (blankA) return 1;          // blanks sort last, in both directions
    if (blankB) return -1;

    if (field.def?.field_type === 'status') {
      const order = field.def.field_options?.values || [];
      return order.indexOf(av) - order.indexOf(bv);
    }
    if (field.def?.field_type === 'number') return Number(av) - Number(bv);
    return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' });
  }

  function sortSiblings(list, typeSchema, state, rollups) {
    if (!state.sortKey) return list;
    const def = (typeSchema.fields || []).find(f => f.field_key === state.sortKey);
    const field = { key: state.sortKey, def };
    const dir = state.sortDir === 'desc' ? -1 : 1;
    // Sorting happens WITHIN each parent's children, so folders and nesting
    // survive it - the tree is re-ordered, never flattened.
    return list.slice().sort((a, b) => compareBy(field, a, b, rollups) * dir);
  }

  function cellText(entity, field, rollups) {
    const v = field.field_key === 'title'
      ? entity.title
      : (field.field_type ? effectiveValue(entity, field, rollups) : entity.fields?.[field.field_key]);
    if (v === null || v === undefined) return '';
    if (Array.isArray(v)) return v.map(x => x.title || x.url || '').join(' ');
    return String(v);
  }

  function matchesFilters(entity, typeSchema, filters, rollups) {
    return Object.entries(filters).every(([key, term]) => {
      const field = key === 'title'
        ? { field_key: 'title' }
        : (typeSchema.fields || []).find(f => f.field_key === key) || { field_key: key };

      // A bounded column filters on a SET of chosen values: an empty set means
      // All, which is the default. Free-text columns keep substring matching.
      if (Array.isArray(term)) {
        if (term.length === 0) return true;
        const value = cellText(entity, field, rollups);
        const shown = field.field_type === 'date' ? formatDateCell(value) : value;
        return term.includes(String(shown));
      }

      if (!term) return true;
      return cellText(entity, field, rollups).toLowerCase().includes(term.toLowerCase());
    });
  }

  // A filter is a dropdown when the column has a knowable, bounded set of
  // values, and a text box when it does not. Two sources, in order:
  //
  //   1. the field DECLARES its values (status, select, radio, checkbox)
  //   2. otherwise, the distinct values actually present in the data - which is
  //      what makes a Year column a dropdown of the years in use
  //
  // Above the cap it falls back to free text, because a hundred-entry dropdown
  // is worse than typing.
  const FILTER_CHOICE_CAP = 25;

  function columnChoices(field, entities, rollups) {
    if (field.field_type === 'checkbox') {
      return [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }];
    }
    const declared = field.field_options?.values || field.field_options?.choices;
    if (Array.isArray(declared) && declared.length) {
      return declared.map(v => ({ value: String(v), label: String(v) }));
    }
    // Not enumerable: free text is the only sensible control.
    if (['textarea', 'links', 'url', 'recurrence'].includes(field.field_type)) return null;

    const set = new Set();
    for (const e of entities || []) {
      const v = effectiveValue(e, field, rollups);
      if (v === null || v === undefined || v === '' || Array.isArray(v)) continue;
      set.add(String(field.field_type === 'date' ? formatDateCell(v) : v));
      if (set.size > FILTER_CHOICE_CAP) return null;
    }
    if (set.size === 0) return null;
    return [...set].sort().map(v => ({ value: v, label: v }));
  }

  function renderHeader(typeSchema, entities, rollups) {
    const state = readViewState(typeSchema.slug);
    const filters = state.filters || {};
    const cols = visibleColumns(typeSchema);

    // Every column is draggable, Title included. Title still carries the tree
    // indentation and expand arrow, so wherever it lands its track is the
    // flexible one - see gridTemplate().
    // A column can hide its own name in the header - a checkbox or emoji column
    // explains itself and the label only eats width. Sorting still works: the
    // button stays, it just carries the arrow alone.
    const showLabel = (key) => {
      if (key === 'title') return true;
      const f = cols.find(x => x.field_key === key);
      return f ? f.show_column_label !== 0 && f.show_column_label !== false : true;
    };

    const cell = (key, label) => {
      const active = state.sortKey === key;
      const arrow = active ? (state.sortDir === 'desc' ? '▼' : '▲') : '';
      const isTitle = key === 'title';
      return `
        <div class="entity-cell entity-header-cell${isTitle ? ' entity-cell-title' : ''}"
             draggable="true" data-col-key="${escapeAttr(key)}" title="Drag to reorder columns">
          <button type="button" class="entity-sort-btn${active ? ' active' : ''}"
                  data-action="sort-column" data-sort-key="${escapeAttr(key)}"
                  title="Sort by ${escapeAttr(label)}">
            ${showLabel(key) ? escapeHtml(label) : ''} <span class="entity-sort-arrow">${arrow}</span>
          </button>
          ${filterControl(key, label, filters[key] || '')}
        </div>`;
    };

    function filterControl(key, label, current) {
      const field = key === 'title' ? null : cols.find(f => f.field_key === key);
      const choices = field ? columnChoices(field, entities, rollups) : null;

      if (!choices) {
        const text = Array.isArray(current) ? '' : current;
        return `<input type="text" class="entity-filter-input" data-action="filter-column"
                 data-filter-key="${escapeAttr(key)}" value="${escapeAttr(text)}"
                 placeholder="Filter" aria-label="Filter by ${escapeAttr(label)}">`;
      }

      // Several values at once, so "show me everything not Complete" is one
      // filter rather than several passes. No selection means All.
      const chosen = Array.isArray(current) ? current : (current ? [current] : []);
      const summary = chosen.length === 0
        ? 'All'
        : (chosen.length === 1 ? chosen[0] : `${chosen.length} selected`);

      return `
        <div class="entity-filter-multi">
          <button type="button" class="entity-filter-input entity-filter-toggle${chosen.length ? ' has-filter' : ''}"
                  data-action="open-filter-menu" data-filter-key="${escapeAttr(key)}"
                  title="Filter by ${escapeAttr(label)}">${escapeHtml(summary)} <span class="entity-sort-arrow">▾</span></button>
          <div class="entity-filter-menu" hidden>
            <label class="entity-column-option">
              <input type="checkbox" data-action="filter-all" data-filter-key="${escapeAttr(key)}"
                     ${chosen.length === 0 ? 'checked' : ''}> <em>All</em>
            </label>
            ${choices.map(c => `
              <label class="entity-column-option">
                <input type="checkbox" data-action="filter-choice" data-filter-key="${escapeAttr(key)}"
                       value="${escapeAttr(c.value)}" ${chosen.includes(c.value) ? 'checked' : ''}>
                ${escapeHtml(c.label)}
              </label>`).join('')}
          </div>
        </div>`;
    }

    // The chooser lists every field, not just the visible ones - that is how a
    // hidden column gets turned back on.
    const chooser = (typeSchema.fields || [])
      .slice()
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
      .map(f => `
        <label class="entity-column-option">
          <input type="checkbox" data-action="toggle-column" data-field-id="${f.id}"
                 ${f.show_in_row ? 'checked' : ''}> ${escapeHtml(f.label)}
        </label>`).join('');

    return `
      <div class="entity-header-row">
        ${orderedColumns(typeSchema).map(c => cell(c.key, c.label)).join('')}
        <div class="entity-header-actions">
          <div class="btn-group" role="group" style="display: inline-flex; gap: 2px;">
            <button type="button" class="btn btn-sm btn-outline-secondary entity-filters-btn${state.showFilters ? ' active' : ''}"
                    data-action="toggle-filters" title="${state.showFilters ? 'Hide filters' : 'Show filters'}">
              <i class="bi bi-funnel${state.showFilters ? '-fill' : ''}"></i>
            </button>
            <button type="button" class="btn btn-sm btn-outline-secondary entity-columns-btn"
                    data-action="toggle-columns" title="Choose columns">
              <i class="bi bi-layout-three-columns"></i>
            </button>
            <button type="button" class="btn btn-sm btn-outline-secondary entity-views-btn"
                    data-action="toggle-views" title="Saved views">
              <i class="bi bi-bookmark"></i>
            </button>
          </div>
          <div class="entity-views-menu" hidden>
            <div class="entity-columns-menu-title">Saved views</div>
            <div class="entity-views-list"></div>
            <button type="button" class="btn btn-sm btn-outline-secondary w-100 mt-1"
                    data-action="save-view"
                    title="Save the current filters, sort and columns under a name, so this arrangement can be brought back in one click.">Save this view…</button>
          </div>
          <div class="entity-columns-menu" hidden>
            <div class="entity-columns-menu-title">Columns</div>
            ${chooser || '<div class="text-muted small">This type has no fields.</div>'}
          </div>
        </div>
      </div>`;
  }

  // ========== ROW RENDERING ==========
  // One cell's contents. Kept separate from the row so the header and the body
  // stay in step: both iterate the same visibleColumns() list.
  function renderCellValue(entity, f, value, derived = false) {
    if (f.field_type === 'status') return renderStatusToggle(entity, f, value, derived);

    // A date cell always shows something to aim at: the date itself, or a
    // muted prompt when unset. Neither carries a data-action, so clicking it
    // falls through to the row handler and opens this row in the editor, where
    // the date is changed.
    if (f.field_type === 'date' && !derived) {
      const shown = formatDateCell(value);
      const attrs = `data-action="pick-date" data-entity-id="${entity.id}" data-field-key="${escapeAttr(f.field_key)}" data-value="${escapeAttr(shown)}" role="button" tabindex="0"`;
      return shown
        ? `<span class="row-field row-date" ${attrs} title="Click to pick a date">${escapeHtml(shown)}</span>`
        : `<span class="row-field row-date row-date-empty" ${attrs} title="Click to pick a date">Set date</span>`;
    }

    // A dropdown or radio field is a real <select> in the cell: it shows the
    // current value and changes it in place, rather than rendering as inert
    // text that only the editor could alter.
    if ((f.field_type === 'select' || f.field_type === 'radio') && !derived) {
      const choices = f.field_options?.values || f.field_options?.choices || [];
      if (!choices.length) return '';
      const current = value === null || value === undefined || value === ''
        ? resolveFieldDefault(f)
        : String(value);
      return `<select class="row-field row-choice" data-action="set-choice"
              data-entity-id="${entity.id}" data-field-key="${escapeAttr(f.field_key)}"
              title="${escapeAttr(f.label)}">
          <option value=""${current ? '' : ' selected'}>—</option>
          ${choices.map(c => `<option value="${escapeAttr(c)}" ${String(c) === current ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
        </select>`;
    }

    // Notes in a row are a GLYPH, not the text. This is the Dailies pattern
    // (work-item-notes-cell in dailies-items.js): a note can be a paragraph, and
    // fifty rows each showing a paragraph is not a list any more. Lit means
    // there is something there; click to read and write it.
    //
    // Not `derived`: a folder's cell is a roll-up of what is inside it, and
    // "some row in here has notes" is not a fact worth a control. It shows the
    // glyph muted and does nothing, like the other roll-ups.
    if (f.field_type === 'notes' && !derived) {
      const has = value !== null && value !== undefined && String(value).trim() !== '';
      return `<span class="row-field notes-cell" data-action="edit-notes-field"
              data-entity-id="${entity.id}" data-field-key="${escapeAttr(f.field_key)}"
              data-field-type="${f.field_type}" role="button" tabindex="0"
              title="${has ? 'click to read or edit' : 'click to add'}">
          <i class="bi bi-sticky-fill" style="color: ${has ? '#ffd43b' : '#dee2e6'};" aria-hidden="true"></i>
        </span>`;
    }
    if (f.field_type === 'notes') {
      const has = value !== null && value !== undefined && String(value).trim() !== '';
      return `<span class="row-field notes-cell"><i class="bi bi-sticky-fill" style="color: ${has ? '#adb5bd' : '#dee2e6'};" aria-hidden="true"></i></span>`;
    }

    // Whether AI was used at all - a robot glyph, lit when on. The
    // data-action/field-key names stay "claude" internally (that's the
    // stored field_type and DB column, unchanged to avoid a migration); only
    // the label and icon a person sees are "AI".
    if (f.field_type === 'worked_with_claude' && !derived) {
      const on = value === true || value === 1 || value === '1' || value === 'true';
      return `<span class="row-field claude-cell" data-action="toggle-claude-field"
              data-entity-id="${entity.id}" data-field-key="${escapeAttr(f.field_key)}"
              data-value="${on ? '1' : '0'}" role="button" tabindex="0"
              title="AI used - click to change">
          <i class="bi bi-robot" style="color: ${on ? '#FFA500' : '#ddd'}; opacity: ${on ? '1' : '0.5'};" aria-hidden="true"></i>
        </span>`;
    }
    if (f.field_type === 'worked_with_claude') {
      const on = value === true || value === 1 || value === '1' || value === 'true';
      return `<span class="row-field claude-cell"><i class="bi bi-robot" style="color: ${on ? '#FFA500' : '#ddd'}; opacity: ${on ? '1' : '0.5'};" aria-hidden="true"></i></span>`;
    }

    // A checkbox reads as a box, ticked or not, and toggles on click.
    if (f.field_type === 'timebox' && !derived) {
      const current = TIME_BOX_LEVELS.includes(value) ? value : '';
      return `<span class="row-field timebox-cell" data-action="cycle-timebox-field"
              data-entity-id="${entity.id}" data-field-key="${escapeAttr(f.field_key)}"
              data-value="${escapeAttr(current)}" role="button" tabindex="0"
              title="Time box - click to change">
          <i class="bi bi-hourglass-split timebox-icon" aria-hidden="true"></i>
          <span class="timebox-label">${escapeHtml(timeBoxLabel(current))}</span>
        </span>`;
    }
    if (f.field_type === 'timebox') {
      return value ? `<span class="row-field">${escapeHtml(value)}</span>` : '';
    }

    // Worked Time is always stored under focus_seconds/focus_started_at - the
    // same two fields the pin bar's own chip clock reads and writes - so a
    // click here starts/stops the identical timer, pinned or not.
    if (f.field_type === 'duration' && !derived) {
      const running = !!entity.fields?.focus_started_at;
      return `<span class="row-field duration-cell ${running ? 'running' : ''}" data-action="toggle-timer-field"
              data-entity-id="${entity.id}" role="button" tabindex="0"
              title="${running ? 'Click to stop the clock' : 'Click to start the clock'}">
          ${escapeHtml(formatDuration(value))}
        </span>`;
    }
    if (f.field_type === 'duration') {
      return `<span class="row-field">${escapeHtml(formatDuration(value))}</span>`;
    }

    if (f.field_type === 'checkbox' && !derived) {
      const on = value === true || value === 1 || value === '1' || value === 'true';
      return `<span class="row-field checkbox-cell" data-action="toggle-checkbox"
              data-entity-id="${entity.id}" data-field-key="${escapeAttr(f.field_key)}"
              data-value="${on ? '1' : '0'}" role="button" tabindex="0"
              title="${on ? 'Ticked' : 'Not ticked'} - click to change">
          <i class="bi ${on ? 'bi-check-square-fill' : 'bi-square'}"></i>
        </span>`;
    }

    // `emojis` cycles through the set the type declares - no picker, just the
    // next one on each click, the same interaction the status badge uses.
    if (f.field_type === 'emojis' && !derived) {
      const set = f.field_options?.values || [];
      if (!set.length) return '';
      const current = value || set[0];
      return `<span class="row-field emoji-cell" data-action="cycle-emoji"
              data-entity-id="${entity.id}" data-field-key="${escapeAttr(f.field_key)}"
              data-value="${escapeAttr(current)}" role="button" tabindex="0"
              title="Click to change">${escapeHtml(current)}</span>`;
    }

    if (f.field_type === 'emoji' && !derived) {
      const attrs = `data-action="pick-emoji-cell" data-entity-id="${entity.id}" data-field-key="${escapeAttr(f.field_key)}" role="button" tabindex="0"`;
      const shown = value || resolveFieldDefault(f);
      return shown
        ? `<span class="row-field emoji-cell${value ? '' : ' emoji-cell-empty'}" ${attrs} title="Click to change">${escapeHtml(shown)}</span>`
        : `<span class="row-field emoji-cell emoji-cell-empty" ${attrs} title="Click to set an emoji">＋</span>`;
    }

    // Priority renders even when unset - the empty circle IS the control you
    // click to set one. It has to come before the blank-value guard below, or
    // an unprioritised row shows nothing to click.
    if (f.field_type === 'priority' && !derived) {
      return priorityCell(entity, f, value);
    }

    if (value === null || value === undefined || value === '') return '';

    if (derived) {
      if (f.field_type === 'checkbox') {
        const on = value === true || value === 1 || value === '1' || value === 'true';
        return `<span class="row-field is-rollup" title="Rolled up from the items inside">
            <i class="bi ${on ? 'bi-check-square-fill' : 'bi-square'}"></i>
          </span>`;
      }
      // Person/group and links hold an object/array, not a scalar - `derived`
      // is also how dailies-items.js asks for a compact read-only cell for a
      // plain (non-folder) work item, not only a genuine folder roll-up, so
      // this path runs for an ordinary Person field shown on the Dailies
      // rail too. Falling through to the generic escapeHtml(shown) below
      // stringified the raw object as "[object Object]" - a folder never
      // actually reaches here for these two (neither declares a rollup mode,
      // so a folder's own value is null and the blank-value guard above
      // already returned '' before this point), but the Dailies rail always
      // does.
      if ((f.field_type === 'person' || f.field_type === 'group') && value && value.externalId) {
        return `<span class="row-field is-rollup entity-directory-chip-cell" title="${escapeAttr(value.email || '')}">${directoryAvatarHtml(value.displayName, f.field_type)}${escapeHtml(value.displayName || '')}</span>`;
      }
      if (f.field_type === 'links' && Array.isArray(value)) {
        return value.map(l => `
          <a class="row-field is-rollup entity-row-link" href="${escapeAttr(l.url)}" target="_blank" rel="noopener noreferrer" title="${escapeAttr(l.url)}">
            <i class="bi bi-link-45deg"></i>${escapeHtml(l.title || l.url)}
          </a>`).join('');
      }
      // A rolled-up date is still a date: format it like every other date cell
      // rather than showing the raw ISO timestamp the driver returned.
      const shown = f.field_type === 'date' ? formatDateCell(value) : value;
      return `<span class="row-field is-rollup" title="Rolled up from the items inside">${escapeHtml(shown)}</span>`;
    }

    // A picked person/group is {externalId, displayName, email} - shown as a
    // small chip, read-only in the row (the search box is editor-only).
    if ((f.field_type === 'person' || f.field_type === 'group') && value && value.externalId) {
      return `<span class="row-field entity-directory-chip-cell" title="${escapeAttr(value.email || '')}">${directoryAvatarHtml(value.displayName, f.field_type)}${escapeHtml(value.displayName || '')}</span>`;
    }

    // Links are an array of {url, title}; anything else stringifies fine.
    if (f.field_type === 'links' && Array.isArray(value)) {
      return value.map(l => `
        <a class="row-field entity-row-link" href="${escapeAttr(l.url)}" target="_blank" rel="noopener noreferrer" title="${escapeAttr(l.url)}">
          <i class="bi bi-link-45deg"></i>${escapeHtml(l.title || l.url)}
        </a>`).join('');
    }
    if (f.field_type === 'url') {
      return `<a class="row-field entity-row-link" href="${escapeAttr(value)}" target="_blank" rel="noopener noreferrer"><i class="bi bi-link-45deg"></i>${escapeHtml(value)}</a>`;
    }
    return `<span class="row-field">${escapeHtml(value)}</span>`;
  }

  // `iconSchema` is the row's OWN type, used only for its icon. Columns always
  // come from `typeSchema`, which on a mixed-type page is the merged set - every
  // row must lay out on the same grid or the table stops lining up.
  function renderEntityRow(entity, typeSchema, depth = 0, childCount = 0, rollups = null, iconSchema = null) {
    const hasChildren = childCount > 0;
    const isFolder = !!entity.is_folder;
    // Rows nested from another type carry is_copy: true when they were cloned
    // on the way in, false when they are the original being referenced. Only
    // those rows get a badge - a row on its own page is neither.
    const origin = entity.is_copy === undefined ? null : (entity.is_copy ? 'copy' : 'reference');
    const originBadge = origin === 'copy'
      ? '<i class="bi bi-files text-muted entity-origin" title="Copy - edits stay here and do not change the original"></i>'
      : origin === 'reference'
        ? '<i class="bi bi-link-45deg text-muted entity-origin" title="Reference - edits change the original record everywhere it appears"></i>'
        : '';
    const schemaForIcon = iconSchema || typeSchema;
    const icon = rowIcon(schemaForIcon.slug, isFolder, schemaForIcon.icon);


    const isExpanded = localStorage.getItem(`entity-expanded-${entity.id}`) !== 'false';
    // Whatever the editor currently has open is the selected row.
    const isSelected = currentEntityId != null && String(currentEntityId) === String(entity.id);

    // Cells are emitted in orderedColumns() order - the same list the header
    // uses - so Title lands wherever it has been dragged to. Folders carry no
    // field values of their own: a column that declares a rollup shows what the
    // items inside add up to, any other stays blank.
    const cells = orderedColumns(typeSchema).map(c => {
      if (c.isTitle) {
        return `
          <div class="entity-cell entity-cell-title" data-col="title">
            <span class="entity-indent" style="width: ${depth * INDENT_PX}px;"></span>
            ${hasChildren ? `<span class="entity-toggle" data-action="toggle-expand">▶</span>` : '<span class="entity-toggle-spacer"></span>'}
            ${icon ? `<span class="entity-row-icon">${icon}</span>` : ''}
          ${originBadge}
            <span class="entity-title" title="Double-click to rename">${escapeHtml(entity.title)}</span>${app.childCountBadge(childCount)}
          </div>`;
      }
      const f = c.field;
      // is_folder_field: a field defined on the permanent 'folder' system
      // type and duplicated onto every folder-capable type's own field list
      // (entityTypeService.js). It belongs to the FOLDER, not to this type's
      // ordinary rows - directly editable wherever a folder row shows it,
      // blank everywhere else, never a roll-up.
      let inner;
      if (f.is_folder_field) {
        inner = isFolder ? renderCellValue(entity, f, entity.fields?.[f.field_key], false) : '';
      } else {
        const derived = isFolder && !!f.rollup;
        const value = derived
          ? rollups?.get(entity.id)?.[f.field_key]
          : (isFolder ? null : entity.fields?.[f.field_key]);
        inner = (isFolder && !f.rollup) ? '' : renderCellValue(entity, f, value, derived);
      }
      return `<div class="entity-cell" data-col="${escapeAttr(f.field_key)}">${inner}</div>`;
    }).join('');

    return `
      <div class="entity-row ${isExpanded ? 'expanded' : ''} ${isFolder ? 'entity-row-folder' : ''} ${isSelected ? 'selected' : ''}" data-entity-id="${entity.id}" data-entity-type="${typeSchema.slug}" data-is-folder="${isFolder ? '1' : '0'}" data-depth="${depth}" draggable="true">
        <div class="entity-row-content">
          ${cells}
          <div class="entity-actions">
            <button class="btn btn-sm btn-primary" data-action="edit-row" data-entity-id="${entity.id}" title="Open the editor for this row" aria-label="Edit"><i class="bi bi-pencil"></i></button>
            ${origin === 'reference'
              ? `<button class="btn btn-sm btn-danger" data-action="unlink" data-entity-id="${entity.id}" title="Remove it from here - the record itself is untouched" aria-label="Remove"><i class="bi bi-x-lg"></i></button>`
              : `<button class="btn btn-sm btn-danger" data-action="delete" data-entity-id="${entity.id}" title="${origin === 'copy' ? 'Delete this copy and everything inside it' : 'Delete'}" aria-label="Delete"><i class="bi bi-trash"></i></button>`}
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
  // `schemaForEntity` lets a row render with its OWN type's icon and columns
  // when the tree holds more than one type - a template may contain ideas,
  // categories, tickets and so on. Pages that only ever hold one type pass
  // nothing and every row uses the page's schema, exactly as before.
  function renderTree(entities, typeSchema, relationships = [], schemaForEntity = null) {
    const schemaOf = (entity) => (schemaForEntity ? schemaForEntity(entity) : typeSchema);
    const state = readViewState(typeSchema.slug);
    const filters = state.filters || {};
    const hasFilters = Object.values(filters).some(Boolean);

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

    // Computed once per render, before filtering, so a folder's roll-up always
    // reflects everything inside it rather than only the rows a filter left.
    const rollups = computeRollups(roots, childrenByParent, typeSchema);

    // A row survives a filter if it matches, or if anything beneath it does -
    // otherwise filtering would hide the folder holding the only match and the
    // result would look empty.
    const keep = new Set();
    if (hasFilters) {
      const walk = (entity) => {
        const children = childrenByParent.get(entity.id) || [];
        const anyChildKept = children.map(walk).some(Boolean);
        const self = matchesFilters(entity, typeSchema, filters, rollups);
        if (self || anyChildKept) { keep.add(entity.id); return true; }
        return false;
      };
      roots.forEach(walk);
    }

    function renderNode(entity, depth = 0) {
      if (hasFilters && !keep.has(entity.id)) return '';

      const children = sortSiblings(childrenByParent.get(entity.id) || [], typeSchema, state, rollups);
      const visibleChildren = hasFilters ? children.filter(c => keep.has(c.id)) : children;
      // A filter that hides every child must also hide the expand arrow, or the
      // row claims children it will not show.
      const isExpanded = localStorage.getItem(`entity-expanded-${entity.id}`) !== 'false' || hasFilters;

      const childrenHtml = visibleChildren.length > 0 ? `
        <div class="entity-node-children ${isExpanded ? 'visible' : ''}">
          ${visibleChildren.map(child => renderNode(child, depth + 1)).join('')}
        </div>
      ` : '';

      return `
        <div class="entity-node ${isExpanded ? 'expanded' : ''}" data-entity-id="${entity.id}">
          ${renderEntityRow(entity, typeSchema, depth, visibleChildren.length, rollups, schemaOf(entity))}
          ${childrenHtml}
        </div>
      `;
    }

    const sortedRoots = sortSiblings(hasFilters ? roots.filter(r => keep.has(r.id)) : roots, typeSchema, state, rollups);
    const body = sortedRoots.map(r => renderNode(r)).join('');

    return renderListShell(typeSchema, body, sortedRoots.length, entities, rollups);
  }

  // Header + body share one grid template, set here as a custom property, so
  // the header cells line up with the row cells beneath them.
  function renderListShell(typeSchema, body, count, entities, rollups) {
    const empty = `<div class="entity-empty text-muted">Nothing to show${
      Object.values(readViewState(typeSchema.slug).filters || {}).some(Boolean) ? ' for this filter' : ''
    }.</div>`;
    const view = readViewState(typeSchema.slug);
    const filtersActive = Object.values(view.filters || {}).some(v => (Array.isArray(v) ? v.length : v));
    const showFilters = view.showFilters || filtersActive;
    return `
      <div class="entity-list${showFilters ? ' filters-shown' : ''}" style="--entity-grid: ${gridTemplate(typeSchema)};">
        ${renderHeader(typeSchema, entities, rollups)}
        <div class="entity-tree">${count > 0 ? body : empty}</div>
      </div>`;
  }

  // Flat list for types that do not support hierarchy - same header, same
  // columns, same sorting and filtering; only the nesting is absent.
  function renderFlatList(entities, typeSchema) {
    const state = readViewState(typeSchema.slug);
    const filters = state.filters || {};
    const shown = sortSiblings(
      entities.filter(e => matchesFilters(e, typeSchema, filters, null)),
      typeSchema,
      state,
      null
    );
    return renderListShell(typeSchema, shown.map(e => renderEntityRow(e, typeSchema, 0, 0)).join(''), shown.length, entities, null);
  }

  // The yyyy-mm-dd a date input requires. Values come back from the driver as
  // full ISO timestamps ("2026-08-12T07:00:00.000Z"), and <input type="date">
  // rejects anything else - it renders BLANK rather than complaining, which
  // made a saved date look like it had never persisted.
  //
  // Read via local components, not the UTC prefix: a DATE column comes back as
  // local midnight, so slicing the ISO string would land on the previous day
  // anywhere east of UTC.
  function isoDatePart(value) {
    if (value === null || value === undefined || value === '') return '';
    const str = String(value);
    const plain = str.match(/^(\d{4}-\d{2}-\d{2})$/);
    if (plain) return plain[1];
    const d = new Date(str);
    if (Number.isNaN(d.getTime())) return str;
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // Dates arrive as 'YYYY-MM-DD' or as a full ISO timestamp. The stored value
  // never changes; only how it is shown, per Settings > Theme > Date Format.
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  function dateFormatPreference() {
    try {
      return JSON.parse(localStorage.getItem('themePreferences') || '{}').dateFormat || 'YYYY-MM-DD';
    } catch { return 'YYYY-MM-DD'; }
  }

  function formatDateCell(value) {
    if (value === null || value === undefined || value === '') return '';
    const iso = isoDatePart(value);
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return String(value);

    const [, y, mo, d] = m;
    // Constructed as UTC and read back as UTC, so a date never shifts a day
    // either side of midnight in the viewer's timezone.
    const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
    const mon = MONTHS[dt.getUTCMonth()];

    switch (dateFormatPreference()) {
      case 'MM/DD/YYYY': return `${mo}/${d}/${y}`;
      case 'DD/MM/YYYY': return `${d}/${mo}/${y}`;
      case 'D MMM YYYY': return `${Number(d)} ${mon} ${y}`;
      case 'MMM D, YYYY': return `${mon} ${Number(d)}, ${y}`;
      case 'DDD, MMM D': return `${DAYS[dt.getUTCDay()]}, ${mon} ${Number(d)}`;
      default: return `${y}-${mo}-${d}`;
    }
  }

  // ========== ROW <-> EDITOR SYNC ==========
  //
  // Both directions update in place rather than re-rendering the list: a full
  // re-render would rebuild the row the editor is anchored to, and would fight
  // with the caret while typing.

  // EVERY row showing this record, not one of them. It used to be scoped by
  // `data-entity-type="${currentTypeSlug}"`, which is the row's OWN type - and
  // a row nested from another type (an idea inside a template) carries its own
  // slug while the editor carries the PAGE's, so the selector matched nothing
  // and nested rows never mirrored what was typed into the editor. Entity ids
  // are globally unique, so the id alone identifies the record; the same record
  // legitimately appears more than once (listed on its own page and referenced
  // inside a template), and both copies should show the edit.
  function rowEls(entityId) {
    if (entityId == null) return [];
    return [...document.querySelectorAll(`.entity-row[data-entity-id="${entityId}"]`)];
  }

  // Editor -> row.
  function mirrorEditorToRow() {
    if (currentEntityId == null) return;
    const rows = rowEls(currentEntityId);
    const form = document.getElementById('entity-editor-form');
    if (rows.length === 0 || !form) return;

    const titleInput = form.querySelector('[name="title"]');
    for (const row of rows) {
      // The preview is unsaved state, so the row says so. Without this the list
      // shows an edited value indistinguishable from a persisted one, and
      // closing the editor would silently revert it.
      row.classList.add('entity-row-unsaved');
      row.title = 'Unsaved changes - saving automatically';

      const titleEl = row.querySelector('.entity-title');
      // Never while it is being renamed in place: that span IS the input, and
      // rewriting its text under the caret would eat what is being typed.
      if (titleEl && titleInput && !titleEl.isContentEditable) {
        titleEl.textContent = titleInput.value;
      }
    }

    if (currentIsFolder) return;   // a folder's cells are roll-ups, not its own

    const entity = allEntities.find(e => String(e.id) === String(currentEntityId));
    const values = collectFormValues(typeSchema, false).fields;

    for (const f of visibleColumns(typeSchema)) {
      const cells = rows
        .map(row => row.querySelector(`.entity-cell[data-col="${CSS.escape(f.field_key)}"]`))
        .filter(Boolean);
      if (cells.length === 0) continue;
      // Only write a cell whose content actually changed. This mirror runs on
      // every input AND change event - including the change a blur fires when
      // focus leaves a dirty field for a cell control - and rewriting an
      // unchanged cell's innerHTML detaches the very node the mouse is going
      // down on, so the click the user is mid-way through never happens.
      // Their first click on any cell control after typing simply vanished.
      //
      // Compared through a <template> so both sides are the BROWSER's
      // serialization - the raw template literal (indentation, attribute
      // spelling) never string-equals what innerHTML reads back, so a direct
      // comparison rewrote every cell every time and fixed nothing.
      const html = renderCellValue(entity || { id: currentEntityId }, f, values[f.field_key], false);
      mirrorScratch.innerHTML = html;
      for (const cell of cells) {
        if (cell.innerHTML !== mirrorScratch.innerHTML) cell.innerHTML = html;
      }
    }
  }
  // Detached scratch node for the comparison above; never in the document.
  const mirrorScratch = document.createElement('div');

  // Row -> editor. Called after a row-side change has been persisted, so the
  // editor is updated without being marked dirty - the value is already saved.
  // Moves the "this one is current" mark within a set of visible choices.
  // Used by both directions: a click here, and a change made from the row cell.
  function markOptionChoice(group, value) {
    group?.querySelectorAll('.option-choice').forEach(opt => {
      const on = String(opt.dataset.value) === String(value ?? '');
      opt.classList.toggle('selected', on);
      opt.setAttribute('aria-checked', String(on));
    });
  }

  // The values a cell can be set to, for one field. Single source for both ways
  // of changing a cell: clicking it (which advances to the next) and
  // right-clicking it (which offers the lot). generic-entity-init.js used to
  // carry its own copy of the priority ladder, so the two could drift.
  function cellChoices(field) {
    if (!field) return null;
    switch (field.field_type) {
      case 'status':   return field.field_options?.values || null;
      case 'priority': return PRIORITY_LEVELS.slice();
      case 'timebox':  return TIME_BOX_LEVELS.slice();
      case 'emojis':   return field.field_options?.values || null;
      case 'checkbox': return [false, true];
      // Two states, so right-clicking it offers both - and with rows
      // multi-selected, sets it on all of them, like every other cycling cell.
      case 'worked_with_claude': return [false, true];
      case 'select':
      case 'radio':    return field.field_options?.choices || null;
      default:         return null;
    }
  }

  // The colour class a value carries, so a menu of statuses reads the same as
  // the cell and the editor - one definition of what each state looks like,
  // used everywhere it is shown.
  function choiceClass(field, value) {
    if (field?.field_type !== 'status') return '';
    return `status-role-${statusRole(field, value)}`;
  }

  // How one of those values should read in a menu.
  function choiceLabel(field, value) {
    if (field.field_type === 'checkbox') return value ? 'Checked' : 'Unchecked';
    if (field.field_type === 'worked_with_claude') return value ? 'AI used' : 'AI not used';
    if (field.field_type === 'priority') return (PRIORITY_STYLE[value] || PRIORITY_STYLE['']).label;
    if (field.field_type === 'timebox') return timeBoxLabel(value);
    return value === '' || value == null ? '(none)' : String(value);
  }

  function syncEditorFromRow(entityId, fieldKey, value) {
    if (currentEntityId == null || String(currentEntityId) !== String(entityId)) return;
    const form = document.getElementById('entity-editor-form');
    const control = form?.querySelector(`[name="${CSS.escape(fieldKey)}"]`);
    if (!control) return;

    // Several field types render a hidden input PLUS a visible control, and
    // some render a GROUP of inputs. Writing `.value` on whatever the first
    // [name=] match happens to be is only correct for the plain ones, which is
    // why changing these from a row cell left the editor showing the old value.
    // Each shape is handled explicitly below; the plain case is last.

    // status, priority - hidden input + a badge/meter span
    const cycleGroup = control.closest('[data-cycle-values]');
    if (cycleGroup) return paintCycleControl(cycleGroup, value);

    // radio - N inputs sharing the name. `.value = x` on the first one would
    // rewrite that radio's value attribute and check nothing.
    if (control.type === 'radio') {
      form.querySelectorAll(`input[type="radio"][name="${CSS.escape(fieldKey)}"]`)
        .forEach(r => { r.checked = String(r.value) === String(value ?? ''); });
      return;
    }

    // emoji - hidden input + a button showing the glyph
    if (control.type === 'hidden') {
      control.value = value ?? '';
      const group = control.closest('.form-group') || control.parentElement;

      // emoji - a button showing the chosen glyph
      const btn = control.parentElement?.querySelector('[data-action="pick-emoji-field"]');
      if (btn) btn.textContent = value || '＋';

      // emojis, status - the whole set is on screen, so the MARK has to move
      markOptionChoice(group, value);
      return;
    }

    if (control.type === 'checkbox') control.checked = !!value;
    else control.value = value ?? '';
  }

  // ========== EDITOR ==========
  // ===== Reopening after a reload =====
  //
  // A hard refresh used to drop whatever was open, which is jarring when the
  // refresh was incidental to what you were doing. Only the record's identity
  // is kept, in localStorage alongside the other per-browser view state (rail
  // width, calendar open) - it is a view preference, not data.
  const OPEN_EDITOR_KEY = 'entityOpenEditor';

  // ONE entry, not one per type. There is a single editor - `currentEntityId`
  // and `currentTypeSlug` are module-level - so storing a record per type meant
  // every tab reopened its own on load: several visible editor panes, several
  // elements sharing id="entity-editor-form", and the singleton left pointing
  // at whichever tab happened to initialise last. Clicking a row then could not
  // resolve a form at all.
  function rememberOpenEditor(typeSlug, entityId) {
    if (!typeSlug) return;
    try {
      if (entityId == null) {
        // Only clear if THIS type owns the remembered editor; another tab
        // closing its (never-restored) editor must not wipe ours.
        const cur = JSON.parse(localStorage.getItem(OPEN_EDITOR_KEY) || 'null');
        if (!cur || cur.typeSlug === typeSlug) localStorage.removeItem(OPEN_EDITOR_KEY);
        return;
      }
      localStorage.setItem(OPEN_EDITOR_KEY, JSON.stringify({ typeSlug, id: String(entityId) }));
    } catch { /* storage disabled or full - the editor just will not reopen */ }
  }

  // Returns the id only for the type that actually owns the remembered editor.
  function recallOpenEditor(typeSlug) {
    try {
      const cur = JSON.parse(localStorage.getItem(OPEN_EDITOR_KEY) || 'null');
      return cur && cur.typeSlug === typeSlug ? cur.id : null;
    } catch { return null; }
  }

  // Puts Revert/Save back in the pane header they were rendered in, so a
  // rewrite of the editor's content cannot take them with it. Safe to call
  // when the bar is already home, or when there is no bar.
  function returnActionsBarHome(typeSlug) {
    const outerPane = document.getElementById(`${typeSlug}EditorPane`);
    const bar = outerPane?.querySelector('.editor-actions-bar');
    const home = outerPane?.querySelector('.editor-actions-home');
    if (bar && home && bar.parentElement !== home) home.appendChild(bar);
  }

  // Empty one type's editor pane and hide it, leaving its Revert bar parked in
  // the pane header where populate() expects to find it. Shared by close() and
  // by the sweep below, so there is one definition of "this pane holds no
  // editor now" rather than two that can drift.
  function clearEditorPane(typeSlug) {
    if (!typeSlug) return;
    returnActionsBarHome(typeSlug);
    const pane = document.getElementById(`${typeSlug}-editor-pane`);
    if (pane) pane.innerHTML = '';
    splitPanesByType[typeSlug]?.hideRightPane();
  }

  // THERE IS ONE EDITOR, and its form carries a fixed id - so a form left
  // behind in another type's pane is a second #entity-editor-form, and
  // document.getElementById() then answers with whichever comes FIRST in the
  // document rather than the one on screen.
  //
  // close() empties the pane it owns, but populate() on a DIFFERENT type never
  // closed anything: it just wrote into the new pane and left the old form
  // sitting there. Switching from a type whose pane comes earlier in the DOM -
  // the Templates and Dailies rails come before every content tab, so any
  // template edit did it - wired trackFormChanges(), collectFormValues() and
  // mirrorEditorToRow() to the INVISIBLE form. Typing a title then changed
  // nothing in the row, nothing was marked dirty, and autosave never fired.
  // With no Save button left to fall back on, the edit was simply lost, and it
  // depended on tab order, so it looked intermittent and machine-specific.
  //
  // Sweeping here is what keeps that id a singleton, which is what every
  // getElementById('entity-editor-form') in this file already assumes.
  function clearForeignEditorPanes(keepTypeSlug) {
    for (const form of document.querySelectorAll('form.entity-editor-form')) {
      const pane = form.closest('[id$="-editor-pane"]');
      // Not in a pane at all - it cannot be reached or saved, so it is debris.
      if (!pane) { form.remove(); continue; }
      const slug = pane.id.slice(0, -'-editor-pane'.length);
      if (slug === keepTypeSlug) continue;
      clearEditorPane(slug);
    }
  }

  function buildForm(typeSchema, entity = {}) {
    // A folder only organizes - it has no field values of its own, so its
    // editor is the name and nothing else, for every type alike.
    // Internal state that happens to live in the field table is not a field a
    // person edits. board_bay and board_order are written by dragging a row
    // onto the priorities board; rendered as a text box and a number box on
    // every record, they are clutter at best - and at worst a stray value puts
    // an unrelated record on the board, which is exactly what happened.
    // A folder organises rather than holding values, so its editor is normally
    // just a name. Worked Time is the exception: a folder can be pinned to the
    // focus bar and accumulate against it, and time recorded somewhere you
    // cannot see or correct is worse than not recording it. Fields defined on
    // the permanent 'folder' system type (is_folder_field, propagated by
    // entityTypeService.js) are the other exception - those exist FOR
    // folders, so editableFields() includes them here too.
    //
    // Selected by TYPE, not by key, so another duration field added later
    // appears here without this needing to know its name.
    // Sorted by display_order rather than trusting the order the array arrived
    // in: reordering columns rewrites each field's display_order VALUE without
    // re-sorting this array, so the editor kept showing the pre-drag order
    // until a reload while the rows and column chooser moved.
    const fields = editableFields(typeSchema, entity.is_folder);
    return `
      <form id="entity-editor-form" class="entity-editor-form" onsubmit="return false;">
        <div class="form-group">
          <div class="entity-title-row">
            <label>${entity.is_folder ? 'Folder Name' : 'Title'} *</label>
            <div class="entity-title-actions"></div>
          </div>
          <input type="text" name="title" value="${escapeAttr(entity.title || '')}" class="form-control" required>
        </div>

        ${fields.map(field => {
          const renderer = fieldRenderers[field.field_type] || fieldRenderers.text;
          const value = entity.fields?.[field.field_key];
          // Each field carries the same two controls the header offers: whether
          // it is a column, and where it sits. They write show_in_row and
          // display_order - the same values the column chooser and the header
          // drag write, so all three views stay in agreement.
          return `
            <div class="editor-field" draggable="true"
                 data-field-id="${field.id}" data-field-key="${escapeAttr(field.field_key)}">
              <span class="editor-field-handle" title="Drag to reorder">⋮⋮</span>
              <div class="editor-field-gutter">
                <div class="editor-field-caption">
                  <span class="editor-field-name">${escapeHtml(field.label)}</span>
                </div>
                <div class="form-check form-switch editor-field-toggle" title="Show this field as a column">
                  <input type="checkbox" class="form-check-input editor-field-col" ${field.show_in_row ? 'checked' : ''}>
                  <i class="bi bi-layout-three-columns editor-toggle-glyph" aria-hidden="true"></i>
                </div>
                <div class="form-check form-switch editor-field-toggle" title="Show this column's name in the header">
                  <input type="checkbox" class="form-check-input editor-field-label" ${field.show_column_label !== 0 && field.show_column_label !== false ? 'checked' : ''}>
                  <i class="bi bi-tag editor-toggle-glyph" aria-hidden="true"></i>
                </div>
              </div>
              <div class="editor-field-body">${renderer(field, value)}</div>
            </div>`;
        }).join('')}
      </form>
    `;
  }

  // Field values go under `fields`, not alongside `title` - that's the shape
  // entityService.js#createEntity/updateEntity reads. They used to be returned
  // flat, which meant every field value (notes, status, recurrence) was
  // silently dropped on save for every type.
  // Which fields a record's editor shows - and therefore which ones its save
  // collects. ONE definition, because these two had drifted: folders were given
  // a Worked Time control that collectFormValues then threw away, so the edit
  // appeared to work and vanished on reload.
  //
  // A folder organises rather than holding values, so it shows only what the
  // engine can genuinely record against it - time, which it accumulates when
  // pinned to the focus bar - PLUS whatever fields are defined on the
  // permanent 'folder' system type and duplicated onto this type
  // (is_folder_field, propagated by entityTypeService.js). Those belong to
  // the folder, not to this type's ordinary rows, so they run the other way
  // on a non-folder record: everything EXCEPT them.
  function editableFields(typeSchema, isFolder) {
    const all = (typeSchema.fields || []).filter(f => !INTERNAL_FIELD_KEYS.has(f.field_key));
    const usable = isFolder
      ? all.filter(f => f.field_type === 'duration' || f.is_folder_field)
      : all.filter(f => !f.is_folder_field);
    return usable.slice().sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  }

  function collectFormValues(typeSchema, isFolder = false) {
    const form = document.getElementById('entity-editor-form');
    const formData = new FormData(form);
    const data = { title: formData.get('title'), is_folder: isFolder, fields: {} };

    for (const field of editableFields(typeSchema, isFolder)) {
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
      } else if (field.field_type === 'person' || field.field_type === 'group') {
        data.fields[field.field_key] = value ? JSON.parse(value) : null;
      } else {
        data.fields[field.field_key] = value || null;
      }
    }
    return data;
  }

  // What the form looked like when it was last LOADED or SAVED. markChanged()
  // compares against it rather than trusting the event that woke it.
  let savedFormSnapshot = null;

  function formSnapshot() {
    if (!document.getElementById('entity-editor-form') || !typeSchema) return null;
    try {
      return JSON.stringify(collectFormValues(typeSchema, currentIsFolder));
    } catch {
      return null;
    }
  }

  function rememberFormAsSaved() {
    savedFormSnapshot = formSnapshot();
  }

  function markChanged() {
    // A text input fires `change` when it loses focus if it was edited since
    // gaining it - even when autosave has ALREADY stored that exact value. So
    // clicking the pencil to close an editor you had just typed in re-armed
    // hasChanges on the way out, and populate()'s toggle-close refuses to run
    // while there are unsaved changes: the click did nothing at all, and the
    // next one did nothing either. Only the create-then-type path hit it,
    // because it is the only one that leaves an edited input focused.
    //
    // Compare with what was last loaded or saved instead of believing the
    // event. Typing something and typing it back also stops arming Revert.
    const now = formSnapshot();
    if (savedFormSnapshot !== null && now !== null && now === savedFormSnapshot) return;
    hasChanges = true;
    // Revert enables the moment anything changes - it is the only manual
    // control left on this bar, autosave owns Save's old job.
    const revertBtn = document.getElementById(`${currentTypeSlug}CloseBtn`);
    if (revertBtn) revertBtn.disabled = false;
    scheduleAutoSave();
  }

  // Repaints the priority meter in the editor to show `value`. Both directions
  // need it: clicking the meter, and a click on the ROW's cell syncing back. It
  // used to live inside the editor's own click handler, so a change made from
  // the cell updated the hidden input and left the meter showing the old value.
  //
  // Priority is the only cycling control now - status shows its whole ladder -
  // so this no longer branches on which field it is.
  function paintCycleControl(group, value) {
    if (!group) return;
    const control = group.querySelector('.editor-cycle');
    if (!control) return;
    const input = group.querySelector('input[type="hidden"]');
    if (input) input.value = value ?? '';

    // Time box used to have a branch here. It shows every value now, like
    // status, so it reaches the editor through markOptionChoice instead and
    // this could never fire again.
    const style = PRIORITY_STYLE[value] || PRIORITY_STYLE[''];
    control.innerHTML = `${priorityGlyph(value)}<span class="editor-cycle-label">${escapeHtml(style.label)}</span>`;
    control.title = `${style.label} - click to change`;
  }

  // One handler for every editor control that cycles. The field group carries
  // its own ladder in data-cycle-values. Only priority uses this now - status
  // moved to showing every value at once - but nothing here knows which field
  // it is driving, so a future cycling field needs no changes.
  function wireEditorCycles() {
    const form = document.getElementById('entity-editor-form');
    if (!form) return;

    form.addEventListener('click', (e) => {
      const control = e.target.closest('.editor-cycle');
      if (!control) return;
      const group = control.closest('[data-cycle-values]');
      if (!group) return;
      e.preventDefault();

      let values;
      try { values = JSON.parse(group.dataset.cycleValues); } catch { return; }
      if (!Array.isArray(values) || values.length === 0) return;

      const input = group.querySelector('input[type="hidden"]');
      const current = input?.value ?? '';
      const next = values[(values.indexOf(current) + 1) % values.length];
      if (input) input.value = next;

      // Redraw the control in place so it looks exactly like its cell would.
      paintCycleControl(group, next);

      markChanged();
      // A <span> click fires neither `input` nor `change`, so the form-level
      // mirror listeners never see it. Without this the editor's badge/meter
      // moved while the row's cell kept the old value - the other half of the
      // two-way sync.
      mirrorEditorToRow();
    });
  }

  function trackFormChanges() {
    const form = document.getElementById('entity-editor-form');
    if (form) {
      wireEditorCycles();
      // The Person/Group search box is staging text, not a field value - it
      // has no `name` and collectFormValues never reads it, only the hidden
      // input a RESULT click writes. Marking the record dirty (and scheduling
      // an autosave) while someone is just typing a query, before they've
      // picked anyone, would save nothing different and show a false
      // "unsaved" dot the whole time they're searching.
      const isDirectorySearchInput = (e) => e.target.closest('.entity-directory-input');
      form.addEventListener('input', (e) => { if (!isDirectorySearchInput(e)) markChanged(); });
      form.addEventListener('change', (e) => { if (!isDirectorySearchInput(e)) markChanged(); });

      // Editing a field updates that row's cell straight away, so the list and
      // the editor never disagree about what is on screen. This is a PREVIEW of
      // unsaved state: closing or cancelling the editor re-renders the list
      // from persisted data, which discards it.
      // Duration: the box is readable text, the stored value is seconds.
      form.addEventListener('input', (e) => {
        const box = e.target.closest('.duration-input');
        if (!box) return;
        const hidden = box.parentElement?.querySelector('input[type="hidden"]');
        if (hidden) hidden.value = parseDuration(box.value) ?? '';
      });

      const mirror = () => mirrorEditorToRow();
      form.addEventListener('input', (e) => { if (!isDirectorySearchInput(e)) mirror(); });
      form.addEventListener('change', (e) => { if (!isDirectorySearchInput(e)) mirror(); });

      // Person/Group: live-search Entra ID through the server as you type.
      // Debounced and staleness-guarded the same way command-palette.js's
      // search is - a slower earlier response landing after a faster later
      // one must not overwrite what's now a different search term.
      form.addEventListener('input', (e) => {
        const input = e.target.closest('.entity-directory-input');
        if (!input) return;
        const wrapper = input.closest('.entity-directory-field');
        const resultsEl = wrapper?.querySelector('.entity-directory-results');
        if (!wrapper || !resultsEl) return;
        const kind = wrapper.dataset.fieldType;
        const term = input.value.trim();

        const prevTimer = directorySearchTimers.get(input);
        if (prevTimer) clearTimeout(prevTimer);

        if (term.length < 2) {
          resultsEl.hidden = true;
          resultsEl.innerHTML = '';
          return;
        }

        const timer = setTimeout(async () => {
          const endpoint = kind === 'group' ? '/api/integrations/entra/search/groups' : '/api/integrations/entra/search/users';
          let items = [];
          try {
            items = (await app.fetchData(`${endpoint}?q=${encodeURIComponent(term)}`)) || [];
          } catch (error) {
            if (input.value.trim() !== term) return; // superseded while the request was in flight
            resultsEl.hidden = false;
            resultsEl.innerHTML = `<div class="entity-directory-hint text-danger">${escapeHtml(error.message)}</div>`;
            return;
          }
          if (input.value.trim() !== term) return; // superseded - discard, a newer search owns the dropdown now

          resultsEl.hidden = false;
          // The first row starts "active" so Enter picks something useful
          // the moment results appear, without an arrow key first.
          resultsEl.innerHTML = items.length
            ? items.map((item, i) => `
                <div class="entity-directory-result${i === 0 ? ' active' : ''}" data-action="directory-pick" data-value="${escapeAttr(JSON.stringify({ externalId: item.id, displayName: item.displayName, email: item.email }))}">
                  ${directoryAvatarHtml(item.displayName, kind)}
                  <span class="entity-directory-result-main">
                    <span class="entity-directory-result-name">${escapeHtml(item.displayName || '(no name)')}</span>
                    ${item.email ? `<span class="entity-directory-result-email">${escapeHtml(item.email)}</span>` : ''}
                  </span>
                </div>
              `).join('')
            : '<div class="entity-directory-hint">No matches</div>';
        }, DIRECTORY_SEARCH_DEBOUNCE_MS);
        directorySearchTimers.set(input, timer);
      });

      // Closing the results dropdown on blur has to wait a beat, or the blur
      // (which fires before the click) removes the row the click was aimed
      // at before the click ever lands.
      form.addEventListener('focusout', (e) => {
        const input = e.target.closest('.entity-directory-input');
        if (!input) return;
        const resultsEl = input.closest('.entity-directory-field')?.querySelector('.entity-directory-results');
        if (resultsEl) setTimeout(() => { resultsEl.hidden = true; }, 150);
      });

      // Add/remove rows for `links` fields. Delegated, so it covers every
      // links field on the form without per-field wiring.
      form.addEventListener('click', async (e) => {
        // Shared by every "pick one of these" field - emojis, status, and
        // anything later that shows its whole set instead of hiding it.
        const picked = e.target.closest('[data-action="pick-option"]');
        if (picked) {
          const group = picked.closest('.form-group');
          const input = group?.querySelector('input[type="hidden"]');
          if (input) input.value = picked.dataset.value || '';
          markOptionChoice(group, picked.dataset.value);
          markChanged();
          mirrorEditorToRow();   // a button click fires no input/change event
          return;
        }

        const emojiBtn = e.target.closest('[data-action="pick-emoji-field"]');
        if (emojiBtn) {
          const picked = await app.pickEmoji(emojiBtn);
          if (picked === null) return;
          emojiBtn.textContent = picked || '＋';
          const input = emojiBtn.parentElement.querySelector('input[type="hidden"]');
          if (input) input.value = picked;
          markChanged();
          mirrorEditorToRow();
          return;
        }

        const addBtn = e.target.closest('[data-action="add-link"]');
        if (addBtn) {
          const list = addBtn.closest('[data-field-type="links"]')?.querySelector('.entity-links-list');
          if (!list) return;
          // A brand new row has nothing to display yet, so it starts expanded.
          list.insertAdjacentHTML('beforeend', `
            <div class="entity-link-row editing">
              <div class="entity-link-display">
                <a class="entity-link-anchor" href="#" target="_blank" rel="noopener noreferrer"><i class="bi bi-link-45deg"></i>New link</a>
                <button type="button" class="btn btn-sm btn-link entity-link-edit-btn" data-action="edit-link" title="Edit this link" aria-label="Edit this link"><i class="bi bi-pencil"></i></button>
                <button type="button" class="btn btn-sm btn-link text-danger" data-action="remove-link" title="Remove link" aria-label="Remove link"><i class="bi bi-x-lg"></i></button>
              </div>
              <div class="entity-link-fields">
                <input type="url" class="form-control form-control-sm entity-link-url" placeholder="https://example.com">
                <input type="text" class="form-control form-control-sm entity-link-title" placeholder="Name">
              </div>
            </div>
          `);
          list.querySelector('.entity-link-row:last-child .entity-link-url')?.focus();
          markChanged();
          return;
        }

        const editLink = e.target.closest('[data-action="edit-link"]');
        if (editLink) {
          editLink.closest('.entity-link-row')?.classList.toggle('editing');
          return;
        }

        const removeBtn = e.target.closest('[data-action="remove-link"]');
        if (removeBtn) {
          removeBtn.closest('.entity-link-row')?.remove();
          markChanged();
          return;
        }

        const pickResult = e.target.closest('[data-action="directory-pick"]');
        if (pickResult) {
          let picked;
          try { picked = JSON.parse(pickResult.dataset.value); } catch { return; }
          applyDirectoryPick(pickResult.closest('.entity-directory-field'), picked);
          return;
        }

        const clearDirectory = e.target.closest('[data-action="directory-clear"]');
        if (clearDirectory) {
          const wrapper = clearDirectory.closest('.entity-directory-field');
          if (!wrapper) return;
          const hidden = wrapper.querySelector('input[type="hidden"]');
          const pickedEl = wrapper.querySelector('.entity-directory-picked');
          const searchEl = wrapper.querySelector('.entity-directory-search');
          if (hidden) hidden.value = '';
          if (pickedEl) pickedEl.hidden = true;
          if (searchEl) searchEl.hidden = false;
          markChanged();
          mirrorEditorToRow();
        }
      });
      // Pressing Enter in a form field can submit the form natively
      // (navigating to the current URL with every field as a query param,
      // losing the tab/editor state) - the onsubmit="return false" on the
      // <form> guards against that, but Enter should still mean "save NOW",
      // not silently do nothing. With autosave that means flushing the
      // pending debounce rather than clicking a Save button that no longer
      // exists - which is exactly what this handler kept doing after the
      // button went, so Enter was a no-op until the debounce fired anyway.
      // Handled on keydown rather than relying on the 'submit' event, which
      // isn't dispatched consistently for a form with only one text field in
      // every environment.
      form.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          flushPendingAutoSave();
        }
      });

      // Person/Group results dropdown: Up/Down moves the highlighted row,
      // Enter picks it, Escape closes without picking. The generic Enter
      // handler above still runs first and flushes autosave - harmless here,
      // since nothing has changed until a pick actually happens.
      form.addEventListener('keydown', (e) => {
        const input = e.target.closest?.('.entity-directory-input');
        if (!input) return;
        const resultsEl = input.closest('.entity-directory-field')?.querySelector('.entity-directory-results');
        if (!resultsEl) return;

        if (e.key === 'Escape') {
          resultsEl.hidden = true;
          return;
        }

        if (resultsEl.hidden) return;
        const rows = Array.from(resultsEl.querySelectorAll('.entity-directory-result'));
        if (!rows.length) return;

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const current = rows.findIndex(r => r.classList.contains('active'));
          const next = e.key === 'ArrowDown'
            ? (current + 1) % rows.length
            : (current - 1 + rows.length) % rows.length;
          rows.forEach(r => r.classList.remove('active'));
          rows[next].classList.add('active');
          rows[next].scrollIntoView({ block: 'nearest' });
          return;
        }

        if (e.key === 'Enter') {
          const active = resultsEl.querySelector('.entity-directory-result.active') || rows[0];
          let picked;
          try { picked = JSON.parse(active.dataset.value); } catch { return; }
          applyDirectoryPick(input.closest('.entity-directory-field'), picked);
        }
      });
    }
  }

  // The row for whatever the editor currently has open. Scoped to the type
  // because every typed tab's list is in the DOM at once, each with its own
  // editor - clearing across all of them would drop the indicator from a tab
  // that still has something open.
  //
  // renderEntityRow already emits `.selected` when it builds a row, which
  // covers a re-render; this covers opening and closing the editor, where
  // nothing re-renders.
  function syncRowSelection(typeSlug) {
    const group = `.entity-row[data-entity-type="${typeSlug}"]`;
    const row =
      currentEntityId != null
        ? document.querySelector(`${group}[data-entity-id="${currentEntityId}"]`)
        : null;
    app.selectRow(row, group);
  }

  // ========== PUBLIC API ==========
  return {
    init: (typeSlug, typeConfig, splitPaneInstance) => {
      splitPanesByType[typeSlug] = splitPaneInstance; // Store per-type reference

      // NEVER over the top of an open editor. Every generic tab calls this
      // while the page is setting up, so whichever initialised LAST used to own
      // `currentTypeSlug` and `typeSchema` - and the reopen-after-reload path
      // runs inside one tab's init, so on every reload the tabs after it stole
      // the slug out from under an editor that was already open. Ideas is last
      // in the tab strip, so a Projects editor restored by a refresh was left
      // believing it was an Ideas one, and four things silently addressed the
      // wrong tab:
      //
      //   - the row lookup asked for a type that row does not have, so
      //     mirrorEditorToRow() found nothing and typing a title never reached
      //     the row - the half of the two-way sync that goes editor -> row.
      //   - collectFormValues() read the WRONG type's field list off a form
      //     that does not carry those fields, so every value came back null,
      //     compared equal to the (equally wrong) baseline, and the diff sent
      //     nothing. Field edits made after a reload did not save at all.
      //   - markChanged() enabled another tab's Revert button.
      //   - save() PUT to the wrong type's endpoint.
      //
      // dailies.js already sidesteps this by registering only its pane - see
      // the comment there. Registering the pane is all that is needed here too
      // while an editor is open: populate() sets the type per call anyway.
      if (currentEntityId != null) return;
      currentTypeSlug = typeSlug;
      typeSchema = typeConfig;
    },

    // Just the pane, without claiming to be the current type. The Dailies rail
    // needs this: it is on screen at the same time as an entity tab, and
    // init()'s two other assignments would make whichever initialised last own
    // the module's state. populate() sets both per call, so the pane lookup is
    // the only part a co-resident view actually needs to register.
    registerSplitPane: (typeSlug, splitPaneInstance) => {
      splitPanesByType[typeSlug] = splitPaneInstance;
    },

    renderRow: renderEntityRow,
    renderFlatList,
    orderedColumns,
    // The Dailies rail renders its daily rows' columns from the daily type's
    // own field list now - same rules as every tab - but keeps its own row
    // structure (expand/drag/multi-select are rail machinery, not the generic
    // tree's). It needs the column list and the cell renderer, nothing else.
    visibleColumns,
    renderCellValue,
    fitColumns,
    syncEditorFromRow,
    cellChoices,
    choiceLabel,
    choiceClass,
    recallOpenEditor,
    forgetOpenEditor: (typeSlug) => rememberOpenEditor(typeSlug, null),
    readViewState,
    writeViewState,
    readSavedViews,
    saveCurrentView,
    applySavedView,
    deleteSavedView,
    renderTree: renderTree,
    buildForm: buildForm,
    collectFormValues: collectFormValues,
    markChanged: markChanged,
    trackFormChanges: trackFormChanges,

    // "What is on the form IS what is stored" - said from outside, after
    // something other than the editor has already persisted a value the form
    // shows. Renaming a row in place is the case: the editor has to show the
    // new title, but it is saved, so the next keystroke must not diff against
    // the old one and offer to revert a change that is not pending.
    resyncBaseline: () => rememberFormAsSaved(),

    // `saveTypeSlug` separates WHERE the editor renders from WHAT it saves. On a
    // mixed-type page (a template holding ideas, tickets and so on) the editor
    // lives in the page's pane, but a nested row must be written back to its own
    // type's endpoint. They are the same for every single-type page.
    populate: (entityId, entity, typeConfig, typeSlugOverride, saveTypeSlug, options) => {
      // Toggle close: if clicking same entity with no changes, close the editor.
      //
      // That is the ROW-CLICK gesture - clicking the open row again shuts it.
      // It is wrong for anything that means "show me this item", which is why
      // callers doing that pass { force: true }: without it, opening the
      // editor on the item you are already on closes it instead, and the
      // caller has to close-then-reopen to work around its own request. That
      // workaround is what made a save flicker.
      if (!options?.force && currentEntityId === entityId && entityId !== null) {
        if (hasChanges) {
          return; // Don't close if there are unsaved changes
        }
        GenericEntity.close();
        return;
      }

      // Leaving whatever was open. Autosave already covers a normal pause in
      // typing, but switching records can land inside that debounce window -
      // flush now rather than losing the last few keystrokes. Revert is
      // unaffected: it calls discardChanges() before this runs, so hasChanges
      // is already false by the time populate() gets here.
      if (hasChanges) flushPendingAutoSave();

      currentEntityId = entityId;
      hasChanges = false;
      // Remembered so a reload can put the editor back. Only the identity is
      // stored, never field values: what comes back is the SAVED record, and
      // anything unsaved was already lost with the page.
      rememberOpenEditor(typeSlugOverride || currentTypeSlug, entityId);
      currentIsFolder = !!entity.is_folder;
      currentSaveSlug = saveTypeSlug || null;
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
      // Before anything is written: whatever the last editor left in ANOTHER
      // type's pane has to go, or this one is the second #entity-editor-form in
      // the document and every lookup in this file finds the wrong one.
      clearForeignEditorPanes(typeSlugToUse);
      // Revert and Save belong on the title line, right-justified, and the
      // existing NODE is moved there rather than re-rendered: their click
      // handlers are bound once when the tab initialises, so rebuilding them
      // inside the form would produce buttons that look right and do nothing.
      //
      // DETACHED FIRST, because after the first open the bar lives inside
      // this pane - and `editorPane.innerHTML = ...` would destroy it along
      // with the old form. The second item opened then had no buttons at all.
      // Holding the reference across the rewrite is what keeps them alive.
      const actionsBar = document
        .getElementById(`${typeSlugToUse}EditorPane`)
        ?.querySelector('.editor-actions-bar');
      if (actionsBar) actionsBar.remove();

      editorPane.innerHTML = formHtml;

      const actionsSlot = editorPane.querySelector('.entity-title-actions');
      if (actionsBar && actionsSlot) actionsSlot.appendChild(actionsBar);

      // Nothing has been edited yet, so there is nothing to revert. Without
      // this the button kept whatever state it was left in - once any edit
      // enabled it, it stayed enabled for every item opened afterwards.
      const revertBtnOnOpen = document.getElementById(`${typeSlugToUse}CloseBtn`);
      if (revertBtnOnOpen) revertBtnOnOpen.disabled = true;
      trackFormChanges();
      // The baseline every later change is measured against.
      rememberFormAsSaved();
      // Use the correct SplitPane for this type
      const typeSplitPane = splitPanesByType[typeSlugToUse];
      if (typeSplitPane) {
        typeSplitPane.showRightPane();
      } else {
        console.error(`[GenericEntity] No splitPane found for type ${typeSlugToUse}`);
      }

      // An open editor takes the whole screen - every rail steps aside until
      // it closes. 'template' and 'daily' edit inside their OWN rails, so they
      // name themselves; every other type is the CONTENT pane, since only one
      // type tab is ever current. Naming 'content' for a rail would collapse
      // the rail holding the editor that had just been opened. See
      // tabs.js#focusPaneForEditor.
      const RAIL_SLUGS = ['template', 'daily'];
      window.tabManager?.focusPaneForEditor(
        RAIL_SLUGS.includes(typeSlugToUse) ? typeSlugToUse : 'content'
      );

      syncRowSelection(typeSlugToUse);
    },

    save: async () => {
      const data = collectFormValues(typeSchema, currentIsFolder);

      // Send only what the EDITOR changed. Autosave used to PUT the whole form
      // every time, and the form is a snapshot taken when the record was
      // opened - so a value changed from its ROW cell in the meantime was
      // written straight back to what the editor still believed it was. The
      // row wrote "In Progress"; the editor's next autosave, fired by an edit
      // to some other field, put "Not Started" back. Both requests returned
      // 200 and the change simply undid itself a second later.
      //
      // Only on an UPDATE, and only when there is a baseline to compare with:
      // a create has to carry the whole record.
      if (currentEntityId && savedFormSnapshot) {
        const wasFields = (JSON.parse(savedFormSnapshot).fields) || {};
        const changed = {};
        for (const [k, v] of Object.entries(data.fields || {})) {
          if (JSON.stringify(v) !== JSON.stringify(wasFields[k])) changed[k] = v;
        }
        data.fields = changed;
      }
      const slug = currentSaveSlug || currentTypeSlug;
      const url = currentEntityId
        ? `/api/entities/${slug}/${currentEntityId}`
        : `/api/entities/${slug}`;
      const method = currentEntityId ? 'PUT' : 'POST';

      const response = await app.fetchRaw(url, {
        method,
        
        body: JSON.stringify(data)
      });

      const result = await response.json();
      if (result.success) {
        hasChanges = false;
        // What is on screen IS what is stored now, so it becomes the baseline.
        rememberFormAsSaved();
        // The same record can be on screen more than once - referenced inside a
        // template while also listed on its own page. A reference IS the
        // original, so an edit here has already changed it there; tell the other
        // views so they redraw instead of showing stale text.
        document.dispatchEvent(new CustomEvent('entity-saved', {
          detail: { id: result.data?.id, slug }
        }));
        return result.data;
      } else {
        throw new Error(result.message || 'Save failed');
      }
    },

    // Cmd/Ctrl+S's fallback for a row editor - there is no Save button to
    // click there any more, so save-shortcut.js calls this instead. A no-op
    // when there is nothing pending.
    flushAutoSave: () => flushPendingAutoSave(),

    // The one place that discards rather than saves: Revert. Called before
    // close()+populate() reload the stored record, so those see hasChanges
    // already false and never flush what this just threw away.
    discardChanges: () => {
      if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; }
      hasChanges = false;
      savedFormSnapshot = null;   // the form is about to be rebuilt from store
      const revertBtn = document.getElementById(`${currentTypeSlug}CloseBtn`);
      if (revertBtn) revertBtn.disabled = true;
    },

    // After a successful save there is nothing left to save and nothing to
    // discard, so Revert is disabled until the next edit re-arms it via
    // markChanged().
    markSaved: () => {
      // An edit made since the save started must survive it. Ordering alone
      // fixes the known caller, but any late or duplicated call could still
      // disable a button the user has just re-armed by typing - so the state
      // itself decides, not the timing.
      if (hasChanges) return;
      hasChanges = false;
      const revertBtn = document.getElementById(`${currentTypeSlug}CloseBtn`);
      if (revertBtn) revertBtn.disabled = true;
      for (const row of rowEls(currentEntityId)) {
        row.classList.remove('entity-row-unsaved');
        row.removeAttribute('title');
      }
    },

    close: () => {
      // Same reasoning as the switch-record flush in populate(): closing
      // without saving would otherwise lose anything still inside the
      // debounce window. Revert avoids this by calling discardChanges()
      // first, which leaves hasChanges false by the time close() runs.
      if (hasChanges) flushPendingAutoSave();

      // Any unsaved preview written into a row by mirrorEditorToRow() is
      // discarded here: the tab listens for this and re-renders from the
      // persisted entities.
      document.dispatchEvent(new CustomEvent('entity-editor-closed', {
        detail: { typeSlug: currentTypeSlug }
      }));
      currentEntityId = null;
      currentIsFolder = false;
      rememberOpenEditor(currentTypeSlug, null);   // closed on purpose - stay closed
      // Clear the editor content
      // Revert and Save live INSIDE the form now (populate moves them onto the
      // title line), so emptying this pane would destroy them - and they are
      // never rebuilt, because their click handlers are bound once at init and
      // populate only ever MOVES the existing node. The next editor to open
      // then had no buttons at all.
      //
      // Every close-then-populate path hit it: the context menu's "New ...
      // inside" and "Edit", and Revert itself. "+ Folder" did not, which is
      // why it looked fine by hand. clearEditorPane() sends the bar home
      // first; populate finds it there and moves it back onto the next title
      // line.
      clearEditorPane(currentTypeSlug);
      // A stale form in some OTHER pane is just as invisible and just as able
      // to answer getElementById('entity-editor-form') next time. Closing is
      // the moment to be sure none is left.
      clearForeignEditorPanes(null);
      // Bring back whatever rails stepped aside when this editor opened.
      window.tabManager?.restorePanesAfterEditor();
      syncRowSelection(currentTypeSlug);
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
