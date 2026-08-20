import { test, expect } from '@playwright/test';
import { purgeByTitlePrefix } from './helpers/cleanup.js';

// Right-clicking a cell that changes on click offers the whole set of values,
// instead of making you click through them - reaching "Failed" from
// "Not Started" was four clicks, each saving a state on the way past.
//
// Emoji cells are the exception: right-click there does what left-click does,
// since choosing an emoji already has its own picker.

const TYPE = 'to_do';

async function api(page, url, opts = {}) {
  return page.evaluate(async ({ url, opts }) => {
    const res = await fetch(url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', 'CSRF-Token': window.APP_CONFIG?.csrfToken },
    });
    return res.json();
  }, { url, opts });
}

test.afterEach(async ({ page }) => { await purgeByTitlePrefix(page, TYPE, 'ZZZ'); });

async function seedRow(page, title, fields = {}) {
  await page.goto(`/?tab=${TYPE}`, { waitUntil: 'networkidle' });
  const made = (await api(page, `/api/entities/${TYPE}`, {
    method: 'POST', body: JSON.stringify({ title, fields }),
  })).data;
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  return made;
}

test('right-clicking a status cell offers every status, in its own colour', async ({ page }) => {
  const made = await seedRow(page, 'ZZZ ctx status', { status: 'Not Started' });
  const row = page.locator(`#${TYPE}EntityList .entity-row[data-entity-id="${made.id}"]`);
  await row.locator('[data-action="cycle-status"]').first().click({ button: 'right' });
  await page.waitForTimeout(500);

  const menu = page.locator('.entity-context-menu');
  await expect(menu).toHaveCount(1);

  const labels = (await menu.locator('.context-menu-item').allTextContents()).map(t => t.replace(/[✓\s]+/g, ' ').trim());
  console.log('status menu ->', JSON.stringify(labels));
  expect(labels).toEqual(['Not Started', 'In Progress', 'Complete', 'Failed', 'Ignored']);

  // Same colours as the cell and the editor - not five lines of identical black.
  const colours = await menu.locator('.context-menu-item span:nth-child(2)').evaluateAll(
    els => els.map(e => `${e.textContent.trim()}=${getComputedStyle(e).color}`));
  console.log('status colours ->', JSON.stringify(colours));
  for (const [label, colour] of Object.entries({
    'Not Started': 'rgb(0, 0, 0)', 'In Progress': 'rgb(13, 110, 253)',
    'Complete': 'rgb(25, 135, 84)', 'Failed': 'rgb(220, 53, 69)', 'Ignored': 'rgb(108, 117, 125)',
  })) {
    expect(colours, `${label} should be ${colour}`).toContain(`${label}=${colour}`);
  }

  // The current value is ticked.
  const ticked = (await menu.locator('.context-menu-item').filter({ hasText: '✓' }).first().textContent() || '')
    .replace(/[✓\s]+/g, ' ').trim();
  expect(ticked).toBe('Not Started');

  // Jump straight to Failed - three steps away.
  await menu.locator('.context-menu-item', { hasText: 'Failed' }).first().click();
  await page.waitForTimeout(1300);
  const now = (await row.locator('[data-action="cycle-status"]').first().textContent() || '').trim();
  expect(now, 'picking from the menu sets that value').toBe('Failed');
});

test('emoji cells are not given a value menu, and carry no box', async ({ page }) => {
  await page.goto(`/?tab=${TYPE}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  const emoji = page.locator(`#${TYPE}EntityList .emoji-cell`).first();
  test.skip(await emoji.count() === 0, 'this type shows no emoji cell');

  const border = await emoji.evaluate(el => getComputedStyle(el).borderTopWidth);
  expect(border, 'emoji cells carry no box').toBe('0px');

  await emoji.click({ button: 'right' });
  await page.waitForTimeout(500);
  expect(await page.locator('.entity-context-menu').count(),
    'right-click on an emoji acts like left-click, it does not open a list').toBe(0);
});
