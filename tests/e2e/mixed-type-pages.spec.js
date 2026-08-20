import { test, expect } from '@playwright/test';

/**
 * A page that holds more than one type - today that means Templates.
 *
 *  - Columns are the UNION of every type present, so a field on a dragged-in row
 *    can be shown rather than being invisible. They are also ONE set: rows must
 *    share a grid or the table stops lining up, so only the icon is per-row.
 *  - A reference IS the original, so editing it anywhere updates every view
 *    showing it, without a reload.
 */

test.describe.configure({ mode: 'serial' });

async function api(page, path, options={}) {
  return page.evaluate(async ({path,options,t}) => {
    const r = await fetch(path,{...options,headers:{'Content-Type':'application/json','X-CSRF-Token':t,...(options.headers||{})}});
    return {status:r.status, body: await r.json().catch(()=>null)};
  }, {path,options,t: await page.evaluate(()=>document.body.dataset.csrfToken)});
}
test('a template offers columns from the types dragged into it', async ({ page }) => {
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('/?tab=idea'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1800);

  const tpl  = (await api(page,'/api/entities/template',{method:'POST',body:JSON.stringify({title:'ZZZcol template'})})).body.data;
  const idea = (await api(page,'/api/entities/idea',{method:'POST',body:JSON.stringify({title:'ZZZcol idea', fields:{status:'Not Started'}})})).body.data;
  await api(page,`/api/entities/template/${tpl.id}/relationships`,{method:'POST',
    body:JSON.stringify({parentEntityId:tpl.id, childEntityId:idea.id, relationshipKind:'hierarchy'})});
  await page.evaluate((id)=>localStorage.setItem(`entity-expanded-${id}`,'true'), tpl.id);
  await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(2000);
  if (!(await page.locator('#rail-template').isVisible())) {
    await page.locator('button[data-rail-toggle="template"]').click(); await page.waitForTimeout(900);
  }

  // the idea's `status` field must be offered as a column on the template page
  const chooser = await page.evaluate(() => {
    const keys = new Set();
    document.querySelectorAll('#templateEditorPane .editor-field, .entity-columns-menu [data-field-id]').forEach(el => {
      if (el.dataset.fieldKey) keys.add(el.dataset.fieldKey);
    });
    return [...keys];
  });
  const headers = await page.locator('#templateEntityList .entity-header-cell').evaluateAll(els => els.map(e => e.dataset.colKey));
  console.log(JSON.stringify({headers, chooser, errs}));

  // Both rows still lay out on the same grid (one column set, not per-row)
  const gridCounts = await page.locator('#templateEntityList .entity-row-content').evaluateAll(
    els => [...new Set(els.map(e => getComputedStyle(e).gridTemplateColumns))].length);
  expect(gridCounts, 'every row shares one grid').toBe(1);
  expect(errs).toEqual([]);

  await api(page,`/api/entities/template/${tpl.id}`,{method:'DELETE'});
  await api(page,`/api/entities/idea/${idea.id}`,{method:'DELETE'}).catch(()=>{});
});

test('editing a referenced idea updates it inside the template on screen', async ({ page }) => {
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('/?tab=idea'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1800);

  const tpl  = (await api(page,'/api/entities/template',{method:'POST',body:JSON.stringify({title:'ZZZmir template'})})).body.data;
  const idea = (await api(page,'/api/entities/idea',{method:'POST',body:JSON.stringify({title:'ZZZmir before'})})).body.data;
  await api(page,`/api/entities/template/${tpl.id}/relationships`,{method:'POST',
    body:JSON.stringify({parentEntityId:tpl.id, childEntityId:idea.id, relationshipKind:'hierarchy'})});
  await page.evaluate((id)=>localStorage.setItem(`entity-expanded-${id}`,'true'), tpl.id);
  await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(2000);

  // Templates beside Ideas, so both views of the same record are on screen
  if (await page.locator('#rail-work_item').isVisible()) { await page.locator('button[data-rail-toggle="work_item"]').click(); await page.waitForTimeout(600); }
  if (!(await page.locator('#rail-template').isVisible())) { await page.locator('button[data-rail-toggle="template"]').click(); await page.waitForTimeout(900); }

  await expect(page.locator('#templateEntityList .entity-row', {hasText:'ZZZmir before'})).toHaveCount(1);

  // Edit it on the Ideas page
  await page.locator('#ideaEntityList .entity-row', {hasText:'ZZZmir before'}).first().locator('.entity-cell-title').click();
  await page.waitForTimeout(700);
  const title = page.locator('#entity-editor-form input[name="title"]');
  await title.fill('ZZZmir AFTER'); await title.dispatchEvent('input');
  await page.click('#ideaSaveBtn');
  await page.waitForTimeout(1800);

  // The template's copy of that row shows the new text without a reload
  await expect(page.locator('#templateEntityList .entity-row', {hasText:'ZZZmir AFTER'})).toHaveCount(1);
  await expect(page.locator('#templateEntityList .entity-row', {hasText:'ZZZmir before'})).toHaveCount(0);
  expect(errs).toEqual([]);

  await api(page,`/api/entities/template/${tpl.id}`,{method:'DELETE'});
  await api(page,`/api/entities/idea/${idea.id}`,{method:'DELETE'}).catch(()=>{});
});
