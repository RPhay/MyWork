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
router.post('/:contextId/test', async (req, res) => {
  try {
    const result = await contextDatabaseConfigService.testDbConnection(req.params.contextId, req.body);
    res.json(result);
  } catch (error) {
    logger.error('Error testing context database connection:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Create the MyWork schema on the target database
router.post('/:contextId/create-schema', async (req, res) => {
  try {
    const result = await contextDatabaseConfigService.createDbSchema(req.params.contextId, req.body);
    res.json(result);
  } catch (error) {
    logger.error('Error creating context database schema:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;
