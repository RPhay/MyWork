import { test, expect } from '@playwright/test';

/**
 * Dailies and Templates are panes beside the current type tab, not pages. Two
 * show at a time, drawn from three participants in a fixed left-to-right order
 * - Dailies, Templates, the type tab:
 *
 *   Dailies + type      -> Dailies   | type
 *   Templates + type    -> Templates | type
 *   Dailies + Templates -> Dailies   | Templates   (the type is hidden)
 *
 * Each rail toggles independently; turning both on is what hides the type.
 */
async function state(page) {
  return page.evaluate(() => {
    const vis = (sel) => { const el=document.querySelector(sel); return !!el && el.offsetParent !== null; };
    const x = (sel) => { const el=document.querySelector(sel); return el ? Math.round(el.getBoundingClientRect().x) : null; };
    return {
      dailies: vis('#rail-daily'), templates: vis('#rail-template'),
      content: vis('#mainTabContent'),
      xd: x('#rail-daily'), xt: x('#rail-template'), xc: x('#mainTabContent'),
    };
  });
}
test('the three valid two-pane combinations', async ({ page }) => {
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('/?tab=category'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1600);

  const D = page.locator('button[data-rail-toggle="daily"]');
  const T = page.locator('button[data-rail-toggle="template"]');

  // Dailies + type
  let s = await state(page);
  console.log('dailies+type  ', JSON.stringify(s));
  expect(s.dailies && s.content && !s.templates).toBe(true);
  expect(s.xd).toBeLessThan(s.xc);

  // Dailies + Templates -> type hidden, Dailies left of Templates
  await T.click(); await page.waitForTimeout(600);
  s = await state(page);
  console.log('dailies+tpl   ', JSON.stringify(s));
  expect(s.dailies && s.templates && !s.content).toBe(true);
  expect(s.xd).toBeLessThan(s.xt);

  // Templates + type -> Templates left
  await D.click(); await page.waitForTimeout(600);
  s = await state(page);
  console.log('tpl+type      ', JSON.stringify(s));
  expect(s.templates && s.content && !s.dailies).toBe(true);
  expect(s.xt).toBeLessThan(s.xc);

  // Neither -> type takes the whole width
  await T.click(); await page.waitForTimeout(600);
  s = await state(page);
  console.log('type only     ', JSON.stringify(s));
  expect(s.content && !s.dailies && !s.templates).toBe(true);

  console.log(JSON.stringify({pageErrors:errs}));
  expect(errs).toEqual([]);
});

test('rail choices survive a reload', async ({ page }) => {
  await page.goto('/?tab=category'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1500);
  // Leave it on Templates + type
  await page.locator('button[data-rail-toggle="daily"]').click();
  await page.locator('button[data-rail-toggle="template"]').click();
  await page.waitForTimeout(500);

  await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(1500);
  await expect(page.locator('#rail-template')).toBeVisible();
  await expect(page.locator('#rail-daily')).toBeHidden();
  await expect(page.locator('#mainTabContent')).toBeVisible();
});
test('Dailies shows no column headers until the day has work', async ({ page }) => {
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('/?tab=category'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1800);

  const header = page.locator('.work-item-tree-header');
  await expect(header).toBeHidden();
  console.log('empty day ->', JSON.stringify({
    headerHidden: !(await header.isVisible()),
    emptyText: (await page.locator('#workItemsList').innerText()).slice(0, 60),
  }));

  // Add a work item for today, and the header appears
  const today = new Date().toISOString().slice(0,10);
  await page.evaluate(async ({today}) => {
    const t = document.body.dataset.csrfToken;
    await fetch('/api/dailies', {method:'POST', headers:{'Content-Type':'application/json','X-CSRF-Token':t},
      body: JSON.stringify({title:'ZZZ header probe', date: today})});
  }, {today});
  await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(1800);
  await expect(page.locator('.work-item-tree-header')).toBeVisible();
  console.log('with work ->', JSON.stringify({headerVisible: await page.locator('.work-item-tree-header').isVisible()}));

  await page.evaluate(async ({today}) => {
    const t = document.body.dataset.csrfToken;
    const all = (await (await fetch(`/api/dailies/date/${today}`)).json()).data || [];
    for (const w of all.filter(x=>(x.title||'').startsWith('ZZZ header probe')))
      await fetch(`/api/dailies/${w.id}`, {method:'DELETE', headers:{'X-CSRF-Token':t}});
  }, {today});
  expect(errs).toEqual([]);
});

test('no type tab is selected while both rails are up', async ({ page }) => {
  await page.goto('/?tab=category'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1600);
  const activeTypeTabs = () => page.locator('#mainTabs button[data-tab].active').count();

  expect(await activeTypeTabs()).toBe(1);

  // Both rails up: the type has nowhere to render, so nothing is current.
  await page.locator('button[data-rail-toggle="template"]').click();
  await page.waitForTimeout(600);
  expect(await activeTypeTabs()).toBe(0);

  // Asking for a type is a request to see it: the right-hand rail stands down.
  await page.locator('#mainTabs button[data-tab="category"]').click();
  await page.waitForTimeout(700);
  expect(await activeTypeTabs()).toBe(1);
  await expect(page.locator('#mainTabContent')).toBeVisible();
});
