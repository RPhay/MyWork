// Fixtures a spec needs to exist before it can run at all.
//
// Some specs exercise "a type the USER created", as opposed to the nine seeded
// ones. They did that by posting to `/api/entities/tests` and assuming a type
// with slug `tests` was already sitting in the database. Nothing created it,
// so on any machine where it was absent the POST returned no `data` and the
// spec died on `Cannot read properties of undefined (reading 'id')` - 12
// failures across 5 files in the 2026-08-25 baseline, all from one missing row.
//
// The type is created here and REMOVED by global-teardown.js, once the whole
// run is over - it has to outlive every file that uses it, so no per-spec hook
// can own it.
//
// It used to be left in place permanently instead, because deleting a type was
// a soft delete that reserved its slug for ever and the next run could not
// recreate it. The cost was that a fixture sat in the user's app as a real tab
// called "Tests", indistinguishable from something they had made, and it was
// twice mistaken for a leak. softDeleteEntityType() releases the slug now, so
// the cheaper trade is no longer needed.

/**
 * Create an entity type if it is not already there. Safe to call repeatedly.
 * Returns the type as the API reports it.
 */
export async function ensureEntityType(page, { slug, label, labelSingular, icon = '\u{1F9EA}' }) {
  return page.evaluate(async ({ slug, label, labelSingular, icon }) => {
    const csrf = window.APP_CONFIG?.csrfToken;

    const list = ((await (await fetch('/api/entity-types')).json().catch(() => ({}))).data) || [];
    const existing = list.find((t) => t.slug === slug);
    if (existing) {
      // A type created before this helper set the flag has no self-nesting
      // rule, so nesting one of its rows inside another is refused and the
      // spec fails on the CHILD rather than on the type. Turning the flag on
      // creates the rule: updateEntityType calls ensureSelfNestingRule too.
      const patch = {};
      if (!existing.supports_hierarchy) {
        patch.supports_hierarchy = true;
        patch.supports_folders = true;
      }
      // A row on a day renders with its TYPE's icon, so a type without one
      // fails the specs on a null icon rather than on anything they mean to
      // check.
      if (!existing.icon) patch.icon = icon;
      if (Object.keys(patch).length) {
        await fetch(`/api/entity-types/${existing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'CSRF-Token': csrf },
          body: JSON.stringify(patch),
        });
        return { ...existing, ...patch };
      }
      return existing;
    }

    const res = await fetch('/api/entity-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CSRF-Token': csrf },
      body: JSON.stringify({
        slug,
        label,
        label_singular: labelSingular,
        type_category: 'editable',
        // Rows of this type nest inside each other, which is the whole point
        // of the specs that use it. This also seeds the self-nesting rule.
        supports_hierarchy: true,
        supports_folders: true,
        icon,
      }),
    });
    const body = await res.json().catch(() => null);
    if (!body?.success) {
      throw new Error(`could not create the '${slug}' fixture type: ${body?.message || res.status}`);
    }
    return body.data;
  }, { slug, label, labelSingular, icon });
}

/** The user-created type the drag/template specs exercise. */
export async function ensureTestsType(page) {
  return ensureEntityType(page, { slug: 'tests', label: 'Tests', labelSingular: 'Test' });
}
