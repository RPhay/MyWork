import { test, expect } from '@playwright/test';
import { dblclick } from './dblclick.js';

/**
 * What may share the screen, and how you ask for it.
 *
 * Four panes exist - three rails (Dailies, Templates, Priorities) and the type
 * pane, holding whichever type tab is current. TWO show at a time, and every
 * pair is legal EXCEPT Templates + Priorities.
 *
 * One plain click on any tab decides the layout, by one rule:
 *
 *   not showing            -> it joins what is on screen if the two may share,
 *                             otherwise it takes the screen alone
 *   showing beside another -> it takes the screen alone
 *   showing on its own     -> the pane that stepped aside comes back
 *
 * The last two make ONE tab a toggle between the pair and that pane alone, and
 * clicking the OTHER tab of a pair collapses to that half instead. No modifier
 * key anywhere, and no click leaves a blank screen. Clicking a type tab OTHER
 * than the one showing is a switch, not a toggle.
 */

const RAILS = ['daily', 'template', 'priority-board'];

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
  await page.evaluate((slugs) => {
    slugs.forEach(s => localStorage.setItem(`rail:${s}`, 'false'));
    localStorage.setItem('typePaneVisible', 'true');
    localStorage.removeItem('paneRecency');
  }, RAILS);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
});

test('clicking a second tab shows both, and clicking either one collapses to it', async ({ page }) => {
  // The type has the screen to itself to start with.
  expect(await shown(page), 'the type alone').toEqual(['TYPE']);

  // Another allowed tab joins it rather than replacing it.
  await page.locator('button[data-rail-toggle="daily"]').click();
  await page.waitForTimeout(600);
  expect(await shown(page), 'Dailies joins the type').toEqual(['daily', 'TYPE']);

  // Clicking either of the two showing collapses to that one...
  await page.locator('button[data-rail-toggle="daily"]').click();
  await page.waitForTimeout(600);
  expect(await shown(page), 'Dailies takes the screen').toEqual(['daily']);

  // ...and clicking the other brings the pair back.
  await page.locator('button[data-tab="idea"]').click();
  await page.waitForTimeout(700);
  expect(await shown(page), 'the type comes back beside it').toEqual(['daily', 'TYPE']);

  // ...and the type collapses the same way, so the toggling keeps going.
  await page.locator('button[data-tab="idea"]').click();
  await page.waitForTimeout(700);
  expect(await shown(page), 'the type takes the screen').toEqual(['TYPE']);
});

// The gesture this whole rule exists for: ONE tab, clicked over and over,
// alternating between the pair and itself alone. Dailies, then Categories,
// then Categories again, then Categories again - and back to both.
test('one tab toggles the pair on and off, over and over', async ({ page }) => {
  // Dailies on its own to start.
  await page.locator('button[data-rail-toggle="daily"]').click();
  await page.waitForTimeout(600);
  await page.locator('button[data-rail-toggle="daily"]').click();
  await page.waitForTimeout(600);
  expect(await shown(page), 'Dailies alone').toEqual(['daily']);

  const categories = page.locator('button[data-tab="category"]');

  await categories.click();
  await page.waitForTimeout(800);
  expect(await shown(page), 'Categories opens beside it').toEqual(['daily', 'TYPE']);

  await categories.click();
  await page.waitForTimeout(700);
  expect(await shown(page), 'and takes the screen').toEqual(['TYPE']);

  await categories.click();
  await page.waitForTimeout(700);
  expect(await shown(page), 'and Dailies comes back').toEqual(['daily', 'TYPE']);

  // ...and it keeps going, which is the part that breaks if the recency list
  // is touched for the partner as well as the clicked tab.
  await categories.click();
  await page.waitForTimeout(700);
  expect(await shown(page), 'away again').toEqual(['TYPE']);
  await categories.click();
  await page.waitForTimeout(700);
  expect(await shown(page), 'back again').toEqual(['daily', 'TYPE']);
});

