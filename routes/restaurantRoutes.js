const express = require('express');
const router = express.Router();
const restaurantController = require('../controllers/restaurantController');
const { optionalAuth } = require('../middlewares/auth');
const { validateRestaurantProfile } = require('../middlewares/validation');
const { uploadMultipleImages } = require('../middlewares/upload');

// noop middleware fallback for optional validators
const noop = (req, res, next) => next();
const restaurantProfileValidator = typeof validateRestaurantProfile === 'function' ? validateRestaurantProfile : noop;

// Helper to safely wrap controller handlers (avoids router TypeError if handler is missing)
const handler = (fn) => {
	return (req, res, next) => {
		if (typeof fn === 'function') return fn(req, res, next);
		return res.status(501).json({ success: false, message: 'Not implemented' });
	};
};

// Public routes
router.get('/', optionalAuth, handler(restaurantController.getRestaurants));
router.get('/:id', optionalAuth, handler(restaurantController.getRestaurantPreferences));
router.get('/:id/menu', optionalAuth, handler(restaurantController.getRestaurantMenu));
router.get('/:id/reviews', optionalAuth, handler(restaurantController.getRestaurantFilters));

// Restaurant registration and profile (requires auth)
const { verifyToken } = require('../middlewares/auth');

router.post('/register', verifyToken, restaurantProfileValidator, handler(restaurantController.addRestaurant));
router.get('/profile/me', verifyToken, handler(restaurantController.getMyRestaurant));
router.put('/profile', verifyToken, restaurantProfileValidator, uploadMultipleImages(10), handler(restaurantController.updateRestaurantProfile));

// Menu management
router.post('/menu', verifyToken, handler(restaurantController.addMenuItem));
router.get('/menu/me', verifyToken, handler(restaurantController.getMyMenu));
router.put('/menu/:id', verifyToken, handler(restaurantController.updateMenuItem));
router.delete('/menu/:id', verifyToken, handler(restaurantController.deleteMenuItem));

// Orders management
router.get('/orders', verifyToken, handler(restaurantController.getRestaurantOrders));
router.put('/orders/:id/status', verifyToken, handler(restaurantController.updateOrderStatus));

// Analytics and earnings
router.get('/analytics', verifyToken, handler(restaurantController.getAnalytics));
router.get('/earnings', verifyToken, handler(restaurantController.getEarnings));

// Admin routes
const { verifyAdmin } = require('../middlewares/adminAuth');

router.get('/admin/all', verifyAdmin, handler(restaurantController.getRestaurants));
router.put('/:id/approve', verifyAdmin, handler(restaurantController.approveRestaurant));
router.put('/:id/suspend', verifyAdmin, handler(restaurantController.suspendRestaurant));

module.exports = router;
