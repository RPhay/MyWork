import { test, expect } from '@playwright/test';
import { dblclick } from './dblclick.js';

/**
 * Field types are the generic engine's extension point: a type gains a
 * capability by declaring a field in `entity_type_fields`, never by growing
 * its own tab or its own table.
 *
 * `links` (0-n named URLs, stored as JSON in entity_field_values.value_json)
 * replaces the four per-type link tables - priority_links, task_links,
 * ticket_links, to_do_links - which existed only because there was no generic
 * way to say "this type has links". Any type can now declare one.
 *
 * Exercised here on Projects because that's where the capability was first
 * needed, but nothing in the implementation is Projects-specific.
 */
test('a type with a links field holds 0-n named links', async ({ page }) => {
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('/?tab=priority');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  await page.click('#addpriorityBtn');
  const ti = page.locator('#entity-editor-form input[name="title"]');
  await ti.fill('ZZZ linked project');
  await ti.dispatchEvent('input');

  // 0 links to start
  await expect(page.locator('.entity-link-row')).toHaveCount(0);

  // add two named links
  await page.click('[data-action="add-link"]');
  await page.locator('.entity-link-row').nth(0).locator('.entity-link-url').fill('https://example.com/spec');
  await page.locator('.entity-link-row').nth(0).locator('.entity-link-title').fill('Spec');
  await page.click('[data-action="add-link"]');
  await page.locator('.entity-link-row').nth(1).locator('.entity-link-url').fill('https://example.com/repo');
  await page.locator('.entity-link-row').nth(1).locator('.entity-link-title').fill('Repo');

  // and a third we remove again, proving remove works
  await page.click('[data-action="add-link"]');
  await expect(page.locator('.entity-link-row')).toHaveCount(3);
  await page.locator('.entity-link-row').nth(2).locator('[data-action="remove-link"]').click();
  await expect(page.locator('.entity-link-row')).toHaveCount(2);

  await page.click('#prioritySaveBtn');
  await page.waitForTimeout(900);

  // Rendered in the row as real anchors
  const row = page.locator('.entity-row', { hasText: 'ZZZ linked project' }).first();
  await expect(row).toBeVisible({timeout:5000});
  await expect(row.locator('a.entity-row-link')).toHaveCount(2);
  expect(await row.locator('a.entity-row-link').first().getAttribute('href')).toBe('https://example.com/spec');

  // Survives a reload, and reopens populated
  await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(1400);
  const row2 = page.locator('.entity-row', { hasText: 'ZZZ linked project' }).first();
  await expect(row2.locator('a.entity-row-link')).toHaveCount(2);
  // The row is a grid of columns now, so its centre can land in the gap
  // between cells - click the title cell, which is what opens the editor.
  await dblclick(row2.locator('.entity-cell-title'));
  await expect(page.locator('.entity-link-row')).toHaveCount(2);
  expect(await page.locator('.entity-link-row').nth(1).locator('.entity-link-title').inputValue()).toBe('Repo');

  console.log(JSON.stringify({pageErrors:errs}));
  expect(errs).toEqual([]);

  await page.evaluate(async () => {
    const t=document.body.dataset.csrfToken;
    const all=(await (await fetch('/api/entities/priority')).json()).data||[];
    // Only this spec's own records. Deleting every ZZZ-prefixed Project also
    // deleted the fixtures generic-entity-crud.spec.js was mid-test on - both
    // files use Projects and run in parallel, which is why that spec failed
    // intermittently on Projects alone.
    for (const e of all.filter(x=>(x.title||'').startsWith('ZZZ linked project')))
      await fetch(`/api/entities/priority/${e.id}`,{method:'DELETE',headers:{'X-CSRF-Token':t}});
  });
});
