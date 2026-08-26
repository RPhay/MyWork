import { test, expect } from '@playwright/test';

test.describe('Generic Entity Engine - Full Integration Tests', () => {
  let contextId = 1;
  let csrfToken = '';

  // Helper to create a unique ID for test isolation
  // ZZZ-prefixed so the fixtures are identifiable and the global sweep can
  // reach them. Without it this spec's rows accumulated in the user's database
  // under names like "With Fields-1787..." - and then poisoned the LIST test
  // below, which matched the OLDEST such row rather than its own.
  function uniqueId(prefix) {
    return `ZZZ ${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // The token has to be minted from the SAME context that will spend it.
  //
  // This used to open a browser page in beforeAll, scrape data-csrf-token out
  // of the HTML, and then send it from the `request` fixture - a different
  // cookie jar, and so a different session. csurf keeps its secret in the
  // session (cookie: false), so the token never matched and every POST here
  // came back "403 CSRF validation failed". The failures then read as engine
  // bugs: `expect(response.ok()).toBeTruthy()` on a 403, and
  // `SyntaxError: Unexpected token '<'` from parsing the error PAGE as JSON.
  //
  // `request` is per-test, so beforeEach gets the token from the context the
  // test itself will use.
  test.beforeEach(async ({ request }) => {
    const html = await (await request.get('/')).text();
    const match = html.match(/data-csrf-token="([^"]+)"/);
    csrfToken = match ? match[1] : '';
  });

  // Clean up through the same context, both calls: DELETE /api/entities is a
  // SOFT delete, and only DELETE /api/trash/:id actually removes the row.
  // Relying on the global sweep instead left 11 rows a run reaching it.
  test.afterEach(async ({ request }) => {
    const headers = { 'X-CSRF-Token': csrfToken, 'Content-Type': 'application/json' };
    for (const slug of ['priority', 'idea']) {
      const listed = await (await request.get(`/api/entities/${slug}`)).json().catch(() => ({}));
      for (const e of (listed.data || []).filter((x) => String(x.title || '').startsWith('ZZZ'))) {
        await request.delete(`/api/entities/${slug}/${e.id}`, { headers });
      }
    }
    const trash = await (await request.get('/api/trash?limit=200')).json().catch(() => ({}));
    for (const batch of (trash.data || [])) {
      for (const item of (batch.items || [])) {
        if (String(item.title || '').startsWith('ZZZ')) {
          await request.delete(`/api/trash/${item.id}`, { headers });
        }
      }
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
    expect(typeNames).toContain('daily');
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

  // Field values go under `fields`, not at the top level: createEntity reads
  // `data.fields?.[field_key]`. These payloads put `status` beside `title`, so
  // it was silently ignored - the entity was created, came back with
  // `fields: {}`, and the assertions read like the engine had dropped the
  // value it had never been given.
  test('CREATE entity with custom fields', async ({ request }) => {
    const payload = {
      title: uniqueId('Priority with Status'),
      fields: { status: 'In Progress' },
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
        fields: { status: 'In Progress' },
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
        fields: { status: 'Not Started' },
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
        fields: { status: 'Complete' },
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
    const listTitle = uniqueId('With Fields');
    await request.post('/api/entities/priority', {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json',
      },
      data: {
        title: listTitle,
        fields: { status: 'In Progress' },
      },
    });

    // List and check
    const listResp = await request.get('/api/entities/priority');
    const listData = await listResp.json();

    // Match the EXACT title. `includes('With Fields')` found the first row of
    // any run, which on a database holding rows from before the payload fix
    // was one that genuinely had no status.
    const created = listData.data.find(e => e.title === listTitle);
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
        // The route destructures { parentEntityId, childEntityId,
        // relationshipKind }. snake_case arrived as undefined on all three, so
        // the POST 400'd and the failure read as "relationships are broken".
        parentEntityId: parentId,
        childEntityId: childId,
        relationshipKind: 'hierarchy',
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
        // The route destructures { parentEntityId, childEntityId,
        // relationshipKind }. snake_case arrived as undefined on all three, so
        // the POST 400'd and the failure read as "relationships are broken".
        parentEntityId: parentId,
        childEntityId: childId,
        relationshipKind: 'hierarchy',
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
