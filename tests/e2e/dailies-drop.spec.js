import { test, expect } from '@playwright/test';

/**
 * Dragging a typed row or a template onto the Dailies rail is how work gets
 * onto a day - the "+ Add" button is gone.
 *
 * This broke because the two ends disagreed about the payload: Dailies reads
 * `type`/`id`/`name` off the dataTransfer, the generic row drag set nothing at
 * all, and the template drag set only `template-id`. Dropping did nothing,
 * silently, in both cases.
 *
 * Driven with a real DataTransfer through the app's own handlers rather than
 * locator.dragTo(): the drag data and acceptance are verifiable that way, and
 * Playwright's HTML5 drag emulation does not deliver the drop here.
 */

const TYPES = [
  { slug: 'category', dropType: 'category', key: 'areas' },
  { slug: 'goal', dropType: 'goal', key: 'goals' },
  { slug: 'idea', dropType: 'idea', key: 'ideas' },
  // to_do/task/ticket were unlinkable until their junctions were bridged to
  // `entities` - the drop created the work item and lost the link, silently.
  { slug: 'to_do', dropType: 'todo', key: 'todos' },
  { slug: 'task', dropType: 'task', key: 'tasks' },
  { slug: 'ticket', dropType: 'ticket', key: 'tickets' },
];

