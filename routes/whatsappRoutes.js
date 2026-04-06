const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappWebhookController');

// Webhook for MSG91 Inbound messages
router.post('/webhook', whatsappController.handleInbound);

// Webhook for Razorpay Payment Link events
router.post('/razorpay-webhook', whatsappController.handleRazorpayWebhook);

module.exports = router;
