const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { optionalAuth } = require('../middlewares/auth');
const { searchLimiter } = require('../middlewares/rateLimiter');
const { validateMenuItem } = require('../middlewares/validation');

// Public routes (no auth required)
router.get('/', optionalAuth, menuController.getAllMenuItems);
router.get('/categories', menuController.getCategories);
router.get('/recommendations', optionalAuth, menuController.getRecommendations);
router.get('/trending', menuController.getTrendingItems);
router.get('/search', searchLimiter, menuController.searchMenuItems);
router.get('/:id', menuController.getMenuItemById);

// Admin routes (require admin auth)
const { verifyAdmin } = require('../middlewares/adminAuth');
const { uploadSingleImage } = require('../middlewares/upload');

router.post('/', verifyAdmin, uploadSingleImage, validateMenuItem, menuController.createMenuItem);
router.put('/:id', verifyAdmin, uploadSingleImage, validateMenuItem, menuController.updateMenuItem);
router.delete('/:id', verifyAdmin, menuController.deleteMenuItem);

// Category management (admin only)
router.post('/categories', verifyAdmin, menuController.createCategory);
router.put('/categories/:id', verifyAdmin, menuController.updateCategory);
router.delete('/categories/:id', verifyAdmin, menuController.deleteCategory);

module.exports = router;
