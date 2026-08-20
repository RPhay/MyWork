import { test, expect } from '@playwright/test';

// Column order and editor field order are ONE value (entity_type_fields.
// display_order) shown in two places. Dragging a column header used to move the
// columns while the open editor kept the old order, because the header drag
// rewrote each field's display_order but never re-sorted the in-memory schema
// the editor renders from - and the editor did not sort at all, it relied on
// the API handing fields back already ordered.
//
// Both directions are asserted: the open editor updating at once, and the order
// surviving a close/reopen (which is what the missing sort broke).

const TYPE = 'priority';

async function fieldOrder(page) {
  return page.locator(`#${TYPE}EditorPane .editor-field`).evaluateAll(
    els => els.map(e => e.dataset.fieldKey)
  );
}

async function columnOrder(page) {
  return page.locator(`#tab-${TYPE} .entity-header-cell`).evaluateAll(
    els => els.map(e => e.dataset.colKey)
  );
}

// Drag one column header onto another. A real HTML5 drag needs a shared
// DataTransfer across dragstart/dragover/drop, which page.evaluate gives us.
async function dragColumn(page, fromKey, toKey) {
  await page.evaluate(({ from, to, type }) => {
    const root = document.getElementById(`tab-${type}`);
    const src = root.querySelector(`.entity-header-cell[data-col-key="${from}"]`);
    const dst = root.querySelector(`.entity-header-cell[data-col-key="${to}"]`);
    const dt = new DataTransfer();
    const ev = (el, name, extra = {}) => el.dispatchEvent(
      new DragEvent(name, { bubbles: true, cancelable: true, dataTransfer: dt, ...extra })
    );
    ev(src, 'dragstart');
    const r = dst.getBoundingClientRect();
    // Left of the midpoint, so the drop lands BEFORE the target.
    ev(dst, 'dragover', { clientX: r.left + 2, clientY: r.top + r.height / 2 });
    ev(dst, 'drop',     { clientX: r.left + 2, clientY: r.top + r.height / 2 });
    ev(src, 'dragend');
  }, { from: fromKey, to: toKey, type: TYPE });
  await page.waitForTimeout(1500);   // the reorder PUTs one field at a time
}

test('dragging a column header reorders the open editor immediately', async ({ page }) => {
  await page.goto(`/?tab=${TYPE}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);

  await page.click(`#add${TYPE}Btn`);
  const title = page.locator('#entity-editor-form input[name="title"]');
  await title.fill('ZZZ colsync');
  await title.dispatchEvent('input');
  await page.click(`#${TYPE}SaveBtn`);
  await page.waitForTimeout(1200);

  const before = await fieldOrder(page);
  test.skip(before.length < 2, 'needs at least two editor fields to reorder');

  const cols = await columnOrder(page);
  // Move the last field-backed column to the front of the field columns.
  const movable = cols.filter(k => k !== 'title' && before.includes(k));
  test.skip(movable.length < 2, 'needs at least two field columns');
  const [firstCol] = movable;
  const lastCol = movable[movable.length - 1];

  await dragColumn(page, lastCol, firstCol);

  const afterCols = await columnOrder(page);
  const afterFields = await fieldOrder(page);

  expect(afterCols.indexOf(lastCol),
    'the column itself should have moved').toBeLessThan(afterCols.indexOf(firstCol));

  // The point of the fix: the editor, still open, agrees with the columns.
  const editorCols = afterCols.filter(k => afterFields.includes(k));
  expect(afterFields.filter(k => editorCols.includes(k)),
    'open editor should match the new column order').toEqual(editorCols);

  // ...and it survives a reopen, which is what the missing sort broke.
  await page.locator(`#${TYPE}EntityList .entity-row`)
    .filter({ hasText: 'ZZZ colsync' }).first().locator('.entity-cell-title').dblclick();
  await page.waitForTimeout(400);
  await page.locator(`#${TYPE}EntityList .entity-row`)
    .filter({ hasText: 'ZZZ colsync' }).first().locator('.entity-cell-title').dblclick();
  await page.waitForTimeout(800);
  expect((await fieldOrder(page)).filter(k => editorCols.includes(k)),
    'reopened editor should still match').toEqual(editorCols);
});

// The rows this creates are the user's real data if left behind.
test.afterEach(async ({ page }) => {
  await page.evaluate(async () => {
    const csrf = window.APP_CONFIG?.csrfToken;
    const res = await fetch('/api/entities/priority');
    const body = await res.json();
    for (const e of (body.data || []).filter(x => (x.title || '').startsWith('ZZZ colsync'))) {
      await fetch(`/api/entities/priority/${e.id}`, {
        method: 'DELETE', headers: { 'CSRF-Token': csrf },
      });
    }
  });
});
