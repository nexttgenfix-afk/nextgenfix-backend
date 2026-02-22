const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateLogin, validateRegistration } = require('../middlewares/validation');
const { generalLimiter } = require('../middlewares/rateLimiter');

// Public auth routes
router.post('/register', generalLimiter, validateRegistration, authController.register);
router.post('/login', generalLimiter, validateLogin, authController.login);
router.post('/verify-otp', generalLimiter, authController.verifyOTP);
router.post('/resend-otp', generalLimiter, authController.resendOTP);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout);
// Create guest session/token
router.post('/guest', authController.createGuest);

// Password reset routes
router.post('/forgot-password', generalLimiter, authController.forgotPassword);
router.post('/reset-password', generalLimiter, authController.resetPassword);

// Social auth routes (Firebase)
router.post('/firebase/verify', authController.verifyFirebaseToken);

// WhatsApp OTP routes (MSG91)
router.post('/whatsapp/send-otp', generalLimiter, authController.sendWhatsappOtp);
router.post('/whatsapp/verify-otp', generalLimiter, authController.verifyWhatsappOtp);

module.exports = router;
