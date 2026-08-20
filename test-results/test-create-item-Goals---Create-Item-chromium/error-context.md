# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test-create-item.spec.js >> Goals - Create Item
- Location: tests/e2e/test-create-item.spec.js:48:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('#tab-area .entity-row:visible').first()
Expected substring: "New Goal Test"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for locator('#tab-area .entity-row:visible').first()

```

```yaml
- navigation:
  - link "MyWork - v2026.08.19.141":
    - /url: /
  - button "  Pygmie Studios"
  - link "Settings":
    - /url: /settings
    - text: 
- tablist:
  - button "⭐ Dailies"
  - button "📊 Priorities"
  - button "📋 Templates"
  - listitem
  - tab "🗓️ Projects"
  - tab "🏁 Tests"
  - tab "🏷️ Categories"
  - tab "🎯 Goals"
  - tab "✅ Todos"
  - tab "📝 Tasks"
  - tab "🎟️ Tickets"
  - tab "💡 Ideas"
  - listitem
  - tab "📈 Reporting"
- complementary:
  - button " Calendar"
  - tabpanel:
    - button "Previous month": ‹
    - heading "August 2026" [level=6]
    - button "Next month": ›
    - table:
      - rowgroup:
        - row "Sun Mon Tue Wed Thu Fri Sat":
          - columnheader "Sun"
          - columnheader "Mon"
          - columnheader "Tue"
          - columnheader "Wed"
          - columnheader "Thu"
          - columnheader "Fri"
          - columnheader "Sat"
        - row "1":
          - cell
          - cell
          - cell
          - cell
          - cell
          - cell
          - cell "1"
        - row "2 3 4 5 6 7 8":
          - cell "2"
          - cell "3"
          - cell "4"
          - cell "5"
          - cell "6"
          - cell "7"
          - cell "8"
        - row "9 10 11 12 13 14 15":
          - cell "9"
          - cell "10"
          - cell "11"
          - cell "12"
          - cell "13"
          - cell "14"
          - cell "15"
        - row "16 17 18 19 20 21 22":
          - cell "16"
          - cell "17"
          - cell "18"
          - cell "19"
          - cell "20"
          - cell "21"
          - cell "22"
        - row "23 24 25 26 27 28 29":
          - cell "23"
          - cell "24"
          - cell "25"
          - cell "26"
          - cell "27"
          - cell "28"
          - cell "29"
        - row "30 31":
          - cell "30"
          - cell "31"
          - cell
          - cell
          - cell
          - cell
          - cell
  - heading "Work Items for Thursday, Aug 20" [level=6]
  - text: Title Oh! Time Status Time Box Claude Notes Actions   Test Folder 1 (3) - Not Started No time box  
  - button "Delete": 
  - text:   Test Folder 1 (3) - Not Started No time box  
  - button "Delete": 
  - text:   Test Add Project 📋 - Not Started No time box  
  - button "Delete": 
  - text:   Test Add Category 📋 - Not Started No time box  
  - button "Delete": 
  - text:   Test Add Todo 📋 - Not Started No time box  
  - button "Delete": 
  - text:   Test Add Task 📋 - Not Started No time box  
  - button "Delete": 
  - text:   Test Add Ticket 📋 - Not Started No time box  
  - button "Delete": 
  - text:   Test Add Idea 📋 - Not Started No time box  
  - button "Delete": 
- group:
  - button " Expand All"
  - button " Collapse All"
- group:
  - button " + Folder"
  - button "+ New Goal"
- button "Title"
- button "Priority"
- button "Year"
- button "Status"
- button "Description"
- button "Due Date"
- button "Measurements"
- button "Goal Updates"
- button "Notes"
- group:
  - button ""
  - button ""
- text: ▶ 📁 F1 (1) Complete 2026-08-07
- button "Delete": 
- text: ▶ 🎯 G1sss (1)
- button "No priority - click for Low"
- combobox "Year":
  - option "—" [selected]
  - option "2026"
  - option "2027"
  - option "2028"
  - option "2029"
  - option "2030"
- button "Ignored"
- button "2026-08-07"
- button "Delete": 
- text: 🎯 G2
- button "No priority - click for Low"
- combobox "Year":
  - option "—" [selected]
  - option "2026"
  - option "2027"
  - option "2028"
  - option "2029"
  - option "2030"
- button "Complete"
- button "2026-08-21"
- button "Delete": 
- text: 📁 F2
- button "Delete": 
- text: 🎯 New Goal Test
- button "No priority - click for Low"
- combobox "Year":
  - option "—" [selected]
  - option "2026"
  - option "2027"
  - option "2028"
  - option "2029"
  - option "2030"
- button "Not Started"
- button "Set date"
- button "Delete": 
- group:
  - button "Revert" [disabled]
  - button "Save" [disabled]
- text: Title *
- textbox: New Goal Test
- text: ⋮⋮ Priority
- checkbox [checked]
- checkbox [checked]
- button "No priority"
- text: ⋮⋮ Worked Time
- checkbox
- checkbox [checked]
- textbox "Hours and minutes. A plain number means minutes.":
  - /placeholder: e.g. 1h 30m
  - text: 0h 0m