// A rail toggles the same way - the rule does not know which kind of tab it is.
test('a lone rail brings its companion back too', async ({ page }) => {
  await page.locator('button[data-rail-toggle="template"]').click();
  await page.waitForTimeout(700);
  expect(await shown(page), 'Templates joins the type').toEqual(['template', 'TYPE']);

  await page.locator('button[data-rail-toggle="template"]').click();
  await page.waitForTimeout(600);
  expect(await shown(page), 'Templates alone').toEqual(['template']);

  await page.locator('button[data-rail-toggle="template"]').click();
  await page.waitForTimeout(700);
  expect(await shown(page), 'the type comes back').toEqual(['template', 'TYPE']);
});

test('two rails pair with a plain click - no modifier', async ({ page }) => {
  // Join, then collapse: two clicks on Dailies leave it on its own.
  await page.locator('button[data-rail-toggle="daily"]').click();
  await page.waitForTimeout(700);
  await page.locator('button[data-rail-toggle="daily"]').click();
  await page.waitForTimeout(700);
  expect(await shown(page)).toEqual(['daily']);

  await page.locator('button[data-rail-toggle="template"]').click();
  await page.waitForTimeout(600);
  expect(await shown(page), 'Dailies + Templates').toEqual(['daily', 'template']);

  // Priorities may not join Templates, so it takes the slot beside Dailies -
  // the older of the two on screen is the one that steps out.
  await page.locator('button[data-rail-toggle="priority-board"]').click();
  await page.waitForTimeout(700);
  expect(await shown(page), 'Priorities replaces Templates beside Dailies')
    .toEqual(['daily', 'priority-board']);
});

test('Templates and Priorities never share the screen', async ({ page }) => {
  await page.locator('button[data-rail-toggle="template"]').click();
  await page.waitForTimeout(700);
  await page.locator('button[data-rail-toggle="template"]').click();   // collapse to Templates
  await page.waitForTimeout(700);
  expect(await shown(page)).toEqual(['template']);

  await page.locator('button[data-rail-toggle="priority-board"]').click();
  await page.waitForTimeout(700);
  expect(await shown(page), 'Priorities replaces it rather than joining it')
    .toEqual(['priority-board']);
});

test('every rail pairs with a type', async ({ page }) => {
  for (const rail of RAILS) {
    await page.evaluate((slugs) => {
      slugs.forEach(s => localStorage.setItem(`rail:${s}`, 'false'));
      localStorage.setItem('typePaneVisible', 'true');
    }, RAILS);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    await page.locator(`button[data-rail-toggle="${rail}"]`).click();
    await page.waitForTimeout(700);
    expect(await shown(page), `${rail} beside the type`).toEqual([rail, 'TYPE']);
  }
});

test('switching to a DIFFERENT type keeps the rail beside it', async ({ page }) => {
  await page.locator('button[data-rail-toggle="daily"]').click();
  await page.waitForTimeout(700);
  expect(await shown(page)).toEqual(['daily', 'TYPE']);

  await page.locator('button[data-tab="goal"]').click();
  await page.waitForTimeout(700);
  expect(await shown(page), 'a switch is not a toggle').toEqual(['daily', 'TYPE']);
  await expect(page.locator('#tab-goal')).toHaveClass(/active/);

  // The SAME type again: now it collapses to the type alone.
  await page.locator('button[data-tab="goal"]').click();
  await page.waitForTimeout(700);
  expect(await shown(page), 'clicking the type you are on gives it the screen').toEqual(['TYPE']);
});

test('a type put away comes back when its tab is clicked', async ({ page }) => {
  await page.locator('button[data-rail-toggle="daily"]').click();
  await page.waitForTimeout(700);
  await page.locator('button[data-rail-toggle="daily"]').click();   // collapse to Dailies
  await page.waitForTimeout(700);
  expect(await shown(page)).toEqual(['daily']);

  await page.locator('button[data-tab="goal"]').click();
  await page.waitForTimeout(800);
  expect(await shown(page), 'a different type joins the rail').toEqual(['daily', 'TYPE']);
  await expect(page.locator('#tab-goal')).toHaveClass(/active/);
});

