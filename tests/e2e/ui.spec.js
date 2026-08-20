import { test, expect } from '@playwright/test';

test.describe('UI Elements', () => {
  test('should display version in navbar', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');

    const navbar = page.locator('.navbar-brand');
    const text = await navbar.textContent();

    // Should contain "MyWork" and version like "v2026.07.28.0"
    expect(text).toContain('MyWork');
    expect(text).toMatch(/v\d{4}\.\d{2}\.\d{2}\.\d+/);
  });

  test('Dailies tab should display full month calendar', async ({ page }) => {
    await page.goto('http://localhost:3000/?tab=dailies');
    await page.waitForLoadState('networkidle');

    const calendar = page.locator('#calendar');
    await expect(calendar).toBeVisible();

    const calendarText = await calendar.textContent();

    // Should show month name
    expect(calendarText).toMatch(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);

    // Should show year
    expect(calendarText).toMatch(/\d{4}/);

    // Should show day numbers
    expect(calendarText).toMatch(/\d/);
  });

  test('Add button should open modal form', async ({ page }) => {
    await page.goto('http://localhost:3000/?tab=my-priorities');
    await page.waitForLoadState('networkidle');

    const addButton = page.locator('button:has-text("+ Add Priority")');
    await addButton.click();

    const modal = page.locator('#priorityModal');
    await expect(modal).toBeVisible();

    const title = page.locator('#priorityTitle');
    await expect(title).toBeVisible();
  });
});
