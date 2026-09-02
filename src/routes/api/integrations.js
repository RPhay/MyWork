import express from "express";
import * as entraDirectoryService from "../../services/entraDirectoryService.js";
import logger from "../../utils/logger.js";

const router = express.Router();

// App-level configuration, like /api/entity-types - not context-specific, so
// it sits in the skipPaths allowlist in routes/index.js and works with no
// active context.

router.get("/entra/status", async (req, res) => {
  try {
    const status = await entraDirectoryService.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    logger.error("Error getting Entra directory status:", error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.post("/entra/enabled", async (req, res) => {
  try {
    const status = await entraDirectoryService.setEnabled(Boolean(req.body?.enabled));
    res.json({ success: true, data: status });
  } catch (error) {
    logger.error("Error toggling Entra directory integration:", error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.post("/entra/sync", async (req, res) => {
  try {
    const result = await entraDirectoryService.syncNow();
    const status = await entraDirectoryService.getStatus();
    res.json({ success: true, data: { ...result, status } });
  } catch (error) {
    logger.error("Error syncing Entra directory:", error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.get("/entra/users", async (req, res) => {
  try {
    const users = await entraDirectoryService.getDirectoryUsers();
    res.json({ success: true, data: users });
  } catch (error) {
    logger.error("Error listing Entra directory users:", error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;
