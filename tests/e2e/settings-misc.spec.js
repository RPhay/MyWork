import { test, expect } from '@playwright/test';

// Miscellaneous settings: a page of sub-tabs so a small preference does not
// need a top-level tab. The first is the focus-bar colour palette - each colour
// gets a name, so the chip's right-click menu can say what a colour MEANS.

test('the Miscellaneous tab opens and lists the focus colours', async ({ page }) => {
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));

  await page.goto('/settings?tab=misc', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  await expect(page.locator('#miscSubTabs'), 'sub-tabs are present').toHaveCount(1);
  // Sub-TABS, not pills.
  await expect(page.locator('#miscSubTabs.nav-tabs')).toHaveCount(1);
  await expect(page.locator('#miscSubTabs.nav-pills')).toHaveCount(0);

  const rows = page.locator('#focusColourRows tr');
  await expect(rows, 'defaults are listed').not.toHaveCount(0);
  await expect(rows.first().locator('.misc-colour')).toHaveCount(1);
  await expect(rows.first().locator('.misc-label')).toHaveCount(1);
  expect(errs, `page errors: ${errs.join(' | ')}`).toEqual([]);
});

test('a saved palette is what the focus chip menu offers', async ({ page }) => {
  await page.goto('/settings?tab=misc', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Replace the palette with one obviously-named colour.
  await page.evaluate(() => {
    document.getElementById('focusColourRows').innerHTML = '';
    document.getElementById('addFocusColourBtn').click();
  });
  await page.locator('#focusColourRows .misc-label').first().fill('Blocked on Bob');
  await page.click('#saveFocusColoursBtn');
  await page.waitForTimeout(600);

  const saved = await page.evaluate(() => localStorage.getItem('focusColourPalette'));
  console.log('saved palette ->', saved);
  expect(saved).toContain('Blocked on Bob');

  // The dashboard's chip menu reads that palette. Pin something so the menu has
  // a chip to open on - skipping here would leave the integration unasserted.
  await page.goto('/?tab=idea', { waitUntil: 'networkidle' });
  const made = await page.evaluate(async () => {
    const csrf = window.APP_CONFIG?.csrfToken;
    const r = await fetch('/api/entities/idea', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CSRF-Token': csrf },
      body: JSON.stringify({ title: 'ZZZ palette probe' }),
    });
    const body = await r.json();
    await fetch('/api/focus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CSRF-Token': csrf },
      body: JSON.stringify({ entityId: body.data.id }),
    });
    return body.data;
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  const chip = page.locator(`#focusBar .focus-chip[data-entity-id="${made.id}"]`);
  await expect(chip).toHaveCount(1);

  await chip.click({ button: 'right' });
  await page.waitForTimeout(400);
  // The menu must show the NAME, not just a swatch to be memorised, and the
  // swatch must actually be painted the configured colour.
  const rows = await page.locator('.focus-context-menu .focus-swatch-row').evaluateAll(els => els.map(e => ({
    text: e.querySelector('.focus-swatch-label')?.textContent.trim(),
    colour: getComputedStyle(e.querySelector('.focus-swatch')).backgroundColor,
  })));
  console.log('colour menu ->', JSON.stringify(rows));

  const labels = rows.map(r => r.text);
  expect(labels, 'the configured name is shown as text').toContain('Blocked on Bob');
  expect(labels[0], 'None comes first, to clear the colour').toBe('None');

  const chosen = rows.find(r => r.text === 'Blocked on Bob');
  expect(chosen.colour, 'the row shows its own colour').toBe('rgb(219, 234, 254)');

  await page.evaluate(() => localStorage.removeItem('focusColourPalette'));

  // Test rows are the user's real data until removed: soft delete, then purge.
  await page.evaluate(async (id) => {
    const csrf = window.APP_CONFIG?.csrfToken;
    await fetch(`/api/focus/${id}`, { method: 'DELETE', headers: { 'CSRF-Token': csrf } });
    await fetch(`/api/entities/idea/${id}`, { method: 'DELETE', headers: { 'CSRF-Token': csrf } });
    await fetch(`/api/trash/${id}`, { method: 'DELETE', headers: { 'CSRF-Token': csrf } });
  }, made.id);
});
