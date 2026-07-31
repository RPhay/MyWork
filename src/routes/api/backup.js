import express from 'express';
import * as backupService from '../../services/backupService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Export the full contents of the current database as a downloadable JSON file
router.get('/export', async (req, res) => {
  try {
    const data = await backupService.exportDatabase();
    const filename = `mywork-backup-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(data);
  } catch (error) {
    logger.error('Error exporting database:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Import a previously exported backup, replacing all current data
router.post('/import', async (req, res) => {
  try {
    const result = await backupService.importDatabase(req.body);
    res.json({ success: true, message: 'Database imported successfully', data: result });
  } catch (error) {
    logger.error('Error importing database:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;
