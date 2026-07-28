import express from 'express';
import * as goalService from '../../services/goalService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Get goals by year
router.get('/year/:year', async (req, res) => {
  try {
    const year = parseInt(req.params.year, 10);
    const goals = await goalService.getGoalsByYear(year);
    res.json({ success: true, data: goals });
  } catch (error) {
    logger.error('Error fetching goals:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single goal
router.get('/:id', async (req, res) => {
  try {
    const goal = await goalService.getGoalById(req.params.id);
    res.json({ success: true, data: goal });
  } catch (error) {
    logger.error('Error fetching goal:', error);
    res.status(404).json({ success: false, message: error.message });
  }
});

// Create goal
router.post('/', async (req, res) => {
  try {
    const goal = await goalService.createGoal(req.body);
    res.status(201).json({ success: true, message: 'Goal created', data: goal });
  } catch (error) {
    logger.error('Error creating goal:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update goal
router.put('/:id', async (req, res) => {
  try {
    const goal = await goalService.updateGoal(req.params.id, req.body);
    res.json({ success: true, message: 'Goal updated', data: goal });
  } catch (error) {
    logger.error('Error updating goal:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete goal
router.delete('/:id', async (req, res) => {
  try {
    await goalService.deleteGoal(req.params.id);
    res.json({ success: true, message: 'Goal deleted' });
  } catch (error) {
    logger.error('Error deleting goal:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Get categories
router.get('/categories/all', async (req, res) => {
  try {
    const categories = await goalService.getCategories();
    res.json({ success: true, data: categories });
  } catch (error) {
    logger.error('Error fetching categories:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
