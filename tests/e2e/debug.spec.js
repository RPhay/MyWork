import { test, expect } from '@playwright/test';

test('debug: check what is actually displayed', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Check navbar
  const navbar = page.locator('.navbar-brand');
  const navText = await navbar.textContent();
  console.log('Navbar text:', navText);
  console.log('Navbar HTML:', await navbar.innerHTML());

  // Check version element
  const versionEl = page.locator('#navVersion');
  const versionText = await versionEl.textContent();
  console.log('Version element text:', versionText);

  // Check if version is in body
  const bodyText = await page.locator('body').textContent();
  console.log('Version in body:', bodyText.includes('v202'));

  // Go to dailies and check calendar
  await page.goto('http://localhost:3000/?tab=dailies');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  const calendar = page.locator('#calendar');
  const calText = await calendar.textContent();
  console.log('Calendar text contains months:', calText.includes('January') || calText.includes('February'));

  // Check buttons
  const allButtons = page.locator('button');
  const count = await allButtons.count();
  console.log('Total buttons on page:', count);

  const addPrioButtons = page.locator('button:has-text("Add")');
  console.log('Add buttons count:', await addPrioButtons.count());
});
