import { getActiveContextId } from './activeContextService.js';
import * as entityTypeService from './entityTypeService.js';
import * as entityService from './entityService.js';
import { ValidationError } from '../config/errors.js';

/**
 * The focus bar: the two or three things you are actually working on right now,
 * pinned to the top of every page.
 *
 * This is deliberately NOT another list. The priorities board answers "what
 * matters this week"; the focus bar answers "what am I doing this hour", and it
 * is capped at three because a list of everything you are focused on is a list
 * of nothing.
 *
 * Like the board, a pinned row is the record itself - the pin is a field on it,
 * so there is no copy to drift.
 *
 * Timing is stop-the-clock, not a log: one accumulated total per record plus,
 * while it is running, the moment it started. Elapsed time is derived on read
 * rather than ticked into storage, so a browser left open overnight, a reload,
 * or two tabs all agree - the running total is always `focus_seconds` plus the
 * time since `focus_started_at`, computed wherever it is asked for.
 */

export const MAX_FOCUS_ITEMS = 3;

// Written by the engine, never rendered as an editable control. Kept in sync
// with INTERNAL_FIELD_KEYS in public/js/genericEntity.js.
export const FOCUS_FIELDS = ['focus_slot', 'focus_seconds', 'focus_started_at'];

/**
 * A single record's RAG, as opposed to the portfolio-level RAG in
 * portfolioReportService. The question here is "is this one thing in trouble",
 * so it reads the record's own date and status rather than aggregating:
 *
 *   red   - past its date and not finished
 *   amber - started, or due within three days
 *   green - finished
 *   grey  - nothing recorded to judge it by
 */
export function ragForItem(entity, type) {
  const statusField = (type.fields || []).find(f => f.field_type === 'status');
  const dateField = (type.fields || []).find(f => f.field_type === 'date');

  const status = statusField ? (entity.fields?.[statusField.field_key] || '') : '';
  const due = dateField ? entity.fields?.[dateField.field_key] : null;

  const options = typeof statusField?.field_options === 'string'
    ? JSON.parse(statusField.field_options)
    : statusField?.field_options;
  const doneValues = new Set((options?.doneValues?.length ? options.doneValues : ['Complete', 'Done', 'Ready']).map(String));

  if (status && doneValues.has(status)) return { rag: 'green', why: status };

  if (due) {
    const dueDay = new Date(due);
    const today = new Date();
    const days = Math.floor((dueDay - today) / 86400000);
    if (days < 0) return { rag: 'red', why: `${Math.abs(days)}d overdue` };
    if (days <= 3) return { rag: 'amber', why: days === 0 ? 'due today' : `due in ${days}d` };
    return { rag: 'green', why: `due in ${days}d` };
  }

  if (status && /progress|doing|active|developing/i.test(status)) {
    return { rag: 'amber', why: status };
  }
  return { rag: 'grey', why: status || 'no status' };
}

/**
 * Seconds on the clock right now: banked time plus the run in progress.
 *
 * `focus_started_at` is epoch milliseconds, not an ISO string, and that is not
 * a style choice. setEntityFieldValue picks its storage column from the shape
 * of the VALUE rather than the field's declared type, so an ISO timestamp was
 * routed into value_date and MySQL rejected it outright. A number cannot be
 * misread that way.
 */
export function elapsedSeconds(fields) {
  const banked = Number(fields?.focus_seconds ?? 0) || 0;
  const startedAt = Number(fields?.focus_started_at ?? 0) || 0;
  if (!startedAt) return banked;
  return banked + Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

export async function getFocusItems(contextId = null) {
  if (!contextId) contextId = await getActiveContextId();

  const rows = await entityService.getEntitiesByFieldKey('focus_slot', contextId);
  if (rows.length === 0) return [];

  const types = new Map(
    (await entityTypeService.getAllEntityTypes('editable')).map(t => [t.slug, t])
  );

  const items = [];
  for (const entity of rows) {
    const type = types.get(entity.type_slug);
    if (!type) continue;

    items.push({
      id: entity.id,
      title: entity.title,
      typeSlug: type.slug,
      typeLabel: type.label,
      icon: type.icon,
      slot: Number(entity.fields?.focus_slot ?? 0),
      running: !!entity.fields?.focus_started_at,
      startedAt: Number(entity.fields?.focus_started_at ?? 0) || null,
      seconds: elapsedSeconds(entity.fields),
      ...ragForItem(entity, type),
    });
  }

  return items.sort((a, b) => a.slot - b.slot);
}

/**
 * Pin a record. Refuses past the cap rather than silently evicting something -
 * which of your three current tasks to drop is your call, not the app's.
 */
export async function addFocus(entityId, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();

  const current = await getFocusItems(contextId);
  if (current.some(i => String(i.id) === String(entityId))) return current;

  if (current.length >= MAX_FOCUS_ITEMS) {
    throw new ValidationError(
      `The focus bar holds ${MAX_FOCUS_ITEMS} things at a time. Remove one before adding another.`
    );
  }

  const used = new Set(current.map(i => i.slot));
  let slot = 1;
  while (used.has(slot)) slot++;

  await entityService.updateEntity(Number(entityId), { fields: { focus_slot: slot } }, contextId);
  return getFocusItems(contextId);
}

/** Unpin. Any running clock is banked first, so time is never silently lost. */
export async function removeFocus(entityId, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();

  const entity = await entityService.getEntityById(Number(entityId), contextId);
  const fields = { focus_slot: null };
  if (entity?.fields?.focus_started_at) {
    fields.focus_seconds = elapsedSeconds(entity.fields);
    fields.focus_started_at = null;
  }

  await entityService.updateEntity(Number(entityId), { fields }, contextId);
  return getFocusItems(contextId);
}

/**
 * Start or stop the clock. Starting one stops the others: you are working on
 * one thing at a time, and two clocks running at once would make the totals
 * mean nothing.
 */
export async function toggleTimer(entityId, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();

  const entity = await entityService.getEntityById(Number(entityId), contextId);
  if (!entity) throw new ValidationError('Item not found');
  if (!entity.fields?.focus_slot) throw new ValidationError('That item is not on the focus bar');

  const wasRunning = !!entity.fields?.focus_started_at;

  if (wasRunning) {
    await entityService.updateEntity(Number(entityId), {
      fields: { focus_seconds: elapsedSeconds(entity.fields), focus_started_at: null },
    }, contextId);
    return getFocusItems(contextId);
  }

  for (const item of await getFocusItems(contextId)) {
    if (!item.running || String(item.id) === String(entityId)) continue;
    const other = await entityService.getEntityById(item.id, contextId);
    await entityService.updateEntity(item.id, {
      fields: { focus_seconds: elapsedSeconds(other.fields), focus_started_at: null },
    }, contextId);
  }

  await entityService.updateEntity(Number(entityId), {
    fields: { focus_started_at: Date.now() },
  }, contextId);

  return getFocusItems(contextId);
}
