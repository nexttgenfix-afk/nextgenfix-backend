const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');
const { optionalAuth } = require('../middlewares/auth');

// Helper to guard against undefined or non-function handlers
const handler = (fn) => {
	if (typeof fn === 'function') return fn;
	// return a placeholder handler that indicates the endpoint isn't implemented yet
	return (req, res) => res.status(501).json({ message: 'Not implemented' });
};

// Public routes (no auth required)
router.get('/featured', handler(homeController.getFeaturedItems));
router.get('/categories', handler(homeController.getCategories));
router.get('/banners', handler(homeController.getBanners));
router.get('/trending', handler(homeController.getTrendingItems));
router.get('/nearby', optionalAuth, handler(homeController.getNearbyItems));
router.get('/recommendations', optionalAuth, handler(homeController.getPersonalizedRecommendations));

// Search functionality
router.get('/search', handler(homeController.searchItems));

// Location-based routes
router.get('/location/restaurants', optionalAuth, handler(homeController.getRestaurantsByLocation));
router.get('/location/chefs', optionalAuth, handler(homeController.getChefsByLocation));

module.exports = router;