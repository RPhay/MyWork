import express from 'express';
import * as reportingService from '../../services/reportingService.js';
import * as activeContextService from '../../services/activeContextService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

router.get('/work-items', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const { startDate, endDate, status, priorityId, areaId } = req.query;
    const items = await reportingService.getWorkItemsReport(contextId, { startDate, endDate, status, priorityId, areaId });
    res.json({ success: true, data: items });
  } catch (error) {
    logger.error('Error fetching work items report:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.get('/goals', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const { year, status } = req.query;
    const goals = await reportingService.getGoalsReport(contextId, { year, status });
    res.json({ success: true, data: goals });
  } catch (error) {
    logger.error('Error fetching goals report:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.get('/by-project', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const { startDate, endDate } = req.query;
    const breakdown = await reportingService.getProjectBreakdown(contextId, { startDate, endDate });
    res.json({ success: true, data: breakdown });
  } catch (error) {
    logger.error('Error fetching project breakdown:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.get('/by-category', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const { startDate, endDate } = req.query;
    const breakdown = await reportingService.getCategoryBreakdown(contextId, { startDate, endDate });
    res.json({ success: true, data: breakdown });
  } catch (error) {
    logger.error('Error fetching category breakdown:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.get('/todos-ideas', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const { startDate, endDate } = req.query;
    const rows = await reportingService.getToDosIdeasReport(contextId, { startDate, endDate });
    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error('Error fetching to-dos/ideas report:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const { startDate, endDate } = req.query;
    const summary = await reportingService.getTimeSummary(contextId, { startDate, endDate });
    res.json({ success: true, data: summary });
  } catch (error) {
    logger.error('Error fetching time summary:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;
