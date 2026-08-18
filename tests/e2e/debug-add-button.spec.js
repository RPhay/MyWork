import { test, expect } from '@playwright/test';

test('Debug: Click add button for Goals and verify form opens', async ({ page }) => {
  // Log all console messages
  page.on('console', msg => console.log(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => console.log(`[ERROR] ${err.message}`));

  await page.goto('http://localhost:3000');
  
  // Go to Goals tab
  console.log('\n=== Clicking Goals tab ===');
  await page.locator('.type-goal').click();
  await page.waitForTimeout(500);
  
  // Check that add button exists and is visible
  console.log('\n=== Checking add button ===');
  const addBtn = page.locator('button#addgoalBtn');
  const btnCount = await addBtn.count();
  console.log(`Button count: ${btnCount}`);
  
  if (btnCount > 0) {
    const isVisible = await addBtn.isVisible();
    console.log(`Button visible: ${isVisible}`);
    
    // Click the button
    console.log('\n=== Clicking add button ===');
    await addBtn.click();
    await page.waitForTimeout(1000);
    
    // Check if editor pane opened
    console.log('\n=== Checking editor pane ===');
    const editorPane = page.locator('#goal-editor-pane');
    const editorCount = await editorPane.count();
    console.log(`Editor pane found: ${editorCount > 0 ? 'YES' : 'NO'}`);
    
    if (editorCount > 0) {
      const parentPane = page.locator('#goalEditorPane');
      const hasHidden = await parentPane.evaluate(el => el.classList.contains('hidden'));
      console.log(`Parent pane hidden class: ${hasHidden ? 'YES (HIDDEN)' : 'NO (VISIBLE)'}`);
      
      // Check for form
      console.log('\n=== Checking form content ===');
      const form = page.locator('#goal-editor-pane form');
      const formCount = await form.count();
      console.log(`Form found: ${formCount > 0 ? 'YES' : 'NO'}`);
      
      if (formCount > 0) {
        const titleInput = page.locator('#goal-editor-pane input[name="title"]');
        const titleCount = await titleInput.count();
        console.log(`Title input found: ${titleCount > 0 ? 'YES' : 'NO'}`);
      } else {
        // Check what's in the editor pane
        const content = await editorPane.innerHTML();
        console.log(`Editor pane content length: ${content.length}`);
        console.log(`First 200 chars: ${content.substring(0, 200)}`);
      }
    }
  }
});
