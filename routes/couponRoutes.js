const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const { requireGuestOrUser } = require('../middlewares/unifiedAuth');
const { validateCoupon } = require('../middlewares/validation');

// Public routes
router.get('/validate/:code', couponController.validateCoupon);

// Guest or User routes
router.get('/', requireGuestOrUser, couponController.getUserCoupons);

// Admin routes
const { verifyAdmin } = require('../middlewares/adminAuth');

router.get('/generate-code', verifyAdmin, couponController.generateCouponCode);
router.post('/', verifyAdmin, validateCoupon, couponController.createCoupon);
router.get('/admin/all', verifyAdmin, couponController.getAllCoupons);
router.put('/:id', verifyAdmin, couponController.updateCoupon);
router.delete('/:id', verifyAdmin, couponController.deleteCoupon);
router.put('/:id/toggle', verifyAdmin, couponController.toggleCouponStatus);
// Referral-specific admin endpoints
router.get('/admin/referrals', verifyAdmin, couponController.getReferralAudit);
router.post('/admin/refunds/:id', verifyAdmin, couponController.refundReferralCoupon);

module.exports = router;