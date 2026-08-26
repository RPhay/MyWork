import { test, expect } from '@playwright/test';
import { query } from '../../src/database/connectionPool.js';

/**
 * "Drop Retired Tables", beside Analyze & Migrate in Settings.
 *
 * Dropping tables is irreversible, so the button is built to be hard to fire by
 * accident: it LOOKS first and names every table and its row count, then asks
 * outright. And the server refuses independently of whatever is clicked - a
 * table still holding rows that never became entities is never dropped.
 *
 * That refusal is the assertion that matters here. A confirmation the user can
 * click through is worth very little; a server that will not destroy
 * unmigrated rows is worth a great deal.
 */

async function api(page, url, opts = {}) {
  return page.evaluate(async ([u, o]) => {
    const r = await fetch(u, {
      ...o,
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': document.body.dataset.csrfToken || '' },
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, [url, opts]);
}

test('the inspection reports what is there without changing anything', async ({ page }) => {
  await page.goto('/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const first = (await api(page, '/api/system-database/retired-tables')).body;
  expect(first.success).toBe(true);
  expect(Array.isArray(first.data.tables)).toBe(true);

  // Reading twice must give the same answer - the GET is a look, not a sweep.
  const second = (await api(page, '/api/system-database/retired-tables')).body;
  expect(second.data.presentCount, 'inspecting does not drop anything')
    .toBe(first.data.presentCount);
});

test('a retired table holding unmigrated rows is REFUSED', async ({ page }) => {
  // Build the dangerous case rather than hoping to find it. Without this the
  // test skips on any tidy database - which is every database, most of the
  // time - and a guard that skips guards nothing.
  //
  // `priorities` is retired and unread, so creating and dropping it here
  // touches nothing the app looks at. The row deliberately has no matching
  // `priority` entity: that is the one case where dropping DESTROYS.
  await query('DROP TABLE IF EXISTS priorities');
  await query('CREATE TABLE priorities (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255))');
  await query("INSERT INTO priorities (title) VALUES ('ZZZ never migrated project')");

  try {
    await page.goto('/settings', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    const look = (await api(page, '/api/system-database/retired-tables')).body.data;
    const priorities = look.tables.find((t) => t.table === 'priorities');

    expect(priorities.present, 'the table is seen').toBe(true);
    expect(priorities.orphans, 'and its unmigrated row is counted').toBe(1);
    expect(priorities.safe, 'so it is not safe to drop').toBe(false);
    expect(look.droppable, 'it is not offered as droppable').not.toContain('priorities');
    expect(look.blocked.map((b) => b.table)).toContain('priorities');

    // The server refuses on its own, whatever the UI asked.
    const res = (await api(page, '/api/system-database/retired-tables/drop', { method: 'POST' })).body;
    expect(res.data.refused.map((r) => r.table), 'the drop refuses it').toContain('priorities');

    const rows = await query('SELECT COUNT(*) AS n FROM priorities');
    expect(Number(rows[0].n), 'and the row is still there').toBe(1);
  } finally {
    await query('DROP TABLE IF EXISTS priorities');
  }
});

test('a retired table whose rows DID migrate is dropped', async ({ page }) => {
  // The other half: every row accounted for, so dropping is tidying.
  const existing = await query(
    "SELECT e.title FROM entities e JOIN entity_types t ON t.id = e.entity_type_id"
    + " WHERE t.slug = 'priority' AND e.deleted_at IS NULL LIMIT 2",
  );
  test.skip(existing.length === 0, 'no priority entities to mirror');

  await query('DROP TABLE IF EXISTS priorities');
  await query('CREATE TABLE priorities (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255))');
  for (const row of existing) {
    await query('INSERT INTO priorities (title) VALUES (?)', [row.title]);
  }

  try {
    await page.goto('/settings', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    const look = (await api(page, '/api/system-database/retired-tables')).body.data;
    const priorities = look.tables.find((t) => t.table === 'priorities');
    expect(priorities.orphans, 'every row has an entity').toBe(0);
    expect(priorities.safe).toBe(true);

    const res = (await api(page, '/api/system-database/retired-tables/drop', { method: 'POST' })).body;
    expect(res.data.dropped.map((d) => d.table), 'so it is dropped').toContain('priorities');

    const after = (await api(page, '/api/system-database/retired-tables')).body.data;
    expect(after.tables.find((t) => t.table === 'priorities')?.present).toBe(false);
  } finally {
    await query('DROP TABLE IF EXISTS priorities');
  }
});

test('the button is beside Analyze & Migrate and asks before dropping', async ({ page }) => {
  await page.goto('/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  // Open the System Database tab - the panel is a tab pane, so its contents are
  // in the DOM but not visible until it is selected.
  await page.locator('[data-tab="system-database"]').first().click();
  await page.waitForTimeout(800);

  // The card only renders when a system database is configured, which is a
  // deployment choice and not something a test should make for the user. Render
  // it with a stub instead: what is under test is the button's markup, its
  // wiring and its confirmation - none of which depend on a real config.
  const rendered = await page.evaluate(() => {
    if (typeof showSystemDbConfigured !== 'function') return false;
    showSystemDbConfigured('mysql', {
      host: '127.0.0.1', port: 3306, database: 'mywork', user: 'probe', hasPassword: true,
    });
    return true;
  });
  expect(rendered, 'the card renderer is reachable').toBe(true);
  await page.waitForTimeout(400);

  const btn = page.locator('#dropRetiredTablesBtn');
  await expect(page.locator('#analyzeAndMigrateBtn'), 'Analyze & Migrate is there').toBeVisible();
  await expect(btn, 'and Drop Retired Tables sits beside it').toBeVisible();

  // Beside, not somewhere else on the page: same parent, and it follows it.
  const order = await page.evaluate(() => {
    const row = document.getElementById('analyzeAndMigrateBtn').parentElement;
    return [...row.querySelectorAll('button')].map((b) => b.id);
  });
  expect(order, 'in the same button row, after Analyze & Migrate')
    .toEqual(['updateSystemDbBtn', 'analyzeAndMigrateBtn', 'dropRetiredTablesBtn', 'removeSystemDbBtn']);

  const look = (await api(page, '/api/system-database/retired-tables')).body.data;

  await btn.click();
  await page.waitForTimeout(1600);

  if (look.presentCount === 0) {
    await expect(page.locator('#systemDbSchemaStatus')).toContainText(/nothing to drop/i);
    return;
  }

  // It asks, in the app's own modal - UI_STANDARDS forbids browser dialogs.
  const modal = page.locator('.modal.show');
  await expect(modal, 'it asks before dropping anything').toBeVisible();
  await expect(modal).toContainText(/are you sure you really want to do this/i);
  await expect(modal, 'and names a table it would touch')
    .toContainText(look.tables.find((t) => t.present).table);

  // Saying no must drop NOTHING.
  const before = look.presentCount;
  await modal.locator('button').filter({ hasText: /cancel|no|close/i }).first().click();
  await page.waitForTimeout(1200);
  const after = (await api(page, '/api/system-database/retired-tables')).body.data;
  expect(after.presentCount, 'saying no drops nothing').toBe(before);
});
