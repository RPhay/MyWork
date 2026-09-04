import express from 'express';
import * as entityService from '../../services/entityService.js';
import * as activeContextService from '../../services/activeContextService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Get all folders (in generic entity engine, folders are just ideas with children)
router.get('/', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const allIdeas = await entityService.getAllEntities('idea', contextId);
    // A folder is an idea carrying is_folder = 1 (see the Folders section of
    // UI_STANDARDS.md). This previously filtered on `parent_id`, a column
    // `entities` doesn't have, so it returned every idea as a "folder".
    const folders = allIdeas.filter(idea => idea.is_folder);
    res.json({ success: true, data: folders });
  } catch (error) {
    logger.error('Error fetching idea folders:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Get single folder
router.get('/:id', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const folder = await entityService.getEntityById(req.params.id, contextId);
    res.json({ success: true, data: folder });
  } catch (error) {
    logger.error('Error fetching idea folder:', error);
    res.status(error.statusCode || 404).json({ success: false, message: error.message });
  }
});

// Create folder (just create an idea with no parent)
router.post('/', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const folder = await entityService.createEntity('idea', req.body, contextId);
    res.status(201).json({ success: true, message: 'Folder created', data: folder });
  } catch (error) {
    logger.error('Error creating idea folder:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Update folder
router.put('/:id', async (req, res) => {
  try {
    const folder = await entityService.updateEntity(req.params.id, req.body);
    res.json({ success: true, message: 'Folder updated', data: folder });
  } catch (error) {
    logger.error('Error updating idea folder:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Delete folder
router.delete('/:id', async (req, res) => {
  try {
    await entityService.deleteEntity(req.params.id);
    res.json({ success: true, message: 'Folder deleted' });
  } catch (error) {
    logger.error('Error deleting idea folder:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;
