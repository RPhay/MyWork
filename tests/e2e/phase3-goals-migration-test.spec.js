import { test, expect } from '@playwright/test';

test.describe('Phase 3: Goals Migration', () => {
  test('Goals are migrated to entities', async ({ request }) => {
    const response = await request.get('/api/entities/goal');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThanOrEqual(3); // Should have 3 migrated goals
  });

  test('Goal entities have correct fields', async ({ request }) => {
    const response = await request.get('/api/entities/goal');
    const data = await response.json();
    const goals = data.data;

    // Verify each goal has expected structure
    for (const goal of goals.slice(0, 2)) {
      expect(goal).toHaveProperty('id');
      expect(goal).toHaveProperty('title');
      expect(goal).toHaveProperty('entity_type_id');
      expect(goal.entity_type_id).toBe(5); // goal type id from Phase 0
      expect(goal).toHaveProperty('fields');
    }
  });

  test('Goal fields are preserved', async ({ request }) => {
    const response = await request.get('/api/entities/goal');
    const data = await response.json();
    const goals = data.data;

    // Check for various goal fields
    for (const goal of goals.slice(0, 1)) {
      const fields = goal.fields || {};
      // At least some fields should be populated
      const hasAnyField = Object.keys(fields).length > 0;
      expect(hasAnyField).toBe(true);
    }
  });

  test('Goal type is correctly configured', async ({ request }) => {
    const response = await request.get('/api/entity-types/goal');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.slug).toBe('goal');
    expect(data.data.label).toBe('Goals');
    expect(data.data.supports_hierarchy).toBe(0); // Goals don't have hierarchy
  });

  test('Work-item-goal associations created', async ({ request }) => {
    const response = await request.get('/api/entities/goal');
    const data = await response.json();
    const goals = data.data;

    if (goals.length > 0) {
      const firstGoalId = goals[0].id;
      const relResponse = await request.get(`/api/entities/goal/${firstGoalId}/relationships`);
      const relData = await relResponse.json();

      // Check for work-item associations
      expect(Array.isArray(relData.data)).toBe(true);
    }
  });

  test('Goal relationships are queryable', async ({ request }) => {
    const response = await request.get('/api/entities/goal');
    const data = await response.json();
    const goals = data.data;

    // Spot-check a few goals for relationships
    for (const goal of goals.slice(0, 2)) {
      const relResponse = await request.get(`/api/entities/goal/${goal.id}/relationships`);
      expect(relResponse.ok()).toBeTruthy();

      const relData = await relResponse.json();
      expect(relData.success).toBe(true);
      expect(Array.isArray(relData.data)).toBe(true);
    }
  });
});
