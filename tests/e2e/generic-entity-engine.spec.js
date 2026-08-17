import { test, expect } from '@playwright/test';

test.describe('Generic Entity Engine - Full Integration Tests', () => {
  let contextId = 1;
  let csrfToken = '';

  // Helper to create a unique ID for test isolation
  function uniqueId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get CSRF token from page
  async function getCsrfToken(page) {
    const response = await page.goto('/');
    const content = await page.content();
    const match = content.match(/csrfToken['"]\s*:\s*['"]([^'"]+)['"]/);
    return match ? match[1] : '';
  }

  // ========== ENTITY TYPE OPERATIONS ==========

  test('GET entity types returns all system types', async ({ request }) => {
    const response = await request.get('/api/entity-types');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThanOrEqual(9);

    const typeNames = data.data.map(t => t.slug);
    expect(typeNames).toContain('work_item');
    expect(typeNames).toContain('priority');
    expect(typeNames).toContain('to_do');
    expect(typeNames).toContain('task');
    expect(typeNames).toContain('ticket');
  });

  test('GET entity type by slug returns type with fields', async ({ request }) => {
    const response = await request.get('/api/entity-types/priority');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.slug).toBe('priority');
    expect(data.data.label).toBe('Projects');
    expect(Array.isArray(data.data.fields)).toBe(true);
  });

  test('GET entity type includes relationship rules', async ({ request }) => {
    const response = await request.get('/api/entity-types/priority');
    const data = await response.json();

    expect(data.data).toHaveProperty('relationships');
    expect(Array.isArray(data.data.relationships)).toBe(true);
  });

  // ========== ENTITY CRUD OPERATIONS ==========

  test('CREATE entity with required fields', async ({ request }) => {
    const payload = {
      title: uniqueId('Test Priority'),
    };

    const response = await request.post('/api/entities/priority', {
      data: payload,
    });
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('id');
    expect(data.data.title).toBe(payload.title);
    expect(data.data.entity_type_id).toBe(3); // priority type
  });

  test('CREATE entity with custom fields', async ({ request }) => {
    const payload = {
      title: uniqueId('Priority with Status'),
      status: 'In Progress',
    };

    const response = await request.post('/api/entities/priority', {
      data: payload,
    });
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    const entityId = data.data.id;

    // Verify fields were stored
    const getResponse = await request.get(`/api/entities/priority/${entityId}`);
    const getData = await getResponse.json();
    expect(getData.data.fields).toHaveProperty('status');
    expect(getData.data.fields.status).toBe('In Progress');
  });

  test('GET entity by ID returns all fields', async ({ request }) => {
    // First create an entity
    const createResp = await request.post('/api/entities/to_do', {
      data: {
        title: uniqueId('Test Todo'),
        notes: 'This is a test note',
        status: 'incomplete',
      },
    });
    const createdEntity = await createResp.json();
    const entityId = createdEntity.data.id;

    // Then fetch it
    const response = await request.get(`/api/entities/to_do/${entityId}`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.id).toBe(entityId);
    expect(data.data.title).toBe(createdEntity.data.title);
    expect(data.data.fields.notes).toBe('This is a test note');
    expect(data.data.fields.status).toBe('incomplete');
  });

  test('UPDATE entity updates title', async ({ request }) => {
    // Create
    const createResp = await request.post('/api/entities/priority', {
      data: { title: uniqueId('Original Title') },
    });
    const entity = await createResp.json();
    const entityId = entity.data.id;

    // Update
    const newTitle = uniqueId('Updated Title');
    const updateResp = await request.put(`/api/entities/priority/${entityId}`, {
      data: { title: newTitle },
    });
    expect(updateResp.ok()).toBeTruthy();

    const updated = await updateResp.json();
    expect(updated.data.title).toBe(newTitle);

    // Verify persistence
    const getResp = await request.get(`/api/entities/priority/${entityId}`);
    const verified = await getResp.json();
    expect(verified.data.title).toBe(newTitle);
  });

  test('UPDATE entity updates field values', async ({ request }) => {
    // Create
    const createResp = await request.post('/api/entities/to_do', {
      data: {
        title: uniqueId('Todo'),
        status: 'incomplete',
      },
    });
    const entity = await createResp.json();
    const entityId = entity.data.id;

    // Update field
    const updateResp = await request.put(`/api/entities/to_do/${entityId}`, {
      data: {
        title: entity.data.title,
        status: 'complete',
      },
    });
    expect(updateResp.ok()).toBeTruthy();

    // Verify
    const getResp = await request.get(`/api/entities/to_do/${entityId}`);
    const verified = await getResp.json();
    expect(verified.data.fields.status).toBe('complete');
  });

  test('DELETE entity removes it from list', async ({ request }) => {
    // Create
    const createResp = await request.post('/api/entities/priority', {
      data: { title: uniqueId('To Delete') },
    });
    const entity = await createResp.json();
    const entityId = entity.data.id;

    // Verify it exists
    let listResp = await request.get('/api/entities/priority');
    let list = await listResp.json();
    const beforeCount = list.data.length;

    // Delete
    const delResp = await request.delete(`/api/entities/priority/${entityId}`);
    expect(delResp.ok()).toBeTruthy();

    // Verify it's gone
    listResp = await request.get('/api/entities/priority');
    list = await listResp.json();
    const afterCount = list.data.length;
    expect(afterCount).toBe(beforeCount - 1);
  });

  // ========== ENTITY LISTING ==========

  test('LIST entities by type returns all of that type', async ({ request }) => {
    // Create 3 priorities
    for (let i = 0; i < 3; i++) {
      await request.post('/api/entities/priority', {
        data: { title: uniqueId(`Priority ${i}`) },
      });
    }

    // List priorities
    const response = await request.get('/api/entities/priority');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThanOrEqual(3);

    // All returned entities should be priorities
    for (const entity of data.data) {
      expect(entity.entity_type_id).toBe(3); // priority type
      expect(entity).toHaveProperty('title');
      expect(entity).toHaveProperty('fields');
    }
  });

  test('LIST entities includes field values', async ({ request }) => {
    // Create with fields
    await request.post('/api/entities/to_do', {
      data: {
        title: uniqueId('Todo with Status'),
        status: 'incomplete',
      },
    });

    // List
    const response = await request.get('/api/entities/to_do');
    const data = await response.json();

    // Find our entity
    const our = data.data.find(e => e.title.includes('Todo with Status'));
    expect(our).toBeDefined();
    expect(our.fields).toHaveProperty('status');
    expect(our.fields.status).toBe('incomplete');
  });

  // ========== HIERARCHY RELATIONSHIPS ==========

  test('CREATE hierarchy relationship (parent-child)', async ({ request }) => {
    // Create parent priority
    const parentResp = await request.post('/api/entities/priority', {
      data: { title: uniqueId('Parent Project') },
    });
    const parent = await parentResp.json();
    const parentId = parent.data.id;

    // Create child priority
    const childResp = await request.post('/api/entities/priority', {
      data: { title: uniqueId('Sub-Project') },
    });
    const child = await childResp.json();
    const childId = child.data.id;

    // Create hierarchy relationship
    const relResp = await request.post(
      `/api/entities/priority/${parentId}/relationships`,
      {
        data: {
          child_entity_id: childId,
          relationship_kind: 'hierarchy',
        },
      }
    );
    expect(relResp.ok()).toBeTruthy();

    const relData = await relResp.json();
    expect(relData.success).toBe(true);
  });

  test('GET relationships returns parent-child links', async ({ request }) => {
    // Create parent and child
    const parentResp = await request.post('/api/entities/priority', {
      data: { title: uniqueId('Parent') },
    });
    const parent = await parentResp.json();
    const parentId = parent.data.id;

    const childResp = await request.post('/api/entities/priority', {
      data: { title: uniqueId('Child') },
    });
    const child = await childResp.json();
    const childId = child.data.id;

    // Link them
    await request.post(`/api/entities/priority/${parentId}/relationships`, {
      data: {
        child_entity_id: childId,
        relationship_kind: 'hierarchy',
      },
    });

    // Get parent's relationships
    const relResp = await request.get(`/api/entities/priority/${parentId}/relationships`);
    expect(relResp.ok()).toBeTruthy();

    const relData = await relResp.json();
    expect(relData.success).toBe(true);
    expect(Array.isArray(relData.data)).toBe(true);

    const hasChild = relData.data.some(r => r.child_entity_id === childId);
    expect(hasChild).toBe(true);
  });

  test('GET children of entity', async ({ request }) => {
    // Create parent
    const parentResp = await request.post('/api/entities/priority', {
      data: { title: uniqueId('Parent Project') },
    });
    const parent = await parentResp.json();
    const parentId = parent.data.id;

    // Create 2 children
    const child1Resp = await request.post('/api/entities/priority', {
      data: { title: uniqueId('Child 1') },
    });
    const child1 = await child1Resp.json();

    const child2Resp = await request.post('/api/entities/priority', {
      data: { title: uniqueId('Child 2') },
    });
    const child2 = await child2Resp.json();

    // Link both
    await request.post(`/api/entities/priority/${parentId}/relationships`, {
      data: {
        child_entity_id: child1.data.id,
        relationship_kind: 'hierarchy',
      },
    });

    await request.post(`/api/entities/priority/${parentId}/relationships`, {
      data: {
        child_entity_id: child2.data.id,
        relationship_kind: 'hierarchy',
      },
    });

    // Get children
    const childrenResp = await request.get(`/api/entities/priority/${parentId}/children`);
    expect(childrenResp.ok()).toBeTruthy();

    const childrenData = await childrenResp.json();
    expect(childrenData.success).toBe(true);
    expect(Array.isArray(childrenData.data)).toBe(true);
    expect(childrenData.data.length).toBe(2);
  });

  test('DELETE hierarchy relationship removes link', async ({ request }) => {
    // Create parent and child
    const parentResp = await request.post('/api/entities/priority', {
      data: { title: uniqueId('Parent') },
    });
    const parent = await parentResp.json();
    const parentId = parent.data.id;

    const childResp = await request.post('/api/entities/priority', {
      data: { title: uniqueId('Child') },
    });
    const child = await childResp.json();
    const childId = child.data.id;

    // Create link
    await request.post(`/api/entities/priority/${parentId}/relationships`, {
      data: {
        child_entity_id: childId,
        relationship_kind: 'hierarchy',
      },
    });

    // Verify it exists
    let rels = await request.get(`/api/entities/priority/${parentId}/relationships`);
    let relData = await rels.json();
    expect(relData.data.some(r => r.child_entity_id === childId)).toBe(true);

    // Delete relationship
    const delResp = await request.delete(
      `/api/entities/priority/${parentId}/relationships/${childId}/hierarchy`
    );
    expect(delResp.ok()).toBeTruthy();

    // Verify it's gone
    rels = await request.get(`/api/entities/priority/${parentId}/relationships`);
    relData = await rels.json();
    expect(relData.data.some(r => r.child_entity_id === childId)).toBe(false);
  });

  // ========== ASSOCIATION RELATIONSHIPS ==========

  test('CREATE association between different entity types', async ({ request }) => {
    // Create a work item
    const wiResp = await request.post('/api/entities/work_item', {
      data: { title: uniqueId('Daily Task') },
    });
    const workItem = await wiResp.json();
    const wiId = workItem.data.id;

    // Create a priority
    const priorResp = await request.post('/api/entities/priority', {
      data: { title: uniqueId('High Priority') },
    });
    const prior = await priorResp.json();
    const priorId = prior.data.id;

    // Create association
    const assocResp = await request.post(
      `/api/entities/work_item/${wiId}/relationships`,
      {
        data: {
          child_entity_id: priorId,
          relationship_kind: 'association',
        },
      }
    );
    expect(assocResp.ok()).toBeTruthy();
  });

  test('LIST all entities of one type includes fields properly', async ({ request }) => {
    // Create todo with multiple fields
    const createResp = await request.post('/api/entities/to_do', {
      data: {
        title: uniqueId('Todo Complete'),
        status: 'complete',
        notes: 'This task is finished',
      },
    });

    expect(createResp.ok()).toBeTruthy();
    const entity = await createResp.json();

    // Check individual fetch
    const getResp = await request.get(`/api/entities/to_do/${entity.data.id}`);
    const getData = await getResp.json();

    expect(getData.data.fields).toHaveProperty('status');
    expect(getData.data.fields).toHaveProperty('notes');
    expect(getData.data.fields.status).toBe('complete');
    expect(getData.data.fields.notes).toBe('This task is finished');
  });

  // ========== FIELD TYPE VARIATIONS ==========

  test('Store and retrieve text field', async ({ request }) => {
    const createResp = await request.post('/api/entities/priority', {
      data: {
        title: uniqueId('Project A'),
        status: 'Not Started',
      },
    });
    const entity = await createResp.json();
    const entityId = entity.data.id;

    const getResp = await request.get(`/api/entities/priority/${entityId}`);
    const getData = await getResp.json();

    expect(getData.data.fields.status).toBe('Not Started');
  });

  test('Store and retrieve long text field', async ({ request }) => {
    const longNotes = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' +
      'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ' +
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.';

    const createResp = await request.post('/api/entities/to_do', {
      data: {
        title: uniqueId('Todo with Notes'),
        notes: longNotes,
      },
    });
    const entity = await createResp.json();
    const entityId = entity.data.id;

    const getResp = await request.get(`/api/entities/to_do/${entityId}`);
    const getData = await getResp.json();

    expect(getData.data.fields.notes).toBe(longNotes);
  });

  // ========== ERROR HANDLING ==========

  test('CREATE entity with invalid type returns error', async ({ request }) => {
    const response = await request.post('/api/entities/invalid_type', {
      data: { title: 'Test' },
    });

    expect(response.ok()).toBeFalsy();
    expect(response.status()).toBe(404);
  });

  test('GET nonexistent entity returns 404', async ({ request }) => {
    const response = await request.get('/api/entities/priority/99999');

    expect(response.ok()).toBeFalsy();
    expect(response.status()).toBe(404);
  });

  test('DELETE nonexistent entity returns 404', async ({ request }) => {
    const response = await request.delete('/api/entities/priority/99999');

    expect(response.ok()).toBeFalsy();
    expect(response.status()).toBe(404);
  });

  // ========== BULK OPERATIONS ==========

  test('Create multiple entities of same type', async ({ request }) => {
    const titles = [
      uniqueId('Priority 1'),
      uniqueId('Priority 2'),
      uniqueId('Priority 3'),
    ];

    const ids = [];
    for (const title of titles) {
      const resp = await request.post('/api/entities/priority', {
        data: { title },
      });
      const data = await resp.json();
      ids.push(data.data.id);
    }

    expect(ids.length).toBe(3);

    // Verify all were created
    for (const id of ids) {
      const resp = await request.get(`/api/entities/priority/${id}`);
      expect(resp.ok()).toBeTruthy();
    }
  });

  test('Reorder entities by siblings', async ({ request }) => {
    // Create parent
    const parentResp = await request.post('/api/entities/priority', {
      data: { title: uniqueId('Parent') },
    });
    const parent = await parentResp.json();
    const parentId = parent.data.id;

    // Create 3 children
    const children = [];
    for (let i = 0; i < 3; i++) {
      const childResp = await request.post('/api/entities/priority', {
        data: { title: uniqueId(`Child ${i}`) },
      });
      const child = await childResp.json();
      children.push(child.data.id);

      await request.post(`/api/entities/priority/${parentId}/relationships`, {
        data: {
          child_entity_id: child.data.id,
          relationship_kind: 'hierarchy',
        },
      });
    }

    // Reorder them
    const reorderResp = await request.patch(
      `/api/entities/priority/${parentId}/reorder-children`,
      {
        data: {
          ordered_ids: [children[2], children[0], children[1]],
        },
      }
    );
    expect(reorderResp.ok()).toBeTruthy();
  });

  // ========== TYPE CONFIGURATION ==========

  test('Entity type has correct system flag', async ({ request }) => {
    const response = await request.get('/api/entity-types/priority');
    const data = await response.json();

    expect(data.data.is_system).toBe(1);
    expect(data.data.supports_hierarchy).toBe(1);
  });

  test('Entity type has correct field definitions', async ({ request }) => {
    const response = await request.get('/api/entity-types/to_do');
    const data = await response.json();

    expect(Array.isArray(data.data.fields)).toBe(true);
    expect(data.data.fields.length).toBeGreaterThan(0);

    // Check field structure
    const field = data.data.fields[0];
    expect(field).toHaveProperty('field_key');
    expect(field).toHaveProperty('label');
    expect(field).toHaveProperty('field_type');
  });
});
