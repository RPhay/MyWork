// Templates, as `template` ENTITIES.
//
// This used to read and write `work_item_templates` and three junction tables
// while the Templates RAIL rendered from `entities` - two stores for one idea.
// A template made in the rail was invisible to Dailies' picker, and one made
// from the picker never appeared in the rail.
//
// It is a shim over entityService now, keeping the shape /api/daily-templates
// has always returned so Dailies' picker, child editor, drag-drop and emoji
// endpoint keep working unchanged. That is the same move routes/api/toDos.js
// made, and for the same reason: the callers are fine, it was the store that
// was wrong.
//
// The legacy row's own columns live as FIELDS on the entity now
// (description, emoji, status, start_time; time_box replaces
// time_box_minutes), and the three association junctions become the template's
// HIERARCHY CHILDREN. Both are flattened back to the old top-level shape on the
// way out - see toLegacyShape.
//
// Hierarchy rather than `association`, for two reasons. The type rules already
// permit template -> category/goal/priority as hierarchy and not as
// association, and more importantly it is what the legacy junctions MEANT: the
// rows attached to a template are what that template puts on a day. Making them
// children means entityService.instantiateTemplate - which clones a template's
// hierarchy children - stamps them out with no special case.
import { NotFoundError, ValidationError } from '../config/errors.js';
// Templates carry a time box exactly as Dailies does, so they convert the
// same way - a `timebox` field stores a ladder rung ('30m'), while the flat
// shape this shim returns speaks minutes. Writing minutes straight into the
// field, as this did, put a value there that no editor could display.
import { timeBoxToMinutes, minutesToTimeBox } from './dailyService.js';
import { buildPathMap } from '../utils/hierarchyPath.js';
import * as entityService from './entityService.js';
import * as entityRelationshipService from './entityRelationshipService.js';
import * as entityTypeService from './entityTypeService.js';
import { getActiveContextId } from './activeContextService.js';

const TYPE = 'template';

/** What the template holds, grouped by type - what `categories`/`goals`/`priorities` were. */
async function associationsFor(templateId, contextId) {
  const children = await entityRelationshipService.getEntityChildren(templateId, contextId, 'hierarchy');
  const out = { category: [], goal: [], priority: [] };

  for (const child of children) {
    const id = child.child_entity_id ?? child.id;
    let row;
    try {
      row = await entityService.getEntityById(id, contextId);
    } catch {
      continue;                                   // the other end is gone
    }
    const type = await entityTypeService.getEntityType(row.entity_type_id);
    if (out[type.slug]) out[type.slug].push(row);
  }
  return out;
}

/**
 * The shape /api/daily-templates has always returned: the legacy row's columns
 * at the top level, not tucked inside `fields`. Five frontend files read it
 * that way and none of them needs to know the store changed.
 */
async function toLegacyShape(entity, contextId, paths) {
  const f = entity.fields || {};
  const assoc = await associationsFor(entity.id, contextId);
  const name = (e) => ({ id: e.id, name: e.title, path: paths.category.get(e.id) || e.title });

  return {
    ...entity,
    description: f.description ?? null,
    emoji: f.emoji ?? null,
    status: f.status ?? 'Not Started',
    start_time: f.start_time ?? null,
    time_box_minutes: timeBoxToMinutes(f.time_box),
    source_id: null,                              // sources never became entities
    categories: assoc.category.map(name),
    goals: assoc.goal.map((e) => ({ id: e.id, name: e.title })),
    priorities: assoc.priority.map((e) => ({
      id: e.id, title: e.title, path: paths.priority.get(e.id) || e.title,
    })),
  };
}

async function pathLookups() {
  const [categories, priorities] = await Promise.all([
    entityService.getEntityPathLookup('category'),
    entityService.getEntityPathLookup('priority'),
  ]);
  return { category: buildPathMap(categories), priority: buildPathMap(priorities, 'title') };
}

export async function getAllTemplates(contextId) {
  if (!contextId) contextId = await getActiveContextId();
  const entities = await entityService.getAllEntities(TYPE, contextId);
  const paths = await pathLookups();
  return Promise.all(entities.map((e) => toLegacyShape(e, contextId, paths)));
}

export async function getTemplateById(id, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();
  const entity = await entityService.getEntityById(id, contextId).catch(() => null);
  if (!entity) throw new NotFoundError('Template not found');
  return toLegacyShape(entity, contextId, await pathLookups());
}

/**
 * Replace one KIND of association wholesale, the way setAssociations did.
 * Scoped to `kind` ('category' | 'goal' | 'priority'): a template's children
 * also include the other two kinds, and a caller setting one kind's ids must
 * not touch the others.
 */
