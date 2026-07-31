import express from 'express';
import goalsRouter from './api/goals.js';
import prioritiesRouter from './api/priorities.js';
import workRouter from './api/work.js';
import sourcesRouter from './api/sources.js';
import areasRouter from './api/areas.js';
import yearsRouter from './api/years.js';
import workItemTemplatesRouter from './api/workItemTemplates.js';
import toDosRouter from './api/toDos.js';
import toDoFoldersRouter from './api/toDoFolders.js';
import ideasRouter from './api/ideas.js';
import ideaFoldersRouter from './api/ideaFolders.js';
import contextsRouter from './api/contexts.js';
import activeContextRouter from './api/activeContext.js';
import databaseConfigRouter from './api/databaseConfig.js';
import backupRouter from './api/backup.js';
import { readVersion } from '../utils/version.js';

const router = express.Router();

// API Routes
router.use('/api/goals', goalsRouter);
router.use('/api/priorities', prioritiesRouter);
router.use('/api/work', workRouter);
router.use('/api/sources', sourcesRouter);
router.use('/api/areas', areasRouter);
router.use('/api/years', yearsRouter);
router.use('/api/work-item-templates', workItemTemplatesRouter);
router.use('/api/to-dos', toDosRouter);
router.use('/api/to-do-folders', toDoFoldersRouter);
router.use('/api/ideas', ideasRouter);
router.use('/api/idea-folders', ideaFoldersRouter);
router.use('/api/contexts', contextsRouter);
router.use('/api/active-context', activeContextRouter);
router.use('/api/database-config', databaseConfigRouter);
router.use('/api/backup', backupRouter);

// Dashboard route
router.get('/', (req, res) => {
  const currentYear = new Date().getFullYear();
  const tab = req.query.tab || 'dailies';
  const version = readVersion();

  res.render('pages/dashboard', {
    title: 'MyWork Dashboard',
    currentYear,
    activeTab: tab,
    version,
  });
});

// Redirect /dashboard to /
router.get('/dashboard', (req, res) => {
  res.redirect('/?tab=' + (req.query.tab || 'dailies'));
});

// Settings page
router.get('/settings', (req, res) => {
  const currentYear = new Date().getFullYear();
  const tab = req.query.tab || 'data-sources';
  const version = readVersion();

  res.render('pages/settings', {
    title: 'MyWork Settings',
    currentYear,
    activeTab: tab,
    version,
  });
});

export default router;
