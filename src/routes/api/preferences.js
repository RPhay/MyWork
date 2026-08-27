import express from "express";
import * as appPreferencesService from "../../services/appPreferencesService.js";
import logger from "../../utils/logger.js";

const router = express.Router();

// The current choice plus the one list it is chosen from. Both together
// because the picker is useless without the list, and two round trips to
// render one select is two chances to disagree.
router.get("/", async (req, res) => {
  try {
    const { startupView } = appPreferencesService.getPreferences();
    const startupChoices = await appPreferencesService.getStartupChoices();
    const resolved = await appPreferencesService.resolveStartup();
    res.json({
      success: true,
      data: { startupView, startupChoices, resolved },
    });
  } catch (error) {
    logger.error("Error reading preferences:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/startup-view", async (req, res) => {
  try {
    const data = await appPreferencesService.setStartupView(
      req.body.startupView ?? null,
    );
    res.json({ success: true, message: "Startup view saved", data });
  } catch (error) {
    logger.error("Error saving startup view:", error);
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
});

export default router;
