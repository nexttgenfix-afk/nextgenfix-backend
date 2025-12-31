const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { optionalAuth } = require('../middlewares/auth');
// Admin routes
const { verifyAdmin } = require('../middlewares/adminAuth');

// Public routes (no auth required)
router.get('/public', settingsController.getPublicSettings);
router.get('/business-hours', settingsController.getBusinessHours);
router.put('/business', verifyAdmin, settingsController.updateBusinessInfo);
router.get('/delivery-charges', settingsController.getDeliveryCharges);

// Admin routes (auth required)
router.get('/', verifyAdmin, settingsController.getAllSettings);
router.put('/business-hours', verifyAdmin, settingsController.updateBusinessHours);
router.put('/delivery', verifyAdmin, settingsController.updateDeliveryConfig);
router.put('/tiers', verifyAdmin, settingsController.updateTierConfig);
router.put('/referral', verifyAdmin, settingsController.updateReferralConfig);
router.put('/tax', verifyAdmin, settingsController.updateTaxConfig);
router.put('/scheduling', verifyAdmin, settingsController.updateSchedulingConfig);

module.exports = router;
