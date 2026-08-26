import { test, expect } from '@playwright/test';

/**
 * Controls whose purpose is not obvious from their label carry hover help.
 * These assertions are counts rather than exact strings, so wording can change
 * freely but a control cannot quietly lose its explanation - and a new button
 * added to one of these surfaces fails until it explains itself.
 */
test('hover help is present where it is needed', async ({ page }) => {
  await page.goto('/?tab=category'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1600);

  const counts = await page.evaluate(() => {
    const withTitle = (sel) => [...document.querySelectorAll(sel)].filter(e => (e.getAttribute('title')||'').trim().length > 0).length;
    const total = (sel) => document.querySelectorAll(sel).length;
    return {
      tabButtons: [withTitle('#mainTabs button'), total('#mainTabs button')],
      dailiesHeaders: [withTitle('.work-item-tree-header span'), total('.work-item-tree-header span')],
      typePageButtons: [withTitle('#areaListPane button'), total('#areaListPane button')],
    };
  });
  console.log(JSON.stringify(counts));
  expect(counts.tabButtons[0]).toBe(counts.tabButtons[1]);
  expect(counts.dailiesHeaders[0]).toBe(counts.dailiesHeaders[1]);
  expect(counts.typePageButtons[0]).toBe(counts.typePageButtons[1]);
});
