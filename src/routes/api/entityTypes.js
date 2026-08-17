import express from 'express';
import * as entityTypeService from '../../services/entityTypeService.js';
import * as entityService from '../../services/entityService.js';
import * as entityRelationshipService from '../../services/entityRelationshipService.js';
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
