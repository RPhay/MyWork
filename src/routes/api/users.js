import express from 'express';
import * as userService from '../../services/userService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// List all users (for the context "Owner" picker)
router.get('/', async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.json({ success: true, data: users });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Find-or-create by name (used when typing a new owner name in the context picker)
router.post('/', async (req, res) => {
  try {
    const user = await userService.findOrCreateUser(req.body.name);
    res.status(201).json({ success: true, message: 'User ready', data: user });
  } catch (error) {
    logger.error('Error creating user:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Update a profile's name and/or email.
//
// The email is what single sign-on matches a signing-in Entra account
// against, so this endpoint is what makes SSO adopt an EXISTING profile
// rather than create a second one beside it.
router.put('/:id', async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = await userService.updateUser(Number(req.params.id), {
      name,
      email,
    });
    res.json({ success: true, message: 'User updated', data: user });
  } catch (error) {
    logger.error('Error updating user:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Remove a profile. Refuses while it still owns contexts - see deleteUser.
router.delete('/:id', async (req, res) => {
  try {
    await userService.deleteUser(Number(req.params.id));
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;
