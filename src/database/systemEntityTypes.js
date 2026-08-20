/**
 * The system entity types, their fields, and their type-to-type relationship
 * rules - the single definition every seeding path uses.
 *
 * There used to be five hand-maintained copies of this data, in
 * `scripts/phase0-seed-entity-types.js`, `mysqlSchema.js` (twice - types and
 * fields), `mssqlSchema.js` and `schemaMigrationService.js`. They disagreed
 * with each other on `supports_hierarchy` for goal/task/ticket/template, on the
 * Categories and Tasks icons, and on the Dailies and Brainstorming labels, so
 * which values a database ended up with depended on which path had created it.
 *
 * That is how goal/task/ticket kept reverting to flat lists after a schema run:
 * `npm run db:init` calls only `createMysqlSchema`, never phase 0, so the
 * schema file's pre-convergence values are what a fresh install actually got,
 * and the one-off repair script had to be re-run to undo them.
 *
 * Add a type, rename one, change an icon or a flag HERE and every path follows.
 *
 * Keep in sync with SYSTEM_TYPE_DEFAULTS in entityTypeService.js, which is what
 * "revert to defaults" restores - it derives from this file for that reason.
 *
 * No type may use a folder-like icon (📁/📂). Every hierarchical type can hold
 * folders (is_folder rows rendered with 📁), so a folder-ish type icon makes
 * items and the folders containing them indistinguishable on the page.
 *
 * Field order in each `fields` array IS `display_order`; seeders use the array
 * index rather than carrying a separate number that can disagree with it.
 */

// `doneValues` and `failedValues` name the terminal states explicitly, so the
// row badge picks its colour from the type definition rather than by matching
// on the literal text - a type with any vocabulary still gets sensible states.
const DONE_STATUS = {
  values: ['Not Started', 'In Progress', 'Complete', 'Failed', 'Ignored'],
  doneValues: ['Complete'],
  failedValues: ['Failed'],
  // Ignored items are skipped entirely when a folder rolls its children up, so
  // a parked item cannot drag a folder's status backwards.
  ignoredValues: ['Ignored'],
};

