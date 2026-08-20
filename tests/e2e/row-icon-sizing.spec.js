import { test, expect } from '@playwright/test';

// The delete button is the row's size reference. Everything else in the row is
// built to its box, and that had to be asserted rather than eyeballed: three
// separate attempts to enlarge these icons changed nothing at all, because the
// size token was declared in rem while every edit searched for a px value and
// reported success against a match it never made.
test.describe('row control sizing', () => {
  for (const tab of ['priority', 'idea', 'to_do']) {
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
