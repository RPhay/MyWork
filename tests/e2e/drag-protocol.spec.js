import { test, expect } from '@playwright/test';

// The drag protocol is a set of globals shared across classic scripts; a page
// that drags but never loads dragDropUtils.js throws only when a drag starts,
// so assert the bindings resolve on each page that uses them.
for (const [name, url] of [['dashboard', '/'], ['settings', '/settings']]) {
  test(`${name}: drag protocol resolves, no console errors`, async ({ page }) => {
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    const resolved = await page.evaluate(() => ({
      DRAG_EFFECT_ALLOWED: typeof DRAG_EFFECT_ALLOWED,
      beginDrag: typeof beginDrag,
      acceptDrop: typeof acceptDrop,
      clearDropIndicators: typeof clearDropIndicators,
    }));
    expect(resolved).toEqual({
      DRAG_EFFECT_ALLOWED: 'string',
      beginDrag: 'function',
      acceptDrop: 'function',
      clearDropIndicators: 'function',
    });

    const real = errors.filter(e => !/favicon|net::ERR/i.test(e));
    expect(real, `console errors on ${name}: ${real.join(' | ')}`).toHaveLength(0);
  });
}
