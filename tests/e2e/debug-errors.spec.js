import { test, expect } from '@playwright/test';
import { setupTestData, createTestWorkItem } from './setup-test-data.js';

test('Debug: Check console errors during Add->Category', async ({ page }) => {
  // Capture console messages
  const consoleLogs = [];
  page.on('console', msg => {
    console.log(`[${msg.type()}] ${msg.text()}`);
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });

  // Capture page errors
  page.on('pageerror', error => {
    console.error('[PAGE_ERROR]', error.message);
    consoleLogs.push({ type: 'error', text: error.message });
  });

  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  const dailiesTab = page.locator('button:has-text("Dailies")').first();
  await dailiesTab.click();
  await page.waitForTimeout(1000);

  const testData = await setupTestData(page);
  await page.waitForTimeout(500);

  const workItem = await createTestWorkItem(page, 'Debug Errors');
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Clear logs so we only see what happens during the association
  consoleLogs.length = 0;

  const workItemHeader = page.locator('.work-item-header').first();
  await workItemHeader.click({ button: 'right' });
  await page.waitForTimeout(500);

  const addSubmenu = page.locator('[data-submenu="add-items"]');
  await addSubmenu.click();
  await page.waitForTimeout(500);

  // Inject logging into the showAreaSelector function
  await page.evaluate(() => {
    console.log('[TEST] About to call showAreaSelector');
  });

  const areaBtn = page.locator('[data-action="add-area"]');
  await areaBtn.click();

  // Wait and collect any errors
  await page.waitForTimeout(2000);

  console.log('=== Console logs during Add->Category ===');
  consoleLogs.forEach(log => {
    console.log(`[${log.type}] ${log.text}`);
  });

  // Check if modal was created at all
  const allModals = page.locator('.modal');
  const count = await allModals.count();
  console.log('Total modals:', count);

  const modal = page.locator('.modal.fade').last();
  const hasModal = await modal.isVisible({ timeout: 1000 }).catch(() => false);
  console.log('Last modal visible:', hasModal);
});
