import { test, expect } from '@playwright/test';

test('Check pane state after add button click', async ({ page }) => {
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    // Capture all logs
    logs.push(`[${msg.type()}] ${text}`);
  });

  await page.goto('http://localhost:3000/');
  await page.click('[data-tab="area"]');
  await page.waitForLoadState('networkidle');

  // Check pane state before clicking add
  const paneBeforeAdd = page.locator('#areaSplitPane .split-pane-right');
  const hiddenBeforeAdd = await paneBeforeAdd.evaluate((el) => el.classList.contains('hidden'));
  console.log('Hidden class before add:', hiddenBeforeAdd);

  // Click add button
  await page.click('#addareaBtn');
  await page.waitForTimeout(2000);

  // Check pane state immediately after clicking add
  const paneAfterAdd = page.locator('#areaSplitPane .split-pane-right');
  const hiddenAfterAdd = await paneAfterAdd.evaluate((el) => el.classList.contains('hidden'));
  console.log('Hidden class after add:', hiddenAfterAdd);

  // Check form exists
  const form = await page.locator('#entity-editor-form').count();
  console.log('Form exists:', form);

  // Check pane display style
  const displayStyle = await paneAfterAdd.evaluate((el) => window.getComputedStyle(el).display);
  console.log('Pane display style:', displayStyle);

  // Print browser logs
  const relevantLogs = logs.filter(l => l.includes('GenericEntity') || l.includes('showRightPane') || l.includes('Initializing'));
  console.log('Relevant logs:', relevantLogs.length > 0 ? relevantLogs : 'NO LOGS FOUND');
});
