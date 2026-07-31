import express from 'express';
import * as ideaService from '../../services/ideaService.js';
import * as activeContextService from '../../services/activeContextService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Get all ideas
router.get('/', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const ideas = await ideaService.getAllIdeas(contextId);
    res.json({ success: true, data: ideas });
  } catch (error) {
    logger.error('Error fetching ideas:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single idea
router.get('/:id', async (req, res) => {
  try {
    const idea = await ideaService.getIdeaById(req.params.id);
    res.json({ success: true, data: idea });
  } catch (error) {
    logger.error('Error fetching idea:', error);
    res.status(error.statusCode || 404).json({ success: false, message: error.message });
  }
});

// Create idea
router.post('/', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const idea = await ideaService.createIdea(req.body, contextId);
    res.status(201).json({ success: true, message: 'Idea created', data: idea });
  } catch (error) {
    logger.error('Error creating idea:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Update idea
router.put('/:id', async (req, res) => {
  try {
    const idea = await ideaService.updateIdea(req.params.id, req.body);
    res.json({ success: true, message: 'Idea updated', data: idea });
  } catch (error) {
    logger.error('Error updating idea:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Delete idea
router.delete('/:id', async (req, res) => {
  try {
    await ideaService.deleteIdea(req.params.id);
    res.json({ success: true, message: 'Idea deleted' });
  } catch (error) {
    logger.error('Error deleting idea:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;
