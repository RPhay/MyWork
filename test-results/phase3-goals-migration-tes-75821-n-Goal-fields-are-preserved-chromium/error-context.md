# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase3-goals-migration-test.spec.js >> Phase 3: Goals Migration >> Goal fields are preserved
- Location: tests/e2e/phase3-goals-migration-test.spec.js:29:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Phase 3: Goals Migration', () => {
  4  |   test('Goals are migrated to entities', async ({ request }) => {
  5  |     const response = await request.get('/api/entities/goal');
  6  |     expect(response.ok()).toBeTruthy();
  7  | 
  8  |     const data = await response.json();
  9  |     expect(data.success).toBe(true);
  10 |     expect(Array.isArray(data.data)).toBe(true);
  11 |     expect(data.data.length).toBeGreaterThanOrEqual(3); // Should have 3 migrated goals
  12 |   });
  13 | 
  14 |   test('Goal entities have correct fields', async ({ request }) => {
  15 |     const response = await request.get('/api/entities/goal');
  16 |     const data = await response.json();
  17 |     const goals = data.data;
  18 | 
  19 |     // Verify each goal has expected structure
  20 |     for (const goal of goals.slice(0, 2)) {
  21 |       expect(goal).toHaveProperty('id');
  22 |       expect(goal).toHaveProperty('title');
  23 |       expect(goal).toHaveProperty('entity_type_id');
  24 |       expect(goal.entity_type_id).toBe(5); // goal type id from Phase 0
  25 |       expect(goal).toHaveProperty('fields');
  26 |     }
  27 |   });
  28 | 
  29 |   test('Goal fields are preserved', async ({ request }) => {
  30 |     const response = await request.get('/api/entities/goal');
  31 |     const data = await response.json();
  32 |     const goals = data.data;
  33 | 
  34 |     // Check for various goal fields
  35 |     for (const goal of goals.slice(0, 1)) {
  36 |       const fields = goal.fields || {};
  37 |       // At least some fields should be populated
  38 |       const hasAnyField = Object.keys(fields).length > 0;
> 39 |       expect(hasAnyField).toBe(true);
     |                           ^ Error: expect(received).toBe(expected) // Object.is equality
  40 |     }
  41 |   });
  42 | 
  43 |   test('Goal type is correctly configured', async ({ request }) => {
  44 |     const response = await request.get('/api/entity-types/goal');
  45 |     expect(response.ok()).toBeTruthy();
  46 | 
  47 |     const data = await response.json();
  48 |     expect(data.success).toBe(true);
  49 |     expect(data.data.slug).toBe('goal');
  50 |     expect(data.data.label).toBe('Goals');
  51 |     expect(data.data.supports_hierarchy).toBe(0); // Goals don't have hierarchy
  52 |   });
  53 | 
  54 |   test('Work-item-goal associations created', async ({ request }) => {
  55 |     const response = await request.get('/api/entities/goal');
  56 |     const data = await response.json();
  57 |     const goals = data.data;
  58 | 
  59 |     if (goals.length > 0) {
  60 |       const firstGoalId = goals[0].id;
  61 |       const relResponse = await request.get(`/api/entities/goal/${firstGoalId}/relationships`);
  62 |       const relData = await relResponse.json();
  63 | 
  64 |       // Check for work-item associations
  65 |       expect(Array.isArray(relData.data)).toBe(true);
  66 |     }
  67 |   });
  68 | 
  69 |   test('Goal relationships are queryable', async ({ request }) => {
  70 |     const response = await request.get('/api/entities/goal');
  71 |     const data = await response.json();
  72 |     const goals = data.data;
  73 | 
  74 |     // Spot-check a few goals for relationships
  75 |     for (const goal of goals.slice(0, 2)) {
  76 |       const relResponse = await request.get(`/api/entities/goal/${goal.id}/relationships`);
  77 |       expect(relResponse.ok()).toBeTruthy();
  78 | 
  79 |       const relData = await relResponse.json();
  80 |       expect(relData.success).toBe(true);
  81 |       expect(Array.isArray(relData.data)).toBe(true);
  82 |     }
  83 |   });
  84 | });
  85 | 
```