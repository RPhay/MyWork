import { test, expect } from '@playwright/test';

test('Check if SplitPane class exists', async ({ page }) => {
  const consoleLogs = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleLogs.push(`ERROR: ${msg.text()}`);
    }
  });

  await page.goto('http://localhost:3000/?tab=todos');
  await page.waitForLoadState('networkidle');

  if (consoleLogs.length > 0) {
    console.log('Console errors during load:', consoleLogs);
  }

  const splitpaneInfo = await page.evaluate(() => {
    const info = {
      classExists: typeof SplitPane !== 'undefined',
      instanceExists: typeof window.todoSplitPane !== 'undefined',
      instanceValue: String(window.todoSplitPane),
      hasShowRightPane: window.todoSplitPane && typeof window.todoSplitPane.showRightPane === 'function',
      instanceKeys: window.todoSplitPane ? Object.getOwnPropertyNames(window.todoSplitPane) : [],
      instanceMethods: window.todoSplitPane ? Object.getOwnPropertyNames(Object.getPrototypeOf(window.todoSplitPane)) : [],
      instanceType: window.todoSplitPane ? window.todoSplitPane.constructor.name : 'unknown',
    };

    // Check if it's actually a SplitPane instance
    if (window.todoSplitPane) {
      info.isSplitPane = window.todoSplitPane instanceof SplitPane;
    }

    return info;
  });

  console.log('SplitPane info:', JSON.stringify(splitpaneInfo, null, 2));
  expect(splitpaneInfo.classExists).toBe(true);
  expect(splitpaneInfo.instanceExists).toBe(true);
  expect(splitpaneInfo.hasShowRightPane).toBe(true);
});

test('Todos page - editor should start hidden', async ({ page }) => {
  await page.goto('http://localhost:3000/?tab=todos');

  // Wait for page to load
  await page.waitForLoadState('networkidle');

  // Check if editor pane is hidden
  const editorPane = await page.locator('#todoEditorPane');
  const isHidden = await editorPane.evaluate(el => {
    const classes = el.className;
    const computedStyle = window.getComputedStyle(el);
    return classes.includes('hidden') && computedStyle.display === 'none';
  });

  console.log('Editor pane is hidden:', isHidden);
  expect(isHidden).toBe(true);
});

test('Todos page - clicking on todo should load it', async ({ page }) => {
  const consoleLogs = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleLogs.push(`CONSOLE ERROR: ${msg.text()}`);
    }
  });

  await page.goto('http://localhost:3000/?tab=todos');

  // Wait for page to load
  await page.waitForLoadState('networkidle');

  // Expand first folder if collapsed
  const firstFolder = await page.locator('.todo-folder-node').first();
  const isCollapsed = await firstFolder.evaluate(el => !el.classList.contains('expanded'));
  if (isCollapsed) {
    const toggle = firstFolder.locator('.todo-folder-toggle').first();
    await toggle.click({ force: true });
    await page.waitForTimeout(300);
  }

  // Get first todo item
  const firstTodo = await page.locator('.todo-row').first();

  // Click on it
  await firstTodo.click({ force: true });

  // Wait for any errors to appear
  await page.waitForTimeout(1000);

  // Check for error notifications
  const errorElements = await page.locator('.alert-danger');
  const errorCount = await errorElements.count();
  console.log('Number of error alerts:', errorCount);

  if (errorCount > 0) {
    const errorText = await errorElements.first().textContent();
    console.log('Error message:', errorText);
  }

  // Check if editor pane is now visible
  const editorPane = await page.locator('#todoEditorPane');
  const isVisible = await editorPane.evaluate(el => {
    const classes = el.className;
    const computedStyle = window.getComputedStyle(el);
    return !classes.includes('hidden') && computedStyle.display !== 'none';
  });

  console.log('Editor pane is visible after click:', isVisible);

  // Check if title is populated
  const titleInput = await page.locator('#toDoEditorFormTitle');
  const titleValue = await titleInput.inputValue();
  console.log('Title value:', titleValue);

  if (consoleLogs.length > 0) {
    console.log('Console errors:', consoleLogs);
  }

  expect(errors).toBe(0);
  expect(isVisible).toBe(true);
  expect(titleValue.length).toBeGreaterThan(0);
});

test('Templates page - for comparison', async ({ page }) => {
  await page.goto('http://localhost:3000/?tab=templates');

  // Wait for page to load
  await page.waitForLoadState('networkidle');

  // Check if editor pane is hidden
  const editorPane = await page.locator('#templateEditorPane');
  const isHidden = await editorPane.evaluate(el => {
    const classes = el.className;
    const computedStyle = window.getComputedStyle(el);
    return classes.includes('hidden') && computedStyle.display === 'none';
  });

  console.log('Templates editor pane is hidden:', isHidden);
  expect(isHidden).toBe(true);
});
