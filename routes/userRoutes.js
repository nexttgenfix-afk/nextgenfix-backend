const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireGuestOrUser, requireAuth } = require('../middlewares/unifiedAuth');
const { validateRegistration, validateProfileUpdate } = require('../middlewares/validation');

// Guest or User routes (locations - new naming)
router.post('/locations', requireGuestOrUser, userController.addLocation);
router.get('/locations', requireGuestOrUser, userController.getLocations);
router.get('/locations/default', requireGuestOrUser, userController.getDefaultLocation);
router.put('/locations/:locationId/default', requireGuestOrUser, userController.setDefaultLocation);
router.put('/locations/:locationId', requireGuestOrUser, userController.editLocation);
router.delete('/locations/:locationId', requireGuestOrUser, userController.deleteLocation);

// Backward compatibility (addresses - old naming)
router.post('/addresses', requireGuestOrUser, userController.addAddress);
router.get('/addresses', requireGuestOrUser, userController.getAddresses);
router.get('/addresses/default', requireGuestOrUser, userController.getDefaultAddress);
router.put('/addresses/:addressId/default', requireGuestOrUser, userController.setDefaultAddress);
router.put('/addresses/:addressId', requireGuestOrUser, userController.editAddress);
router.delete('/addresses/:addressId', requireGuestOrUser, userController.deleteAddress);

// Guest/User question endpoints for hunger level and mood
router.post('/questions', requireGuestOrUser, userController.saveQuestion);
router.get('/questions', requireGuestOrUser, userController.getQuestions);

// Auth-only routes (profile, tier, referrals)
router.get('/me', requireAuth, userController.getProfile);
router.put('/me', requireAuth, validateProfileUpdate, userController.updateProfile);
router.put('/me/preferences', requireAuth, userController.updatePreferences);
router.get('/me/tier', requireAuth, userController.getTierInfo);
router.get('/me/referral-code', requireAuth, userController.getReferralCode);
router.post('/refer', requireAuth, userController.applyReferralCode);
router.get('/me/referrals', requireAuth, userController.getReferrals);
router.put('/me/notifications', requireAuth, userController.updateNotificationPreferences);

// Admin routes (require admin auth)
const { verifyAdmin } = require('../middlewares/adminAuth');

// Get all users (admin only)
router.get('/', verifyAdmin, userController.getAllUsers);

// Get user by ID (admin only)
router.get('/:id', verifyAdmin, userController.getUserById);

// Update user (admin only)
router.put('/:id', verifyAdmin, userController.updateUser);

// Delete user (admin only)
router.delete('/:id', verifyAdmin, userController.deleteUser);

module.exports = router;