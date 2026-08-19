import { test, expect } from '@playwright/test';

/**
 * Settings > Entity Types is the control surface for the whole dashboard: which
 * type tabs exist, in what order, and with which fields. `is_visible` and
 * `order_index` on entity_types are single sources of truth - the dashboard
 * renders its tab bar straight from them, so this page and the tab bar are two
 * views of the same values rather than two copies.
 */

test('Entity Types is the default settings tab', async ({ page }) => {
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
  await expect(page.locator('#entity-types-tab')).toHaveClass(/active/);
  await expect(page.locator('#tab-entity-types')).toBeVisible();
});

test('types list has visibility toggles and drag handles', async ({ page }) => {
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('/settings?tab=entity-types');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  const toggles = await page.locator('#editableTypesList .type-visible-toggle').count();
  const handles = await page.locator('#editableTypesList .type-drag-handle').count();
  console.log(JSON.stringify({toggles, handles, errs}));
  expect(toggles).toBeGreaterThan(5);
  expect(handles).toBe(toggles);
  expect(errs).toEqual([]);
});

test('disabling a type removes its dashboard tab', async ({ page }) => {
  await page.goto('/settings?tab=entity-types');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const row = page.locator('#editableTypesList .type-list-item').filter({hasText:'Tickets'}).first();
  await row.locator('.type-visible-toggle').click();
  await page.waitForTimeout(900);

  await page.goto('/?tab=area'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1000);
  expect(await page.locator('button[data-tab="ticket"]').count()).toBe(0);

  // turn it back on
  await page.goto('/settings?tab=entity-types'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1500);
  await page.locator('#editableTypesList .type-list-item').filter({hasText:'Tickets'}).first().locator('.type-visible-toggle').click();
  await page.waitForTimeout(900);
  await page.goto('/'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1000);
  expect(await page.locator('button[data-tab="ticket"]').count()).toBe(1);
});

test('returning from settings restores the last dashboard tab', async ({ page }) => {
  await page.goto('/'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1200);
  await page.locator('button[data-tab="idea"]').click();
  await page.waitForTimeout(600);

  await page.locator('a[href="/settings"], a:has-text("Settings")').first().click().catch(async () => { await page.goto('/settings'); });
  await page.waitForLoadState('networkidle'); await page.waitForTimeout(1200);

  await page.locator('a:has-text("Back to Dashboard")').click();
  await page.waitForLoadState('networkidle'); await page.waitForTimeout(1400);

  await expect(page.locator('button[data-tab="idea"]')).toHaveClass(/active/);
});
test('reordering types in Settings changes the dashboard tab order', async ({ page }) => {
  await page.goto('/settings?tab=entity-types');
  await page.waitForLoadState('networkidle'); await page.waitForTimeout(1500);

  const ids = await page.locator('#editableTypesList .type-list-item[draggable="true"]').evaluateAll(els => els.map(e => Number(e.dataset.typeId)));
  const slugs = await page.evaluate(async () => (await (await fetch('/api/entity-types')).json()).data.map(t=>({id:t.id,slug:t.slug})));
  const byId = Object.fromEntries(slugs.map(s=>[s.id,s.slug]));
  console.log('BEFORE order:', ids.map(i=>byId[i]).join(','));

  // Move the last editable type to the front via the API the drop handler uses
  const moved = [ids[ids.length-1], ...ids.slice(0, ids.length-1)];
  const res = await page.evaluate(async ({orderedIds,t}) => {
    const r = await fetch('/api/entity-types/reorder',{method:'PATCH',
      headers:{'Content-Type':'application/json','X-CSRF-Token':t}, body: JSON.stringify({orderedIds})});
    return {status:r.status, body: await r.json()};
  }, {orderedIds: moved, t: await page.evaluate(()=>document.body.dataset.csrfToken)});
  expect(res.status).toBeLessThan(300);

  await page.goto('/'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1200);
  const tabOrder = await page.locator('#mainTabs button[data-tab]').evaluateAll(els => els.map(e=>e.dataset.tab));
  console.log('TAB order :', tabOrder.join(','));
  // the moved type should now precede the others (Dailies is pinned first)
  const movedSlug = byId[moved[0]];
  const others = moved.slice(1).map(i=>byId[i]).filter(s=>tabOrder.includes(s));
  expect(tabOrder.indexOf(movedSlug)).toBeLessThan(Math.max(...others.map(s=>tabOrder.indexOf(s))));

  // restore
  await page.evaluate(async ({orderedIds,t}) => fetch('/api/entity-types/reorder',{method:'PATCH',
    headers:{'Content-Type':'application/json','X-CSRF-Token':t}, body: JSON.stringify({orderedIds})}),
    {orderedIds: ids, t: await page.evaluate(()=>document.body.dataset.csrfToken)});
});
test('the type editor opens in a right-hand pane, not a modal', async ({ page }) => {
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('/settings'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1600);

  await expect(page.locator('#entityTypeEditorPane')).toBeHidden();

  await page.locator('#editableTypesList .type-list-item').filter({hasText:'Projects'}).first()
    .locator('.type-edit-btn').click();
  await page.waitForTimeout(1000);

  await expect(page.locator('#entityTypeEditorPane')).toBeVisible();
  await expect(page.locator('#entityTypeEditorTitle')).toContainText('Projects');
  await expect(page.locator('#entityTypeForm')).toBeVisible();
  // Save/Cancel/Delete live in the pane header, like the typed pages
  await expect(page.locator('#entityTypeEditorActions #entityTypeSaveBtn')).toBeVisible();
  // no floating modal
  expect(await page.locator('.draggable-modal, .modal.show').count()).toBe(0);
  const fields = await page.locator('#fieldsList .field-row').count();
  console.log(JSON.stringify({fieldRows: fields, errs}));
  expect(fields).toBe(4);

  await page.locator('#entityTypeCancelBtn').click();
  await page.waitForTimeout(500);
  await expect(page.locator('#entityTypeEditorPane')).toBeHidden();
  expect(errs).toEqual([]);
});
