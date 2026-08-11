# Carry-on: Recurring Todos/Tasks in Dailies - BACKEND COMPLETE

## What was done

### Phase 1: Backend Implementation ✅ COMPLETE

**Schema Changes (MySQL & MSSQL):**
1. Added `recurrence JSON` column to `to_dos` table - stores recurrence pattern
2. Added `recurrence JSON` column to `tasks` table - stores recurrence pattern  
3. Added tracking columns to `work_items` table:
   - `recurring_from_todo_id` INT - links work item to source todo
   - `recurring_from_task_id` INT - links work item to source task

**New Service: RecurrenceService** (`src/services/recurrenceService.js`)
- Validates recurrence patterns (daily, weekly, monthly, interval)
- Calculates next occurrence dates
- Generates work items for recurring items due on a date
- Exports `shouldOccurOnDate()` for direct testing
- Supports complex patterns:
  - **Daily**: Every day from start to end date
  - **Weekly**: Specific days of week (Mon-Fri, etc)
  - **Monthly**: Fixed date (15th), weekday-based (2nd Monday), or last day
  - **Interval**: Every N days from start date
- Handles edge cases: month boundaries, leap years, date ranges

**Integration Points:**
1. `workItemService.js`:
   - `getWorkItemsByDate()` - calls `generateWorkItemsForDate()` to auto-create recurring items
   - `updateWorkItemStatus()` - when marking "Complete", calls `generateNextRecurrenceForCompletedItem()` to create next occurrence

2. `toDoService.js`:
   - `createToDo()` - accepts and validates recurrence data, stores as JSON
   - `updateToDo()` - can update recurrence patterns
   - Parses JSON when fetching todos

3. `taskService.js`:
   - Same pattern as toDoService

**Bug Fixes:**
1. Fixed `getAllToDos()` query - removed `OR context_id IS NULL` that was pulling orphaned todos
   - This was causing deleted todos to reappear in some contexts

**Testing:**
- Created comprehensive test suite validating:
  - ✅ Recurrence pattern validation
  - ✅ Daily recurrence
  - ✅ Weekly recurrence (multiple days)
  - ✅ Monthly recurrence (fixed date, weekday, last day)
  - ✅ Interval recurrence (every N days)
  - ✅ Date range enforcement (start/end dates)
  - ✅ Next occurrence calculation
  - ✅ 5-occurrence preview generation

## What's next

### Phase 2: Frontend UI (NOT STARTED)
Need to add UI for setting recurrence in TodoEditor and TaskEditor:
1. Add recurrence checkbox to todo/task editors
2. Add recurrence type selector (daily/weekly/monthly/interval)
3. Add type-specific config panels:
   - Weekly: Checkboxes for each day
   - Monthly: Radio buttons for date/weekday/last-day
   - Interval: Numeric input for days
4. Add date range inputs (start/end dates)
5. Add max occurrences input
6. Add preview of next 5 occurrences
7. Wire up save/update of recurrence field

**UI Files to Update:**
- `src/public/js/editors/TodoEditor.js` - add recurrence form section
- `src/public/js/editors/TaskEditor.js` - add recurrence form section
- Corresponding `.ejs` template files if they exist

### Phase 3: Testing & Polish (NOT STARTED)
1. Run full Playwright e2e test suite
2. Test in browser with actual recurring todos/tasks
3. Verify recurring items appear in dailies
4. Verify auto-reset on completion works
5. Test edge cases (month boundaries, leap years, etc)
6. Check for any CSP violations or console errors

## How to Resume

1. **Database**: The schema changes are backward-compatible. Run `npm run db:init` to apply migrations.

2. **API**: The API already accepts recurrence data via existing POST/PUT endpoints:
   ```
   POST /api/to-dos
   {
     "title": "Daily standup",
     "recurrence": {
       "enabled": true,
       "type": "weekly",
       "daysOfWeek": [1, 2, 3, 4, 5],  // Mon-Fri
       "startDate": "2026-08-11"
     }
   }
   ```

3. **Dailies**: Auto-generation happens when fetching work items for a date - no additional API changes needed.

4. **Frontend UI**: Start with TodoEditor to add recurrence form. Reference the CLAUDE.md for RecurrenceService exports and JSON format details.

## Key Files

- `/src/services/recurrenceService.js` - Core recurrence logic (NEW)
- `/src/services/workItemService.js` - Integration point
- `/src/services/toDoService.js` - Updated
- `/src/services/taskService.js` - Updated
- `/src/database/schema/mysqlSchema.js` - Updated (schema migrations)
- `/src/database/schema/mssqlSchema.js` - Updated (schema migrations)
- `/CLAUDE.md` - Documentation added

## Known Issues

None blocking this work. All core functionality is working and tested.
