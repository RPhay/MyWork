// Cleanup helpers for e2e specs.
//
// DELETE /api/entities/:type/:id is a SOFT delete - it stamps deleted_at and
// the row stays, showing up in Recently Deleted. A spec that "cleans up" with
// that call alone leaves its rows sitting in the user's trash forever, which is
// how live and soft-deleted ZZZ rows from several sessions accumulated.
//
// DELETE /api/trash/:id is the only hard delete in the app. Real cleanup is
// both calls, in that order.

export async function purgeByTitlePrefix(page, typeSlug, prefix) {
  return page.evaluate(async ({ typeSlug, prefix }) => {
    const csrf = window.APP_CONFIG?.csrfToken;
    const headers = { 'CSRF-Token': csrf };
    const purged = [];

    const live = ((await (await fetch(`/api/entities/${typeSlug}`)).json().catch(() => ({}))).data) || [];
    for (const e of live.filter(x => String(x.title || '').startsWith(prefix))) {
      await fetch(`/api/entities/${typeSlug}/${e.id}`, { method: 'DELETE', headers });
      purged.push(e.id);
    }

    // Everything matching in the trash, including rows soft-deleted just above
    // and any left by an earlier run that died before its cleanup.
    const trash = ((await (await fetch('/api/trash?limit=500')).json().catch(() => ({}))).data) || [];
    for (const e of trash.filter(x => String(x.title || '').startsWith(prefix))) {
      await fetch(`/api/trash/${e.id}`, { method: 'DELETE', headers });
    }
    return purged.length;
  }, { typeSlug, prefix });
}

// Removes fields added to an existing type for a test. Field deletion IS a hard
// delete, so nothing is left behind - unlike deleting a TYPE, which is a soft
// delete that permanently reserves the slug.
export async function deleteFields(page, fieldIds) {
  return page.evaluate(async (ids) => {
    const csrf = window.APP_CONFIG?.csrfToken;
    for (const id of ids) {
      await fetch(`/api/entity-types/fields/${id}`, { method: 'DELETE', headers: { 'CSRF-Token': csrf } });
    }
  }, fieldIds);
}
