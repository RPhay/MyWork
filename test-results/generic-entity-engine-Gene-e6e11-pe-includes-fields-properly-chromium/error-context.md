# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: generic-entity-engine.spec.js >> Generic Entity Engine - Full Integration Tests >> LIST all entities of one type includes fields properly
- Location: tests/e2e/generic-entity-engine.spec.js:415:3

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Test source

```ts
  325 |         relationship_kind: 'hierarchy',
  326 |       },
  327 |     });
  328 | 
  329 |     await request.post(`/api/entities/priority/${parentId}/relationships`, {
  330 |       data: {
  331 |         child_entity_id: child2.data.id,
  332 |         relationship_kind: 'hierarchy',
  333 |       },
  334 |     });
  335 | 
  336 |     // Get children
  337 |     const childrenResp = await request.get(`/api/entities/priority/${parentId}/children`);
  338 |     expect(childrenResp.ok()).toBeTruthy();
  339 | 
  340 |     const childrenData = await childrenResp.json();
  341 |     expect(childrenData.success).toBe(true);
  342 |     expect(Array.isArray(childrenData.data)).toBe(true);
  343 |     expect(childrenData.data.length).toBe(2);
  344 |   });
  345 | 
  346 |   test('DELETE hierarchy relationship removes link', async ({ request }) => {
  347 |     // Create parent and child
  348 |     const parentResp = await request.post('/api/entities/priority', {
  349 |       data: { title: uniqueId('Parent') },
  350 |     });
  351 |     const parent = await parentResp.json();
  352 |     const parentId = parent.data.id;
  353 | 
  354 |     const childResp = await request.post('/api/entities/priority', {
  355 |       data: { title: uniqueId('Child') },
  356 |     });
  357 |     const child = await childResp.json();
  358 |     const childId = child.data.id;
  359 | 
  360 |     // Create link
  361 |     await request.post(`/api/entities/priority/${parentId}/relationships`, {
  362 |       data: {
  363 |         child_entity_id: childId,
  364 |         relationship_kind: 'hierarchy',
  365 |       },
  366 |     });
  367 | 
  368 |     // Verify it exists
  369 |     let rels = await request.get(`/api/entities/priority/${parentId}/relationships`);
  370 |     let relData = await rels.json();
  371 |     expect(relData.data.some(r => r.child_entity_id === childId)).toBe(true);
  372 | 
  373 |     // Delete relationship
  374 |     const delResp = await request.delete(
  375 |       `/api/entities/priority/${parentId}/relationships/${childId}/hierarchy`
  376 |     );
  377 |     expect(delResp.ok()).toBeTruthy();
  378 | 
  379 |     // Verify it's gone
  380 |     rels = await request.get(`/api/entities/priority/${parentId}/relationships`);
  381 |     relData = await rels.json();
  382 |     expect(relData.data.some(r => r.child_entity_id === childId)).toBe(false);
  383 |   });
  384 | 
  385 |   // ========== ASSOCIATION RELATIONSHIPS ==========
  386 | 
  387 |   test('CREATE association between different entity types', async ({ request }) => {
  388 |     // Create a work item
  389 |     const wiResp = await request.post('/api/entities/work_item', {
  390 |       data: { title: uniqueId('Daily Task') },
  391 |     });
  392 |     const workItem = await wiResp.json();
  393 |     const wiId = workItem.data.id;
  394 | 
  395 |     // Create a priority
  396 |     const priorResp = await request.post('/api/entities/priority', {
  397 |       data: { title: uniqueId('High Priority') },
  398 |     });
  399 |     const prior = await priorResp.json();
  400 |     const priorId = prior.data.id;
  401 | 
  402 |     // Create association
  403 |     const assocResp = await request.post(
  404 |       `/api/entities/work_item/${wiId}/relationships`,
  405 |       {
  406 |         data: {
  407 |           child_entity_id: priorId,
  408 |           relationship_kind: 'association',
  409 |         },
  410 |       }
  411 |     );
  412 |     expect(assocResp.ok()).toBeTruthy();
  413 |   });
  414 | 
  415 |   test('LIST all entities of one type includes fields properly', async ({ request }) => {
  416 |     // Create todo with multiple fields
  417 |     const createResp = await request.post('/api/entities/to_do', {
  418 |       data: {
  419 |         title: uniqueId('Todo Complete'),
  420 |         status: 'complete',
  421 |         notes: 'This task is finished',
  422 |       },
  423 |     });
  424 | 
> 425 |     expect(createResp.ok()).toBeTruthy();
      |                             ^ Error: expect(received).toBeTruthy()
  426 |     const entity = await createResp.json();
  427 | 
  428 |     // Check individual fetch
  429 |     const getResp = await request.get(`/api/entities/to_do/${entity.data.id}`);
  430 |     const getData = await getResp.json();
  431 | 
  432 |     expect(getData.data.fields).toHaveProperty('status');
  433 |     expect(getData.data.fields).toHaveProperty('notes');
  434 |     expect(getData.data.fields.status).toBe('complete');
  435 |     expect(getData.data.fields.notes).toBe('This task is finished');
  436 |   });
  437 | 
  438 |   // ========== FIELD TYPE VARIATIONS ==========
  439 | 
  440 |   test('Store and retrieve text field', async ({ request }) => {
  441 |     const createResp = await request.post('/api/entities/priority', {
  442 |       data: {
  443 |         title: uniqueId('Project A'),
  444 |         status: 'Not Started',
  445 |       },
  446 |     });
  447 |     const entity = await createResp.json();
  448 |     const entityId = entity.data.id;
  449 | 
  450 |     const getResp = await request.get(`/api/entities/priority/${entityId}`);
  451 |     const getData = await getResp.json();
  452 | 
  453 |     expect(getData.data.fields.status).toBe('Not Started');
  454 |   });
  455 | 
  456 |   test('Store and retrieve long text field', async ({ request }) => {
  457 |     const longNotes = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' +
  458 |       'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ' +
  459 |       'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.';
  460 | 
  461 |     const createResp = await request.post('/api/entities/to_do', {
  462 |       data: {
  463 |         title: uniqueId('Todo with Notes'),
  464 |         notes: longNotes,
  465 |       },
  466 |     });
  467 |     const entity = await createResp.json();
  468 |     const entityId = entity.data.id;
  469 | 
  470 |     const getResp = await request.get(`/api/entities/to_do/${entityId}`);
  471 |     const getData = await getResp.json();
  472 | 
  473 |     expect(getData.data.fields.notes).toBe(longNotes);
  474 |   });
  475 | 
  476 |   // ========== ERROR HANDLING ==========
  477 | 
  478 |   test('CREATE entity with invalid type returns error', async ({ request }) => {
  479 |     const response = await request.post('/api/entities/invalid_type', {
  480 |       data: { title: 'Test' },
  481 |     });
  482 | 
  483 |     expect(response.ok()).toBeFalsy();
  484 |     expect(response.status()).toBe(404);
  485 |   });
  486 | 
  487 |   test('GET nonexistent entity returns 404', async ({ request }) => {
  488 |     const response = await request.get('/api/entities/priority/99999');
  489 | 
  490 |     expect(response.ok()).toBeFalsy();
  491 |     expect(response.status()).toBe(404);
  492 |   });
  493 | 
  494 |   test('DELETE nonexistent entity returns 404', async ({ request }) => {
  495 |     const response = await request.delete('/api/entities/priority/99999');
  496 | 
  497 |     expect(response.ok()).toBeFalsy();
  498 |     expect(response.status()).toBe(404);
  499 |   });
  500 | 
  501 |   // ========== BULK OPERATIONS ==========
  502 | 
  503 |   test('Create multiple entities of same type', async ({ request }) => {
  504 |     const titles = [
  505 |       uniqueId('Priority 1'),
  506 |       uniqueId('Priority 2'),
  507 |       uniqueId('Priority 3'),
  508 |     ];
  509 | 
  510 |     const ids = [];
  511 |     for (const title of titles) {
  512 |       const resp = await request.post('/api/entities/priority', {
  513 |         data: { title },
  514 |       });
  515 |       const data = await resp.json();
  516 |       ids.push(data.data.id);
  517 |     }
  518 | 
  519 |     expect(ids.length).toBe(3);
  520 | 
  521 |     // Verify all were created
  522 |     for (const id of ids) {
  523 |       const resp = await request.get(`/api/entities/priority/${id}`);
  524 |       expect(resp.ok()).toBeTruthy();
  525 |     }
```