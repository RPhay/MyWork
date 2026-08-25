import express from 'express';
import * as entityTypeService from '../../services/entityTypeService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// ===== Entity Type Definition Routes =====

// GET /api/entity-types - List all active entity types
router.get('/', async (req, res) => {
  try {
    const types = await entityTypeService.getAllEntityTypes();
    res.json({ success: true, data: types });
  } catch (error) {
    logger.error('Error fetching entity types:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// GET /api/entity-types/:idOrSlug - Get a single type with its fields and relationships
router.get('/:idOrSlug', async (req, res) => {
  try {
    const type = await entityTypeService.getEntityType(req.params.idOrSlug);
    const fields = await entityTypeService.getEntityTypeFields(type.id);
    const relationships = await entityTypeService.getEntityTypeRelationships(type.id);
    res.json({ success: true, data: { ...type, fields, relationships } });
  } catch (error) {
    logger.error('Error fetching entity type:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// POST /api/entity-types - Create a new type
router.post('/', async (req, res) => {
  try {
    const type = await entityTypeService.createEntityType(req.body);
    res.status(201).json({ success: true, data: type });
  } catch (error) {
    logger.error('Error creating entity type:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// PUT /api/entity-types/:id - Update a type
// PATCH /api/entity-types/reorder - persist tab order. Declared before the
// /:id routes so "reorder" is not captured as an id.
router.patch('/reorder', async (req, res) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) throw new Error('orderedIds must be an array');
    await entityTypeService.reorderEntityTypes(orderedIds.map(Number));
    res.json({ success: true, message: 'Entity types reordered' });
  } catch (error) {
    logger.error('Error reordering entity types:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const type = await entityTypeService.updateEntityType(parseInt(req.params.id), req.body);
    res.json({ success: true, data: type });
  } catch (error) {
    logger.error('Error updating entity type:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// DELETE /api/entity-types/:id - Soft-delete a type
router.delete('/:id', async (req, res) => {
  try {
    await entityTypeService.softDeleteEntityType(parseInt(req.params.id));
    res.json({ success: true, message: 'Entity type deleted' });
  } catch (error) {
    logger.error('Error deleting entity type:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// POST /api/entity-types/revert-all - restore every type that has defaults.
// Declared BEFORE /:id/revert: Express matches in order, and "revert-all" would
// otherwise be read as an :id and parse to NaN.
router.post('/revert-all', async (req, res) => {
  try {
    const result = await entityTypeService.revertAllTypes();
    const parts = [`Restored ${result.reverted.length} type${result.reverted.length === 1 ? '' : 's'}`];
    if (result.skipped.length) parts.push(`skipped ${result.skipped.length} without defaults`);
    if (result.failed.length) parts.push(`${result.failed.length} failed`);
    res.json({ success: result.failed.length === 0, data: result, message: parts.join(', ') });
  } catch (error) {
    logger.error('Error reverting all entity types:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// POST /api/entity-types/:id/revert - restore a type to its captured defaults
router.post('/:id/revert', async (req, res) => {
  try {
    const type = await entityTypeService.revertSystemType(parseInt(req.params.id));
    const { restored = [], created = [], extra = [] } = type.revert || {};

    // Say what actually happened rather than "done". Restoring 9 fields and
    // adding 2 is a different event from restoring 9 and finding 3 the defaults
    // do not know about, and the second one needs the user's attention.
    const parts = [`Restored ${restored.length} field${restored.length === 1 ? '' : 's'}`];
    if (created.length) parts.push(`re-created ${created.length}`);
    if (extra.length) parts.push(`left ${extra.length} not in defaults alone (${extra.join(', ')})`);

    res.json({ success: true, data: type, message: parts.join(', ') });
  } catch (error) {
    logger.error('Error reverting entity type:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// ===== Entity Type Field Routes =====

// GET /api/entity-types/:typeId/fields - List fields for a type
router.get('/:typeId/fields', async (req, res) => {
  try {
    const fields = await entityTypeService.getEntityTypeFields(parseInt(req.params.typeId));
    res.json({ success: true, data: fields });
  } catch (error) {
    logger.error('Error fetching entity type fields:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// POST /api/entity-types/:typeId/fields - Add a field to a type
router.post('/:typeId/fields', async (req, res) => {
  try {
    const field = await entityTypeService.createEntityTypeField(parseInt(req.params.typeId), req.body);
    res.status(201).json({ success: true, data: field });
  } catch (error) {
    logger.error('Error creating entity type field:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// PUT /api/entity-types/fields/:fieldId - Update a field
router.put('/fields/:fieldId', async (req, res) => {
  try {
    const field = await entityTypeService.updateEntityTypeField(parseInt(req.params.fieldId), req.body);
    res.json({ success: true, data: field });
  } catch (error) {
    logger.error('Error updating entity type field:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// DELETE /api/entity-types/fields/:fieldId - Delete a field
router.delete('/fields/:fieldId', async (req, res) => {
  try {
    await entityTypeService.deleteEntityTypeField(parseInt(req.params.fieldId));
    res.json({ success: true, message: 'Field deleted' });
  } catch (error) {
    logger.error('Error deleting entity type field:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// ===== Entity Type Relationship Routes =====

// POST /api/entity-types/relationships - Create a relationship rule
router.post('/relationships', async (req, res) => {
  try {
    const rule = await entityTypeService.createEntityTypeRelationship(req.body);
    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    logger.error('Error creating entity type relationship:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// DELETE /api/entity-types/relationships/:id - Delete a relationship rule
router.delete('/relationships/:id', async (req, res) => {
  try {
    await entityTypeService.deleteEntityTypeRelationship(parseInt(req.params.id));
    res.json({ success: true, message: 'Relationship rule deleted' });
  } catch (error) {
    logger.error('Error deleting entity type relationship:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;
