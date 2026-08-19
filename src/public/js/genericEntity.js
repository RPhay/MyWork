/**
 * Generic Entity Engine - Unified renderer for all entity types
 * Handles: rows, trees, editors, and field rendering for any entity type
 */

const GenericEntity = (() => {
  let currentTypeSlug, typeSchema, splitPane, currentEntityId, hasChanges, currentIsFolder = false, currentSaveSlug = null, allEntities = [];
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
        <textarea name="${field.field_key}" class="form-control" rows="6" data-field-type="textarea">${value || ''}</textarea>
      </div>
    `,
    number: (field, value = '') => `
      <div class="form-group">
        <label>${field.label}</label>
        <input type="number" name="${field.field_key}" value="${value || ''}" class="form-control" data-field-type="number">
      </div>
    `,
    emojis: (field, value = '') => {
      const set = field.field_options?.values || [];
      const current = value || set[0] || '';
      return `
      <div class="form-group">
        <label>${field.label}</label>
        <select name="${field.field_key}" class="form-select" data-field-type="emojis">
          ${set.map(e => `<option value="${escapeAttr(e)}" ${e === current ? 'selected' : ''}>${e}</option>`).join('')}
        </select>
      </div>
    `;
    },
    emoji: (field, value = '') => `
      <div class="form-group">
        <label>${field.label}</label>
        <div>
          <button type="button" class="btn btn-outline-secondary emoji-field-btn" data-action="pick-emoji-field"
                  data-field-key="${escapeAttr(field.field_key)}" title="Click to choose an emoji">${value || resolveFieldDefault(field) || '＋'}</button>
          <input type="hidden" name="${field.field_key}" value="${escapeAttr(value || '')}">
        </div>
      </div>
    `,
    date: (field, value = '') => `
      <div class="form-group">
        <label>${field.label}</label>
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
        <label>${field.label}</label>
        <select name="${field.field_key}" class="form-select" data-field-type="select">
          <option value="">-- Select --</option>
          ${choices.map(c =>
            `<option value="${c}" ${String(c) === current ? 'selected' : ''}>${c}</option>`
          ).join('')}
        </select>
      </div>
    `;
    },
    // A control behaves the same wherever it appears. In a row you click the
    // status badge to move it on; in the editor you click the same badge, not a
    // dropdown that happens to hold the same values. The hidden input is what
    // the form collects, so nothing downstream needs to know.
    status: (field, value = '') => {
      const statuses = field.field_options?.values || ['incomplete', 'in_progress', 'complete'];
      const current = statuses.includes(value) ? value : statuses[0];
      const role = statusRole(field, current);
      return `
        <div class="form-group" data-field-type="status" data-cycle-values="${escapeAttr(JSON.stringify(statuses))}">
          <label>${field.label}</label>
          <div>
            <span class="badge bg-${STATUS_BADGE_VARIANT[role]} status-badge editor-cycle"
                  data-cycle="status" role="button" tabindex="0"
                  title="Click to change">${escapeHtml(current)}</span>
          </div>
          <input type="hidden" name="${field.field_key}" value="${escapeAttr(current)}">
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
          <label>${field.label}</label>
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
        <label>${field.label}</label>
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
  const STATUS_BADGE_VARIANT = {
    todo: 'secondary',
    active: 'warning',
    done: 'success',
    failed: 'danger',
    ignored: 'light',
  };

  function renderStatusToggle(entity, field, rawValue, derived = false) {
    const values = field.field_options?.values || [];
    if (values.length === 0) return '';

    // A folder has no status of its own - it shows what its children roll up
    // to. That badge must NOT be clickable: cycling it would try to store a
    // value on a row that deliberately has none.
    if (derived) {
      if (!rawValue) return '';
      const role = statusRole(field, rawValue);
      return `<span class="badge bg-${STATUS_BADGE_VARIANT[role]} row-field status-badge is-rollup"
              title="Rolled up from the items inside">${escapeHtml(rawValue)}</span>`;
    }

    // An unset status still gets a badge - otherwise a row could never be given
    // one by clicking, which is the whole point of the control.
    const current = rawValue || values[0];
    const role = statusRole(field, current);
    return `<span class="badge bg-${STATUS_BADGE_VARIANT[role]} row-field status-badge"
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
      .filter(f => f.show_in_row)
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

  function gridTemplate(typeSchema) {
    const tracks = orderedColumns(typeSchema).map(c => {
      // A floor, not zero: with many columns in a narrow pane the title track
      // collapsed to nothing and the row's name disappeared - which is exactly
      // what the earlier `minmax(0, 1fr)` did before, and it came back when the
      // Dailies rail took half the width.
      if (c.isTitle) return `minmax(${TITLE_MIN_PX}px, ${TITLE_SHARE}fr)`;
      const type = c.field?.field_type;

      // Measured from the real control, so it fits the longest value exactly.
      if (type === 'status' || type === 'select' || type === 'radio') {
        const px = choiceColumnPx(c.field);
        if (px) return `${px}px`;
      }

      const fixed = FIXED_COLUMN_PX[type];
      if (fixed) return `${fixed}px`;

      return 'minmax(0, 1fr)';
    });
    return `${tracks.join(' ')} ${ACTIONS_PX}px`;
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

    // A checkbox reads as a box, ticked or not, and toggles on click.
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
      // A rolled-up date is still a date: format it like every other date cell
      // rather than showing the raw ISO timestamp the driver returned.
      const shown = f.field_type === 'date' ? formatDateCell(value) : value;
      return `<span class="row-field is-rollup" title="Rolled up from the items inside">${escapeHtml(shown)}</span>`;
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
            <span class="entity-title">${entity.title}</span>${app.childCountBadge(childCount)}
          </div>`;
      }
      const f = c.field;
      const derived = isFolder && !!f.rollup;
      const value = derived
        ? rollups?.get(entity.id)?.[f.field_key]
        : (isFolder ? null : entity.fields?.[f.field_key]);
      const inner = (isFolder && !f.rollup) ? '' : renderCellValue(entity, f, value, derived);
      return `<div class="entity-cell" data-col="${escapeAttr(f.field_key)}">${inner}</div>`;
    }).join('');

    return `
      <div class="entity-row ${isExpanded ? 'expanded' : ''} ${isFolder ? 'entity-row-folder' : ''} ${isSelected ? 'selected' : ''}" data-entity-id="${entity.id}" data-entity-type="${typeSchema.slug}" data-is-folder="${isFolder ? '1' : '0'}" data-depth="${depth}" draggable="true">
        <div class="entity-row-content">
          ${cells}
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
    const cols = visibleColumns(typeSchema);
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

  function rowEl(entityId) {
    return document.querySelector(
      `.entity-row[data-entity-type="${currentTypeSlug}"][data-entity-id="${entityId}"]`
    );
  }

  // Editor -> row.
  function mirrorEditorToRow() {
    if (currentEntityId == null) return;
    const row = rowEl(currentEntityId);
    const form = document.getElementById('entity-editor-form');
    if (!row || !form) return;

    // The preview is unsaved state, so the row says so. Without this the list
    // shows an edited value indistinguishable from a persisted one, and closing
    // the editor would silently revert it.
    row.classList.add('entity-row-unsaved');
    row.title = 'Unsaved changes - save the editor to keep them';

    const titleEl = row.querySelector('.entity-title');
    const titleInput = form.querySelector('[name="title"]');
    if (titleEl && titleInput) titleEl.textContent = titleInput.value;

    if (currentIsFolder) return;   // a folder's cells are roll-ups, not its own

    const entity = allEntities.find(e => String(e.id) === String(currentEntityId));
    const values = collectFormValues(typeSchema, false).fields;

    for (const f of visibleColumns(typeSchema)) {
      const cell = row.querySelector(`.entity-cell[data-col="${CSS.escape(f.field_key)}"]`);
      if (!cell) continue;
      cell.innerHTML = renderCellValue(entity || { id: currentEntityId }, f, values[f.field_key], false);
    }
  }

  // Row -> editor. Called after a row-side change has been persisted, so the
  // editor is updated without being marked dirty - the value is already saved.
  function syncEditorFromRow(entityId, fieldKey, value) {
    if (currentEntityId == null || String(currentEntityId) !== String(entityId)) return;
    const form = document.getElementById('entity-editor-form');
    const control = form?.querySelector(`[name="${CSS.escape(fieldKey)}"]`);
    if (!control) return;
    if (control.type === 'checkbox') control.checked = !!value;
    else control.value = value ?? '';
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
        ${fields.length ? `
          <div class="editor-field-legend">
            <div class="editor-field-gutter">
              <span class="editor-field-handle" aria-hidden="true">⋮⋮</span>
              <div class="form-check form-switch editor-field-toggle editor-toggle-icon" title="Show this field as a column">
                <i class="bi bi-layout-three-columns"></i>
              </div>
              <div class="form-check form-switch editor-field-toggle editor-toggle-icon" title="Show this column's name in the header">
                <i class="bi bi-tag"></i>
              </div>
            </div>
          </div>` : ''}
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
              <div class="editor-field-gutter">
                <span class="editor-field-handle" title="Drag to reorder">⋮⋮</span>
                <div class="form-check form-switch editor-field-toggle" title="Show this field as a column">
                  <input type="checkbox" class="form-check-input editor-field-col" ${field.show_in_row ? 'checked' : ''}>
                </div>
                <div class="form-check form-switch editor-field-toggle" title="Show this column's name in the header">
                  <input type="checkbox" class="form-check-input editor-field-label" ${field.show_column_label !== 0 && field.show_column_label !== false ? 'checked' : ''}>
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
    // Revert is enabled alongside Save the moment anything changes.
    const revertBtn = document.getElementById(`${currentTypeSlug}CloseBtn`);
    if (revertBtn) revertBtn.disabled = false;
  }

  // One handler for every editor control that cycles. The field group carries
  // its own ladder in data-cycle-values, so status and priority - and anything
  // added later - share this without it knowing what they mean.
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
      if (control.dataset.cycle === 'priority') {
        const style = PRIORITY_STYLE[next] || PRIORITY_STYLE[''];
        control.innerHTML = `${priorityGlyph(next)}<span class="editor-cycle-label">${escapeHtml(style.label)}</span>`;
        control.title = `${style.label} - click to change`;
      } else {
        const fieldKey = group.querySelector('input[type="hidden"]')?.name;
        const field = (typeSchema.fields || []).find(f => f.field_key === fieldKey) || { field_options: { values } };
        const role = statusRole(field, next);
        control.className = `badge bg-${STATUS_BADGE_VARIANT[role]} status-badge editor-cycle`;
        control.textContent = next;
      }

      markChanged();
    });
  }

  function trackFormChanges() {
    const form = document.getElementById('entity-editor-form');
    if (form) {
      wireEditorCycles();
      form.addEventListener('input', markChanged);
      form.addEventListener('change', markChanged);

      // Editing a field updates that row's cell straight away, so the list and
      // the editor never disagree about what is on screen. This is a PREVIEW of
      // unsaved state: closing or cancelling the editor re-renders the list
      // from persisted data, which discards it.
      const mirror = () => mirrorEditorToRow();
      form.addEventListener('input', mirror);
      form.addEventListener('change', mirror);

      // Add/remove rows for `links` fields. Delegated, so it covers every
      // links field on the form without per-field wiring.
      form.addEventListener('click', async (e) => {
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
      currentTypeSlug = typeSlug;
      typeSchema = typeConfig;
      splitPane = splitPaneInstance;
      splitPanesByType[typeSlug] = splitPaneInstance; // Store per-type reference
    },

    renderRow: renderEntityRow,
    renderFlatList,
    orderedColumns,
    syncEditorFromRow,
    readViewState,
    writeViewState,
    renderTree: renderTree,
    buildForm: buildForm,
    collectFormValues: collectFormValues,
    markChanged: markChanged,
    trackFormChanges: trackFormChanges,

    // `saveTypeSlug` separates WHERE the editor renders from WHAT it saves. On a
    // mixed-type page (a template holding ideas, tickets and so on) the editor
    // lives in the page's pane, but a nested row must be written back to its own
    // type's endpoint. They are the same for every single-type page.
    populate: (entityId, entity, typeConfig, typeSlugOverride, saveTypeSlug) => {
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
      editorPane.innerHTML = formHtml;
      // Track the save button for this type
      currentSaveBtn = document.getElementById(`${typeSlugToUse}SaveBtn`);
      // Nothing has been edited yet, so there is nothing to save. Without this
      // the button kept whatever state it was left in - once any edit enabled
      // it, it stayed enabled for every item opened afterwards.
      if (currentSaveBtn) currentSaveBtn.disabled = true;
      // Revert is disabled until there is something to revert - the same rule
      // Save follows.
      const revertBtnOnOpen = document.getElementById(`${typeSlugToUse}CloseBtn`);
      if (revertBtnOnOpen) revertBtnOnOpen.disabled = true;
      trackFormChanges();
      // Use the correct SplitPane for this type
      const typeSplitPane = splitPanesByType[typeSlugToUse];
      if (typeSplitPane) {
        typeSplitPane.showRightPane();
      } else {
        console.error(`[GenericEntity] No splitPane found for type ${typeSlugToUse}`);
      }

      syncRowSelection(typeSlugToUse);
    },

    save: async () => {
      const data = collectFormValues(typeSchema, currentIsFolder);
      const slug = currentSaveSlug || currentTypeSlug;
      const url = currentEntityId
        ? `/api/entities/${slug}/${currentEntityId}`
        : `/api/entities/${slug}`;
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

    // After a successful save there is nothing to save and nothing to discard,
    // so both buttons are disabled until the next edit. markChanged() re-enables
    // them together.
    markSaved: () => {
      hasChanges = false;
      if (currentSaveBtn) currentSaveBtn.disabled = true;
      const revertBtn = document.getElementById(`${currentTypeSlug}CloseBtn`);
      if (revertBtn) revertBtn.disabled = true;
      const row = rowEl(currentEntityId);
      if (row) {
        row.classList.remove('entity-row-unsaved');
        row.removeAttribute('title');
      }
    },

    close: () => {
      // Any unsaved preview written into a row by mirrorEditorToRow() is
      // discarded here: the tab listens for this and re-renders from the
      // persisted entities.
      document.dispatchEvent(new CustomEvent('entity-editor-closed', {
        detail: { typeSlug: currentTypeSlug }
      }));
      currentEntityId = null;
      currentIsFolder = false;
      // Clear the editor content
      const editorPaneId = `${currentTypeSlug}-editor-pane`;
      const editorPane = document.getElementById(editorPaneId);
      if (editorPane) editorPane.innerHTML = '';
      // Hide the pane
      const typeSplitPane = splitPanesByType[currentTypeSlug];
      if (typeSplitPane) typeSplitPane.hideRightPane();
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
