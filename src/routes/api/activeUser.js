// The profile picker's endpoints.
//
// Switching user is not just a stored id - it has to move the app to one of
// that user's contexts, because the active context is what the live database
// connection points at. Doing that here rather than inside activeUserService
// keeps activeUserService from importing activeContextService, which imports
// it back.
import express from 'express';
import * as activeUserService from '../../services/activeUserService.js';
import * as activeContextService from '../../services/activeContextService.js';
import * as contextService from '../../services/contextService.js';
import * as userService from '../../services/userService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

/**
 * Who is using the app, plus everything the picker needs to render itself:
 * the full list to choose from, and the current user's contexts.
 *
 * One call rather than three, because this runs on every page load - the
 * navbar cannot draw without it.
 */
router.get('/', async (req, res) => {
  try {
    const user = await activeUserService.getActiveUser();
    const users = await userService.getAllUsers();
    const contexts = user ? await contextService.getContextsForUser(user.id) : [];

    res.json({
      success: true,
      data: {
        user,
        users,
        contexts,
        // The two states the UI has to handle separately: nobody chosen yet
        // (show the picker), and chosen but with nothing to open (offer to
        // create a first context).
        needsUser: !user,
        needsContext: Boolean(user) && contexts.length === 0,
      },
    });
  } catch (error) {
    logger.error('Error reading the active user:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

/**
 * Choose a user, and open one of their contexts.
 *
 * A user with no contexts is a legitimate state, not an error - a freshly
 * created profile owns nothing. The switch succeeds and reports `needsContext`
 * so the UI can offer to create one, rather than refusing to switch and
 * stranding the person on somebody else's data.
 */
router.put('/', async (req, res) => {
  try {
    const user = await activeUserService.setActiveUserId(req.body.userId);
    const contexts = await contextService.getContextsForUser(user.id);

    let activeContext = null;
    if (contexts.length > 0) {
      // Reuses whatever is already active if it belongs to them, otherwise
      // takes their first - the same rule getActiveContextId applies.
      activeContext = await activeContextService.setActiveContextId(contexts[0].id);
    }

    res.json({
      success: true,
      message: `Switched to ${user.name}`,
      data: { user, contexts, activeContext, needsContext: contexts.length === 0 },
    });
  } catch (error) {
    logger.error('Error switching user:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;
