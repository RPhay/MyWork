import { test, expect } from '@playwright/test';

// Status and priority render as a hidden input PLUS a visible control (a badge,
// a signal-bars meter). The row->editor direction used to set only the hidden
// input, so changing a priority from the row's CELL left the editor's meter
// showing the old level - the sync worked editor->cell but not cell->editor.
//
// Both are asserted on the VISIBLE control, since that is what was wrong; the
// hidden input was correct the whole time and a test reading it would pass
// against the bug.

const TYPE = 'priority';

async function makeRow(page, title) {
  await page.click(`#add${TYPE}Btn`);
  const t = page.locator('#entity-editor-form input[name="title"]');
  await t.fill(title);
  await t.dispatchEvent('input');
  await page.click(`#${TYPE}SaveBtn`);
  await page.waitForTimeout(1200);
}

test('changing priority from the cell updates the editor', async ({ page }) => {
  await page.goto(`/?tab=${TYPE}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);
  await makeRow(page, 'ZZZ cyclesync');

  const row = page.locator(`#${TYPE}EntityList .entity-row`).filter({ hasText: 'ZZZ cyclesync' }).first();
  const cell = row.locator('[data-action="cycle-priority"]').first();
  test.skip(await cell.count() === 0, 'type has no priority cell');

  const editorCtl = page.locator('#entity-editor-form [data-field-type="priority"] .editor-cycle');
  await expect(editorCtl).toHaveCount(1);

  // Click the CELL, then read the EDITOR's visible control.
  for (let i = 0; i < 3; i++) {
    const cellBefore = (await cell.getAttribute('data-priority')) || '';
    await cell.click();
    await page.waitForTimeout(900);

    const cellNow = (await page.locator(`#${TYPE}EntityList .entity-row`)
      .filter({ hasText: 'ZZZ cyclesync' }).first()
      .locator('[data-action="cycle-priority"]').first()
      .getAttribute('data-priority')) || '';
    expect(cellNow, 'the cell itself should have advanced').not.toBe(cellBefore);

    const shown = (await editorCtl.locator('.editor-cycle-label').textContent() || '').trim();
    const hidden = await page.locator('#entity-editor-form [data-field-type="priority"] input[type="hidden"]').inputValue();
    expect(hidden, 'hidden input follows the cell').toBe(cellNow);
    expect(shown.toLowerCase(), `editor meter should show "${cellNow || 'none'}", not "${shown}"`)
      .toBe((cellNow || 'none').toLowerCase());
  }
});

test('changing priority in the editor updates the cell', async ({ page }) => {
  await page.goto(`/?tab=${TYPE}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);
  await makeRow(page, 'ZZZ cyclesync2');

  const editorCtl = page.locator('#entity-editor-form [data-field-type="priority"] .editor-cycle');
  test.skip(await editorCtl.count() === 0, 'type has no priority field');

  await editorCtl.click();
  await page.waitForTimeout(500);
  const hidden = await page.locator('#entity-editor-form [data-field-type="priority"] input[type="hidden"]').inputValue();

  const cellVal = await page.locator(`#${TYPE}EntityList .entity-row`)
    .filter({ hasText: 'ZZZ cyclesync2' }).first()
    .locator('[data-action="cycle-priority"]').first()
    .getAttribute('data-priority');
  expect(cellVal || '', 'the row cell should mirror the editor').toBe(hidden);
});

test.afterEach(async ({ page }) => {
  await page.evaluate(async () => {
    const csrf = window.APP_CONFIG?.csrfToken;
    const body = await (await fetch('/api/entities/priority')).json();
    for (const e of (body.data || []).filter(x => (x.title || '').startsWith('ZZZ cyclesync'))) {
      await fetch(`/api/entities/priority/${e.id}`, { method: 'DELETE', headers: { 'CSRF-Token': csrf } });
    }
  });
});
