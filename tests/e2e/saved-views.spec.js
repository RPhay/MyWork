import { test, expect } from '@playwright/test';

// A view is the filters, sort and column order you already set up per type -
// they simply had no name, so "my open tickets" had to be rebuilt by hand each
// time. Stored per browser, like the view state it is made of.

const TYPE = 'to_do';

test.afterEach(async ({ page }) => {
  await page.evaluate((t) => localStorage.removeItem(`entityViews:${t}`), TYPE).catch(() => {});
});

test('a view can be saved, applied and forgotten', async ({ page }) => {
  await page.goto(`/?tab=${TYPE}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);

  // Sort by a column, so there is a state worth naming.
  await page.locator(`#tab-${TYPE} [data-action="sort-column"]`).first().click();
  await page.waitForTimeout(500);
  const sorted = await page.evaluate((t) => JSON.parse(localStorage.getItem(`entity-view-${t}`) || '{}'), TYPE);
  console.log('view state after sorting ->', JSON.stringify(sorted));

  await page.locator(`#tab-${TYPE} [data-action="toggle-views"]`).click();
  await page.waitForTimeout(400);
  const menu = page.locator(`#tab-${TYPE} .entity-views-menu`);
  await expect(menu).toBeVisible();
  await expect(menu.locator('.entity-views-list')).toContainText('Nothing saved yet');

  await menu.locator('[data-action="save-view"]').click();
  await page.waitForTimeout(400);
  await page.fill('#confirmModalInput', 'ZZZ my view');
  await page.click('#confirmModalConfirm');
  await page.waitForTimeout(700);

  const stored = await page.evaluate((t) => JSON.parse(localStorage.getItem(`entityViews:${t}`) || '[]'), TYPE);
  console.log('saved ->', JSON.stringify(stored.map(v => v.name)));
  expect(stored.map(v => v.name), 'the view is stored under its name').toContain('ZZZ my view');

  // It appears in the menu, and applying it puts that state back.
  await page.locator(`#tab-${TYPE} [data-action="toggle-views"]`).click();
  await page.waitForTimeout(400);
  await expect(menu.locator('[data-action="apply-view"]')).toHaveText('ZZZ my view');

  // Change the sort, then apply the view: the saved sort must come back.
  await page.locator(`#tab-${TYPE} [data-action="sort-column"]`).nth(1).click();
  await page.waitForTimeout(500);
  await page.locator(`#tab-${TYPE} [data-action="toggle-views"]`).click();
  await page.waitForTimeout(400);
  await menu.locator('[data-action="apply-view"]', { hasText: 'ZZZ my view' }).click();
  await page.waitForTimeout(900);

  const restored = await page.evaluate((t) => JSON.parse(localStorage.getItem(`entity-view-${t}`) || '{}'), TYPE);
  console.log('view state after applying ->', JSON.stringify(restored));
  expect(sorted.sortKey, 'sorting actually recorded a key').toBeTruthy();
  expect(restored.sortKey, 'the saved sort came back').toBe(sorted.sortKey);

  // And it can be forgotten.
  await page.locator(`#tab-${TYPE} [data-action="toggle-views"]`).click();
  await page.waitForTimeout(400);
  await menu.locator('[data-action="delete-view"]').first().click();
  await page.waitForTimeout(500);
  const after = await page.evaluate((t) => JSON.parse(localStorage.getItem(`entityViews:${t}`) || '[]'), TYPE);
  expect(after, 'forgotten').toEqual([]);
});
