# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: generic-entity-engine.spec.js >> Generic Entity Engine - Full Integration Tests >> DELETE hierarchy relationship removes link
- Location: tests/e2e/generic-entity-engine.spec.js:346:3

# Error details

```
SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

# Test source

```ts
  251 | 
  252 |     // Create hierarchy relationship
  253 |     const relResp = await request.post(
  254 |       `/api/entities/priority/${parentId}/relationships`,
  255 |       {
  256 |         data: {
  257 |           child_entity_id: childId,
  258 |           relationship_kind: 'hierarchy',
  259 |         },
  260 |       }
  261 |     );
  262 |     expect(relResp.ok()).toBeTruthy();
  263 | 
  264 |     const relData = await relResp.json();
  265 |     expect(relData.success).toBe(true);
  266 |   });
  267 | 
  268 |   test('GET relationships returns parent-child links', async ({ request }) => {
  269 |     // Create parent and child
  270 |     const parentResp = await request.post('/api/entities/priority', {
  271 |       data: { title: uniqueId('Parent') },
  272 |     });
  273 |     const parent = await parentResp.json();
  274 |     const parentId = parent.data.id;
  275 | 
  276 |     const childResp = await request.post('/api/entities/priority', {
  277 |       data: { title: uniqueId('Child') },
  278 |     });
  279 |     const child = await childResp.json();
  280 |     const childId = child.data.id;
  281 | 
  282 |     // Link them
  283 |     await request.post(`/api/entities/priority/${parentId}/relationships`, {
  284 |       data: {
  285 |         child_entity_id: childId,
  286 |         relationship_kind: 'hierarchy',
  287 |       },
  288 |     });
  289 | 
  290 |     // Get parent's relationships
  291 |     const relResp = await request.get(`/api/entities/priority/${parentId}/relationships`);
  292 |     expect(relResp.ok()).toBeTruthy();
  293 | 
  294 |     const relData = await relResp.json();
  295 |     expect(relData.success).toBe(true);
  296 |     expect(Array.isArray(relData.data)).toBe(true);
  297 | 
  298 |     const hasChild = relData.data.some(r => r.child_entity_id === childId);
  299 |     expect(hasChild).toBe(true);
  300 |   });
  301 | 
  302 |   test('GET children of entity', async ({ request }) => {
  303 |     // Create parent
  304 |     const parentResp = await request.post('/api/entities/priority', {
  305 |       data: { title: uniqueId('Parent Project') },
  306 |     });
  307 |     const parent = await parentResp.json();
  308 |     const parentId = parent.data.id;
  309 | 
  310 |     // Create 2 children
  311 |     const child1Resp = await request.post('/api/entities/priority', {
  312 |       data: { title: uniqueId('Child 1') },
  313 |     });
  314 |     const child1 = await child1Resp.json();
  315 | 
  316 |     const child2Resp = await request.post('/api/entities/priority', {
  317 |       data: { title: uniqueId('Child 2') },
  318 |     });
  319 |     const child2 = await child2Resp.json();
  320 | 
  321 |     // Link both
  322 |     await request.post(`/api/entities/priority/${parentId}/relationships`, {
  323 |       data: {
  324 |         child_entity_id: child1.data.id,
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
> 351 |     const parent = await parentResp.json();
      |                    ^ SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
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
```