import { test, expect } from '@playwright/test';

/**
 * Settings > System Database's analyze-and-migrate path builds the generic
 * tables from its OWN copy of the DDL, so anything added to the schema files
 * has to be added here too. It had drifted: no `is_visible`, a `field_type`
 * ENUM missing url/links/radio, a column named `generated` where the app writes
 * `is_generated`, and the legacy<->entity bridge junctions listed as obsolete
 * tables to migrate away from.
 */
test('the analyze-and-migrate path produces a schema the app can use', async ({ page }) => {
  await page.goto('/settings'); await page.waitForLoadState('networkidle');
  const res = await page.evaluate(async () => {
    const t = document.body.dataset.csrfToken;
    const r = await fetch('/api/system-database/schema/analyze-and-migrate', {
      method:'POST', headers:{'Content-Type':'application/json','X-CSRF-Token':t}});
    return {status:r.status, body: await r.json().catch(()=>null)};
  });
  console.log('migrate ->', res.status, JSON.stringify(res.body).slice(0,200));
  expect(res.status).toBeLessThan(500);

  // The columns the app depends on must exist afterwards.
  const check = await page.evaluate(async () => {
    const types = (await (await fetch('/api/entity-types')).json()).data;
    return { hasIsVisible: types.every(t => 'is_visible' in t), count: types.length };
  });
  console.log('after ->', JSON.stringify(check));
  expect(check.hasIsVisible).toBe(true);

  // And the app still works end to end.
  for (const p of ['/api/priorities','/api/entities/area','/api/work/date/'+new Date().toISOString().slice(0,10)]) {
    const s = await page.evaluate(async (p) => (await fetch(p)).status, p);
    expect(s, p).toBe(200);
  }
});
