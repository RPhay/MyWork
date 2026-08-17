# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase1-ideas-migration-test.spec.js >> Phase 1: Ideas Migration >> Can update idea via entities API
- Location: tests/e2e/phase1-ideas-migration-test.spec.js:91:3

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Test source

```ts
  4   |   test.beforeAll(async () => {
  5   |     // Ensure dev server is running
  6   |     const response = await fetch('http://localhost:3000/api/entity-types');
  7   |     expect(response.ok).toBeTruthy();
  8   |   });
  9   | 
  10  |   test('Ideas are migrated to entities', async ({ request }) => {
  11  |     const response = await request.get('/api/entities/idea');
  12  |     expect(response.ok()).toBeTruthy();
  13  | 
  14  |     const data = await response.json();
  15  |     expect(data.success).toBe(true);
  16  |     expect(Array.isArray(data.data)).toBe(true);
  17  |     expect(data.data.length).toBeGreaterThan(50); // Should have 53+ migrated ideas
  18  |   });
  19  | 
  20  |   test('Idea entities have correct fields', async ({ request }) => {
  21  |     const response = await request.get('/api/entities/idea');
  22  |     const data = await response.json();
  23  |     const ideas = data.data;
  24  | 
  25  |     // Verify each idea has expected structure
  26  |     for (const idea of ideas.slice(0, 5)) {
  27  |       expect(idea).toHaveProperty('id');
  28  |       expect(idea).toHaveProperty('title');
  29  |       expect(idea).toHaveProperty('entity_type_id');
  30  |       expect(idea.entity_type_id).toBe(9); // idea type id from Phase 0
  31  |       expect(idea).toHaveProperty('fields');
  32  |     }
  33  |   });
  34  | 
  35  |   test('Idea notes are preserved in entity_field_values', async ({ request }) => {
  36  |     const response = await request.get('/api/entities/idea');
  37  |     const data = await response.json();
  38  |     const ideas = data.data;
  39  | 
  40  |     // Find an idea with notes
  41  |     const ideaWithNotes = ideas.find(idea => idea.fields && idea.fields.notes);
  42  |     if (ideaWithNotes) {
  43  |       expect(ideaWithNotes.fields.notes).toBeTruthy();
  44  |       expect(typeof ideaWithNotes.fields.notes).toBe('string');
  45  |     }
  46  |   });
  47  | 
  48  |   test('Hierarchy relationships created for idea folders', async ({ request }) => {
  49  |     const response = await request.get('/api/entities/idea');
  50  |     const data = await response.json();
  51  |     const ideas = data.data;
  52  | 
  53  |     // Check that first few entities have relationship data
  54  |     for (const idea of ideas.slice(0, 3)) {
  55  |       const relResponse = await request.get(`/api/entities/idea/${idea.id}/relationships`);
  56  |       expect(relResponse.ok()).toBeTruthy();
  57  | 
  58  |       const relData = await relResponse.json();
  59  |       expect(relData.success).toBe(true);
  60  |       expect(Array.isArray(relData.data)).toBe(true);
  61  |     }
  62  |   });
  63  | 
  64  |   test('Idea type is correctly configured', async ({ request }) => {
  65  |     const response = await request.get('/api/entity-types/idea');
  66  |     expect(response.ok()).toBeTruthy();
  67  | 
  68  |     const data = await response.json();
  69  |     expect(data.success).toBe(true);
  70  |     expect(data.data.slug).toBe('idea');
  71  |     expect(data.data.label).toBe('Brainstorming');
  72  |     expect(data.data.supports_hierarchy).toBe(1);
  73  |   });
  74  | 
  75  |   test('Can create new idea via entities API', async ({ request }) => {
  76  |     const createResponse = await request.post('/api/entities/idea', {
  77  |       data: {
  78  |         title: 'Test Idea from Migration',
  79  |         fields: {
  80  |           notes: 'This is a test idea created after migration'
  81  |         }
  82  |       }
  83  |     });
  84  | 
  85  |     expect(createResponse.ok()).toBeTruthy();
  86  |     const createData = await createResponse.json();
  87  |     expect(createData.success).toBe(true);
  88  |     expect(createData.data.title).toBe('Test Idea from Migration');
  89  |   });
  90  | 
  91  |   test('Can update idea via entities API', async ({ request }) => {
  92  |     // Get first idea
  93  |     const listResponse = await request.get('/api/entities/idea');
  94  |     const listData = await listResponse.json();
  95  |     const ideaId = listData.data[0].id;
  96  | 
  97  |     // Update it
  98  |     const updateResponse = await request.put(`/api/entities/idea/${ideaId}`, {
  99  |       data: {
  100 |         title: 'Updated idea title'
  101 |       }
  102 |     });
  103 | 
> 104 |     expect(updateResponse.ok()).toBeTruthy();
      |                                 ^ Error: expect(received).toBeTruthy()
  105 |     const updateData = await updateResponse.json();
  106 |     expect(updateData.data.title).toBe('Updated idea title');
  107 | 
  108 |     // Revert
  109 |     await request.put(`/api/entities/idea/${ideaId}`, {
  110 |       data: {
  111 |         title: listData.data[0].title
  112 |       }
  113 |     });
  114 |   });
  115 | });
  116 | 
```