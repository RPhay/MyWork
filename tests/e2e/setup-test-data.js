/**
 * Setup test data for context menu testing
 * This creates sample projects, goals, areas, todos, tasks, tickets, and ideas
 */

export async function setupTestData(page) {
  // Get CSRF token
  const csrfToken = await page.evaluate(() => window.APP_CONFIG?.csrfToken);

  const headers = csrfToken ? { 'X-CSRF-Token': csrfToken } : {};

  const testData = {};

  try {
    // Create a test project
    const projectResp = await page.request.post('/api/priorities', {
      data: { title: 'Test Project for Context Menu' },
      headers
    });
    if (projectResp.ok()) {
      const result = await projectResp.json();
      testData.project = result.data;
      console.log('✓ Created test project:', testData.project.title);
    }

    // Create a test category/area
    const areaResp = await page.request.post('/api/areas', {
      data: { name: 'Test Category for Context Menu' },
      headers
    });
    if (areaResp.ok()) {
      const result = await areaResp.json();
      testData.area = result.data;
      console.log('✓ Created test category:', testData.area.name);
    }

    // Create a test goal
    const year = new Date().getFullYear();
    const goalResp = await page.request.post('/api/goals', {
      data: { name: 'Test Goal for Context Menu', year },
      headers
    });
    if (goalResp.ok()) {
      const result = await goalResp.json();
      testData.goal = result.data;
      console.log('✓ Created test goal:', testData.goal.name);
    }

    // Create a test todo
    const todoResp = await page.request.post('/api/to-dos', {
      data: { title: 'Test Todo for Context Menu' },
      headers
    });
    if (todoResp.ok()) {
      const result = await todoResp.json();
      testData.todo = result.data;
      console.log('✓ Created test todo:', testData.todo.title);
    }

    // Create a test task
    const taskResp = await page.request.post('/api/tasks', {
      data: { title: 'Test Task for Context Menu' },
      headers
    });
    if (taskResp.ok()) {
      const result = await taskResp.json();
      testData.task = result.data;
      console.log('✓ Created test task:', testData.task.title);
    }

    // Create a test ticket
    const ticketResp = await page.request.post('/api/tickets', {
      data: { title: 'Test Ticket for Context Menu' },
      headers
    });
    if (ticketResp.ok()) {
      const result = await ticketResp.json();
      testData.ticket = result.data;
      console.log('✓ Created test ticket:', testData.ticket.title);
    }

    // Create a test idea
    const ideaResp = await page.request.post('/api/ideas', {
      data: { title: 'Test Idea for Context Menu' },
      headers
    });
    if (ideaResp.ok()) {
      const result = await ideaResp.json();
      testData.idea = result.data;
      console.log('✓ Created test idea:', testData.idea.title);
    }

  } catch (error) {
    console.error('Error setting up test data:', error);
  }

  return testData;
}

/**
 * Create a test work item
 */
export async function createTestWorkItem(page, title) {
  const csrfToken = await page.evaluate(() => window.APP_CONFIG?.csrfToken);
  const headers = csrfToken ? { 'X-CSRF-Token': csrfToken } : {};

  const today = new Date().toISOString().split('T')[0];
  const response = await page.request.post('/api/work', {
    data: {
      date: today,
      title: title || 'Test Work Item',
      description: 'Testing context menu associations',
      emoji: '📋'
    },
    headers
  });

  if (response.ok()) {
    const result = await response.json();
    console.log('✓ Created test work item:', result.data.title);
    return result.data;
  }
  console.error('Failed to create work item');
  return null;
}
