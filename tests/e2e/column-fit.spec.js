import { test, expect } from '@playwright/test';

/**
 * Columns are DROPPED when the pane is too narrow for them.
 *
 * Two rules were each right on their own and could not both hold once there
 * were more columns than width: columns never scroll horizontally, and text is
 * never truncated. Where they met, the loser was legibility - Goals rendered
 * `90px 4.39px 90px 88px 4.4px 120px 4.4px 4.4px 4.4px 78px`, several columns
 * collapsed to about four pixels with their content wrapping down the row.
 *
 * The rule that bends is "every column is always shown". Lowest-priority
 * columns are removed instead of being squeezed, from the right, then status,
 * and never the title. Nothing is lost: the values are still in the row editor
 * and widening the pane brings the columns straight back.
 */

const TYPE = 'goal';

const keptColumns = (page) => page
  .locator(`#tab-${TYPE} .entity-header-cell:not(.col-dropped)`)
  .evaluateAll(els => els.map(e => e.dataset.colKey));

async function openAt(page, width) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/?tab=${TYPE}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1600);
}

test('a wide pane shows every column', async ({ page }) => {
  await openAt(page, 1600);
  const kept = await keptColumns(page);
  expect(kept.length, 'nothing dropped when there is room').toBeGreaterThan(3);
  expect(kept[0]).toBe('title');
});

test('columns drop from the right as the pane narrows, title last of all', async ({ page }) => {
  await openAt(page, 1600);
  const wide = await keptColumns(page);

  await page.setViewportSize({ width: 900, height: 900 });
  await page.waitForTimeout(900);
  const medium = await keptColumns(page);

  await page.setViewportSize({ width: 520, height: 900 });
  await page.waitForTimeout(900);
  const narrow = await keptColumns(page);

  expect(medium.length, 'medium drops some').toBeLessThan(wide.length);
  expect(narrow.length, 'narrow drops more').toBeLessThan(medium.length);
  expect(narrow, 'title survives everything').toContain('title');

  // Dropping happens from the right, so what survives is always a subset of
  // what survived at the wider size - columns never reshuffle.
  expect(wide).toEqual(expect.arrayContaining(medium));
  expect(medium).toEqual(expect.arrayContaining(narrow));
});

test('status outlives the ordinary columns', async ({ page }) => {
  await openAt(page, 900);
  const kept = await keptColumns(page);
  // At this width the ordinary columns to its right are gone but status is not:
  // it is the one vocabulary shared by every type and what roll-ups read.
  expect(kept, 'status held while others went').toContain('status');
  expect(kept.length, 'but not everything survived').toBeLessThan(5);
});

test('no column is ever squeezed to a stub, and the list never scrolls sideways', async ({ page }) => {
  for (const width of [1600, 900, 700, 520]) {
    await openAt(page, width);

    const widths = await page
      .locator(`#tab-${TYPE} .entity-header-cell:not(.col-dropped)`)
      .evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().width)));

    expect(Math.min(...widths), `no four-pixel columns at ${width}px`).toBeGreaterThan(20);

    const overflow = await page.evaluate((type) => {
      const el = document.querySelector(`#tab-${type} .entity-list`);
      return el.scrollWidth - el.clientWidth;
    }, TYPE);
    expect(overflow, `no horizontal scroll at ${width}px`).toBeLessThanOrEqual(2);
  }
});
