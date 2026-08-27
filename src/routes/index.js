import express from "express";
import goalsRouter from "./api/goals.js";
import prioritiesRouter from "./api/priorities.js";
import dailiesRouter from "./api/dailies.js";
import sourcesRouter from "./api/sources.js";
import categoriesRouter from "./api/categories.js";
import yearsRouter from "./api/years.js";
import dailyTemplatesRouter from "./api/dailyTemplates.js";
import toDosRouter from "./api/toDos.js";
import tasksRouter from "./api/tasks.js";
import ticketsRouter from "./api/tickets.js";
import ideasRouter from "./api/ideas.js";
import ideaFoldersRouter from "./api/ideaFolders.js";
import contextsRouter from "./api/contexts.js";
import activeContextRouter from "./api/activeContext.js";
import activeUserRouter from "./api/activeUser.js";
import usersRouter from "./api/users.js";
import contextDatabaseConfigRouter from "./api/contextDatabaseConfig.js";
import systemDatabaseRouter from "./api/systemDatabase.js";
import contextFoldersRouter from "./api/contextFolders.js";
import backupRouter from "./api/backup.js";
import setupRouter from "./api/setup.js";
import reportingRouter from "./api/reporting.js";
import dayHighlightsRouter from "./api/dayHighlights.js";
import dataSourceAuthRouter from "./api/dataSourceAuth.js";
import entityTypesRouter from "./api/entityTypes.js";
import contextSyncRouter from "./api/contextSync.js";
import linkTitleRouter from "./api/linkTitle.js";
import entitiesRouter from "./api/entities.js";
import priorityBoardRouter from "./api/priorityBoard.js";
import focusRouter from "./api/focus.js";
import focusMonitorsRouter from "./api/focusMonitors.js";
import searchRouter from "./api/search.js";
import trashRouter from "./api/trash.js";
import statusDigestRouter from "./api/statusDigest.js";
import preferencesRouter from "./api/preferences.js";
import authRouter from "./auth.js";
import { readVersion } from "../utils/version.js";
import { checkDbHealth } from "../utils/dbHealth.js";
import * as entityTypeService from "../services/entityTypeService.js";

const router = express.Router();

// Middleware: Ensure active context has a database configured before allowing data operations
router.use("/api/", async (req, res, next) => {
  // Skip checks for: setup, configuration, user/context management, and read-only admin operations
  const skipPaths = [
    "/api/active-context",
    "/api/contexts",
    "/api/context-folders",
    "/api/users",
    "/api/active-user",   // How you CHANGE profile - must work with no context
    "/api/context-database-config",
    "/api/system-database",
    "/api/setup",
    "/api/backup",  // Read-only export
    "/api/entity-types",  // System types, not context-specific data
    "/api/context-sync",  // Names both contexts itself; opens their DBs directly
  ];

  // Use originalUrl to get the full path
  const fullPath = req.originalUrl.split('?')[0];  // Remove query string
  const isSkipped = skipPaths.some(path => fullPath.startsWith(path));
  if (isSkipped) {
    return next();
  }

  try {
    const activeContextService = await import("../services/activeContextService.js");
    const contextDatabaseConfigService = await import("../services/contextDatabaseConfigService.js");

    const activeContextId = await activeContextService.getActiveContextId();
    const liveConfig = await contextDatabaseConfigService.getLiveConnectionConfig(activeContextId);

    if (!liveConfig) {
      return res.status(400).json({
        success: false,
        message: `Context ${activeContextId} has no database configured. Configure a database in Settings > Contexts first.`,
      });
    }
  } catch (error) {
    // Don't block on errors - allow the request to proceed
    // This allows Settings page to load even if something is misconfigured
    console.warn("Warning checking context database config:", error.message);
  }

  next();
});

// API Routes
// Auth routes sit OUTSIDE the /api/ gate above and outside the login gate in
// app.js - a sign-in page you must already be signed in to reach is a locked
// door with the key behind it. They 404 by themselves when SSO_MODE resolves
// to off, so mounting them unconditionally is safe.
router.use("/auth", authRouter);

