import express from 'express';
import * as portfolioReportService from '../../services/portfolioReportService.js';
import * as reportExportService from '../../services/reportExportService.js';
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

// ===== Portfolio reporting =====
// Everything below reports across every entity type. What came before only ever
// read work_items, so it went blank on a quiet day and never mentioned the
// projects, categories, goals and ideas the app actually holds.

router.get('/portfolio', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const data = await portfolioReportService.getPortfolio(contextId, req.query);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error building portfolio report:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.get('/executive-summary', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const data = await portfolioReportService.getExecutiveSummary(contextId, req.query);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error building executive summary:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.get('/upcoming', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const data = await portfolioReportService.getUpcoming(contextId, { days: Number(req.query.days) || 14 });
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error building upcoming report:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.get('/needs-attention', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const data = await portfolioReportService.getNeedsAttention(contextId, {});
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error building attention report:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.get('/board', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const data = await portfolioReportService.getBoardItems(contextId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error loading board items:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// ===== Exports =====
// Downloads, so these are GETs: a browser can point straight at them.

router.get('/export/xlsx', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const buffer = await reportExportService.buildWorkbook(contextId, req.query);
    const name = `mywork-status-${req.query.startDate || 'all'}-to-${req.query.endDate || 'now'}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    logger.error('Error exporting workbook:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const buffer = await reportExportService.buildPdf(contextId, req.query);
    const name = `mywork-status-${req.query.startDate || 'all'}-to-${req.query.endDate || 'now'}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.send(buffer);
  } catch (error) {
    logger.error('Error exporting pdf:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// The draft is returned, never sent: the app holds no mail credentials, and
// sending on someone's behalf by surprise is not a thing to do.
router.get('/email-draft', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const data = await reportExportService.buildEmailDraft(contextId, req.query);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error building email draft:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;
