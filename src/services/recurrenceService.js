import * as db from '../database/connectionPool.js';
import { ValidationError } from '../config/errors.js';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function validateRecurrence(recurrence) {
  if (!recurrence) return;
  if (typeof recurrence !== 'object') {
    throw new ValidationError('Recurrence must be an object');
  }

  const { type, enabled } = recurrence;

  if (enabled === true && !type) {
    throw new ValidationError('Recurrence type is required when enabled');
  }

  if (enabled === true) {
    const validTypes = ['daily', 'weekly', 'monthly', 'interval'];
    if (!validTypes.includes(type)) {
      throw new ValidationError(`Invalid recurrence type: ${type}. Must be one of: ${validTypes.join(', ')}`);
    }

    // Type-specific validation
    if (type === 'weekly') {
      if (!Array.isArray(recurrence.daysOfWeek) || recurrence.daysOfWeek.length === 0) {
        throw new ValidationError('Weekly recurrence requires at least one day of week (0-6)');
      }
      if (recurrence.daysOfWeek.some(d => d < 0 || d > 6)) {
        throw new ValidationError('Days of week must be 0-6 (Sunday-Saturday)');
      }
    }

    if (type === 'interval') {
      if (!recurrence.intervalDays || recurrence.intervalDays < 1) {
        throw new ValidationError('Interval recurrence requires intervalDays >= 1');
      }
      // allowedDaysOfWeek is optional for interval type
      if (recurrence.allowedDaysOfWeek !== undefined) {
        if (!Array.isArray(recurrence.allowedDaysOfWeek) || recurrence.allowedDaysOfWeek.length === 0) {
          throw new ValidationError('If specifying days for interval, select at least one day');
        }
        if (recurrence.allowedDaysOfWeek.some(d => d < 0 || d > 6)) {
          throw new ValidationError('Days of week must be 0-6 (Sunday-Saturday)');
        }
      }
    }

    if (type === 'monthly') {
      const hasDateOfMonth = recurrence.dateOfMonth !== undefined && recurrence.dateOfMonth !== null;
      const hasWeekday = recurrence.weekday !== undefined && recurrence.weekday !== null;

      if (!hasDateOfMonth && !hasWeekday && !recurrence.lastDay) {
        throw new ValidationError('Monthly recurrence requires dateOfMonth, weekday+weekOfMonth, or lastDay');
      }

      if (hasDateOfMonth && (recurrence.dateOfMonth < 1 || recurrence.dateOfMonth > 31)) {
        throw new ValidationError('dateOfMonth must be 1-31');
      }

      if (hasWeekday) {
        if (recurrence.weekday < 0 || recurrence.weekday > 6) {
          throw new ValidationError('weekday must be 0-6');
        }
        if (!recurrence.weekOfMonth || recurrence.weekOfMonth < 1 || recurrence.weekOfMonth > 5) {
          throw new ValidationError('weekOfMonth must be 1-5 when using weekday');
        }
      }
    }
  }
}

function getNextDateForDaily(lastDate) {
  const date = parseDate(lastDate);
  date.setDate(date.getDate() + 1);
  return formatDate(date);
}

function getNextDateForWeekly(lastDate, daysOfWeek = []) {
  const date = parseDate(lastDate);

  if (daysOfWeek.length === 0) {
    daysOfWeek = [date.getDay()];
  }

  daysOfWeek = daysOfWeek.map(d => d % 7).sort((a, b) => a - b);

  let currentDay = date.getDay();
  let daysToAdd = 0;

  // Find the next occurrence of any specified day
  for (const targetDay of daysOfWeek) {
    if (targetDay > currentDay) {
      daysToAdd = targetDay - currentDay;
      break;
    }
  }

  if (daysToAdd === 0) {
    daysToAdd = (daysOfWeek[0] + 7) - currentDay;
  }

  date.setDate(date.getDate() + daysToAdd);
  return formatDate(date);
}

function getNextDateForInterval(lastDate, intervalDays = 1) {
  const date = parseDate(lastDate);
  date.setDate(date.getDate() + intervalDays);
  return formatDate(date);
}

