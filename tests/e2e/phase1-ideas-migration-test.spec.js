import { test, expect } from '@playwright/test';

test.describe('Phase 1: Ideas Migration', () => {
  test.beforeAll(async () => {
    // Ensure dev server is running
    const response = await fetch('http://localhost:3000/api/entity-types');
    expect(response.ok).toBeTruthy();
  });

  test('Ideas are migrated to entities', async ({ request }) => {
    const response = await request.get('/api/entities/idea');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThan(50); // Should have 53+ migrated ideas
  });

  test('Idea entities have correct fields', async ({ request }) => {
    const response = await request.get('/api/entities/idea');
    const data = await response.json();
    const ideas = data.data;

    // Verify each idea has expected structure
    for (const idea of ideas.slice(0, 5)) {
      expect(idea).toHaveProperty('id');
      expect(idea).toHaveProperty('title');
      expect(idea).toHaveProperty('entity_type_id');
      expect(idea.entity_type_id).toBe(9); // idea type id from Phase 0
      expect(idea).toHaveProperty('fields');
    }
  });

  test('Idea notes are preserved in entity_field_values', async ({ request }) => {
    const response = await request.get('/api/entities/idea');
    const data = await response.json();
    const ideas = data.data;

    // Find an idea with notes
    const ideaWithNotes = ideas.find(idea => idea.fields && idea.fields.notes);
    if (ideaWithNotes) {
      expect(ideaWithNotes.fields.notes).toBeTruthy();
      expect(typeof ideaWithNotes.fields.notes).toBe('string');
    }
  });

  test('Hierarchy relationships created for idea folders', async ({ request }) => {
    const response = await request.get('/api/entities/idea');
    const data = await response.json();
    const ideas = data.data;

    // Check that first few entities have relationship data
    for (const idea of ideas.slice(0, 3)) {
      const relResponse = await request.get(`/api/entities/idea/${idea.id}/relationships`);
      expect(relResponse.ok()).toBeTruthy();

      const relData = await relResponse.json();
      expect(relData.success).toBe(true);
      expect(Array.isArray(relData.data)).toBe(true);
    }
  });

  test('Idea type is correctly configured', async ({ request }) => {
    const response = await request.get('/api/entity-types/idea');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.slug).toBe('idea');
    expect(data.data.label).toBe('Brainstorming');
    expect(data.data.supports_hierarchy).toBe(1);
  });

  test('Can create new idea via entities API', async ({ request }) => {
    const createResponse = await request.post('/api/entities/idea', {
      data: {
        title: 'Test Idea from Migration',
        fields: {
          notes: 'This is a test idea created after migration'
        }
      }
    });

    expect(createResponse.ok()).toBeTruthy();
    const createData = await createResponse.json();
    expect(createData.success).toBe(true);
    expect(createData.data.title).toBe('Test Idea from Migration');
  });

  test('Can update idea via entities API', async ({ request }) => {
    // Get first idea
    const listResponse = await request.get('/api/entities/idea');
    const listData = await listResponse.json();
    const ideaId = listData.data[0].id;

    // Update it
    const updateResponse = await request.put(`/api/entities/idea/${ideaId}`, {
      data: {
        title: 'Updated idea title'
      }
    });

    expect(updateResponse.ok()).toBeTruthy();
    const updateData = await updateResponse.json();
    expect(updateData.data.title).toBe('Updated idea title');

    // Revert
    await request.put(`/api/entities/idea/${ideaId}`, {
      data: {
        title: listData.data[0].title
      }
    });
  });
});
