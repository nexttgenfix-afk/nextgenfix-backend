const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');
const { optionalAuth } = require('../middlewares/auth');

// All home routes use optional auth (user favorites shown if logged in)

// Menu items with filter support (?filter=today-special|pure-veg|high-protein|salads|thali|popular)
router.get('/menu-items', optionalAuth, homeController.getMenuItems);

// Popular dishes
router.get('/popular-dishes', optionalAuth, homeController.getPopularDishes);

// Categories
router.get('/categories', homeController.getCategories);

// Banners
router.get('/banners', homeController.getBanners);

// Search menu items
router.get('/search', homeController.searchItems);

// Menu item detail page
router.get('/items/:itemId', optionalAuth, homeController.getMenuItemDetails);

module.exports = router;
