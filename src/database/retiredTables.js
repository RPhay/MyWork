// Tables the app no longer reads, and the evidence needed before dropping one.
//
// This list lived in mysqlSchema.js AND mssqlSchema.js, written out twice. A
// third copy - in the service behind the "Drop Retired Tables" button - is
// exactly how `INSERT_IGNORE_KEY_COLUMNS` and `ALL_SYSTEM_TABLES` came to
// disagree with the schema they describe. One list, imported everywhere.
//
// A table earns its place here by being MIGRATED and UNREAD: its rows exist as
// entities, and nothing in src/ issues a query against it. Retiring one is a
// separate act from dropping it - both schema files drop these on a schema run,
// and the button lets it happen without one.
export const RETIRED_TABLES = [
  'work_items',
  'tickets',
  'categories',
  'tasks',
  'priorities',
  // Child before parent: to_do_items references to_dos.
  'to_do_items',
  'to_dos',
  // The legacy Templates stack, retired 2026-08-26. A template is a `template`
  // entity now: dailyTemplateService is a shim over entityService, and what
  // these three junctions held is the template's hierarchy CHILDREN.
  'template_areas',
  'template_goals',
  'template_priorities',
  'work_item_templates',
  // The last pair of their kind, retired 2026-08-26. What they held - the
  // categories and goals a project belongs to - is the project's hierarchy
  // children in entity_relationships now, the same as a template's contents.
  'priority_areas',
  'priority_goals',
];

/**
 * For a retired table that still holds rows, the entity type its rows should
 * have become. Absent from this map means "no evidence available" - the table
 * is dropped without a row check, which is only safe because these tables are
 * empty or unread by definition.
 *
 * Matched on TITLE rather than a legacy id column, because only Dailies left
 * one behind (`entities.legacy_daily_id`). That is weaker evidence, which is
 * why it is used only for tables no code reads at all: a stale row nobody
 * queries costs nothing, and dropping an unmigrated one cannot be undone.
 */
export const LEGACY_TABLE_TYPE = {
  tasks: 'task',
  priorities: 'priority',
  to_dos: 'to_do',
  work_items: 'daily',
};
