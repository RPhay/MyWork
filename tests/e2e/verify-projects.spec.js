import { test, expect } from '@playwright/test';

test('Projects page loads and works', async ({ page }) => {
  await page.goto('http://localhost:3000', { waitUntil: 'load' });

  // Click Projects tab
  const projectsButton = page.locator('button[data-tab="my-priorities"]');
  await projectsButton.click();
  await page.waitForTimeout(1000);

  // Check for project nodes
  const projectNodes = page.locator('.priority-node');
  const count = await projectNodes.count();
  console.log('Project nodes found:', count);
  expect(count).toBeGreaterThan(0);

  // Try clicking on first project
  const firstProject = projectNodes.first();
  await firstProject.click();
  await page.waitForTimeout(500);

  // Check that editor pane is now visible
  const editorPane = page.locator('#priorityEditorPane');
  const isVisible = await editorPane.isVisible();
  console.log('Editor pane visible after click:', isVisible);
  expect(isVisible).toBe(true);

  // Check that editor has content
  const editorTitle = editorPane.locator('.split-pane-editor-title');
  const title = await editorTitle.textContent();
  console.log('Editor title:', title);
  expect(title).not.toBe('Select a project to edit');
});