export const SYSTEM_ENTITY_TYPES = [
  {
    slug: 'work_item',
    label: 'Dailies',
    label_singular: 'Work Item',
    icon: '⭐',
    supports_hierarchy: true,
    is_system: true,
    primary_date_field: 'date',
    fields: [
      // Every editable type carries one, so a row can be ranked wherever it
      // lives. Rendered as a click-to-cycle icon in the row, an ordered choice
      // in the editor.
      { field_key: 'priority', label: 'Priority', field_type: 'priority', required: false, show_in_row: true },
      // Which column of the priorities board this row sits in, if any. The
      // placement is board-local and deliberately NOT the record's status:
      // the types do not share a status vocabulary (Ideas run Raw/Developing/
      // Ready, Categories have no status at all), so a bay cannot be one. A
      // row is on the board exactly when this has a value.
      { field_key: 'board_bay', label: 'Priorities board column', field_type: 'text', required: false, show_in_row: false },
      { field_key: 'board_order', label: 'Priorities board position', field_type: 'number', required: false, show_in_row: false },
      // The focus bar - the two or three things being worked on right now.
      // Engine-written, never rendered as a control (see INTERNAL_FIELD_KEYS).
      { field_key: 'focus_slot', label: 'Focus bar slot', field_type: 'number', required: false, show_in_row: false },
      // Worked time. The focus bar's clock adds to it, and it is also a plain
      // editable property - time worked away from the app still counts, so it
      // has to be correctable by hand. Every type carries one, and the type
      // editor will not let it be removed.
      { field_key: 'focus_seconds', label: 'Worked Time', field_type: 'duration', required: false, show_in_row: false },
      // How long this is meant to take, as against how long it HAS taken
      // (Worked Time above). A fixed ladder rather than free text so the two
      // can be compared and summed. Off as a column by default - turn it on per
      // type from the column chooser.
      { field_key: 'time_box', label: 'Time Box', field_type: 'select', required: false, show_in_row: false, field_options: { choices: ['15m', '30m', '45m', '1h', '1.5h', '2h'] } },
      { field_key: 'focus_started_at', label: 'Focus clock started (epoch ms)', field_type: 'number', required: false, show_in_row: false },
      { field_key: 'date', label: 'Date', field_type: 'date', required: true, show_in_row: true },
      { field_key: 'description', label: 'Description', field_type: 'textarea', required: false, show_in_row: false },
      { field_key: 'emoji', label: 'Emoji', field_type: 'text', required: false, show_in_row: true },
      { field_key: 'status', label: 'Status', field_type: 'status', field_options: DONE_STATUS, required: false, show_in_row: true, is_completion_signal: true, rollup: 'status' },
      { field_key: 'time_box_minutes', label: 'Time Box (minutes)', field_type: 'number', required: false, show_in_row: false, rollup: 'sum' },
      { field_key: 'start_time', label: 'Start Time', field_type: 'text', required: false, show_in_row: false },
      { field_key: 'notes', label: 'Notes', field_type: 'textarea', required: false, show_in_row: false },
    ],
  },
  {
    slug: 'priority',
    label: 'Projects',
    label_singular: 'Priority',
    icon: '📍',
    supports_hierarchy: true,
    is_system: true,
    primary_date_field: null,
    fields: [
      // Every editable type carries one, so a row can be ranked wherever it
      // lives. Rendered as a click-to-cycle icon in the row, an ordered choice
      // in the editor.
      { field_key: 'priority', label: 'Priority', field_type: 'priority', required: false, show_in_row: true },
      // Membership of the priorities board. Not a column: it is why the row
      // is on the board at all, not something to show beside its title.
      { field_key: 'board_bay', label: 'Priorities board column', field_type: 'text', required: false, show_in_row: false },
      { field_key: 'board_order', label: 'Priorities board position', field_type: 'number', required: false, show_in_row: false },
      // The focus bar - the two or three things being worked on right now.
      // Engine-written, never rendered as a control (see INTERNAL_FIELD_KEYS).
      { field_key: 'focus_slot', label: 'Focus bar slot', field_type: 'number', required: false, show_in_row: false },
      // Worked time. The focus bar's clock adds to it, and it is also a plain
      // editable property - time worked away from the app still counts, so it
      // has to be correctable by hand. Every type carries one, and the type
      // editor will not let it be removed.
      { field_key: 'focus_seconds', label: 'Worked Time', field_type: 'duration', required: false, show_in_row: false },
      // How long this is meant to take, as against how long it HAS taken
      // (Worked Time above). A fixed ladder rather than free text so the two
      // can be compared and summed. Off as a column by default - turn it on per
      // type from the column chooser.
      { field_key: 'time_box', label: 'Time Box', field_type: 'select', required: false, show_in_row: false, field_options: { choices: ['15m', '30m', '45m', '1h', '1.5h', '2h'] } },
      { field_key: 'focus_started_at', label: 'Focus clock started (epoch ms)', field_type: 'number', required: false, show_in_row: false },
      { field_key: 'status', label: 'Status', field_type: 'status', field_options: DONE_STATUS, required: false, show_in_row: true, rollup: 'status' },
      // Projects carry links as a generic `links` field rather than through a
      // priority_links table - that is the whole point of the field type.
      { field_key: 'links', label: 'Links', field_type: 'links', required: false, show_in_row: true },
      { field_key: 'notes', label: 'Notes', field_type: 'textarea', required: false, show_in_row: false },
    ],
  },
  {
    slug: 'area',
    label: 'Categories',
    label_singular: 'Area',
    icon: '🏷️',
    supports_hierarchy: true,
    is_system: true,
    primary_date_field: null,
    fields: [
      // Every editable type carries one, so a row can be ranked wherever it
      // lives. Rendered as a click-to-cycle icon in the row, an ordered choice
      // in the editor.
      { field_key: 'priority', label: 'Priority', field_type: 'priority', required: false, show_in_row: true },
      // Membership of the priorities board. Not a column: it is why the row
      // is on the board at all, not something to show beside its title.
      { field_key: 'board_bay', label: 'Priorities board column', field_type: 'text', required: false, show_in_row: false },
      { field_key: 'board_order', label: 'Priorities board position', field_type: 'number', required: false, show_in_row: false },
      // The focus bar - the two or three things being worked on right now.
      // Engine-written, never rendered as a control (see INTERNAL_FIELD_KEYS).
      { field_key: 'focus_slot', label: 'Focus bar slot', field_type: 'number', required: false, show_in_row: false },
      // Worked time. The focus bar's clock adds to it, and it is also a plain
      // editable property - time worked away from the app still counts, so it
      // has to be correctable by hand. Every type carries one, and the type
      // editor will not let it be removed.
      { field_key: 'focus_seconds', label: 'Worked Time', field_type: 'duration', required: false, show_in_row: false },
      // How long this is meant to take, as against how long it HAS taken
      // (Worked Time above). A fixed ladder rather than free text so the two
      // can be compared and summed. Off as a column by default - turn it on per
      // type from the column chooser.
      { field_key: 'time_box', label: 'Time Box', field_type: 'select', required: false, show_in_row: false, field_options: { choices: ['15m', '30m', '45m', '1h', '1.5h', '2h'] } },
      { field_key: 'focus_started_at', label: 'Focus clock started (epoch ms)', field_type: 'number', required: false, show_in_row: false },
      { field_key: 'description', label: 'Description', field_type: 'textarea', required: false, show_in_row: false },
      { field_key: 'notes', label: 'Notes', field_type: 'textarea', required: false, show_in_row: false },
    ],
  },
  {
    slug: 'goal',
    label: 'Goals',
    label_singular: 'Goal',
    icon: '🎯',
    supports_hierarchy: true,
    is_system: true,
    primary_date_field: null,
    fields: [
      // Every editable type carries one, so a row can be ranked wherever it
      // lives. Rendered as a click-to-cycle icon in the row, an ordered choice
      // in the editor.
      { field_key: 'priority', label: 'Priority', field_type: 'priority', required: false, show_in_row: true },
      // Membership of the priorities board. Not a column: it is why the row
      // is on the board at all, not something to show beside its title.
      { field_key: 'board_bay', label: 'Priorities board column', field_type: 'text', required: false, show_in_row: false },
      { field_key: 'board_order', label: 'Priorities board position', field_type: 'number', required: false, show_in_row: false },
      // The focus bar - the two or three things being worked on right now.
      // Engine-written, never rendered as a control (see INTERNAL_FIELD_KEYS).
      { field_key: 'focus_slot', label: 'Focus bar slot', field_type: 'number', required: false, show_in_row: false },
      // Worked time. The focus bar's clock adds to it, and it is also a plain
      // editable property - time worked away from the app still counts, so it
      // has to be correctable by hand. Every type carries one, and the type
      // editor will not let it be removed.
      { field_key: 'focus_seconds', label: 'Worked Time', field_type: 'duration', required: false, show_in_row: false },
      // How long this is meant to take, as against how long it HAS taken
      // (Worked Time above). A fixed ladder rather than free text so the two
      // can be compared and summed. Off as a column by default - turn it on per
      // type from the column chooser.
      { field_key: 'time_box', label: 'Time Box', field_type: 'select', required: false, show_in_row: false, field_options: { choices: ['15m', '30m', '45m', '1h', '1.5h', '2h'] } },
      { field_key: 'focus_started_at', label: 'Focus clock started (epoch ms)', field_type: 'number', required: false, show_in_row: false },
      // A plain number input gave a spinner, which is wrong for a year: it
      // implies arithmetic and offers 1 and 999999. A declared list makes it a
      // picker, and 'currentYear' resolves when the form renders rather than
      // baking this year into the schema.
      { field_key: 'year', label: 'Year', field_type: 'select', field_options: { values: ['2026', '2027', '2028', '2029', '2030'], default: 'currentYear' }, required: false, show_in_row: true },
      { field_key: 'status', label: 'Status', field_type: 'status', field_options: DONE_STATUS, required: false, show_in_row: true, rollup: 'status' },
      { field_key: 'description', label: 'Description', field_type: 'textarea', required: false, show_in_row: false },
      { field_key: 'due_date', label: 'Due Date', field_type: 'date', required: false, show_in_row: true, rollup: 'min' },
      { field_key: 'measurements', label: 'Measurements', field_type: 'textarea', required: false, show_in_row: false },
      { field_key: 'goal_updates', label: 'Goal Updates', field_type: 'textarea', required: false, show_in_row: false },
      { field_key: 'notes', label: 'Notes', field_type: 'textarea', required: false, show_in_row: false },
    ],
  },
  {
    slug: 'to_do',
    label: 'Todos',
    label_singular: 'Todo',
    icon: '✅',
    supports_hierarchy: true,
    is_system: true,
    primary_date_field: null,
    fields: [
      // Every editable type carries one, so a row can be ranked wherever it
      // lives. Rendered as a click-to-cycle icon in the row, an ordered choice
      // in the editor.
      { field_key: 'priority', label: 'Priority', field_type: 'priority', required: false, show_in_row: true },
      // Membership of the priorities board. Not a column: it is why the row
      // is on the board at all, not something to show beside its title.
      { field_key: 'board_bay', label: 'Priorities board column', field_type: 'text', required: false, show_in_row: false },
      { field_key: 'board_order', label: 'Priorities board position', field_type: 'number', required: false, show_in_row: false },
      // The focus bar - the two or three things being worked on right now.
      // Engine-written, never rendered as a control (see INTERNAL_FIELD_KEYS).
      { field_key: 'focus_slot', label: 'Focus bar slot', field_type: 'number', required: false, show_in_row: false },
      // Worked time. The focus bar's clock adds to it, and it is also a plain
      // editable property - time worked away from the app still counts, so it
      // has to be correctable by hand. Every type carries one, and the type
      // editor will not let it be removed.
      { field_key: 'focus_seconds', label: 'Worked Time', field_type: 'duration', required: false, show_in_row: false },
      // How long this is meant to take, as against how long it HAS taken
      // (Worked Time above). A fixed ladder rather than free text so the two
      // can be compared and summed. Off as a column by default - turn it on per
      // type from the column chooser.
      { field_key: 'time_box', label: 'Time Box', field_type: 'select', required: false, show_in_row: false, field_options: { choices: ['15m', '30m', '45m', '1h', '1.5h', '2h'] } },
      { field_key: 'focus_started_at', label: 'Focus clock started (epoch ms)', field_type: 'number', required: false, show_in_row: false },
      { field_key: 'status', label: 'Status', field_type: 'status', field_options: DONE_STATUS, required: false, show_in_row: true, is_completion_signal: true, rollup: 'status' },
      { field_key: 'target_date', label: 'Target Date', field_type: 'date', required: false, show_in_row: true, rollup: 'min' },
      // Not a number: "importance 7" means nothing to a reader, and a spinner
      // invites arithmetic on a value that is really a grade. The four levels
      // match app.importanceIcon/importanceColor, which already existed.
      { field_key: 'importance', label: 'Importance', field_type: 'select', field_options: { values: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' }, required: false, show_in_row: true },
      { field_key: 'notes', label: 'Notes', field_type: 'textarea', required: false, show_in_row: false },
    ],
  },
  {
    slug: 'task',
    label: 'Tasks',
    label_singular: 'Task',
    icon: '📝',
    supports_hierarchy: true,
    is_system: true,
    primary_date_field: null,
    fields: [
      // Every editable type carries one, so a row can be ranked wherever it
      // lives. Rendered as a click-to-cycle icon in the row, an ordered choice
      // in the editor.
      { field_key: 'priority', label: 'Priority', field_type: 'priority', required: false, show_in_row: true },
      // Membership of the priorities board. Not a column: it is why the row
      // is on the board at all, not something to show beside its title.
      { field_key: 'board_bay', label: 'Priorities board column', field_type: 'text', required: false, show_in_row: false },
      { field_key: 'board_order', label: 'Priorities board position', field_type: 'number', required: false, show_in_row: false },
      // The focus bar - the two or three things being worked on right now.
      // Engine-written, never rendered as a control (see INTERNAL_FIELD_KEYS).
      { field_key: 'focus_slot', label: 'Focus bar slot', field_type: 'number', required: false, show_in_row: false },
      // Worked time. The focus bar's clock adds to it, and it is also a plain
      // editable property - time worked away from the app still counts, so it
      // has to be correctable by hand. Every type carries one, and the type
      // editor will not let it be removed.
      { field_key: 'focus_seconds', label: 'Worked Time', field_type: 'duration', required: false, show_in_row: false },
      // How long this is meant to take, as against how long it HAS taken
      // (Worked Time above). A fixed ladder rather than free text so the two
      // can be compared and summed. Off as a column by default - turn it on per
      // type from the column chooser.
      { field_key: 'time_box', label: 'Time Box', field_type: 'select', required: false, show_in_row: false, field_options: { choices: ['15m', '30m', '45m', '1h', '1.5h', '2h'] } },
      { field_key: 'focus_started_at', label: 'Focus clock started (epoch ms)', field_type: 'number', required: false, show_in_row: false },
      { field_key: 'status', label: 'Status', field_type: 'status', field_options: DONE_STATUS, required: false, show_in_row: true, is_completion_signal: true, rollup: 'status' },
      { field_key: 'notes', label: 'Notes', field_type: 'textarea', required: false, show_in_row: false },
    ],
  },
  {
    slug: 'ticket',
    label: 'Tickets',
    label_singular: 'Ticket',
    icon: '🎟️',
    supports_hierarchy: true,
    is_system: true,
    primary_date_field: null,
    fields: [
      // Every editable type carries one, so a row can be ranked wherever it
      // lives. Rendered as a click-to-cycle icon in the row, an ordered choice
      // in the editor.
      { field_key: 'priority', label: 'Priority', field_type: 'priority', required: false, show_in_row: true },
      // Membership of the priorities board. Not a column: it is why the row
      // is on the board at all, not something to show beside its title.
      { field_key: 'board_bay', label: 'Priorities board column', field_type: 'text', required: false, show_in_row: false },
      { field_key: 'board_order', label: 'Priorities board position', field_type: 'number', required: false, show_in_row: false },
      // The focus bar - the two or three things being worked on right now.
      // Engine-written, never rendered as a control (see INTERNAL_FIELD_KEYS).
      { field_key: 'focus_slot', label: 'Focus bar slot', field_type: 'number', required: false, show_in_row: false },
      // Worked time. The focus bar's clock adds to it, and it is also a plain
      // editable property - time worked away from the app still counts, so it
      // has to be correctable by hand. Every type carries one, and the type
      // editor will not let it be removed.
      { field_key: 'focus_seconds', label: 'Worked Time', field_type: 'duration', required: false, show_in_row: false },
      // How long this is meant to take, as against how long it HAS taken
      // (Worked Time above). A fixed ladder rather than free text so the two
      // can be compared and summed. Off as a column by default - turn it on per
      // type from the column chooser.
      { field_key: 'time_box', label: 'Time Box', field_type: 'select', required: false, show_in_row: false, field_options: { choices: ['15m', '30m', '45m', '1h', '1.5h', '2h'] } },
      { field_key: 'focus_started_at', label: 'Focus clock started (epoch ms)', field_type: 'number', required: false, show_in_row: false },
      { field_key: 'status', label: 'Status', field_type: 'status', field_options: DONE_STATUS, required: false, show_in_row: true, rollup: 'status' },
      { field_key: 'ticket_type', label: 'Ticket Type', field_type: 'text', required: false, show_in_row: true },
      { field_key: 'notes', label: 'Notes', field_type: 'textarea', required: false, show_in_row: false },
    ],
  },
  {
    slug: 'idea',
    label: 'Brainstorming',
    label_singular: 'Idea',
    icon: '💡',
    supports_hierarchy: true,
    is_system: true,
    primary_date_field: null,
    fields: [
      // Every editable type carries one, so a row can be ranked wherever it
      // lives. Rendered as a click-to-cycle icon in the row, an ordered choice
      // in the editor.
      { field_key: 'priority', label: 'Priority', field_type: 'priority', required: false, show_in_row: true },
      // Membership of the priorities board. Not a column: it is why the row
      // is on the board at all, not something to show beside its title.
      { field_key: 'board_bay', label: 'Priorities board column', field_type: 'text', required: false, show_in_row: false },
      { field_key: 'board_order', label: 'Priorities board position', field_type: 'number', required: false, show_in_row: false },
      // The focus bar - the two or three things being worked on right now.
      // Engine-written, never rendered as a control (see INTERNAL_FIELD_KEYS).
      { field_key: 'focus_slot', label: 'Focus bar slot', field_type: 'number', required: false, show_in_row: false },
      // Worked time. The focus bar's clock adds to it, and it is also a plain
      // editable property - time worked away from the app still counts, so it
      // has to be correctable by hand. Every type carries one, and the type
      // editor will not let it be removed.
      { field_key: 'focus_seconds', label: 'Worked Time', field_type: 'duration', required: false, show_in_row: false },
      // How long this is meant to take, as against how long it HAS taken
      // (Worked Time above). A fixed ladder rather than free text so the two
      // can be compared and summed. Off as a column by default - turn it on per
      // type from the column chooser.
      { field_key: 'time_box', label: 'Time Box', field_type: 'select', required: false, show_in_row: false, field_options: { choices: ['15m', '30m', '45m', '1h', '1.5h', '2h'] } },
      { field_key: 'focus_started_at', label: 'Focus clock started (epoch ms)', field_type: 'number', required: false, show_in_row: false },
      // Ideas used to run their own ladder (Raw/Developing/Ready). One status
      // vocabulary across every type means a status reads the same wherever you
      // see it, rolls up the same, and a row moved between types keeps meaning
      // what it meant.
      { field_key: 'status', label: 'Status', field_type: 'status', field_options: DONE_STATUS, required: false, show_in_row: true, rollup: 'status' },
      { field_key: 'notes', label: 'Notes', field_type: 'textarea', required: false, show_in_row: false },
    ],
  },
  {
    // Templates instantiate into work items rather than nesting, so they do not
    // support hierarchy - and must not, because there is no template->template
    // rule to back it. A type claiming supports_hierarchy without the matching
    // rule renders a tree whose every drag-to-nest is rejected.
    slug: 'template',
    label: 'Templates',
    label_singular: 'Template',
    icon: '📋',
    supports_hierarchy: true,
    // A template row IS the container - a folder inside one would be a
    // pointless second layer.
    supports_folders: false,
    is_system: true,
    primary_date_field: null,
    fields: [
      { field_key: 'notes', label: 'Notes', field_type: 'textarea', required: false, show_in_row: false },
    ],
  },
];

// Type-to-type relationship rules: which types may parent/child which types.
export const SYSTEM_TYPE_RELATIONSHIPS = [
  // Hierarchy: types can have children of the same type. There is deliberately
  // no separate "folder" type - a folder is a row of the page's own type with
  // entities.is_folder = 1, so these self-nesting rules are all that is needed
  // for types under types, types under folders, and folders under folders
  // alike. The list is derived from supports_hierarchy below so the two can
  // never disagree.
  { type_slugs: null, relationship_kind: 'hierarchy', max_children_per_parent: null, max_parents_per_child: null },

  // Associations: work items link to priorities, areas, goals
  { type_slugs_parent: 'work_item', type_slugs_child: ['priority', 'area', 'goal'], relationship_kind: 'association', max_children_per_parent: null, max_parents_per_child: null },

  // Todos/Tasks can recur to work items
  { type_slugs_parent: 'to_do', type_slugs_child: 'work_item', relationship_kind: 'recurrence', max_children_per_parent: null, max_parents_per_child: 1 },
  { type_slugs_parent: 'task', type_slugs_child: 'work_item', relationship_kind: 'recurrence', max_children_per_parent: null, max_parents_per_child: 1 },

  // A template may contain any editable type, in whatever arrangement the user
  // wants, and is then dropped onto a day to produce that work. This
  // cross-type hierarchy rule is the ONLY thing that distinguishes a template
  // from any other typed row - everything else about it is the generic engine.
  { type_slugs_parent: 'template', type_slugs_child: ['priority', 'area', 'goal', 'to_do', 'task', 'ticket', 'idea', 'template'], relationship_kind: 'hierarchy', max_children_per_parent: null, max_parents_per_child: null },

  // Templates instantiate to work items
  { type_slugs_parent: 'template', type_slugs_child: 'work_item', relationship_kind: 'instantiated_from', max_children_per_parent: null, max_parents_per_child: 1 },
];

// Non-editable types: the Daily day-container and external import sources.
// Seeded by the schema files; phase 0 does not create them.
export const SPECIAL_ENTITY_TYPES = [
  {
    slug: 'daily',
    label: 'Daily',
    label_singular: 'Daily',
    icon: '📅',
    type_category: 'daily',
    external_source: null,
  },
  {
    slug: 'outlook_calendar',
    label: 'Outlook Calendar',
    label_singular: 'Outlook Event',
    icon: '📆',
    type_category: 'external',
    external_source: 'outlook',
  },
];

// The types that nest inside themselves. Derived, never restated, so it cannot
// drift from supports_hierarchy.
export const SELF_NESTING_SLUGS = SYSTEM_ENTITY_TYPES
  .filter((t) => t.supports_hierarchy)
  .map((t) => t.slug);

// The self-nesting rule row in SYSTEM_TYPE_RELATIONSHIPS carries `type_slugs:
// null` as a marker meaning "every hierarchical type"; resolve it here so
// callers iterate one uniform shape.
export function resolveTypeRelationships() {
  return SYSTEM_TYPE_RELATIONSHIPS.map((rel) =>
    rel.type_slugs === null && rel.relationship_kind === 'hierarchy'
      ? { ...rel, type_slugs: SELF_NESTING_SLUGS }
      : rel
  );
}
