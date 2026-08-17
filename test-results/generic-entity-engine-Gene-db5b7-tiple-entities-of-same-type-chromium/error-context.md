# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: generic-entity-engine.spec.js >> Generic Entity Engine - Full Integration Tests >> Create multiple entities of same type
- Location: tests/e2e/generic-entity-engine.spec.js:503:3

# Error details

```
SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

# Test source

```ts
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
  425 |     expect(createResp.ok()).toBeTruthy();
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
> 515 |       const data = await resp.json();
      |                    ^ SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
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
  526 |   });
  527 | 
  528 |   test('Reorder entities by siblings', async ({ request }) => {
  529 |     // Create parent
  530 |     const parentResp = await request.post('/api/entities/priority', {
  531 |       data: { title: uniqueId('Parent') },
  532 |     });
  533 |     const parent = await parentResp.json();
  534 |     const parentId = parent.data.id;
  535 | 
  536 |     // Create 3 children
  537 |     const children = [];
  538 |     for (let i = 0; i < 3; i++) {
  539 |       const childResp = await request.post('/api/entities/priority', {
  540 |         data: { title: uniqueId(`Child ${i}`) },
  541 |       });
  542 |       const child = await childResp.json();
  543 |       children.push(child.data.id);
  544 | 
  545 |       await request.post(`/api/entities/priority/${parentId}/relationships`, {
  546 |         data: {
  547 |           child_entity_id: child.data.id,
  548 |           relationship_kind: 'hierarchy',
  549 |         },
  550 |       });
  551 |     }
  552 | 
  553 |     // Reorder them
  554 |     const reorderResp = await request.patch(
  555 |       `/api/entities/priority/${parentId}/reorder-children`,
  556 |       {
  557 |         data: {
  558 |           ordered_ids: [children[2], children[0], children[1]],
  559 |         },
  560 |       }
  561 |     );
  562 |     expect(reorderResp.ok()).toBeTruthy();
  563 |   });
  564 | 
  565 |   // ========== TYPE CONFIGURATION ==========
  566 | 
  567 |   test('Entity type has correct system flag', async ({ request }) => {
  568 |     const response = await request.get('/api/entity-types/priority');
  569 |     const data = await response.json();
  570 | 
  571 |     expect(data.data.is_system).toBe(1);
  572 |     expect(data.data.supports_hierarchy).toBe(1);
  573 |   });
  574 | 
  575 |   test('Entity type has correct field definitions', async ({ request }) => {
  576 |     const response = await request.get('/api/entity-types/to_do');
  577 |     const data = await response.json();
  578 | 
  579 |     expect(Array.isArray(data.data.fields)).toBe(true);
  580 |     expect(data.data.fields.length).toBeGreaterThan(0);
  581 | 
  582 |     // Check field structure
  583 |     const field = data.data.fields[0];
  584 |     expect(field).toHaveProperty('field_key');
  585 |     expect(field).toHaveProperty('label');
  586 |     expect(field).toHaveProperty('field_type');
  587 |   });
  588 | });
  589 | 
```