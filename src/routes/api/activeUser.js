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
import { resolveSsoState } from '../../services/ssoModeService.js';

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
    // With SSO in force, the picker is NOT free. Filtering or greying the
    // dropdown is not enough - this endpoint still accepts any id typed or
    // remembered from before, which would make the sign-in decorative: sign
    // in as one profile, then simply become another. Exactly the reasoning
    // behind setActiveContextId refusing a context you do not own.
    //
    // Only enforced when SSO actually resolved to enabled AND this session
    // signed in; with SSO_MODE=off there is no session identity to compare
    // against and the picker stays as free as it has always been.
    const ssoState = await resolveSsoState();
    const signedInUserId = req.session?.ssoUser?.userId ?? null;
    if (ssoState.enabled && signedInUserId !== null) {
      if (Number(req.body.userId) !== Number(signedInUserId)) {
        return res.status(403).json({
          success: false,
          message:
            'Signed in with single sign-on - sign out to use a different profile',
        });
      }
    }

    const user = await activeUserService.setActiveUserId(req.body.userId);
    const contexts = await contextService.getContextsForUser(user.id);

    let activeContext = null;
    if (contexts.length > 0) {
      // getActiveContextId applies exactly this rule already - the persisted
      // context id if it belongs to the (now-switched) active user, else
      // their first by order_index - so ask it rather than hardcoding
      // contexts[0] here and silently discarding a still-valid persisted one.
      const contextId = await activeContextService.getActiveContextId();
      activeContext = await activeContextService.setActiveContextId(contextId);
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