function getNextDateForMonthly(lastDate, config) {
  const date = parseDate(lastDate);
  date.setMonth(date.getMonth() + 1);

  if (config.lastDay) {
    // Last day of month
    date.setDate(0);
    return formatDate(date);
  }

  if (config.dateOfMonth) {
    // Specific date of month (e.g., 15th)
    const maxDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const targetDay = Math.min(config.dateOfMonth, maxDay);
    date.setDate(targetDay);
    return formatDate(date);
  }

  if (config.weekday !== undefined && config.weekOfMonth) {
    // Nth weekday of month (e.g., 2nd Monday)
    date.setDate(1);
    let count = 0;

    while (count < config.weekOfMonth) {
      if (date.getDay() === config.weekday) {
        count++;
      }
      if (count < config.weekOfMonth) {
        date.setDate(date.getDate() + 1);
      }
    }
    return formatDate(date);
  }

  // Fallback to date of month (shouldn't reach here if validation passed)
  date.setDate(Math.min(config.dateOfMonth || 1, 28));
  return formatDate(date);
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function getNextOccurrenceDate(recurrence, fromDate) {
  if (!recurrence || !recurrence.enabled) {
    return null;
  }

  // Use provided date or today
  let currentDate = fromDate || new Date().toISOString().split('T')[0];

  // If we're before the start date, start from the start date
  if (recurrence.startDate && currentDate < recurrence.startDate) {
    currentDate = recurrence.startDate;
  }

  // Check if currentDate itself is a valid occurrence
  if (shouldOccurOnDate(currentDate, recurrence)) {
    return currentDate;
  }

  // Find the next occurrence after currentDate
  let nextDate = calculateNextDate(recurrence, currentDate);

  // Keep checking until we find a date that matches the recurrence pattern
  // (e.g., for monthly on 15th, we need to ensure it lands on 15th)
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    if (recurrence.endDate && nextDate > recurrence.endDate) {
      return null;
    }

    if (shouldOccurOnDate(nextDate, recurrence)) {
      return nextDate;
    }

    currentDate = nextDate;
    nextDate = calculateNextDate(recurrence, currentDate);
    attempts++;
  }

  return null;
}

function calculateNextDate(recurrence, lastDate) {
  const { type } = recurrence;

  switch (type) {
    case 'daily':
      return getNextDateForDaily(lastDate);
    case 'weekly':
      return getNextDateForWeekly(lastDate, recurrence.daysOfWeek);
    case 'interval':
      return getNextDateForInterval(lastDate, recurrence.intervalDays);
    case 'monthly':
      return getNextDateForMonthly(lastDate, recurrence);
    default:
      return getNextDateForDaily(lastDate);
  }
}

export function getNextFiveOccurrences(recurrence) {
  if (!recurrence || !recurrence.enabled) {
    return [];
  }

  const occurrences = [];
  let currentDate = recurrence.startDate || new Date().toISOString().split('T')[0];
  let checkDate = currentDate;
  let attempts = 0;
  const maxAttempts = 500;

  while (occurrences.length < 5 && attempts < maxAttempts) {
    attempts++;

    if (recurrence.endDate && checkDate > recurrence.endDate) {
      break;
    }

    if (recurrence.maxOccurrences && occurrences.length >= recurrence.maxOccurrences) {
      break;
    }

    if (shouldOccurOnDate(checkDate, recurrence)) {
      occurrences.push(checkDate);
    }

    checkDate = calculateNextDate(recurrence, checkDate);
  }

  return occurrences;
}

export async function generateWorkItemsForDate(date, contextId) {
  // Get all recurring todos and tasks that should appear on this date
  const recurringTodos = await db.query(`
    SELECT * FROM to_dos
    WHERE context_id = ?
      AND recurrence IS NOT NULL
      AND JSON_EXTRACT(recurrence, '$.enabled') = true
  `, [contextId]);

  const recurringTasks = await db.query(`
    SELECT * FROM tasks
    WHERE context_id = ?
      AND recurrence IS NOT NULL
      AND JSON_EXTRACT(recurrence, '$.enabled') = true
  `, [contextId]);

  // For each recurring item, check if it should appear on this date
  for (const todo of recurringTodos) {
    const recurrence = JSON.parse(todo.recurrence);

    // Check if work item already exists for this date
    const existing = await db.queryOne(
      'SELECT id FROM work_items WHERE date = ? AND recurring_from_todo_id = ? AND context_id = ?',
      [date, todo.id, contextId]
    );

    if (!existing && shouldOccurOnDate(date, recurrence)) {
      // Create work item for this recurring todo
      await createWorkItemFromRecurringTodo(todo, date, contextId);
    }
  }

  for (const task of recurringTasks) {
    const recurrence = JSON.parse(task.recurrence);

    // Check if work item already exists for this date
    const existing = await db.queryOne(
      'SELECT id FROM work_items WHERE date = ? AND recurring_from_task_id = ? AND context_id = ?',
      [date, task.id, contextId]
    );

    if (!existing && shouldOccurOnDate(date, recurrence)) {
      // Create work item for this recurring task
      await createWorkItemFromRecurringTask(task, date, contextId);
    }
  }
}