// One pane has nothing to split the width with - it should fill the space
// rather than sit at half width with dead space beside it.
test('a lone rail fills the width once the type pane is put away', async ({ page }) => {
  await page.locator('button[data-rail-toggle="daily"]').click();
  await page.waitForTimeout(700);
  expect(await shown(page)).toEqual(['daily', 'TYPE']);

  const shellWidth = await page.locator('#appShell').evaluate(el => el.getBoundingClientRect().width);
  const paired = await page.locator('#rail-daily').evaluate(el => el.getBoundingClientRect().width);
  expect(paired, 'sharing with the type pane, it takes about half').toBeLessThan(shellWidth * 0.8);

  // Collapse to the rail - it should now take (nearly) everything.
  await page.locator('button[data-rail-toggle="daily"]').click();
  await page.waitForTimeout(700);
  const alone = await page.locator('#rail-daily').evaluate(el => el.getBoundingClientRect().width);
  console.log(`rail width: paired=${Math.round(paired)} alone=${Math.round(alone)} shell=${Math.round(shellWidth)}`);
  expect(alone, 'alone, it fills the space').toBeGreaterThan(shellWidth * 0.9);
});

// Reporting takes the whole screen and stands the rails down while it is open.
// Asking for a rail is asking to leave it - the toggle used to be stored while
// apply() filtered every rail out, so there was no way back.
test('a rail can be reached again after opening Reporting', async ({ page }) => {
  await page.locator('button[data-rail-toggle="daily"]').click();
  await page.waitForTimeout(700);
  await page.locator('button[data-rail-toggle="daily"]').click();   // collapse to Dailies
  await page.waitForTimeout(700);
  expect(await shown(page)).toEqual(['daily']);

  await page.locator('button[data-tab="reporting"]').click();
  await page.waitForTimeout(800);
  expect(await shown(page), 'Reporting owns the screen').toEqual(['TYPE']);

  await page.locator('button[data-rail-toggle="daily"]').click();
  await page.waitForTimeout(800);
  expect(await shown(page), 'and Dailies comes back when asked for').toEqual(['daily']);

  // The other two as well.
  await page.locator('button[data-tab="reporting"]').click();
  await page.waitForTimeout(700);
  await page.locator('button[data-rail-toggle="priority-board"]').click();
  await page.waitForTimeout(800);
  expect(await shown(page), 'Priorities too').toEqual(['priority-board']);
});

// Which panes you have open is a choice, and a refresh should not undo it.
test('pane choices survive a hard refresh', async ({ page }) => {
  await page.locator('button[data-rail-toggle="daily"]').click();
  await page.waitForTimeout(700);
  expect(await shown(page)).toEqual(['daily', 'TYPE']);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  expect(await shown(page), 'rail + type comes back').toEqual(['daily', 'TYPE']);

  // Collapse to the rail, refresh again: the type must STAY away.
  await page.locator('button[data-rail-toggle="daily"]').click();
  await page.waitForTimeout(700);
  expect(await shown(page)).toEqual(['daily']);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  expect(await shown(page), 'a pane put away stays away').toEqual(['daily']);

  // Two rails survive too.
  await page.locator('button[data-rail-toggle="template"]').click();
  await page.waitForTimeout(700);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  expect(await shown(page), 'a pair of rails comes back').toEqual(['daily', 'template']);
});

// Two clicks on a type tab still means "just this" - every rail stands down.
test('double-clicking a type tab leaves it the only pane', async ({ page }) => {
  await page.locator('button[data-rail-toggle="daily"]').click();
  await page.waitForTimeout(700);
  await page.locator('button[data-rail-toggle="daily"]').click();   // collapse to Dailies
  await page.waitForTimeout(700);
  await page.locator('button[data-rail-toggle="template"]').click();
  await page.waitForTimeout(700);
  expect(await shown(page), 'two rails to start').toEqual(['daily', 'template']);

  await dblclick(page.locator('button[data-tab="idea"]'));
  await page.waitForTimeout(900);
  expect(await shown(page), 'the type has the screen').toEqual(['TYPE']);
  await expect(page.locator('#tab-idea')).toHaveClass(/active/);
});
