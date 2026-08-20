import { test, expect } from '@playwright/test';

/**
 * A day can hold a row of ANY type, including one the user created, and the row
 * arrives with its tree intact.
 *
 * Before this, Dailies linked children through seven per-type junction tables.
 * A type invented later had no table and no route, so dropping it on a day did
 * nothing at all - silently, because the handler simply returned.
 */

// Today: the rail has no date input - it opens on today and reads that, so a
// fixture on any other date is invisible to the UI half of these tests.
const DAY = new Date().toISOString().slice(0, 10);

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

// Copy means DEEP copy here too: everything that came across is independent,
// so nothing inside it may read as a reference to the original.
test('a subtree copied onto a day is copies all the way down', async ({ page }) => {
  await page.goto('/?tab=tests', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const parent = (await api(page, '/api/entities/tests', { method: 'POST', body: JSON.stringify({ title: 'ZZZ dcopy parent' }) })).body.data;
  const child = (await api(page, '/api/entities/tests', { method: 'POST', body: JSON.stringify({ title: 'ZZZ dcopy child' }) })).body.data;
  made.entities.push(parent.id, child.id);
  await api(page, `/api/entities/tests/${child.id}/relationships`, {
    method: 'POST',
    body: JSON.stringify({ parentEntityId: parent.id, childEntityId: child.id, relationshipKind: 'hierarchy' }),
  });

  // Clone it, exactly as choosing "Copy" on a drop does, then put the clone on
  // a day and read back what the day says about each row.
  const clone = (await api(page, `/api/entities/tests/${parent.id}/clone`, { method: 'POST' })).body.data;
  made.entities.push(clone.id);
  const work = (await api(page, '/api/work', { method: 'POST', body: JSON.stringify({ title: 'ZZZ dcopy day', date: DAY }) })).body.data;
  made.work.push(work.id);
  await api(page, `/api/work/${work.id}/entities/${clone.id}`, { method: 'POST' });

  const day = (await api(page, `/api/work/date/${DAY}`)).body.data.find(i => String(i.id) === String(work.id));
  const rows = (day.entities || []);
  const origins = rows.map(c => `${c.title}@${c.depth}=${c.isCopy ? 'copy' : 'reference'}`);
  console.log('day rows ->', JSON.stringify(origins));
  rows.forEach(r => made.entities.push(r.id));

  expect(rows.length, 'the child came with it').toBeGreaterThanOrEqual(2);
  expect(rows.filter(r => !r.isCopy).map(r => r.title),
    'a deep copy has no references inside it').toEqual([]);
});

test('a subtree REFERENCED onto a day is references all the way down', async ({ page }) => {
  await page.goto('/?tab=tests', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const parent = (await api(page, '/api/entities/tests', { method: 'POST', body: JSON.stringify({ title: 'ZZZ dref parent' }) })).body.data;
  const child = (await api(page, '/api/entities/tests', { method: 'POST', body: JSON.stringify({ title: 'ZZZ dref child' }) })).body.data;
  made.entities.push(parent.id, child.id);
  await api(page, `/api/entities/tests/${child.id}/relationships`, {
    method: 'POST',
    body: JSON.stringify({ parentEntityId: parent.id, childEntityId: child.id, relationshipKind: 'hierarchy' }),
  });

  const work = (await api(page, '/api/work', { method: 'POST', body: JSON.stringify({ title: 'ZZZ dref day', date: DAY }) })).body.data;
  made.work.push(work.id);
  await api(page, `/api/work/${work.id}/entities/${parent.id}`, { method: 'POST' });

  const day = (await api(page, `/api/work/date/${DAY}`)).body.data.find(i => String(i.id) === String(work.id));
  const rows = (day.entities || []);
  console.log('day rows ->', JSON.stringify(rows.map(c => `${c.title}@${c.depth}=${c.isCopy ? 'copy' : 'reference'}`)));
  expect(rows.filter(r => r.isCopy).map(r => r.title),
    'referencing copies nothing').toEqual([]);
});

// A day's children can be reordered, but only among their OWN level: moving a
// child out to the root, or a root item down into a tree, are different things
// and neither is a reorder.
test('a day\'s children reorder, and the order sticks', async ({ page }) => {
  await page.goto('/?tab=tests', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const rows = [];
  for (const t of ['ZZZ ord one', 'ZZZ ord two', 'ZZZ ord three']) {
    rows.push((await api(page, '/api/entities/tests', { method: 'POST', body: JSON.stringify({ title: t }) })).body.data);
  }
  made.entities.push(...rows.map(r => r.id));
  const work = (await api(page, '/api/work', { method: 'POST', body: JSON.stringify({ title: 'ZZZ ord day', date: DAY }) })).body.data;
  made.work.push(work.id);
  for (const r of rows) await api(page, `/api/work/${work.id}/entities/${r.id}`, { method: 'POST' });

  const titles = async () => (await api(page, `/api/work/date/${DAY}`)).body.data
    .find(i => String(i.id) === String(work.id)).entities.map(c => c.title);
  expect(await titles()).toEqual(['ZZZ ord one', 'ZZZ ord two', 'ZZZ ord three']);

  // Put the last one first.
  const res = await api(page, `/api/work/${work.id}/entities/order`, {
    method: 'PATCH',
    body: JSON.stringify({ orderedIds: [rows[2].id, rows[0].id, rows[1].id] }),
  });
  expect(res.status, 'the order endpoint accepts it').toBe(200);

  const after = await titles();
  console.log('order after ->', JSON.stringify(after));
  expect(after, 'the new order is what comes back').toEqual(['ZZZ ord three', 'ZZZ ord one', 'ZZZ ord two']);
});

test('a child dropped outside its own level is refused', async ({ page }) => {
  await page.goto('/?tab=tests', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const parent = (await api(page, '/api/entities/tests', { method: 'POST', body: JSON.stringify({ title: 'ZZZ lvl parent' }) })).body.data;
  const child = (await api(page, '/api/entities/tests', { method: 'POST', body: JSON.stringify({ title: 'ZZZ lvl child' }) })).body.data;
  made.entities.push(parent.id, child.id);
  await api(page, `/api/entities/tests/${child.id}/relationships`, {
    method: 'POST',
    body: JSON.stringify({ parentEntityId: parent.id, childEntityId: child.id, relationshipKind: 'hierarchy' }),
  });
  const work = (await api(page, '/api/work', { method: 'POST', body: JSON.stringify({ title: 'ZZZ lvl day', date: DAY }) })).body.data;
  made.work.push(work.id);
  await api(page, `/api/work/${work.id}/entities/${parent.id}`, { method: 'POST' });

  await page.goto('/?tab=tests', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  // Only if it is not already up: clicking an open rail CLOSES it, and Dailies
  // opens by default.
  if (!(await page.locator('#rail-work_item.active').count())) {
    await page.locator('button[data-rail-toggle="work_item"]').click();
  }
  await page.waitForTimeout(1800);

  // Children only render inside an EXPANDED work item, and one click expands.
  await page.locator(`.work-item[data-work-id="${work.id}"] .work-item-header`).first().click();
  await page.waitForTimeout(900);

  const kid = page.locator(`.child-item-row[data-child-id="${child.id}"]`);
  await expect(kid, 'the grandchild is on the day').toHaveCount(1);

  // Drag the grandchild onto the ROOT work item - a level change, not a reorder.
  await page.evaluate(({ childId, workId }) => {
    const src = document.querySelector(`.child-item-row[data-child-id="${childId}"] .work-item-header`);
    const dst = document.querySelector(`.work-item[data-work-id="${workId}"] .work-item-header`);
    const dt = new DataTransfer();
    const fire = (el, name) => el.dispatchEvent(new DragEvent(name, {
      bubbles: true, cancelable: true, dataTransfer: dt,
      clientX: el.getBoundingClientRect().left + 5,
      clientY: el.getBoundingClientRect().top + 5 }));
    fire(src, 'dragstart'); fire(dst, 'dragover'); fire(dst, 'drop'); fire(src, 'dragend');
  }, { childId: child.id, workId: work.id });
  await page.waitForTimeout(1200);

  // Nothing changed: the record is still inside its parent, not on the day.
  const day = (await api(page, `/api/work/date/${DAY}`)).body.data.find(i => String(i.id) === String(work.id));
  const depths = (day.entities || []).map(c => `${c.title}@${c.depth}`);
  console.log('after the refused drop ->', JSON.stringify(depths));
  expect(depths, 'the tree is unchanged').toContain('ZZZ lvl child@1');
});
