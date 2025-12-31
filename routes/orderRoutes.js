const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { verifyToken } = require('../middlewares/auth');
const { validateOrder } = require('../middlewares/validation');
const { verifyAdmin } = require('../middlewares/adminAuth');

// Admin routes (must be before /:id to avoid conflicts)
router.get('/admin/all', verifyAdmin, orderController.getAllOrders);
router.get('/admin/stats', verifyAdmin, orderController.getOrderStats);

// Create new order
router.post('/', verifyToken, validateOrder, orderController.createOrder);

// Get user's orders
router.get('/', verifyToken, orderController.getUserOrders);

// Get order by ID
router.get('/:id', verifyToken, orderController.getOrderById);

// Cancel order
router.put('/:id/cancel', verifyToken, orderController.cancelOrder);

// Get order tracking
router.get('/:id/tracking', verifyToken, orderController.getOrderTracking);

// Reorder from previous order
router.post('/:id/reorder', verifyToken, orderController.reorder);

// Update order status (admin only)
router.put('/:id/status', verifyAdmin, orderController.updateOrderStatus);

module.exports = router;