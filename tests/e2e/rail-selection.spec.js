import { test, expect } from '@playwright/test';

// One rail at a time unless you ask for more. Two rails plus the tab you are
// reading splits the screen three ways, and it used to happen by accident:
// every rail button was an independent on/off.

const RAILS = ['work_item', 'template', 'priority-board'];

async function openRails(page) {
  return page.evaluate((slugs) => slugs.filter(s => {
    const el = document.getElementById(`rail-${s}`);
    return el && !el.classList.contains('hidden') && el.offsetParent !== null;
  }), RAILS);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?tab=idea', { waitUntil: 'networkidle' });
  // Start from a known state - the toggles persist per browser.
  await page.evaluate((slugs) => slugs.forEach(s => localStorage.setItem(`rail:${s}`, 'false')), RAILS);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
});

test('opening a second rail closes the first', async ({ page }) => {
  await page.locator('button[data-rail-toggle="work_item"]').click();
  await page.waitForTimeout(600);
  expect(await openRails(page), 'the first rail opens').toEqual(['work_item']);

  await page.locator('button[data-rail-toggle="template"]').click();
  await page.waitForTimeout(600);
  expect(await openRails(page), 'a plain click replaces rather than adds').toEqual(['template']);
});

test('holding cmd/ctrl adds a rail instead of replacing', async ({ page }) => {
  await page.locator('button[data-rail-toggle="work_item"]').click();
  await page.waitForTimeout(600);

  await page.locator('button[data-rail-toggle="template"]').click({ modifiers: ['Meta'] });
  await page.waitForTimeout(600);
  const open = await openRails(page);
  console.log('open with Meta ->', JSON.stringify(open));
  expect(open, 'both rails stay open when the modifier is held').toEqual(['work_item', 'template']);
});

test('clicking an open rail still closes it', async ({ page }) => {
  const btn = page.locator('button[data-rail-toggle="work_item"]');
  await btn.click();
  await page.waitForTimeout(600);
  expect(await openRails(page)).toEqual(['work_item']);

  await btn.click();
  await page.waitForTimeout(600);
  expect(await openRails(page), 'a second click on the same rail closes it').toEqual([]);
});
