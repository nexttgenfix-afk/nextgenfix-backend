const Order = require('../models/orderModel');
const Cart = require('../models/cartModel');
const User = require('../models/userModel');
const MenuItem = require('../models/menuItemModel');
const mongoose = require('mongoose');
const { initiatePayment, verifyPayment } = require('../services/payment');
const { createNotification } = require('../services/notification');
const { updateUserTier } = require('../services/tier');

// Create new order
const createOrder = async (req, res) => {
  try {
    const {
      items,
      orderType,
      deliveryAddress,
      tableNumber,
      paymentMethod,
      specialInstructions,
      scheduledTime
    } = req.body;
    // couponCode may be auto-applied for first-time referees, so make it mutable
    let couponCode = req.body.couponCode;

    // load user early so we can evaluate referral coupons for auto-apply
    const currentUser = await User.findById(req.user.id).select('totalOrders referralCoupons referredBy referrals').lean();

    let orderItems = [];
    let totalAmount = 0;
    let discountAmount = 0;

    // Handle items from request or cart
    if (items && items.length > 0) {
      // Direct items from request
      for (const item of items) {
        const menuItem = await MenuItem.findById(item.menuItemId || item.itemId);
        if (!menuItem) {
          return res.status(400).json({ message: `Menu item not found: ${item.menuItemId || item.itemId}` });
        }
        if (!menuItem.isAvailable) {
          return res.status(400).json({ message: `${menuItem.name} is not available` });
        }

        orderItems.push({
          itemId: menuItem._id,
          quantity: item.quantity,
          price: menuItem.price,
          customizations: item.customizations || item.specialInstructions || {}
        });

        totalAmount += menuItem.price * item.quantity;
      }
    } else {
      // From cart (existing logic)
      const cart = await Cart.findOne({ user: req.user.id })
        .populate('items.menuItem')
        .populate('coupon');

      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ message: 'Cart is empty' });
      }

      // Validate items availability
      for (const item of cart.items) {
        if (!item.menuItem.isAvailable) {
          return res.status(400).json({
            message: `${item.menuItem.name} is not available`
          });
        }
      }

      orderItems = cart.items.map(item => ({
        itemId: item.menuItem._id,
        quantity: item.quantity,
        price: item.price,
        customizations: item.customizations
      }));

      totalAmount = cart.finalAmount || cart.totalAmount;
      discountAmount = cart.discountAmount || 0;
    }

    // Auto-apply referee referral coupon on first order if applicable
    if (!couponCode && currentUser && (currentUser.totalOrders || 0) === 0 && currentUser.referralCoupons && currentUser.referralCoupons.length > 0) {
      try {
        const Coupon = require('../models/couponModel');
        const now = new Date();
        const candidate = await Coupon.findOne({
          _id: { $in: currentUser.referralCoupons },
          isActive: true,
          validFrom: { $lte: now },
          validUntil: { $gt: now }
        }).sort({ validUntil: 1 });
        // We will later check minOrderValue against totalAmount when applying
        if (candidate) {
          couponCode = candidate.code;
        }
      } catch (e) {
        console.error('Auto-apply referral coupon error:', e.message);
      }
    }

    // Apply coupon if provided
    let appliedCoupon = null;
    if (couponCode) {
      const Coupon = require('../models/couponModel');
      const coupon = await Coupon.findOne({ code: couponCode, isActive: true, validUntil: { $gt: new Date() } });
      if (coupon) {
        appliedCoupon = coupon._id;
        if (coupon.discountType === 'percentage') {
          discountAmount = (totalAmount * coupon.discountValue) / 100;
        } else if (coupon.discountType === 'fixed') {
          discountAmount = Math.min(coupon.discountValue, totalAmount);
        }
      }
    }

    const finalAmount = totalAmount - discountAmount;

    // Create order
    const order = await Order.create({
      user: req.user.id,
      orderType,
      items: orderItems,
      billing: {
        subtotal: totalAmount,
        discounts: {
          totalDiscount: discountAmount
        },
        totalAmount: finalAmount
      },
      deliveryAddress: orderType === 'delivery' ? deliveryAddress : undefined,
      tableNumber: orderType === 'on_site_dining' ? tableNumber : undefined,
      paymentDetails: {
        method: paymentMethod
      },
      cookingInstructions: specialInstructions,
      scheduledTime: scheduledTime ? new Date(scheduledTime) : undefined
    });

    // Update menu item order counts
    for (const item of orderItems) {
      await MenuItem.findByIdAndUpdate(item.itemId, {
        $inc: { orderCount: item.quantity }
      });
    }

    // Create notification
    await createNotification({
      userId: req.user.id,
      title: 'Order Placed',
      message: `Your order has been placed successfully`,
      type: 'order',
      data: { orderId: order._id }
    });

    // Populate order details
    await order.populate([
      { path: 'items.itemId', select: 'name image' },
      { path: 'user', select: 'name phone' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        orderType,
        items: order.items,
        billing: order.billing,
        deliveryAddress: order.deliveryAddress,
        tableNumber: order.tableNumber,
        paymentDetails: order.paymentDetails,
        cookingInstructions: order.cookingInstructions,
        scheduledTime: order.scheduledTime,
        status: order.status,
        createdAt: order.createdAt
      }
    });

    // Clear cart after order creation if cart was used
    if (!items || items.length === 0) {
      const cart = await Cart.findOne({ user: req.user.id });
      if (cart) {
        await Cart.findByIdAndUpdate(cart._id, {
          items: [],
          totalAmount: 0,
          discountAmount: 0,
          finalAmount: 0,
          coupon: null
        });

        // Update coupon usage if applied
        if (cart.coupon) {
          try {
            const Coupon = require('../models/couponModel');
            const c = await Coupon.findById(cart.coupon);
            if (c) {
              c.usedCount = (c.usedCount || 0) + 1;
              // increment per-user count
              const userIdStr = String(req.user.id);
              const entry = (c.usedBy || []).find(u => String(u.user) === userIdStr);
              if (entry) entry.count = (entry.count || 0) + 1;
              else c.usedBy = c.usedBy || [], c.usedBy.push({ user: req.user.id, count: 1 });
              await c.save();
            }
          } catch (e) {
            console.error('Error updating coupon usage for cart.coupon:', e.message);
          }
        }
      }
    } else {
      // Update coupon usage if applied
      if (appliedCoupon) {
        try {
          const Coupon = require('../models/couponModel');
          const c = await Coupon.findById(appliedCoupon);
          if (c) {
            c.usedCount = (c.usedCount || 0) + 1;
            const userIdStr = String(req.user.id);
            const entry = (c.usedBy || []).find(u => String(u.user) === userIdStr);
            if (entry) entry.count = (entry.count || 0) + 1;
            else c.usedBy = c.usedBy || [], c.usedBy.push({ user: req.user.id, count: 1 });
            await c.save();
          }
        } catch (e) {
          console.error('Error updating coupon usage for appliedCoupon:', e.message);
        }
      }
    }

    // If a referral coupon was used on a first order, mark the referral reward as claimed for the referrer
    try {
      if (appliedCoupon) {
        const Coupon = require('../models/couponModel');
        const used = await Coupon.findById(appliedCoupon);
        if (used) {
          // If the current user was referred by someone, mark rewardClaimed on that referrer entry
          if (req.user && req.user.id) {
            const me = await User.findById(req.user.id);
            if (me && me.referredBy) {
              const ref = await User.findById(me.referredBy);
              if (ref && Array.isArray(ref.referrals)) {
                const entry = ref.referrals.find(r => r.user && r.user.toString() === me._id.toString());
                if (entry && !entry.rewardClaimed) {
                  entry.rewardClaimed = true;
                  await ref.save();
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('Error marking referral reward claimed:', e.message);
    }

    // Update menu item order counts
    for (const item of cart.items) {
      await MenuItem.findByIdAndUpdate(item.menuItem._id, {
        $inc: { orderCount: item.quantity }
      });
    }

    // Create notification
    await createNotification({
      userId: req.user.id,
      title: 'Order Placed',
      message: `Your order #${order.orderNumber} has been placed successfully`,
      type: 'order',
      data: { orderId: order._id }
    });

    // Populate order details
    await order.populate([
      { path: 'items.menuItem', select: 'name image' },
      { path: 'userId', select: 'name phone' }
    ]);

    res.status(201).json({
      message: 'Order created successfully',
      order
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get user's orders
const getUserOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    let query = { user: req.user.id };
    if (status) query.status = status;

    const orders = await Order.find(query)
      .populate('items.itemId', 'name image')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    res.json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get order by ID
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user.id
    })
    .populate('items.itemId', 'name image price')
    .populate('appliedCoupon', 'code discountType discountValue');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Cancel order
const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if order can be cancelled
    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({
        message: 'Order cannot be cancelled at this stage'
      });
    }

    // Update order status
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    await order.save();

    // Create notification
    await createNotification({
      userId: req.user.id,
      title: 'Order Cancelled',
      message: `Your order #${order.orderNumber} has been cancelled`,
      type: 'order',
      data: { orderId: order._id }
    });

    res.json({
      message: 'Order cancelled successfully',
      order
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get order tracking
const getOrderTracking = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user.id
    }).select('status trackingHistory estimatedDeliveryTime');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({
      status: order.status,
      trackingHistory: order.trackingHistory,
      estimatedDeliveryTime: order.estimatedDeliveryTime
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Reorder from previous order
const reorder = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Get user's cart
    let cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      cart = await Cart.create({ user: req.user.id, items: [] });
    }

    // Add order items to cart
    for (const item of order.items) {
      const menuItem = await MenuItem.findById(item.itemId);
      if (menuItem && menuItem.isAvailable) {
        const existingItemIndex = cart.items.findIndex(
          cartItem => cartItem.menuItem.toString() === item.itemId.toString()
        );

        if (existingItemIndex > -1) {
          cart.items[existingItemIndex].quantity += item.quantity;
        } else {
          cart.items.push({
            menuItem: item.itemId,
            quantity: item.quantity,
            price: menuItem.price,
            customizations: item.customizations
          });
        }
      }
    }

    // Recalculate totals
    await cart.calculateTotal();
    await cart.save();
    await cart.populate('items.menuItem', 'name price image isVeg isAvailable');

    res.json({
      message: 'Items added to cart successfully',
      cart
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Admin: Get all orders
const getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, startDate, endDate, search } = req.query;

    let query = {};
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // If a search query is provided, try to match order id, delivery address or user name/phone
    if (search) {
      const regex = new RegExp(String(search), 'i');

      // Users matching name or phone
      const matchingUserIds = await User.find({ $or: [{ name: regex }, { phone: regex }] }).distinct('_id');

      const orConditions = [
        { deliveryAddress: regex },
        { user: { $in: matchingUserIds } }
      ];

      // If search looks like an ObjectId, also match by _id
      if (mongoose.Types.ObjectId.isValid(search)) {
        orConditions.unshift({ _id: mongoose.Types.ObjectId(search) });
      }

      query.$or = orConditions;
    }

    const orders = await Order.find(query)
      .populate('user', 'name phone')
      .populate('items.itemId', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      message: 'Orders fetched successfully',
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
};

// Admin: Update order status
const updateOrderStatus = async (req, res) => {
  try {
    const { status: requestedStatus, notes } = req.body;

    if (!requestedStatus || typeof requestedStatus !== 'string') {
      return res.status(400).json({ message: 'Invalid or missing status in request body' });
    }

    const order = await Order.findById(req.params.id)
      .populate('user', 'name');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Map external/pretty status values to internal enum values
    const statusMap = {
      Ordered: 'placed',
      ordered: 'placed',
      Preparing: 'preparing',
      preparing: 'preparing',
      Dispatched: 'out-for-delivery',
      dispatched: 'out-for-delivery',
      Delivered: 'delivered',
      delivered: 'delivered',
      Canceled: 'cancelled',
      cancelled: 'cancelled',
      canceled: 'cancelled',
    };

    const mappedStatus = statusMap[requestedStatus] || requestedStatus.toLowerCase();

    const allowed = ['placed', 'preparing', 'out-for-delivery', 'delivered', 'cancelled'];
    if (!allowed.includes(mappedStatus)) {
      return res.status(400).json({ message: `Unsupported status: ${requestedStatus}` });
    }

    // Update status
    const oldStatus = order.status;
    order.status = mappedStatus;

    // Add to tracking history (store the requestedStatus for human readability)
    if (!Array.isArray(order.trackingHistory)) order.trackingHistory = [];
    order.trackingHistory.push({
      status: mappedStatus,
      timestamp: new Date(),
      notes: notes || ''
    });

    // Set estimated delivery time for certain statuses
    if (mappedStatus === 'preparing' || mappedStatus === 'out-for-delivery') {
      // Set an estimated delivery time only when moving to preparing or dispatched
      order.estimatedDeliveryTime = new Date(Date.now() + 45 * 60 * 1000); // 45 minutes
    }

    if (mappedStatus === 'delivered') {
      order.deliveredAt = new Date();

      // Update user tier and total spent (use billing.totalAmount if present)
      try {
        const userId = order.user && order.user._id ? order.user._id : order.user;
        const user = await User.findById(userId);
        if (user) {
          const amount = (order.billing && order.billing.totalAmount) || order.totalAmount || 0;
          user.totalSpent = (user.totalSpent || 0) + amount;
          await user.save();
          try {
            await updateUserTier(user._id);
          } catch (tierErr) {
            console.error('updateUserTier error for user', user._id, tierErr);
          }
        }
      } catch (userErr) {
        console.error('Error updating user after delivery for order', order._id, userErr);
      }
    }

    await order.save();

    // Create notification for user (send user id)
    try {
      const notifyUserId = order.user && order.user._id ? order.user._id : order.user;
      await createNotification({
        userId: notifyUserId,
        title: 'Order Status Updated',
        message: `Your order #${order.orderNumber || order._id} status changed to ${requestedStatus}`,
        type: 'order',
        data: { orderId: order._id }
      });
    } catch (notifErr) {
      console.error('Notification error after status update:', notifErr);
    }

    res.json({
      message: 'Order status updated successfully',
      order
    });
  } catch (error) {
    console.error('Update order status error:', error);
    // If it's a mongoose validation error, return 400 with message for debugging
    if (error && error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation error', error: error.message });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Admin: Get order statistics
const getOrderStats = async (req, res) => {
  try {
    const { period = 'month' } = req.query;

    let groupBy;
    switch (period) {
      case 'day':
        groupBy = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
        break;
      case 'week':
        groupBy = { $dateToString: { format: '%Y-%U', date: '$createdAt' } };
        break;
      case 'month':
      default:
        groupBy = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
        break;
    }

    const stats = await Order.aggregate([
      {
        $group: {
          _id: groupBy,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          averageOrderValue: { $avg: '$totalAmount' }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  getOrderById,
  cancelOrder,
  getOrderTracking,
  reorder,
  getAllOrders,
  updateOrderStatus,
  getOrderStats
};
