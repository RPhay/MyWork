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

export default router;
