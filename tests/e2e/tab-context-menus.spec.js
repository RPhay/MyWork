import { test, expect } from '@playwright/test';
import { purgeByTitlePrefix } from './helpers/cleanup.js';

// Right-clicking a tab offers what you would otherwise have to open the tab to
// do. The actions differ by what the tab IS - a type, a rail, or a full-width
// view - because "meaningful" is not the same list for each.

test.afterEach(async ({ page }) => { await purgeByTitlePrefix(page, 'idea', 'ZZZ'); });

async function menuFor(page, selector) {
  await page.locator(selector).click({ button: 'right' });
  await page.waitForTimeout(400);
  return page.locator('.tab-context-menu .context-menu-item').allTextContents();
}

test('a type tab offers making, expanding and isolating it', async ({ page }) => {
  await page.goto('/?tab=idea', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);

  const items = await menuFor(page, 'button[data-tab="idea"]');
  console.log('type tab menu ->', JSON.stringify(items));
  const text = items.join(' | ');
  expect(text).toContain('New');
  expect(text).toContain('Expand');
  expect(text).toContain('Collapse');
  expect(text).toContain('Show only this');
  expect(text).toContain('Edit this type');
});

test('a rail tab offers isolating it, pairing it with Dailies, and closing it', async ({ page }) => {
  await page.goto('/?tab=idea', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);

  const items = await menuFor(page, 'button[data-rail-toggle="template"]');
  console.log('rail tab menu ->', JSON.stringify(items));
  const text = items.join(' | ');
  expect(text).toContain('Show only this');
  expect(text, 'Templates may sit beside Dailies').toContain('Show beside Dailies');
  expect(text).toContain('Close');

  // Dailies itself has nothing to sit beside.
  const dailies = await menuFor(page, 'button[data-rail-toggle="daily"]');
  console.log('dailies menu ->', JSON.stringify(dailies));
  expect(dailies.join(' | '), 'Dailies is the one it pairs WITH').not.toContain('Show beside Dailies');
});

test('"Show only this" from a tab menu leaves that tab alone on screen', async ({ page }) => {
  await page.goto('/?tab=idea', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);
  await page.locator('button[data-rail-toggle="daily"]').click();
  await page.waitForTimeout(600);

  await page.locator('button[data-tab="idea"]').click({ button: 'right' });
  await page.waitForTimeout(400);
  await page.locator('.tab-context-menu .context-menu-item', { hasText: 'Show only this' }).click();
  await page.waitForTimeout(900);

  const rails = await page.evaluate(() => ['daily', 'template', 'priority-board']
    .filter(s => document.getElementById(`rail-${s}`)?.classList.contains('active')));
  expect(rails, 'every rail stood down').toEqual([]);
  await expect(page.locator('#tab-idea')).toHaveClass(/active/);
});

test('New from a type tab menu opens that type with a fresh editor', async ({ page }) => {
  await page.goto('/?tab=priority', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);

  await page.locator('button[data-tab="idea"]').click({ button: 'right' });
  await page.waitForTimeout(400);
  // 'New Folder' specifically. `hasText: 'New'` with .first() was ambiguous -
  // the ➕ item is labelled with the type's own singular ("Idea"), so the only
  // item carrying the word "New" is the folder one, which is what this always
  // actually clicked.
  await page.locator('.tab-context-menu .context-menu-item', { hasText: 'New Folder' }).first().click();
  await page.waitForTimeout(1400);

  await expect(page.locator('#tab-idea')).toHaveClass(/active/);

  // The editor opens on a record that now EXISTS - creating it is what the
  // button does, as of "New creates the row and keeps the editor on it". So
  // the box holds the placeholder name rather than being empty, and it is
  // selected, so typing replaces it. Asserting '' here was asserting the
  // behaviour that change replaced.
  const title = page.locator('#entity-editor-form input[name="title"]');
  await expect(title, 'the editor is open on the new folder').toHaveValue('New Folder');
  const selection = await title.evaluate(el => ({
    focused: el === document.activeElement,
    selected: el.value.slice(el.selectionStart, el.selectionEnd),
  }));
  expect(selection.focused, 'the name is focused, ready to be typed over').toBe(true);
  expect(selection.selected, 'and selected, so typing replaces it').toBe('New Folder');
});
