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

  // REMOVED: "Add button should open modal form".
  //
  // It drove `?tab=my-priorities`, a "+ Add Priority" button and a
  // #priorityModal. None of those three strings exists anywhere in src/ - that
  // is the bespoke Priorities page, replaced by the `priority` type on the
  // generic engine, where adding a row opens the editor PANE and not a modal.
  // Creating a row is covered by generic-entity-crud and
  // editable-types-comprehensive against the UI that exists.
});
