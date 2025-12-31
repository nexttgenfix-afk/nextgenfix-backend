const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { optionalAuth } = require('../middlewares/auth');
const { validateCategory } = require('../middlewares/validation');
const { uploadSingleImage } = require('../middlewares/upload');

// Public routes
router.get('/', optionalAuth, categoryController.getAllCategories);
router.get('/:id', categoryController.getCategoryById);
router.get('/:id/items', optionalAuth, categoryController.getCategoryItems);

// Admin routes
const { verifyAdmin } = require('../middlewares/adminAuth');

router.post('/', verifyAdmin, uploadSingleImage, validateCategory, categoryController.createCategory);
router.put('/:id', verifyAdmin, uploadSingleImage, validateCategory, categoryController.updateCategory);
router.delete('/:id', verifyAdmin, categoryController.deleteCategory);
router.put('/:id/toggle', verifyAdmin, categoryController.toggleCategoryStatus);

module.exports = router;