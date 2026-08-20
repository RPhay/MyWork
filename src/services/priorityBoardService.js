import { getActiveContextId } from './activeContextService.js';
import * as entityTypeService from './entityTypeService.js';
import * as entityService from './entityService.js';
import { ValidationError, NotFoundError } from '../config/errors.js';

/**
 * The priorities board: a set of columns holding rows of ANY type.
 *
 * Two decisions shape everything here.
 *
 * **A row on the board is the record itself, never a copy.** Membership is a
 * field on the record (`board_bay`), so what the board shows is the original,
 * its title and fields still owned by its own page. Dragging something here is
 * always a reference - edit it on its own page and the board reflects that
 * immediately, because there is only ever one row.
 *
 * **A bay is board-local placement, NOT the record's status.** This looks like
 * a status board and the temptation is to make a bay move write the status, but
 * the types do not share a status vocabulary: Ideas run Raw/Developing/Ready,
 * and Categories and Templates have no status field at all. Dropping an Idea
 * into "In Progress" would write a value its own type rejects, and a Category
 * could not be placed anywhere. So placement lives in `board_bay` and the
 * record's own status is left alone - which is also what "you cannot edit the
 * dropped items, only reorder them and change which column they are in" asks
 * for, read literally.
 *
 * Ordering is `board_order` rather than `entities.order_index` for the same
 * reason: order_index is the row's position on its OWN page, and reusing it
 * would mean arranging the board silently rearranged Ideas and Todos elsewhere.
 */

export const BOARD_BAYS = ['Not Started', 'In Progress', 'Complete'];

/**
 * Every row currently on the board, whatever its type, in board order.
 *
 * Each item carries its type's slug and label so the board can show what a row
 * IS - on a mixed board "Renew the certificate" means something different as a
 * Ticket than as an Idea.
 */
export async function getBoardItems(contextId = null) {
  if (!contextId) contextId = await getActiveContextId();

  // One indexed lookup for the rows that are actually on the board, rather than
  // loading every entity of every type and filtering in JavaScript.
  const rows = await entityService.getEntitiesByFieldKey('board_bay', contextId);
  if (rows.length === 0) return [];

  // Status field keys are per type, so the types are fetched once and indexed -
  // not re-fetched per row.
  const types = new Map(
    (await entityTypeService.getAllEntityTypes('editable')).map(t => [t.slug, t])
  );

  const items = [];
  for (const entity of rows) {
    const type = types.get(entity.type_slug);
    if (!type || type.slug === 'template') continue;

    const bay = entity.fields?.board_bay;
    if (!bay) continue;

    const statusField = (type.fields || []).find(f => f.field_type === 'status');

    items.push({
      id: entity.id,
      title: entity.title,
      typeSlug: type.slug,
      typeLabel: type.label,
      icon: type.icon,
      bay: BOARD_BAYS.includes(bay) ? bay : BOARD_BAYS[0],
      // The record's own status, shown as information. It is deliberately not
      // what the bay means, so a row can sit in "In Progress" while its type
      // calls its own state "Developing".
      status: statusField ? (entity.fields?.[statusField.field_key] || '') : '',
      priority: entity.fields?.priority || '',
      boardOrder: Number(entity.fields?.board_order ?? 0),
    });
  }

  return items.sort((a, b) => a.boardOrder - b.boardOrder || a.id - b.id);
}

async function assertBoardable(entityId, contextId) {
  const entity = await entityService.getEntityById(entityId, contextId);
  if (!entity) throw new NotFoundError('Item not found');

  const types = await entityTypeService.getAllEntityTypes('editable');
  const type = types.find(t => t.id === entity.entity_type_id);
  if (!type) throw new ValidationError('That item\'s type cannot go on the board');
  if (type.slug === 'template') {
    throw new ValidationError('Templates are patterns, not work - they cannot go on the board');
  }
  return { entity, type };
}

/**
 * Put a row on the board, or move one already there into another bay.
 *
 * Idempotent: dropping the same row into the same bay twice is a no-op rather
 * than a duplicate, because membership is a field on one record and there is
 * nothing to duplicate.
 */
export async function placeOnBoard(entityId, bay, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();
  if (!BOARD_BAYS.includes(bay)) throw new ValidationError(`Unknown board column: ${bay}`);

  await assertBoardable(entityId, contextId);
  await entityService.updateEntity(Number(entityId), { fields: { board_bay: bay } }, contextId);

  return getBoardItems(contextId);
}

/** Take a row off the board. The record itself is untouched. */
export async function removeFromBoard(entityId, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();

  await assertBoardable(entityId, contextId);
  // null deletes the field row, and an absent board_bay is what "not on the
  // board" means - so this really does remove it rather than blanking it.
  await entityService.updateEntity(Number(entityId), { fields: { board_bay: null } }, contextId);

  return getBoardItems(contextId);
}

/**
 * Re-rank the board. `orderedIds` is the full board, every bay, in the order it
 * should read; `movedId` + `bay` additionally place the row that was dragged.
 *
 * The whole board is renumbered rather than just the affected bay, because
 * board_order is one ranking across every column - which is what keeps a row's
 * position stable when it is dragged from one bay to another.
 */
export async function reorderBoard(orderedIds, movedId = null, bay = null, contextId = null) {
  if (!contextId) contextId = await getActiveContextId();
  if (!Array.isArray(orderedIds)) throw new ValidationError('orderedIds must be an array');

  if (movedId != null && bay != null) {
    await placeOnBoard(movedId, bay, contextId);
  }

  for (let i = 0; i < orderedIds.length; i++) {
    await entityService.updateEntity(Number(orderedIds[i]), { fields: { board_order: i } }, contextId);
  }

  return getBoardItems(contextId);
}
