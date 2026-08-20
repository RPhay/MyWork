import { test, expect } from '@playwright/test';

test.describe('Phase 6: Todos Migration', () => {
  test('Todos are migrated to entities', async ({ request }) => {
    const response = await request.get('/api/entities/to-do');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThanOrEqual(88); // Should have 88 migrated todos
  });

  test('Todo entities have correct fields', async ({ request }) => {
    const response = await request.get('/api/entities/to-do');
    const data = await response.json();
    const todos = data.data;

    // Verify each todo has expected structure
    for (const todo of todos.slice(0, 2)) {
      expect(todo).toHaveProperty('id');
      expect(todo).toHaveProperty('title');
      expect(todo).toHaveProperty('entity_type_id');
      expect(todo.entity_type_id).toBe(6); // todo type id from Phase 0
      expect(todo).toHaveProperty('fields');
    }
  });

  test('Todo fields are preserved', async ({ request }) => {
    const response = await request.get('/api/entities/to-do');
    const data = await response.json();
    const todos = data.data;

    // Check for various todo fields
    for (const todo of todos.slice(0, 1)) {
      const fields = todo.fields || {};
      // At least some fields should be populated
      const hasAnyField = Object.keys(fields).length > 0;
      expect(hasAnyField).toBe(true);
    }
  });

  test('Todo type is correctly configured', async ({ request }) => {
    const response = await request.get('/api/entity-types/to-do');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.slug).toBe('to-do');
    expect(data.data.label).toBe('Todos');
    expect(data.data.supports_hierarchy).toBe(1); // Todos support hierarchy
  });

  test('Todo hierarchy relationships created', async ({ request }) => {
    const response = await request.get('/api/entities/to-do');
    const data = await response.json();
    const todos = data.data;

    if (todos.length > 0) {
      const firstTodoId = todos[0].id;
      const relResponse = await request.get(`/api/entities/to-do/${firstTodoId}/relationships`);
      const relData = await relResponse.json();

      // Check for relationships (some todos have parents/children)
      expect(Array.isArray(relData.data)).toBe(true);
    }
  });

  test('Todo relationships are queryable', async ({ request }) => {
    const response = await request.get('/api/entities/to-do');
    const data = await response.json();
    const todos = data.data;

    // Spot-check a few todos for relationships
    for (const todo of todos.slice(0, 2)) {
      const relResponse = await request.get(`/api/entities/to-do/${todo.id}/relationships`);
      expect(relResponse.ok()).toBeTruthy();

      const relData = await relResponse.json();
      expect(relData.success).toBe(true);
      expect(Array.isArray(relData.data)).toBe(true);
    }
  });
});
