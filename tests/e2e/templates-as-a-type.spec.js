import { test, expect } from '@playwright/test';

/**
 * Templates is a typed page like any other - same tree, same editor, same drag
 * and drop. Two things make it different, and BOTH are type configuration
 * rather than code:
 *
 *   1. its hierarchy rules name every editable type as an allowed child, so a
 *      template can hold ideas, categories, tickets... arranged however you like;
 *   2. supports_folders is off, because a template row is already the container
 *      and a folder inside one would be a pointless second layer.
 *
 * Getting here needed two real fixes: getRelationshipsForType required parent
 * and child to share a type, so cross-type children were created and then
 * filtered out of the very query the tree renders from; and the page only
 * fetched its own type's rows, so a nested row had nothing to render from.
 */
async function api(page, path, options={}) {
  return page.evaluate(async ({path,options,t}) => {
    const r = await fetch(path,{...options,headers:{'Content-Type':'application/json','X-CSRF-Token':t,...(options.headers||{})}});
    return {status:r.status, body: await r.json().catch(()=>null)};
  }, {path,options,t: await page.evaluate(()=>document.body.dataset.csrfToken)});
}
async function showTemplates(page) {
  if (!(await page.locator('#rail-template').isVisible())) {
    await page.locator('button[data-rail-toggle="template"]').click();
    await page.waitForTimeout(800);
  }
}

test('a template holds rows of other types, rendered with their own icons', async ({ page }) => {
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('/?tab=idea'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1600);

  const tpl  = (await api(page,'/api/entities/template',{method:'POST',body:JSON.stringify({title:'ZZZtm template'})})).body.data;
  const idea = (await api(page,'/api/entities/idea',{method:'POST',body:JSON.stringify({title:'ZZZtm idea'})})).body.data;
  const cat  = (await api(page,'/api/entities/area',{method:'POST',body:JSON.stringify({title:'ZZZtm category'})})).body.data;
  for (const child of [idea, cat]) {
    const r = await api(page,`/api/entities/template/${tpl.id}/relationships`,{method:'POST',
      body:JSON.stringify({parentEntityId:tpl.id, childEntityId:child.id, relationshipKind:'hierarchy'})});
    expect(r.status, 'a template should accept any type').toBeLessThan(300);
  }
  await page.evaluate((id)=>localStorage.setItem(`entity-expanded-${id}`,'true'), tpl.id);
  await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(1800);
  await showTemplates(page);

  const rows = await page.locator('#templateEntityList .entity-row').evaluateAll(els => els.map(e => ({
    id: e.dataset.entityId, text: e.innerText.split('\n')[0].trim(),
    icon: e.querySelector('.entity-row-icon')?.textContent?.trim() || '',
  })));
  console.log('all rows ->', JSON.stringify(rows));

  const byId = Object.fromEntries(rows.map(r=>[r.id, r]));
  expect(byId[String(idea.id)], 'the nested idea should render').toBeTruthy();
  expect(byId[String(cat.id)], 'the nested category should render').toBeTruthy();
  // each keeps its own type's icon rather than the template's
  expect(byId[String(idea.id)].icon).not.toBe(byId[String(tpl.id)].icon);
  expect(errs).toEqual([]);

  for (const id of [idea.id, cat.id]) await api(page,`/api/entities/idea/${id}`,{method:'DELETE'}).catch(()=>{});
  await api(page,`/api/entities/area/${cat.id}`,{method:'DELETE'}).catch(()=>{});
  await api(page,`/api/entities/template/${tpl.id}`,{method:'DELETE'});
});

test('Templates offers no folders; Ideas does', async ({ page }) => {
  await page.goto('/?tab=idea'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1600);
  await showTemplates(page);
  expect(await page.locator('#addtemplateFolderBtn').count(), 'templates should have no folder button').toBe(0);
  expect(await page.locator('#addideaFolderBtn').count(), 'ideas should still have one').toBe(1);
});
