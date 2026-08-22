import { test, expect } from '@playwright/test';
import { dblclick } from './dblclick.js';

/**
 * What may share the screen, and how you ask for it:
 *
 *   Dailies   + an editable type - select the rail, then click the type
 *   Templates + an editable type - the same; Templates pairs like Dailies
 *   Dailies + Templates          - cmd/alt + click
 *   Dailies + Priorities         - cmd/alt + click
 *
 * Every rail pairs with a type. Two rails only sit together WITH Dailies. A
 * plain click on any of the three deselects everything else. Clicking a type tab shows that type,
 * or puts it away if it was already the one showing - and the rail then fills
 * the width.
 */

const RAILS = ['work_item', 'template', 'priority-board'];

async function shown(page) {
  return page.evaluate((slugs) => {
    const rails = slugs.filter(s => {
      const el = document.getElementById(`rail-${s}`);
      return el && el.classList.contains('active');
    });
    const content = document.getElementById('mainTabContent');
    const typeShowing = content && !content.classList.contains('rail-hidden');
    return typeShowing ? [...rails, 'TYPE'] : rails;
  }, RAILS);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?tab=idea', { waitUntil: 'networkidle' });
  await page.evaluate((slugs) => slugs.forEach(s => localStorage.setItem(`rail:${s}`, 'false')), RAILS);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
});

test('a plain click on a rail deselects everything else', async ({ page }) => {
  await page.locator('button[data-rail-toggle="work_item"]').click();
  await page.waitForTimeout(500);
  expect(await shown(page), 'Dailies alone').toEqual(['work_item']);

  await page.locator('button[data-rail-toggle="template"]').click();
  await page.waitForTimeout(500);
  expect(await shown(page), 'Templates replaces it').toEqual(['template']);

  await page.locator('button[data-rail-toggle="priority-board"]').click();
  await page.waitForTimeout(500);
  expect(await shown(page), 'Priorities replaces that').toEqual(['priority-board']);
});

test('Dailies pairs with a type by simply clicking the type', async ({ page }) => {
  await page.locator('button[data-rail-toggle="work_item"]').click();
  await page.waitForTimeout(500);

  await page.locator('button[data-tab="idea"]').click();
  await page.waitForTimeout(700);
  expect(await shown(page), 'no modifier needed for Dailies + a type').toEqual(['work_item', 'TYPE']);
});

test('Templates and Priorities pair with Dailies only, and only with cmd/alt', async ({ page }) => {
  await page.locator('button[data-rail-toggle="work_item"]').click();
  await page.waitForTimeout(500);

  await page.locator('button[data-rail-toggle="template"]').click({ modifiers: ['Meta'] });
  await page.waitForTimeout(600);
  expect(await shown(page), 'Dailies + Templates').toEqual(['work_item', 'template']);

  // Priorities may not join them - it takes the slot beside Dailies.
  await page.locator('button[data-rail-toggle="priority-board"]').click({ modifiers: ['Meta'] });
  await page.waitForTimeout(600);
  expect(await shown(page), 'Priorities replaces Templates beside Dailies')
    .toEqual(['work_item', 'priority-board']);
});

test('a type tab toggles: shows, swaps, and puts away', async ({ page }) => {
  await page.locator('button[data-rail-toggle="work_item"]').click();
  await page.waitForTimeout(500);

  await page.locator('button[data-tab="idea"]').click();
  await page.waitForTimeout(700);
  expect(await shown(page)).toEqual(['work_item', 'TYPE']);

  // A DIFFERENT type: still showing, now that one.
  await page.locator('button[data-tab="goal"]').click();
  await page.waitForTimeout(700);
  expect(await shown(page), 'swapping types keeps the type pane').toEqual(['work_item', 'TYPE']);
  await expect(page.locator('#tab-goal')).toHaveClass(/active/);

  // The SAME type again: put away, leaving Dailies.
  await page.locator('button[data-tab="goal"]').click();
  await page.waitForTimeout(700);
  expect(await shown(page), 'clicking the type you are on puts it away').toEqual(['work_item']);
});

test('Templates pairs with a type, the same way Dailies does', async ({ page }) => {
  await page.locator('button[data-rail-toggle="template"]').click();
  await page.waitForTimeout(500);
  expect(await shown(page)).toEqual(['template']);

  await page.locator('button[data-tab="idea"]').click();
  await page.waitForTimeout(700);
  expect(await shown(page), 'Templates stays, the type joins it').toEqual(['template', 'TYPE']);

  // ...and the type still toggles away, leaving Templates full width.
  await page.locator('button[data-tab="idea"]').click();
  await page.waitForTimeout(700);
  expect(await shown(page)).toEqual(['template']);
});

