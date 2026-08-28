// The compact child-item editor pane and its field map.
// Split out of dailies.js - see dashboard.ejs for load order.
// dailies.js loads LAST and holds the DOMContentLoaded bootstrap.

// Which fields the compact child-item editor form shows/collects per type -
// the single source of truth for both loadChildItemForEditing() (which fields
// to show) and the save handler (which fields to send), so they can't drift
// apart the way the two separate if/else chains they replaced could.
const CHILD_ITEM_FIELD_MAP = {
  todo: ['notes', 'status'],
  task: ['notes', 'status'],
  ticket: ['notes'],
  idea: ['notes'],
  priority: ['notes'],
  goal: ['description', 'year'],
  area: ['description'],
  template: ['description'],
};

const CHILD_ITEM_FIELD_TO_GROUP_ID = {
  notes: 'childItemEditorNotesField',
  description: 'childItemEditorDescriptionField',
  status: 'childItemEditorStatusField',
  year: 'childItemEditorYearField',
};

// Store currently edited child item
let currentEditingChild = null;
let childItemEditorId = null;
const childItemChangeTracker = createChangeTracker({
  formId: 'childItemEditorForm',
  saveBtnId: 'saveChildItemEditorBtn',
  selectors: ['input[type="text"]', 'textarea', 'input[type="number"]', 'select'],
});

function openChildItemEditor(type, id) {
  // If clicking same item, toggle close
  if (currentEditingChild?.id === id && currentEditingChild?.type === type) {
    closeChildItemEditor();
    return;
  }

  currentEditingChild = { type, id };
  childItemEditorId = id;

  // Hide work item editor, show child editor
  const workPane = document.getElementById('dailyEditorPane');
  const childPane = document.getElementById('childItemEditorPane');
  if (workPane) workPane.classList.add('hidden');
  if (childPane) childPane.classList.remove('hidden');

  // Load child item data
  childItemChangeTracker.resetChangeTracking();

  loadChildItemForEditing(type, id);
  childItemChangeTracker.trackFormChanges();
  syncDailiesRowSelection();
}

function closeChildItemEditor() {
  currentEditingChild = null;
  childItemEditorId = null;
  const childPane = document.getElementById('childItemEditorPane');
  const workPane = document.getElementById('dailyEditorPane');
  if (childPane) childPane.classList.add('hidden');
  if (workPane) workPane.classList.remove('hidden');
  // Falls back to the work item whose children these are, which is still open
  // behind the child editor.
  syncDailiesRowSelection();
}

async function loadChildItemForEditing(type, id) {
  const typeMap = {
    'priority': '/api/priorities',
    'category': '/api/categories',
    'goal': '/api/goals',
    'template': '/api/daily-templates',
    'todo': '/api/to-dos',
    'task': '/api/tasks',
    'ticket': '/api/tickets',
    'idea': '/api/ideas'
  };

  const typeLabels = {
    'priority': 'Priority',
    'category': 'Category',
    'goal': 'Goal',
    'template': 'Template',
    'todo': 'Todo',
    'task': 'Task',
    'ticket': 'Ticket',
    'idea': 'Idea'
  };

  const endpoint = typeMap[type];
  if (!endpoint) return;

  try {
    const response = await fetch(`${endpoint}/${id}`);
    const result = await response.json();
    if (result.success) {
      const item = result.data;

      // Set common fields
      document.getElementById('childItemEditorId').value = id;
      document.getElementById('childItemEditorType').value = type;
      document.getElementById('childItemEditorTitle').value = item.title || item.name || '';
      document.getElementById('childItemEditorDisplayTitle').textContent = item.title || item.name || 'Edit Item';
      document.getElementById('childItemEditorTypeLabel').textContent = typeLabels[type] || type;

      // Hide all optional fields first
      Object.values(CHILD_ITEM_FIELD_TO_GROUP_ID).forEach((groupId) => {
        document.getElementById(groupId).style.display = 'none';
      });

      // Show and populate only the fields this type actually has
      const fields = CHILD_ITEM_FIELD_MAP[type] || [];
      fields.forEach((field) => {
        document.getElementById(CHILD_ITEM_FIELD_TO_GROUP_ID[field]).style.display = 'block';
        if (field === 'notes') {
          document.getElementById('childItemEditorNotes').value = item.notes || '';
        } else if (field === 'description') {
          document.getElementById('childItemEditorDescription').value = item.description || '';
        } else if (field === 'status') {
          document.getElementById('childItemEditorStatus').value = item.status || 'incomplete';
        } else if (field === 'year') {
          document.getElementById('childItemEditorYear').value = item.year || '';
        }
      });
    }
  } catch (error) {
    console.error('Error loading child item:', error);
  }
}

// Editor functions - open child item editor in the right pane. The editChild*
// prefix is kept deliberately: every tab script shares one global scope (no
// modules), so a bare editCategory here would collide with any same-named
// global. The per-type scripts that used to declare those are all gone now,
// replaced by the generic entity engine, but the prefix still buys the
// isolation cheaply.
function editChildPriority(priorityId) {
  openChildItemEditor('priority', priorityId);
}

function editChildCategory(categoryId) {
  openChildItemEditor('category', categoryId);
}

function editChildGoal(goalId) {
  openChildItemEditor('goal', goalId);
}

function editChildTemplate(templateId) {
  openChildItemEditor('template', templateId);
}

function editChildTodo(todoId) {
  openChildItemEditor('todo', todoId);
}

function editChildTask(taskId) {
  openChildItemEditor('task', taskId);
}

function editChildTicket(ticketId) {
  openChildItemEditor('ticket', ticketId);
}

function editChildIdea(ideaId) {
  openChildItemEditor('idea', ideaId);
}

