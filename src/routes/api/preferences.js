import express from "express";
import * as appPreferencesService from "../../services/appPreferencesService.js";
import logger from "../../utils/logger.js";

const router = express.Router();

// Current preferences, plus the choices the landing-tab picker may offer.
// Both in one response because the picker is useless without the list, and
// two round trips to render one select is two chances to disagree.
router.get("/", async (req, res) => {
  try {
    const prefs = appPreferencesService.getPreferences();
    const landingTabChoices =
      await appPreferencesService.getLandingTabChoices();
    const resolvedLandingTab =
      await appPreferencesService.resolveLandingTab();
    res.json({
      success: true,
      data: {
        ...prefs,
        landingTabChoices,
        resolvedLandingTab,
        landingRailChoices: appPreferencesService.LANDING_RAILS,
      },
    });
  } catch (error) {
    logger.error("Error reading preferences:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/landing-tab", async (req, res) => {
  try {
    const data = await appPreferencesService.setLandingTab(
      req.body.landingTab ?? null,
    );
    res.json({ success: true, message: "Landing tab saved", data });
  } catch (error) {
    logger.error("Error saving landing tab:", error);
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
});

router.put("/landing-rail", async (req, res) => {
  try {
    const data = appPreferencesService.setLandingRail(
      req.body.landingRail ?? null,
    );
    res.json({ success: true, message: "Startup rail saved", data });
  } catch (error) {
    logger.error("Error saving landing rail:", error);
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
});

export default router;
