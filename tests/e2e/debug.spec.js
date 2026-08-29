import { test, expect } from '@playwright/test';
import { watchConsole } from './consoleErrors.js';

// This spec is in the guard set, where the table says it guards "CSP and
// console errors". It did not: until 2026-08-28 it collected errors, PRINTED
// them, and asserted nothing at all, so it could not fail however badly the
// page broke. The printing is kept - it is genuinely useful when this fails -
// but every claim it makes is now checked.
test('debug: the dashboard and dailies render without console errors', async ({ page }) => {
  const seen = watchConsole(page);

  await page.goto('http://localhost:3000/');
  await page.waitForLoadState('networkidle');

  const navText = await page.locator('.navbar-brand').textContent();
  console.log('Navbar text:', navText);
  expect(navText, 'navbar brand').toContain('MyWork');

  await page.goto('http://localhost:3000/?tab=dailies');
  await page.waitForLoadState('networkidle');

  const calendar = page.locator('#calendar');
  await expect(calendar).toBeVisible();
  const calText = await calendar.textContent();
  console.log('Calendar text:', calText.slice(0, 100));
  expect(calText, 'calendar should render a month').toMatch(
    /January|February|March|April|May|June|July|August|September|October|November|December/
  );

  if (seen.all.length) {
    console.log('ERRORS FOUND:');
    seen.all.slice(0, 10).forEach((e) => console.log(' -', e));
  }

  // A network failure means the page's own dependencies never arrived, so its
  // console says nothing about the app. See consoleErrors.js.
  test.skip(seen.offline, `network unreachable: ${seen.requestFailures[0] ?? ''}`);
  expect(seen.real, `console errors: ${seen.real.join(' | ')}`).toHaveLength(0);
});
