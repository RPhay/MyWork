import { test, expect } from '@playwright/test';
async function api(page, path, options={}) {
  return page.evaluate(async ({path,options,t}) => {
    const r = await fetch(path,{...options,headers:{'Content-Type':'application/json','X-CSRF-Token':t,...(options.headers||{})}});
    return {status:r.status, body: await r.json().catch(()=>null)};
  }, {path,options,t: await page.evaluate(()=>document.body.dataset.csrfToken)});
}

test('an idea dropped onto a template nests inside it', async ({ page }) => {
  await page.goto('/?tab=idea'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1600);
  const tpl  = (await api(page,'/api/entities/template',{method:'POST',body:JSON.stringify({title:'ZZZx template'})})).body.data;
  const idea = (await api(page,'/api/entities/idea',{method:'POST',body:JSON.stringify({title:'ZZZx idea'})})).body.data;
  await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(1800);

  const railOpen = await page.locator('#rail-template').isVisible();
  if (!railOpen) { await page.locator('button[data-rail-toggle="template"]').click(); await page.waitForTimeout(800); }

  const res = await page.evaluate(({tplId, ideaId}) => {
    const row = [...document.querySelectorAll('#templateEntityList .entity-row')]
      .find(r => r.dataset.entityId === String(tplId));
    if (!row) return 'no template row';
    const dt = new DataTransfer();
    dt.setData('type','idea'); dt.setData('id',String(ideaId)); dt.setData('name','ZZZx idea');
    row.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));
    row.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));
    return 'ok';
  }, {tplId: tpl.id, ideaId: idea.id});
  await page.waitForTimeout(1600);

  const rels = (await api(page,'/api/entities/template/relationships?kind=hierarchy')).body.data;
  console.log('drop ->', res, JSON.stringify(rels));
  expect(rels.some(r => r.parent_entity_id === tpl.id && r.child_entity_id === idea.id)).toBe(true);

  await api(page,`/api/entities/template/${tpl.id}`,{method:'DELETE'});
  await api(page,`/api/entities/idea/${idea.id}`,{method:'DELETE'});
});
