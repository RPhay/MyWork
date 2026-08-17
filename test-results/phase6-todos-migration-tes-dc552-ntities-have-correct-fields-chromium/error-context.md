# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase6-todos-migration-test.spec.js >> Phase 6: Todos Migration >> Todo entities have correct fields
- Location: tests/e2e/phase6-todos-migration-test.spec.js:14:3

# Error details

```
TypeError: Cannot read properties of undefined (reading 'slice')
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Phase 6: Todos Migration', () => {
  4  |   test('Todos are migrated to entities', async ({ request }) => {
  5  |     const response = await request.get('/api/entities/to-do');
  6  |     expect(response.ok()).toBeTruthy();
  7  | 
  8  |     const data = await response.json();
  9  |     expect(data.success).toBe(true);
  10 |     expect(Array.isArray(data.data)).toBe(true);
  11 |     expect(data.data.length).toBeGreaterThanOrEqual(88); // Should have 88 migrated todos
  12 |   });
  13 | 
  14 |   test('Todo entities have correct fields', async ({ request }) => {
  15 |     const response = await request.get('/api/entities/to-do');
  16 |     const data = await response.json();
  17 |     const todos = data.data;
  18 | 
  19 |     // Verify each todo has expected structure
> 20 |     for (const todo of todos.slice(0, 2)) {
     |                              ^ TypeError: Cannot read properties of undefined (reading 'slice')
  21 |       expect(todo).toHaveProperty('id');
  22 |       expect(todo).toHaveProperty('title');
  23 |       expect(todo).toHaveProperty('entity_type_id');
  24 |       expect(todo.entity_type_id).toBe(6); // todo type id from Phase 0
  25 |       expect(todo).toHaveProperty('fields');
  26 |     }
  27 |   });
  28 | 
  29 |   test('Todo fields are preserved', async ({ request }) => {
  30 |     const response = await request.get('/api/entities/to-do');
  31 |     const data = await response.json();
  32 |     const todos = data.data;
  33 | 
  34 |     // Check for various todo fields
  35 |     for (const todo of todos.slice(0, 1)) {
  36 |       const fields = todo.fields || {};
  37 |       // At least some fields should be populated
  38 |       const hasAnyField = Object.keys(fields).length > 0;
  39 |       expect(hasAnyField).toBe(true);
  40 |     }
  41 |   });
  42 | 
  43 |   test('Todo type is correctly configured', async ({ request }) => {
  44 |     const response = await request.get('/api/entity-types/to-do');
  45 |     expect(response.ok()).toBeTruthy();
  46 | 
  47 |     const data = await response.json();
  48 |     expect(data.success).toBe(true);
  49 |     expect(data.data.slug).toBe('to-do');
  50 |     expect(data.data.label).toBe('Todos');
  51 |     expect(data.data.supports_hierarchy).toBe(1); // Todos support hierarchy
  52 |   });
  53 | 
  54 |   test('Todo hierarchy relationships created', async ({ request }) => {
  55 |     const response = await request.get('/api/entities/to-do');
  56 |     const data = await response.json();
  57 |     const todos = data.data;
  58 | 
  59 |     if (todos.length > 0) {
  60 |       const firstTodoId = todos[0].id;
  61 |       const relResponse = await request.get(`/api/entities/to-do/${firstTodoId}/relationships`);
  62 |       const relData = await relResponse.json();
  63 | 
  64 |       // Check for relationships (some todos have parents/children)
  65 |       expect(Array.isArray(relData.data)).toBe(true);
  66 |     }
  67 |   });
  68 | 
  69 |   test('Todo relationships are queryable', async ({ request }) => {
  70 |     const response = await request.get('/api/entities/to-do');
  71 |     const data = await response.json();
  72 |     const todos = data.data;
  73 | 
  74 |     // Spot-check a few todos for relationships
  75 |     for (const todo of todos.slice(0, 2)) {
  76 |       const relResponse = await request.get(`/api/entities/to-do/${todo.id}/relationships`);
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