# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: generic-entity-engine.spec.js >> Generic Entity Engine - Full Integration Tests >> LIST entities includes field values
- Location: tests/e2e/generic-entity-engine.spec.js:258:3

# Error details

```
TypeError: Cannot read properties of undefined (reading 'find')
```

# Test source

```ts
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
  240 |       },
  241 |     });
  242 |     expect(deleteResp.ok()).toBeTruthy();
  243 | 
  244 |     // Verify it's gone
  245 |     const getResp = await request.get(`/api/entities/priority/${entityId}`);
  246 |     expect(getResp.status()).toBe(404);
  247 |   });
  248 | 
  249 |   test('LIST entities by type returns all of that type', async ({ request }) => {
  250 |     const response = await request.get('/api/entities/priority');
  251 |     expect(response.ok()).toBeTruthy();
  252 | 
  253 |     const data = await response.json();
  254 |     expect(data.success).toBe(true);
  255 |     expect(Array.isArray(data.data)).toBe(true);
  256 |   });
  257 | 
  258 |   test('LIST entities includes field values', async ({ request }) => {
  259 |     // Create one with fields
  260 |     await request.post('/api/entities/priority', {
  261 |       headers: {
  262 |         'X-CSRF-Token': csrfToken,
  263 |         'Content-Type': 'application/json',
  264 |       },
  265 |       data: {
  266 |         title: uniqueId('With Fields'),
  267 |         status: 'In Progress',
  268 |       },
  269 |     });
  270 | 
  271 |     // List and check
  272 |     const listResp = await request.get('/api/entities/priority');
  273 |     const listData = await listResp.json();
  274 | 
> 275 |     const created = listData.data.find(e => e.title.includes('With Fields'));
      |                                   ^ TypeError: Cannot read properties of undefined (reading 'find')
  276 |     expect(created).toBeDefined();
  277 |     if (created) {
  278 |       expect(created.fields).toBeDefined();
  279 |       expect(created.fields.status).toBe('In Progress');
  280 |     }
  281 |   });
  282 | 
  283 |   // ========== RELATIONSHIP TESTS ==========
  284 | 
  285 |   test('CREATE hierarchy relationship (parent-child)', async ({ request }) => {
  286 |     // Create parent
  287 |     const parentResp = await request.post('/api/entities/priority', {
  288 |       headers: {
  289 |         'X-CSRF-Token': csrfToken,
  290 |         'Content-Type': 'application/json',
  291 |       },
  292 |       data: {
  293 |         title: uniqueId('Parent'),
  294 |       },
  295 |     });
  296 |     const parentData = await parentResp.json();
  297 |     const parentId = parentData.data.id;
  298 | 
  299 |     // Create child
  300 |     const childResp = await request.post('/api/entities/priority', {
  301 |       headers: {
  302 |         'X-CSRF-Token': csrfToken,
  303 |         'Content-Type': 'application/json',
  304 |       },
  305 |       data: {
  306 |         title: uniqueId('Child'),
  307 |       },
  308 |     });
  309 |     const childData = await childResp.json();
  310 |     const childId = childData.data.id;
  311 | 
  312 |     // Create relationship
  313 |     const relResp = await request.post(`/api/entities/priority/${parentId}/relationships`, {
  314 |       headers: {
  315 |         'X-CSRF-Token': csrfToken,
  316 |         'Content-Type': 'application/json',
  317 |       },
  318 |       data: {
  319 |         child_entity_id: childId,
  320 |         relationship_kind: 'hierarchy',
  321 |       },
  322 |     });
  323 |     expect(relResp.ok()).toBeTruthy();
  324 | 
  325 |     const relData = await relResp.json();
  326 |     expect(relData.success).toBe(true);
  327 |   });
  328 | 
  329 |   test('GET relationships returns parent-child links', async ({ request }) => {
  330 |     // Create parent and child
  331 |     const parentResp = await request.post('/api/entities/priority', {
  332 |       headers: {
  333 |         'X-CSRF-Token': csrfToken,
  334 |         'Content-Type': 'application/json',
  335 |       },
  336 |       data: {
  337 |         title: uniqueId('Parent'),
  338 |       },
  339 |     });
  340 |     const parentData = await parentResp.json();
  341 |     const parentId = parentData.data.id;
  342 | 
  343 |     const childResp = await request.post('/api/entities/priority', {
  344 |       headers: {
  345 |         'X-CSRF-Token': csrfToken,
  346 |         'Content-Type': 'application/json',
  347 |       },
  348 |       data: {
  349 |         title: uniqueId('Child'),
  350 |       },
  351 |     });
  352 |     const childData = await childResp.json();
  353 |     const childId = childData.data.id;
  354 | 
  355 |     // Create relationship
  356 |     await request.post(`/api/entities/priority/${parentId}/relationships`, {
  357 |       headers: {
  358 |         'X-CSRF-Token': csrfToken,
  359 |         'Content-Type': 'application/json',
  360 |       },
  361 |       data: {
  362 |         child_entity_id: childId,
  363 |         relationship_kind: 'hierarchy',
  364 |       },
  365 |     });
  366 | 
  367 |     // Get relationships
  368 |     const getResp = await request.get(`/api/entities/priority/${parentId}/relationships`);
  369 |     expect(getResp.ok()).toBeTruthy();
  370 | 
  371 |     const relData = await getResp.json();
  372 |     expect(relData.success).toBe(true);
  373 |     expect(Array.isArray(relData.data)).toBe(true);
  374 |   });
  375 | 
```