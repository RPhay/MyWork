import express from 'express';
import linksService from '../../services/linksService.js';
import { ValidationError } from '../../config/errors.js';

const router = express.Router();

/**
 * GET /api/links/:type/:entityId
 * Get all links for an entity
 */
router.get('/links/:type/:entityId', async (req, res, next) => {
  try {
    const { type, entityId } = req.params;

    if (!['to-do', 'idea', 'priority'].includes(type)) {
      throw new ValidationError('Invalid link type');
    }

    const links = await linksService.getLinks(type, parseInt(entityId, 10));
    res.json({ success: true, data: links });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/links/:type/:entityId
 * Add a link to an entity
 */
router.post('/links/:type/:entityId', async (req, res, next) => {
  try {
    const { type, entityId } = req.params;
    const { url, title } = req.body;

    if (!['to-do', 'idea', 'priority'].includes(type)) {
      throw new ValidationError('Invalid link type');
    }

    if (!url || !url.trim()) {
      throw new ValidationError('URL is required');
    }

    const link = await linksService.addLink(
      type,
      parseInt(entityId, 10),
      url.trim(),
      title?.trim() || null
    );

    res.json({ success: true, data: link });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/links/:type/:linkId
 * Update a link
 */
router.put('/links/:type/:linkId', async (req, res, next) => {
  try {
    const { type, linkId } = req.params;
    const { url, title } = req.body;

    if (!['to-do', 'idea', 'priority'].includes(type)) {
      throw new ValidationError('Invalid link type');
    }

    if (!url || !url.trim()) {
      throw new ValidationError('URL is required');
    }

    await linksService.updateLink(
      type,
      parseInt(linkId, 10),
      url.trim(),
      title?.trim() || null
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/links/:type/:linkId
 * Delete a link
 */
router.delete('/links/:type/:linkId', async (req, res, next) => {
  try {
    const { type, linkId } = req.params;

    if (!['to-do', 'idea', 'priority'].includes(type)) {
      throw new ValidationError('Invalid link type');
    }

    await linksService.deleteLink(type, parseInt(linkId, 10));
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/links/:type/:entityId/reorder
 * Reorder links
 */
router.patch('/links/:type/:entityId/reorder', async (req, res, next) => {
  try {
    const { type, entityId } = req.params;
    const { linkIds } = req.body;

    if (!['to-do', 'idea', 'priority'].includes(type)) {
      throw new ValidationError('Invalid link type');
    }

    if (!Array.isArray(linkIds)) {
      throw new ValidationError('linkIds must be an array');
    }

    await linksService.reorderLinks(type, parseInt(entityId, 10), linkIds);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
