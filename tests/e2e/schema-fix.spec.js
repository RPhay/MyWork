import { test, expect } from '@playwright/test';

/**
 * The three schema paths behind Settings > System Database:
 *   check   - what a healthy database should contain vs what it has
 *   update  - "Fix Schema": reconcile missing tables/columns/indexes
 *   migrate - bring an older database forward to the generic engine
 *
 * The check's expected-table list had gone stale, still naming tables the
 * generic-engine migration deliberately removed. It reported them missing on a
 * healthy database, and Fix Schema could never clear the warning because
 * nothing creates them any more - so a correct schema looked permanently
 * broken.
 */
test('all three schema paths still work', async ({ page }) => {
  await page.goto('/settings'); await page.waitForLoadState('networkidle');
  const call = async (path, method='GET') => page.evaluate(async ({path,method}) => {
    const t = document.body.dataset.csrfToken;
    const r = await fetch(path, {method, headers:{'Content-Type':'application/json','X-CSRF-Token':t}});
    return {status:r.status, body: await r.json().catch(()=>null)};
  }, {path,method});

  const check = await call('/api/system-database/schema/check');
  console.log('check   ->', check.status, JSON.stringify(check.body).slice(0,140));

  const update = await call('/api/system-database/schema/update','POST');
  console.log('update  ->', update.status, JSON.stringify(update.body).slice(0,140));

  const migrate = await call('/api/system-database/schema/analyze-and-migrate','POST');
  console.log('migrate ->', migrate.status, String(migrate.body?.success));

  expect(check.status).toBe(200);
  expect(update.status).toBe(200);
  expect(migrate.status).toBe(200);

  // A healthy database reports nothing missing. If this fails, either a table
  // really is missing or ALL_SYSTEM_TABLES names one that no longer exists.
  expect(check.body.data.missingTables, 'schema check should be clean').toEqual([]);
});
