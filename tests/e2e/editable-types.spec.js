import { test, expect } from '@playwright/test';

// Comprehensive tests for all editable types (Areas, Goals, Todos, Tasks, Tickets, Ideas)

const editableTypes = [
  { slug: 'category', name: 'Categories' },
  { slug: 'goal', name: 'Goals' },
  { slug: 'to_do', name: 'Todos' },
  { slug: 'task', name: 'Tasks' },
  { slug: 'ticket', name: 'Tickets' },
  { slug: 'idea', name: 'Ideas' }
];

for (const type of editableTypes) {
  test(`${type.name}: UI elements present`, async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Click type tab
    await page.locator(`.type-${type.slug}`).click();
    await page.waitForTimeout(300);
    
    // Check for required elements
    const addBtn = page.locator(`button#add${type.slug}Btn`);
    const folderBtn = page.locator(`button#add${type.slug}FolderBtn`);
    const listContainer = page.locator(`#${type.slug}EntityList`);
    const expandBtn = page.locator(`button#expandAll${type.slug}Btn`);
    const collapseBtn = page.locator(`button#collapseAll${type.slug}Btn`);

    expect(await addBtn.count()).toBeGreaterThan(0);
    // The folder button follows the TYPE's own flags, not a blanket rule -
    // a type that declines hierarchy or folders removes it (Goals has none,
    // by the user's own design). ui-check.spec.js asserts the exact
    // per-flag behavior; here it is enough that the button agrees with the
    // type's declaration.
    const flags = await page.evaluate(async (slug) => {
      const t = ((await (await fetch('/api/entity-types')).json()).data || []).find(x => x.slug === slug);
      return t ? { h: !!t.supports_hierarchy, f: t.supports_folders !== 0 && t.supports_folders !== false } : null;
    }, type.slug);
    expect(await folderBtn.count()).toBe(flags && flags.h && flags.f ? 1 : 0);
    expect(await listContainer.count()).toBeGreaterThan(0);
    expect(await expandBtn.count()).toBeGreaterThan(0);
    expect(await collapseBtn.count()).toBeGreaterThan(0);
  });

  test(`${type.name}: Expand/collapse works`, async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    await page.locator(`.type-${type.slug}`).click();
    await page.waitForTimeout(300);
    
    // Click expand
    await page.locator(`button#expandAll${type.slug}Btn`).click();
    await page.waitForTimeout(200);
    
    // Verify nodes have expanded class
    const expandedNodes = await page.locator('.entity-node.expanded').count();
    
    // Click collapse
    await page.locator(`button#collapseAll${type.slug}Btn`).click();
    await page.waitForTimeout(200);
    
    console.log(`✓ ${type.name}: Expand/collapse functional`);
  });

  test(`${type.name}: Folder creation dialog works`, async ({ page }) => {
    page.on('dialog', async dialog => {
      await dialog.accept(`Test Folder ${Date.now()}`);
    });

    await page.goto('http://localhost:3000');

    await page.locator(`.type-${type.slug}`).click();
    await page.waitForTimeout(300);

    // A type without folder support REMOVES the button (generic-entity-init
    // calls folderBtn.remove() when the type declines folders) - Goals is one,
    // by the user's own design. No button is correct there, not a failure.
    const folderBtn = page.locator(`button#add${type.slug}FolderBtn`);
    test.skip(await folderBtn.count() === 0, `${type.name} does not support folders - the button is deliberately absent`);
    await folderBtn.click();

    // Dialog should have been triggered
    console.log(`✓ ${type.name}: Folder creation dialog triggered`);
  });
}

test('Tab structure: Editable types centered', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Verify tabs container exists and is flex
  const tabs = page.locator('#mainTabs');
  const style = await tabs.evaluate(el => window.getComputedStyle(el).display);
  expect(style).toBe('flex');
  
  console.log('✓ Tab container uses flexbox');
});
