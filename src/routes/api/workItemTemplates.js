import express from 'express';
import * as templateService from '../../services/workItemTemplateService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Get all templates
router.get('/', async (req, res) => {
  try {
    const templates = await templateService.getAllTemplates();
    res.json({ success: true, data: templates });
  } catch (error) {
    logger.error('Error fetching templates:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Reorder templates (drag-and-drop reorder within the list)
router.patch('/reorder', async (req, res) => {
  try {
    await templateService.reorderTemplates(req.body.orderedIds);
    res.json({ success: true, message: 'Templates reordered' });
  } catch (error) {
    logger.error('Error reordering templates:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Get single template
router.get('/:id', async (req, res) => {
  try {
    const template = await templateService.getTemplateById(req.params.id);
    res.json({ success: true, data: template });
  } catch (error) {
    logger.error('Error fetching template:', error);
    res.status(error.statusCode || 404).json({ success: false, message: error.message });
  }
});

// Create template
router.post('/', async (req, res) => {
  try {
    const template = await templateService.createTemplate(req.body);
    res.status(201).json({ success: true, message: 'Template created', data: template });
  } catch (error) {
    logger.error('Error creating template:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Update template
router.put('/:id', async (req, res) => {
  try {
    const template = await templateService.updateTemplate(req.params.id, req.body);
    res.json({ success: true, message: 'Template updated', data: template });
  } catch (error) {
    logger.error('Error updating template:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Update just the status (used by single-click status cycling)
router.patch('/:id/status', async (req, res) => {
  try {
    const template = await templateService.updateTemplateStatus(req.params.id, req.body.status);
    res.json({ success: true, message: 'Status updated', data: template });
  } catch (error) {
    logger.error('Error updating template status:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Update just the emoji ("Oh!" column - clicking the cell opens a quick picker)
router.patch('/:id/emoji', async (req, res) => {
  try {
    const template = await templateService.updateTemplateEmoji(req.params.id, req.body.emoji);
    res.json({ success: true, message: 'Emoji updated', data: template });
  } catch (error) {
    logger.error('Error updating template emoji:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Update just the time box (clicking the cell cycles through freeform/15/30/45/60)
router.patch('/:id/timebox', async (req, res) => {
  try {
    const template = await templateService.updateTemplateTimeBox(req.params.id, req.body.time_box_minutes);
    res.json({ success: true, message: 'Time box updated', data: template });
  } catch (error) {
    logger.error('Error updating template time box:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Delete template
router.delete('/:id', async (req, res) => {
  try {
    await templateService.deleteTemplate(req.params.id);
    res.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    logger.error('Error deleting template:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Instantiate a template into an actual work item on a given date
router.post('/:id/instantiate', async (req, res) => {
  try {
    const workItem = await templateService.instantiateTemplate(req.params.id, req.body.date);
    res.status(201).json({ success: true, message: 'Work item created from template', data: workItem });
  } catch (error) {
    logger.error('Error instantiating template:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Link/unlink an area
router.post('/:id/areas/:areaId', async (req, res) => {
  try {
    const template = await templateService.addAreaAssociation(req.params.id, req.params.areaId);
    res.status(201).json({ success: true, message: 'Area linked', data: template });
  } catch (error) {
    logger.error('Error linking area:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.delete('/:id/areas/:areaId', async (req, res) => {
  try {
    await templateService.removeAreaAssociation(req.params.id, req.params.areaId);
    res.json({ success: true, message: 'Area unlinked' });
  } catch (error) {
    logger.error('Error unlinking area:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Link/unlink a goal
router.post('/:id/goals/:goalId', async (req, res) => {
  try {
    const template = await templateService.addGoalAssociation(req.params.id, req.params.goalId);
    res.status(201).json({ success: true, message: 'Goal linked', data: template });
  } catch (error) {
    logger.error('Error linking goal:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.delete('/:id/goals/:goalId', async (req, res) => {
  try {
    await templateService.removeGoalAssociation(req.params.id, req.params.goalId);
    res.json({ success: true, message: 'Goal unlinked' });
  } catch (error) {
    logger.error('Error unlinking goal:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Link/unlink a priority (project)
router.post('/:id/priorities/:priorityId', async (req, res) => {
  try {
    const template = await templateService.addPriorityAssociation(req.params.id, req.params.priorityId);
    res.status(201).json({ success: true, message: 'Project linked', data: template });
  } catch (error) {
    logger.error('Error linking project:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.delete('/:id/priorities/:priorityId', async (req, res) => {
  try {
    await templateService.removePriorityAssociation(req.params.id, req.params.priorityId);
    res.json({ success: true, message: 'Project unlinked' });
  } catch (error) {
    logger.error('Error unlinking project:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;