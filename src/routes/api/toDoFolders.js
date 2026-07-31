import express from 'express';
import * as toDoFolderService from '../../services/toDoFolderService.js';
import * as activeContextService from '../../services/activeContextService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Get all folders
router.get('/', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const folders = await toDoFolderService.getAllFolders(contextId);
    res.json({ success: true, data: folders });
  } catch (error) {
    logger.error('Error fetching to-do folders:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single folder
router.get('/:id', async (req, res) => {
  try {
    const folder = await toDoFolderService.getFolderById(req.params.id);
    res.json({ success: true, data: folder });
  } catch (error) {
    logger.error('Error fetching to-do folder:', error);
    res.status(error.statusCode || 404).json({ success: false, message: error.message });
  }
});

// Create folder
router.post('/', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const folder = await toDoFolderService.createFolder(req.body, contextId);
    res.status(201).json({ success: true, message: 'Folder created', data: folder });
  } catch (error) {
    logger.error('Error creating to-do folder:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Update folder
router.put('/:id', async (req, res) => {
  try {
    const folder = await toDoFolderService.updateFolder(req.params.id, req.body);
    res.json({ success: true, message: 'Folder updated', data: folder });
  } catch (error) {
    logger.error('Error updating to-do folder:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Delete folder
router.delete('/:id', async (req, res) => {
  try {
    await toDoFolderService.deleteFolder(req.params.id);
    res.json({ success: true, message: 'Folder deleted' });
  } catch (error) {
    logger.error('Error deleting to-do folder:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;
