import express from 'express';
import goalsRouter from './api/goals.js';
import prioritiesRouter from './api/priorities.js';
import workRouter from './api/work.js';
import sourcesRouter from './api/sources.js';
import { readVersion } from '../utils/version.js';

const router = express.Router();

// API Routes
router.use('/api/goals', goalsRouter);
router.use('/api/priorities', prioritiesRouter);
router.use('/api/work', workRouter);
router.use('/api/sources', sourcesRouter);

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

export default router;
