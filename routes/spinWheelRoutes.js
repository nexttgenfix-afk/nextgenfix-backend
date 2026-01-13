const express = require('express');
const router = express.Router();
const spinWheelController = require('../controllers/spinWheelController');
const { verifyAdmin } = require('../middlewares/adminAuth');
const { requireGuestOrUser } = require('../middlewares/unifiedAuth');

// User Endpoints
router.get('/status', requireGuestOrUser, spinWheelController.getSpinStatus);
router.post('/spin', requireGuestOrUser, spinWheelController.spin);

// Admin Endpoints
router.get('/admin/config', verifyAdmin, spinWheelController.getConfig);
router.put('/admin/config', verifyAdmin, spinWheelController.updateConfig);
router.get('/admin/history', verifyAdmin, spinWheelController.getHistory);
router.get('/admin/analytics', verifyAdmin, spinWheelController.getAnalytics);
router.put('/admin/revoke/:id', verifyAdmin, spinWheelController.revokeCoupon);

module.exports = router;
