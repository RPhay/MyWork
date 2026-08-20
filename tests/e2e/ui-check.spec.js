import { test, expect } from '@playwright/test';

test('Verify UI layout and folder buttons', async ({ page }) => {
  await page.goto('/');

  // Check that Dailies tab exists
  await expect(page.locator('#work_item-tab')).toContainText('Dailies');

  // Check that Projects tab exists
  await expect(page.locator('#priority-tab')).toContainText('Projects');

  // Every generic type tab must offer a folder button, and it must be the
  // same button on every one of them - a type that has folders while its
  // neighbours don't is the exact divergence the generic engine exists to
  // prevent. IDs are derived from the rendered tabs rather than hardcoded,
  // because the button id is `add<typeSlug>FolderBtn` and typeSlug comes from
  // the database - a hardcoded list goes stale the moment a type is added or
  // renamed (this test previously asserted `addAreaFolderBtn`/`addTodoFolderBtn`,
  // capitalized names the template has never generated).
  const typeSlugs = await page.locator('[data-entity-type]').evaluateAll((els) =>
    els.map((el) => el.dataset.entityType)
  );
  expect(typeSlugs.length).toBeGreaterThan(0);

  // "+ Folder" is rendered for every type but REMOVED by generic-entity-init.js
  // for flat ones (`supports_hierarchy = 0`, e.g. Templates) - folders are a
  // nesting feature, so a flat type having none is correct, not a defect.
  //
  // This used to assert a folder button on every type, which made it a race:
  // it passed only when it ran before init got round to removing them, and
  // failed whenever the page was warm enough for init to win. Waiting for that
  // removal to have happened is what makes the result mean anything.
  const hierarchical = await page.evaluate(async () => {
    const body = await (await fetch('/api/entity-types')).json();
    return Object.fromEntries((body.data || []).map(t => [t.slug, !!t.supports_hierarchy]));
  });
  await page.waitForFunction(
    () => window.GenericEntityTabs && Object.keys(window.GenericEntityTabs._bySlug || {}).length > 0,
    null, { timeout: 15000 }
  );

  for (const slug of typeSlugs) {
    await expect(page.locator(`#add${slug}Btn`)).toHaveCount(1);
    await expect(
      page.locator(`#add${slug}FolderBtn`),
      `${slug}: supports_hierarchy=${hierarchical[slug]} should ${hierarchical[slug] ? '' : 'not '}offer + Folder`
    ).toHaveCount(hierarchical[slug] ? 1 : 0);
  }

  // Projects used to have its own hand-written tab (with a "Project Form"
  // modal and an #addPriorityFolderBtn of its own). It runs on the generic
  // tab now, so it is covered by the loop above - and the modal must be gone.
  expect(typeSlugs).toContain('priority');
  await expect(page.locator('#addPriorityFolderBtn')).toHaveCount(0);

  // Check right-aligned tabs exist
  await expect(page.locator('#priority-board-tab')).toContainText('Priority Board');
  await expect(page.locator('#reporting-tab')).toContainText('Reporting');
});
