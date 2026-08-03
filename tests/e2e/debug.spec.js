import { test, expect } from '@playwright/test';

test('debug: check what is actually displayed', async ({ page }) => {
  const consoleLogs = [];
  const errors = [];

  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('error', err => {
    errors.push(err.message);
  });

  await page.goto('http://localhost:3000/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // Check navbar
  const navbar = page.locator('.navbar-brand');
  const navText = await navbar.textContent();
  console.log('Navbar text:', navText);

  // Go to dailies and check calendar
  await page.goto('http://localhost:3000/?tab=dailies');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const calendar = page.locator('#calendar');
  const calText = await calendar.textContent();
  console.log('Calendar text:', calText.substring(0, 100));
  console.log('Calendar contains month names:', calText.includes('January') || calText.includes('February') || calText.includes('August'));

  // Print errors
  if (errors.length > 0) {
    console.log('ERRORS FOUND:');
    errors.slice(0, 10).forEach(e => console.log(' -', e));
  }

  // Print relevant logs
  console.log('CONSOLE LOGS (last 20):');
  consoleLogs.slice(-20).forEach(log => {
    if (!log.includes('source map') && !log.includes('CSP')) {
      console.log(' -', log.substring(0, 120));
    }
  });
});
