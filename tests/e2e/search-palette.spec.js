import { test, expect } from '@playwright/test';
import { purgeByTitlePrefix } from './helpers/cleanup.js';

/**
 * Global search and the command palette.
 *
 * This closes two gaps at once: there was no search of any kind, and every way
 * of placing a record was drag-exclusive. The palette's actions call the same
 * endpoints the drop handlers do, so the behaviour has two ways in and one
 * implementation.
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
  await page.waitForTimeout(800);
  await page.evaluate(async (t) => {
    const j = async (p, o) => (await fetch(p, {
      ...o, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': t, ...(o?.headers || {}) },
    })).json().catch(() => null);
    for (const i of ((await j('/api/focus'))?.data) || []) await j(`/api/focus/${i.id}`, { method: 'DELETE' });
    for (const e of ((await j('/api/entities/idea'))?.data) || []) {
      if ((e.title || '').startsWith('ZZZ')) await j(`/api/entities/idea/${e.id}`, { method: 'DELETE' });
    }
  }, await page.evaluate(() => document.body.dataset.csrfToken));
});

// Teardown in a hook, and a HARD delete.
//
// Every test here used to end with `DELETE /api/entities/idea/:id`, which is a
// SOFT delete - it stamps deleted_at and the row stays in the trash. So this
// spec leaked its fixtures on a fully GREEN run, not on failure: the 159/159
// guard run of 2026-08-25 left exactly the four ideas these tests create.
// purgeByTitlePrefix makes both calls, and the hook means an early assertion
// failure no longer skips it.
test.afterEach(async ({ page }) => {
  await purgeByTitlePrefix(page, 'idea', 'ZZZ');
});

const openPalette = async (page) => {
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');
  await expect(page.locator('.cmdk')).toBeVisible();
};

test('finds a record by title from any tab', async ({ page }) => {
  const idea = (await api(page, '/api/entities/idea', {
    method: 'POST', body: JSON.stringify({ title: 'ZZZ needle in the haystack' }),
  })).body.data;

  // Deliberately search from a DIFFERENT tab - the point is not having to know
  // where something lives.
  await page.goto('/?tab=priority');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1400);

  await openPalette(page);
  await page.locator('.cmdk-input').fill('needle in the hay');
  await page.waitForTimeout(700);

  const row = page.locator('.cmdk-row', { hasText: 'ZZZ needle in the haystack' }).first();
  await expect(row).toBeVisible();
  await expect(row.locator('.cmdk-type')).toHaveText('Ideas');

  await api(page, `/api/entities/idea/${idea.id}`, { method: 'DELETE' });
});

test('finds a record by what is inside a field, and says which', async ({ page }) => {
  const idea = (await api(page, '/api/entities/idea', {
    method: 'POST',
    body: JSON.stringify({ title: 'ZZZ plain title', fields: { notes: 'mentions kryptonite inside' } }),
  })).body.data;

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  await openPalette(page);
  await page.locator('.cmdk-input').fill('kryptonite');
  await page.waitForTimeout(700);

  const row = page.locator('.cmdk-row', { hasText: 'ZZZ plain title' }).first();
  await expect(row).toBeVisible();
  // The result explains itself rather than appearing for no visible reason.
  await expect(row.locator('.cmdk-why')).toContainText('kryptonite');

  await api(page, `/api/entities/idea/${idea.id}`, { method: 'DELETE' });
});

test('opening a result lands on its tab with the row highlighted', async ({ page }) => {
  const idea = (await api(page, '/api/entities/idea', {
    method: 'POST', body: JSON.stringify({ title: 'ZZZ jump to me' }),
  })).body.data;

  await page.goto('/?tab=priority');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1400);

  await openPalette(page);
  await page.locator('.cmdk-input').fill('jump to me');
  await page.waitForTimeout(700);
  await page.keyboard.press('Enter');

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1800);

  expect(page.url()).toContain('tab=idea');
  const row = page.locator(`.entity-row[data-entity-id="${idea.id}"]`);
  await expect(row).toBeVisible();

  await api(page, `/api/entities/idea/${idea.id}`, { method: 'DELETE' });
});

test('Tab offers the actions that were previously drag-only', async ({ page }) => {
  const idea = (await api(page, '/api/entities/idea', {
    method: 'POST', body: JSON.stringify({ title: 'ZZZ keyboard placement' }),
  })).body.data;

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  await openPalette(page);
  await page.locator('.cmdk-input').fill('keyboard placement');
  await page.waitForTimeout(700);
  await page.keyboard.press('Tab');

  await expect(page.locator('.cmdk-row', { hasText: 'Pin to focus bar' })).toBeVisible();
  await expect(page.locator('.cmdk-row', { hasText: 'Add to priorities' })).toBeVisible();

  // Run it: no mouse, no drag, same result as dropping the row on the bar.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  await expect(page.locator(`#focusBar .focus-chip[data-entity-id="${idea.id}"]`)).toBeVisible();

  await api(page, `/api/focus/${idea.id}`, { method: 'DELETE' });
  await api(page, `/api/entities/idea/${idea.id}`, { method: 'DELETE' });
});

test('> lists commands and Escape dismisses', async ({ page }) => {
  await openPalette(page);
  await page.locator('.cmdk-input').fill('>');
  await page.waitForTimeout(300);

  await expect(page.locator('.cmdk-row', { hasText: 'Open Settings' })).toBeVisible();
  await expect(page.locator('.cmdk-row').first()).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('.cmdk')).toHaveCount(0);
});
