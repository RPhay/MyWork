import express from 'express';

const router = express.Router();

// Dashboard route
router.get('/', (req, res) => {
  const currentYear = new Date().getFullYear();
  const tab = req.query.tab || 'dailies';

  res.render('pages/dashboard', {
    title: 'MyWork Dashboard',
    currentYear,
    activeTab: tab,
  });
});

// Redirect /dashboard to /
router.get('/dashboard', (req, res) => {
  res.redirect('/?tab=' + (req.query.tab || 'dailies'));
});

export default router;