test('Priorities pairs with a type too', async ({ page }) => {
  await page.locator('button[data-rail-toggle="priority-board"]').click();
  await page.waitForTimeout(500);
  expect(await shown(page)).toEqual(['priority-board']);

  await page.locator('button[data-tab="idea"]').click();
  await page.waitForTimeout(700);
  expect(await shown(page), 'the board stays, the type joins it').toEqual(['priority-board', 'TYPE']);

  await page.locator('button[data-tab="idea"]').click();
  await page.waitForTimeout(700);
  expect(await shown(page), 'and the type toggles away again').toEqual(['priority-board']);
});

// Putting the type pane away leaves one pane, and one pane has nothing to split
// the width with - it should fill the space rather than sit at half width with
// dead space beside it.
test('a lone rail fills the width once the type pane is put away', async ({ page }) => {
  await page.locator('button[data-rail-toggle="work_item"]').click();
  await page.waitForTimeout(500);
  await page.locator('button[data-tab="idea"]').click();
  await page.waitForTimeout(700);

  const shellWidth = await page.locator('#appShell').evaluate(el => el.getBoundingClientRect().width);
  const paired = await page.locator('#rail-work_item').evaluate(el => el.getBoundingClientRect().width);
  expect(paired, 'sharing with the type pane, it takes about half').toBeLessThan(shellWidth * 0.8);

  // Put the type away - the rail should now take (nearly) everything.
  await page.locator('button[data-tab="idea"]').click();
  await page.waitForTimeout(700);
  const alone = await page.locator('#rail-work_item').evaluate(el => el.getBoundingClientRect().width);
  console.log(`rail width: paired=${Math.round(paired)} alone=${Math.round(alone)} shell=${Math.round(shellWidth)}`);
  expect(alone, 'alone, it fills the space').toBeGreaterThan(shellWidth * 0.9);
});

// Reporting takes the whole screen and stands the rails down while it is open.
// Asking for a rail is asking to leave it - the toggle used to be stored while
// apply() filtered every rail out, so there was no way back.
test('a rail can be reached again after opening Reporting', async ({ page }) => {
  await page.locator('button[data-rail-toggle="work_item"]').click();
  await page.waitForTimeout(500);
  expect(await shown(page)).toEqual(['work_item']);

  await page.locator('button[data-tab="reporting"]').click();
  await page.waitForTimeout(800);
  expect(await shown(page), 'Reporting owns the screen').toEqual(['TYPE']);

  await page.locator('button[data-rail-toggle="work_item"]').click();
  await page.waitForTimeout(800);
  expect(await shown(page), 'and Dailies comes back when asked for').toEqual(['work_item']);

  // The other two as well.
  await page.locator('button[data-tab="reporting"]').click();
  await page.waitForTimeout(700);
  await page.locator('button[data-rail-toggle="priority-board"]').click();
  await page.waitForTimeout(800);
  expect(await shown(page), 'Priorities too').toEqual(['priority-board']);
});

// Which panes you have open is a choice, and a refresh should not undo it. The
// rail toggles were stored; whether the type pane was showing was not, so a
// pane deliberately put away came back on reload.
test('pane choices survive a hard refresh', async ({ page }) => {
  await page.locator('button[data-rail-toggle="work_item"]').click();
  await page.waitForTimeout(500);
  await page.locator('button[data-tab="idea"]').click();
  await page.waitForTimeout(700);
  expect(await shown(page)).toEqual(['work_item', 'TYPE']);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  expect(await shown(page), 'rail + type comes back').toEqual(['work_item', 'TYPE']);

  // Put the type away, refresh again: it must STAY away.
  await page.locator('button[data-tab="idea"]').click();
  await page.waitForTimeout(700);
  expect(await shown(page)).toEqual(['work_item']);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  expect(await shown(page), 'a pane put away stays away').toEqual(['work_item']);

  // Two rails survive too.
  await page.locator('button[data-rail-toggle="template"]').click({ modifiers: ['Meta'] });
  await page.waitForTimeout(600);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  expect(await shown(page), 'a pair of rails comes back').toEqual(['work_item', 'template']);
});

// Two clicks on a type tab means "just this" - every rail stands down.
test('double-clicking a type tab leaves it the only pane', async ({ page }) => {
  await page.locator('button[data-rail-toggle="work_item"]').click();
  await page.waitForTimeout(500);
  await page.locator('button[data-rail-toggle="template"]').click({ modifiers: ['Meta'] });
  await page.waitForTimeout(600);
  expect(await shown(page), 'two rails to start').toEqual(['work_item', 'template']);

  await dblclick(page.locator('button[data-tab="idea"]'));
  await page.waitForTimeout(900);
  expect(await shown(page), 'the type has the screen').toEqual(['TYPE']);
  await expect(page.locator('#tab-idea')).toHaveClass(/active/);
});
