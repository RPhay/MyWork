import express from 'express';
import * as areaService from '../../services/areaService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Get all areas
router.get('/', async (req, res) => {
  try {
    const areas = await areaService.getAllAreas();
    res.json({ success: true, data: areas });
  } catch (error) {
    logger.error('Error fetching areas:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Reorder siblings within the Categories tree (dropping between two categories
// under the same parent, rather than onto one which nests it instead)
router.patch('/reorder-siblings', async (req, res) => {
  try {
    const areas = await areaService.reorderAreasAmongSiblings(req.body.orderedIds);
    res.json({ success: true, message: 'Categories reordered', data: areas });
  } catch (error) {
    logger.error('Error reordering sibling categories:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Get single area
router.get('/:id', async (req, res) => {
  try {
    const area = await areaService.getAreaById(req.params.id);
    res.json({ success: true, data: area });
  } catch (error) {
    logger.error('Error fetching area:', error);
    res.status(404).json({ success: false, message: error.message });
  }
});

// Create area
router.post('/', async (req, res) => {
  try {
    const area = await areaService.createArea(req.body);
    res.status(201).json({ success: true, message: 'Area created', data: area });
  } catch (error) {
    logger.error('Error creating area:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Update area
router.put('/:id', async (req, res) => {
  try {
    const area = await areaService.updateArea(req.params.id, req.body);
    res.json({ success: true, message: 'Area updated', data: area });
  } catch (error) {
    logger.error('Error updating area:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Delete area
router.delete('/:id', async (req, res) => {
  try {
    await areaService.deleteArea(req.params.id);
    res.json({ success: true, message: 'Area deleted' });
  } catch (error) {
    logger.error('Error deleting area:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;