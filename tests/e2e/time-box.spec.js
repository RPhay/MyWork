import { test, expect } from '@playwright/test';
import { purgeByTitlePrefix } from './helpers/cleanup.js';
import { flushAutosave, openEditor } from './editor-gestures.js';

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

  await openEditor(page.locator(`#${TYPE}EntityList .entity-row[data-entity-id="${made.id}"]`));
  await page.waitForTimeout(900);

  // Every option at once with a box round the current one, like status. The
  // ROW still cycles - there is no space there for seven choices - but the
  // editor has the room, and cycling is a poor way to pick when you cannot see
  // the choices without clicking through them.
  const group = page.locator('#entity-editor-form [data-field-type="timebox"]');
  await expect(group, 'the editor offers the control').toHaveCount(1);

  const offered = await group.locator('.option-choice').allTextContents();
  console.log('offered ->', JSON.stringify(offered.map(t => t.trim())));
  expect(offered.map(t => t.trim()), 'None first, then the six').toEqual(['None', ...OPTIONS]);

  // Nothing set yet, so None is the one marked.
  await expect(group.locator('.option-choice.selected')).toHaveText('None');

  await group.locator('.option-choice', { hasText: '1.5h' }).first().click();
  await page.waitForTimeout(300);
  await expect(group.locator('.option-choice.selected'), 'the mark moves').toHaveText('1.5h');

  await flushAutosave(page);
  await page.waitForTimeout(1300);

  const stored = (await api(page, `/api/entities/${TYPE}/${made.id}`)).data?.fields?.time_box;
  expect(stored, 'it persists').toBe('1.5h');
});
