const Cart = require('../models/cartModel');
const User = require('../models/userModel');
const MenuItem = require('../models/menuItemModel');
const Coupon = require('../models/couponModel');
const Settings = require('../models/settingsModel');
const mongoose = require('mongoose');

// Get user's cart
const getCart = async (req, res) => {
  try {
    const userId = req.userId;

    const cart = await Cart.findOne({ user: userId })
      .populate('items.menuItem', 'name price image category')
      .populate('user', 'name email phone');

    if (!cart) {
      // Create empty cart if none exists
      cart = new Cart({
        user: userId,
        items: [],
        totalAmount: 0
      });
      await cart.save();
      await cart.populate('items.menuItem', 'name price image category');
      await cart.populate('user', 'name email phone');
    }

    res.status(200).json({
      success: true,
      cart,
      isGuest: req.isGuest
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get cart',
      error: error.message
    });
  }
};

// Add item to cart
const addToCart = async (req, res) => {
  try {
    const userId = req.userId;
    const { menuItemId, quantity, customizations } = req.body;

    // Validate required fields
    if (!menuItemId || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'Menu item ID and quantity are required'
      });
    }

    // Validate menuItemId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(menuItemId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid menu item ID format'
      });
    }

    // Get menu item details
    const menuItem = await MenuItem.findById(menuItemId);
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    // Find or create cart
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({
        user: userId,
        items: [],
        totalAmount: 0
      });
    }

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(
      item => item.menuItem.toString() === menuItemId &&
              JSON.stringify(item.customizations) === JSON.stringify(customizations || {})
    );

    if (existingItemIndex > -1) {
      // Update quantity
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      // Add new item
      cart.items.push({
        menuItem: menuItemId,
        quantity,
        price: menuItem.price,
        customizations: customizations || {}
      });
    }

    // Recalculate total
    await cart.calculateTotal();

    await cart.save();
    await cart.populate('items.menuItem', 'name price image category');

    res.status(200).json({
      success: true,
      message: 'Item added to cart',
      cart,
      isGuest: req.isGuest
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add item to cart',
      error: error.message
    });
  }
};

// Update cart item
const updateCartItem = async (req, res) => {
  try {
    const userId = req.userId;
    const { itemId, quantity, customizations } = req.body;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart'
      });
    }

    if (quantity <= 0) {
      // Remove item
      cart.items.splice(itemIndex, 1);
    } else {
      // Update item
      cart.items[itemIndex].quantity = quantity;
      if (customizations) {
        cart.items[itemIndex].customizations = customizations;
      }
    }

    await cart.calculateTotal();
    await cart.save();
    await cart.populate('items.menuItem', 'name price image category');

    res.status(200).json({
      success: true,
      message: 'Cart updated',
      cart,
      isGuest: req.isGuest
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update cart',
      error: error.message
    });
  }
};

// Remove item from cart
const removeFromCart = async (req, res) => {
  try {
    const userId = req.userId;
    const { itemId } = req.params;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart'
      });
    }

    cart.items.splice(itemIndex, 1);
    await cart.calculateTotal();
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Item removed from cart',
      cart,
      isGuest: req.isGuest
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to remove item from cart',
      error: error.message
    });
  }
};

// Clear cart
const clearCart = async (req, res) => {
  try {
    const userId = req.userId;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.items = [];
    cart.totalAmount = 0;
    cart.coupon = null;
    cart.discount = 0;
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Cart cleared',
      cart,
      isGuest: req.isGuest
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to clear cart',
      error: error.message
    });
  }
};

// Apply coupon
const applyCoupon = async (req, res) => {
  try {
    const userId = req.userId;
    const { couponCode } = req.body;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const now = new Date();
    const coupon = await Coupon.findOne({
      code: couponCode.toUpperCase(),
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gt: now }
    });

    if (!coupon) {
      return res.status(400).json({ success: false, message: 'Invalid or expired coupon' });
    }

    // Enforce global usage limit
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ success: false, message: 'Coupon usage limit reached' });
    }

    // Enforce per-user usage limit
    if (coupon.usageLimitPerUser) {
      const usedByEntry = (coupon.usedBy || []).find(u => u.user && u.user.toString() === String(userId));
      if (usedByEntry && usedByEntry.count >= coupon.usageLimitPerUser) {
        return res.status(400).json({ success: false, message: 'You have already used this coupon the maximum allowed times' });
      }
    }

    // Enforce minimum order value
    if (coupon.minOrderValue && cart.totalAmount < coupon.minOrderValue) {
      return res.status(400).json({ success: false, message: `Minimum order value for this coupon is ${coupon.minOrderValue}` });
    }

    // Apply coupon to cart (do not increment global counts here; counts increment on successful order)
    cart.coupon = coupon._id;
    await cart.calculateTotal();
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Coupon applied',
      cart,
      isGuest: req.isGuest
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to apply coupon',
      error: error.message
    });
  }
};

// Remove coupon
const removeCoupon = async (req, res) => {
  try {
    const userId = req.userId;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.coupon = null;
    cart.discount = 0;
    await cart.calculateTotal();
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Coupon removed',
      cart,
      isGuest: req.isGuest
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to remove coupon',
      error: error.message
    });
  }
};

// Get cart summary
const getCartSummary = async (req, res) => {
  try {
    const userId = req.userId;

    const cart = await Cart.findOne({ user: userId })
      .populate('items.menuItem', 'name price image')
      .populate('coupon', 'code discountType discountValue');

    if (!cart) {
      return res.status(200).json({
        success: true,
        summary: {
          itemCount: 0,
          totalAmount: 0,
          discount: 0,
          finalAmount: 0,
          items: []
        }
      });
    }

    const summary = {
      itemCount: cart.items.length,
      totalAmount: cart.totalAmount,
      discount: cart.discount,
      finalAmount: cart.totalAmount - cart.discount,
      items: cart.items,
      coupon: cart.coupon
    };

    res.status(200).json({
      success: true,
      summary,
      isGuest: req.isGuest
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get cart summary',
      error: error.message
    });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  applyCoupon,
  removeCoupon,
  getCartSummary
};
