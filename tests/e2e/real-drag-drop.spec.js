import { test, expect } from '@playwright/test';

// Put the Templates rail beside the type pane.
//
// There is no "off" for a rail: one click on half of a pair gives the screen to
// the half you CLICKED (tabs.js#showPane). Clicking Dailies to "hide" it
// collapsed to Dailies ALONE and took the type pane - the drag source - off
// screen, so the drag waited out its timeout on a row that was in the DOM and
// not visible. Pair Templates, collapse onto it, then ask for the type back.
async function showTemplatesBesideType(page, typeSlug) {
  const T = page.locator('button[data-rail-toggle="template"]');
  if (!(await page.locator('#rail-template').isVisible())) {
    await T.click(); await page.waitForTimeout(700);
  }
  await T.click(); await page.waitForTimeout(700);
  await page.locator(`[data-tab="${typeSlug}"]`).first().click();
  await page.waitForTimeout(900);
}

/**
 * REAL drag and drop, driven with locator.dragTo() so the browser's own HTML5
 * drag machinery runs - synthetic DragEvents bypass it entirely and will happily
 * pass while the feature is broken for a person using the app.
 *
 * That is exactly what happened here. Every dragover was accepted
 * (defaultPrevented === true) and no `drop` ever fired, because the drag SOURCE
 * advertised effectAllowed='move' while the target asked for dropEffect='copy'.
 * Chromium treats that pair as incompatible and refuses the drop silently. The
 * sources now advertise 'copyMove'.
 */

test.describe.configure({ mode: 'serial' });

async function api(page, path, options={}) {
  return page.evaluate(async ({path,options,t}) => {
    const r = await fetch(path,{...options,headers:{'Content-Type':'application/json','X-CSRF-Token':t,...(options.headers||{})}});
    return {status:r.status, body: await r.json().catch(()=>null)};
  }, {path,options,t: await page.evaluate(()=>document.body.dataset.csrfToken)});
}
test('REAL drag: idea -> template actually nests', async ({ page }) => {
  await page.goto('/?tab=idea'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1800);
  const tpl  = (await api(page,'/api/entities/template',{method:'POST',body:JSON.stringify({title:'ZZZrd template'})})).body.data;
  const idea = (await api(page,'/api/entities/idea',{method:'POST',body:JSON.stringify({title:'ZZZrd idea'})})).body.data;
  await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(1800);

  await showTemplatesBesideType(page, 'idea');

  const src = page.locator('#ideaEntityList .entity-row', {hasText:'ZZZrd idea'}).first();
  const dst = page.locator('#templateEntityList .entity-row', {hasText:'ZZZrd template'}).first();
  // Both ends must be on screen: dragTo aims at the element's centre, and a row
  // scrolled out of the rail gives coordinates that land somewhere else.
  await dst.scrollIntoViewIfNeeded();
  await src.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await src.dragTo(dst);           // real HTML5 drag
  // Dropping into a template asks copy or reference; take reference, which is
  // what this case asserts (the ORIGINAL idea nested under the template).
  await expect(page.locator('#copyOrReferenceModal')).toBeVisible();
  await page.locator('#copyOrReferenceRefBtn').click();
  await page.waitForTimeout(2200);

  const rels = (await api(page,'/api/entities/template/relationships?kind=hierarchy')).body.data;
  const nested = rels.some(r => r.parent_entity_id === tpl.id && r.child_entity_id === idea.id);
  console.log('nested by real drag ->', nested);
  expect(nested).toBe(true);

  // and it shows up under the template in the tree
  await expect(page.locator('#templateEntityList .entity-row', {hasText:'ZZZrd idea'})).toHaveCount(1);

  await api(page,`/api/entities/template/${tpl.id}`,{method:'DELETE'});
  await api(page,`/api/entities/idea/${idea.id}`,{method:'DELETE'});
});

// LOCAL date, matching app.localISODate() (main.js) - UTC drifts a day off
// from the app's own "today" from mid-afternoon onward west of UTC.
const today = () => {
  const d = new Date();
  const p2 = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};
