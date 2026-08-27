import { getActiveContextId } from './activeContextService.js';
import * as entityTypeService from './entityTypeService.js';
import * as entityService from './entityService.js';
import { ValidationError } from '../config/errors.js';
import { UNPINNABLE_TYPE_SLUGS } from '../config/constants.js';

/**
 * The focus bar: what you are actually working on right now, pinned to the top
 * of every page.
 *
 * The priorities board answers "what matters this week"; the focus bar answers
 * "what am I doing this hour".
 *
 * It used to refuse past three, on the argument that a list of everything you
 * are focused on is a list of nothing. That is a judgement about how someone
 * should work, and it is not the app's to make - the cap was removed, and the
 * bar wraps to as many rows as it needs.
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

// No cap. Kept exported and null so the API can keep reporting a limit, and
// any caller reading it sees "there isn't one" rather than a missing field.
export const MAX_FOCUS_ITEMS = null;

// Written by the engine, never rendered as an editable control. Kept in sync
// with INTERNAL_FIELD_KEYS in public/js/genericEntity.js.
export const FOCUS_FIELDS = ['focus_slot', 'focus_seconds', 'focus_started_at', 'focus_color', 'focus_monitor'];

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
      // Pinned before monitors existed, or the field is simply absent: monitor 1.
      monitor: Number(entity.fields?.focus_monitor ?? 1) || 1,
      color: entity.fields?.focus_color || null,
      running: !!entity.fields?.focus_started_at,
      startedAt: Number(entity.fields?.focus_started_at ?? 0) || null,
      seconds: elapsedSeconds(entity.fields),
      ...ragForItem(entity, type),
    });
  }

  return items.sort((a, b) => a.monitor - b.monitor || a.slot - b.slot);
}

// UNPINNABLE_TYPE_SLUGS lives in config/constants.js - entityTypeService needs
// the same list and this file already imports it, so declaring it here made a
// cycle.

/** Pin a record to a monitor (1 by default). Pin as many as you like; slots
 * are handed out in order, scoped to that monitor. */
export async function addFocus(entityId, contextId = null, monitor = 1) {
  if (!contextId) contextId = await getActiveContextId();

  const entity = await entityService.getEntityById(Number(entityId), contextId);
  const ofType = entity && await entityTypeService.getEntityType(entity.entity_type_id);
  if (ofType && UNPINNABLE_TYPE_SLUGS.has(ofType.slug)) {
    throw new ValidationError(`${ofType.label_singular || ofType.label} cannot be put on the focus bar`);
  }

  const target = Math.max(1, Number(monitor) || 1);
  const current = await getFocusItems(contextId);
  if (current.some(i => String(i.id) === String(entityId))) return current;

  const used = new Set(current.filter(i => i.monitor === target).map(i => i.slot));
  let slot = 1;
  while (used.has(slot)) slot++;

  await entityService.updateEntity(
    Number(entityId),
    { fields: { focus_slot: slot, focus_monitor: target } },
    contextId,
  );
  return getFocusItems(contextId);
}

/**
 * Set the order of items WITHIN one monitor. Slots are renumbered from 1 in
 * the order given, scoped to that monitor - every other monitor's slots are
 * untouched.
 */
export async function reorderFocus(monitor, orderedIds, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();
  const target = Math.max(1, Number(monitor) || 1);
  const current = await getFocusItems(contextId);
  const onMonitor = current.filter(i => i.monitor === target);
  const pinned = new Set(onMonitor.map(i => String(i.id)));

  // Ignore anything not actually on this monitor rather than moving it by accident.
  const ids = (orderedIds || []).map(String).filter(id => pinned.has(id));
  if (ids.length === 0) return current;

  // Anything the caller left out keeps its relative order, after the rest.
  const rest = onMonitor.filter(i => !ids.includes(String(i.id))).map(i => String(i.id));
  const finalOrder = [...ids, ...rest];

  for (const [i, id] of finalOrder.entries()) {
    await entityService.updateEntity(Number(id), { fields: { focus_slot: i + 1 } }, contextId);
  }
  return getFocusItems(contextId);
}

/**
 * Move a pinned item to a different monitor, appended after whatever is
 * already there. The caller (the drag handler) follows this with
 * reorderFocus on the target monitor to fix the exact drop position - the
 * same two-step technique used for a same-monitor reorder.
 */
export async function moveFocus(entityId, monitor, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();
  const target = Math.max(1, Number(monitor) || 1);
  const current = await getFocusItems(contextId);
  const onTarget = current.filter(i => i.monitor === target);
  const slot = onTarget.length ? Math.max(...onTarget.map(i => i.slot)) + 1 : 1;

  await entityService.updateEntity(
    Number(entityId),
    { fields: { focus_monitor: target, focus_slot: slot } },
    contextId,
  );
  return getFocusItems(contextId);
}

/**
 * Removing monitor `position` shifts every later monitor down by one to fill
 * the gap. Anything pinned to the removed monitor, and anything on a monitor
 * being renumbered, needs to follow: the removed monitor's own items land on
 * monitor 1, and everything past it drops by one to match its new number.
 * Returns how many items moved.
 */
export async function shiftMonitorsAfterRemoval(position, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();
  const pos = Math.max(1, Number(position) || 1);
  const current = await getFocusItems(contextId);

  // Ascending (monitor, slot) so items land in their prior relative order
  // within whichever monitor they end up sharing - moveFocus always appends.
  const affected = current
    .filter(i => i.monitor >= pos)
    .sort((a, b) => a.monitor - b.monitor || a.slot - b.slot);

  let moved = 0;
  for (const item of affected) {
    const newMonitor = item.monitor === pos ? 1 : item.monitor - 1;
    if (newMonitor === item.monitor) continue;   // pos is 1 and this was already there
    await moveFocus(item.id, newMonitor, contextId);
    moved++;
  }
  return moved;
}

/**
 * The chip's background. Stored on the record like every other focus field, so
 * it survives a reload and follows the record between devices. Null clears it.
 */
export async function setFocusColor(entityId, color, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();
  const clean = color && /^#[0-9a-f]{6}$/i.test(color) ? color : null;
  await entityService.updateEntity(Number(entityId), { fields: { focus_color: clean } }, contextId);
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
// Not limited to items pinned to the focus bar - the Worked Time field
// (focus_seconds/focus_started_at) is on every type regardless of pinning,
// and a row's own Worked Time cell can start/stop it the same way the pin
// bar's chip does. "Stop whatever else is running" therefore has to search
// every entity with a running clock, not just the pinned ones, or an
// unpinned item's clock could keep running alongside a newly-started one.
export async function toggleTimer(entityId, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();

  const entity = await entityService.getEntityById(Number(entityId), contextId);
  if (!entity) throw new ValidationError('Item not found');

  const wasRunning = !!entity.fields?.focus_started_at;

  if (wasRunning) {
    await entityService.updateEntity(Number(entityId), {
      fields: { focus_seconds: elapsedSeconds(entity.fields), focus_started_at: null },
    }, contextId);
    return getFocusItems(contextId);
  }

  for (const other of await entityService.getEntitiesByFieldKey('focus_started_at', contextId)) {
    if (String(other.id) === String(entityId)) continue;
    await entityService.updateEntity(other.id, {
      fields: { focus_seconds: elapsedSeconds(other.fields), focus_started_at: null },
    }, contextId);
  }

  await entityService.updateEntity(Number(entityId), {
    fields: { focus_started_at: Date.now() },
  }, contextId);

  return getFocusItems(contextId);
}
