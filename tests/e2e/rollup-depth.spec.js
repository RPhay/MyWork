import { test, expect } from '@playwright/test';
import { purgeByTitlePrefix } from './helpers/cleanup.js';

// A roll-up is over every DESCENDANT, not just direct children: a folder whose
// grandchild failed has a failure inside it, and must say so. Failed dominates
// every other state.

const TYPE = 'to_do';

async function api(page, url, opts = {}) {
  return page.evaluate(async ({ url, opts }) => {
    const res = await fetch(url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', 'CSRF-Token': window.APP_CONFIG?.csrfToken },
    });
    return res.json();
  }, { url, opts });
}

test.afterEach(async ({ page }) => { await purgeByTitlePrefix(page, TYPE, 'ZZZ'); });

// Nesting is a hierarchy RELATIONSHIP, not a parent_id column - passing
// parent_id on create is silently ignored, which made an earlier version of
// this test build three unrelated rows and blame the roll-up for the result.
async function nest(page, typeSlug, parentId, childId) {
  return api(page, `/api/entities/${typeSlug}/${childId}/relationships`, {
    method: 'POST',
    body: JSON.stringify({ parentEntityId: parentId, childEntityId: childId, relationshipKind: 'hierarchy' }),
  });
}

test('a failed grandchild makes the folder show failed', async ({ page }) => {
  await page.goto(`/?tab=${TYPE}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // folder > child (Complete) > grandchild (Failed)
  const folder = (await api(page, `/api/entities/${TYPE}`, { method: 'POST', body: JSON.stringify({ title: 'ZZZ roll folder', is_folder: true }) })).data;
  const child = (await api(page, `/api/entities/${TYPE}`, { method: 'POST', body: JSON.stringify({ title: 'ZZZ roll child', fields: { status: 'Complete' } }) })).data;
  const grand = (await api(page, `/api/entities/${TYPE}`, { method: 'POST', body: JSON.stringify({ title: 'ZZZ roll grandchild', fields: { status: 'Failed' } }) })).data;
  expect(folder?.id && child?.id && grand?.id, 'fixtures created').toBeTruthy();
  await nest(page, TYPE, folder.id, child.id);
  await nest(page, TYPE, child.id, grand.id);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Expand so the tree is built, then read what the FOLDER's status cell shows.
  await page.locator(`#expandAll${TYPE}Btn`).click().catch(() => {});
  await page.waitForTimeout(900);

  const shown = await page.locator(`#${TYPE}EntityList .entity-row[data-entity-id="${folder.id}"] .entity-cell[data-col="status"]`)
    .textContent();
  console.log('folder shows ->', JSON.stringify((shown || '').trim()));
  expect((shown || '').trim(), 'a failed grandchild must surface on the folder').toBe('Failed');
});

test('with no failure, a folder still reflects the deepest states', async ({ page }) => {
  await page.goto(`/?tab=${TYPE}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const folder = (await api(page, `/api/entities/${TYPE}`, { method: 'POST', body: JSON.stringify({ title: 'ZZZ ok folder', is_folder: true }) })).data;
  const child = (await api(page, `/api/entities/${TYPE}`, { method: 'POST', body: JSON.stringify({ title: 'ZZZ ok child', fields: { status: 'Complete' } }) })).data;
  const grand2 = (await api(page, `/api/entities/${TYPE}`, { method: 'POST', body: JSON.stringify({ title: 'ZZZ ok grandchild', fields: { status: 'Complete' } }) })).data;
  await nest(page, TYPE, folder.id, child.id);
  await nest(page, TYPE, child.id, grand2.id);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.locator(`#expandAll${TYPE}Btn`).click().catch(() => {});
  await page.waitForTimeout(900);

  const shown = (await page.locator(`#${TYPE}EntityList .entity-row[data-entity-id="${folder.id}"] .entity-cell[data-col="status"]`).textContent() || '').trim();
  console.log('all-complete folder shows ->', JSON.stringify(shown));
  expect(shown, 'everything complete at every depth rolls up to Complete').toBe('Complete');
});
