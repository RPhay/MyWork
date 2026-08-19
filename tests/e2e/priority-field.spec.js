import { test, expect } from '@playwright/test';

/**
 * Every editable type carries a priority field, defined once in
 * systemEntityTypes.js. In a row it is a click-to-cycle icon rather than text -
 * and it renders even when UNSET, because the empty circle is the control you
 * click to set one. That ordering matters: the blank-value guard in the cell
 * renderer would otherwise swallow it and an unprioritised row would have
 * nothing to click.
 */
async function api(page, path, options={}) {
  return page.evaluate(async ({path,options,t}) => {
    const r = await fetch(path,{...options,headers:{'Content-Type':'application/json','X-CSRF-Token':t,...(options.headers||{})}});
    return {status:r.status, body: await r.json().catch(()=>null)};
  }, {path,options,t: await page.evaluate(()=>document.body.dataset.csrfToken)});
}
test('every editable type has a priority field', async ({ page }) => {
  await page.goto('/'); await page.waitForLoadState('networkidle');
  const types = (await api(page,'/api/entity-types')).body.data.filter(t => t.type_category === 'editable');
  const missing = types.filter(t => !(t.fields||[]).some(f => f.field_key === 'priority' && f.field_type === 'priority'));
  console.log('types without a priority field ->', missing.map(t=>t.slug));
  expect(missing).toEqual([]);
});

test('clicking the priority icon cycles it up the ladder', async ({ page }) => {
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('/?tab=idea'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1500);
  const idea = (await api(page,'/api/entities/idea',{method:'POST',body:JSON.stringify({title:'ZZZprio idea'})})).body.data;
  await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(1800);

  const cell = page.locator(`#ideaEntityList .entity-row[data-entity-id="${idea.id}"] .priority-cell`);
  await expect(cell).toHaveCount(1);
  const seen = [await cell.getAttribute('data-priority')];

  for (let i = 0; i < 4; i++) {
    await cell.click();
    await page.waitForTimeout(900);
    seen.push(await page.locator(`#ideaEntityList .entity-row[data-entity-id="${idea.id}"] .priority-cell`).getAttribute('data-priority'));
  }
  console.log('cycled ->', JSON.stringify(seen));
  expect(seen).toEqual(['', 'Low', 'Medium', 'High', 'Critical']);

  // and it persisted, not just changed on screen
  const stored = (await api(page,`/api/entities/idea/${idea.id}`)).body.data;
  expect(stored.fields.priority).toBe('Critical');
  expect(errs).toEqual([]);

  await api(page,`/api/entities/idea/${idea.id}`,{method:'DELETE'});
});

test('the editor shows the same icons, and choosing one saves', async ({ page }) => {
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('/?tab=idea'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1500);
  const idea = (await api(page,'/api/entities/idea',{method:'POST',body:JSON.stringify({title:'ZZZprio editor'})})).body.data;
  await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(1800);

  await page.locator(`#ideaEntityList .entity-row[data-entity-id="${idea.id}"] .entity-cell-title`).click();
  await page.waitForTimeout(800);

  // the whole ladder is shown, as icons, not a dropdown
  const options = page.locator('#entity-editor-form .priority-picker .priority-option');
  await expect(options).toHaveCount(5);
  expect(await page.locator('#entity-editor-form .priority-picker i.bi').count()).toBe(5);
  expect(await page.locator('#entity-editor-form select[name="priority"]').count(), 'no dropdown').toBe(0);

  await page.locator('.priority-option[data-priority-value="High"]').click();
  await expect(page.locator('.priority-option[data-priority-value="High"]')).toHaveClass(/selected/);
  await expect(page.locator('#ideaSaveBtn')).toBeEnabled();   // choosing marks the form dirty
  await page.click('#ideaSaveBtn');
  await page.waitForTimeout(1400);

  const stored = (await api(page,`/api/entities/idea/${idea.id}`)).body.data;
  console.log('editor saved ->', stored.fields.priority);
  expect(stored.fields.priority).toBe('High');
  expect(errs).toEqual([]);

  await api(page,`/api/entities/idea/${idea.id}`,{method:'DELETE'});
});
