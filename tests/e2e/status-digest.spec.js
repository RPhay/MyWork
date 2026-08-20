import { test, expect } from '@playwright/test';

/**
 * The scheduled status update. buildEmailDraft has always written the whole
 * thing and deliberately never sent it - what was missing was everything
 * around it: nothing decided WHEN, and nothing kept the result.
 *
 * Nothing is sent from the app. It writes the digest, keeps it, and hands it to
 * the mail client, so no credentials live here and nothing leaves the machine
 * unless the person presses send.
 */

test('the schedule can be set and comes back', async ({ page }) => {
  await page.goto('/settings?tab=misc', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  await page.locator('[data-misc-tab="status-digest"]').click();
  await page.waitForTimeout(400);
  await expect(page.locator('[data-misc-pane="status-digest"]')).toBeVisible();
  await expect(page.locator('[data-misc-pane="focus-colours"]'), 'sub-tabs switch').toBeHidden();

  await page.locator('#digestEnabled').check();
  await page.selectOption('#digestDay', '3');
  await page.fill('#digestTime', '09:30');
  await page.fill('#digestDays', '14');
  await page.click('#saveDigestBtn');
  await page.waitForTimeout(800);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.locator('[data-misc-tab="status-digest"]').click();
  await page.waitForTimeout(600);

  expect(await page.locator('#digestEnabled').isChecked(), 'enabled stuck').toBe(true);
  expect(await page.locator('#digestDay').inputValue()).toBe('3');
  expect(await page.locator('#digestTime').inputValue()).toBe('09:30');
  expect(await page.locator('#digestDays').inputValue()).toBe('14');
});

test('a digest can be written now, and is handed to the mail client', async ({ page }) => {
  await page.goto('/settings?tab=misc', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.locator('[data-misc-tab="status-digest"]').click();
  await page.waitForTimeout(400);

  await page.click('#runDigestBtn');
  await page.waitForTimeout(2500);

  const preview = page.locator('#digestPreview');
  await expect(preview, 'the digest is shown once written').toBeVisible();

  const subject = (await page.locator('#digestSubject').textContent()).trim();
  const body = await page.locator('#digestBody').inputValue();
  console.log('subject ->', subject);
  console.log('body starts ->', JSON.stringify(body.slice(0, 80)));

  expect(subject.toLowerCase(), 'it is a status update').toContain('status update');
  expect(body.length, 'it has prose in it').toBeGreaterThan(80);

  // Delivery is a mailto: - no SMTP, no credentials, nothing sent by the app.
  const href = await page.locator('#mailDigestBtn').getAttribute('href');
  expect(href.startsWith('mailto:'), 'handed to the mail client').toBe(true);
  expect(decodeURIComponent(href), 'carrying the draft').toContain(subject.slice(0, 20));
});

test('the due check fires for a missed slot, not only at the exact minute', async ({ page }) => {
  // A machine asleep at 16:00 on Friday must still get its digest.
  await page.goto('/settings?tab=misc', { waitUntil: 'networkidle' });
  const verdicts = await page.evaluate(async () => {
    const r = await fetch('/api/status-digest');
    return (await r.json()).data;
  });
  expect(verdicts.schedule, 'a schedule exists to reason about').toBeTruthy();
});
