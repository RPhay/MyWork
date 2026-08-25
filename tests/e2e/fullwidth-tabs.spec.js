import { test, expect } from '@playwright/test';

/**
 * Some views want the whole screen. Reporting is dense - tables, charts, a
 * portfolio breakdown - and reading it beside a rail leaves neither pane
 * usable, so opening it stands the rails down and leaving restores them exactly
 * as they were. The stored toggles are never touched, so nothing is forgotten.
 */
test('Reporting takes the whole screen, and the rails come back after', async ({ page }) => {
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('/?tab=area'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1600);

  // start with both rails up
  if (!(await page.locator('#rail-daily').isVisible())) { await page.locator('button[data-rail-toggle="daily"]').click(); await page.waitForTimeout(600); }
  const dailiesBefore = await page.locator('#rail-daily').isVisible();

  await page.locator('#mainTabs button[data-tab="reporting"]').click();
  await page.waitForTimeout(1200);
  const during = await page.evaluate(() => ({
    dailies: !!document.querySelector('#rail-daily')?.offsetParent,
    templates: !!document.querySelector('#rail-template')?.offsetParent,
    dividers: [...document.querySelectorAll('.app-rail-divider')].filter(d => d.offsetParent).length,
    reporting: !!document.querySelector('#tab-reporting')?.offsetParent,
  }));
  console.log('on reporting ->', JSON.stringify(during));
  expect(during.dailies).toBe(false);
  expect(during.templates).toBe(false);
  expect(during.dividers).toBe(0);
  expect(during.reporting).toBe(true);

  // leaving restores exactly what was up before
  await page.locator('#mainTabs button[data-tab="category"]').click();
  await page.waitForTimeout(1000);
  const after = await page.locator('#rail-daily').isVisible();
  console.log('back on a type ->', JSON.stringify({dailiesBefore, dailiesAfter: after}));
  expect(after).toBe(dailiesBefore);
  expect(errs).toEqual([]);
});
