import express from 'express';
import * as contextSyncService from '../../services/contextSyncService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// GET /api/context-sync/compare?source=1&target=2&records=true
// What differs between two contexts, type by type. Read-only: it opens both
// databases, reads, and writes nothing.
router.get('/compare', async (req, res) => {
  try {
    const { source, target, records } = req.query;
    const diff = await contextSyncService.compareContexts(source, target, {
      includeRecords: records === 'true' || records === '1',
    });
    res.json({ success: true, data: diff });
  } catch (error) {
    logger.error('Error comparing contexts:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// POST /api/context-sync/apply
// { source, target, typeSlugs: [...], includeRecords: bool, dryRun: bool }
//
// Additive only - it creates and updates, and has no delete path at all, so a
// type or field or record that exists only on the target survives untouched.
router.post('/apply', async (req, res) => {
  try {
    const { source, target, typeSlugs, includeRecords, dryRun } = req.body || {};
    const result = await contextSyncService.applySync(source, target, {
      typeSlugs,
      includeRecords: Boolean(includeRecords),
      dryRun: Boolean(dryRun),
    });
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error applying context sync:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;
