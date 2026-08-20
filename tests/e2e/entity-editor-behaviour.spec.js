import { test, expect } from '@playwright/test';
const OUT='/private/tmp/claude-501/-Users-aslynn-git-github-MyWork/825c4ea0-f3d3-4db7-9c88-97ad8e82c12e/scratchpad';

for (const kind of ['item','folder']) {
  test(`creating a ${kind} keeps the editor open with it selected`, async ({ page }) => {
    await page.goto('/?tab=priority');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1400);

    await page.click(kind === 'folder' ? '#addpriorityFolderBtn' : '#addpriorityBtn');

    // Save must start disabled - nothing has changed yet
    await expect(page.locator('#prioritySaveBtn')).toBeDisabled();

    const ti = page.locator('#entity-editor-form input[name="title"]');
    await ti.fill(`ZZZ keep ${kind}`);
    await ti.dispatchEvent('input');
    await expect(page.locator('#prioritySaveBtn')).toBeEnabled();

    await page.click('#prioritySaveBtn');
    await page.waitForTimeout(1200);

    // Editor stays open, showing the item just created, and it is selected
    await expect(page.locator('#priorityEditorPane')).toBeVisible();
    await expect(page.locator('#entity-editor-form input[name="title"]')).toHaveValue(`ZZZ keep ${kind}`);
    const row = page.locator('.entity-row', {hasText:`ZZZ keep ${kind}`}).first();
    await expect(row).toHaveClass(/selected/);
    // and Save is disabled again - nothing changed since the save
    await expect(page.locator('#prioritySaveBtn')).toBeDisabled();

    await page.screenshot({path:`${OUT}/keepopen-${kind}.png`});

    await page.evaluate(async () => {
      const t=document.body.dataset.csrfToken;
      const all=(await (await fetch('/api/entities/priority')).json()).data||[];
      for (const e of all.filter(x=>(x.title||'').startsWith('ZZZ keep')))
        await fetch(`/api/entities/priority/${e.id}`,{method:'DELETE',headers:{'X-CSRF-Token':t}});
    });
  });
}

test('save stays disabled across reopening different items', async ({ page }) => {
  await page.goto('/?tab=priority');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1400);

  // Every tab's rows are in the DOM at once (dashboard.ejs renders all panes
  // upfront), so an unscoped .entity-row can pick a row from a hidden tab.
  const rows = page.locator('#tab-priority .entity-row:visible');
  await rows.first().click();
  await expect(page.locator('#prioritySaveBtn')).toBeDisabled();
  // make a change -> enabled
  const ti = page.locator('#entity-editor-form input[name="title"]');
  await ti.fill('temporary edit'); await ti.dispatchEvent('input');
  await expect(page.locator('#prioritySaveBtn')).toBeEnabled();
  // open a different item without saving -> must be disabled again
  await rows.nth(1).click();
  await expect(page.locator('#prioritySaveBtn')).toBeDisabled();
});

// The two column toggles are labelled once, by a legend above the switch
// columns rather than a pair of icons repeated on every field. A legend only
// works if each icon sits over the switch it labels, and that alignment is
// pure CSS - it silently broke three times while being changed by eye, because
// the legend and the field rows resolve their em units against different
// font-sizes. Measured, it cannot drift unnoticed again.
test('the column-toggle legend appears once and lines up with its switches', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // Must be an ITEM: a folder gets a title-only editor with no fields, so there
  // is no legend to align and this failed on a row that was never in scope.
  await page.locator('#ideaEntityList .entity-row:not([data-is-folder="1"])')
    .first().locator('.entity-cell-title').click();
  await expect(page.locator('.editor-field-legend')).toHaveCount(1);
  await expect(page.locator('.editor-field .editor-toggle-icon')).toHaveCount(0);

  const drift = await page.evaluate(() => {
    const centre = (el) => { const r = el.getBoundingClientRect(); return r.x + r.width / 2; };
    const icons = [...document.querySelectorAll('.editor-field-legend .editor-toggle-icon i')].map(centre);
    const switches = [...document.querySelector('.editor-field').querySelectorAll('.form-check-input')].map(centre);
    return icons.map((x, i) => Math.abs(x - (switches[i] ?? 0)));
  });

  expect(drift).toHaveLength(2);
  for (const d of drift) expect(d, 'legend icon sits over its switch').toBeLessThanOrEqual(4);
});
