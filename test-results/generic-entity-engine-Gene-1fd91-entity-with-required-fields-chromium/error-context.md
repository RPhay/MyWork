# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: generic-entity-engine.spec.js >> Generic Entity Engine - Full Integration Tests >> CREATE entity with required fields
- Location: tests/e2e/generic-entity-engine.spec.js:51:3

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('Generic Entity Engine - Full Integration Tests', () => {
  4   |   let contextId = 1;
  5   | 
  6   |   // Helper to create a unique ID for test isolation
  7   |   function uniqueId(prefix) {
  8   |     return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  9   |   }
  10  | 
  11  |   // ========== ENTITY TYPE OPERATIONS ==========
  12  | 
  13  |   test('GET entity types returns all system types', async ({ request }) => {
  14  |     const response = await request.get('/api/entity-types');
  15  |     expect(response.ok()).toBeTruthy();
  16  | 
  17  |     const data = await response.json();
  18  |     expect(data.success).toBe(true);
  19  |     expect(Array.isArray(data.data)).toBe(true);
  20  |     expect(data.data.length).toBeGreaterThanOrEqual(9);
  21  | 
  22  |     const typeNames = data.data.map(t => t.slug);
  23  |     expect(typeNames).toContain('work_item');
  24  |     expect(typeNames).toContain('priority');
  25  |     expect(typeNames).toContain('to_do');
  26  |     expect(typeNames).toContain('task');
  27  |     expect(typeNames).toContain('ticket');
  28  |   });
  29  | 
  30  |   test('GET entity type by slug returns type with fields', async ({ request }) => {
  31  |     const response = await request.get('/api/entity-types/priority');
  32  |     expect(response.ok()).toBeTruthy();
  33  | 
  34  |     const data = await response.json();
  35  |     expect(data.success).toBe(true);
  36  |     expect(data.data.slug).toBe('priority');
  37  |     expect(data.data.label).toBe('Projects');
  38  |     expect(Array.isArray(data.data.fields)).toBe(true);
  39  |   });
  40  | 
  41  |   test('GET entity type includes relationship rules', async ({ request }) => {
  42  |     const response = await request.get('/api/entity-types/priority');
  43  |     const data = await response.json();
  44  | 
  45  |     expect(data.data).toHaveProperty('relationships');
  46  |     expect(Array.isArray(data.data.relationships)).toBe(true);
  47  |   });
  48  | 
  49  |   // ========== ENTITY CRUD OPERATIONS ==========
  50  | 
  51  |   test('CREATE entity with required fields', async ({ request }) => {
  52  |     const payload = {
  53  |       title: uniqueId('Test Priority'),
  54  |     };
  55  | 
  56  |     const response = await request.post('/api/entities/priority', {
  57  |       data: payload,
  58  |     });
> 59  |     expect(response.ok()).toBeTruthy();
      |                           ^ Error: expect(received).toBeTruthy()
  60  | 
  61  |     const data = await response.json();
  62  |     expect(data.success).toBe(true);
  63  |     expect(data.data).toHaveProperty('id');
  64  |     expect(data.data.title).toBe(payload.title);
  65  |     expect(data.data.entity_type_id).toBe(3); // priority type
  66  |   });
  67  | 
  68  |   test('CREATE entity with custom fields', async ({ request }) => {
  69  |     const payload = {
  70  |       title: uniqueId('Priority with Status'),
  71  |       status: 'In Progress',
  72  |     };
  73  | 
  74  |     const response = await request.post('/api/entities/priority', {
  75  |       data: payload,
  76  |     });
  77  |     expect(response.ok()).toBeTruthy();
  78  | 
  79  |     const data = await response.json();
  80  |     expect(data.success).toBe(true);
  81  |     const entityId = data.data.id;
  82  | 
  83  |     // Verify fields were stored
  84  |     const getResponse = await request.get(`/api/entities/priority/${entityId}`);
  85  |     const getData = await getResponse.json();
  86  |     expect(getData.data.fields).toHaveProperty('status');
  87  |     expect(getData.data.fields.status).toBe('In Progress');
  88  |   });
  89  | 
  90  |   test('GET entity by ID returns all fields', async ({ request }) => {
  91  |     // First create an entity
  92  |     const createResp = await request.post('/api/entities/to_do', {
  93  |       data: {
  94  |         title: uniqueId('Test Todo'),
  95  |         notes: 'This is a test note',
  96  |         status: 'incomplete',
  97  |       },
  98  |     });
  99  |     const createdEntity = await createResp.json();
  100 |     const entityId = createdEntity.data.id;
  101 | 
  102 |     // Then fetch it
  103 |     const response = await request.get(`/api/entities/to_do/${entityId}`);
  104 |     expect(response.ok()).toBeTruthy();
  105 | 
  106 |     const data = await response.json();
  107 |     expect(data.success).toBe(true);
  108 |     expect(data.data.id).toBe(entityId);
  109 |     expect(data.data.title).toBe(createdEntity.data.title);
  110 |     expect(data.data.fields.notes).toBe('This is a test note');
  111 |     expect(data.data.fields.status).toBe('incomplete');
  112 |   });
  113 | 
  114 |   test('UPDATE entity updates title', async ({ request }) => {
  115 |     // Create
  116 |     const createResp = await request.post('/api/entities/priority', {
  117 |       data: { title: uniqueId('Original Title') },
  118 |     });
  119 |     const entity = await createResp.json();
  120 |     const entityId = entity.data.id;
  121 | 
  122 |     // Update
  123 |     const newTitle = uniqueId('Updated Title');
  124 |     const updateResp = await request.put(`/api/entities/priority/${entityId}`, {
  125 |       data: { title: newTitle },
  126 |     });
  127 |     expect(updateResp.ok()).toBeTruthy();
  128 | 
  129 |     const updated = await updateResp.json();
  130 |     expect(updated.data.title).toBe(newTitle);
  131 | 
  132 |     // Verify persistence
  133 |     const getResp = await request.get(`/api/entities/priority/${entityId}`);
  134 |     const verified = await getResp.json();
  135 |     expect(verified.data.title).toBe(newTitle);
  136 |   });
  137 | 
  138 |   test('UPDATE entity updates field values', async ({ request }) => {
  139 |     // Create
  140 |     const createResp = await request.post('/api/entities/to_do', {
  141 |       data: {
  142 |         title: uniqueId('Todo'),
  143 |         status: 'incomplete',
  144 |       },
  145 |     });
  146 |     const entity = await createResp.json();
  147 |     const entityId = entity.data.id;
  148 | 
  149 |     // Update field
  150 |     const updateResp = await request.put(`/api/entities/to_do/${entityId}`, {
  151 |       data: {
  152 |         title: entity.data.title,
  153 |         status: 'complete',
  154 |       },
  155 |     });
  156 |     expect(updateResp.ok()).toBeTruthy();
  157 | 
  158 |     // Verify
  159 |     const getResp = await request.get(`/api/entities/to_do/${entityId}`);
```