async function api(page, path, options = {}) {
  return page.evaluate(async ({ path, options, t }) => {
    const r = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': t, ...(options.headers || {}) } });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, { path, options, t: await page.evaluate(() => document.body.dataset.csrfToken) });
}

const today = () => new Date().toISOString().slice(0, 10);

test.describe('Dropping onto Dailies', () => {
  test.describe.configure({ mode: 'serial' });

  test.afterEach(async ({ page }) => {
    await page.goto('/');
    const { body } = await api(page, `/api/work/date/${today()}`);
    for (const w of (body?.data || []).filter(x => (x.title || '').startsWith('ZZZ drop'))) {
      await api(page, `/api/work/${w.id}`, { method: 'DELETE' });
    }
    for (const slug of TYPES.map(t => t.slug)) {
      const all = (await api(page, `/api/entities/${slug}`)).body?.data || [];
      // 'ZZZ ', not 'ZZZ drop': the drag-payload case below creates
      // 'ZZZ payload', which this filter missed, so it was left behind on every
      // run of this file.
      for (const e of all.filter(x => (x.title || '').startsWith('ZZZ '))) {
        await api(page, `/api/entities/${slug}/${e.id}`, { method: 'DELETE' });
      }
    }
  });

  for (const type of TYPES) {
    test(`a ${type.slug} row dropped on an empty day lands on the day`, async ({ page }) => {
      await page.goto(`/?tab=${type.slug}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      const entity = (await api(page, `/api/entities/${type.slug}`, {
        method: 'POST', body: JSON.stringify({ title: `ZZZ drop ${type.slug}` }),
      })).body.data;
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      await page.evaluate(({ id, dropType, title }) => {
        const dt = new DataTransfer();
        dt.setData('type', dropType);
        dt.setData('id', String(id));
        dt.setData('name', title);
        dt.setData('text/plain', title);
        document.getElementById('dailiesCenterPane')
          .dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
        document.getElementById('workItemsList')
          .dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
      }, { id: entity.id, dropType: type.dropType, title: `ZZZ drop ${type.slug}` });

      // Every typed-row drop now asks copy or reference; take reference, which
      // is the behaviour these cases were written against.
      await page.locator('#copyOrReferenceRefBtn').click();
      await page.waitForTimeout(1400);

      // On the DAY. These cases were written when a drop on empty space
      // invented a work item named after the record; it no longer does, because
      // a day is a place rather than a container that must exist first. What
      // the case is really guarding is unchanged: every type's drag payload
      // arrives intact and the record ends up on the day. Dropping onto a
      // daily's ROW still puts it inside that daily - dailies-root.spec.js.
      const items = (await api(page, `/api/work/date/${today()}`)).body.data;
      expect(items.find(w => w.title === `ZZZ drop ${type.slug}`),
        `dropping a ${type.slug} must not invent a work item`).toBeFalsy();

      const roots = (await api(page, `/api/work/date/${today()}/roots`)).body.data;
      expect(roots.some(r => r.id === entity.id && r.depth === 0),
        `dropping a ${type.slug} should put it on the day`).toBe(true);
    });
  }

  test('the generic row drag publishes what Dailies reads', async ({ page }) => {
    await page.goto('/?tab=area');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await api(page, '/api/entities/area', { method: 'POST', body: JSON.stringify({ title: 'ZZZ payload' }) });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const payload = await page.evaluate(() => {
      const row = [...document.querySelectorAll('#areaEntityList .entity-row')]
        .find(r => r.textContent.includes('ZZZ payload'));
      const dt = new DataTransfer();
      row.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
      return { type: dt.getData('type'), id: dt.getData('id'), name: dt.getData('name') };
    });
    expect(payload.type).toBe('category');
    expect(payload.id).not.toBe('');
    expect(payload.name).toBe('ZZZ payload');
  });
});


/**
 * Copy vs reference. A typed row dropped on a day can be either, and the two
 * behave differently afterwards, so the drop asks:
 *   - reference -> links the original; editing it here edits the original
 *   - copy      -> an independent clone of the row AND everything nested in it
 * Templates never ask - a template is always a full copy.
 */
async function drop(page, id, title) {
  await page.evaluate(({id,title}) => {
    const dt = new DataTransfer();
    dt.setData('type','category'); dt.setData('id',String(id)); dt.setData('name',title); dt.setData('text/plain',title);
    document.getElementById('dailiesCenterPane').dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));
    document.getElementById('workItemsList').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));
  }, {id,title});
  await page.waitForTimeout(500);
}

// Serial, and prefixed uniquely: these create and delete Areas, and other specs
// in this suite do too - run in parallel they delete each other's fixtures.
test.describe('Copy vs reference', () => {
  test.describe.configure({ mode: 'serial' });

for (const mode of ['reference','copy']) {
  test(`dropping as a ${mode}`, async ({ page }) => {
    await page.goto('/?tab=area'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1600);
    const parent = (await api(page,'/api/entities/area',{method:'POST',body:JSON.stringify({title:`ZZZcr ${mode} src`})})).body.data;
    const child  = (await api(page,'/api/entities/area',{method:'POST',body:JSON.stringify({title:`ZZZcr ${mode} kid`})})).body.data;
    await api(page,`/api/entities/area/${child.id}/relationships`,{method:'POST',
      body:JSON.stringify({parentEntityId:parent.id, childEntityId:child.id, relationshipKind:'hierarchy'})});
    await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(1600);

    await drop(page, parent.id, `ZZZcr ${mode} src`);
    await expect(page.locator('#copyOrReferenceModal')).toBeVisible();
    await page.locator(mode === 'copy' ? '#copyOrReferenceCopyBtn' : '#copyOrReferenceRefBtn').click();
    await page.waitForTimeout(1600);

    // Dropped on empty space, so it lands ON THE DAY - no work item is invented
    // to hold it. This used to assert the opposite: the drop created a work
    // item named after the record, whether or not one was wanted. A day is a
    // place, not a container that has to be created first. Dropping onto a
    // daily's ROW still puts it inside that daily, which the tests above cover.
    const items = (await api(page,`/api/work/date/${today()}`)).body.data;
    expect(items.find(w => w.title === `ZZZcr ${mode} src`),
      'no work item is invented for a record dropped on the day').toBeFalsy();

    const roots = (await api(page,`/api/work/date/${today()}/roots`)).body.data;
    const linked = roots.find(r => r.depth === 0 && r.title === `ZZZcr ${mode} src`);
    expect(linked, 'the record is on the day').toBeTruthy();

    const areas = (await api(page,'/api/entities/area')).body.data;
    if (mode === 'reference') {
      expect(linked.id).toBe(parent.id);
      expect(linked.isCopy).toBe(false);
      expect(areas.filter(a=>a.title===`ZZZcr ${mode} src`).length).toBe(1);   // nothing duplicated
    } else {
      expect(linked.id).not.toBe(parent.id);
      expect(linked.isCopy).toBe(true);
      expect(areas.filter(a=>a.title===`ZZZcr ${mode} src`).length).toBe(2);   // original + copy
      expect(areas.filter(a=>a.title===`ZZZcr ${mode} kid`).length).toBe(2);   // child copied too
    }
    // What came down with it is there too, one level in.
    expect(roots.some(r => r.depth > 0 && r.title === `ZZZcr ${mode} kid`),
      'the tree beneath it came along').toBe(true);
    console.log(mode, '->', JSON.stringify({linkedId: linked.id, srcId: parent.id, isCopy: linked.isCopy}));

    // Badge rendered - on the ROOT of the dropped tree, and ONLY there.
    // Whatever came down with the drop is the same kind by construction, so a
    // badge on every descendant states one fact once per row instead of once
    // per drop, and reads as though each level were an independent choice.
    const badge = await page.locator(`.child-item-row[data-origin="${mode}"][data-depth="0"] .child-origin`).count();
    expect(badge, 'the root of the dropped tree carries the icon').toBeGreaterThan(0);
    const nested = await page.locator(`.child-item-row[data-origin="${mode}"]:not([data-depth="0"]) .child-origin`).count();
    expect(nested, 'nothing below the root repeats it').toBe(0);

    for (const w of items.filter(x=>(x.title||'').startsWith('ZZZcr'))) await api(page,`/api/work/${w.id}`,{method:'DELETE'});
    for (const a of areas.filter(x=>(x.title||'').startsWith('ZZZcr'))) await api(page,`/api/entities/area/${a.id}`,{method:'DELETE'});
  });
}
});