test('REAL drag: template -> a day', async ({ page }) => {
  await page.goto('/?tab=idea'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1800);
  const tpl = (await api(page,'/api/entities/template',{method:'POST',body:JSON.stringify({title:'ZZZt2d template'})})).body.data;
  await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(1800);

  // Dailies AND Templates both up: that is the combination where you drag one
  // into the other, and unlike Templates+type it is reached by simply asking
  // for each - neither click has to take the screen from the other here.
  if (!(await page.locator('#rail-daily').isVisible())) {
    await page.locator('button[data-rail-toggle="daily"]').click(); await page.waitForTimeout(700);
  }
  if (!(await page.locator('#rail-template').isVisible())) {
    await page.locator('button[data-rail-toggle="template"]').click(); await page.waitForTimeout(900);
  }

  // What was already on the day, so the teardown can tell the difference.
  const dailiesBeforeDrag = (await api(page,`/api/dailies/date/${today()}`)).body?.data || [];

  const src = page.locator('#templateEntityList .entity-row', {hasText:'ZZZt2d template'}).first();
  const dst = page.locator('#workItemsList');
  await src.dragTo(dst);
  await page.waitForTimeout(2000);

  const items = (await api(page,`/api/dailies/date/${today()}`)).body.data;
  console.log('day after real drag ->', JSON.stringify(items.map(w=>w.title)));
  expect(items.length).toBeGreaterThan(0);

  // Only the daily this drag produced. `for (const w of items)` deleted EVERY
  // daily on the day, whoever made it - it took a real record out of the
  // user's database on 2026-08-27. The drop instantiates the ZZZ-prefixed
  // template, so the row it creates carries that name; anything else on the
  // day belongs to someone else. See CLAUDE_PROJECT_TESTS.md: delete by id, never
  // by "everything that happens to be here".
  const before = new Set(dailiesBeforeDrag.map(w => String(w.id)));
  for (const w of items.filter(w => !before.has(String(w.id)))) {
    await api(page,`/api/dailies/${w.id}`,{method:'DELETE'});
    await api(page,`/api/trash/${w.id}`,{method:'DELETE'});
  }
  await api(page,`/api/entities/template/${tpl.id}`,{method:'DELETE'});
});

test('template with contents -> day, as independent copies', async ({ page }) => {
  await page.goto('/?tab=idea'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1800);
  const tpl  = (await api(page,'/api/entities/template',{method:'POST',body:JSON.stringify({title:'ZZZfull template'})})).body.data;
  const idea = (await api(page,'/api/entities/idea',{method:'POST',body:JSON.stringify({title:'ZZZfull idea'})})).body.data;
  const cat  = (await api(page,'/api/entities/category',{method:'POST',body:JSON.stringify({title:'ZZZfull category'})})).body.data;
  for (const c of [idea, cat]) {
    await api(page,`/api/entities/template/${tpl.id}/relationships`,{method:'POST',
      body:JSON.stringify({parentEntityId:tpl.id, childEntityId:c.id, relationshipKind:'hierarchy'})});
  }
  await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(1800);
  if (!(await page.locator('#rail-daily').isVisible())) { await page.locator('button[data-rail-toggle="daily"]').click(); await page.waitForTimeout(700); }
  if (!(await page.locator('#rail-template').isVisible())) { await page.locator('button[data-rail-toggle="template"]').click(); await page.waitForTimeout(900); }

  await page.locator('#templateEntityList .entity-row', {hasText:'ZZZfull template'}).first().dragTo(page.locator('#workItemsList'));
  await page.waitForTimeout(2200);

  const items = (await api(page,`/api/dailies/date/${today()}`)).body.data;
  const wi = items.find(w => w.title === 'ZZZfull template');
  expect(wi, 'work item created from the template').toBeTruthy();
  const gotIdea = (wi.ideas||[])[0], gotCat = (wi.categories||[])[0];
  console.log('on the day ->', JSON.stringify({ideas:(wi.ideas||[]).map(i=>i.title), areas:(wi.categories||[]).map(a=>a.name)}));

  expect(gotIdea, 'the template idea came across').toBeTruthy();
  expect(gotCat, 'the template category came across').toBeTruthy();
  // COPIES, not the originals - editing the day must not touch the template
  expect(gotIdea.id).not.toBe(idea.id);
  expect(gotCat.id).not.toBe(cat.id);
  // and the template still holds its originals
  const rels = (await api(page,'/api/entities/template/relationships?kind=hierarchy')).body.data;
  expect(rels.some(r=>r.parent_entity_id===tpl.id && r.child_entity_id===idea.id)).toBe(true);

  for (const w of items.filter(x=>(x.title||'').startsWith('ZZZfull'))) await api(page,`/api/dailies/${w.id}`,{method:'DELETE'});
  await api(page,`/api/entities/template/${tpl.id}`,{method:'DELETE'});
});
