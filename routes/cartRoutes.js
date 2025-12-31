const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { requireGuestOrUser } = require('../middlewares/unifiedAuth');

// Get user's cart
router.get('/', requireGuestOrUser, cartController.getCart);

// Add item to cart
router.post('/items', requireGuestOrUser, cartController.addToCart);

// Update cart item
router.put('/items/:itemId', requireGuestOrUser, cartController.updateCartItem);

// Remove item from cart
router.delete('/items/:itemId', requireGuestOrUser, cartController.removeFromCart);

// Clear cart
router.delete('/', requireGuestOrUser, cartController.clearCart);

// Apply coupon to cart
router.post('/coupon', requireGuestOrUser, cartController.applyCoupon);

// Remove coupon from cart
router.delete('/coupon', requireGuestOrUser, cartController.removeCoupon);

// Get cart summary
router.get('/summary', requireGuestOrUser, cartController.getCartSummary);

module.exports = router;