router.use("/api/preferences", preferencesRouter);
router.use("/api/goals", goalsRouter);
router.use("/api/priorities", prioritiesRouter);
router.use("/api/dailies", dailiesRouter);
router.use("/api/sources", sourcesRouter);
router.use("/api/categories", categoriesRouter);
router.use("/api/years", yearsRouter);
router.use("/api/daily-templates", dailyTemplatesRouter);
router.use("/api/to-dos", toDosRouter);
router.use("/api/tasks", tasksRouter);
router.use("/api/tickets", ticketsRouter);
router.use("/api/ideas", ideasRouter);
router.use("/api/idea-folders", ideaFoldersRouter);
router.use("/api/contexts", contextsRouter);
router.use("/api/active-context", activeContextRouter);
router.use("/api/active-user", activeUserRouter);
router.use("/api/users", usersRouter);
router.use("/api/context-database-config", contextDatabaseConfigRouter);
router.use("/api/system-database", systemDatabaseRouter);
router.use("/api/context-folders", contextFoldersRouter);
router.use("/api/backup", backupRouter);
router.use("/api/setup", setupRouter);
router.use("/api/reporting", reportingRouter);
router.use("/api/day-highlights", dayHighlightsRouter);
router.use("/api", dataSourceAuthRouter);
router.use("/api/entity-types", entityTypesRouter);
// Compares two contexts and ports type structure between them. Not
// context-specific: it names both contexts explicitly and opens their
// databases itself, so it must not go through the active-context gate.
router.use("/api/context-sync", contextSyncRouter);
// Resolves a dropped URL's page title. Not context-specific.
router.use("/api/link-title", linkTitleRouter);
router.use("/api/entities", entitiesRouter);
router.use("/api/priority-board", priorityBoardRouter);
router.use("/api/focus", focusRouter);
router.use("/api/focus-monitors", focusMonitorsRouter);
router.use("/api/search", searchRouter);
router.use("/api/trash", trashRouter);
router.use("/api/status-digest", statusDigestRouter);

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
router.get("/", async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    // Dailies is a rail, not a page, so it can never be the landing tab.
    // resolveLandingTab() returns the stored preference when it still names
    // a type that exists, and the first non-rail type otherwise - so this
    // cannot resolve to a slug with no pane, which is what the old hardcoded
    // fallbacks did.
    // ONE setting decides what the app opens on. resolveStartup() always
    // returns a real tab - a rail can never be `currentTab`, which is what
    // left the app showing a rail alone and looking like it failed to load -
    // plus, when a rail was chosen, which one and that it takes the screen.
    const { resolveStartup } = await import(
      "../services/appPreferencesService.js"
    );
    const startup = await resolveStartup();
    const tab = req.query.tab || startup.tab || "priority";
    const landingRail = startup.rail;
    const landingRailOnly = startup.railOnly;
    const version = readVersion();

    // A profile that owns no contexts has nothing to show here.
    //
    // Rendering the dashboard anyway does not degrade gracefully - it degrades
    // into a storm: every tab fires its own fetch, each one resolves the active
    // context, each one throws, and the page never finishes loading. That is
    // what a freshly created profile hit, and the symptom (a page that hangs)
    // says nothing about the cause (you own no contexts yet).
    //
    // Send them where the problem is fixable instead. Settings renders without
    // needing an active context, so this cannot bounce back and forth.
    const { getActiveUserId } = await import("../services/activeUserService.js");
    const { getContextsForUser } = await import("../services/contextService.js");
    const activeUserId = await getActiveUserId();
    if (activeUserId) {
      const owned = await getContextsForUser(activeUserId);
      if (owned.length === 0) {
        return res.redirect("/settings?tab=contexts&needsContext=1");
      }
    }

    // Fetch all active entity types for generic tab rendering
    const entityTypes = await entityTypeService.getAllEntityTypes();

    res.render("pages/dashboard", {
      title: "MyWork Dashboard",
      currentYear,
      activeTab: tab,
      landingRail,
      landingRailOnly,
      version,
      dbHealth: res.locals.dbHealth,
      entityTypes: entityTypes || [],
    });
  } catch (error) {
    console.error("Dashboard route error:", error);
    res.render("pages/dashboard", {
      title: "MyWork Dashboard",
      currentYear: new Date().getFullYear(),
      activeTab: req.query.tab || "priority",
      version: readVersion(),
      dbHealth: res.locals.dbHealth,
      entityTypes: [],
    });
  }
});

// Redirect /dashboard to /
router.get("/dashboard", (req, res) => {
  res.redirect("/?tab=" + (req.query.tab || "priority"));
});

// Settings page
router.get("/settings", (req, res) => {
  const currentYear = new Date().getFullYear();
  // Entity Types is the landing tab for Settings - it's the one that shapes
  // the rest of the app (which tabs exist, in what order, with which fields).
  const tab = req.query.tab || "entity-types";
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
