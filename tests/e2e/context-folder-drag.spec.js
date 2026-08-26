import { test, expect } from '@playwright/test';

/**
 * Dragging a context FOLDER nests it, or takes it back to the root.
 *
 * This was half-built: dragstart set a "folder-id" and the drop handler never
 * read it, so a folder could be picked up and then did nothing wherever it was
 * let go. The server side already existed - contextFolderService.updateFolder
 * takes parent_id and refuses both a folder as its own parent and a sub-folder
 * as the parent of its own ancestor - so only the drop was missing.
 */

const api = (page, url, opts = {}) => page.evaluate(async ({ url, opts }) => {
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'CSRF-Token': window.APP_CONFIG?.csrfToken,
      ...(opts.headers || {}),
    },
  });
  return { status: res.status, body: await res.json() };
}, { url, opts });

const made = [];

async function makeFolder(page, name) {
  const res = await api(page, '/api/context-folders', {
    method: 'POST', body: JSON.stringify({ name }),
  });
  expect(res.body.success, `created ${name}`).toBe(true);
  made.push(res.body.data.id);
  return res.body.data.id;
}

test.beforeEach(async ({ page }) => {
  // Contexts is a SETTINGS pane, not a dashboard tab.
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
});

test('a folder nests into another, and comes back out to the root', async ({ page }) => {
  const parent = await makeFolder(page, 'ZZZ drag parent');
  const child = await makeFolder(page, 'ZZZ drag child');

  const nested = await api(page, `/api/context-folders/${child}`, {
    method: 'PUT', body: JSON.stringify({ parent_id: parent }),
  });
  expect(nested.body.success, 'nesting accepted').toBe(true);

  let all = (await api(page, '/api/context-folders')).body.data;
  expect(all.find(f => f.id === child).parent_id, 'child sits under parent').toBe(parent);

  const rooted = await api(page, `/api/context-folders/${child}`, {
    method: 'PUT', body: JSON.stringify({ parent_id: null }),
  });
  expect(rooted.body.success, 'move to root accepted').toBe(true);

  all = (await api(page, '/api/context-folders')).body.data;
  expect(all.find(f => f.id === child).parent_id, 'back at the root').toBeNull();
});

test('a folder refuses to become its own parent, or its descendant\'s child', async ({ page }) => {
  const outer = await makeFolder(page, 'ZZZ cycle outer');
  const inner = await makeFolder(page, 'ZZZ cycle inner');

  await api(page, `/api/context-folders/${inner}`, {
    method: 'PUT', body: JSON.stringify({ parent_id: outer }),
  });

  const itself = await api(page, `/api/context-folders/${outer}`, {
    method: 'PUT', body: JSON.stringify({ parent_id: outer }),
  });
  expect(itself.body.success, 'own parent refused').toBe(false);

  // The cycle that matters: outer under its own descendant.
  const cycle = await api(page, `/api/context-folders/${outer}`, {
    method: 'PUT', body: JSON.stringify({ parent_id: inner }),
  });
  expect(cycle.body.success, 'ancestor under descendant refused').toBe(false);
});

test('the drop handler is wired for folders, not only contexts', async ({ page }) => {
  // The defect was purely client-side, so assert on the handler's effect: a
  // folder-id drag over the list background must be accepted (preventDefault),
  // which is what makes the drop fire at all.
  const accepted = await page.evaluate(() => {
    const list = document.getElementById('contextsList');
    if (!list) return 'no-list';
    const dt = new DataTransfer();
    dt.setData('folder-id', '1');
    const ev = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt });
    list.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  expect(accepted, 'dragover over the background accepts a folder').toBe(true);
});

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');
  for (const id of made.reverse()) {
    await api(page, `/api/context-folders/${id}`, { method: 'DELETE' });
  }
  await page.close();
});
