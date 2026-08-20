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

  const wrong = [];
  for (const t of types) {
    const f = (t.fields || []).find(x => x.field_key === 'time_box');
    const choices = (typeof f.field_options === 'string' ? JSON.parse(f.field_options) : f.field_options)?.choices;
    if (JSON.stringify(choices) !== JSON.stringify(OPTIONS)) wrong.push(`${t.slug}: ${JSON.stringify(choices)}`);
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

  const select = page.locator('#entity-editor-form select[name="time_box"]');
  await expect(select, 'the editor offers it').toHaveCount(1);
  const offered = await select.locator('option').evaluateAll(os => os.map(o => o.value).filter(Boolean));
  console.log('offered ->', JSON.stringify(offered));
  expect(offered).toEqual(OPTIONS);

  await select.selectOption('1.5h');
  await page.click(`#${TYPE}SaveBtn`);
  await page.waitForTimeout(1300);

  const stored = (await api(page, `/api/entities/${TYPE}/${made.id}`)).data?.fields?.time_box;
  expect(stored, 'it persists').toBe('1.5h');
});
