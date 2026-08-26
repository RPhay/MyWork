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

// The threshold here matters. An earlier version of this test asserted only
// `> 20px` and passed while a real browser was rendering the priority column at
// 51px with titles wrapped over three lines - because `minmax(0, 1fr)` let the
// grid shrink a track below the minimum the fit pass believed it had. A stub
// test hides a stub column, so this asserts the REAL floor (FLEX_MIN_PX, 90)
// and, more tellingly, that rows stay one line high.
test('no column is squeezed below its floor, rows do not wrap, and nothing scrolls sideways', async ({ page }) => {
  for (const width of [1600, 900, 700, 520]) {
    await openAt(page, width);

    const widths = await page
      .locator(`#tab-${TYPE} .entity-header-cell:not(.col-dropped)`)
      .evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().width)));

    // 88px is the narrowest legitimate track (a measured status control); the
    // flexible floor is 90. Anything under 80 is a squeezed column.
    expect(Math.min(...widths), `no squeezed columns at ${width}px`).toBeGreaterThanOrEqual(80);

    // A wrapped title is the symptom the four-pixel columns produced. One line
    // is about 24px, so two lines is unmistakable.
    //
    // Asserted only while MORE THAN THE TITLE survives. Once the title is the
    // last column standing there is nothing left to drop, and wrapping is the
    // documented fallback - "long values wrap and the row grows taller" is the
    // original rule, and it still holds when the pane is genuinely too narrow
    // for one column. The bug this guards was wrapping while FIVE columns were
    // on screen, which is a fit failure, not a lack of room.
    const titleHeight = await page.evaluate((type) => {
      const cell = document.querySelector(`#tab-${type} .entity-tree .entity-cell-title`);
      return cell ? Math.round(cell.getBoundingClientRect().height) : null;
    }, TYPE);
    if (titleHeight !== null && widths.length > 1) {
      expect(titleHeight, `title stays on one line at ${width}px`).toBeLessThan(40);
    }

    const overflow = await page.evaluate((type) => {
      const el = document.querySelector(`#tab-${type} .entity-list`);
      return el.scrollWidth - el.clientWidth;
    }, TYPE);
    expect(overflow, `no horizontal scroll at ${width}px`).toBeLessThanOrEqual(2);
  }
});
