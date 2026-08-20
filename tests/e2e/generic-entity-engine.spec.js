import { test, expect } from '@playwright/test';

test.describe('Generic Entity Engine - Full Integration Tests', () => {
  let contextId = 1;
  let csrfToken = '';

  // Helper to create a unique ID for test isolation
  function uniqueId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Fetch CSRF token from home page before running tests
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await page.goto('/', { waitUntil: 'networkidle' });
      const content = await page.content();

      // Try to find CSRF token in data attributes
      let match = content.match(/data-csrf-token="([^"]+)"/);
      if (match) {
        csrfToken = match[1];
      } else {
        // Fallback: look in script
        match = content.match(/csrfToken['"]\s*:\s*['"]([^'"]+)['"]/);
        if (match) {
          csrfToken = match[1];
        }
      }
      console.log(`CSRF Token obtained: ${csrfToken.substring(0, 20)}...`);
    } finally {
      await page.close();
    }
  });

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
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json',
      },
      data: payload,
    });

    if (!response.ok()) {
      console.error('POST failed:', response.status(), await response.text());
    }
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('id');
    expect(data.data.title).toBe(payload.title);
  });

  test('CREATE entity with custom fields', async ({ request }) => {
    const payload = {
      title: uniqueId('Priority with Status'),
      status: 'In Progress',
    };

    const response = await request.post('/api/entities/priority', {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json',
      },
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
    const createResp = await request.post('/api/entities/priority', {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json',
      },
      data: {
        title: uniqueId('Test Entity'),
        status: 'In Progress',
      },
    });

    const createData = await createResp.json();
    const entityId = createData.data.id;

    // Now get it
    const getResp = await request.get(`/api/entities/priority/${entityId}`);
    expect(getResp.ok()).toBeTruthy();

    const getData = await getResp.json();
    expect(getData.data.id).toBe(entityId);
    expect(getData.data.title).toContain('Test Entity');
    expect(getData.data.fields).toHaveProperty('status');
  });

  test('UPDATE entity updates title', async ({ request }) => {
    // Create
    const createResp = await request.post('/api/entities/priority', {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json',
      },
      data: {
        title: uniqueId('Original Title'),
      },
    });

    const createData = await createResp.json();
    const entityId = createData.data.id;

    // Update
    const newTitle = uniqueId('Updated Title');
    const updateResp = await request.put(`/api/entities/priority/${entityId}`, {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json',
      },
      data: {
        title: newTitle,
      },
    });
    expect(updateResp.ok()).toBeTruthy();

    // Verify
    const getResp = await request.get(`/api/entities/priority/${entityId}`);
    const getData = await getResp.json();
    expect(getData.data.title).toBe(newTitle);
  });

  test('UPDATE entity updates field values', async ({ request }) => {
    // Create
    const createResp = await request.post('/api/entities/priority', {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json',
      },
      data: {
        title: uniqueId('Test Entity'),
        status: 'Not Started',
      },
    });

    const createData = await createResp.json();
    const entityId = createData.data.id;

    // Update field
    const updateResp = await request.put(`/api/entities/priority/${entityId}`, {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json',
      },
      data: {
        title: uniqueId('Test Entity'),
        status: 'Complete',
      },
    });
    expect(updateResp.ok()).toBeTruthy();

    // Verify
    const getResp = await request.get(`/api/entities/priority/${entityId}`);
    const getData = await getResp.json();
    expect(getData.data.fields.status).toBe('Complete');
  });

  test('DELETE entity removes it from list', async ({ request }) => {
    // Create
    const createResp = await request.post('/api/entities/priority', {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json',
      },
      data: {
        title: uniqueId('To Delete'),
      },
    });

    const createData = await createResp.json();
    const entityId = createData.data.id;

    // Delete
    const deleteResp = await request.delete(`/api/entities/priority/${entityId}`, {
      headers: {
        'X-CSRF-Token': csrfToken,
      },
    });
    expect(deleteResp.ok()).toBeTruthy();

    // Verify it's gone
    const getResp = await request.get(`/api/entities/priority/${entityId}`);
    expect(getResp.status()).toBe(404);
  });

  test('LIST entities by type returns all of that type', async ({ request }) => {
    const response = await request.get('/api/entities/priority');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });

  test('LIST entities includes field values', async ({ request }) => {
    // Create one with fields
    await request.post('/api/entities/priority', {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json',
      },
      data: {
        title: uniqueId('With Fields'),
        status: 'In Progress',
      },
    });

    // List and check
    const listResp = await request.get('/api/entities/priority');
    const listData = await listResp.json();

    const created = listData.data.find(e => e.title.includes('With Fields'));
    expect(created).toBeDefined();
    if (created) {
      expect(created.fields).toBeDefined();
      expect(created.fields.status).toBe('In Progress');
    }
  });

  // ========== RELATIONSHIP TESTS ==========

  test('CREATE hierarchy relationship (parent-child)', async ({ request }) => {
    // Create parent
    const parentResp = await request.post('/api/entities/priority', {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json',
      },
      data: {
        title: uniqueId('Parent'),
      },
    });
    const parentData = await parentResp.json();
    const parentId = parentData.data.id;

    // Create child
    const childResp = await request.post('/api/entities/priority', {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json',
      },
      data: {
        title: uniqueId('Child'),
      },
    });
    const childData = await childResp.json();
    const childId = childData.data.id;

    // Create relationship
    const relResp = await request.post(`/api/entities/priority/${parentId}/relationships`, {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json',
      },
      data: {
        child_entity_id: childId,
        relationship_kind: 'hierarchy',
      },
    });
    expect(relResp.ok()).toBeTruthy();

    const relData = await relResp.json();
    expect(relData.success).toBe(true);
  });

  test('GET relationships returns parent-child links', async ({ request }) => {
    // Create parent and child
    const parentResp = await request.post('/api/entities/priority', {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json',
      },
      data: {
        title: uniqueId('Parent'),
      },
    });
    const parentData = await parentResp.json();
    const parentId = parentData.data.id;

    const childResp = await request.post('/api/entities/priority', {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json',
      },
      data: {
        title: uniqueId('Child'),
      },
    });
    const childData = await childResp.json();
    const childId = childData.data.id;

    // Create relationship
    await request.post(`/api/entities/priority/${parentId}/relationships`, {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json',
      },
      data: {
        child_entity_id: childId,
        relationship_kind: 'hierarchy',
      },
    });

    // Get relationships
    const getResp = await request.get(`/api/entities/priority/${parentId}/relationships`);
    expect(getResp.ok()).toBeTruthy();

    const relData = await getResp.json();
    expect(relData.success).toBe(true);
    expect(Array.isArray(relData.data)).toBe(true);
  });

  test('CREATE entity with invalid type returns error', async ({ request }) => {
    const response = await request.post('/api/entities/nonexistent-type', {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json',
      },
      data: {
        title: 'Test',
      },
    });

    expect(response.ok()).toBeFalsy();
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('GET nonexistent entity returns 404', async ({ request }) => {
    const response = await request.get('/api/entities/priority/999999');
    expect(response.status()).toBe(404);
  });

  test('DELETE nonexistent entity returns 404', async ({ request }) => {
    const response = await request.delete('/api/entities/priority/999999', {
      headers: {
        'X-CSRF-Token': csrfToken,
      },
    });
    expect(response.status()).toBe(404);
  });

  test('Entity type has correct system flag', async ({ request }) => {
    const response = await request.get('/api/entity-types/priority');
    const data = await response.json();
    expect(data.data.is_system).toBe(1);
  });

  test('Entity type has correct field definitions', async ({ request }) => {
    const response = await request.get('/api/entity-types/priority');
    const data = await response.json();

    expect(Array.isArray(data.data.fields)).toBe(true);
    expect(data.data.fields.length).toBeGreaterThan(0);

    const fields = data.data.fields;
    expect(fields.some(f => f.field_key === 'status')).toBe(true);
  });
});
