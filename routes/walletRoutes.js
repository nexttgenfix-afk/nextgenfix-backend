const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { requireGuestOrUser } = require('../middlewares/unifiedAuth');
const { verifyAdmin } = require('../middlewares/adminAuth');

/**
 * USER ROUTES - Wallet operations for mobile/user app
 */

// Get user's wallet balance and recent transactions
router.get('/', requireGuestOrUser, walletController.getWallet);

// Get paginated transaction history
router.get('/transactions', requireGuestOrUser, walletController.getTransactionHistory);

// Initiate wallet top-up
router.post('/topup', requireGuestOrUser, walletController.initiateTopup);

// PhonePe payment callback
router.post('/phonepe/callback', walletController.phonepeCallback);

/**
 * ADMIN ROUTES - Wallet management for admin dashboard
 * Note: These routes are registered at /api/admin/wallet/* in app.js
 */

module.exports = router;
