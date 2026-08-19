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

  const rows = page.locator('.entity-row');
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
