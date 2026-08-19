import { test, expect } from '@playwright/test';

/**
 * The Status Report: the whole portfolio in one page, and the artefacts you send
 * on from it.
 *
 * What existed before only ever read `work_items`, so it went blank on a quiet
 * day and said nothing about the hundreds of projects, categories, goals and
 * ideas the app now holds. The structure follows what status reports to
 * management conventionally answer - where things stand, what got done, what is
 * next, what needs a decision.
 *
 * Nothing is ever emailed by the app: the draft is shown for review, then
 * copied or handed to the machine's mail client.
 */

test.describe.configure({ mode: 'serial' });

test('the status report renders and exports', async ({ page }) => {
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('/?tab=reporting'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(2500);

  await expect(page.locator('#rptStatusHeadline .card')).not.toHaveCount(0);
  const tiles = await page.locator('#rptStatusHeadline .card-body').allTextContents();
  const rows  = await page.locator('#rptPortfolioTable tr').count();
  const chart = await page.locator('#rptPortfolioChart').isVisible();
  const sections = {
    done: (await page.locator('#rptAccomplishments').innerText()).slice(0,40),
    next: (await page.locator('#rptUpcoming').innerText()).slice(0,40),
    attn: (await page.locator('#rptNeedsAttention').innerText()).slice(0,40),
  };
  console.log(JSON.stringify({tiles: tiles.length, portfolioRows: rows, chartVisible: chart, sections, errs}));
  expect(rows).toBeGreaterThan(0);
  expect(chart).toBe(true);

  // the email draft opens, prefilled, and is editable before anything is sent
  await page.locator('#rptEmailBtn').click();
  await expect(page.locator('#rptEmailModal')).toBeVisible();
  const subject = await page.locator('#rptEmailSubject').inputValue();
  const body = await page.locator('#rptEmailBody').inputValue();
  console.log('email subject ->', subject);
  console.log('email body starts ->', body.split('\n')[0]);
  expect(subject).toContain('Status update');
  expect(body.length).toBeGreaterThan(50);
  await page.locator('#rptEmailModal .btn-secondary').click();

  expect(errs).toEqual([]);
});

test('exports download real files', async ({ page }) => {
  await page.goto('/?tab=reporting'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(2000);
  for (const [btn, ext] of [['#rptExportXlsxBtn','xlsx'], ['#rptExportPdfBtn','pdf']]) {
    const [download] = await Promise.all([
      page.waitForEvent('download', {timeout: 15000}),
      page.locator(btn).click(),
    ]);
    const name = download.suggestedFilename();
    console.log(ext, 'download ->', name);
    expect(name.endsWith(ext)).toBe(true);
  }
});
const today = () => new Date().toISOString().slice(0,10);
async function api(page, path, options={}) {
  return page.evaluate(async ({path,options,t}) => {
    const r = await fetch(path,{...options,headers:{'Content-Type':'application/json','X-CSRF-Token':t,...(options.headers||{})}});
    return {status:r.status, body: await r.json().catch(()=>null)};
  }, {path,options,t: await page.evaluate(()=>document.body.dataset.csrfToken)});
}
test('the report reflects real activity', async ({ page }) => {
  await page.goto('/'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1500);

  // something finished today, something due soon, something overdue
  const wi = (await api(page,'/api/work',{method:'POST',body:JSON.stringify({title:'ZZZrep finished thing', date: today(), status:'Complete'})})).body.data;
  const soon = (await api(page,'/api/entities/to_do',{method:'POST',
    body:JSON.stringify({title:'ZZZrep due soon', fields:{status:'Not Started', target_date: new Date(Date.now()+3*86400000).toISOString().slice(0,10)}})})).body.data;
  const late = (await api(page,'/api/entities/to_do',{method:'POST',
    body:JSON.stringify({title:'ZZZrep overdue', fields:{status:'Not Started', target_date: '2026-01-15'}})})).body.data;

  const r = (await api(page, `/api/reporting/executive-summary?startDate=${today()}&endDate=${today()}`)).body.data;
  console.log(JSON.stringify({
    completedInRange: r.headline.completedInRange,
    accomplishments: r.accomplishments.map(a=>a.title),
    upcoming: r.upcoming.map(u=>u.title),
    attention: r.needsAttention.map(n=>`${n.title} (${n.reason})`),
  }, null, 0));

  expect(r.accomplishments.some(a=>a.title==='ZZZrep finished thing'), 'a completed work item is an accomplishment').toBe(true);
  expect(r.upcoming.some(u=>u.title==='ZZZrep due soon'), 'a dated todo is upcoming').toBe(true);
  expect(r.needsAttention.some(n=>n.title==='ZZZrep overdue'), 'an overdue todo needs attention').toBe(true);

  await api(page,`/api/work/${wi.id}`,{method:'DELETE'});
  for (const id of [soon.id, late.id]) await api(page,`/api/entities/to_do/${id}`,{method:'DELETE'});
});
