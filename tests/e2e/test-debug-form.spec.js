import { test, expect } from '@playwright/test';

test('Debug: Check if form renders', async ({ page }) => {
  // Capture console logs from the browser
  const logs = [];
  page.on('console', msg => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
    console.log(`PAGE: [${msg.type()}] ${msg.text()}`);
  });

  await page.goto('http://localhost:3000/');

  // Click Areas tab
  await page.click('[data-tab="area"]');
  await page.waitForLoadState('networkidle');

  // Click add button
  const addBtn = page.locator('#addareaBtn');
  console.log('Add button found:', await addBtn.isVisible());
  await addBtn.click();

  // Wait for form and pane to be fully initialized
  await page.waitForTimeout(5000);

  // Check if form exists in DOM
  const formExists = await page.locator('#entity-editor-form').count();
  console.log('Form exists:', formExists);

  // Check editor pane content
  const editorPane = page.locator('#area-editor-pane');
  const paneHtml = await editorPane.innerHTML();
  console.log('Editor pane HTML length:', paneHtml.length);
  console.log('Editor pane HTML:', paneHtml.substring(0, 200));

  // Check if editor pane container is visible
  const editorPaneContainer = page.locator('#areaSplitPane .split-pane-right');
  const containerVisible = await editorPaneContainer.isVisible();
  console.log('Editor pane container visible:', containerVisible);

  // Check hidden class
  const hasHiddenClass = await editorPaneContainer.evaluate((el) => el.classList.contains('hidden'));
  console.log('Has hidden class:', hasHiddenClass);

  console.log('All browser logs:', logs);
});
