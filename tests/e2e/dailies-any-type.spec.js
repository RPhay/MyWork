import { test, expect } from '@playwright/test';

/**
 * A day can hold a row of ANY type, including one the user created, and the row
 * arrives with its tree intact.
 *
 * Before this, Dailies linked children through seven per-type junction tables.
 * A type invented later had no table and no route, so dropping it on a day did
 * nothing at all - silently, because the handler simply returned.
 */

const DAY = '2026-08-19';

async function api(page, url, opts = {}) {
  return page.evaluate(async ({ url, opts }) => {
    const res = await fetch(url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', 'CSRF-Token': window.APP_CONFIG?.csrfToken },
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  }, { url, opts });
}

let made = { entities: [], work: [] };

test.afterEach(async ({ page }) => {
  await page.evaluate(async ({ made }) => {
    const csrf = window.APP_CONFIG?.csrfToken;
    for (const w of made.work) {
      await fetch(`/api/work/${w}`, { method: 'DELETE', headers: { 'CSRF-Token': csrf } });
    }
    for (const e of made.entities) {
      await fetch(`/api/entities/tests/${e}`, { method: 'DELETE', headers: { 'CSRF-Token': csrf } });
      await fetch(`/api/trash/${e}`, { method: 'DELETE', headers: { 'CSRF-Token': csrf } });
    }
  }, { made });
  made = { entities: [], work: [] };
});

test('a user-created type can be put on a day, with its children', async ({ page }) => {
  await page.goto('/?tab=tests', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  // A row of the user's own type, with something nested inside it.
  const parent = (await api(page, '/api/entities/tests', { method: 'POST', body: JSON.stringify({ title: 'ZZZ any parent' }) })).body.data;
  const child = (await api(page, '/api/entities/tests', { method: 'POST', body: JSON.stringify({ title: 'ZZZ any child' }) })).body.data;
  made.entities.push(parent.id, child.id);
  await api(page, `/api/entities/tests/${child.id}/relationships`, {
    method: 'POST',
    body: JSON.stringify({ parentEntityId: parent.id, childEntityId: child.id, relationshipKind: 'hierarchy' }),
  });

  // The day's work item, and the link that used to be impossible.
  const work = (await api(page, '/api/work', {
    method: 'POST', body: JSON.stringify({ title: 'ZZZ any day', date: DAY }),
  })).body.data;
  made.work.push(work.id);

  const linked = await api(page, `/api/work/${work.id}/entities/${parent.id}`, { method: 'POST' });
  expect(linked.status, 'a type with no junction table of its own can still be linked').toBe(201);

  // Read it back: the row is there, and so is what was inside it.
  const items = (await api(page, `/api/work/date/${DAY}`)).body.data;
  const day = items.find(i => String(i.id) === String(work.id));
  const titles = (day.entities || []).map(c => `${c.title}@${c.depth}`);
  console.log('children on the day ->', JSON.stringify(titles));

  expect(titles, 'the dropped row is on the day').toContain('ZZZ any parent@0');
  expect(titles, "and its own child came with it").toContain('ZZZ any child@1');
  expect((day.entities || [])[0].typeSlug, 'it knows which type it is').toBe('tests');
  expect((day.entities || [])[0].icon, 'and carries that type icon').toBeTruthy();
});

test('unlinking removes it from the day but not from its own tab', async ({ page }) => {
  await page.goto('/?tab=tests', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const row = (await api(page, '/api/entities/tests', { method: 'POST', body: JSON.stringify({ title: 'ZZZ unlink me' }) })).body.data;
  made.entities.push(row.id);
  const work = (await api(page, '/api/work', { method: 'POST', body: JSON.stringify({ title: 'ZZZ unlink day', date: DAY }) })).body.data;
  made.work.push(work.id);

  await api(page, `/api/work/${work.id}/entities/${row.id}`, { method: 'POST' });
  await api(page, `/api/work/${work.id}/entities/${row.id}`, { method: 'DELETE' });

  const day = (await api(page, `/api/work/date/${DAY}`)).body.data.find(i => String(i.id) === String(work.id));
  expect((day.entities || []).length, 'off the day').toBe(0);

  const still = (await api(page, '/api/entities/tests')).body.data.some(e => String(e.id) === String(row.id));
  expect(still, 'the record itself is untouched - it was a reference').toBe(true);
});
