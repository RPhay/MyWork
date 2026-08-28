/**
 * The row-editor gestures changed on 2026-08-28, and every spec goes through
 * here so the next change is one edit, not twenty:
 *
 * - Row editors AUTOSAVE. There is no #<slug>SaveBtn any more - genericEntity
 *   debounces a save 800ms after the last change. Specs must not wait out the
 *   debounce (slow, and a loaded machine makes it flaky); flushAutosave()
 *   fires the identical code path the timer would, immediately. The save
 *   round trip is still asynchronous - keep whatever wait/assertion followed
 *   the old Save click.
 *
 * - Double-click on a row does NOTHING. A single click selects (and redirects
 *   an editor that is already open); the pencil icon on the row is what opens
 *   a closed editor, and clicking the pencil of the open row closes it again.
 *   openEditor() takes the .entity-row locator the old dblclick took.
 */

// `page.evaluate` because the flush lives on the page's own GenericEntity -
// same module the debounce timer calls into. The flush only STARTS the save
// (the PUT is async), and the row shows the new value as an unsaved preview
// before the server has it - so a server-side assertion straight after the
// flush races the request and reads the old state. The wait absorbs the
// round trip; assert after it, not between.
export const flushAutosave = async (page) => {
  await page.evaluate(() => GenericEntity.flushAutoSave());
  await page.waitForTimeout(900);
};

// Open (or toggle) a row's editor via its pencil icon. Pass the row locator.
export const openEditor = (row) => row.locator('[data-action="edit-row"]').click();
