import express from "express";
import goalsRouter from "./api/goals.js";
import prioritiesRouter from "./api/priorities.js";
import workRouter from "./api/work.js";
import sourcesRouter from "./api/sources.js";
import areasRouter from "./api/areas.js";
import yearsRouter from "./api/years.js";
import workItemTemplatesRouter from "./api/workItemTemplates.js";
import toDosRouter from "./api/toDos.js";
import toDoFoldersRouter from "./api/toDoFolders.js";
import tasksRouter from "./api/tasks.js";
import taskFoldersRouter from "./api/taskFolders.js";
import ticketsRouter from "./api/tickets.js";
import ideasRouter from "./api/ideas.js";
import ideaFoldersRouter from "./api/ideaFolders.js";
import contextsRouter from "./api/contexts.js";
import activeContextRouter from "./api/activeContext.js";
import usersRouter from "./api/users.js";
import contextDatabaseConfigRouter from "./api/contextDatabaseConfig.js";
import systemDatabaseRouter from "./api/systemDatabase.js";
import contextTabSettingsRouter from "./api/contextTabSettings.js";
import contextFoldersRouter from "./api/contextFolders.js";
import backupRouter from "./api/backup.js";
import setupRouter from "./api/setup.js";
import reportingRouter from "./api/reporting.js";
import dayHighlightsRouter from "./api/dayHighlights.js";
import ssoRouter from "./api/sso.js";
import contextSsoRouter from "./api/contextSso.js";
import dataSourceAuthRouter from "./api/dataSourceAuth.js";
import linksRouter from "./api/links.js";
import { readVersion } from "../utils/version.js";
import { checkDbHealth } from "../utils/dbHealth.js";

const router = express.Router();

// API Routes
router.use("/api/goals", goalsRouter);
router.use("/api/priorities", prioritiesRouter);
router.use("/api/work", workRouter);
router.use("/api/sources", sourcesRouter);
router.use("/api/areas", areasRouter);
router.use("/api/years", yearsRouter);
router.use("/api/work-item-templates", workItemTemplatesRouter);
router.use("/api/to-dos", toDosRouter);
router.use("/api/to-do-folders", toDoFoldersRouter);
router.use("/api/tasks", tasksRouter);
router.use("/api/task-folders", taskFoldersRouter);
router.use("/api/tickets", ticketsRouter);
router.use("/api/ideas", ideasRouter);
router.use("/api/idea-folders", ideaFoldersRouter);
router.use("/api/contexts", contextsRouter);
router.use("/api/active-context", activeContextRouter);
router.use("/api/users", usersRouter);
router.use("/api/context-database-config", contextDatabaseConfigRouter);
router.use("/api/system-database", systemDatabaseRouter);
router.use("/api/context-tab-settings", contextTabSettingsRouter);
router.use("/api/context-folders", contextFoldersRouter);
router.use("/api/backup", backupRouter);
router.use("/api/setup", setupRouter);
router.use("/api/reporting", reportingRouter);
router.use("/api/day-highlights", dayHighlightsRouter);
router.use("/api/sso", ssoRouter);
router.use("/api", contextSsoRouter);
router.use("/api", dataSourceAuthRouter);
router.use("/api", linksRouter);

// First-run bootstrap page: gets the app pointed at a working database and
// schema before contexts (or anything else) can exist. Redirects itself back
// to / once both are in place, so it's never shown once set up.
router.get("/setup", async (req, res) => {
  const health = await checkDbHealth(true);
  if (health.connected && health.schemaExists) {
    return res.redirect("/");
  }
  res.render("pages/setup", { title: "MyWork Setup", health });
});

// Dashboard route
router.get("/", (req, res) => {
  const currentYear = new Date().getFullYear();
  const tab = req.query.tab || "dailies";
  const version = readVersion();

  res.render("pages/dashboard", {
    title: "MyWork Dashboard",
    currentYear,
    activeTab: tab,
    version,
    dbHealth: res.locals.dbHealth,
  });
});

// Redirect /dashboard to /
router.get("/dashboard", (req, res) => {
  res.redirect("/?tab=" + (req.query.tab || "dailies"));
});

// Settings page
router.get("/settings", (req, res) => {
  const currentYear = new Date().getFullYear();
  const tab = req.query.tab || "contexts";
  const version = readVersion();

  res.render("pages/settings", {
    title: "MyWork Settings",
    currentYear,
    activeTab: tab,
    version,
    dbHealth: res.locals.dbHealth,
  });
});

export default router;