export function shouldOccurOnDate(dateStr, recurrence) {
  if (!recurrence || !recurrence.enabled) {
    return false;
  }

  // Check date range
  if (recurrence.startDate && dateStr < recurrence.startDate) {
    return false;
  }
  if (recurrence.endDate && dateStr > recurrence.endDate) {
    return false;
  }

  const targetDate = parseDate(dateStr);
  const targetDay = targetDate.getDay();
  const targetDateOfMonth = targetDate.getDate();

  switch (recurrence.type) {
    case 'daily':
      return true;

    case 'weekly':
      const daysOfWeek = recurrence.daysOfWeek || [targetDay];
      return daysOfWeek.includes(targetDay);

    case 'monthly':
      if (recurrence.lastDay) {
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);
        return nextDay.getMonth() !== targetDate.getMonth();
      }

      if (recurrence.dateOfMonth) {
        return targetDateOfMonth === recurrence.dateOfMonth;
      }

      if (recurrence.weekday !== undefined && recurrence.weekOfMonth) {
        if (targetDate.getDay() !== recurrence.weekday) {
          return false;
        }

        // Check if this is the Nth occurrence of this weekday
        const firstOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
        let count = 0;
        let current = new Date(firstOfMonth);

        while (current <= targetDate) {
          if (current.getDay() === recurrence.weekday) {
            count++;
          }
          if (current.toDateString() === targetDate.toDateString()) {
            return count === recurrence.weekOfMonth;
          }
          current.setDate(current.getDate() + 1);
        }
        return false;
      }

      return false;

    case 'interval':
      if (!recurrence.startDate) {
        return false;
      }

      const startDate = parseDate(recurrence.startDate);
      // Calculate days since start date (including the start date itself)
      const timeDiff = targetDate.getTime() - startDate.getTime();
      const daysDiff = Math.round(timeDiff / (1000 * 60 * 60 * 24));

      // Check interval match
      if (daysDiff < 0 || daysDiff % recurrence.intervalDays !== 0) {
        return false;
      }

      // If allowedDaysOfWeek is specified, also check the day of week
      if (recurrence.allowedDaysOfWeek && recurrence.allowedDaysOfWeek.length > 0) {
        return recurrence.allowedDaysOfWeek.includes(targetDay);
      }

      return true;

    default:
      return false;
  }
}

async function createWorkItemFromRecurringTodo(todo, date, contextId) {
  const nextOrderResult = await db.queryOne(
    'SELECT MAX(order_index) as maxOrder FROM work_items WHERE date = ? AND context_id = ?',
    [date, contextId]
  );
  const nextOrder = (nextOrderResult?.maxOrder ?? -1) + 1;

  await db.insert(`
    INSERT INTO work_items
    (date, title, description, notes, emoji, status, order_index, context_id, recurring_from_todo_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [date, todo.title, null, todo.notes || null, null, 'Not Started', nextOrder, contextId, todo.id]);
}

async function createWorkItemFromRecurringTask(task, date, contextId) {
  const nextOrderResult = await db.queryOne(
    'SELECT MAX(order_index) as maxOrder FROM work_items WHERE date = ? AND context_id = ?',
    [date, contextId]
  );
  const nextOrder = (nextOrderResult?.maxOrder ?? -1) + 1;

  await db.insert(`
    INSERT INTO work_items
    (date, title, description, notes, emoji, status, order_index, context_id, recurring_from_task_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [date, task.title, null, task.notes || null, null, 'Not Started', nextOrder, contextId, task.id]);
}

export async function generateNextRecurrenceForCompletedItem(workItem) {
  if (!workItem.recurring_from_todo_id && !workItem.recurring_from_task_id) {
    return;
  }

  const todoId = workItem.recurring_from_todo_id;
  const taskId = workItem.recurring_from_task_id;

  if (todoId) {
    const todo = await db.queryOne('SELECT * FROM to_dos WHERE id = ?', [todoId]);
    if (todo && todo.recurrence) {
      const recurrence = JSON.parse(todo.recurrence);
      const nextDate = getNextOccurrenceDate(recurrence, workItem.date);

      if (nextDate) {
        await generateWorkItemsForDate(nextDate, workItem.context_id);
      }
    }
  } else if (taskId) {
    const task = await db.queryOne('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (task && task.recurrence) {
      const recurrence = JSON.parse(task.recurrence);
      const nextDate = getNextOccurrenceDate(recurrence, workItem.date);

      if (nextDate) {
        await generateWorkItemsForDate(nextDate, workItem.context_id);
      }
    }
  }
}
