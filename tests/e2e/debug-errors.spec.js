import { test, expect } from '@playwright/test';
import { watchConsole } from './consoleErrors.js';

// Until 2026-08-28 this file contained no `expect` at all: it clicked into
// Goals, printed the console, and ended. It could not pass or fail on anything
// it looked at - its only possible failure was a timeout, which is exactly how
// it failed in the full suite that day, reporting a network outage as though it
// were a defect. It is kept rather than retired because it covers ground
// debug.spec.js does not: the console AFTER switching into a type tab, which is
// where the generic entity engine does its work.
test('no console errors after switching into a type tab', async ({ page }) => {
  const seen = watchConsole(page);

  await page.goto('http://localhost:3000/');
  await page.waitForLoadState('networkidle');

  const goals = page.locator('.type-goal');
  await expect(goals, 'the Goals tab should be present').toBeVisible();
  await goals.click();

  // The pane is rendered client-side, so wait for it rather than a fixed sleep.
  await expect(page.locator('#tab-goal')).toBeVisible();
  await page.waitForLoadState('networkidle');

  if (seen.all.length) {
    console.log('ERRORS FOUND:');
    seen.all.slice(0, 10).forEach((e) => console.log(' -', e));
  }

  test.skip(seen.offline, `network unreachable: ${seen.requestFailures[0] ?? ''}`);
  expect(seen.real, `console errors on the Goals tab: ${seen.real.join(' | ')}`).toHaveLength(0);
});
