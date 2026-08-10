import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test('Visual debugging - todos tab', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Take screenshot of initial page
  await page.screenshot({ path: '/private/tmp/claude-501/-Users-aslynn-git-github-MyWork/4d4e9b81-1706-4723-aad4-52d5cf9cb523/scratchpad/01-initial.png' });
  console.log('Screenshot 1: Initial page');

  // Click on Todos tab
  await page.click('[data-tab="todos"]');
  await page.waitForSelector('#toDosList', { timeout: 5000 });
  await page.screenshot({ path: '/private/tmp/claude-501/-Users-aslynn-git-github-MyWork/4d4e9b81-1706-4723-aad4-52d5cf9cb523/scratchpad/02-todos-tab.png' });
  console.log('Screenshot 2: After clicking todos tab');

  // Click add todo button
  await page.click('#addToDoBtn');
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/private/tmp/claude-501/-Users-aslynn-git-github-MyWork/4d4e9b81-1706-4723-aad4-52d5cf9cb523/scratchpad/03-modal-open.png' });
  console.log('Screenshot 3: After clicking add todo');

  // Type todo title
  await page.fill('#toDoTitle', 'Test Todo');
  await page.screenshot({ path: '/private/tmp/claude-501/-Users-aslynn-git-github-MyWork/4d4e9b81-1706-4723-aad4-52d5cf9cb523/scratchpad/04-form-filled.png' });
  console.log('Screenshot 4: After filling form');

  // Click save
  await page.click('#saveToDoBtn');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/private/tmp/claude-501/-Users-aslynn-git-github-MyWork/4d4e9b81-1706-4723-aad4-52d5cf9cb523/scratchpad/05-after-save.png' });
  console.log('Screenshot 5: After clicking save');

  // Wait a bit more
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/private/tmp/claude-501/-Users-aslynn-git-github-MyWork/4d4e9b81-1706-4723-aad4-52d5cf9cb523/scratchpad/06-after-wait.png' });
  console.log('Screenshot 6: After 2 second wait');

  // Check what's visible
  const modalVisible = await page.isVisible('#toDoModal');
  const todosList = await page.locator('#toDosList').innerHTML();
  console.log('Modal visible:', modalVisible);
  console.log('Todos list HTML length:', todosList.length);
  console.log('Todos list content preview:', todosList.substring(0, 200));
});
