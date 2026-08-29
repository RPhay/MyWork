import { test, expect } from '@playwright/test';
import { watchConsole } from './consoleErrors.js';

// The drag protocol is a set of globals shared across classic scripts; a page
// that drags but never loads dragDropUtils.js throws only when a drag starts,
// so assert the bindings resolve on each page that uses them.
for (const [name, url] of [['dashboard', '/'], ['settings', '/settings']]) {
  test(`${name}: drag protocol resolves, no console errors`, async ({ page }) => {
    const seen = watchConsole(page);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    const resolved = await page.evaluate(() => ({
      DRAG_EFFECT_ALLOWED: typeof DRAG_EFFECT_ALLOWED,
      beginDrag: typeof beginDrag,
      acceptDrop: typeof acceptDrop,
      clearDropIndicators: typeof clearDropIndicators,
      // Finding 05: the drop-zone geometry belongs with the protocol, not
      // copied into each surface.
      dropZone: typeof dropZone,
      showDropZone: typeof showDropZone,
    }));
    expect(resolved).toEqual({
      DRAG_EFFECT_ALLOWED: 'string',
      beginDrag: 'function',
      acceptDrop: 'function',
      clearDropIndicators: 'function',
      dropZone: 'function',
      showDropZone: 'function',
    });

    // Deliberately AFTER the assertion above: the globals do not come from the
    // network, so a CDN outage must not excuse them. Only the console claim
    // stands down, because an outage means the page's dependencies never
    // arrived and whatever it logged is not the app's doing.
    test.skip(seen.offline, `network unreachable: ${seen.requestFailures[0] ?? ''}`);
    expect(seen.real, `console errors on ${name}: ${seen.real.join(' | ')}`).toHaveLength(0);
  });
}
