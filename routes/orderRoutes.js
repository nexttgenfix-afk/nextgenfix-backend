const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { requireAuth } = require('../middlewares/unifiedAuth');
const { validateOrder } = require('../middlewares/validation');
const { verifyAdmin } = require('../middlewares/adminAuth');

// Admin routes (must be before /:id to avoid conflicts)
router.get('/admin/all', verifyAdmin, orderController.getAllOrders);
router.get('/admin/stats', verifyAdmin, orderController.getOrderStats);

// Create new order
router.post('/', requireAuth, validateOrder, orderController.createOrder);

// Get user's orders
router.get('/', requireAuth, orderController.getUserOrders);

// Get order by ID
router.get('/:id', requireAuth, orderController.getOrderById);

// Cancel order
router.put('/:id/cancel', requireAuth, orderController.cancelOrder);

// Get order tracking
router.get('/:id/tracking', requireAuth, orderController.getOrderTracking);

// Reorder from previous order
router.post('/:id/reorder', requireAuth, orderController.reorder);

// Update order status (admin only)
router.put('/:id/status', verifyAdmin, orderController.updateOrderStatus);

module.exports = router;