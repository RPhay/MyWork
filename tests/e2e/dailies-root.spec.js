import { test, expect } from '@playwright/test';

/**
 * A day is a PLACE, not a container you have to create first.
 *
 * Dropping a record on a day used to invent a work item named after it, so
 * everything on a day was wrapped in a daily whether or not one was wanted.
 * Records now sit on the day itself (daily_entities), and a daily is something
 * you create with "+ Daily" when you actually want to group work under one.
 *
 * The two paths that must stay distinct:
 *   - dropped on EMPTY SPACE  -> on the day, no work item
 *   - dropped on a DAILY'S ROW -> inside that daily, as before
 */

async function api(page, path, options = {}) {
  return page.evaluate(async ({ path, options, t }) => {
    const r = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': t, ...(options.headers || {}) },
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, { path, options, t: await page.evaluate(() => document.body.dataset.csrfToken || '') });
}

const today = () => new Date().toISOString().split('T')[0];

// Through the app's own handlers with a real DataTransfer: Playwright's HTML5
// drag emulation does not deliver a drop here. `onto` selects the drop target -
// the list itself is empty space, a row is that row.
async function drop(page, id, title, onto = '#workItemsList') {
  await page.evaluate(({ id, title, onto }) => {
    const dt = new DataTransfer();
    dt.setData('type', 'category'); dt.setData('id', String(id));
    dt.setData('name', title); dt.setData('text/plain', title);
    document.getElementById('dailiesCenterPane')
      .dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
    document.querySelector(onto)
      .dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, { id, title, onto });
  await page.waitForTimeout(600);
}

async function openDailies(page) {
  await page.goto('/?tab=area', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);
  if (!(await page.locator('#rail-daily').isVisible())) {
    await page.locator('button[data-rail-toggle="daily"]').click();
    await page.waitForTimeout(900);
  }
}

test.describe('Records on the day itself', () => {
  test.describe.configure({ mode: 'serial' });

  test.afterAll(async ({ browser }) => {
    // afterAll, not the end of a test body: a spec that tidies up on its last
    // line leaks every time an assertion fails earlier.
    const page = await browser.newPage();
    await page.goto('/?tab=area', { waitUntil: 'networkidle' });
    const items = (await api(page, `/api/dailies/date/${today()}`)).body?.data || [];
    for (const w of items.filter(x => (x.title || '').startsWith('ZZZroot') || x.title === 'New daily'))
      await api(page, `/api/dailies/${w.id}`, { method: 'DELETE' });
    const areas = (await api(page, '/api/entities/area')).body?.data || [];
    for (const a of areas.filter(x => (x.title || '').startsWith('ZZZroot')))
      await api(page, `/api/entities/area/${a.id}`, { method: 'DELETE' });
    await page.close();
  });

  test('a record dropped on empty space sits on the day, with no daily invented', async ({ page }) => {
    await openDailies(page);
    const rec = (await api(page, '/api/entities/area', {
      method: 'POST', body: JSON.stringify({ title: 'ZZZroot loose' }),
    })).body.data;
    await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1600);

    await drop(page, rec.id, 'ZZZroot loose');
    await expect(page.locator('#copyOrReferenceModal')).toBeVisible();
    await page.locator('#copyOrReferenceRefBtn').click();
    await page.waitForTimeout(1600);

    const items = (await api(page, `/api/dailies/date/${today()}`)).body.data;
    expect(items.find(w => w.title === 'ZZZroot loose'),
      'no work item is invented to hold it').toBeFalsy();

    const roots = (await api(page, `/api/dailies/date/${today()}/roots`)).body.data;
    expect(roots.some(r => r.id === rec.id && r.depth === 0),
      'it is on the day').toBe(true);

    // And it is drawn in the list, marked as being on the day rather than
    // inside something.
    await expect(page.locator(`.child-item-row[data-child-id="${rec.id}"][data-on-day="1"]`))
      .toHaveCount(1);
  });

  test('taking it off the day leaves the record alone', async ({ page }) => {
    await openDailies(page);
    await page.waitForTimeout(1200);

    const before = (await api(page, `/api/dailies/date/${today()}/roots`)).body.data;
    const target = before.find(r => r.title === 'ZZZroot loose');
    expect(target, 'the previous test left it on the day').toBeTruthy();

    await page.locator(`.child-item-row[data-child-id="${target.id}"] [data-action="unroot"]`).click();
    await page.waitForTimeout(1400);

    const after = (await api(page, `/api/dailies/date/${today()}/roots`)).body.data;
    expect(after.some(r => r.id === target.id), 'off the day').toBe(false);

    const areas = (await api(page, '/api/entities/area')).body.data;
    expect(areas.some(a => a.id === target.id), 'the record itself is untouched').toBe(true);
  });

  test('+ Daily creates a daily on the selected day', async ({ page }) => {
    await openDailies(page);

    const before = (await api(page, `/api/dailies/date/${today()}`)).body.data.length;
    await page.click('#addDailyBtn');
    await page.waitForTimeout(1800);

    const after = (await api(page, `/api/dailies/date/${today()}`)).body.data;
    expect(after.length, 'one more daily on the day').toBe(before + 1);

    // Straight into its editor, so it can be named without hunting for it.
    await expect(page.locator('#workItemEditorPane, #workItemEditorTitle').first())
      .toBeVisible({ timeout: 6000 });
  });

  test('a record dropped ON a daily still goes inside it', async ({ page }) => {
    await openDailies(page);

    const daily = (await api(page, '/api/dailies', {
      method: 'POST', body: JSON.stringify({ date: today(), title: 'ZZZroot holder' }),
    })).body.data;
    const rec = (await api(page, '/api/entities/area', {
      method: 'POST', body: JSON.stringify({ title: 'ZZZroot inside' }),
    })).body.data;
    await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1800);

    await drop(page, rec.id, 'ZZZroot inside', `.work-item[data-work-id="${daily.id}"]`);
    await expect(page.locator('#copyOrReferenceModal')).toBeVisible();
    await page.locator('#copyOrReferenceRefBtn').click();
    await page.waitForTimeout(1800);

    const items = (await api(page, `/api/dailies/date/${today()}`)).body.data;
    const holder = items.find(w => w.id === daily.id);
    expect((holder.entities || []).some(c => c.id === rec.id),
      'it went inside the daily, not onto the day').toBe(true);

    const roots = (await api(page, `/api/dailies/date/${today()}/roots`)).body.data;
    expect(roots.some(r => r.id === rec.id),
      'and it is NOT also loose on the day').toBe(false);
  });
});
