import { test, expect } from '@playwright/test';
import { purgeByTitlePrefix } from './helpers/cleanup.js';

/**
 * Templates are containers you make deliberately with "+ Template", the way a
 * folder is. Rows are dropped INTO one, and the template is then the reusable
 * thing you drop onto a day.
 *
 * Two rules this covers:
 *   - dropping on the templates ROOT does nothing. It used to invent a template
 *     named after whatever was dropped, so templates appeared by accident.
 *   - a row dropped in keeps its TREE. The relationship fetch used to return
 *     only edges whose parent was a template, so a Project arrived with its
 *     children present in the payload but no edges to place them by, and the
 *     tree was silently flattened.
 */

async function api(page, url, opts = {}) {
  return page.evaluate(async ({ url, opts }) => {
    const res = await fetch(url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', 'CSRF-Token': window.APP_CONFIG?.csrfToken },
    });
    return res.json();
  }, { url, opts });
}

async function nest(page, slug, parentId, childId) {
  return api(page, `/api/entities/${slug}/${childId}/relationships`, {
    method: 'POST',
    body: JSON.stringify({ parentEntityId: parentId, childEntityId: childId, relationshipKind: 'hierarchy' }),
  });
}

// Drops carry `type`/`id`/`name`, the payload every draggable row publishes.
async function dropOn(page, targetSelector, payload) {
  await page.evaluate(({ targetSelector, payload }) => {
    const target = document.querySelector(targetSelector);
    const dt = new DataTransfer();
    for (const [k, v] of Object.entries(payload)) dt.setData(k, String(v));
    const r = target.getBoundingClientRect();
    const at = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    for (const name of ['dragover', 'drop']) {
      target.dispatchEvent(new DragEvent(name, { bubbles: true, cancelable: true, dataTransfer: dt, ...at }));
    }
  }, { targetSelector, payload });
}

test.afterEach(async ({ page }) => {
  await purgeByTitlePrefix(page, 'template', 'ZZZ');
  await purgeByTitlePrefix(page, 'priority', 'ZZZ');
  await purgeByTitlePrefix(page, 'tests', 'ZZZ');
});

test('a row dropped on the templates root is refused, not turned into a template', async ({ page }) => {
  await page.goto('/?tab=priority', { waitUntil: 'networkidle' });
  const proj = (await api(page, '/api/entities/priority', {
    method: 'POST', body: JSON.stringify({ title: 'ZZZ root drop' }),
  })).data;

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);
  await page.locator('button[data-rail-toggle="template"]').click();
  await page.waitForTimeout(800);

  const before = ((await api(page, '/api/entities/template')).data || []).length;
  await dropOn(page, '#templateEntityList', { type: 'priority', id: proj.id, name: 'ZZZ root drop' });
  await page.waitForTimeout(1200);

  const after = ((await api(page, '/api/entities/template')).data || []).length;
  expect(after, 'no template should be created by dropping on the root').toBe(before);
});

test('a row dropped into a template keeps its tree', async ({ page }) => {
  await page.goto('/?tab=priority', { waitUntil: 'networkidle' });

  // Project with a child, and a template to drop it into.
  const parent = (await api(page, '/api/entities/priority', { method: 'POST', body: JSON.stringify({ title: 'ZZZ tree parent' }) })).data;
  const child = (await api(page, '/api/entities/priority', { method: 'POST', body: JSON.stringify({ title: 'ZZZ tree child' }) })).data;
  await nest(page, 'priority', parent.id, child.id);
  const tpl = (await api(page, '/api/entities/template', { method: 'POST', body: JSON.stringify({ title: 'ZZZ holder' }) })).data;

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);
  await page.locator('button[data-rail-toggle="template"]').click();
  await page.waitForTimeout(900);

  // Reference, not copy - the dialog offers both.
  const rowSel = `#templateEntityList .entity-row[data-entity-id="${tpl.id}"]`;
  await expect(page.locator(rowSel)).toHaveCount(1);
  await dropOn(page, rowSel, { type: 'priority', id: parent.id, name: 'ZZZ tree parent' });
  await page.locator('#copyOrReferenceRefBtn').click();
  await page.waitForTimeout(1500);

  // The edges the template's own fetch returns must reach the grandchild.
  const edges = (await api(page, '/api/entities/template/relationships')).data || [];
  const underTemplate = edges.some(e => String(e.parent_entity_id) === String(tpl.id)
    && String(e.child_entity_id) === String(parent.id));
  const underParent = edges.some(e => String(e.parent_entity_id) === String(parent.id)
    && String(e.child_entity_id) === String(child.id));
  console.log(`edges -> template>parent: ${underTemplate}, parent>child: ${underParent}`);

  expect(underTemplate, 'the dropped row is inside the template').toBe(true);
  expect(underParent, "the dropped row's own children come with it").toBe(true);
});

