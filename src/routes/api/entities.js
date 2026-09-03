import express from 'express';
import * as entityService from '../../services/entityService.js';
import * as entityRelationshipService from '../../services/entityRelationshipService.js';
import { getActiveContextId } from '../../services/activeContextService.js';
import logger from '../../utils/logger.js';
import { ValidationError } from '../../config/errors.js';

const router = express.Router();

// GET /api/entities/counts - item counts per type, for the tab bar's "(N)"
// badges. Must stay above /:typeSlug or Express would match "counts" as a
// type slug instead.
router.get('/counts', async (req, res) => {
  try {
    const counts = await entityService.getEntityCounts();
    res.json({ success: true, data: counts });
  } catch (error) {
    logger.error('Error fetching entity counts:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// GET /api/entities/:typeSlug - List all entities of a type
router.get('/:typeSlug', async (req, res) => {
  try {
    const entities = await entityService.getAllEntities(req.params.typeSlug);
    res.json({ success: true, data: entities });
  } catch (error) {
    logger.error('Error fetching entities:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// GET /api/entities/:typeSlug/contents - this type's rows PLUS anything nested
// inside them, whatever type that is. Ordinary types only ever contain their
// own kind, so this returns the same as the plain list; templates may contain
// any type, and their children have to come back too or the tree renders a
// parent with invisible children.
router.get('/:typeSlug/contents', async (req, res) => {
  try {
    const contextId = await getActiveContextId();
    const own = await entityService.getAllEntities(req.params.typeSlug, contextId);
    const nested = await entityService.getNestedEntitiesOfOtherTypes(req.params.typeSlug, contextId);
    res.json({ success: true, data: [...own, ...nested] });
  } catch (error) {
    logger.error('Error fetching entity contents:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// GET /api/entities/:typeSlug/relationships - All relationships of a kind
// between entities of this type (bulk, for tree rendering - avoids an N+1
// per-entity relationships fetch). Must stay above the /:typeSlug/:id route
// below, or Express would match "relationships" as the :id param instead.
router.get('/:typeSlug/relationships', async (req, res) => {
  try {
    const contextId = await getActiveContextId();
    const relationships = await entityRelationshipService.getRelationshipsForType(
      req.params.typeSlug,
      contextId,
      req.query.kind || 'hierarchy'
    );
    res.json({ success: true, data: relationships });
  } catch (error) {
    logger.error('Error fetching type relationships:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// GET /api/entities/:typeSlug/:id - Get a single entity
router.get('/:typeSlug/:id', async (req, res) => {
  try {
    const entity = await entityService.getEntityById(parseInt(req.params.id));
    res.json({ success: true, data: entity });
  } catch (error) {
    logger.error('Error fetching entity:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// POST /api/entities/:typeSlug - Create a new entity
router.post('/:typeSlug', async (req, res) => {
  try {
    const entity = await entityService.createEntity(req.params.typeSlug, req.body);
    res.status(201).json({ success: true, data: entity });
  } catch (error) {
    logger.error('Error creating entity:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// POST /api/entities/:typeSlug/:id/instantiate - turn a template into work on a
// day. A template is always instantiated as a full COPY: the work item gets an
// independent clone of each thing the template holds, so editing what lands on
// the day never reaches back into the template.
router.post('/:typeSlug/:id/instantiate', async (req, res) => {
  try {
    const { date } = req.body;
    if (!date) throw new ValidationError('date is required');
    const contextId = await getActiveContextId();
    const result = await entityService.instantiateTemplate(parseInt(req.params.id), date, contextId);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    logger.error('Error instantiating template:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// POST /api/entities/:typeSlug/:id/clone - deep copy of an entity and its
// subtree, linked back to the source with an instantiated_from edge. Backs
// "Copy" when a typed row is dropped onto Dailies or a template.
router.post('/:typeSlug/:id/clone', async (req, res) => {
  try {
    const contextId = await getActiveContextId();
    const copy = await entityService.cloneEntity(parseInt(req.params.id), contextId);
    res.status(201).json({ success: true, data: copy });
  } catch (error) {
    logger.error('Error cloning entity:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// PUT /api/entities/:typeSlug/:id/convert-type - Change which type the row
// IS, in place. Registered above the plain "/:typeSlug/:id" PUT below so the
// literal "convert-type" segment can never be swallowed as an :id.
router.put('/:typeSlug/:id/convert-type', async (req, res) => {
  try {
    const { newTypeSlug } = req.body;
    if (!newTypeSlug) throw new ValidationError('newTypeSlug is required');
    const entity = await entityService.convertEntityType(parseInt(req.params.id), newTypeSlug);
    res.json({ success: true, data: entity });
  } catch (error) {
    logger.error('Error converting entity type:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// PUT /api/entities/:typeSlug/:id - Update an entity
router.put('/:typeSlug/:id', async (req, res) => {
  try {
    const entity = await entityService.updateEntity(parseInt(req.params.id), req.body);
    res.json({ success: true, data: entity });
  } catch (error) {
    logger.error('Error updating entity:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// DELETE /api/entities/:typeSlug/:id - Delete an entity
router.delete('/:typeSlug/:id', async (req, res) => {
  try {
    const contextId = await getActiveContextId();
    // deleteEntity is the whole delete now, and the edges must SURVIVE it.
    // This used to call cascadeDeleteEntity first, which removed the
    // hierarchy edges - so the soft delete then found no children to stamp,
    // leaving them orphaned but visible, and a restore would have had no tree
    // left to rebuild. Reads filter deleted rows out instead.
    const result = await entityService.deleteEntity(parseInt(req.params.id), contextId);
    res.json({
      success: true,
      message: 'Entity deleted',
      data: { deletedIds: result.deletedIds, deletedBatch: result.deletedBatch },
    });
  } catch (error) {
    logger.error('Error deleting entity:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// PATCH /api/entities/:typeSlug/reorder - Reorder entities by order_index
router.patch('/:typeSlug/reorder', async (req, res) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) throw new Error('orderedIds must be an array');

    const contextId = await getActiveContextId();
    await entityService.reorderEntitiesBySiblings(orderedIds, contextId);
    res.json({ success: true, message: 'Entities reordered' });
  } catch (error) {
    logger.error('Error reordering entities:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// ===== Entity Relationship Routes =====

// GET /api/entities/:typeSlug/:id/relationships - Get all relationships for an entity
router.get('/:typeSlug/:id/relationships', async (req, res) => {
  try {
    const contextId = await getActiveContextId();
    const relationships = await entityRelationshipService.getEntityRelationships(
      parseInt(req.params.id),
      contextId,
      req.query.kind || null
    );
    res.json({ success: true, data: relationships });
  } catch (error) {
    logger.error('Error fetching entity relationships:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// GET /api/entities/:typeSlug/:id/relationships/children - Get children (hierarchy)
router.get('/:typeSlug/:id/relationships/children', async (req, res) => {
  try {
    const contextId = await getActiveContextId();
    const children = await entityRelationshipService.getEntityChildren(
      parseInt(req.params.id),
      contextId,
      req.query.kind || 'hierarchy'
    );
    res.json({ success: true, data: children });
  } catch (error) {
    logger.error('Error fetching entity children:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// GET /api/entities/:typeSlug/:id/relationships/parents - Get parents (hierarchy)
router.get('/:typeSlug/:id/relationships/parents', async (req, res) => {
  try {
    const contextId = await getActiveContextId();
    const parents = await entityRelationshipService.getEntityParents(
      parseInt(req.params.id),
      contextId,
      req.query.kind || 'hierarchy'
    );
    res.json({ success: true, data: parents });
  } catch (error) {
    logger.error('Error fetching entity parents:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// POST /api/entities/:typeSlug/:id/relationships - Add a relationship
router.post('/:typeSlug/:id/relationships', async (req, res) => {
  try {
    const { parentEntityId, childEntityId, relationshipKind } = req.body;
    const contextId = await getActiveContextId();

    const relationship = await entityRelationshipService.addRelationship(
      parentEntityId,
      childEntityId,
      relationshipKind,
      contextId,
      false
    );

    res.status(201).json({ success: true, data: relationship });
  } catch (error) {
    logger.error('Error adding entity relationship:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// DELETE /api/entities/:typeSlug/:id/relationships/:parentId/:childId - Remove a relationship
router.delete('/:typeSlug/:id/relationships/:parentId/:childId', async (req, res) => {
  try {
    const { kind } = req.query;
    if (!kind) throw new Error('kind query parameter is required');

    const contextId = await getActiveContextId();
    const removed = await entityRelationshipService.removeRelationship(
      parseInt(req.params.parentId),
      parseInt(req.params.childId),
      kind,
      contextId
    );

    res.json({ success: true, message: removed ? 'Relationship removed' : 'Relationship not found' });
  } catch (error) {
    logger.error('Error removing entity relationship:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// PATCH /api/entities/:typeSlug/:id/relationships/reorder - Reorder siblings
router.patch('/:typeSlug/:id/relationships/reorder', async (req, res) => {
  try {
    const { orderedChildIds, kind } = req.body;
    if (!Array.isArray(orderedChildIds)) throw new Error('orderedChildIds must be an array');
    if (!kind) throw new Error('kind is required');

    const contextId = await getActiveContextId();
    await entityRelationshipService.reorderSiblings(
      parseInt(req.params.id),
      orderedChildIds,
      contextId
    );

    res.json({ success: true, message: 'Siblings reordered' });
  } catch (error) {
    logger.error('Error reordering siblings:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;
