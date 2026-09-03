import express from "express";
import {
  launchPipWindows,
  launchStickyWindow,
  closeAllPipWindows,
} from "../../services/pipWindowService.js";
import logger from "../../utils/logger.js";

const router = express.Router();

// POST /api/pip-window { monitors: [{monitor, x, y}, ...] } - float each
// listed monitor in its OWN independent frameless always-on-top window,
// positioned over its navbar zone. See pipWindowService.js.
router.post("/", (req, res) => {
  Promise.resolve()
    .then(() => launchPipWindows(req.body?.monitors))
    .then((data) => res.json({ success: true, data }))
    .catch((error) => {
      logger.error("Pip window error:", error);
      res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message });
    });
});

// POST /api/pip-window/sticky { id, type, field, x, y } - float ONE field of
// ONE entity in its own always-on-top window. Same wrapper binary as the
// monitors, a different CLI mode - see pipWindowService.js#launchStickyWindow
// and main.rs's `sticky` branch.
router.post("/sticky", (req, res) => {
  const { id, type, field, x, y } = req.body || {};
  Promise.resolve()
    .then(() => launchStickyWindow(
      Number(id), type, field,
      x == null ? null : Number(x), y == null ? null : Number(y),
    ))
    .then((data) => res.json({ success: true, data }))
    .catch((error) => {
      logger.error("Sticky window error:", error);
      res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message });
    });
});

// POST /api/pip-window/close-all - close every floating window, including
// ones a server restart forgot about. What the pop-out's own menu calls.
router.post("/close-all", (req, res) => {
  try {
    res.json({ success: true, data: closeAllPipWindows() });
  } catch (error) {
    logger.error("Pip window close-all error:", error);
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
});

export default router;