// A template may contain any editable type. That rule is enumerated per child
// type, so it could only ever list the types that existed when it was written -
// a type created afterwards was refused, silently, because the drop is gated on
// these rules. Creating a type now adds the row.
test('a type created by the user can be put into a template', async ({ page }) => {
  await page.goto('/?tab=tests', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);

  const rules = (await api(page, '/api/entity-types')).data
    .find(t => t.slug === 'template');
  const allowed = (rules.relationships || [])
    .filter(r => r.relationship_kind === 'hierarchy')
    .map(r => r.child_type_id);
  const testsType = (await api(page, '/api/entity-types')).data.find(t => t.slug === 'tests');
  console.log('template accepts tests ->', allowed.includes(testsType.id));

  // The real proof: drop one in and see the edge stored.
  const row = (await api(page, '/api/entities/tests', { method: 'POST', body: JSON.stringify({ title: 'ZZZ into template' }) })).data;
  const tpl = (await api(page, '/api/entities/template', { method: 'POST', body: JSON.stringify({ title: 'ZZZ holder 2' }) })).data;

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.locator('button[data-rail-toggle="template"]').click();
  await page.waitForTimeout(900);

  const rowSel = `#templateEntityList .entity-row[data-entity-id="${tpl.id}"]`;
  await expect(page.locator(rowSel)).toHaveCount(1);
  await dropOn(page, rowSel, { type: 'tests', id: row.id, name: 'ZZZ into template' });
  await page.locator('#copyOrReferenceRefBtn').click();
  await page.waitForTimeout(1500);

  const edges = (await api(page, '/api/entities/template/relationships')).data || [];
  const inside = edges.some(e => String(e.parent_entity_id) === String(tpl.id)
    && String(e.child_entity_id) === String(row.id));
  expect(inside, 'a user-created type belongs in a template like any other').toBe(true);
});

// A row keeps its TREE when it lands in a template, whatever its type.
//
// Two things had to be true and only one was: the edges are fetched (they are),
// and the template renders as a tree. `template.supports_hierarchy` was 0 in the
// database while its own rules declared eight types as allowed children - so the
// renderer took its FLAT branch and the client never fetched the edges at all.
test('a new type keeps its tree inside a template', async ({ page }) => {
  await page.goto('/?tab=tests', { waitUntil: 'networkidle' });
  const parent = (await api(page, '/api/entities/tests', { method: 'POST', body: JSON.stringify({ title: 'ZZZu parent' }) })).data;
  const child = (await api(page, '/api/entities/tests', { method: 'POST', body: JSON.stringify({ title: 'ZZZu child' }) })).data;
  await api(page, `/api/entities/tests/${child.id}/relationships`, { method: 'POST',
    body: JSON.stringify({ parentEntityId: parent.id, childEntityId: child.id, relationshipKind: 'hierarchy' }) });
  const tpl = (await api(page, '/api/entities/template', { method: 'POST', body: JSON.stringify({ title: 'ZZZu holder' }) })).data;
  await api(page, `/api/entities/template/${parent.id}/relationships`, { method: 'POST',
    body: JSON.stringify({ parentEntityId: tpl.id, childEntityId: parent.id, relationshipKind: 'hierarchy' }) });

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);
  await page.locator('button[data-rail-toggle="template"]').click();
  await page.waitForTimeout(1400);
  // Expand so nested rows are in view.
  await page.locator('#expandAlltemplateBtn').click().catch(() => {});
  await page.waitForTimeout(900);

  const depths = await page.evaluate((ids) => ids.map(id => {
    const row = document.querySelector(`#templateEntityList .entity-row[data-entity-id="${id}"]`);
    return row ? Number(row.dataset.depth) : null;
  }), [tpl.id, parent.id, child.id]);
  console.log('depths [template, parent, child] ->', JSON.stringify(depths));

  await page.evaluate(async (ids) => {
    const csrf = window.APP_CONFIG?.csrfToken;
    for (const [slug, id] of ids) {
      await fetch(`/api/entities/${slug}/${id}`, { method: 'DELETE', headers: { 'CSRF-Token': csrf } });
      await fetch(`/api/trash/${id}`, { method: 'DELETE', headers: { 'CSRF-Token': csrf } });
    }
  }, [['tests', child.id], ['tests', parent.id], ['template', tpl.id]]);

  expect(depths[0], 'the template is a root').toBe(0);
  expect(depths[1], 'the dropped row sits inside it').toBe(1);
  expect(depths[2], "and its own child comes with it").toBe(2);
});
