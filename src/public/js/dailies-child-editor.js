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
//
// The schema comes from typeSchema() in dailies-items.js (loaded first - see
// dashboard.ejs), not a cache of its own: this used to keep a second
// promise-per-slug cache, which meant a child's schema object here was never
// the SAME object preloadChildTypeSchemas() put in resolvedTypeSchemas - so a
// column-visibility toggle on an open child (see the 'change' listener in
// dailies.js) mutated one copy while the rail's rows kept reading the other,
// and the column never appeared until a hard reload.

// Store currently edited child item - read by syncDailiesRowSelection().
let currentEditingChild = null;

async function openChildItemEditor(type, id) {
  // Clicking the open row again shuts the editor; unsaved changes hold it.
  if (currentEditingChild?.id === String(id) && currentEditingChild?.type === type) {
    if (GenericEntity.hasUnsavedChanges()) return;
    closeChildItemEditor();
    return;
  }

  try {
    const [schema, entity] = await Promise.all([
      typeSchema(type),
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



