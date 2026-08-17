# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: generic-entity-engine.spec.js >> Generic Entity Engine - Full Integration Tests >> GET nonexistent entity returns 404
- Location: tests/e2e/generic-entity-engine.spec.js:392:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 404
Received: 400
```

# Test source

```ts
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
  376 |   test('CREATE entity with invalid type returns error', async ({ request }) => {
  377 |     const response = await request.post('/api/entities/nonexistent-type', {
  378 |       headers: {
  379 |         'X-CSRF-Token': csrfToken,
  380 |         'Content-Type': 'application/json',
  381 |       },
  382 |       data: {
  383 |         title: 'Test',
  384 |       },
  385 |     });
  386 | 
  387 |     expect(response.ok()).toBeFalsy();
  388 |     const data = await response.json();
  389 |     expect(data.success).toBe(false);
  390 |   });
  391 | 
  392 |   test('GET nonexistent entity returns 404', async ({ request }) => {
  393 |     const response = await request.get('/api/entities/priority/999999');
> 394 |     expect(response.status()).toBe(404);
      |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  395 |   });
  396 | 
  397 |   test('DELETE nonexistent entity returns 404', async ({ request }) => {
  398 |     const response = await request.delete('/api/entities/priority/999999', {
  399 |       headers: {
  400 |         'X-CSRF-Token': csrfToken,
  401 |       },
  402 |     });
  403 |     expect(response.status()).toBe(404);
  404 |   });
  405 | 
  406 |   test('Entity type has correct system flag', async ({ request }) => {
  407 |     const response = await request.get('/api/entity-types/priority');
  408 |     const data = await response.json();
  409 |     expect(data.data.is_system).toBe(1);
  410 |   });
  411 | 
  412 |   test('Entity type has correct field definitions', async ({ request }) => {
  413 |     const response = await request.get('/api/entity-types/priority');
  414 |     const data = await response.json();
  415 | 
  416 |     expect(Array.isArray(data.data.fields)).toBe(true);
  417 |     expect(data.data.fields.length).toBeGreaterThan(0);
  418 | 
  419 |     const fields = data.data.fields;
  420 |     expect(fields.some(f => f.field_key === 'status')).toBe(true);
  421 |   });
  422 | });
  423 | 
```