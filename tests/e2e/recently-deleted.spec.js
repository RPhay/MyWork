import { test, expect } from '@playwright/test';

/**
 * Deleting is reversible now.
 *
 * Deleting a folder deliberately takes everything inside it - that is the
 * intended behaviour, and exactly why it needed a way back. Rows are stamped
 * rather than removed, and everything stamped in the same delete restores
 * together, so "undo that" means the folder AND its contents.
 */

test.describe.configure({ mode: 'serial' });

async function api(page, path, options = {}) {
  return page.evaluate(async ({ path, options, t }) => {
    const r = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': t, ...(options.headers || {}) },
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, { path, options, t: await page.evaluate(() => document.body.dataset.csrfToken) });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  // Purge anything this spec left behind, so the bin starts clean.
  await page.evaluate(async (t) => {
    const j = async (p, o) => (await fetch(p, {
      ...o, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': t, ...(o?.headers || {}) },
    })).json().catch(() => null);
    for (const b of ((await j('/api/trash'))?.data) || []) {
      if ((b.lead.title || '').startsWith('ZZZ')) await j(`/api/trash/${b.lead.id}`, { method: 'DELETE' });
    }
    for (const e of ((await j('/api/entities/idea'))?.data) || []) {
      if ((e.title || '').startsWith('ZZZ')) await j(`/api/entities/idea/${e.id}`, { method: 'DELETE' });
    }
  }, await page.evaluate(() => document.body.dataset.csrfToken));
});

test('a deleted row leaves the list but can be restored', async ({ page }) => {
  const idea = (await api(page, '/api/entities/idea', {
    method: 'POST', body: JSON.stringify({ title: 'ZZZ undo me' }),
  })).body.data;

  await api(page, `/api/entities/idea/${idea.id}`, { method: 'DELETE' });

  // Gone from the list...
  const listed = (await api(page, '/api/entities/idea')).body.data.filter(e => e.id === idea.id);
  expect(listed).toHaveLength(0);
  // ...and gone from search, which reads the same rows.
  const found = (await api(page, '/api/search?q=undo%20me')).body.data;
  expect(found.filter(r => r.id === idea.id)).toHaveLength(0);

  // ...but recoverable.
  const bin = (await api(page, '/api/trash')).body.data;
  expect(bin.some(b => b.lead.id === idea.id)).toBe(true);

  const restored = await api(page, `/api/trash/${idea.id}/restore`, { method: 'POST' });
  expect(restored.body.data.restored).toBe(1);

  const back = (await api(page, '/api/entities/idea')).body.data.filter(e => e.id === idea.id);
  expect(back).toHaveLength(1);
  expect(back[0].title).toBe('ZZZ undo me');
});

test('deleting a folder takes its contents, and restoring brings them all back', async ({ page }) => {
  const folder = (await api(page, '/api/entities/idea', {
    method: 'POST', body: JSON.stringify({ title: 'ZZZ folder', is_folder: true }),
  })).body.data;
  const child = (await api(page, '/api/entities/idea', {
    method: 'POST', body: JSON.stringify({ title: 'ZZZ child inside' }),
  })).body.data;

  const nested = await api(page, `/api/entities/idea/${folder.id}/relationships`, {
    method: 'POST',
    body: JSON.stringify({
      parentEntityId: folder.id, childEntityId: child.id, relationshipKind: 'hierarchy',
    }),
  });
  expect(nested.status, 'the child really is inside the folder').toBe(201);

  await api(page, `/api/entities/idea/${folder.id}`, { method: 'DELETE' });

  const after = (await api(page, '/api/entities/idea')).body.data.map(e => e.id);
  expect(after, 'the folder is gone').not.toContain(folder.id);
  expect(after, 'and so is what was inside it').not.toContain(child.id);

  // One entry in the bin, not two - the batch is the undoable unit.
  const bin = (await api(page, '/api/trash')).body.data;
  const batch = bin.find(b => b.lead.id === folder.id);
  expect(batch, 'the folder leads its own batch').toBeTruthy();
  expect(batch.alsoRemoved, 'and says what came with it').toBe(1);

  const restored = await api(page, `/api/trash/${folder.id}/restore`, { method: 'POST' });
  expect(restored.body.data.restored, 'both come back together').toBe(2);

  const back = (await api(page, '/api/entities/idea')).body.data.map(e => e.id);
  expect(back).toContain(folder.id);
  expect(back).toContain(child.id);
});

test('the panel restores from the UI', async ({ page }) => {
  const idea = (await api(page, '/api/entities/idea', {
    method: 'POST', body: JSON.stringify({ title: 'ZZZ panel restore' }),
  })).body.data;
  await api(page, `/api/entities/idea/${idea.id}`, { method: 'DELETE' });

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  await page.evaluate(() => window.RecentlyDeleted.open());
  const row = page.locator('.trash-row', { hasText: 'ZZZ panel restore' });
  await expect(row).toBeVisible();
  await row.locator('[data-action="restore"]').click();
  await page.waitForTimeout(900);

  const back = (await api(page, '/api/entities/idea')).body.data.filter(e => e.id === idea.id);
  expect(back).toHaveLength(1);

  await api(page, `/api/entities/idea/${idea.id}`, { method: 'DELETE' });
  await api(page, `/api/trash/${idea.id}`, { method: 'DELETE' });
});

test('delete forever really removes it', async ({ page }) => {
  const idea = (await api(page, '/api/entities/idea', {
    method: 'POST', body: JSON.stringify({ title: 'ZZZ purge me' }),
  })).body.data;
  await api(page, `/api/entities/idea/${idea.id}`, { method: 'DELETE' });

  const purged = await api(page, `/api/trash/${idea.id}`, { method: 'DELETE' });
  expect(purged.body.data.purged).toBeGreaterThanOrEqual(1);

  const bin = (await api(page, '/api/trash')).body.data;
  expect(bin.some(b => b.lead.id === idea.id)).toBe(false);

  const gone = await api(page, `/api/entities/idea/${idea.id}`);
  expect(gone.status).toBeGreaterThanOrEqual(400);
});
