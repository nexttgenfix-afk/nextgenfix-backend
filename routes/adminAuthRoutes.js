const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyAdmin } = require('../middlewares/adminAuth');

// Admin Signup (no auth required)
router.post('/signup', adminController.signup);

// Public routes
router.post('/login', adminController.login);


// Admin Logout (protected, but just a dummy for JWT)
router.post('/logout', verifyAdmin, adminController.logout);

// Protected routes (admin only)
router.get('/profile', verifyAdmin, adminController.getProfile);
router.post('/change-password', verifyAdmin, adminController.changePassword);

module.exports = router;