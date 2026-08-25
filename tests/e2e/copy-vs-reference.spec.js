import { test, expect } from '@playwright/test';

/**
 * Anywhere a row can be dropped into something that holds it - a day, or a
 * template - the drop asks whether it is a copy or a reference, because the two
 * behave differently ever after and the choice cannot be inferred:
 *
 *   reference -> the original itself is linked, so editing it here changes it
 *                everywhere it appears;
 *   copy      -> an independent clone of the row and everything nested in it.
 *
 * Each nested row carries a badge saying which it is, since that difference is
 * otherwise invisible and it decides whether an edit escapes.
 */

test.describe.configure({ mode: 'serial' });
async function api(page, path, options={}) {
  return page.evaluate(async ({path,options,t}) => {
    const r = await fetch(path,{...options,headers:{'Content-Type':'application/json','X-CSRF-Token':t,...(options.headers||{})}});
    return {status:r.status, body: await r.json().catch(()=>null)};
  }, {path,options,t: await page.evaluate(()=>document.body.dataset.csrfToken)});
}
async function showPanes(page) {
  if (await page.locator('#rail-daily').isVisible()) { await page.locator('button[data-rail-toggle="daily"]').click(); await page.waitForTimeout(600); }
  if (!(await page.locator('#rail-template').isVisible())) { await page.locator('button[data-rail-toggle="template"]').click(); await page.waitForTimeout(800); }
}

for (const mode of ['reference','copy']) {
  test(`dropping an idea into a template as a ${mode}`, async ({ page }) => {
    await page.goto('/?tab=idea'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1800);
    const tpl  = (await api(page,'/api/entities/template',{method:'POST',body:JSON.stringify({title:`ZZZcr2 ${mode} tpl`})})).body.data;
    const idea = (await api(page,'/api/entities/idea',{method:'POST',body:JSON.stringify({title:`ZZZcr2 ${mode} idea`})})).body.data;
    await page.evaluate((id)=>localStorage.setItem(`entity-expanded-${id}`,'true'), tpl.id);
    await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(1800);
    await showPanes(page);

    await page.locator('#ideaEntityList .entity-row', {hasText:`ZZZcr2 ${mode} idea`}).first()
      .dragTo(page.locator('#templateEntityList .entity-row', {hasText:`ZZZcr2 ${mode} tpl`}).first());

    // the question is asked
    await expect(page.locator('#copyOrReferenceModal')).toBeVisible();
    await page.locator(mode === 'copy' ? '#copyOrReferenceCopyBtn' : '#copyOrReferenceRefBtn').click();
    await page.waitForTimeout(1800);

    const contents = (await api(page,'/api/entities/template/contents')).body.data;
    const nested = contents.find(c => c.title === `ZZZcr2 ${mode} idea`);
    expect(nested, 'the idea should be inside the template').toBeTruthy();
    console.log(mode, '->', JSON.stringify({nestedId: nested.id, originalId: idea.id, is_copy: nested.is_copy}));

    if (mode === 'copy') {
      expect(nested.id).not.toBe(idea.id);
      expect(Boolean(nested.is_copy)).toBe(true);
    } else {
      expect(nested.id).toBe(idea.id);
      expect(Boolean(nested.is_copy)).toBe(false);
    }

    // the badge is rendered on the nested row
    const badge = await page.locator(`#templateEntityList .entity-row[data-entity-id="${nested.id}"] .entity-origin`).count();
    expect(badge, 'nested rows show a copy/reference badge').toBe(1);

    await api(page,`/api/entities/template/${tpl.id}`,{method:'DELETE'});
    await api(page,`/api/entities/idea/${idea.id}`,{method:'DELETE'}).catch(()=>{});
  });
}

test('a reference mirrors edits; a copy does not', async ({ page }) => {
  await page.goto('/?tab=idea'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1800);
  const tpl = (await api(page,'/api/entities/template',{method:'POST',body:JSON.stringify({title:'ZZZcr2 mirror tpl'})})).body.data;
  const ref = (await api(page,'/api/entities/idea',{method:'POST',body:JSON.stringify({title:'ZZZcr2 ref idea'})})).body.data;
  const src = (await api(page,'/api/entities/idea',{method:'POST',body:JSON.stringify({title:'ZZZcr2 src idea'})})).body.data;

  // reference: link the original itself
  await api(page,`/api/entities/template/${tpl.id}/relationships`,{method:'POST',
    body:JSON.stringify({parentEntityId:tpl.id, childEntityId:ref.id, relationshipKind:'hierarchy'})});
  // copy: clone, then link the clone
  const clone = (await api(page,`/api/entities/idea/${src.id}/clone`,{method:'POST'})).body.data;
  await api(page,`/api/entities/template/${tpl.id}/relationships`,{method:'POST',
    body:JSON.stringify({parentEntityId:tpl.id, childEntityId:clone.id, relationshipKind:'hierarchy'})});

  // Edit both through the template's copy of them
  await api(page,`/api/entities/idea/${ref.id}`,{method:'PUT',body:JSON.stringify({title:'ZZZcr2 ref EDITED'})});
  await api(page,`/api/entities/idea/${clone.id}`,{method:'PUT',body:JSON.stringify({title:'ZZZcr2 clone EDITED'})});

  const ideas = (await api(page,'/api/entities/idea')).body.data;
  const originalRef = ideas.find(i => i.id === ref.id);
  const originalSrc = ideas.find(i => i.id === src.id);
  console.log('mirror ->', JSON.stringify({ referenceNowReads: originalRef.title, copySourceStillReads: originalSrc.title }));

  expect(originalRef.title, 'a reference IS the original, so it changed').toBe('ZZZcr2 ref EDITED');
  expect(originalSrc.title, 'the copy is independent, so its source is untouched').toBe('ZZZcr2 src idea');

  await api(page,`/api/entities/template/${tpl.id}`,{method:'DELETE'});
  for (const id of [ref.id, src.id, clone.id]) await api(page,`/api/entities/idea/${id}`,{method:'DELETE'}).catch(()=>{});
});