- text: ⋮⋮ Time Box
- checkbox
- checkbox [checked]
- combobox:
  - option "-- Select --" [selected]
  - option "15m"
  - option "30m"
  - option "45m"
  - option "1h"
  - option "1.5h"
  - option "2h"
- text: ⋮⋮ Year
- checkbox [checked]
- checkbox [checked]
- combobox:
  - option "-- Select --" [selected]
  - option "2026"
  - option "2027"
  - option "2028"
  - option "2029"
  - option "2030"
- text: ⋮⋮ Status
- checkbox [checked]
- checkbox [checked]
- radiogroup "Status":
  - radio "Not Started" [checked]
  - radio "In Progress"
  - radio "Complete"
  - radio "Failed"
  - radio "Ignored"
- text: ⋮⋮ Description
- checkbox [checked]
- checkbox [checked]
- textbox
- text: ⋮⋮ Due Date
- checkbox [checked]
- checkbox [checked]
- textbox
- text: ⋮⋮ Measurements
- checkbox [checked]
- checkbox [checked]
- textbox
- text: ⋮⋮ Goal Updates
- checkbox [checked]
- checkbox [checked]
- textbox
- text: ⋮⋮ Notes
- checkbox [checked]
- checkbox [checked]
- textbox
- contentinfo:
  - paragraph: © 2026 MyWork. Licensed under the MIT License.
- alert:
  - text: Saved successfully
  - button "Close"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | // dashboard.ejs renders EVERY tab's rows into the DOM at once, so a bare
  4  | // .entity-row matches rows in hidden panes - 342 of them against 36 on
  5  | // screen in one measured case. Scope to the active tab, or the test
  6  | // clicks something the user cannot see.
  7  | test('Areas - Create and Edit Item', async ({ page }) => {
  8  |   await page.goto('http://localhost:3000/');
  9  | 
  10 |   // Click Areas tab
  11 |   await page.click('[data-tab="area"]');
  12 |   await page.waitForLoadState('networkidle');
  13 | 
  14 |   // Get initial item count
  15 |   const initialCount = await page.locator('#tab-area .entity-row:visible').count();
  16 | 
  17 |   // Click add button
  18 |   const addBtn = page.locator('#addareaBtn');
  19 |   await addBtn.click();
  20 | 
  21 |   // Wait for form to appear
  22 |   const form = page.locator('#entity-editor-form');
  23 |   await expect(form).toBeVisible({ timeout: 5000 });
  24 | 
  25 |   // Fill title
  26 |   const titleInput = form.locator('input[name="title"]');
  27 |   await expect(titleInput).toBeVisible();
  28 |   await titleInput.fill('New Area Test');
  29 | 
  30 |   // The save button should enable once input changes
  31 |   const saveBtn = page.locator('#areaSaveBtn');
  32 |   // Wait for button to be enabled (may take a moment for change tracking)
  33 |   await expect(saveBtn).toBeEnabled({ timeout: 3000 });
  34 |   await saveBtn.click();
  35 | 
  36 |   // Wait for reload and new item to appear
  37 |   await page.waitForLoadState('networkidle');
  38 | 
  39 |   // Verify new item was created
  40 |   const finalCount = await page.locator('#tab-area .entity-row:visible').count();
  41 |   expect(finalCount).toBeGreaterThan(initialCount);
  42 | 
  43 |   // Verify item title appears
  44 |   const newItem = page.locator('#tab-area .entity-row:visible').first();
  45 |   await expect(newItem).toContainText('New Area Test');
  46 | });
  47 | 
  48 | test('Goals - Create Item', async ({ page }) => {
  49 |   await page.goto('http://localhost:3000/');
  50 | 
  51 |   // Click Goals tab
  52 |   await page.click('[data-tab="goal"]');
  53 |   await page.waitForLoadState('networkidle');
  54 | 
  55 |   // Click add button
  56 |   const addBtn = page.locator('#addgoalBtn');
  57 |   await addBtn.click();
  58 | 
  59 |   // Wait for form
  60 |   const form = page.locator('#entity-editor-form');
  61 |   await expect(form).toBeVisible({ timeout: 5000 });
  62 | 
  63 |   // Fill title
  64 |   const titleInput = form.locator('input[name="title"]');
  65 |   await titleInput.fill('New Goal Test');
  66 | 
  67 |   // Save - wait for button to be enabled
  68 |   const saveBtn = page.locator('#goalSaveBtn');
  69 |   await expect(saveBtn).toBeEnabled({ timeout: 3000 });
  70 |   await saveBtn.click();
  71 | 
  72 |   // Verify
  73 |   await page.waitForLoadState('networkidle');
  74 |   const newItem = page.locator('#tab-area .entity-row:visible').first();
> 75 |   await expect(newItem).toContainText('New Goal Test');
     |                         ^ Error: expect(locator).toContainText(expected) failed
  76 | });
  77 | 
```