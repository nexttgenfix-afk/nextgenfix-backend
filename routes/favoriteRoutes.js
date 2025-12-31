const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');
const { verifyToken } = require('../middlewares/auth');
const { validateObjectId } = require('../middlewares/validation');

// All routes require authentication
router.use(verifyToken);

// Get user's favorites
router.get('/', favoriteController.getAllFavorites);

// Add item to favorites
router.post('/:itemId', ...validateObjectId('itemId'), favoriteController.addToFavorites);

// Remove item from favorites
router.delete('/:itemId', ...validateObjectId('itemId'), favoriteController.removeFromFavorites);

// Check if item is favorited
router.get('/:itemId/check', ...validateObjectId('itemId'), favoriteController.checkFavorite);

module.exports = router;