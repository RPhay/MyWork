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
test('each field shows its name once, in the gutter, with labelled toggles', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // Must be an ITEM: a folder gets a title-only editor with no fields.
  await page.locator('#ideaEntityList .entity-row:not([data-is-folder="1"])')
    .first().locator('.entity-cell-title').click();
  await page.waitForTimeout(800);

  const fields = page.locator('#entity-editor-form .editor-field');
  await expect(fields).not.toHaveCount(0);

  // The name lives in the gutter and nowhere else. It used to appear above the
  // control as well, which read as a duplicate on any property named after its
  // type (Status, Priority).
  await expect(page.locator('#entity-editor-form .editor-field-name').first()).not.toBeEmpty();
  expect(await page.locator('#entity-editor-form .editor-field-body label').count(),
    'no field should caption itself above its control').toBe(0);
  expect(await page.locator('#entity-editor-form .editor-field-legend').count(),
    'the legend is replaced by per-toggle icons').toBe(0);

  // Each toggle carries its own icon, to the RIGHT of the switch, and the two
  // toggles sit one above the other beneath the name.
  const geom = await fields.first().evaluate((el) => {
    const box = (s) => { const n = el.querySelector(s); return n ? n.getBoundingClientRect() : null; };
    const toggles = [...el.querySelectorAll('.editor-field-toggle')].map(t => ({
      sw: t.querySelector('.form-check-input').getBoundingClientRect(),
      ic: t.querySelector('.editor-toggle-glyph')?.getBoundingClientRect() || null,
    }));
    return { name: box('.editor-field-name'), toggles: toggles.map(t => ({
      swRight: t.sw.right, swTop: t.sw.top, icLeft: t.ic?.left ?? null, icTop: t.ic?.top ?? null })) };
  });

  expect(geom.toggles.length, 'two toggles per field').toBe(2);
  for (const t of geom.toggles) {
    expect(t.icLeft, 'every toggle has an icon').not.toBeNull();
    expect(t.icLeft, 'icon sits to the RIGHT of its switch').toBeGreaterThanOrEqual(t.swRight - 1);
  }
  expect(geom.toggles[1].swTop, 'toggles stack vertically').toBeGreaterThan(geom.toggles[0].swTop);
  expect(geom.toggles[0].swTop, 'toggles sit below the name').toBeGreaterThanOrEqual(geom.name.top);

  // The drag bar spans the whole row and everything else is to its right - it
  // grips the row, so it is not a glyph parked beside the caption.
  const bar = await fields.first().evaluate((el) => {
    const row = el.getBoundingClientRect();
    const h = el.querySelector(':scope > .editor-field-handle').getBoundingClientRect();
    const others = [...el.children].filter(c => !c.classList.contains('editor-field-handle'))
      .map(c => c.getBoundingClientRect().left);
    return { rowH: row.height, rowTop: row.top, barH: h.height, barTop: h.top,
             barRight: h.right, minOtherLeft: Math.min(...others) };
  });
  // Tolerance of 3px: the bar stops inside the row's 1px border top and bottom,
  // which is what keeps its rounded corner flush with the row's own.
  expect(bar.barH, 'drag bar spans the row height').toBeGreaterThanOrEqual(bar.rowH - 3);
  expect(bar.minOtherLeft, 'everything else sits right of the bar').toBeGreaterThanOrEqual(bar.barRight - 1);
});
