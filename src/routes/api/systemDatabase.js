import express from 'express';
import * as systemDatabaseService from '../../services/systemDatabaseService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Get system database config
router.get('/', async (req, res) => {
  try {
    const config = await systemDatabaseService.getSystemDbConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    logger.error('Error fetching system database config:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Save system database config
router.put('/', async (req, res) => {
  try {
    const config = await systemDatabaseService.saveSystemDbConfig(req.body);
    res.json({ success: true, message: 'System database config saved', data: config });
  } catch (error) {
    logger.error('Error saving system database config:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Test system database connection
router.post('/test/:type', async (req, res) => {
  try {
    const result = await systemDatabaseService.testSystemDbConnection(req.params.type, req.body);
    res.json(result);
  } catch (error) {
    logger.error('Error testing system database connection:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Check system database schema for missing tables
router.get('/schema/check', async (req, res) => {
  try {
    const missingTables = await systemDatabaseService.checkSystemDbSchema();
    res.json({ success: true, data: { missingTables } });
  } catch (error) {
    logger.error('Error checking system database schema:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Update system database schema (reconcile missing tables/columns/indexes)
router.post('/schema/update', async (req, res) => {
  try {
    const result = await systemDatabaseService.updateSystemDbSchema();
    res.json({ success: true, message: 'Schema updated', data: result });
  } catch (error) {
    logger.error('Error updating system database schema:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Analyze and migrate system database and all context databases
router.post('/schema/analyze-and-migrate', async (req, res) => {
  try {
    const schemaMigrationService = await import('../../services/schemaMigrationService.js');
    const report = await schemaMigrationService.analyzeAndMigrateAll();
    res.json({ success: report.success, data: report, message: report.success ? 'Analysis and migration complete for all databases' : 'Analysis and migration encountered errors' });
  } catch (error) {
    logger.error('Error during unified schema analysis and migration:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Retired tables: what is still there, and dropping it.
//
// Two endpoints on purpose. The GET is what the confirmation is built from -
// the user is shown the table names and their row counts BEFORE agreeing to
// anything, which a schema run cannot offer because by the time it reports,
// the tables are already gone.
router.get('/retired-tables', async (req, res) => {
  try {
    const retiredTablesService = await import('../../services/retiredTablesService.js');
    const report = await retiredTablesService.inspectRetiredTables();
    res.json({ success: true, data: report });
  } catch (error) {
    logger.error('Error inspecting retired tables:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.post('/retired-tables/drop', async (req, res) => {
  try {
    const retiredTablesService = await import('../../services/retiredTablesService.js');
    const report = await retiredTablesService.dropRetiredTables();
    const n = report.dropped.length;
    res.json({
      success: report.failed.length === 0,
      data: report,
      message: n === 0 ? 'Nothing to drop' : `Dropped ${n} retired table${n === 1 ? '' : 's'}`,
    });
  } catch (error) {
    logger.error('Error dropping retired tables:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;
