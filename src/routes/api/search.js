import express from 'express';
import * as searchService from '../../services/searchService.js';
import * as activeContextService from '../../services/activeContextService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const data = await searchService.search(req.query.q, contextId, {
      limit: Math.min(Number(req.query.limit) || 30, 100),
      typeSlug: req.query.type || null,
    });
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Search error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;
