import express from 'express';
import * as toDoService from '../../services/toDoService.js';
import * as activeContextService from '../../services/activeContextService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Get all to-dos
router.get('/', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const toDos = await toDoService.getAllToDos(contextId);
    res.json({ success: true, data: toDos });
  } catch (error) {
    logger.error('Error fetching to-dos:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single to-do
router.get('/:id', async (req, res) => {
  try {
    const toDo = await toDoService.getToDoById(req.params.id);
    res.json({ success: true, data: toDo });
  } catch (error) {
    logger.error('Error fetching to-do:', error);
    res.status(error.statusCode || 404).json({ success: false, message: error.message });
  }
});

// Create to-do
router.post('/', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const toDo = await toDoService.createToDo(req.body, contextId);
    res.status(201).json({ success: true, message: 'To do created', data: toDo });
  } catch (error) {
    logger.error('Error creating to-do:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Update to-do
router.put('/:id', async (req, res) => {
  try {
    const toDo = await toDoService.updateToDo(req.params.id, req.body);
    res.json({ success: true, message: 'To do updated', data: toDo });
  } catch (error) {
    logger.error('Error updating to-do:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Delete to-do
router.delete('/:id', async (req, res) => {
  try {
    await toDoService.deleteToDo(req.params.id);
    res.json({ success: true, message: 'To do deleted' });
  } catch (error) {
    logger.error('Error deleting to-do:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;