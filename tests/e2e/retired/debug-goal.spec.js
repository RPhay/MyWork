import { test, expect } from '@playwright/test';
import { createTestWorkItem } from './setup-test-data.js';

test('Debug: Add -> Goal', async ({ page }) => {
  const consoleLogs = [];
  page.on('console', msg => {
    if (msg.text().includes('goal') || msg.type() === 'error') {
      console.log(`[${msg.type()}] ${msg.text()}`);
      consoleLogs.push({ type: msg.type(), text: msg.text() });
    }
  });

  page.on('pageerror', error => {
    console.error('[PAGE_ERROR]', error.message);
  });

  // Intercept the goals API call
  await page.route('**/api/goals/**', async route => {
    console.log('[INTERCEPT]', route.request().url());
    const response = await route.continue();
    const body = await response.json();
    console.log('[GOALS_RESPONSE]', JSON.stringify(body, null, 2).substring(0, 200));
    return response;
  });

  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  const dailiesTab = page.locator('button:has-text("Dailies")').first();
  await dailiesTab.click();
  await page.waitForTimeout(1000);

  // Create a test goal directly
  const csrfToken = await page.evaluate(() => window.APP_CONFIG?.csrfToken);
  const headers = csrfToken ? { 'X-CSRF-Token': csrfToken } : {};
  const year = new Date().getFullYear();
  const goalResp = await page.request.post('/api/goals', {
    data: { name: 'Debug Test Goal', year },
    headers
  });
  console.log('[CREATE_GOAL] Status:', goalResp.status());
  if (goalResp.ok()) {
    const result = await goalResp.json();
    console.log('[CREATE_GOAL_SUCCESS]', result.data?.id);
  }

  // Create work item
  const workItem = await createTestWorkItem(page, 'Debug Goal Association');
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Right-click
  const workItemHeader = page.locator('.work-item-header').first();
  await workItemHeader.click({ button: 'right' });
  await page.waitForTimeout(500);

  // Click Add > Goal
  const addSubmenu = page.locator('[data-submenu="add-items"]');
  await addSubmenu.click();
  await page.waitForTimeout(300);

  const goalBtn = page.locator('[data-action="add-goal"]');
  console.log('[CLICK_ADD_GOAL]');
  await goalBtn.click();
  await page.waitForTimeout(2000);

  // Check for modal
  const allModals = page.locator('.modal');
  const count = await allModals.count();
  console.log('[MODAL_COUNT]', count);

  const visibleModals = page.locator('.modal.show, .modal.fade.show');
  const visibleCount = await visibleModals.count();
  console.log('[VISIBLE_MODAL_COUNT]', visibleCount);

  // Check for error in page
  const errorElements = page.locator('.alert-danger, .alert-error');
  const errorCount = await errorElements.count();
  console.log('[ERROR_ELEMENTS]', errorCount);

  if (errorCount > 0) {
    const errorText = await errorElements.first().textContent();
    console.log('[ERROR_TEXT]', errorText);
  }

  console.log('[CONSOLE_LOGS]');
  consoleLogs.forEach(log => console.log(`  [${log.type}] ${log.text}`));
});
