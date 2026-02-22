const express = require('express');
const router = express.Router();
const ratingController = require('../controllers/ratingController');
const { verifyToken } = require('../middlewares/auth');
const { validateRating } = require('../middlewares/validation');

// All routes require authentication
router.use(verifyToken);

// Submit rating for an order
router.post('/orders/:orderId', validateRating, ratingController.submitRating);

// Get user's ratings
router.get('/', ratingController.getUserRatings);

// Get ratings for a specific item
// router.get('/items/:itemId', ratingController.getItemRatings);

// Get ratings for a specific chef
// router.get('/chefs/:chefId', ratingController.getChefRatings);

// Update rating
// router.put('/:id', validateRating, ratingController.updateRating);

// Delete rating
router.delete('/:ratingId', ratingController.deleteRating);

// Admin routes
const { verifyAdmin } = require('../middlewares/adminAuth');

// router.get('/admin/all', verifyAdmin, ratingController.getAllRatings);
// router.delete('/admin/:id', verifyAdmin, ratingController.deleteRatingAdmin);

module.exports = router;