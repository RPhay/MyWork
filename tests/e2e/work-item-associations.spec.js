import { test, expect } from '@playwright/test';

/**
 * Work items associate with Areas, Goals and Ideas - which are `entities` now,
 * while work_items is still a legacy table, so the edges ride on the
 * legacy<->entity bridge junctions (see the "Legacy <-> entity association
 * bridge" block in mysqlSchema.js).
 *
 * These tabs shipped broken - every one of these endpoints 500'd with
 * "A required database table is missing" because the Phase 1-3 migrations
 * dropped the junction tables without updating their consumers. Nothing tested
 * associations, so it went unnoticed until it was spotted by eye in the UI.
 */

const PREFIX = 'ZZZ assoc';

async function csrf(page) {
  return page.evaluate(() => document.body.dataset.csrfToken);
}

async function api(page, path, options = {}) {
  return page.evaluate(
    async ({ path, options, token }) => {
      const r = await fetch(path, {
        ...options,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token, ...(options.headers || {}) },
      });
      return { status: r.status, body: await r.json().catch(() => null) };
    },
    { path, options, token: await csrf(page) }
  );
}

test.describe('Work item associations', () => {
  test.describe.configure({ mode: 'serial' });

  test.afterEach(async ({ page }) => {
    await page.goto('/');
    for (const slug of ['category', 'goal', 'idea']) {
      const { body } = await api(page, `/api/entities/${slug}`);
      for (const e of (body?.data || []).filter((x) => (x.title || '').startsWith(PREFIX))) {
        await api(page, `/api/entities/${slug}/${e.id}`, { method: 'DELETE' });
      }
    }
  });

  // The regression that was visible on screen: a red alert banner on every
  // page load. debug.spec.js only watches console/CSP errors and never sees
  // this, which is exactly how it was missed.
  test('dashboard loads with no error banner', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const alerts = await page.locator('.alert-danger, .alert-warning').allTextContents();
    const visible = alerts.map((t) => t.trim()).filter(Boolean);

    expect(visible.join(' | ')).not.toContain('required database table is missing');
    expect(visible).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('the endpoints that were 500ing all return 200', async ({ page }) => {
    await page.goto('/');
    const today = new Date().toISOString().slice(0, 10);
    const range = `startDate=2026-01-01&endDate=${today}`;

    for (const path of [
      `/api/work/date/${today}`,
      '/api/priorities',
      `/api/reporting/summary?${range}`,
      `/api/reporting/todos-ideas?${range}`,
      `/api/reporting/by-category?${range}`,
      '/api/work-item-templates',
    ]) {
      const { status, body } = await api(page, path);
      expect(status, `${path} should not error`).toBe(200);
      expect(body.success, `${path} -> ${body?.message}`).toBe(true);
    }
  });

  for (const { slug, label, key, labelField } of [
    { slug: 'category', label: 'areas', key: 'areas', labelField: 'name' },
    { slug: 'goal', label: 'goals', key: 'goals', labelField: 'name' },
    { slug: 'idea', label: 'ideas', key: 'ideas', labelField: 'title' },
  ]) {
    test(`a work item can be associated with a ${slug}, and it survives a reload`, async ({ page }) => {
      await page.goto('/');
      const today = new Date().toISOString().slice(0, 10);

      const entity = (await api(page, `/api/entities/${slug}`, {
        method: 'POST',
        body: JSON.stringify({ title: `${PREFIX} ${slug}` }),
      })).body.data;

      const workItem = (await api(page, '/api/work', {
        method: 'POST',
        body: JSON.stringify({ title: `${PREFIX} work item`, date: today }),
      })).body.data;

      const added = await api(page, `/api/work/${workItem.id}/${label}/${entity.id}`, { method: 'POST' });
      expect(added.status, `associating a ${slug} should succeed`).toBeLessThan(300);

      // Re-fetch: the association must come back attached to the work item,
      // under the property name the Dailies renderer reads.
      const { body } = await api(page, `/api/work/date/${today}`);
      const reloaded = body.data.find((w) => w.id === workItem.id);
      expect(reloaded[key]).toContainEqual(
        expect.objectContaining({ id: entity.id, [labelField]: `${PREFIX} ${slug}` })
      );

      // Deleting the entity must clear the association rather than orphan a
      // junction row - MSSQL declares that FK NO ACTION, so entityService
      // cleans it explicitly.
      await api(page, `/api/entities/${slug}/${entity.id}`, { method: 'DELETE' });
      const after = await api(page, `/api/work/date/${today}`);
      const afterItem = after.body.data.find((w) => w.id === workItem.id);
      expect(afterItem[key].some((x) => x.id === entity.id)).toBe(false);

      await api(page, `/api/work/${workItem.id}`, { method: 'DELETE' });
    });
  }
});
