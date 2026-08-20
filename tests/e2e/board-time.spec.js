import { test, expect } from '@playwright/test';
import { purgeByTitlePrefix } from './helpers/cleanup.js';

// Time worked against time planned, on the card. Neither number is new - the
// focus clock accumulates one, the Time Box field holds the other - but nothing
// showed them together, so "is this overrunning?" meant opening the record.

async function api(page, url, opts = {}) {
  return page.evaluate(async ({ url, opts }) => {
    const res = await fetch(url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', 'CSRF-Token': window.APP_CONFIG?.csrfToken },
    });
    return res.json();
  }, { url, opts });
}

test.afterEach(async ({ page }) => { await purgeByTitlePrefix(page, 'idea', 'ZZZ'); });

test('a card shows time worked against its time box, and flags an overrun', async ({ page }) => {
  await page.goto('/?tab=idea', { waitUntil: 'networkidle' });

  // Within its box: 30 minutes worked against an hour.
  const ok = (await api(page, '/api/entities/idea', {
    method: 'POST',
    body: JSON.stringify({ title: 'ZZZ within box', fields: { focus_seconds: 1800, time_box: '1h', board_bay: 'In Progress', board_order: 1 } }),
  })).data;
  // Over it: 90 minutes worked against 45.
  const over = (await api(page, '/api/entities/idea', {
    method: 'POST',
    body: JSON.stringify({ title: 'ZZZ over box', fields: { focus_seconds: 5400, time_box: '45m', board_bay: 'In Progress', board_order: 2 } }),
  })).data;

  await page.goto('/?tab=idea', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  if (!(await page.locator('#rail-priority-board.active').count())) {
    await page.locator('button[data-rail-toggle="priority-board"]').click();
  }
  await page.waitForTimeout(1600);

  const okCard = page.locator(`.board-card[data-entity-id="${ok.id}"] .board-card-time`);
  const overCard = page.locator(`.board-card[data-entity-id="${over.id}"] .board-card-time`);
  await expect(okCard).toHaveCount(1);
  await expect(overCard).toHaveCount(1);

  console.log('within ->', (await okCard.textContent()).trim());
  console.log('over   ->', (await overCard.textContent()).trim());

  await expect(okCard, 'worked against planned').toContainText('30m of 1h');
  await expect(overCard).toContainText('1h 30m of 45m');

  // Only the overrun is flagged - the rest is reference, not an alarm.
  await expect(okCard).not.toHaveClass(/over/);
  await expect(overCard, 'an overrun is called out').toHaveClass(/over/);
});

test('a card with neither number shows no time at all', async ({ page }) => {
  await page.goto('/?tab=idea', { waitUntil: 'networkidle' });
  const bare = (await api(page, '/api/entities/idea', {
    method: 'POST',
    body: JSON.stringify({ title: 'ZZZ no time', fields: { board_bay: 'In Progress', board_order: 9 } }),
  })).data;

  await page.goto('/?tab=idea', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  if (!(await page.locator('#rail-priority-board.active').count())) {
    await page.locator('button[data-rail-toggle="priority-board"]').click();
  }
  await page.waitForTimeout(1600);

  await expect(page.locator(`.board-card[data-entity-id="${bare.id}"]`)).toHaveCount(1);
  await expect(page.locator(`.board-card[data-entity-id="${bare.id}"] .board-card-time`),
    'nothing worked and nothing planned is not improved by "0h 0m of none"').toHaveCount(0);
});
