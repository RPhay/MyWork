import express from 'express';
import * as priorityBoardService from '../../services/priorityBoardService.js';
import * as activeContextService from '../../services/activeContextService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// The board holds rows of any type, so it does not live under /api/entities/:slug
// (there is no single slug) nor under /api/priorities (that is the Projects
// table, which is only one of the types that can appear here).

router.get('/', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    res.json({
      success: true,
      data: await priorityBoardService.getBoardItems(contextId),
      bays: priorityBoardService.BOARD_BAYS,
    });
  } catch (error) {
    logger.error('Error loading the priorities board:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Drop a row onto the board, or move one between columns. Both are the same
// write - placement is a single field - so they are the same endpoint.
router.post('/items', async (req, res) => {
  try {
    const { entityId, bay } = req.body;
    const contextId = await activeContextService.getActiveContextId();
    const data = await priorityBoardService.placeOnBoard(entityId, bay, contextId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error placing an item on the board:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.delete('/items/:entityId', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const data = await priorityBoardService.removeFromBoard(req.params.entityId, contextId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error removing an item from the board:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.patch('/reorder', async (req, res) => {
  try {
    const { orderedIds, movedId, bay } = req.body;
    const contextId = await activeContextService.getActiveContextId();
    const data = await priorityBoardService.reorderBoard(orderedIds, movedId, bay, contextId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error reordering the board:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;
