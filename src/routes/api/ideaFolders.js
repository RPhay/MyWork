import express from 'express';
import * as ideaFolderService from '../../services/ideaFolderService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Get all folders
router.get('/', async (req, res) => {
  try {
    const folders = await ideaFolderService.getAllFolders();
    res.json({ success: true, data: folders });
  } catch (error) {
    logger.error('Error fetching idea folders:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single folder
router.get('/:id', async (req, res) => {
  try {
    const folder = await ideaFolderService.getFolderById(req.params.id);
    res.json({ success: true, data: folder });
  } catch (error) {
    logger.error('Error fetching idea folder:', error);
    res.status(error.statusCode || 404).json({ success: false, message: error.message });
  }
});

// Create folder
router.post('/', async (req, res) => {
  try {
    const folder = await ideaFolderService.createFolder(req.body);
    res.status(201).json({ success: true, message: 'Folder created', data: folder });
  } catch (error) {
    logger.error('Error creating idea folder:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Update folder
router.put('/:id', async (req, res) => {
  try {
    const folder = await ideaFolderService.updateFolder(req.params.id, req.body);
    res.json({ success: true, message: 'Folder updated', data: folder });
  } catch (error) {
    logger.error('Error updating idea folder:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Delete folder
router.delete('/:id', async (req, res) => {
  try {
    await ideaFolderService.deleteFolder(req.params.id);
    res.json({ success: true, message: 'Folder deleted' });
  } catch (error) {
    logger.error('Error deleting idea folder:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;
