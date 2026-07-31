import express from "express";
import * as contextFolderService from "../../services/contextFolderService.js";
import logger from "../../utils/logger.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const folders = await contextFolderService.getAllFolders();
    res.json({ success: true, data: folders });
  } catch (error) {
    logger.error("Error fetching context folders:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const folder = await contextFolderService.createFolder(req.body);
    res
      .status(201)
      .json({ success: true, message: "Folder created", data: folder });
  } catch (error) {
    logger.error("Error creating context folder:", error);
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const folder = await contextFolderService.updateFolder(
      req.params.id,
      req.body,
    );
    res.json({ success: true, message: "Folder updated", data: folder });
  } catch (error) {
    logger.error("Error updating context folder:", error);
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await contextFolderService.deleteFolder(req.params.id);
    res.json({ success: true, message: "Folder deleted" });
  } catch (error) {
    logger.error("Error deleting context folder:", error);
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
});

export default router;
