import * as db from '../database/connectionPool.js';
import { NotFoundError, ValidationError } from '../config/errors.js';
import * as workItemService from './workItemService.js';
import { normalizeTimeBox } from './workItemService.js';
import { buildPathMap } from '../utils/hierarchyPath.js';
import * as entityService from './entityService.js';

async function attachAssociations(templates) {
  if (templates.length === 0) return templates;

  const ids = templates.map(t => t.id);
  const placeholders = ids.map(() => '?').join(',');

  const [areaRows, goalRows, priorityRows, allAreas, allPriorities] = await Promise.all([
    // Areas and goals are entities now (Phases 2-3); template_areas /
    // template_goals bridge the legacy templates table to them.
    db.query(
      `SELECT ta.template_id, a.id, a.title AS name
       FROM template_areas ta
       JOIN entities a ON ta.area_id = a.id
       WHERE ta.template_id IN (${placeholders})`,
      ids
    ),
    db.query(
      `SELECT tg.template_id, g.id, g.title AS name
       FROM template_goals tg
       JOIN entities g ON tg.goal_id = g.id
       WHERE tg.template_id IN (${placeholders})`,
      ids
    ),
    db.query(
      `SELECT tp.template_id, p.id, p.title
       FROM template_priorities tp
       JOIN entities p ON tp.priority_id = p.id
       WHERE tp.template_id IN (${placeholders})`,
      ids
    ),
    entityService.getEntityPathLookup('area'),
    entityService.getEntityPathLookup('priority'),
  ]);

  const areaPaths = buildPathMap(allAreas);
  const priorityPaths = buildPathMap(allPriorities, 'title');

  return templates.map(template => ({
    ...template,
    areas: areaRows.filter(r => r.template_id === template.id).map(r => ({ id: r.id, name: r.name, path: areaPaths.get(r.id) || r.name })),
    goals: goalRows.filter(r => r.template_id === template.id).map(r => ({ id: r.id, name: r.name })),
    priorities: priorityRows.filter(r => r.template_id === template.id).map(r => ({ id: r.id, title: r.title, path: priorityPaths.get(r.id) || r.title })),
  }));
}

export async function getAllTemplates(contextId) {
  const templates = await db.query('SELECT * FROM work_item_templates WHERE context_id = ? ORDER BY order_index ASC, title ASC', [contextId]);
  return attachAssociations(templates);
}

export async function getTemplateById(id) {
  const template = await db.queryOne('SELECT * FROM work_item_templates WHERE id = ?', [id]);
  if (!template) {
    throw new NotFoundError('Template not found');
  }
  const [withAssociations] = await attachAssociations([template]);
  return withAssociations;
}

async function setAssociations(table, column, templateId, ids) {
  await db.query(`DELETE FROM ${table} WHERE template_id = ?`, [templateId]);
  for (const id of ids) {
    await db.insert(`INSERT INTO ${table} (template_id, ${column}) VALUES (?, ?)`, [templateId, id]);
  }
}

export async function createTemplate(data, contextId) {
  const { title, description, emoji, source_id, status, area_ids, goal_ids, priority_ids, time_box_minutes, start_time } = data;

  if (!title) {
    throw new ValidationError('Template title is required');
  }

  const orderResult = await db.queryOne('SELECT MAX(order_index) as maxOrder FROM work_item_templates WHERE context_id = ?', [contextId]);
  const nextOrder = (orderResult?.maxOrder ?? -1) + 1;

  const templateId = await db.insert(
    'INSERT INTO work_item_templates (title, description, emoji, source_id, status, time_box_minutes, start_time, order_index, context_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [title, description ?? null, emoji ?? null, source_id || null, status || 'Not Started', normalizeTimeBox(time_box_minutes), start_time || null, nextOrder, contextId]
  );

  if (Array.isArray(area_ids) && area_ids.length > 0) {
    await setAssociations('template_areas', 'area_id', templateId, area_ids);
  }
  if (Array.isArray(goal_ids) && goal_ids.length > 0) {
    await setAssociations('template_goals', 'goal_id', templateId, goal_ids);
  }
  if (Array.isArray(priority_ids) && priority_ids.length > 0) {
    await setAssociations('template_priorities', 'priority_id', templateId, priority_ids);
  }

  return getTemplateById(templateId);
}

