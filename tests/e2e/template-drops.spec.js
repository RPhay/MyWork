import { test, expect } from '@playwright/test';

/**
 * Templates sit at both ends of a drag:
 *   typed row -> templates list   (empty space: makes a template from the row)
 *   typed row -> a template node  (links the row into that template)
 *   template  -> a day            (instantiates it as work)
 *
 * All three were broken. The templates container only accepted a drop that
 * landed on an existing .template-node, so with no templates there was no drop
 * target at all and dropping on empty space did nothing. And the template drag
 * published only `template-id` while Dailies reads `type`/`id`/`name`, so a
 * template dropped on a day was ignored.
 */
const today = () => new Date().toISOString().slice(0,10);
async function api(page, path, options={}) {
  return page.evaluate(async ({path,options,t}) => {
    const r = await fetch(path,{...options,headers:{'Content-Type':'application/json','X-CSRF-Token':t,...(options.headers||{})}});
    return {status:r.status, body: await r.json().catch(()=>null)};
  }, {path,options,t: await page.evaluate(()=>document.body.dataset.csrfToken)});
}

test('a typed row dropped on the templates list makes a template', async ({ page }) => {
  await page.goto('/?tab=area'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1600);
  // show the Templates rail
  await page.locator('button[data-rail-toggle="template"]').click(); await page.waitForTimeout(700);

  const area = (await api(page,'/api/entities/area',{method:'POST',body:JSON.stringify({title:'ZZZtpl source'})})).body.data;
  await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(1600);
  await page.locator('button[data-rail-toggle="template"]').click().catch(()=>{});
  await page.waitForTimeout(600);

  await page.evaluate(({id}) => {
    const dt = new DataTransfer();
    dt.setData('type','area'); dt.setData('id',String(id)); dt.setData('name','ZZZtpl source'); dt.setData('text/plain','ZZZtpl source');
    const list = document.getElementById('templatesList');
    list.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));
    list.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));
  }, {id: area.id});
  await page.waitForTimeout(1600);

  const tpls = (await api(page,'/api/work-item-templates')).body.data;
  console.log('templates ->', JSON.stringify(tpls.map(t=>({t:t.title, areas:(t.areas||[]).map(a=>a.name)}))));
  const made = tpls.find(t => t.title === 'ZZZtpl source');
  expect(made, 'a template should have been created').toBeTruthy();
  expect((made.areas||[]).some(a=>a.id===area.id)).toBe(true);
});

test('a template dropped on a day instantiates it', async ({ page }) => {
  await page.goto('/?tab=area'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1600);
  const tpls = (await api(page,'/api/work-item-templates')).body.data;
  const tpl = tpls.find(t => t.title === 'ZZZtpl source') || tpls[0];
  expect(tpl, 'need a template to drop').toBeTruthy();

  await page.evaluate(({id,title}) => {
    const dt = new DataTransfer();
    dt.setData('type','template'); dt.setData('id',String(id)); dt.setData('name',title); dt.setData('text/plain',title);
    document.getElementById('dailiesCenterPane').dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));
    document.getElementById('workItemsList').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));
  }, {id: tpl.id, title: tpl.title});
  await page.waitForTimeout(1800);

  const items = (await api(page,`/api/work/date/${today()}`)).body.data;
  console.log('day ->', JSON.stringify(items.map(w=>w.title)));
  expect(items.length, 'the template should have produced work').toBeGreaterThan(0);

  for (const w of items) await api(page,`/api/work/${w.id}`,{method:'DELETE'});
  for (const t of (await api(page,'/api/work-item-templates')).body.data.filter(x=>(x.title||'').startsWith('ZZZtpl')))
    await api(page,`/api/work-item-templates/${t.id}`,{method:'DELETE'});
  for (const a of (await api(page,'/api/entities/area')).body.data.filter(x=>(x.title||'').startsWith('ZZZtpl')))
    await api(page,`/api/entities/area/${a.id}`,{method:'DELETE'});
});

test('a typed row dropped onto an existing template links to it', async ({ page }) => {
  await page.goto('/?tab=area'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1600);
  const tpl = (await api(page,'/api/work-item-templates',{method:'POST',body:JSON.stringify({title:'ZZZtpl target'})})).body.data;
  const area = (await api(page,'/api/entities/area',{method:'POST',body:JSON.stringify({title:'ZZZtpl child'})})).body.data;

  // The rail renders its list on load, so the new template has to exist first.
  await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(1600);
  const railOpen = await page.locator('#rail-template').isVisible();
  if (!railOpen) { await page.locator('button[data-rail-toggle="template"]').click(); await page.waitForTimeout(900); }

  const linked = await page.evaluate(({tplId, areaId}) => {
    const node = [...document.querySelectorAll('.template-node')].find(n => n.dataset.templateId === String(tplId));
    if (!node) return 'no node';
    const dt = new DataTransfer();
    dt.setData('type','area'); dt.setData('id',String(areaId)); dt.setData('name','ZZZtpl child');
    node.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));
    node.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));
    return 'dispatched';
  }, {tplId: tpl.id, areaId: area.id});
  await page.waitForTimeout(1600);

  const after = (await api(page,`/api/work-item-templates/${tpl.id}`)).body.data;
  console.log('onto node ->', linked, JSON.stringify((after.areas||[]).map(a=>a.name)));
  expect((after.areas||[]).some(a=>a.id===area.id)).toBe(true);

  await api(page,`/api/work-item-templates/${tpl.id}`,{method:'DELETE'});
  await api(page,`/api/entities/area/${area.id}`,{method:'DELETE'});
});
