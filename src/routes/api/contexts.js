import express from 'express';
import * as contextService from '../../services/contextService.js';
import * as backupService from '../../services/backupService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Get all contexts
router.get('/', async (req, res) => {
  try {
    const contexts = await contextService.getAllContexts();
    res.json({ success: true, data: contexts });
  } catch (error) {
    logger.error('Error fetching contexts:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Reorder contexts (drag-and-drop reorder within the list)
router.patch('/reorder', async (req, res) => {
  try {
    const contexts = await contextService.reorderContexts(req.body.orderedIds);
    res.json({ success: true, message: 'Contexts reordered', data: contexts });
  } catch (error) {
    logger.error('Error reordering contexts:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Get single context
router.get('/:id', async (req, res) => {
  try {
    const context = await contextService.getContextById(req.params.id);
    res.json({ success: true, data: context });
  } catch (error) {
    logger.error('Error fetching context:', error);
    res.status(error.statusCode || 404).json({ success: false, message: error.message });
  }
});

// Create context
router.post('/', async (req, res) => {
  try {
    const context = await contextService.createContext(req.body);
    res.status(201).json({ success: true, message: 'Context created', data: context });
  } catch (error) {
    logger.error('Error creating context:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Update context
router.put('/:id', async (req, res) => {
  try {
    const context = await contextService.updateContext(req.params.id, req.body);
    res.json({ success: true, message: 'Context updated', data: context });
  } catch (error) {
    logger.error('Error updating context:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Delete context
router.delete('/:id', async (req, res) => {
  try {
    await contextService.deleteContext(req.params.id);
    res.json({ success: true, message: 'Context deleted' });
  } catch (error) {
    logger.error('Error deleting context:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Update context database schema
router.post('/:id/schema/update', async (req, res) => {
  try {
    const result = await contextService.checkAndUpdateContextSchema(req.params.id);
    res.json({ success: true, message: 'Schema updated', data: result });
  } catch (error) {
    logger.error('Error updating context schema:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Create backup of context database
router.post('/:id/backup', async (req, res) => {
  try {
    const context = await contextService.getContextById(req.params.id);
    const zipBuffer = await backupService.createContextBackup(context.id, context.name);

    // Send zip file as download
    const fileName = `mywork-backup-${context.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().getTime()}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(zipBuffer);
  } catch (error) {
    logger.error('Error creating backup:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Copy system database settings to context
router.post('/:id/use-system-database', async (req, res) => {
  try {
    const contextDbConfigService = await import('../../services/contextDatabaseConfigService.js');
    const systemDatabaseService = await import('../../services/systemDatabaseService.js');

    const systemConfig = await systemDatabaseService.getSystemDbConfigForCopy();

    await contextDbConfigService.saveDbConfig(req.params.id, {
      dbType: systemConfig.dbType,
      config: {
        host: systemConfig.host,
        port: systemConfig.port,
        database: systemConfig.database,
        user: systemConfig.user,
        password: systemConfig.password,
      },
    });

    const updated = await contextDbConfigService.getDbConfig(req.params.id);
    res.json({ success: true, message: 'Context now uses system database settings', data: updated });
  } catch (error) {
    logger.error('Error copying system database settings:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;
