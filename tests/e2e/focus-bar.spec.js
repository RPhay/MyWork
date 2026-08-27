import { test, expect } from '@playwright/test';
import { dblclick } from './dblclick.js';

/**
 * The focus bar: what is being worked on right now, pinned inside the navbar at
 * the top of every page, each with its type's icon and a stop-the-clock timer.
 * There
 * is no limit on how many can be pinned.
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

// A run that dies before its cleanup leaves the
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
    // Every test starts with no labels/layout left over from a prior one.
    // `count` isn't part of this any more - it's derived from what's pinned
    // above, which this loop already just cleared to zero.
    await j('/api/focus-monitors', {
      method: 'PUT',
      body: JSON.stringify({
        showNumbers: false,
        monitors: Array.from({ length: 6 }, () => ({ label: '', layout: 'side-by-side' })),
      }),
    });
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

test('pinning from the row menu puts it on the bar with its type icon', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const made = await makeIdeas(page, ['ZZZ focus one']);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);

  const row = page.locator('#ideaEntityList .entity-row', { hasText: 'ZZZ focus one' }).first();
  await row.scrollIntoViewIfNeeded();
  // The TITLE, not the row's centre: a right-click on a value cell (status,
  // priority, checkbox) now offers that cell's values instead of the row menu,
  // and the centre of a row is usually one of those cells.
  await row.locator('.entity-cell-title').click({ button: 'right' });
  await page.locator('.entity-context-menu .context-menu-item', { hasText: 'Pin to focus bar' }).click();
  await page.waitForTimeout(900);

  const chip = page.locator(`#focusBar .focus-chip[data-entity-id="${made[0].id}"]`);
  await expect(chip).toBeVisible();
  // The chip shows the TYPE's emoji. It used to carry a RAG dot as well, which
  // was never asked for; the RAG still reaches the user through the tooltip.
  await expect(chip.locator('.focus-rag')).toHaveCount(0);
  await expect(chip.locator('.focus-icon')).toHaveCount(1);
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

  await chip.locator('.focus-time').click();
  await expect(chip).toHaveClass(/running/);

  // The displayed time is derived from the server's start moment, so it ticks
  // without anything being written.
  await page.waitForTimeout(2500);
  await expect(chip.locator('.focus-time')).not.toHaveText('0:00');

  await chip.locator('.focus-time').click();
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
  await page.locator('.focus-context-menu .context-menu-item', { hasText: 'Remove from focus bar' }).click();
  await page.waitForTimeout(900);

  await expect(chip).toHaveCount(0);

  // Removing from the bar does not touch the record.
  const still = (await api(page, `/api/entities/idea/${made[0].id}`)).body.data;
  expect(still.title).toBe('ZZZ focus remove');

  await cleanup(page, made);
});

// There is no cap any more. It used to refuse a fourth, on the argument that a
// list of everything you are focused on is a list of nothing - but how many
// things to track is the user's call, not the app's.
test('the bar takes as many as you pin, past the old limit of three', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const titles = ['ZZZ cap 1', 'ZZZ cap 2', 'ZZZ cap 3', 'ZZZ cap 4', 'ZZZ cap 5', 'ZZZ cap 6'];
  const made = await makeIdeas(page, titles);
  for (const e of made) {
    const r = await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: e.id }) });
    expect(r.status, `pinning ${e.title} should be accepted`).toBe(200);
  }

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  await expect(page.locator('#focusBar .focus-chip')).toHaveCount(titles.length);

  // Every pin gets its own slot within its monitor - no two share one. All of
  // these land on the default single monitor, so bar-wide uniqueness holds
  // here too.
  const slots = (await api(page, '/api/focus')).body.data.map(i => i.slot);
  expect(new Set(slots).size, 'slots are unique').toBe(slots.length);

  await cleanup(page, made);
});

// It lives in the navbar, between the brand and the context switcher.
test('the focus bar sits in the navbar, between the brand and the context', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const made = await makeIdeas(page, ['ZZZ place 1']);
  await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: made[0].id }) });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  const where = await page.evaluate(() => {
    const bar = document.getElementById('focusBar');
    const brand = document.querySelector('.navbar-brand');
    const ctx = document.getElementById('contextSwitcher');
    const r = (el) => el.getBoundingClientRect();
    return {
      insideNavbar: !!bar.closest('nav.navbar'),
      barLeft: r(bar).left, brandRight: r(brand).right, ctxLeft: r(ctx).left,
    };
  });
  expect(where.insideNavbar, 'the bar is inside the navbar').toBe(true);
  expect(where.barLeft, 'to the right of the brand').toBeGreaterThanOrEqual(where.brandRight);
  expect(where.barLeft, 'to the left of the context switcher').toBeLessThan(where.ctxLeft);

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

  await a.locator('.focus-time').click();
  await expect(a).toHaveClass(/running/);

  await b.locator('.focus-time').click();
  await expect(b).toHaveClass(/running/);
  await expect(a, 'starting one stops the other, or the totals mean nothing').not.toHaveClass(/running/);

  await cleanup(page, made);
});

test('the bar is hidden with nothing pinned, and appears the moment something is', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1600);

  // A monitor is exactly as real as what's pinned to it - nothing pinned
  // anywhere means no monitor exists, and the bar takes no space at all.
  await expect(page.locator('#focusBar')).toBeHidden();
  await expect(page.locator('#focusBar .focus-monitor')).toHaveCount(0);

  const made = await makeIdeas(page, ['ZZZ appears on pin']);
  await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: made[0].id }) });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);

  await expect(page.locator('#focusBar')).toBeVisible();
  await expect(page.locator('#focusBar .focus-monitor')).toHaveCount(1);

  await page.evaluate(() => {
    const zone = document.querySelector('#focusBar .focus-monitor');
    zone.dispatchEvent(new DragEvent('dragover', {
      bubbles: true, cancelable: true, dataTransfer: new DataTransfer(),
    }));
  });

  await expect(page.locator('#focusBar .focus-monitor').first()).toHaveClass(/drop-target/);

  await cleanup(page, made);
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

// Pinned items can be rearranged by dragging a chip along the bar, and each
// chip carries its type's own emoji - the same one the tab and its rows show.
test('chips can be dragged left and right to reorder, and show their type icon', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const made = await makeIdeas(page, ['ZZZ ord A', 'ZZZ ord B', 'ZZZ ord C']);
  for (const e of made) {
    await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: e.id }) });
  }
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  const titles = () => page.locator('#focusBar .focus-chip .focus-title').allTextContents();
  expect(await titles()).toEqual(['ZZZ ord A', 'ZZZ ord B', 'ZZZ ord C']);

  // Every chip shows the type's emoji.
  const icons = await page.locator('#focusBar .focus-chip .focus-icon').allTextContents();
  console.log('chip icons ->', JSON.stringify(icons));
  expect(icons.every(i => i.trim().length > 0), 'each chip carries its type icon').toBe(true);

  // Drag the last chip onto the left half of the first - it should land first.
  await page.evaluate(() => {
    const chips = [...document.querySelectorAll('#focusBar .focus-chip')];
    const src = chips[chips.length - 1], dst = chips[0];
    const dt = new DataTransfer();
    const fire = (el, name, x) => el.dispatchEvent(new DragEvent(name, {
      bubbles: true, cancelable: true, dataTransfer: dt, clientX: x,
      clientY: el.getBoundingClientRect().top + 5,
    }));
    const r = dst.getBoundingClientRect();
    fire(src, 'dragstart', src.getBoundingClientRect().left + 5);
    fire(dst, 'dragover', r.left + 2);
    fire(dst, 'drop', r.left + 2);
    fire(src, 'dragend', r.left + 2);
  });
  await page.waitForTimeout(1600);

  const after = await titles();
  console.log('after reorder ->', JSON.stringify(after));
  expect(after, 'the dragged chip moves to the front').toEqual(['ZZZ ord C', 'ZZZ ord A', 'ZZZ ord B']);

  // And it survives a reload - the order is stored, not just painted.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  expect(await titles(), 'the new order persists').toEqual(['ZZZ ord C', 'ZZZ ord A', 'ZZZ ord B']);

  await cleanup(page, made);
});

// Right-click offers a background colour for the chip, stored on the record so
// it survives a reload. Removing is on the same menu.
test('a chip can be given a background colour that persists', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const made = await makeIdeas(page, ['ZZZ colour me']);
  await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: made[0].id }) });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  const chip = page.locator(`#focusBar .focus-chip[data-entity-id="${made[0].id}"]`);
  await chip.click({ button: 'right' });
  await page.waitForTimeout(400);

  const swatches = page.locator('.focus-context-menu .focus-swatch');
  await expect(swatches, 'the menu offers colours').not.toHaveCount(0);
  await expect(page.locator('.focus-context-menu .context-menu-item', { hasText: 'Remove from focus bar' }))
    .toHaveCount(1);

  await swatches.nth(4).click();      // a non-white swatch
  await page.waitForTimeout(1300);

  const painted = await chip.evaluate(el => getComputedStyle(el).backgroundColor);
  console.log('chip background ->', painted);
  expect(painted, 'the chip takes the chosen colour').not.toBe('rgb(255, 255, 255)');

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  const after = await page.locator(`#focusBar .focus-chip[data-entity-id="${made[0].id}"]`)
    .evaluate(el => getComputedStyle(el).backgroundColor);
  expect(after, 'the colour survives a reload').toBe(painted);

  await cleanup(page, made);
});

// Only the clock is a control: clicking the chip elsewhere must not start timing.
test('clicking the chip body does not start the clock', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const made = await makeIdeas(page, ['ZZZ no autostart']);
  await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: made[0].id }) });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  const chip = page.locator(`#focusBar .focus-chip[data-entity-id="${made[0].id}"]`);
  await chip.locator('.focus-title').click();
  await page.waitForTimeout(900);

  const running = (await api(page, '/api/focus')).body.data.find(i => String(i.id) === String(made[0].id))?.running;
  expect(running, 'clicking the title must not start the clock').toBeFalsy();

  await cleanup(page, made);
});

// The bar re-reads from the server on a timer and rebuilds every chip. A
// refresh landing mid-drag used to delete the element under the cursor, so the
// gesture died and the item looked like it had vanished. Redraws are held until
// the drag finishes.
test('a refresh landing mid-drag does not delete the chip does not delete the chip', async ({ page }) => {
  await page.goto('/?tab=idea', { waitUntil: 'networkidle' });
  const made = await page.evaluate(async () => {
    const csrf = window.APP_CONFIG?.csrfToken; const out = [];
    for (const t of ['ZZZg1', 'ZZZg2', 'ZZZg3']) {
      const r = await (await fetch('/api/entities/idea', { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CSRF-Token': csrf },
        body: JSON.stringify({ title: t }) })).json();
      await fetch('/api/focus', { method: 'POST', headers: { 'Content-Type': 'application/json', 'CSRF-Token': csrf },
        body: JSON.stringify({ entityId: r.data.id }) });
      out.push(r.data.id);
    }
    return out;
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  // Start a drag, force the periodic refresh mid-gesture, then finish the drop.
  const result = await page.evaluate(async () => {
    const chips = () => [...document.querySelectorAll('#focusBar .focus-chip')];
    const src = chips()[2], dst = chips()[0];
    const dt = new DataTransfer();
    const fire = (el, name, x) => el.dispatchEvent(new DragEvent(name, {
      bubbles: true, cancelable: true, dataTransfer: dt, clientX: x,
      clientY: el.getBoundingClientRect().top + 5 }));

    fire(src, 'dragstart', src.getBoundingClientRect().left + 5);
    await window.FocusBar.refresh();                 // the timer, mid-drag
    const survived = document.body.contains(src);
    const r = dst.getBoundingClientRect();
    fire(dst, 'dragover', r.left + 2);
    fire(dst, 'drop', r.left + 2);
    fire(src, 'dragend', r.left + 2);
    return { survived };
  });
  console.log('dragged chip survived the mid-drag refresh:', result.survived);
  expect(result.survived, 'the element being dragged must not be destroyed').toBe(true);

  await page.waitForTimeout(1500);
  const titles = await page.locator('#focusBar .focus-chip .focus-title').allTextContents();
  console.log('order after ->', JSON.stringify(titles));
  expect(titles.length, 'nothing vanished').toBe(3);

  await page.evaluate(async (ids) => {
    const csrf = window.APP_CONFIG?.csrfToken;
    for (const id of ids) {
      await fetch(`/api/focus/${id}`, { method: 'DELETE', headers: { 'CSRF-Token': csrf } });
      await fetch(`/api/entities/idea/${id}`, { method: 'DELETE', headers: { 'CSRF-Token': csrf } });
      await fetch(`/api/trash/${id}`, { method: 'DELETE', headers: { 'CSRF-Token': csrf } });
    }
  }, made);
});

// Two clicks on a chip goes to the record: its own page, that row highlighted,
// its editor open. It reuses what already exists - `focus` for the highlight,
// the remembered-editor key for the editor - rather than a second way in.
test('double-clicking a chip opens its record on its own page', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const made = await makeIdeas(page, ['ZZZ jump to me']);
  await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: made[0].id }) });
  await page.goto('/?tab=priority', { waitUntil: 'networkidle' });   // somewhere else entirely
  await page.waitForTimeout(1600);

  await dblclick(page.locator(`#focusBar .focus-chip[data-entity-id="${made[0].id}"]`));
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2200);

  expect(page.url(), 'it lands on the record\'s own tab').toContain('tab=idea');
  await expect(page.locator('#tab-idea')).toHaveClass(/active/);
  await expect(page.locator('#entity-editor-form input[name="title"]'),
    'with the record open in the editor').toHaveValue('ZZZ jump to me');

  await cleanup(page, made);
});

// ===== Monitors =====

test('items can be pinned to a specific monitor, and moved to another via the API the drag uses', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const made = await makeIdeas(page, ['ZZZ mon A', 'ZZZ mon B']);
  await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: made[0].id, monitor: 1 }) });
  await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: made[1].id, monitor: 2 }) });

  const focus = (await api(page, '/api/focus')).body.data;
  expect(focus.find(i => i.id === made[0].id).monitor).toBe(1);
  expect(focus.find(i => i.id === made[1].id).monitor).toBe(2);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  // count is derived from what's pinned - 2, not some pre-configured number -
  // so monitor 3 does not exist yet, only 1 and 2 do.
  await expect(page.locator('#focusBar .focus-monitor')).toHaveCount(2);
  await expect(page.locator('#focusBar .focus-monitor[data-monitor="1"] .focus-chip')).toHaveCount(1);
  await expect(page.locator('#focusBar .focus-monitor[data-monitor="2"] .focus-chip')).toHaveCount(1);

  // The endpoint a cross-monitor drag calls: move item A from monitor 1 to 3.
  await api(page, `/api/focus/${made[0].id}/monitor`, { method: 'PATCH', body: JSON.stringify({ monitor: 3 }) });
  const after = (await api(page, '/api/focus')).body.data;
  expect(after.find(i => i.id === made[0].id).monitor).toBe(3);

  await cleanup(page, made);
});

test('monitor numbers show only when enabled in settings', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // Two real monitors, so there is something for the numbers to label.
  const made = await makeIdeas(page, ['ZZZ nums A', 'ZZZ nums B']);
  await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: made[0].id, monitor: 1 }) });
  await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: made[1].id, monitor: 2 }) });

  await api(page, '/api/focus-monitors', { method: 'PUT', body: JSON.stringify({ showNumbers: false }) });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);
  await expect(page.locator('#focusBar .focus-monitor-number')).toHaveCount(0);

  await api(page, '/api/focus-monitors', { method: 'PUT', body: JSON.stringify({ showNumbers: true }) });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);
  await expect(page.locator('#focusBar .focus-monitor-number')).toHaveCount(2);

  await cleanup(page, made);
});

test('a stacked monitor shows only the top item until hovered, with no arrow to click', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  await api(page, '/api/focus-monitors', {
    method: 'PUT',
    body: JSON.stringify({ count: 1, monitors: [{ label: '', layout: 'stacked' }] }),
  });

  const made = await makeIdeas(page, ['ZZZ stack A', 'ZZZ stack B']);
  for (const e of made) {
    await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: e.id, monitor: 1 }) });
  }
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  const zone = page.locator('#focusBar .focus-monitor[data-monitor="1"]');
  const first = zone.locator('.focus-chip').first();
  const second = zone.locator('.focus-chip').nth(1);

  // No toggle control of any kind.
  await expect(zone.locator('.focus-monitor-toggle')).toHaveCount(0);
  await expect(zone.locator('.bi-chevron-down, .bi-chevron-up')).toHaveCount(0);

  // Both are in the DOM (so a drag can target the hidden one once revealed),
  // but only the first is visible while nothing is hovering the monitor.
  await expect(zone.locator('.focus-chip')).toHaveCount(2);
  await expect(second).not.toBeVisible();
  const firstBoxBefore = await first.boundingBox();

  await zone.hover();
  await page.waitForTimeout(300);
  await expect(second, 'hovering the monitor reveals the rest').toBeVisible();

  const firstBoxAfter = await first.boundingBox();
  expect(firstBoxAfter, 'the top item never moves when the rest reveal').toEqual(firstBoxBefore);

  // Moving off the monitor collapses it again.
  await page.mouse.move(10, 10);
  await page.waitForTimeout(300);
  await expect(second).not.toBeVisible();

  await cleanup(page, made);
});

test('a revealed stacked item can be right-clicked and dragged to reorder like any other pinned item', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  await api(page, '/api/focus-monitors', {
    method: 'PUT',
    body: JSON.stringify({ count: 1, monitors: [{ label: '', layout: 'stacked' }] }),
  });

  const made = await makeIdeas(page, ['ZZZ stack click', 'ZZZ stack second']);
  for (const e of made) {
    await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: e.id, monitor: 1 }) });
  }
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  const zone = page.locator('#focusBar .focus-monitor[data-monitor="1"]');
  const second = zone.locator(`.focus-chip[data-entity-id="${made[1].id}"]`);

  await zone.hover();
  await expect(second).toBeVisible();

  // Right-click still opens the chip's own choices (colour/remove) - now
  // combined with the monitor's, covered by its own test below.
  await second.click({ button: 'right' });
  await expect(page.locator('.focus-context-menu .context-menu-item', { hasText: 'Remove from focus bar' })).toHaveCount(1);
  // Dismiss it directly rather than clicking a coordinate that might land on
  // an unrelated link - this menu is closed by any outside click in the app
  // itself, so removing the node has the same practical effect here.
  await page.evaluate(() => document.querySelector('.focus-context-menu')?.remove());

  // Drag it above the first item to reorder.
  await zone.hover();
  await page.evaluate(() => {
    const chips = [...document.querySelectorAll('#focusBar .focus-monitor[data-monitor="1"] .focus-chip')];
    const src = chips[1], dst = chips[0];
    const dt = new DataTransfer();
    const fire = (el, name, y) => el.dispatchEvent(new DragEvent(name, {
      bubbles: true, cancelable: true, dataTransfer: dt, clientY: y,
      clientX: el.getBoundingClientRect().left + 5,
    }));
    const r = dst.getBoundingClientRect();
    fire(src, 'dragstart', src.getBoundingClientRect().top + 5);
    fire(dst, 'dragover', r.top + 2);
    fire(dst, 'drop', r.top + 2);
    fire(src, 'dragend', r.top + 2);
  });
  await page.waitForTimeout(1200);

  const order = (await api(page, '/api/focus')).body.data
    .filter(i => made.some(m => m.id === i.id))
    .sort((a, b) => a.slot - b.slot)
    .map(i => i.id);
  expect(order, 'the dragged item reordered to the front').toEqual([made[1].id, made[0].id]);

  await cleanup(page, made);
});

// A stack answers "what's next" as much as "what's running" - starting a
// buried item's clock in place would let you time something without ever
// promoting it to the front, which defeats the point of the order. It must
// be dragged to the top first.
test('clicking a buried stack item promotes it to the top instead of acting on it in place', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  await api(page, '/api/focus-monitors', {
    method: 'PUT',
    body: JSON.stringify({ count: 1, monitors: [{ label: '', layout: 'stacked' }] }),
  });

  const made = await makeIdeas(page, ['ZZZ stack top', 'ZZZ stack buried']);
  await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: made[0].id, monitor: 1 }) });
  await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: made[1].id, monitor: 1 }) });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  const zone = page.locator('#focusBar .focus-monitor[data-monitor="1"]');
  const buried = zone.locator(`.focus-chip[data-entity-id="${made[1].id}"]`);

  await zone.hover();
  await expect(buried).toBeVisible();
  await expect(buried, 'looks like something you can act on').toHaveClass(/buried/);

  // Clicking its CLOCK specifically promotes it - does not start timing it -
  // since a click on a buried item is "bring this to the top", full stop.
  await buried.locator('.focus-time').click();
  await page.waitForTimeout(900);

  const order = (await api(page, '/api/focus')).body.data
    .filter(i => made.some(m => m.id === i.id))
    .sort((a, b) => a.slot - b.slot)
    .map(i => i.id);
  expect(order, 'the clicked item is now first').toEqual([made[1].id, made[0].id]);

  const promoted = page.locator(`#focusBar .focus-monitor[data-monitor="1"] .focus-chip[data-entity-id="${made[1].id}"]`);
  await expect(promoted, 'the promotion itself did not start its clock').not.toHaveClass(/running/);
  await expect(promoted, 'no longer buried').not.toHaveClass(/buried/);

  // Now that it's on top, a second click on the clock times it, same as any
  // other pinned item.
  await promoted.locator('.focus-time').click();
  await expect(promoted, 'now at the top, it can be timed').toHaveClass(/running/);

  await cleanup(page, made);
});

test('clicking anywhere else on a buried item promotes it too, not just its clock', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  await api(page, '/api/focus-monitors', {
    method: 'PUT',
    body: JSON.stringify({ count: 1, monitors: [{ label: '', layout: 'stacked' }] }),
  });

  const made = await makeIdeas(page, ['ZZZ stack body A', 'ZZZ stack body B']);
  for (const e of made) {
    await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: e.id, monitor: 1 }) });
  }
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  const zone = page.locator('#focusBar .focus-monitor[data-monitor="1"]');
  const buried = zone.locator(`.focus-chip[data-entity-id="${made[1].id}"]`);

  await zone.hover();
  await buried.locator('.focus-title').click();   // the title, not the clock
  await page.waitForTimeout(900);

  const order = (await api(page, '/api/focus')).body.data
    .filter(i => made.some(m => m.id === i.id))
    .sort((a, b) => a.slot - b.slot)
    .map(i => i.id);
  expect(order, 'clicking its title promoted it too').toEqual([made[1].id, made[0].id]);

  await cleanup(page, made);
});

test('an already-running item can still be stopped after being buried by a reorder, via a promote-then-stop click', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  await api(page, '/api/focus-monitors', {
    method: 'PUT',
    body: JSON.stringify({ count: 1, monitors: [{ label: '', layout: 'stacked' }] }),
  });

  const made = await makeIdeas(page, ['ZZZ stack timed', 'ZZZ stack promoted']);
  await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: made[0].id, monitor: 1 }) });
  await api(page, `/api/focus/${made[0].id}/toggle`, { method: 'POST' });   // start it while it's still first
  await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: made[1].id, monitor: 1 }) });
  // Push the running one to second place - its clock keeps running; only a
  // click bringing it back to the top is what's restricted while buried.
  await api(page, '/api/focus/monitors/1/order', { method: 'PATCH', body: JSON.stringify({ orderedIds: [made[1].id, made[0].id] }) });

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  const zone = page.locator('#focusBar .focus-monitor[data-monitor="1"]');
  const buriedRunning = zone.locator(`.focus-chip[data-entity-id="${made[0].id}"]`);

  await zone.hover();
  await expect(buriedRunning, 'still running even though it is buried').toHaveClass(/running/);

  // First click promotes it (does not stop the clock by itself)...
  await buriedRunning.locator('.focus-time').click();
  await page.waitForTimeout(900);
  const nowFirst = page.locator(`#focusBar .focus-monitor[data-monitor="1"] .focus-chip[data-entity-id="${made[0].id}"]`);
  await expect(nowFirst, 'promoted, and still running').toHaveClass(/running/);

  // ...a second click, now that it's on top, stops it.
  await nowFirst.locator('.focus-time').click();
  await expect(nowFirst, 'now stoppable from the top').not.toHaveClass(/running/);

  await cleanup(page, made);
});

test('a stacked monitor is wide enough for its widest pinned item, whichever one is on top', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  await api(page, '/api/focus-monitors', {
    method: 'PUT',
    body: JSON.stringify({ count: 1, monitors: [{ label: '', layout: 'stacked' }] }),
  });

  const made = await makeIdeas(page, [
    'ZZZ w',
    'ZZZ a much much longer title that should force the stacked monitor to be wide',
  ]);
  // The SHORT one first, so the box's natural (collapsed) width would be
  // narrow if it were only sized off whatever happens to be on top.
  await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: made[0].id, monitor: 1 }) });
  await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: made[1].id, monitor: 1 }) });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  const zone = page.locator('#focusBar .focus-monitor[data-monitor="1"]');
  const longChip = zone.locator(`.focus-chip[data-entity-id="${made[1].id}"]`);

  const collapsedWidth = (await zone.boundingBox()).width;

  await zone.hover();
  await expect(longChip).toBeVisible();
  const longChipWidth = (await longChip.boundingBox()).width;

  expect(collapsedWidth, 'the box was already wide enough for the buried long title')
    .toBeGreaterThanOrEqual(longChipWidth);

  await cleanup(page, made);
});

test('every pinned item in a stack shares the same width, matching the widest', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  await api(page, '/api/focus-monitors', {
    method: 'PUT',
    body: JSON.stringify({ count: 1, monitors: [{ label: '', layout: 'stacked' }] }),
  });

  const made = await makeIdeas(page, [
    'ZZZ w',
    'ZZZ a considerably longer title than the other one here',
  ]);
  await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: made[0].id, monitor: 1 }) });
  await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: made[1].id, monitor: 1 }) });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  const zone = page.locator('#focusBar .focus-monitor[data-monitor="1"]');
  const shortChip = zone.locator(`.focus-chip[data-entity-id="${made[0].id}"]`);
  const longChip = zone.locator(`.focus-chip[data-entity-id="${made[1].id}"]`);

  await zone.hover();
  await expect(longChip).toBeVisible();

  const shortWidth = (await shortChip.boundingBox()).width;
  const longWidth = (await longChip.boundingBox()).width;
  expect(shortWidth, 'the short one stretched to match the long one, not left ragged').toBeCloseTo(longWidth, 0);

  await cleanup(page, made);
});

test('dragging a chip off the bar and dropping it elsewhere on the page unpins it', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const made = await makeIdeas(page, ['ZZZ drag off']);
  await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: made[0].id }) });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  const chip = page.locator(`#focusBar .focus-chip[data-entity-id="${made[0].id}"]`);
  await expect(chip).toBeVisible();

  // Drop it on the entity list below the bar - anywhere off the bar unpins.
  await chip.dragTo(page.locator('#ideaEntityList'));
  await page.waitForTimeout(1200);

  await expect(page.locator(`#focusBar .focus-chip[data-entity-id="${made[0].id}"]`)).toHaveCount(0);

  // Unpinning does not delete the record itself.
  const still = (await api(page, `/api/entities/idea/${made[0].id}`)).body.data;
  expect(still.title).toBe('ZZZ drag off');

  await cleanup(page, made);
});

test('dragging an item onto the bar\'s own empty space (not any existing monitor) creates a new one for it', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  await api(page, '/api/focus-monitors', { method: 'PUT', body: JSON.stringify({ count: 1 }) });

  const made = await makeIdeas(page, ['ZZZ new monitor drag']);
  await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: made[0].id, monitor: 1 }) });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  await expect(page.locator('#focusBar .focus-monitor')).toHaveCount(1);

  // Dispatched directly on the bar element itself (not a coordinate), so
  // e.target is the bar and never any specific .focus-monitor - exactly
  // "dropped on the bar's own empty space", regardless of viewport width.
  const hadCue = await page.evaluate((entityId) => {
    const bar = document.getElementById('focusBar');
    const chip = document.querySelector(`.focus-chip[data-entity-id="${entityId}"]`);
    const dt = new DataTransfer();
    const fire = (el, name) => el.dispatchEvent(new DragEvent(name, {
      bubbles: true, cancelable: true, dataTransfer: dt,
    }));
    fire(chip, 'dragstart');
    fire(bar, 'dragover');
    const cue = bar.classList.contains('new-monitor-target');
    fire(bar, 'drop');
    fire(chip, 'dragend');
    return cue;
  }, made[0].id);
  expect(hadCue, 'the bar showed the new-monitor cue while hovering its own empty space').toBe(true);
  await page.waitForTimeout(1200);

  const settings = (await api(page, '/api/focus-monitors')).body.data;
  expect(settings.count, 'a new monitor was created').toBe(2);

  const focus = (await api(page, '/api/focus')).body.data;
  expect(focus.find(i => i.id === made[0].id).monitor, 'the item moved to the new monitor').toBe(2);

  await cleanup(page, made);
  await api(page, '/api/focus-monitors', { method: 'PUT', body: JSON.stringify({ count: 1 }) });
});

// The bound is read from the server rather than written here as a number. It
// is deliberately not a product limit (see MAX_MONITORS in
// focusMonitorsService.js) and moved once already, from 6 to 32; a spec that
// hardcodes it fails on the change rather than on the behaviour it guards.
test('dragging onto the bar\'s empty space at the cap does not create a new monitor', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const cap = (await api(page, '/api/focus-monitors')).body.data.maxMonitors;
  expect(cap, 'the settings payload carries the bound').toBeGreaterThan(0);

  // count is derived from the highest monitor in use, so pinning directly to
  // `cap` reaches it in one call - no need to populate every monitor below it.
  const made = await makeIdeas(page, ['ZZZ at cap']);
  await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: made[0].id, monitor: cap }) });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  await page.evaluate((entityId) => {
    const bar = document.getElementById('focusBar');
    const chip = document.querySelector(`.focus-chip[data-entity-id="${entityId}"]`);
    const dt = new DataTransfer();
    const fire = (el, name) => el.dispatchEvent(new DragEvent(name, {
      bubbles: true, cancelable: true, dataTransfer: dt,
    }));
    fire(chip, 'dragstart');
    fire(bar, 'dragover');
    fire(bar, 'drop');
    fire(chip, 'dragend');
  }, made[0].id);
  await page.waitForTimeout(900);

  const settings = (await api(page, '/api/focus-monitors')).body.data;
  expect(settings.count, 'still at the cap - no monitor was added').toBe(cap);

  const focus = (await api(page, '/api/focus')).body.data;
  expect(focus.find(i => i.id === made[0].id).monitor, 'the item stayed where it was').toBe(cap);

  await cleanup(page, made);
});

// There is no "shrink the count" action any more, and so nothing left to
// reassign for it - count is derived, not set, and the old test for it
// (PUT { count: 1 } moving monitor 3's item to monitor 1) has no equivalent
// in the new model. Removing a specific monitor still reassigns what was
// pinned to it - that's shiftMonitorsAfterRemoval, covered below.

// ===== Add/remove a monitor from its own context menu =====
//
// "Add" no longer exists as a menu action or an endpoint - a monitor that
// starts out empty is exactly the persistent, pre-configured box this
// feature was rebuilt to stop showing. See the drag-creates-a-monitor tests
// above for the one way a monitor comes into existence now.

test('POST /api/focus-monitors/:position/remove removes that monitor, shifts the rest, and reassigns items', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  await api(page, '/api/focus-monitors', { method: 'PUT', body: JSON.stringify({
    monitors: [
      { label: 'One', layout: 'side-by-side' },
      { label: 'Two', layout: 'side-by-side' },
      { label: 'Three', layout: 'side-by-side' },
    ],
  }) });

  const made = await makeIdeas(page, ['ZZZ remove-mon on2', 'ZZZ remove-mon on3']);
  await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: made[0].id, monitor: 2 }) });
  await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: made[1].id, monitor: 3 }) });

  // Remove monitor 2: its own item falls back to monitor 1, and monitor 3
  // (with its item) becomes the new monitor 2.
  const removed = await api(page, '/api/focus-monitors/2/remove', { method: 'POST' });
  expect(removed.body.data.count).toBe(2);
  expect(removed.body.data.monitors[0].label, 'monitor 1 is untouched').toBe('One');
  expect(removed.body.data.monitors[1].label, 'old monitor 3 slides into slot 2').toBe('Three');
  expect(removed.body.data.movedCount).toBe(2);

  const focus = (await api(page, '/api/focus')).body.data;
  expect(focus.find(i => i.id === made[0].id).monitor, 'the removed monitor\'s own item lands on 1').toBe(1);
  expect(focus.find(i => i.id === made[1].id).monitor, 'old monitor 3\'s item follows it to the new 2').toBe(2);

  await cleanup(page, made);
});

// There is no separate "remove the last monitor" action to test any more:
// count is derived from what's pinned, so the bar hides itself the moment
// nothing is - covered by 'the bar is hidden with nothing pinned...' above.
// Calling remove directly against the ONLY monitor while something is still
// pinned to it is a no-op rather than an error (shiftMonitorsAfterRemoval has
// nowhere lower to move that item TO), which is why the Settings UI disables
// "Remove this monitor" whenever count <= 1 - see the context-menu test below.

// With nothing pinned anywhere, count is already 0, so there is nothing to
// remove and the endpoint says so.
test('removing a monitor when none exist is refused', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  const res = await api(page, '/api/focus-monitors/1/remove', { method: 'POST' });
  expect(res.status, 'nothing to remove').toBe(400);
});

test('right-clicking a monitor offers remove/layout (never add) right from the page', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  const made = await makeIdeas(page, ['ZZZ rclick mon A']);
  await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: made[0].id, monitor: 1 }) });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);

  let zone = page.locator('#focusBar .focus-monitor[data-monitor="1"]');
  await zone.click({ button: 'right' });

  let menu = page.locator('.focus-context-menu');
  // There is no "Add a monitor" any more - dragging is the only way to make
  // one, see the drag-creates-a-monitor tests above.
  await expect(menu.getByText('Add a monitor')).toHaveCount(0);
  // Only one monitor exists, so removing it must be offered but disabled.
  await expect(menu.getByText('Remove this monitor')).toBeVisible();
  await expect(menu.locator('.context-menu-item', { hasText: 'Remove this monitor' })).toBeDisabled();
  await page.evaluate(() => document.querySelector('.focus-context-menu')?.remove());

  // A second monitor, pinned directly rather than through the removed "Add"
  // button - now there is something to remove.
  const madeB = await makeIdeas(page, ['ZZZ rclick mon B']);
  await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: madeB[0].id, monitor: 2 }) });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);

  zone = page.locator('#focusBar .focus-monitor[data-monitor="1"]');
  await zone.click({ button: 'right' });
  menu = page.locator('.focus-context-menu');
  await expect(menu.locator('.context-menu-item', { hasText: 'Remove this monitor' }), 'now enabled with 2 monitors').toBeEnabled();
  await page.evaluate(() => document.querySelector('.focus-context-menu')?.remove());

  // Switch monitor 2 to stacked from its own menu.
  await page.locator('#focusBar .focus-monitor[data-monitor="2"]').click({ button: 'right' });
  await page.locator('.focus-context-menu .context-menu-item', { hasText: 'Stacked' }).click();
  await page.waitForTimeout(900);

  await expect(page.locator('#focusBar .focus-monitor[data-monitor="2"]')).toHaveAttribute('data-layout', 'stacked');

  await cleanup(page, [...made, ...madeB]);
});

// A monitor's own space can be too small to reliably right-click around a
// chip that fills it - the top item of a stack especially - so the chip's
// and the monitor's choices are one menu, reachable from either.
test('right-clicking a chip shows the chip\'s own choices and the monitor\'s choices in one menu', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  const made = await makeIdeas(page, ['ZZZ combined menu']);
  await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: made[0].id, monitor: 1 }) });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  const chip = page.locator(`#focusBar .focus-chip[data-entity-id="${made[0].id}"]`);
  await chip.click({ button: 'right' });

  const menu = page.locator('.focus-context-menu');
  // The chip's own choices.
  await expect(menu.locator('.focus-swatch-row')).not.toHaveCount(0);
  await expect(menu.getByText('Remove from focus bar')).toBeVisible();
  // The monitor's, in the SAME menu, without a second right-click. No "Add" -
  // dragging is the only way to make one now.
  await expect(menu.getByText('Add a monitor')).toHaveCount(0);
  await expect(menu.getByText('Side by side')).toBeVisible();
  await expect(menu.getByText('Stacked')).toBeVisible();

  await cleanup(page, made);
});

// The bar fills the whole strip between the brand and the context switcher
// (flex: 1 1 auto) - only one narrow monitor box sits centred inside it, so
// there is real empty bar area on either side to right-click. It offers
// nothing now - "Add a monitor" is gone (dragging is the only way to make
// one), and there is no chip or monitor under the pointer to act on, so no
// menu opens at all rather than an empty popup.
test('right-clicking the bar\'s own empty space opens no menu', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  const made = await makeIdeas(page, ['ZZZ empty-space rclick']);
  await api(page, '/api/focus', { method: 'POST', body: JSON.stringify({ entityId: made[0].id, monitor: 1 }) });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);

  const empty = await page.evaluate(() => {
    const bar = document.getElementById('focusBar');
    const zone = document.querySelector('#focusBar .focus-monitor');
    const barBox = bar.getBoundingClientRect();
    const zoneBox = zone.getBoundingClientRect();
    // Far enough left of the centred monitor box to land on the bar's own
    // background, but still inside the bar's own bounding rect.
    return { x: barBox.left + 10, y: zoneBox.top + zoneBox.height / 2 };
  });

  await page.mouse.move(empty.x, empty.y);
  await page.mouse.click(empty.x, empty.y, { button: 'right' });
  await page.waitForTimeout(400);

  await expect(page.locator('.focus-context-menu')).toHaveCount(0);

  await cleanup(page, made);
});
