import { test, expect } from '@playwright/test';

test('Verify UI layout and folder buttons', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Check that Dailies tab exists
  await expect(page.locator('#work_item-tab')).toContainText('Dailies');
  
  // Check that Projects tab exists  
  await expect(page.locator('#priority-tab')).toContainText('Projects');
  
  // Check folder buttons exist
  const folderButtons = [
    'addAreaFolderBtn',
    'addGoalFolderBtn',
    'addIdeaFolderBtn',
    'addPriorityFolderBtn',
    'addTaskFolderBtn',
    'addTicketFolderBtn',
    'addTodoFolderBtn'
  ];
  
  for (const btnId of folderButtons) {
    const count = await page.locator(`#${btnId}`).count();
    expect(count).toBe(1);
  }
  
  // Check right-aligned tabs exist
  await expect(page.locator('#priority-board-tab')).toContainText('Priority Board');
  await expect(page.locator('#reporting-tab')).toContainText('Reporting');
  
  console.log('✓ All UI elements verified');
});
