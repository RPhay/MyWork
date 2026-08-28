// Editing a row that sits INSIDE a daily.
//
// This was a compact hand-written pane with a per-type field map - `notes` and
// `status` for a todo, `description` and `year` for a goal, and so on. Two
// things were wrong with it. It showed one or two fields whatever the type
// actually declared, so a Project opened inside a daily and a Project opened
// on its own tab were different editors over the same record. And its keys
// were slugs that no longer exist: rows publish `to_do` and `category`, the
// map held `todo` and `area`, so double-clicking a Todo inside a daily hit
// `console.error('Unknown item type')` and opened nothing at all.
//
// It uses the shared editor now, with the CHILD's own schema, rendered into
// the Dailies pane and saved back to the child's own endpoint - the same
// render-here-save-there split a template's mixed-type children already use.
// Any type works, including ones invented later, because nothing is listed.

// Store currently edited child item - read by syncDailiesRowSelection().
let currentEditingChild = null;

// One fetch per type, kept as the promise so two quick double-clicks do not
// each start their own.
const childSchemaCache = new Map();
function childTypeSchema(slug) {
  if (!childSchemaCache.has(slug)) {
    childSchemaCache.set(slug, app.fetchData(`/api/entity-types/${slug}`));
  }
  return childSchemaCache.get(slug);
}

async function openChildItemEditor(type, id) {
  // Clicking the open row again shuts the editor; unsaved changes hold it.
  if (currentEditingChild?.id === String(id) && currentEditingChild?.type === type) {
    if (GenericEntity.hasUnsavedChanges()) return;
    closeChildItemEditor();
    return;
  }

  try {
    const [schema, entity] = await Promise.all([
      childTypeSchema(type),
      app.fetchData(`/api/entities/${type}/${id}`),
    ]);
    if (!schema || !entity) throw new Error(`Could not load that ${type}`);

    currentEditingChild = { type, id: String(id) };
    // The daily itself is no longer the open record - the rail highlights one
    // row, and it is this child.
    currentWorkItemId = null;

    // Renders in 'daily' (the rail's pane), saves to the child's own type.
    GenericEntity.populate(id, entity, schema, 'daily', schema.slug || type, { force: true });
    syncDailiesRowSelection();
  } catch (error) {
    console.error('Error loading child item:', error);
    app.notify(error.message || 'Could not open that item', 'danger');
  }
}

function closeChildItemEditor() {
  currentEditingChild = null;
  GenericEntity.close();
  syncDailiesRowSelection();
}



