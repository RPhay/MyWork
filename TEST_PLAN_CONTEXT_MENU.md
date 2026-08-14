# Context Menu Associations - Comprehensive Test Plan

## Objective
Verify all "Add" and "Create" context menu options work correctly when associating items with work items.

## Test Data Setup
Before testing, ensure these objects exist:
- [ ] At least 1 Project/Priority
- [ ] At least 1 Category/Area
- [ ] At least 1 Goal
- [ ] At least 1 Todo
- [ ] At least 1 Task
- [ ] At least 1 Ticket
- [ ] At least 1 Idea

## Test Cases

### Add Submenu Tests (Association)

#### Test 1: Add -> Project
- [ ] Create or find a work item
- [ ] Right-click context menu > Add > Project
- [ ] Modal should appear with list of projects
- [ ] Select a project
- [ ] Success notification should appear
- [ ] Expand work item to verify project is associated

#### Test 2: Add -> Category
- [ ] Create or find a work item
- [ ] Right-click context menu > Add > Category
- [ ] Modal should appear with list of categories
- [ ] Select a category
- [ ] Success notification should appear
- [ ] Expand work item to verify category is associated

#### Test 3: Add -> Goal
- [ ] Create or find a work item
- [ ] Right-click context menu > Add > Goal
- [ ] Modal should appear with list of goals
- [ ] Select a goal
- [ ] Success notification should appear
- [ ] Expand work item to verify goal is associated

#### Test 4: Add -> Todo
- [ ] Create or find a work item
- [ ] Right-click context menu > Add > Todo
- [ ] Modal should appear with list of todos
- [ ] Select a todo
- [ ] Success notification should appear
- [ ] Expand work item to verify todo is associated

#### Test 5: Add -> Task
- [ ] Create or find a work item
- [ ] Right-click context menu > Add > Task
- [ ] Modal should appear with list of tasks
- [ ] Select a task
- [ ] Success notification should appear
- [ ] Expand work item to verify task is associated

#### Test 6: Add -> Ticket
- [ ] Create or find a work item
- [ ] Right-click context menu > Add > Ticket
- [ ] Modal should appear with list of tickets
- [ ] Select a ticket
- [ ] Success notification should appear
- [ ] Expand work item to verify ticket is associated

#### Test 7: Add -> Idea
- [ ] Create or find a work item
- [ ] Right-click context menu > Add > Idea
- [ ] Modal should appear with list of ideas
- [ ] Select an idea
- [ ] Success notification should appear
- [ ] Expand work item to verify idea is associated

### Create Submenu Tests (Create + Associate)

#### Test 8: Create -> Project
- [ ] Create or find a work item
- [ ] Right-click context menu > Create > Project
- [ ] Prompt should appear for project name
- [ ] Enter a name and confirm
- [ ] Success notification should appear
- [ ] Expand work item to verify project is associated

#### Test 9: Create -> Category
- [ ] Create or find a work item
- [ ] Right-click context menu > Create > Category
- [ ] Prompt should appear for category name
- [ ] Enter a name and confirm
- [ ] Success notification should appear
- [ ] Expand work item to verify category is associated

#### Test 10: Create -> Goal
- [ ] Create or find a work item
- [ ] Right-click context menu > Create > Goal
- [ ] Prompt should appear for goal name
- [ ] Enter a name and confirm
- [ ] Success notification should appear
- [ ] Expand work item to verify goal is associated

#### Test 11: Create -> Todo
- [ ] Create or find a work item
- [ ] Right-click context menu > Create > Todo
- [ ] Prompt should appear for todo title
- [ ] Enter a title and confirm
- [ ] Success notification should appear
- [ ] Expand work item to verify todo is associated

#### Test 12: Create -> Task
- [ ] Create or find a work item
- [ ] Right-click context menu > Create > Task
- [ ] Prompt should appear for task title
- [ ] Enter a title and confirm
- [ ] Success notification should appear
- [ ] Expand work item to verify task is associated

#### Test 13: Create -> Ticket
- [ ] Create or find a work item
- [ ] Right-click context menu > Create > Ticket
- [ ] Prompt should appear for ticket title
- [ ] Enter a title and confirm
- [ ] Success notification should appear
- [ ] Expand work item to verify ticket is associated

#### Test 14: Create -> Idea
- [ ] Create or find a work item
- [ ] Right-click context menu > Create > Idea
- [ ] Prompt should appear for idea title
- [ ] Enter a title and confirm
- [ ] Success notification should appear
- [ ] Expand work item to verify idea is associated

### Edge Cases

#### Test 15: Empty Lists
- [ ] If any category has no items, test Add for that category
- [ ] Modal should show "No items available" message
- [ ] Create option should still be available

#### Test 16: Multiple Associations
- [ ] Create a work item
- [ ] Associate multiple projects, categories, goals, etc.
- [ ] Expand work item to verify all are shown

#### Test 17: Remove Associations
- [ ] Right-click an associated child item
- [ ] Select "Remove"
- [ ] Verify association is removed
- [ ] Verify work item still exists

## Success Criteria
- All "Add" options open modal and can associate items
- All "Create" options create new items and associate them
- All associations appear in expanded work item view
- All success/error notifications display correctly
- No console errors or JavaScript exceptions
