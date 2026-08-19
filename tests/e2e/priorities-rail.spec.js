import { test, expect } from '@playwright/test';

/**
 * The priorities board as a rail: rows of any type dragged in from a typed tab.
 *
 * Driven with locator.dragTo() so the browser's own HTML5 drag machinery runs.
 * Synthetic DragEvents bypass it and pass happily while the feature is broken
 * for a person using the app - which is exactly how the earlier drag work got
 * shipped broken.
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

async function openBoardRail(page) {
  if (await page.locator('#rail-work_item').isVisible().catch(() => false)) {
    await page.locator('button[data-rail-toggle="work_item"]').click();
    await page.waitForTimeout(600);
  }
  if (!(await page.locator('#rail-priority-board').isVisible().catch(() => false))) {
    await page.locator('button[data-rail-toggle="priority-board"]').click();
    await page.waitForTimeout(900);
  }
}

test('an idea dragged onto a bay lands as a reference, not a copy', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const idea = (await api(page, '/api/entities/idea', {
    method: 'POST', body: JSON.stringify({ title: 'ZZZ board idea' }),
  })).body.data;

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);
  await openBoardRail(page);

  const src = page.locator('#ideaEntityList .entity-row', { hasText: 'ZZZ board idea' }).first();
  const bay = page.locator('.priority-bay[data-status="In Progress"]');
  await bay.scrollIntoViewIfNeeded();
  await src.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  await src.dragTo(bay);
  await page.waitForTimeout(1200);

  const card = bay.locator(`.board-card[data-entity-id="${idea.id}"]`);
  await expect(card, 'the idea landed in the bay it was dropped on').toHaveCount(1);
  await expect(card.locator('.board-card-type')).toHaveText('Ideas');

  // A reference, not a copy: exactly one record exists, and it is the original.
  const ideas = (await api(page, '/api/entities/idea')).body.data
    .filter(e => e.title === 'ZZZ board idea');
  expect(ideas, 'dropping on the board must not clone the record').toHaveLength(1);
  expect(String(ideas[0].id)).toBe(String(idea.id));

  // The bay is board-local placement, NOT the record's status. An Idea's own
  // status vocabulary is Raw/Developing/Ready and has no "In Progress" in it,
  // so a bay that wrote status would have corrupted this record.
  expect(ideas[0].fields?.board_bay).toBe('In Progress');
  expect(ideas[0].fields?.status ?? '').not.toBe('In Progress');

  // Nothing on the board is editable - only move, reorder, remove.
  await expect(card.locator('[data-action="edit"]')).toHaveCount(0);
  await expect(card.locator('input, textarea, select')).toHaveCount(0);
  await expect(card.locator('[data-action="remove"]')).toHaveCount(1);

  await api(page, `/api/entities/idea/${idea.id}`, { method: 'DELETE' });
});

test('a card moved between bays changes only its board placement', async ({ page }) => {
  await page.goto('/?tab=to_do');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const todo = (await api(page, '/api/entities/to_do', {
    method: 'POST', body: JSON.stringify({ title: 'ZZZ board todo', fields: { status: 'Not Started' } }),
  })).body.data;
  await api(page, '/api/priority-board/items', {
    method: 'POST', body: JSON.stringify({ entityId: todo.id, bay: 'Not Started' }),
  });

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);
  await openBoardRail(page);

  const card = page.locator(`.board-card[data-entity-id="${todo.id}"]`);
  await expect(card).toHaveCount(1);

  const target = page.locator('.priority-bay[data-status="Complete"]');
  await target.scrollIntoViewIfNeeded();
  await card.dragTo(target);
  await page.waitForTimeout(1200);

  await expect(target.locator(`.board-card[data-entity-id="${todo.id}"]`)).toHaveCount(1);

  const after = (await api(page, `/api/entities/to_do/${todo.id}`)).body.data;
  expect(after.fields?.board_bay).toBe('Complete');
  expect(after.fields?.status, 'the record\'s own status is untouched').toBe('Not Started');

  await api(page, `/api/entities/to_do/${todo.id}`, { method: 'DELETE' });
});

test('taking a card off the board leaves the record alone', async ({ page }) => {
  await page.goto('/?tab=idea');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const idea = (await api(page, '/api/entities/idea', {
    method: 'POST', body: JSON.stringify({ title: 'ZZZ board remove' }),
  })).body.data;
  await api(page, '/api/priority-board/items', {
    method: 'POST', body: JSON.stringify({ entityId: idea.id, bay: 'Not Started' }),
  });

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);
  await openBoardRail(page);

  const card = page.locator(`.board-card[data-entity-id="${idea.id}"]`);
  await expect(card).toHaveCount(1);
  await card.locator('[data-action="remove"]').click();
  await page.waitForTimeout(1000);

  await expect(page.locator(`.board-card[data-entity-id="${idea.id}"]`)).toHaveCount(0);

  const still = (await api(page, `/api/entities/idea/${idea.id}`)).body.data;
  expect(still?.title, 'the record survives being taken off the board').toBe('ZZZ board remove');

  await api(page, `/api/entities/idea/${idea.id}`, { method: 'DELETE' });
});
