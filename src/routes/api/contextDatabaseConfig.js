import express from 'express';
import * as contextDatabaseConfigService from '../../services/contextDatabaseConfigService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Get a context's DB config (masked - password never included, only hasPassword)
router.get('/:contextId', async (req, res) => {
  try {
    const config = await contextDatabaseConfigService.getDbConfig(req.params.contextId);
    res.json({ success: true, data: config });
  } catch (error) {
    logger.error('Error fetching context database config:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Save a context's DB config. Blank password keeps the existing one.
router.put('/:contextId', async (req, res) => {
  try {
    const config = await contextDatabaseConfigService.saveDbConfig(req.params.contextId, req.body);
    res.json({ success: true, message: 'Database config saved', data: config });
  } catch (error) {
    logger.error('Error saving context database config:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Test connectivity without necessarily having saved the profile first
router.post('/:contextId/test/:type', async (req, res) => {
  try {
    const result = await contextDatabaseConfigService.testDbConnection(req.params.contextId, req.params.type, req.body);
    res.json(result);
  } catch (error) {
    logger.error('Error testing context database connection:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Create the MyWork schema on the target database
router.post('/:contextId/create-schema/:type', async (req, res) => {
  try {
    const result = await contextDatabaseConfigService.createDbSchema(req.params.contextId, req.params.type, req.body);
    res.json(result);
  } catch (error) {
    logger.error('Error creating context database schema:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Activate a database connection (test and make it active)
router.post('/:contextId/activate', async (req, res) => {
  try {
    const { dbType, mysql, mssql } = req.body;
    const config = dbType === 'mysql' ? mysql : mssql;

    // First test the connection
    const testResult = await contextDatabaseConfigService.testDbConnection(req.params.contextId, dbType, config);
    if (!testResult.success) {
      return res.status(400).json({ success: false, message: `Connection test failed: ${testResult.message}` });
    }

    // Save the configuration
    await contextDatabaseConfigService.saveContextDatabaseConfig(req.params.contextId, { mysql, mssql, dbType });

    // Activate it by switching the pool
    await contextDatabaseConfigService.setActiveDbType(req.params.contextId, dbType);

    res.json({ success: true, message: `Database connection activated (${dbType})` });
  } catch (error) {
    logger.error('Error activating database connection:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;
