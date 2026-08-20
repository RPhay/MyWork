import { test, expect } from '@playwright/test';
import { purgeByTitlePrefix } from './helpers/cleanup.js';

// Every type can carry a Time Box - how long something is MEANT to take, as
// against Worked Time, which is how long it has taken. One ladder everywhere:
// 15m, 30m, 45m, 1h, 1.5h, 2h. Dailies offered 15/30/45/60 and the field
// offered six, which is the same idea with two different sets of answers.

const OPTIONS = ['15m', '30m', '45m', '1h', '1.5h', '2h'];
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

test('every type has a Time Box offering the same six options', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const types = (await api(page, '/api/entity-types')).data;

  const missing = types.filter(t => !(t.fields || []).some(f => f.field_key === 'time_box'));
  console.log('types without a Time Box ->', missing.map(t => t.slug));
  expect(missing.map(t => t.slug), 'all types carry one').toEqual([]);

  // Its own field type, so the ladder lives in one place rather than being
  // copied into every type's options - which is what let Dailies and the field
  // drift to different sets of answers in the first place.
  const wrong = [];
  for (const t of types) {
    const f = (t.fields || []).find(x => x.field_key === 'time_box');
    if (f.field_type !== 'timebox') wrong.push(`${t.slug} uses ${f.field_type}`);
    if (f.label !== 'Time Box') wrong.push(`${t.slug} labels it "${f.label}"`);
  }
  expect(wrong, wrong.join(' | ')).toEqual([]);
});

test('a Time Box can be set and comes back', async ({ page }) => {
  await page.goto(`/?tab=${TYPE}`, { waitUntil: 'networkidle' });
  const made = (await api(page, `/api/entities/${TYPE}`, { method: 'POST', body: JSON.stringify({ title: 'ZZZ boxed' }) })).data;
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  await page.locator(`#${TYPE}EntityList .entity-row[data-entity-id="${made.id}"] .entity-cell-title`).dblclick();
  await page.waitForTimeout(900);

  // An icon that says what it is, and a value you cycle by clicking - not a
  // dropdown. "None" is one of the values, so cycling can always get back to
  // not boxing something.
  const control = page.locator('#entity-editor-form [data-field-type="timebox"] .editor-cycle');
  await expect(control, 'the editor offers the control').toHaveCount(1);
  await expect(control.locator('.timebox-icon'), 'with an icon saying what it is').toHaveCount(1);
  await expect(control.locator('.editor-cycle-label')).toHaveText('None');

  const seen = [];
  for (let i = 0; i < OPTIONS.length + 1; i += 1) {
    seen.push((await control.locator('.editor-cycle-label').textContent()).trim());
    await control.click();
    await page.waitForTimeout(150);
  }
  console.log('cycled through ->', JSON.stringify(seen));
  expect(seen, 'None first, then the six, and back round').toEqual(['None', ...OPTIONS]);

  // Land on a real value and save it.
  while ((await control.locator('.editor-cycle-label').textContent()).trim() !== '1.5h') {
    await control.click();
    await page.waitForTimeout(120);
  }
  await page.click(`#${TYPE}SaveBtn`);
  await page.waitForTimeout(1300);

  const stored = (await api(page, `/api/entities/${TYPE}/${made.id}`)).data?.fields?.time_box;
  expect(stored, 'it persists').toBe('1.5h');
});
