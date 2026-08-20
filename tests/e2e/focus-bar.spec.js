import { test, expect } from '@playwright/test';

/**
 * The focus bar: the two or three things being worked on right now, pinned to
 * the top of every page, each with a RAG dot and a stop-the-clock timer.
 */

test.describe.configure({ mode: 'serial' });

async function api(page, path, options = {}) {
  return page.evaluate(async ({ path, options, t }) => {
    const r = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': t, ...(options.headers || {}) },
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, { path, options, t: await page.evaluate(() => document.body.dataset.csrfToken) });
}

// The bar is capped at three, so a run that dies before its cleanup leaves the
// next run unable to pin anything - which looks exactly like a broken feature.
// Every test starts from an empty bar and no stale rows of its own.
test.beforeEach(async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  await page.evaluate(async (t) => {
    const j = async (p, o) => (await fetch(p, {
      ...o, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': t, ...(o?.headers || {}) },
    })).json().catch(() => null);

    for (const item of ((await j('/api/focus'))?.data) || []) {
      await j(`/api/focus/${item.id}`, { method: 'DELETE' });
    }
    for (const e of ((await j('/api/entities/idea'))?.data) || []) {
      if ((e.title || '').startsWith('ZZZ')) await j(`/api/entities/idea/${e.id}`, { method: 'DELETE' });
    }
  }, await page.evaluate(() => document.body.dataset.csrfToken));
});

async function makeIdeas(page, titles) {
  const made = [];
  for (const title of titles) {
    made.push((await api(page, '/api/entities/idea', {
      method: 'POST', body: JSON.stringify({ title }),
    })).body.data);
  }
  return made;
}

async function cleanup(page, made) {
  for (const e of made) await api(page, `/api/entities/idea/${e.id}`, { method: 'DELETE' });
}

test('pinning from the row menu puts it on the bar with a RAG dot', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const made = await makeIdeas(page, ['ZZZ focus one']);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);

  const row = page.locator('#ideaEntityList .entity-row', { hasText: 'ZZZ focus one' }).first();
  await row.scrollIntoViewIfNeeded();
  await row.click({ button: 'right' });
  await page.locator('.entity-context-menu .context-menu-item', { hasText: 'Pin to focus bar' }).click();
  await page.waitForTimeout(900);

  const chip = page.locator(`#focusBar .focus-chip[data-entity-id="${made[0].id}"]`);
  await expect(chip).toBeVisible();
  await expect(chip.locator('.focus-rag')).toHaveCount(1);
  await expect(chip.locator('.focus-time')).toHaveText('0:00');

  await cleanup(page, made);
});

test('clicking a chip runs the clock and clicking again banks it', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const made = await makeIdeas(page, ['ZZZ focus timer']);
  await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: made[0].id }) });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);

  const chip = page.locator(`#focusBar .focus-chip[data-entity-id="${made[0].id}"]`);
  await expect(chip).toBeVisible();
  await expect(chip).not.toHaveClass(/running/);

  await chip.click();
  await expect(chip).toHaveClass(/running/);

  // The displayed time is derived from the server's start moment, so it ticks
  // without anything being written.
  await page.waitForTimeout(2500);
  await expect(chip.locator('.focus-time')).not.toHaveText('0:00');

  await chip.click();
  await expect(chip).not.toHaveClass(/running/);

  const stored = (await api(page, `/api/entities/idea/${made[0].id}`)).body.data;
  expect(Number(stored.fields.focus_seconds), 'time is banked on stop').toBeGreaterThan(0);
  expect(stored.fields.focus_started_at ?? null, 'the clock is cleared').toBeNull();

  await cleanup(page, made);
});

test('right-clicking a chip removes it from the bar', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const made = await makeIdeas(page, ['ZZZ focus remove']);
  await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: made[0].id }) });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);

  const chip = page.locator(`#focusBar .focus-chip[data-entity-id="${made[0].id}"]`);
  await expect(chip).toBeVisible();
  await chip.click({ button: 'right' });
  await page.locator('.focus-context-menu .context-menu-item').click();
  await page.waitForTimeout(900);

  await expect(chip).toHaveCount(0);

  // Removing from the bar does not touch the record.
  const still = (await api(page, `/api/entities/idea/${made[0].id}`)).body.data;
  expect(still.title).toBe('ZZZ focus remove');

  await cleanup(page, made);
});

test('the bar holds three and refuses a fourth', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const made = await makeIdeas(page, ['ZZZ cap 1', 'ZZZ cap 2', 'ZZZ cap 3', 'ZZZ cap 4']);
  for (const e of made.slice(0, 3)) {
    const r = await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: e.id }) });
    expect(r.status).toBe(200);
  }

  const fourth = await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: made[3].id }) });
  expect(fourth.status).toBeGreaterThanOrEqual(400);
  // It refuses rather than evicting - which of your three to drop is the
  // user's call, not the app's.
  expect(fourth.body.message).toMatch(/3 things|Remove one/i);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);
  await expect(page.locator('#focusBar .focus-chip')).toHaveCount(3);

  await cleanup(page, made);
});

test('only one clock runs at a time', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const made = await makeIdeas(page, ['ZZZ solo A', 'ZZZ solo B']);
  for (const e of made) {
    await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: e.id }) });
  }
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);

  const a = page.locator(`#focusBar .focus-chip[data-entity-id="${made[0].id}"]`);
  const b = page.locator(`#focusBar .focus-chip[data-entity-id="${made[1].id}"]`);

  await a.click();
  await expect(a).toHaveClass(/running/);

  await b.click();
  await expect(b).toHaveClass(/running/);
  await expect(a, 'starting one stops the other, or the totals mean nothing').not.toHaveClass(/running/);

  await cleanup(page, made);
});

test('an empty bar reveals itself as a drop target when a drag begins', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1600);

  // Hidden when empty, so it is not a permanent strip of chrome...
  await expect(page.locator('#focusBar')).toBeHidden();

  await page.evaluate(() => {
    const row = document.querySelector('#ideaEntityList .entity-row');
    row.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: new DataTransfer() }));
  });

  // ...and a landing strip the moment there is something to land.
  await expect(page.locator('#focusBar')).toBeVisible();
  await expect(page.locator('#focusBar')).toHaveClass(/drop-ready/);
});

test('a row dragged onto the bar is tracked, not copied or linked', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const made = await makeIdeas(page, ['ZZZ focus anchor', 'ZZZ focus drag']);
  // One already pinned, so the bar is on screen and dragTo can measure it. The
  // empty-bar case is the test above; this one is the drop itself.
  await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: made[0].id }) });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);

  const row = page.locator('#ideaEntityList .entity-row', { hasText: 'ZZZ focus drag' }).first();
  await row.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);

  // Real HTML5 drag. A synthetic DragEvent bypasses the browser's own
  // negotiation and would pass while the drop is silently refused.
  await row.dragTo(page.locator('#focusBar'));
  await page.waitForTimeout(1200);

  await expect(page.locator(`#focusBar .focus-chip[data-entity-id="${made[1].id}"]`)).toBeVisible();

  // Nothing was duplicated and no relationship was written - the bar shows the
  // record itself, for display and RAG only.
  const ideas = (await api(page, '/api/entities/idea')).body.data
    .filter(e => e.title === 'ZZZ focus drag');
  expect(ideas).toHaveLength(1);

  const rels = (await api(page, `/api/entities/idea/${made[1].id}/relationships`)).body.data || [];
  expect(rels, 'dropping on the bar creates no edge').toHaveLength(0);

  await cleanup(page, made);
});
