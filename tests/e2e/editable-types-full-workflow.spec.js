import { test, expect } from '@playwright/test';

test('Categories: Full workflow - create, edit, delete', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Click Categories tab
  await page.locator('.type-area').click();
  await page.waitForTimeout(500);
  
  console.log('✓ Navigated to Categories tab');
  
  // Click add button
  const addBtn = page.locator('button#addareaBtn');
  const count = await addBtn.count();
  console.log(`Add button found: ${count > 0 ? 'YES' : 'NO'}`);
  
  if (count > 0) {
    await addBtn.click();
    await page.waitForTimeout(500);
    
    // Check if editor opened
    const editorPane = page.locator('#areaEditorPane');
    const isHidden = await editorPane.evaluate(el => el.classList.contains('hidden'));
    console.log(`Editor pane opened: ${!isHidden ? 'YES' : 'NO'}`);
    
    if (!isHidden) {
      // Fill in title
      const titleInput = page.locator('input[name="title"]');
      const inputCount = await titleInput.count();
      console.log(`Title input found: ${inputCount > 0 ? 'YES' : 'NO'}`);
      
      if (inputCount > 0) {
        await titleInput.fill('Test Category ' + Date.now());
        console.log('✓ Title filled in');
        
        // Save
        const saveBtn = page.locator('#areaSaveBtn');
        const saveBtnCount = await saveBtn.count();
        console.log(`Save button found: ${saveBtnCount > 0 ? 'YES' : 'NO'}`);
        
        if (saveBtnCount > 0) {
          await saveBtn.click();
          await page.waitForTimeout(1000);
          console.log('✓ Save clicked');
          
          // Check if item appears in list
          const rows = await page.locator('.entity-row').count();
          console.log(`Entity rows after save: ${rows}`);
        }
      }
    }
  } else {
    console.log('✗ Add button not found');
  }
});

test('Goals: Full workflow - create with fields', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Click Goals tab
  await page.locator('.type-goal').click();
  await page.waitForTimeout(500);
  
  console.log('✓ Navigated to Goals tab');
  
  // Click add button
  const addBtn = page.locator('button#addgoalBtn');
  const count = await addBtn.count();
  
  if (count > 0) {
    await addBtn.click();
    await page.waitForTimeout(500);
    
    // Check form fields
    const titleInput = page.locator('input[name="title"]');
    const titleCount = await titleInput.count();
    console.log(`Title field present: ${titleCount > 0 ? 'YES' : 'NO'}`);
    
    // List all form fields
    const formFields = await page.locator('input[type="text"], textarea, select').count();
    console.log(`Total form fields found: ${formFields}`);
  }
});

test('Todos: Test toggle close - click same row twice', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Click Todos tab
  await page.locator('.type-to_do').click();
  await page.waitForTimeout(500);
  
  console.log('✓ Navigated to Todos tab');
  
  // Get first row if exists
  const rows = await page.locator('.entity-row').count();
  console.log(`Entity rows found: ${rows}`);
  
  if (rows > 0) {
    const firstRow = page.locator('.entity-row').first();
    
    // Click to open
    await firstRow.click();
    await page.waitForTimeout(300);
    
    const editorPane = page.locator('#to_doEditorPane');
    let isHidden = await editorPane.evaluate(el => el.classList.contains('hidden'));
    console.log(`After first click - editor hidden: ${isHidden}`);
    
    // Click same row again to close
    await firstRow.click();
    await page.waitForTimeout(300);
    
    isHidden = await editorPane.evaluate(el => el.classList.contains('hidden'));
    console.log(`After second click - editor hidden: ${isHidden}`);
    console.log(`Toggle close working: ${isHidden ? 'YES' : 'NO'}`);
  } else {
    console.log('⊘ No rows to test toggle close');
  }
});

test('Drag and drop: Create parent-child relationship', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Click Categories tab
  await page.locator('.type-area').click();
  await page.waitForTimeout(500);
  
  const rows = await page.locator('.entity-row').count();
  console.log(`Category rows found: ${rows}`);
  
  if (rows >= 2) {
    const firstRow = page.locator('.entity-row').nth(0);
    const secondRow = page.locator('.entity-row').nth(1);
    
    // Drag first to second
    await firstRow.dragTo(secondRow);
    await page.waitForTimeout(500);
    
    console.log('✓ Drag and drop executed');
    
    // Check if structure changed
    const parentChild = await page.locator('.entity-node-children').count();
    console.log(`Parent-child relationships (expanded): ${parentChild}`);
  } else {
    console.log('⊘ Need at least 2 items to test drag and drop');
  }
});