export async function updateTemplate(id, data) {
  const setClauses = [];
  const values = [];

  if (data.title !== undefined) {
    if (!data.title) {
      throw new ValidationError('Template title is required');
    }
    setClauses.push('title = ?');
    values.push(data.title);
  }
  if (data.description !== undefined) {
    setClauses.push('description = ?');
    values.push(data.description ?? null);
  }
  if (data.emoji !== undefined) {
    setClauses.push('emoji = ?');
    values.push(data.emoji || null);
  }
  if (data.source_id !== undefined) {
    setClauses.push('source_id = ?');
    values.push(data.source_id || null);
  }
  if (data.status !== undefined) {
    setClauses.push('status = ?');
    values.push(data.status || 'Not Started');
  }
  if (data.time_box_minutes !== undefined) {
    setClauses.push('time_box_minutes = ?');
    values.push(normalizeTimeBox(data.time_box_minutes));
  }
  if (data.start_time !== undefined) {
    setClauses.push('start_time = ?');
    values.push(data.start_time || null);
  }

  if (setClauses.length > 0) {
    values.push(id);
    await db.update(`UPDATE work_item_templates SET ${setClauses.join(', ')} WHERE id = ?`, values);
  }

  if (data.area_ids !== undefined) {
    await setAssociations('template_areas', 'area_id', id, Array.isArray(data.area_ids) ? data.area_ids : []);
  }
  if (data.goal_ids !== undefined) {
    await setAssociations('template_goals', 'goal_id', id, Array.isArray(data.goal_ids) ? data.goal_ids : []);
  }
  if (data.priority_ids !== undefined) {
    await setAssociations('template_priorities', 'priority_id', id, Array.isArray(data.priority_ids) ? data.priority_ids : []);
  }

  return getTemplateById(id);
}

export async function deleteTemplate(id) {
  const affectedRows = await db.deleteRecord('DELETE FROM work_item_templates WHERE id = ?', [id]);
  return affectedRows > 0;
}

const VALID_STATUSES = ['Not Started', 'In Progress', 'Complete'];

export async function updateTemplateStatus(id, status) {
  if (!VALID_STATUSES.includes(status)) {
    throw new ValidationError('Invalid status value');
  }

  await db.update('UPDATE work_item_templates SET status = ? WHERE id = ?', [status, id]);
  return getTemplateById(id);
}

export async function reorderTemplates(orderedIds) {
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update('UPDATE work_item_templates SET order_index = ? WHERE id = ?', [i, orderedIds[i]]);
  }
}

export async function updateTemplateEmoji(id, emoji) {
  await db.update('UPDATE work_item_templates SET emoji = ? WHERE id = ?', [emoji || null, id]);
  return getTemplateById(id);
}

export async function updateTemplateTimeBox(id, timeBoxMinutes) {
  await db.update('UPDATE work_item_templates SET time_box_minutes = ? WHERE id = ?', [normalizeTimeBox(timeBoxMinutes), id]);
  return getTemplateById(id);
}

export async function addAreaAssociation(templateId, areaId) {
  await db.query('INSERT IGNORE INTO template_areas (template_id, area_id) VALUES (?, ?)', [templateId, areaId]);
  return getTemplateById(templateId);
}

export async function removeAreaAssociation(templateId, areaId) {
  await db.deleteRecord('DELETE FROM template_areas WHERE template_id = ? AND area_id = ?', [templateId, areaId]);
}

export async function addGoalAssociation(templateId, goalId) {
  await db.query('INSERT IGNORE INTO template_goals (template_id, goal_id) VALUES (?, ?)', [templateId, goalId]);
  return getTemplateById(templateId);
}

export async function removeGoalAssociation(templateId, goalId) {
  await db.deleteRecord('DELETE FROM template_goals WHERE template_id = ? AND goal_id = ?', [templateId, goalId]);
}

export async function addPriorityAssociation(templateId, priorityId) {
  await db.query('INSERT IGNORE INTO template_priorities (template_id, priority_id) VALUES (?, ?)', [templateId, priorityId]);
  return getTemplateById(templateId);
}

export async function removePriorityAssociation(templateId, priorityId) {
  await db.deleteRecord('DELETE FROM template_priorities WHERE template_id = ? AND priority_id = ?', [templateId, priorityId]);
}

export async function instantiateTemplate(templateId, date) {
  if (!date) {
    throw new ValidationError('A date is required to create a work item from a template');
  }

  const template = await getTemplateById(templateId);

  const orderResult = await db.queryOne('SELECT MAX(order_index) as maxOrder FROM work_items WHERE date = ? AND context_id = ?', [date, template.context_id]);
  const nextOrder = (orderResult?.maxOrder ?? -1) + 1;

  const workItemId = await db.insert(
    'INSERT INTO work_items (date, title, description, emoji, status, time_box_minutes, order_index, context_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [date, template.title, template.description, template.emoji, template.status || 'Not Started', template.time_box_minutes, nextOrder, template.context_id]
  );

  for (const area of template.areas) {
    await db.insert('INSERT INTO work_area_associations (work_item_id, area_id) VALUES (?, ?)', [workItemId, area.id]);
  }
  for (const goal of template.goals) {
    await db.insert('INSERT INTO work_goal_associations (work_item_id, goal_id) VALUES (?, ?)', [workItemId, goal.id]);
  }
  for (const priority of template.priorities) {
    await db.insert('INSERT INTO work_priority_associations (work_item_id, priority_id) VALUES (?, ?)', [workItemId, priority.id]);
  }
  if (template.source_id) {
    await db.insert('INSERT INTO work_source_associations (work_item_id, source_id) VALUES (?, ?)', [workItemId, template.source_id]);
  }

  return workItemService.getWorkItemById(workItemId);
}