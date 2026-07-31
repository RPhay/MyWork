import express from 'express';
import * as databaseConfigService from '../../services/databaseConfigService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Get both connection profiles (masked - passwords never included, only hasPassword)
router.get('/', (req, res) => {
  try {
    const data = databaseConfigService.getConnectionConfig();
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error fetching database config:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Set which database type is active. For mysql this actually switches the
// app's live connection pool (see setActiveType); for mssql it's informational
// only, since the app has no MSSQL query path.
router.put('/active-type', async (req, res) => {
  try {
    const data = await databaseConfigService.setActiveType(req.body.type);
    res.json({ success: true, message: 'Active database type updated', data });
  } catch (error) {
    logger.error('Error setting active database type:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Save a connection profile (mysql or mssql). Blank password keeps the existing one.
router.put('/:type', (req, res) => {
  try {
    const data = databaseConfigService.saveConnectionProfile(req.params.type, req.body);
    res.json({ success: true, message: 'Connection profile saved', data });
  } catch (error) {
    logger.error('Error saving database connection profile:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Test connectivity without necessarily having saved the profile first
router.post('/:type/test', async (req, res) => {
  try {
    const result = await databaseConfigService.testConnection(req.params.type, req.body);
    res.json(result);
  } catch (error) {
    logger.error('Error testing database connection:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Create the MyWork schema on the target database (used after Test Connection
// reports schemaExists: false, once the user grants permission)
router.post('/:type/create-schema', async (req, res) => {
  try {
    const result = await databaseConfigService.createSchema(req.params.type, req.body);
    res.json(result);
  } catch (error) {
    logger.error('Error creating database schema:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;
