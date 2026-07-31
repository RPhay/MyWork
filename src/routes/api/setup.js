import express from "express";
import * as setupService from "../../services/setupService.js";
import { checkDbHealth } from "../../utils/dbHealth.js";
import logger from "../../utils/logger.js";

const router = express.Router();

router.get("/health", async (req, res) => {
  const health = await checkDbHealth(true);
  res.json({ success: true, data: health });
});

router.post("/test", async (req, res) => {
  try {
    const result = await setupService.testConnection(req.body);
    res.json(result);
  } catch (error) {
    logger.error("Error testing setup connection:", error);
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
});

router.post("/connect", async (req, res) => {
  try {
    const result =
      req.body.dbType === "mssql"
        ? await setupService.testMssqlConnection(req.body)
        : await setupService.connectAndActivate(req.body);
    res.json(result);
  } catch (error) {
    logger.error("Error activating setup connection:", error);
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
});

router.post("/create-schema", async (req, res) => {
  try {
    const result =
      req.body.dbType === "mssql"
        ? await setupService.createMssqlSchemaForSetup(req.body)
        : await setupService.createSchema(req.body);
    res.json(result);
  } catch (error) {
    logger.error("Error creating schema during setup:", error);
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
});

export default router;
