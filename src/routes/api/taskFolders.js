import express from 'express';
import * as taskFolderService from '../../services/taskFolderService.js';
import * as activeContextService from '../../services/activeContextService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Get all folders
router.get('/', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const folders = await taskFolderService.getAllFolders(contextId);
    res.json({ success: true, data: folders });
  } catch (error) {
    logger.error('Error fetching task folders:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single folder
router.get('/:id', async (req, res) => {
  try {
    const folder = await taskFolderService.getFolderById(req.params.id);
    res.json({ success: true, data: folder });
  } catch (error) {
    logger.error('Error fetching task folder:', error);
    res.status(error.statusCode || 404).json({ success: false, message: error.message });
  }
});

// Create folder
router.post('/', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const folder = await taskFolderService.createFolder(req.body, contextId);
    res.status(201).json({ success: true, message: 'Folder created', data: folder });
  } catch (error) {
    logger.error('Error creating task folder:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Update folder
router.put('/:id', async (req, res) => {
  try {
    const folder = await taskFolderService.updateFolder(req.params.id, req.body);
    res.json({ success: true, message: 'Folder updated', data: folder });
  } catch (error) {
    logger.error('Error updating task folder:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Delete folder
router.delete('/:id', async (req, res) => {
  try {
    await taskFolderService.deleteFolder(req.params.id);
    res.json({ success: true, message: 'Folder deleted' });
  } catch (error) {
    logger.error('Error deleting task folder:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;
