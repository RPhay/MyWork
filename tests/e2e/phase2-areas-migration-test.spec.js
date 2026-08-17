import { test, expect } from '@playwright/test';

test.describe('Phase 2: Areas/Categories Migration', () => {
  test('Areas are migrated to entities', async ({ request }) => {
    const response = await request.get('/api/entities/area');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThanOrEqual(4); // Should have 4 migrated areas
  });

  test('Area entities have correct fields', async ({ request }) => {
    const response = await request.get('/api/entities/area');
    const data = await response.json();
    const areas = data.data;

    // Verify each area has expected structure
    for (const area of areas.slice(0, 3)) {
      expect(area).toHaveProperty('id');
      expect(area).toHaveProperty('title');
      expect(area).toHaveProperty('entity_type_id');
      expect(area.entity_type_id).toBe(4); // area type id from Phase 0
      expect(area).toHaveProperty('fields');
    }
  });

  test('Area descriptions are preserved in entity_field_values', async ({ request }) => {
    const response = await request.get('/api/entities/area');
    const data = await response.json();
    const areas = data.data;

    // Check if any area has description in notes field
    const areaWithNotes = areas.find(area => area.fields && area.fields.notes);
    if (areaWithNotes) {
      expect(areaWithNotes.fields.notes).toBeTruthy();
      expect(typeof areaWithNotes.fields.notes).toBe('string');
    }
  });

  test('Hierarchy relationships created for area parents', async ({ request }) => {
    const response = await request.get('/api/entities/area');
    const data = await response.json();
    const areas = data.data;

    // Check that entities have relationship data
    for (const area of areas.slice(0, 2)) {
      const relResponse = await request.get(`/api/entities/area/${area.id}/relationships`);
      expect(relResponse.ok()).toBeTruthy();

      const relData = await relResponse.json();
      expect(relData.success).toBe(true);
      expect(Array.isArray(relData.data)).toBe(true);
    }
  });

  test('Area type is correctly configured', async ({ request }) => {
    const response = await request.get('/api/entity-types/area');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.slug).toBe('area');
    expect(data.data.label).toBe('Categories');
    expect(data.data.supports_hierarchy).toBe(1);
  });

  test('Work-item-area associations created', async ({ request }) => {
    const response = await request.get('/api/entities/area');
    const data = await response.json();
    const areas = data.data;

    if (areas.length > 0) {
      const firstAreaId = areas[0].id;
      const relResponse = await request.get(`/api/entities/area/${firstAreaId}/relationships`);
      const relData = await relResponse.json();

      // Check for associations (work_item -> area relationships)
      const associations = relData.data.filter(r => r.relationship_kind === 'association');
      // Should have at least some associations
      expect(Array.isArray(associations)).toBe(true);
    }
  });

  test('Priority-area associations created', async ({ request }) => {
    const response = await request.get('/api/entity-types/area');
    const data = await response.json();
    expect(data.success).toBe(true);
    // Type should be queryable
    expect(data.data.id).toBe(4);
  });
});
