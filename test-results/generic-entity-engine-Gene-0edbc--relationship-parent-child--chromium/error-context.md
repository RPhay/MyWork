# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: generic-entity-engine.spec.js >> Generic Entity Engine - Full Integration Tests >> CREATE hierarchy relationship (parent-child)
- Location: tests/e2e/generic-entity-engine.spec.js:237:3

# Error details

```
SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

# Test source

```ts
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
  160 |     const verified = await getResp.json();
  161 |     expect(verified.data.fields.status).toBe('complete');
  162 |   });
  163 | 
  164 |   test('DELETE entity removes it from list', async ({ request }) => {
  165 |     // Create
  166 |     const createResp = await request.post('/api/entities/priority', {
  167 |       data: { title: uniqueId('To Delete') },
  168 |     });
  169 |     const entity = await createResp.json();
  170 |     const entityId = entity.data.id;
  171 | 
  172 |     // Verify it exists
  173 |     let listResp = await request.get('/api/entities/priority');
  174 |     let list = await listResp.json();
  175 |     const beforeCount = list.data.length;
  176 | 
  177 |     // Delete
  178 |     const delResp = await request.delete(`/api/entities/priority/${entityId}`);
  179 |     expect(delResp.ok()).toBeTruthy();
  180 | 
  181 |     // Verify it's gone
  182 |     listResp = await request.get('/api/entities/priority');
  183 |     list = await listResp.json();
  184 |     const afterCount = list.data.length;
  185 |     expect(afterCount).toBe(beforeCount - 1);
  186 |   });
  187 | 
  188 |   // ========== ENTITY LISTING ==========
  189 | 
  190 |   test('LIST entities by type returns all of that type', async ({ request }) => {
  191 |     // Create 3 priorities
  192 |     for (let i = 0; i < 3; i++) {
  193 |       await request.post('/api/entities/priority', {
  194 |         data: { title: uniqueId(`Priority ${i}`) },
  195 |       });
  196 |     }
  197 | 
  198 |     // List priorities
  199 |     const response = await request.get('/api/entities/priority');
  200 |     expect(response.ok()).toBeTruthy();
  201 | 
  202 |     const data = await response.json();
  203 |     expect(data.success).toBe(true);
  204 |     expect(Array.isArray(data.data)).toBe(true);
  205 |     expect(data.data.length).toBeGreaterThanOrEqual(3);
  206 | 
  207 |     // All returned entities should be priorities
  208 |     for (const entity of data.data) {
  209 |       expect(entity.entity_type_id).toBe(3); // priority type
  210 |       expect(entity).toHaveProperty('title');
  211 |       expect(entity).toHaveProperty('fields');
  212 |     }
  213 |   });
  214 | 
  215 |   test('LIST entities includes field values', async ({ request }) => {
  216 |     // Create with fields
  217 |     await request.post('/api/entities/to_do', {
  218 |       data: {
  219 |         title: uniqueId('Todo with Status'),
  220 |         status: 'incomplete',
  221 |       },
  222 |     });
  223 | 
  224 |     // List
  225 |     const response = await request.get('/api/entities/to_do');
  226 |     const data = await response.json();
  227 | 
  228 |     // Find our entity
  229 |     const our = data.data.find(e => e.title.includes('Todo with Status'));
  230 |     expect(our).toBeDefined();
  231 |     expect(our.fields).toHaveProperty('status');
  232 |     expect(our.fields.status).toBe('incomplete');
  233 |   });
  234 | 
  235 |   // ========== HIERARCHY RELATIONSHIPS ==========
  236 | 
  237 |   test('CREATE hierarchy relationship (parent-child)', async ({ request }) => {
  238 |     // Create parent priority
  239 |     const parentResp = await request.post('/api/entities/priority', {
  240 |       data: { title: uniqueId('Parent Project') },
  241 |     });
> 242 |     const parent = await parentResp.json();
      |                    ^ SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
  243 |     const parentId = parent.data.id;
  244 | 
  245 |     // Create child priority
  246 |     const childResp = await request.post('/api/entities/priority', {
  247 |       data: { title: uniqueId('Sub-Project') },
  248 |     });
  249 |     const child = await childResp.json();
  250 |     const childId = child.data.id;
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
```