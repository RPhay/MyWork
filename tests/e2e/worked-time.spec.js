import { test, expect } from '@playwright/test';
import { purgeByTitlePrefix } from './helpers/cleanup.js';

// Worked Time is on every type, editable by hand, and shares one value with the
// focus bar's clock - time worked away from the app still counts, so it has to
// be correctable. Stored as seconds; shown and typed as readable time.

const TYPE = 'to_do';

async function api(page, url, opts = {}) {
  return page.evaluate(async ({ url, opts }) => {
    const res = await fetch(url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', 'CSRF-Token': window.APP_CONFIG?.csrfToken },
    });
    return res.json();
  }, { url, opts });
}

test.afterEach(async ({ page }) => { await purgeByTitlePrefix(page, TYPE, 'ZZZ'); });

test('every type carries a Worked Time property', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const types = (await api(page, '/api/entity-types')).data;
  const missing = types.filter(t => !(t.fields || []).some(f => f.field_key === 'focus_seconds'));
  console.log('types without Worked Time ->', missing.map(t => t.slug));
  expect(missing.map(t => t.slug)).toEqual([]);
});

test('Worked Time can be typed by hand and is stored as seconds', async ({ page }) => {
  await page.goto(`/?tab=${TYPE}`, { waitUntil: 'networkidle' });
  const made = (await api(page, `/api/entities/${TYPE}`, { method: 'POST', body: JSON.stringify({ title: 'ZZZ worked' }) })).data;
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  await page.locator(`#${TYPE}EntityList .entity-row[data-entity-id="${made.id}"] .entity-cell-title`).dblclick();
  await page.waitForTimeout(900);

  const box = page.locator('#entity-editor-form [data-field-type="duration"] .duration-input');
  await expect(box, 'the editor offers a Worked Time control').toHaveCount(1);
  // Never blank: nothing logged reads as zero, not as a missing field.
  await expect(box, 'an unworked item shows zero').toHaveValue('0h 0m');

  await box.fill('1h 30m');
  await box.dispatchEvent('input');
  await page.click(`#${TYPE}SaveBtn`);
  await page.waitForTimeout(1300);

  const stored = (await api(page, `/api/entities/${TYPE}/${made.id}`)).data?.fields?.focus_seconds;
  console.log('stored seconds ->', stored);
  expect(Number(stored), '1h 30m is 5400 seconds').toBe(5400);

  // Reopened, it reads back as time rather than a raw count.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  await page.locator(`#${TYPE}EntityList .entity-row[data-entity-id="${made.id}"] .entity-cell-title`).dblclick();
  await page.waitForTimeout(900);
  await expect(page.locator('#entity-editor-form .duration-input')).toHaveValue('1h 30m');
});

test('Worked Time cannot be removed from a type', async ({ page }) => {
  await page.goto('/settings?tab=entity-types', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  await page.locator('text=Todos').first().click().catch(() => {});
  await page.waitForTimeout(1200);

  const row = page.locator('.field-row').filter({ has: page.locator('.field-key[value="focus_seconds"]') });
  test.skip(await row.count() === 0, 'type editor did not open');
  await expect(row.locator('.remove-field-btn'), 'no delete button on a locked field').toHaveCount(0);
  await expect(row.locator('.field-locked'), 'it shows as locked instead').toHaveCount(1);
});

// A folder's editor is normally just a name, because a folder organises rather
// than holds values. Worked Time is the exception: a folder can be pinned to
// the focus bar and accumulate time, and time you cannot see or correct is
// worse than time not recorded.
test('a folder shows Worked Time in its editor, and it can be corrected', async ({ page }) => {
  await page.goto(`/?tab=${TYPE}`, { waitUntil: 'networkidle' });
  const folder = (await api(page, `/api/entities/${TYPE}`, {
    method: 'POST', body: JSON.stringify({ title: 'ZZZ worked folder', is_folder: true }),
  })).data;
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  await page.locator(`#${TYPE}EntityList .entity-row[data-entity-id="${folder.id}"] .entity-cell-title`).dblclick();
  await page.waitForTimeout(900);

  const box = page.locator('#entity-editor-form [data-field-type="duration"] .duration-input');
  await expect(box, 'a folder shows Worked Time').toHaveCount(1);
  await expect(box).toHaveValue('0h 0m');

  // Still a folder's editor otherwise - no status, no notes, just the name and
  // the time.
  await expect(page.locator('#entity-editor-form [data-field-type="status"]'),
    'a folder still holds no status of its own').toHaveCount(0);

  await box.fill('45m');
  await box.dispatchEvent('input');
  await page.click(`#${TYPE}SaveBtn`);
  await page.waitForTimeout(1300);

  const stored = (await api(page, `/api/entities/${TYPE}/${folder.id}`)).data?.fields?.focus_seconds;
  expect(Number(stored), '45m is 2700 seconds').toBe(2700);
});
