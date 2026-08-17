# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: generic-entity-engine.spec.js >> Generic Entity Engine - Full Integration Tests >> GET entity by ID returns all fields
- Location: tests/e2e/generic-entity-engine.spec.js:126:3

# Error details

```
SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

# Test source

```ts
  39  |     const response = await request.get('/api/entity-types');
  40  |     expect(response.ok()).toBeTruthy();
  41  | 
  42  |     const data = await response.json();
  43  |     expect(data.success).toBe(true);
  44  |     expect(Array.isArray(data.data)).toBe(true);
  45  |     expect(data.data.length).toBeGreaterThanOrEqual(9);
  46  | 
  47  |     const typeNames = data.data.map(t => t.slug);
  48  |     expect(typeNames).toContain('work_item');
  49  |     expect(typeNames).toContain('priority');
  50  |     expect(typeNames).toContain('to_do');
  51  |     expect(typeNames).toContain('task');
  52  |     expect(typeNames).toContain('ticket');
  53  |   });
  54  | 
  55  |   test('GET entity type by slug returns type with fields', async ({ request }) => {
  56  |     const response = await request.get('/api/entity-types/priority');
  57  |     expect(response.ok()).toBeTruthy();
  58  | 
  59  |     const data = await response.json();
  60  |     expect(data.success).toBe(true);
  61  |     expect(data.data.slug).toBe('priority');
  62  |     expect(data.data.label).toBe('Projects');
  63  |     expect(Array.isArray(data.data.fields)).toBe(true);
  64  |   });
  65  | 
  66  |   test('GET entity type includes relationship rules', async ({ request }) => {
  67  |     const response = await request.get('/api/entity-types/priority');
  68  |     const data = await response.json();
  69  | 
  70  |     expect(data.data).toHaveProperty('relationships');
  71  |     expect(Array.isArray(data.data.relationships)).toBe(true);
  72  |   });
  73  | 
  74  |   // ========== ENTITY CRUD OPERATIONS ==========
  75  | 
  76  |   test('CREATE entity with required fields', async ({ request }) => {
  77  |     const payload = {
  78  |       title: uniqueId('Test Priority'),
  79  |     };
  80  | 
  81  |     const response = await request.post('/api/entities/priority', {
  82  |       headers: {
  83  |         'X-CSRF-Token': csrfToken,
  84  |         'Content-Type': 'application/json',
  85  |       },
  86  |       data: payload,
  87  |     });
  88  | 
  89  |     if (!response.ok()) {
  90  |       console.error('POST failed:', response.status(), await response.text());
  91  |     }
  92  |     expect(response.ok()).toBeTruthy();
  93  | 
  94  |     const data = await response.json();
  95  |     expect(data.success).toBe(true);
  96  |     expect(data.data).toHaveProperty('id');
  97  |     expect(data.data.title).toBe(payload.title);
  98  |   });
  99  | 
  100 |   test('CREATE entity with custom fields', async ({ request }) => {
  101 |     const payload = {
  102 |       title: uniqueId('Priority with Status'),
  103 |       status: 'In Progress',
  104 |     };
  105 | 
  106 |     const response = await request.post('/api/entities/priority', {
  107 |       headers: {
  108 |         'X-CSRF-Token': csrfToken,
  109 |         'Content-Type': 'application/json',
  110 |       },
  111 |       data: payload,
  112 |     });
  113 |     expect(response.ok()).toBeTruthy();
  114 | 
  115 |     const data = await response.json();
  116 |     expect(data.success).toBe(true);
  117 |     const entityId = data.data.id;
  118 | 
  119 |     // Verify fields were stored
  120 |     const getResponse = await request.get(`/api/entities/priority/${entityId}`);
  121 |     const getData = await getResponse.json();
  122 |     expect(getData.data.fields).toHaveProperty('status');
  123 |     expect(getData.data.fields.status).toBe('In Progress');
  124 |   });
  125 | 
  126 |   test('GET entity by ID returns all fields', async ({ request }) => {
  127 |     // First create an entity
  128 |     const createResp = await request.post('/api/entities/priority', {
  129 |       headers: {
  130 |         'X-CSRF-Token': csrfToken,
  131 |         'Content-Type': 'application/json',
  132 |       },
  133 |       data: {
  134 |         title: uniqueId('Test Entity'),
  135 |         status: 'In Progress',
  136 |       },
  137 |     });
  138 | 
> 139 |     const createData = await createResp.json();
      |                        ^ SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
  140 |     const entityId = createData.data.id;
  141 | 
  142 |     // Now get it
  143 |     const getResp = await request.get(`/api/entities/priority/${entityId}`);
  144 |     expect(getResp.ok()).toBeTruthy();
  145 | 
  146 |     const getData = await getResp.json();
  147 |     expect(getData.data.id).toBe(entityId);
  148 |     expect(getData.data.title).toContain('Test Entity');
  149 |     expect(getData.data.fields).toHaveProperty('status');
  150 |   });
  151 | 
  152 |   test('UPDATE entity updates title', async ({ request }) => {
  153 |     // Create
  154 |     const createResp = await request.post('/api/entities/priority', {
  155 |       headers: {
  156 |         'X-CSRF-Token': csrfToken,
  157 |         'Content-Type': 'application/json',
  158 |       },
  159 |       data: {
  160 |         title: uniqueId('Original Title'),
  161 |       },
  162 |     });
  163 | 
  164 |     const createData = await createResp.json();
  165 |     const entityId = createData.data.id;
  166 | 
  167 |     // Update
  168 |     const newTitle = uniqueId('Updated Title');
  169 |     const updateResp = await request.put(`/api/entities/priority/${entityId}`, {
  170 |       headers: {
  171 |         'X-CSRF-Token': csrfToken,
  172 |         'Content-Type': 'application/json',
  173 |       },
  174 |       data: {
  175 |         title: newTitle,
  176 |       },
  177 |     });
  178 |     expect(updateResp.ok()).toBeTruthy();
  179 | 
  180 |     // Verify
  181 |     const getResp = await request.get(`/api/entities/priority/${entityId}`);
  182 |     const getData = await getResp.json();
  183 |     expect(getData.data.title).toBe(newTitle);
  184 |   });
  185 | 
  186 |   test('UPDATE entity updates field values', async ({ request }) => {
  187 |     // Create
  188 |     const createResp = await request.post('/api/entities/priority', {
  189 |       headers: {
  190 |         'X-CSRF-Token': csrfToken,
  191 |         'Content-Type': 'application/json',
  192 |       },
  193 |       data: {
  194 |         title: uniqueId('Test Entity'),
  195 |         status: 'Not Started',
  196 |       },
  197 |     });
  198 | 
  199 |     const createData = await createResp.json();
  200 |     const entityId = createData.data.id;
  201 | 
  202 |     // Update field
  203 |     const updateResp = await request.put(`/api/entities/priority/${entityId}`, {
  204 |       headers: {
  205 |         'X-CSRF-Token': csrfToken,
  206 |         'Content-Type': 'application/json',
  207 |       },
  208 |       data: {
  209 |         title: uniqueId('Test Entity'),
  210 |         status: 'Complete',
  211 |       },
  212 |     });
  213 |     expect(updateResp.ok()).toBeTruthy();
  214 | 
  215 |     // Verify
  216 |     const getResp = await request.get(`/api/entities/priority/${entityId}`);
  217 |     const getData = await getResp.json();
  218 |     expect(getData.data.fields.status).toBe('Complete');
  219 |   });
  220 | 
  221 |   test('DELETE entity removes it from list', async ({ request }) => {
  222 |     // Create
  223 |     const createResp = await request.post('/api/entities/priority', {
  224 |       headers: {
  225 |         'X-CSRF-Token': csrfToken,
  226 |         'Content-Type': 'application/json',
  227 |       },
  228 |       data: {
  229 |         title: uniqueId('To Delete'),
  230 |       },
  231 |     });
  232 | 
  233 |     const createData = await createResp.json();
  234 |     const entityId = createData.data.id;
  235 | 
  236 |     // Delete
  237 |     const deleteResp = await request.delete(`/api/entities/priority/${entityId}`, {
  238 |       headers: {
  239 |         'X-CSRF-Token': csrfToken,
```