async function setAssociations(templateId, kind, ids, contextId) {
  const existing = await associationsFor(templateId, contextId);
  const wanted = new Set((ids || []).map(Number));
  const have = existing[kind] || [];

  for (const row of have) {
    if (wanted.has(row.id)) {
      wanted.delete(row.id);                      // already linked
    } else {
      await entityRelationshipService.removeRelationship(templateId, row.id, 'hierarchy', contextId);
    }
  }
  for (const id of wanted) {
    await entityRelationshipService.addRelationship(templateId, Number(id), 'hierarchy', contextId);
  }
}

export async function createTemplate(data, contextId) {
  const { title, description, emoji, status, area_ids, goal_ids, priority_ids, time_box_minutes, start_time } = data;
  if (!title) throw new ValidationError('Template title is required');
  if (!contextId) contextId = await getActiveContextId();

  const entity = await entityService.createEntity(TYPE, {
    title,
    fields: {
      description: description ?? null,
      emoji: emoji ?? null,
      status: status || 'Not Started',
      start_time: start_time || null,
      time_box: minutesToTimeBox(time_box_minutes),
    },
  }, contextId);

  for (const [kind, ids] of [['category', area_ids], ['goal', goal_ids], ['priority', priority_ids]]) {
    if (Array.isArray(ids) && ids.length) await setAssociations(entity.id, kind, ids, contextId);
  }
  return getTemplateById(entity.id, contextId);
}

export async function updateTemplate(id, data, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();
  if (data.title !== undefined && !data.title) {
    throw new ValidationError('Template title is required');
  }

  const fields = {};
  if (data.description !== undefined) fields.description = data.description ?? null;
  if (data.emoji !== undefined) fields.emoji = data.emoji || null;
  if (data.status !== undefined) fields.status = data.status || 'Not Started';
  if (data.start_time !== undefined) fields.start_time = data.start_time || null;
  if (data.time_box_minutes !== undefined) fields.time_box = minutesToTimeBox(data.time_box_minutes);

  const patch = {};
  if (data.title !== undefined) patch.title = data.title;
  if (Object.keys(fields).length) patch.fields = fields;
  if (Object.keys(patch).length) await entityService.updateEntity(id, patch, contextId);

  for (const [kind, ids] of [['category', data.area_ids], ['goal', data.goal_ids], ['priority', data.priority_ids]]) {
    if (ids !== undefined) await setAssociations(id, kind, Array.isArray(ids) ? ids : [], contextId);
  }
  return getTemplateById(id, contextId);
}

export async function deleteTemplate(id, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();
  await entityService.deleteEntity(id, contextId);
  return true;
}

const VALID_STATUSES = ['Not Started', 'In Progress', 'Complete'];

export async function updateTemplateStatus(id, status, contextId = null) {
  if (!VALID_STATUSES.includes(status)) throw new ValidationError('Invalid status value');
  return updateTemplate(id, { status }, contextId);
}

export async function reorderTemplates(orderedIds, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();
  await entityService.reorderEntitiesBySiblings(orderedIds.map(Number), contextId);
}

export async function updateTemplateEmoji(id, emoji, contextId = null) {
  return updateTemplate(id, { emoji }, contextId);
}

export async function updateTemplateTimeBox(id, timeBoxMinutes, contextId = null) {
  return updateTemplate(id, { time_box_minutes: timeBoxMinutes }, contextId);
}

async function link(templateId, otherId, contextId) {
  if (!contextId) contextId = await getActiveContextId();
  await entityRelationshipService.addRelationship(templateId, Number(otherId), 'hierarchy', contextId);
  return getTemplateById(templateId, contextId);
}

async function unlink(templateId, otherId, contextId) {
  if (!contextId) contextId = await getActiveContextId();
  await entityRelationshipService.removeRelationship(templateId, Number(otherId), 'hierarchy', contextId);
}

export const addCategoryAssociation = (t, id, c) => link(t, id, c);
export const removeCategoryAssociation = (t, id, c) => unlink(t, id, c);
export const addGoalAssociation = (t, id, c) => link(t, id, c);
export const removeGoalAssociation = (t, id, c) => unlink(t, id, c);
export const addPriorityAssociation = (t, id, c) => link(t, id, c);
export const removePriorityAssociation = (t, id, c) => unlink(t, id, c);

/**
 * Stamp the template out onto a day.
 *
 * entityService.instantiateTemplate already does this entity-natively: it makes
 * the daily and CLONES the template's hierarchy children onto it. Since the
 * legacy associations are those children now, everything a template holds is
 * stamped out with no special case.
 */
export async function instantiateTemplate(templateId, date, contextId = null) {
  if (!date) throw new ValidationError('A date is required to create a work item from a template');
  if (!contextId) contextId = await getActiveContextId();

  // No special case for the template's categories/goals/priorities: they ARE
  // its hierarchy children now, and instantiateTemplate clones those onto the
  // day already. The legacy version had to copy them separately because a
  // legacy template had no children of its own.
  const result = await entityService.instantiateTemplate(templateId, date, contextId);
  return entityService.getEntityById(result.dailyId, contextId);
}
