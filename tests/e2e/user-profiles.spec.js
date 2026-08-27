// Profiles: choosing who is using MyWork, and seeing only their work.
//
// This is the one spec written BEFORE the feature was considered finished, and
// deliberately so. Every other test in this suite runs as the single implicit
// user, which means a profile leak - one person seeing another's contexts -
// would pass all 366 of them without a murmur. A silent failure needs a test
// that is not silent.
//
// What it does NOT claim: that this is access control. There is no password;
// anyone may become anyone. These assertions are about whose work is on screen,
// not about who is permitted to look. See src/services/activeUserService.js.
import { test, expect } from '@playwright/test';

const PROBE = 'ZZZ Profile Probe';

/** Whoever the suite was running as, so the run leaves the machine as it found it. */
let originalUserId = null;

async function api(page, url, body, method = 'POST') {
  return page.evaluate(async ({ url, body, method }) => {
    const res = await window.app.fetchRaw(url, { method, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  }, { url, body, method });
}

async function activeUser(page) {
  return page.evaluate(async () => (await (await fetch('/api/active-user')).json()).data);
}

test.beforeEach(async ({ page }) => {
  // Settings, not the dashboard. A profile owning no contexts is redirected off
  // the dashboard by design, and one of these tests deliberately leaves the app
  // in that state - so the page every test starts from has to be one that loads
  // whoever is active. Settings renders without an active context.
  await page.goto('/settings', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  if (originalUserId === null) {
    const state = await activeUser(page);
    originalUserId = state.user?.id ?? null;
  }
});

// Both halves matter: the probe user is removed, AND the profile the machine
// started on is put back. A run that leaves the app open as a test profile has
// changed the developer's environment, which is the same class of mess as
// leaving ZZZ rows behind.
test.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  try {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    if (originalUserId) await api(page, '/api/active-user', { userId: originalUserId }, 'PUT');
    await page.evaluate(async (name) => {
      const users = (await (await fetch('/api/users')).json()).data || [];
      const probe = users.find(u => u.name === name);
      if (probe) {
        await window.app.fetchRaw(`/api/users/${probe.id}`, { method: 'DELETE' }).catch(() => {});
      }
    }, PROBE);
  } finally {
    await page.close();
  }
});

test('the navbar says who is using MyWork', async ({ page }) => {
  const label = page.locator('#userSwitcherLabel');
  await expect(label).toBeVisible();
  const state = await activeUser(page);
  // global-setup chooses one, so a run should never arrive here unchosen.
  expect(state.user, 'a profile should be chosen').not.toBeNull();
  await expect(label).toHaveText(state.user.name);
});

test('the switcher offers every profile, and marks the current one', async ({ page }) => {
  await page.click('#userSwitcherBtn');
  await page.waitForTimeout(300);
  const items = page.locator('#userSwitcherMenu [data-user-id]');
  expect(await items.count(), 'at least one profile to choose').toBeGreaterThan(0);
  await expect(page.locator('#userSwitcherMenu [data-user-id].active')).toHaveCount(1);
});

test('a new profile sees none of the previous one\'s contexts', async ({ page }) => {
  const before = await activeUser(page);
  expect(before.contexts.length, 'the starting profile should own something to hide')
    .toBeGreaterThan(0);

  const made = await api(page, '/api/users', { name: PROBE });
  expect(made.body.success).toBe(true);
  const probeId = made.body.data.id;

  const switched = await api(page, '/api/active-user', { userId: probeId }, 'PUT');
  expect(switched.body.success, 'switching to a context-less profile still succeeds').toBe(true);
  expect(switched.body.data.needsContext, 'and reports it owns nothing').toBe(true);

  // The point of the whole feature.
  const seen = await page.evaluate(async () =>
    (await (await fetch('/api/contexts')).json()).data.map(c => c.name));
  expect(seen, 'a fresh profile owns no contexts and must see none').toEqual([]);
});

test('a profile cannot open a context belonging to someone else', async ({ page }) => {
  // The list being filtered is not enough on its own: the endpoint behind it
  // has to refuse an id that was typed, bookmarked or remembered from before
  // the switch. Without this the picker is decoration.
  const users = await page.evaluate(async () => (await (await fetch('/api/users')).json()).data);
  const probe = users.find(u => u.name === PROBE);
  test.skip(!probe, 'runs after the probe profile has been created');

  await api(page, '/api/active-user', { userId: probe.id }, 'PUT');

  const stolen = await api(page, '/api/active-context', { id: 1 }, 'PUT');
  expect(stolen.status, 'someone else\'s context must be refused').toBe(400);
  expect(stolen.body.message).toContain('another user');
});

test('switching back restores the original profile and its contexts', async ({ page }) => {
  test.skip(!originalUserId, 'needs a profile to have been chosen');

  const back = await api(page, '/api/active-user', { userId: originalUserId }, 'PUT');
  expect(back.body.success).toBe(true);
  expect(back.body.data.needsContext, 'the original profile owns contexts').toBe(false);

  const state = await activeUser(page);
  expect(state.user.id).toBe(originalUserId);
  expect(state.contexts.length).toBeGreaterThan(0);
});
