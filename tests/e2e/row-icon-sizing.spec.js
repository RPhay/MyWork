import { test, expect } from '@playwright/test';

// The delete button is the row's size reference. Everything else in the row is
// built to its box, and that had to be asserted rather than eyeballed: three
// separate attempts to enlarge these icons changed nothing at all, because the
// size token was declared in rem while every edit searched for a px value and
// reported success against a match it never made.

const TABS = ['priority', 'idea', 'to_do'];

async function api(page, path, options = {}) {
  return page.evaluate(async ({ path, options, t }) => {
    const r = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': t, ...(options.headers || {}) },
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, { path, options, t: await page.evaluate(() => document.body.dataset.csrfToken || '') });
}

test.describe('row control sizing', () => {
  // This spec measures a row, so it needs one to exist - and it used to just
  // assume the user had some. Projects emptied on 2026-08-27 (all 36 of its
  // rows turned out to be test residue) and both assertions here started
  // failing on a null row, reading exactly like a rendering defect. Sizing is
  // a property of the row, not of the user's data: make the row we measure.
  const created = [];

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto('/?tab=priority', { waitUntil: 'networkidle' });
    for (const tab of TABS) {
      const rows = (await api(page, `/api/entities/${tab}`)).body?.data || [];
      if (rows.some(r => !r.is_folder && !r.deleted_at)) continue;
      const made = (await api(page, `/api/entities/${tab}`, {
        method: 'POST', body: JSON.stringify({ title: `ZZZ row sizing ${tab}` }),
      })).body?.data;
      if (made?.id) created.push({ tab, id: made.id });
    }
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    // afterAll, not the end of a test body: tidying up on the last line leaks
    // every time an assertion fails earlier. And by ID - "delete anything
    // called ZZZ row sizing" is the same shape of mistake that hard-deleted a
    // real daily on 2026-08-27.
    if (!created.length) return;
    const page = await browser.newPage();
    await page.goto('/?tab=priority', { waitUntil: 'networkidle' });
    for (const { tab, id } of created) {
      // BOTH calls: /api/entities/:type/:id is a SOFT delete, and only
      // /api/trash/:id removes the row.
      await api(page, `/api/entities/${tab}/${id}`, { method: 'DELETE' });
      await api(page, `/api/trash/${id}`, { method: 'DELETE' });
    }
    await page.close();
  });

  for (const tab of TABS) {
    test(`${tab}: the priority meter is exactly the delete button's box`, async ({ page }) => {
      await page.goto(`/?tab=${tab}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      const m = await page.evaluate((t) => {
        const row = [...document.querySelectorAll(`#tab-${t} .entity-row`)]
          .find(r => r.getBoundingClientRect().width > 0 && r.querySelector('.priority-glyph'));
        if (!row) return null;
        const box = (sel) => {
          const el = row.querySelector(sel);
          if (!el) return null;
          const b = el.getBoundingClientRect();
          return { w: +b.width.toFixed(1), h: +b.height.toFixed(1) };
        };
        return { del: box('.entity-actions .btn'), pri: box('.priority-glyph'), icon: box('.entity-row-icon') };
      }, tab);

      expect(m, 'a row with a priority meter').not.toBeNull();
      expect(m.pri).toEqual(m.del);

      // The type icon fills the same control height, so nothing in the row
      // reads as a different size class from anything else.
      expect(Math.abs(m.icon.h - m.del.h), 'icon height matches the control').toBeLessThanOrEqual(1);
    });
  }

  // Row icons are the type's own emoji - the same one the tab bar shows. A
  // Project is a pushpin in the tab strip, so it is a pushpin in the row.
  test('a row icon is the same icon its tab shows', async ({ page }) => {
    await page.goto('/?tab=priority');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const tabIcon = (await page.locator('[data-tab="priority"] .tab-icon').first().textContent())?.trim();
    const rowIcon = await page.evaluate(() => {
      const row = [...document.querySelectorAll('#tab-priority .entity-row')]
        .find(r => r.getBoundingClientRect().width > 0 && r.dataset.isFolder === '0');
      return row?.querySelector('.entity-row-icon')?.textContent?.trim();
    });
    expect(rowIcon).toBe(tabIcon);
  });
});
