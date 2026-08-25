import { test, expect } from '@playwright/test';

/**
 * Worked Time (field_type "duration", stored under focus_seconds/
 * focus_started_at) can now start and stop its own clock from the row cell,
 * independently of the focus/pin bar - the same two fields the pin bar's own
 * chip reads and writes, just reachable without ever pinning the item.
 *
 * "Only one clock runs, ever" has to hold across BOTH surfaces at once: an
 * item running the clock only from its row cell must still be stopped when
 * another item starts one, pinned or not.
 */

const TYPE = 'idea';

async function api(page, url, opts = {}) {
  return page.evaluate(async ([u, o]) => {
    const r = await fetch(u, {
      ...o,
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': document.body.dataset.csrfToken || '' },
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, [url, opts]);
}

let workedTimeFieldId = null;
let entityIds = [];

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto('/?tab=idea', { waitUntil: 'networkidle' });
  const type = (await api(page, `/api/entity-types/${TYPE}`)).body.data;
  const field = (type.fields || []).find(f => f.field_key === 'focus_seconds');
  workedTimeFieldId = field.id;
  // Worked Time is hidden as a column by default (show_in_row: false) - show
  // it for this spec only.
  await api(page, `/api/entity-types/fields/${workedTimeFieldId}`, {
    method: 'PUT', body: JSON.stringify({ show_in_row: true }),
  });
  await page.close();
});

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto('/?tab=idea', { waitUntil: 'networkidle' });
  for (const id of entityIds) await api(page, `/api/entities/${TYPE}/${id}`, { method: 'DELETE' });
  if (workedTimeFieldId) {
    await api(page, `/api/entity-types/fields/${workedTimeFieldId}`, {
      method: 'PUT', body: JSON.stringify({ show_in_row: false }),
    });
  }
  await page.close();
});

test('clicking Worked Time starts and stops the clock, without opening the editor', async ({ page }) => {
  await page.goto('/?tab=idea', { waitUntil: 'networkidle' });

  const made = await api(page, `/api/entities/${TYPE}`, {
    method: 'POST', body: JSON.stringify({ title: 'ZZZ worked time' }),
  });
  const id = made.body.data.id;
  entityIds.push(id);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  const row = page.locator(`#ideaEntityList .entity-row[data-entity-id="${id}"]`);
  await expect(row).toBeVisible({ timeout: 8000 });
  const cell = row.locator('[data-action="toggle-timer-field"]');
  await expect(cell).toHaveCount(1);

  await cell.click();
  await page.waitForTimeout(800);
  await expect(cell, 'the cell shows it is running').toHaveClass(/running/);
  let read = (await api(page, `/api/entities/${TYPE}`)).body.data.find(e => e.id === id);
  expect(read.fields.focus_started_at, 'the clock started, though never pinned').toBeTruthy();

  expect(await page.locator('#entity-editor-form').count(),
    'clicking the cell must not open the editor').toBe(0);

  // elapsedSeconds() floors to whole seconds, so the clock needs to have
  // genuinely run past a full second or the banked total is 0 even though
  // it briefly ran - not a race in the app, just this test's own margin.
  await page.waitForTimeout(1200);
  await cell.click();
  await page.waitForTimeout(800);
  read = (await api(page, `/api/entities/${TYPE}`)).body.data.find(e => e.id === id);
  expect(read.fields.focus_started_at, 'the clock stopped').toBeFalsy();
  expect(read.fields.focus_seconds, 'elapsed time was banked').toBeGreaterThan(0);
});

test('starting a second item\'s clock stops the first, even though neither is pinned', async ({ page }) => {
  await page.goto('/?tab=idea', { waitUntil: 'networkidle' });

  const [a, b] = await Promise.all([
    api(page, `/api/entities/${TYPE}`, { method: 'POST', body: JSON.stringify({ title: 'ZZZ worked time A' }) }),
    api(page, `/api/entities/${TYPE}`, { method: 'POST', body: JSON.stringify({ title: 'ZZZ worked time B' }) }),
  ]);
  const idA = a.body.data.id, idB = b.body.data.id;
  entityIds.push(idA, idB);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  await page.locator(`#ideaEntityList .entity-row[data-entity-id="${idA}"] [data-action="toggle-timer-field"]`).click();
  await page.waitForTimeout(800);
  let readA = (await api(page, `/api/entities/${TYPE}`)).body.data.find(e => e.id === idA);
  expect(readA.fields.focus_started_at, 'A is running').toBeTruthy();

  await page.locator(`#ideaEntityList .entity-row[data-entity-id="${idB}"] [data-action="toggle-timer-field"]`).click();
  await page.waitForTimeout(800);

  readA = (await api(page, `/api/entities/${TYPE}`)).body.data.find(e => e.id === idA);
  const readB = (await api(page, `/api/entities/${TYPE}`)).body.data.find(e => e.id === idB);
  expect(readA.fields.focus_started_at, 'A was stopped when B started').toBeFalsy();
  expect(readB.fields.focus_started_at, 'B is now running').toBeTruthy();
});
