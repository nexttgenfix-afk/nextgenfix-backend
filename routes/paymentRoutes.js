const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { verifyToken } = require('../middlewares/auth');

// Payment initiation
router.post('/initiate', verifyToken, paymentController.initiatePayment);

// Payment status check
router.get('/:id/status', verifyToken, paymentController.getPaymentStatus);

// PhonePe callback (public - no auth)
router.post('/phonepe/callback', paymentController.phonePeCallback);

// PhonePe webhook (public - no auth)
router.post('/phonepe/webhook', paymentController.phonePeWebhook);

// Refund (admin only)
const { verifyAdmin } = require('../middlewares/adminAuth');
router.post('/:id/refund', verifyAdmin, paymentController.processRefund);

module.exports = router;
