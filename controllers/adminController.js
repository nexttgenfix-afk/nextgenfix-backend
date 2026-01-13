const Admin = require('../models/adminModel');
const User = require('../models/userModel');
const Order = require('../models/orderModel');
const Restaurant = require('../models/restaurantModel');
const Complaint = require('../models/complaintModel');
const MenuItem = require('../models/menuItemModel');
const { generateToken } = require('../services/auth');
const { sendEmail } = require('../services/email');
const bcrypt = require('bcryptjs');

// Register admin
exports.registerAdmin = async (req, res) => {
  try {
    const { name, email, password, permissions } = req.body;

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Admin already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create admin
    const admin = await Admin.create({
      name,
      email,
      password: hashedPassword,
      permissions: permissions || Admin.getDefaultPermissions(),
      role: 'admin'
    });

  // Generate token (include role so verification middleware recognizes admin)
  const token = generateToken(admin._id, 'admin');

    // Remove password from response
    const adminResponse = admin.toObject();
    delete adminResponse.password;

    res.status(201).json({
      message: 'Admin registered successfully',
      admin: adminResponse,
      token
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Login admin
exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Debug: incoming login attempt
    console.log(`[AdminLogin] Attempt login for email=${email} ip=${req.ip || req.connection?.remoteAddress || 'unknown'}`);

    // Find admin
    const admin = await Admin.findOne({ email });
    if (!admin) {
      console.log(`[AdminLogin] Admin not found for email=${email}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      console.log(`[AdminLogin] Invalid password for adminId=${admin._id} email=${email}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

  // Generate token (include role so verification middleware recognizes admin)
  const token = generateToken(admin._id, 'admin');

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Remove password from response
    const adminResponse = admin.toObject();
    delete adminResponse.password;

    res.json({
      message: 'Login successful',
      admin: adminResponse,
      token
    });
  } catch (error) {
    console.error('[AdminLogin] Error during login:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get dashboard stats
exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalUsers,
      totalOrders,
      totalRevenue,
      todayOrders,
      todayRevenue,
      activeComplaints
    ] = await Promise.all([
      User.countDocuments(),
      Order.countDocuments(),
      Order.aggregate([{ $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
      Order.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
      Order.aggregate([
        { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      // chef counts removed from dashboard calculation
      Complaint.countDocuments({ status: 'pending' })
    ]);

    res.json({
      totalUsers,
      totalOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
      todayOrders,
      todayRevenue: todayRevenue[0]?.total || 0,
      activeComplaints
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get revenue stats
exports.getRevenueStats = async (req, res) => {
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

    const revenueStats = await Order.aggregate([
      {
        $match: {
          status: { $in: ['delivered', 'completed'] }
        }
      },
      {
        $group: {
          _id: groupBy,
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    res.json(revenueStats);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get order stats
exports.getOrderStats = async (req, res) => {
  try {
    const orderStats = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = {
      pending: 0,
      confirmed: 0,
      preparing: 0,
      ready: 0,
      delivered: 0,
      cancelled: 0
    };

    orderStats.forEach(stat => {
      stats[stat._id] = stat.count;
    });

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get user stats
exports.getUserStats = async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      newUsersToday,
      usersByTier
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
      User.countDocuments({
        createdAt: {
          $gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }),
      User.aggregate([
        { $group: { _id: '$tier', count: { $sum: 1 } } }
      ])
    ]);

    res.json({
      totalUsers,
      activeUsers,
      newUsersToday,
      usersByTier
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// User management
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, tier } = req.query;

    let query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) {
      query.status = status;
    }
    if (tier) {
      query.tier = tier;
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
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

const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getUserById = getUserById;

exports.updateUser = async (req, res) => {
  try {
    const { name, email, phone, status, tier } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, phone, status, tier },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Chef management removed — delegated to a separate service
// Restaurant management
exports.getAllRestaurants = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, approvalStatus } = req.query;

    let query = {};
    if (status) query.status = status;
    if (approvalStatus) query.approvalStatus = approvalStatus;

    const restaurants = await Restaurant.find(query)
      .populate('ownerId', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Restaurant.countDocuments(query);

    res.json({
      restaurants,
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

const getRestaurantById = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id)
      .populate('ownerId', 'name email phone');
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }
    res.json(restaurant);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getRestaurantById = getRestaurantById;

exports.approveRestaurant = async (req, res) => {
  try {
    const { status, notes } = req.body;

    const restaurant = await Restaurant.findByIdAndUpdate(
      req.params.id,
      {
        approvalStatus: status,
        approvalNotes: notes,
        approvedAt: status === 'approved' ? new Date() : null
      },
      { new: true }
    );

    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    res.json({ message: `Restaurant ${status} successfully`, restaurant });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.suspendRestaurant = async (req, res) => {
  try {
    const { reason } = req.body;

    const restaurant = await Restaurant.findByIdAndUpdate(
      req.params.id,
      {
        status: 'suspended',
        suspensionReason: reason,
        suspendedAt: new Date()
      },
      { new: true }
    );

    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    res.json({ message: 'Restaurant suspended successfully', restaurant });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.deleteRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findByIdAndDelete(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    res.json({ message: 'Restaurant deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Content management
exports.getReports = async (req, res) => {
  try {
    // Reuse the detailed dashboard analytics implementation if available.
    if (typeof exports.getDashboardAnalytics === 'function') {
      // delegate to the dashboard analytics endpoint implementation
      return exports.getDashboardAnalytics(req, res);
    }

    // Fallback: basic summary report
    const [totalUsers, totalOrders, totalRevenue, openComplaints] = await Promise.all([
      User.countDocuments(),
      Order.countDocuments(),
      Order.aggregate([{ $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
      Complaint.countDocuments({ status: { $in: ['Open', 'Pending', 'In Progress'] } })
    ]);

    res.json({
      totalUsers,
      totalOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
      openComplaints
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getAnalytics = async (req, res) => {
  try {
    // If the rich dashboard analytics implementation exists, delegate to it.
    if (typeof exports.getDashboardAnalytics === 'function') {
      return exports.getDashboardAnalytics(req, res);
    }

    // Fallback: return some key analytics
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const ordersThisMonth = await Order.countDocuments({ createdAt: { $gte: startOfMonth } });
    const revenueThisMonthAgg = await Order.aggregate([
      { $match: { createdAt: { $gte: startOfMonth }, paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$billing.totalAmount' } } }
    ]);
    const revenueThisMonth = revenueThisMonthAgg[0]?.total || 0;

    res.json({ ordersThisMonth, revenueThisMonth });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getAnalytics = getAnalytics;

// NOTE: module.exports moved to END of file after all exports.* definitions
// Get recent reviews (limit 10)
exports.getRecentReviews = async (req, res) => {
  try {
    const reviews = await require('../models/reviewModel')
      .find({ status: 'Approved' })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('reviewer', 'name email')
      .populate({
        path: 'target',
        select: 'name kitchenName',
        model: function(doc) { return doc.targetType; }
      });
    res.status(200).json({
      message: 'Recent reviews fetched successfully',
      success: true,
      reviews
    });
  } catch (err) {
    console.error('Get recent reviews error:', err);
    res.status(500).json({ message: 'Failed to fetch recent reviews', success: false });
  }
};
const ReviewModel = require('../models/reviewModel');
// Admin: List all reviews with filter/search/pagination
exports.getReviews = async (req, res) => {
  try {
    const { search = '', status, targetType, page = 1, limit = 10 } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { comment: { $regex: search, $options: 'i' } },
        { rating: Number(search) || undefined }
      ];
    }
    if (status) query.status = status;
    if (targetType) query.targetType = targetType;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const reviews = await ReviewModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('reviewer', 'name email');
    const total = await ReviewModel.countDocuments(query);
    res.status(200).json({ reviews, total });
  } catch (err) {
    console.error('Admin get reviews error:', err);
    res.status(500).json({ message: 'Failed to fetch reviews' });
  }
};
// Admin: Approve a review
exports.approveReview = async (req, res) => {
  try {
    const review = await ReviewModel.findByIdAndUpdate(req.params.reviewId, { status: 'Approved' }, { new: true });
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    res.status(200).json({ message: 'Review approved', review });
  } catch (err) {
    console.error('Approve review error:', err);
    res.status(500).json({ message: 'Failed to approve review' });
  }
};
// Admin: Reject a review
exports.rejectReview = async (req, res) => {
  try {
    const review = await ReviewModel.findByIdAndUpdate(req.params.reviewId, { status: 'Rejected' }, { new: true });
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    res.status(200).json({ message: 'Review rejected', review });
  } catch (err) {
    console.error('Reject review error:', err);
    res.status(500).json({ message: 'Failed to reject review' });
  }
};
// Export analytics data (CSV)
exports.exportAnalytics = async (req, res) => {
  try {
    // --- 1. User/Order/Revenue Trends (monthly, last 12 months) ---
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() });
    }
    const getMonthRange = (year, month) => {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 1);
      return { start, end };
    };
    const userTrends = [];
    const orderTrends = [];
    const revenueTrends = [];
    for (const m of months) {
      const { start, end } = getMonthRange(m.year, m.month);
      userTrends.push(await User.countDocuments({ createdAt: { $gte: start, $lt: end } }));
      orderTrends.push(await Order.countDocuments({ createdAt: { $gte: start, $lt: end } }));
      const revenue = await Order.aggregate([
        { $match: { createdAt: { $gte: start, $lt: end }, paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$billing.totalAmount' } } }
      ]);
      revenueTrends.push(revenue[0]?.total || 0);
    }

    // --- 2. Orders by Category (bar chart) ---
    const ordersByCategoryAgg = await Order.aggregate([
      { $unwind: '$items' },
      { $lookup: {
          from: 'menuitems',
          localField: 'items.itemId',
          foreignField: '_id',
          as: 'menuItem'
        }
      },
      { $unwind: '$menuItem' },
      { $group: { _id: '$menuItem.category', count: { $sum: '$items.quantity' } } },
      { $sort: { count: -1 } }
    ]);
    const ordersByCategory = ordersByCategoryAgg.map(c => ({ category: c._id, count: c.count }));

    // Prepare CSV
    let csv = 'Month,User Signups,Orders,Revenue\n';
    for (let i = 0; i < months.length; i++) {
      const m = months[i];
      csv += `${m.year}-${String(m.month + 1).padStart(2, '0')},${userTrends[i]},${orderTrends[i]},${revenueTrends[i]}\n`;
    }

    csv += '\nOrders by Category\nCategory,Order Count\n';
    for (const c of ordersByCategory) {
      csv += `${c.category},${c.count}\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=analytics.csv');
    res.status(200).send(csv);
  } catch (err) {
    console.error('Export analytics error:', err);
    res.status(500).json({ message: 'Failed to export analytics' });
  }
};
// Admin Dashboard Analytics (single API for all analytics data)
exports.getDashboardAnalytics = async (req, res) => {
  try {
    // --- 1. User/Order/Revenue Trends (monthly, last 12 months) ---
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() });
    }
    const getMonthRange = (year, month) => {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 1);
      return { start, end };
    };
    const userTrends = [];
    const orderTrends = [];
    const revenueTrends = [];
    for (const m of months) {
      const { start, end } = getMonthRange(m.year, m.month);
      userTrends.push(await User.countDocuments({ createdAt: { $gte: start, $lt: end } }));
      orderTrends.push(await Order.countDocuments({ createdAt: { $gte: start, $lt: end } }));
      const revenue = await Order.aggregate([
        { $match: { createdAt: { $gte: start, $lt: end }, paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$billing.totalAmount' } } }
      ]);
      revenueTrends.push(revenue[0]?.total || 0);
    }

    // --- 2. Orders by Category (bar chart) ---
    const ordersByCategoryAgg = await Order.aggregate([
      { $unwind: '$items' },
      { $lookup: {
          from: 'menuitems',
          localField: 'items.itemId',
          foreignField: '_id',
          as: 'menuItem'
        }
      },
      { $unwind: '$menuItem' },
      { $group: { _id: '$menuItem.category', count: { $sum: '$items.quantity' } } },
      { $sort: { count: -1 } }
    ]);
    const ordersByCategory = ordersByCategoryAgg.map(c => ({ category: c._id, count: c.count }));

    // --- 3. Order Status Distribution (pie chart) ---
    const statusList = ['placed', 'preparing', 'out-for-delivery', 'delivered', 'cancelled'];
    const orderStatusCounts = {};
    for (const status of statusList) {
      orderStatusCounts[status] = await Order.countDocuments({ status });
    }

    // --- 4. Average Order Value ---
    const avgOrderValueAgg = await Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, avg: { $avg: '$billing.totalAmount' } } }
    ]);
    const averageOrderValue = avgOrderValueAgg[0]?.avg || 0;

    // --- 5. Repeat Customer Rate ---
    const repeatUsersAgg = await Order.aggregate([
      { $group: { _id: '$userId', orderCount: { $sum: 1 } } },
      { $match: { orderCount: { $gt: 1 } } },
      { $count: 'repeatUsers' }
    ]);
    const totalUsers = await User.countDocuments();
    const repeatCustomerRate = totalUsers > 0 ? ((repeatUsersAgg[0]?.repeatUsers || 0) / totalUsers) * 100 : 0;

    // --- 6. Most Popular Menu Items (top 3 by order count) ---
    const popularItemsAgg = await Order.aggregate([
      { $unwind: '$items' },
      { $group: { _id: '$items.itemId', count: { $sum: '$items.quantity' } } },
      { $sort: { count: -1 } },
      { $limit: 3 },
      { $lookup: {
          from: 'menuitems',
          localField: '_id',
          foreignField: '_id',
          as: 'item'
        }
      },
      { $unwind: '$item' },
      { $project: { name: '$item.name', count: 1 } }
    ]);
    const mostPopularMenuItems = popularItemsAgg.map(i => ({ name: i.name, count: i.count }));

    // --- 7. Top Active Users (by order count) ---
    const topUsersAgg = await Order.aggregate([
      { $group: { _id: '$userId', orderCount: { $sum: 1 } } },
      { $sort: { orderCount: -1 } },
      { $limit: 3 },
      { $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      { $project: { name: '$user.name', orderCount: 1 } }
    ]);
    const topActiveUsers = topUsersAgg.map(u => ({ name: u.name, orderCount: u.orderCount }));

    // --- 8. Top Performing Chefs (removed - chef management not supported) ---
    const topPerformingChefs = []; // Chef management removed

    // --- 9. Orders Today/Yesterday (for trend cards) ---
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const ordersToday = await Order.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } });
    const ordersYesterday = await Order.countDocuments({ createdAt: { $gte: yesterday, $lt: today } });

    // --- 10. Open Issues (complaints) ---
    const openIssues = await Complaint.countDocuments({ status: { $in: ['Open', 'Pending', 'In Progress'] } });
    const openIssuesYesterday = await Complaint.countDocuments({
      status: { $in: ['Open', 'Pending', 'In Progress'] },
      createdAt: { $gte: yesterday, $lt: today }
    });

    res.status(200).json({
      trends: {
        months: months.map(m => `${m.year}-${String(m.month + 1).padStart(2, '0')}`),
        userSignups: userTrends,
        orders: orderTrends,
        revenue: revenueTrends
      },
      ordersByCategory,
      orderStatusDistribution: orderStatusCounts,
      averageOrderValue,
      repeatCustomerRate,
      mostPopularMenuItems,
      topActiveUsers,
      topPerformingChefs,
      ordersToday,
      ordersYesterday,
      openIssues,
      openIssuesYesterday
    });
  } catch (err) {
    console.error('Get dashboard analytics error:', err);
    res.status(500).json({ message: 'Failed to fetch dashboard analytics' });
  }
};
// Delete complaint (admin action)
exports.deleteComplaint = async (req, res) => {
  try {
    const id = req.params.complaintId;
    let complaint = null;
    // Try to delete by MongoDB _id if valid, else fallback to complaintId
    if (/^[a-fA-F0-9]{24}$/.test(id)) {
      complaint = await Complaint.findByIdAndDelete(id);
    }
    if (!complaint) {
      complaint = await Complaint.findOneAndDelete({ complaintId: id });
    }
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }
    res.status(200).json({ message: 'Complaint deleted', complaint });
  } catch (err) {
    console.error('Delete complaint error:', err);
    res.status(500).json({ message: 'Failed to delete complaint' });
  }
};
// List all orders sorted from newest to oldest
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name email phone')
      .populate({
        path: 'items.itemId',
        select: 'name price'
      })
      .sort({ createdAt: -1 })
      .lean(); // Use lean for better performance

    // Transform orders to include formatted address string
    const formattedOrders = orders.map(order => {
      // Create a temporary order instance to access virtuals
      const orderDoc = new Order(order);
      
      return {
        ...order,
        // Override deliveryAddress with formatted string from virtual
        deliveryAddress: orderDoc.formattedDeliveryAddress || order.deliveryAddress || ''
      };
    });

    res.status(200).json({
      message: 'All orders fetched successfully',
      success: true,
      orders: formattedOrders
    });
  } catch (err) {
    console.error('Get all orders error:', err);
    res.status(500).json({ message: 'Failed to fetch all orders', success: false });
  }
};
// Admin Dashboard Stats (for chart and summary data)
exports.getStats = async (req, res) => {
  try {
    // Get total counts
    const [userCount, orderCount, complaintCount] = await Promise.all([
      User.countDocuments(),
      Order.countDocuments(),
      Complaint.countDocuments()
    ]);

    // Monthly stats for the last 12 months
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        year: d.getFullYear(),
        month: d.getMonth()
      });
    }

    // Helper to get start/end of month
    const getMonthRange = (year, month) => {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 1);
      return { start, end };
    };

    // Aggregate monthly data
    const userMonthly = [];
    const chefMonthly = []; // Chef management removed
    const orderMonthly = [];
    const complaintMonthly = [];
    for (const m of months) {
      const { start, end } = getMonthRange(m.year, m.month);
      userMonthly.push(await User.countDocuments({ createdAt: { $gte: start, $lt: end } }));
      chefMonthly.push(0); // Chef management removed
      orderMonthly.push(await Order.countDocuments({ createdAt: { $gte: start, $lt: end } }));
      complaintMonthly.push(await Complaint.countDocuments({ createdAt: { $gte: start, $lt: end } }));
    }

    res.status(200).json({
      totals: {
        users: userCount,
        chefs: 0, // Chef management removed
        orders: orderCount,
        issues: complaintCount
      },
      trends: {
        months: months.map(m => `${m.year}-${String(m.month + 1).padStart(2, '0')}`),
        users: userMonthly,
        chefs: chefMonthly, // Chef management removed
        orders: orderMonthly,
        issues: complaintMonthly
      }
    });
  } catch (err) {
    console.error('Get dashboard stats error:', err);
    res.status(500).json({ message: 'Failed to fetch dashboard stats' });
  }
};
// Admin Logout (JWT-based, stateless)
exports.logout = async (req, res) => {
  // For JWT, logout is handled on the client by deleting the token.
  // Optionally, you can implement token blacklisting here.
  res.status(200).json({ message: 'Logout successful' });
};
const Category = require('../models/categoryModel');
// List all categories (admin action)
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.status(200).json({ categories });
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
};
// Admin Signup
exports.signup = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: 'Name, email, phone, and password are required' });
    }
    // Check if admin already exists
    const existing = await User.findOne({ email, role: 'admin' });
    if (existing) {
      return res.status(400).json({ message: 'Admin with this email already exists' });
    }
    const hash = await bcrypt.hash(password, 10);
    const admin = await User.create({
      name,
      email,
      phone,
      password: hash,
      role: 'admin',
      status: 'Active'
    });
    res.status(201).json({ message: 'Admin account created', user: { id: admin._id, name: admin.name, email: admin.email, phone: admin.phone, role: admin.role } });
  } catch (err) {
    console.error('Admin signup error:', err);
    res.status(500).json({ message: 'Failed to create admin', error: err.message });
  }
};

// Add chef endpoint removed

// --- Admin Complaint Management APIs ---

// List complaints with optional search, filter, pagination
exports.getComplaints = async (req, res) => {
  try {
    const { search = '', status, priority, category, page = 1, limit = 10 } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { complaintId: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (category) query.category = category;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const complaints = await Complaint.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'name email');
    const total = await Complaint.countDocuments(query);
    res.status(200).json({ complaints, total });
  } catch (err) {
    console.error('Get complaints error:', err);
    res.status(500).json({ message: 'Failed to fetch complaints' });
  }
};

// Get single complaint details
exports.getComplaintById = async (req, res) => {
  try {
    let complaint = null;
    const id = req.params.complaintId;
    // Try to find by MongoDB _id if valid, else fallback to complaintId
    if (/^[a-fA-F0-9]{24}$/.test(id)) {
      complaint = await Complaint.findById(id).populate('user', 'name email');
    }
    if (!complaint) {
      // Try to find by complaintId (CMP123456)
      complaint = await Complaint.findOne({ complaintId: id }).populate('user', 'name email');
    }
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }
    res.status(200).json(complaint);
  } catch (err) {
    console.error('Get complaint by id error:', err);
    res.status(500).json({ message: 'Failed to fetch complaint' });
  }
};

// Update complaint (admin action)
exports.updateComplaint = async (req, res) => {
  try {
    const update = req.body;
    const id = req.params.complaintId;
    let complaint = null;
    // Try to update by MongoDB _id if valid, else fallback to complaintId
    if (/^[a-fA-F0-9]{24}$/.test(id)) {
      complaint = await Complaint.findByIdAndUpdate(id, update, { new: true });
    }
    if (!complaint) {
      complaint = await Complaint.findOneAndUpdate({ complaintId: id }, update, { new: true });
    }
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }
    res.status(200).json({ message: 'Complaint updated', complaint });
  } catch (err) {
    console.error('Update complaint error:', err);
    res.status(500).json({ message: 'Failed to update complaint' });
  }
};

// Export complaints (CSV/Excel)
exports.exportComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find().populate('user', 'name email');
    const header = 'ComplaintID,User,Subject,Category,Status,Priority,Submitted\n';
    const rows = complaints.map(c => [
      c.complaintId,
      c.user?.name || '',
      c.subject,
      c.category || '',
      c.status || '',
      c.priority || '',
      c.createdAt ? c.createdAt.toISOString().split('T')[0] : ''
    ].join(','));
    const csv = header + rows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=complaints.csv');
    res.status(200).send(csv);
  } catch (err) {
    console.error('Export complaints error:', err);
    res.status(500).json({ message: 'Failed to export complaints' });
  }
};

// Add complaint (admin action)
exports.addComplaint = async (req, res) => {
  try {
    console.log('addComplaint called. Request body:', req.body);
    const { user, subject, category, status, priority, description } = req.body;
    if (!user || !subject || !category) {
      console.warn('Validation failed. Missing required fields:', { user, subject, category });
      return res.status(400).json({ message: 'User, subject, and category are required' });
    }
    const complaintData = {
      user,
      subject,
      category,
      status: status || 'Open',
      priority: priority || 'Medium',
      description
    };
    console.log('Creating Complaint with data:', complaintData);
    const complaint = await Complaint.create(complaintData);
    console.log('Complaint created successfully:', complaint);
    res.status(201).json({ message: 'Complaint created', complaint });
  } catch (err) {
    console.error('Add complaint error:', err);
    res.status(500).json({ message: 'Failed to add complaint', error: err.message });
  }
};

// --- Admin Menu Item Management APIs ---

// List menu items with optional search, filter, pagination
exports.getMenuItems = async (req, res) => {
  try {
    const { search = '', status, category, page = 1, limit = 10 } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { itemId: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) query.status = status;
    if (category) query.category = category;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const items = await MenuItem.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    const total = await MenuItem.countDocuments(query);
    res.status(200).json({ menuItems: items, total });
  } catch (err) {
    console.error('Get menu items error:', err);
    res.status(500).json({ message: 'Failed to fetch menu items' });
  }
};

// Get single menu item details
exports.getMenuItemById = async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.menuItemId).populate('recommendedItems', 'name');
    if (!item) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    res.status(200).json(item);
  } catch (err) {
    console.error('Get menu item by id error:', err);
    res.status(500).json({ message: 'Failed to fetch menu item' });
  }
};

// Update menu item (admin action)
exports.updateMenuItem = async (req, res) => {
  try {
    const { 
      name,
      description,
      category,
      price,
      discountedPrice,
      image,
      allergens,
      preparationTime,
      status,
      isVeg,
      moodTag,
      hungerLevelTag,
      recommendedItems,
      nutritionInfo,
      specialOffer
    } = req.body;

    // Validate mood and hunger level tags if provided
    const validMoodTags = ['good', 'angry', 'in_love', 'sad'];
    const validHungerLevelTags = ['little_hungry', 'quite_hungry', 'very_hungry', 'super_hungry'];
    
    if (moodTag && !validMoodTags.includes(moodTag)) {
      return res.status(400).json({ message: `Invalid moodTag. Must be one of: ${validMoodTags.join(', ')}` });
    }
    
    if (hungerLevelTag && !validHungerLevelTags.includes(hungerLevelTag)) {
      return res.status(400).json({ message: `Invalid hungerLevelTag. Must be one of: ${validHungerLevelTags.join(', ')}` });
    }

    // Parse recommendedItems first if it's a JSON string (from FormData)
    let parsedRecommendedItems = recommendedItems;
    if (recommendedItems !== undefined) {
      if (typeof recommendedItems === 'string') {
        try {
          parsedRecommendedItems = JSON.parse(recommendedItems);
        } catch (e) {
          console.warn('Failed to parse recommendedItems:', e);
          parsedRecommendedItems = [];
        }
      }
    }

    // Validate recommendedItems exist if provided
    if (parsedRecommendedItems && Array.isArray(parsedRecommendedItems) && parsedRecommendedItems.length > 0) {
      const validItems = await MenuItem.find({ _id: { $in: parsedRecommendedItems } });
      if (validItems.length !== parsedRecommendedItems.length) {
        return res.status(400).json({ message: 'One or more recommended items do not exist' });
      }
    }

    // Build update object with only provided fields
    const update = {};
    if (name !== undefined) update.name = name;
    if (description !== undefined) {
      update.description = typeof description === 'string' 
        ? { text: description, formatting: 'PlainText' } 
        : description;
    }
    if (category !== undefined) update.category = category;
    if (price !== undefined) update.price = price;
    if (discountedPrice !== undefined) update.discountedPrice = discountedPrice;
    
    // Parse allergens if it's a JSON string
    if (allergens !== undefined) {
      if (typeof allergens === 'string') {
        try {
          update.allergens = JSON.parse(allergens);
        } catch (e) {
          console.warn('Failed to parse allergens:', e);
          update.allergens = [];
        }
      } else {
        update.allergens = allergens;
      }
    }
    
    if (preparationTime !== undefined) update.preparationTime = preparationTime;
    if (status !== undefined) update.status = status;
    if (isVeg !== undefined) update.isVeg = isVeg;
    if (moodTag !== undefined) update.moodTag = moodTag;
    if (hungerLevelTag !== undefined) update.hungerLevelTag = hungerLevelTag;
    
    // Use the already parsed recommendedItems
    if (parsedRecommendedItems !== undefined) {
      update.recommendedItems = parsedRecommendedItems;
    }
    
    if (nutritionInfo !== undefined) update.nutritionInfo = nutritionInfo;

    // Parse and add specialOffer if provided
    if (specialOffer !== undefined) {
      if (typeof specialOffer === 'string') {
        try {
          update.specialOffer = JSON.parse(specialOffer);
        } catch (e) {
          console.warn('Failed to parse specialOffer:', e);
          update.specialOffer = null;
        }
      } else {
        update.specialOffer = specialOffer;
      }
    }

    // Handle Cloudinary image URLs from middleware
    if (req.files && req.files.length > 0) {
      update.image = req.files[0].path; // Cloudinary secure_url
    } else if (image !== undefined) {
      update.image = image;
    }

    const item = await MenuItem.findByIdAndUpdate(req.params.menuItemId, update, { new: true });
    if (!item) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    res.status(200).json({ message: 'Menu item updated', item });
  } catch (err) {
    console.error('Update menu item error:', err);
    res.status(500).json({ message: 'Failed to update menu item' });
  }
};

// Export menu items (CSV/Excel)
exports.exportMenuItems = async (req, res) => {
  try {
    const items = await MenuItem.find();
    const header = 'ItemID,Name,Category,Price,Status,SpicyLevel,Rating\n';
    const rows = items.map(i => [
      i.itemId,
      i.name,
      i.category,
      i.price,
      i.status || '',
      i.spicyLevel || '',
      i.rating || ''
    ].join(','));
    const csv = header + rows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=menu_items.csv');
    res.status(200).send(csv);
  } catch (err) {
    console.error('Export menu items error:', err);
    res.status(500).json({ message: 'Failed to export menu items' });
  }
};

// Delete menu item (admin action)
exports.deleteMenuItem = async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndDelete(req.params.menuItemId);
    if (!item) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    res.status(200).json({ message: 'Menu item deleted', item });
  } catch (err) {
    console.error('Delete menu item error:', err);
    res.status(500).json({ message: 'Failed to delete menu item' });
  }
};

// Add menu item (admin action)
exports.addMenuItem = async (req, res) => {
  try {
    console.log('addMenuItem called. Request body:', req.body);
    const { 
      name, 
      description, 
      category, 
      price, 
      discountedPrice,
      image,
      allergens,
      preparationTime,
      status, 
      isVeg,
      moodTag,
      hungerLevelTag,
      recommendedItems,
      nutritionInfo,
      specialOffer
    } = req.body;
    
    // Validate required fields
    if (!name || !category || !price || !description) {
      console.warn('Validation failed. Missing required fields:', { name, category, price, description });
      return res.status(400).json({ message: 'Name, category, price, and description are required' });
    }

    // Validate mood and hunger level tags if provided
    const validMoodTags = ['good', 'angry', 'in_love', 'sad'];
    const validHungerLevelTags = ['little_hungry', 'quite_hungry', 'very_hungry', 'super_hungry'];
    
    if (moodTag && !validMoodTags.includes(moodTag)) {
      return res.status(400).json({ message: `Invalid moodTag. Must be one of: ${validMoodTags.join(', ')}` });
    }
    
    if (hungerLevelTag && !validHungerLevelTags.includes(hungerLevelTag)) {
      return res.status(400).json({ message: `Invalid hungerLevelTag. Must be one of: ${validHungerLevelTags.join(', ')}` });
    }

    // Parse allergens and recommendedItems if they are JSON strings
    let parsedAllergens = allergens || [];
    if (typeof allergens === 'string') {
      try {
        parsedAllergens = JSON.parse(allergens);
      } catch (e) {
        console.warn('Failed to parse allergens:', e);
        parsedAllergens = [];
      }
    }

    let parsedRecommendedItems = recommendedItems || [];
    if (typeof recommendedItems === 'string') {
      try {
        parsedRecommendedItems = JSON.parse(recommendedItems);
      } catch (e) {
        console.warn('Failed to parse recommendedItems:', e);
        parsedRecommendedItems = [];
      }
    }

    let parsedSpecialOffer = null;
    if (specialOffer) {
      try {
        parsedSpecialOffer = typeof specialOffer === 'string' ? JSON.parse(specialOffer) : specialOffer;
      } catch (e) {
        console.warn('Failed to parse specialOffer:', e);
      }
    }

    // Validate recommendedItems exist if provided
    if (parsedRecommendedItems && parsedRecommendedItems.length > 0) {
      const validItems = await MenuItem.find({ _id: { $in: parsedRecommendedItems } });
      if (validItems.length !== parsedRecommendedItems.length) {
        return res.status(400).json({ message: 'One or more recommended items do not exist' });
      }
    }

    // Handle Cloudinary image URLs from middleware
    let imageUrl = image;
    if (req.files && req.files.length > 0) {
      // Cloudinary middleware will store uploaded file info in req.files
      imageUrl = req.files[0].path; // Cloudinary secure_url
    }
    
    const itemData = {
      name,
      description: typeof description === 'string' ? { text: description, formatting: 'PlainText' } : description,
      category,
      price,
      discountedPrice,
      image: imageUrl || 'https://via.placeholder.com/300',
      allergens: parsedAllergens,
      preparationTime: preparationTime || 30,
      status: status || 'Available',
      isVeg: isVeg !== undefined ? isVeg : true,
      moodTag: moodTag || null,
      hungerLevelTag: hungerLevelTag || null,
      recommendedItems: parsedRecommendedItems,
      specialOffer: parsedSpecialOffer,
      nutritionInfo: nutritionInfo || {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
      }
    };
    
    console.log('Creating MenuItem with data:', itemData);
    const item = await MenuItem.create(itemData);
    console.log('Menu item created successfully:', item);
    res.status(201).json({ message: 'Menu item created', item });
  } catch (err) {
    console.error('Add menu item error:', err);
    res.status(500).json({ message: 'Failed to add menu item', error: err.message });
  }
};

// --- Admin Order Management APIs ---

// List orders with optional search, filter, pagination
exports.getOrders = async (req, res) => {
  try {
    const { search = '', status, paymentStatus, page = 1, limit = 10 } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { 'user.name': { $regex: search, $options: 'i' } },
        { 'chef.name': { $regex: search, $options: 'i' } }
      ];
    }
    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'name email')
      .populate('chef', 'name email');
    const total = await Order.countDocuments(query);
    res.status(200).json({ orders, total });
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
};

// Get single order details
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('user', 'name email phone')
      .populate('chef', 'name email kitchenName');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.status(200).json(order);
  } catch (err) {
    console.error('Get order by id error:', err);
    res.status(500).json({ message: 'Failed to fetch order' });
  }
};

// Update order status (admin action)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, paymentStatus } = req.body;
    const update = {};
    if (status) update.status = status;
    if (paymentStatus) update.paymentStatus = paymentStatus;
    const order = await Order.findByIdAndUpdate(req.params.orderId, update, { new: true });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.status(200).json({ message: 'Order updated', order });
  } catch (err) {
    console.error('Update order status error:', err);
    res.status(500).json({ message: 'Failed to update order' });
  }
};

// Export orders (CSV/Excel)
exports.exportOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name email')
      .populate('chef', 'name email');
    const header = 'OrderID,User,Chef,Items,Total,Status,Ordered At,Delivery Address,Payment Method,Payment Status\n';
    const rows = orders.map(o => [
      o.orderId,
      o.user?.name || '',
      o.chef?.name || '',
      o.items ? o.items.map(i => `${i.name} x ${i.quantity}`).join(' | ') : '',
      o.total || 0,
      o.status || '',
      o.createdAt ? o.createdAt.toISOString() : '',
      o.deliveryAddress || '',
      o.paymentMethod || '',
      o.paymentStatus || ''
    ].join(','));
    const csv = header + rows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
    res.status(200).send(csv);
  } catch (err) {
    console.error('Export orders error:', err);
    res.status(500).json({ message: 'Failed to export orders' });
  }
};
// Chef listing endpoints removed — delegated to chef service

// Admin chef management removed
// --- Admin User Management APIs ---

// List users with optional search, filter, pagination
exports.getUsers = async (req, res) => {
  try {
    const { search = '', status, dietPreference, eatingPreference, tier, page = 1, limit = 10 } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) {
      query.status = status;
    }
    if (dietPreference) {
      query['dietPreference'] = dietPreference;
    }
    if (eatingPreference) {
      query['eatingPreference'] = eatingPreference;
    }
    if (tier) {
      query.tier = tier;
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    const total = await User.countDocuments(query);
    res.status(200).json({ users, total });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};

// Get single user details
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(user);
  } catch (err) {
    console.error('Get user by id error:', err);
    res.status(500).json({ message: 'Failed to fetch user' });
  }
};

// Update user (status, preferences, etc.)
exports.updateUser = async (req, res) => {
  try {
    const { status, preferences, ...rest } = req.body;
    const update = { ...rest };
    if (status) update.status = status;
    if (preferences) update.preferences = preferences;
    const user = await User.findByIdAndUpdate(req.params.userId, update, { new: true }).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ message: 'User updated', user });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ message: 'Failed to update user' });
  }
};

// Export users (CSV/Excel)
exports.exportUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    // For simplicity, export as CSV string
    const header = 'Name,Email,Phone,Status,Orders,Registered On\n';
    const rows = users.map(u => [
      u.name,
      u.email,
      u.phone,
      u.status || '',
      u.ordersCount || 0,
      u.createdAt ? u.createdAt.toISOString().split('T')[0] : ''
    ].join(','));
    const csv = header + rows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
    res.status(200).send(csv);
  } catch (err) {
    console.error('Export users error:', err);
    res.status(500).json({ message: 'Failed to export users' });
  }
};

// Add user (admin action)
exports.addUser = async (req, res) => {
  try {
    const { name, email, phone, password, preferences, status, dietPreference, eatingPreference } = req.body;
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: 'Name, email, phone, and password are required' });
    }
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }
    const hash = await bcrypt.hash(password, 10);
    const userData = {
      name,
      email,
      phone,
      password: hash,
      preferences,
      status: status || 'Active'
    };
    if (dietPreference) userData.dietPreference = dietPreference;
    if (eatingPreference) userData.eatingPreference = eatingPreference;
    const user = await User.create(userData);
    res.status(201).json({ message: 'User created', user: { ...user.toObject(), password: undefined } });
  } catch (err) {
    console.error('Add user error:', err);
    res.status(500).json({ message: 'Failed to add user' });
  }
};


// Admin Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("Admin login attempt:", email);
    
    if (!email || !password) {
      console.log("Email or password is not provided")
      return res.status(400).json({ message: "Email and password are required" });
    }
    
    // Find admin user by email
    const admin = await User.findOne({ email, role: { $in: ['admin'] } });
    
    if (!admin) {
      console.log("Admin not found")
      return res.status(401).json({ message: "Invalid email or password" });
    }
    
    // Check if password is correct
    const isMatch = await bcrypt.compare(password, admin.password);
    
    if (!isMatch) {
      console.log("Password is incorrect")
      return res.status(401).json({ message: "Invalid email or password" });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log("Token generated")
    
    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        profilePicture: admin.profilePicture
      }
    });
  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({ message: "Login failed", error: err.message });
  }
};

// Get admin profile
exports.getProfile = async (req, res) => {
  try {
    const admin = await User.findById(req.user.id).select('-password');
    
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }
    
    res.status(200).json({
      user: admin
    });
  } catch (err) {
    console.error("Get admin profile error:", err);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};

// Change password - Updated to fix the password comparison issue
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }
    
    // Explicitly include the password field
    const admin = await User.findById(req.user.id).select('+password');
    
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }
    
    // Make sure we have a password to compare against
    if (!admin.password) {
      return res.status(401).json({ message: "Password reset required. Contact system administrator." });
    }
    
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(newPassword, salt);
    
    await admin.save();
    
    res.status(200).json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ message: "Failed to change password" });
  }
};

// --- Admin Dashboard Metrics & Moderation APIs ---

// Get overview metrics for dashboard
exports.getOverviewMetrics = async (req, res) => {
  try {
    const [userCount, orderCount, complaintCount] = await Promise.all([
      User.countDocuments(),
      Order.countDocuments(),
      Complaint.countDocuments()
    ]);
    // Calculate change since yesterday for each metric
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const [usersYesterday, ordersYesterday, issuesYesterday] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: yesterday, $lt: today } }),
      Order.countDocuments({ createdAt: { $gte: yesterday, $lt: today } }),
      Complaint.countDocuments({ createdAt: { $gte: yesterday, $lt: today } })
    ]);

    res.status(200).json({
      users: userCount,
      chefs: 0, // Chef management removed
      orders: orderCount,
      pendingChefVerifications: 0, // Chef management removed
      pendingReviews: 0, // Review management removed
      complaints: complaintCount,
      usersChange: usersYesterday,
      chefsChange: 0, // Chef management removed
      ordersChange: ordersYesterday,
      issuesChange: issuesYesterday
    });
  } catch (err) {
    console.error('Get overview metrics error:', err);
    res.status(500).json({ message: 'Failed to fetch metrics' });
  }
};

// Get recent orders (limit 10)
exports.getRecentOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('user', 'name');
    res.status(200).json({
      message: 'Recent orders fetched successfully',
      success: true,
      orders
    });
  } catch (err) {
    console.error('Get recent orders error:', err);
    res.status(500).json({ message: 'Failed to fetch recent orders', success: false });
  }
};

// Chef verification endpoints removed — chef lifecycle handled separately

// Get reviews pending moderation
exports.getReviewsPendingModeration = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const reviews = await Review.find({ status: 'Pending' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'name email')
      .populate('chef', 'name email');
    const total = await Review.countDocuments({ status: 'Pending' });
    res.status(200).json({ reviews, total });
  } catch (err) {
    console.error('Get reviews pending moderation error:', err);
    res.status(500).json({ message: 'Failed to fetch reviews' });
  }
};

// Approve review
exports.approveReview = async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(req.params.reviewId, { status: 'Approved' }, { new: true });
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    res.status(200).json({ message: 'Review approved', review });
  } catch (err) {
    console.error('Approve review error:', err);
    res.status(500).json({ message: 'Failed to approve review' });
  }
};

// Reject review
exports.rejectReview = async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(req.params.reviewId, { status: 'Rejected' }, { new: true });
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    res.status(200).json({ message: 'Review rejected', review });
  } catch (err) {
    console.error('Reject review error:', err);
    res.status(500).json({ message: 'Failed to reject review' });
  }
};

// Export all functions at the end of the file
module.exports = {
  registerAdmin: exports.registerAdmin,
  loginAdmin: exports.loginAdmin,
  getDashboardStats: exports.getDashboardStats,
  getRevenueStats: exports.getRevenueStats,
  getOrderStats: exports.getOrderStats,
  getUserStats: exports.getUserStats,
  getAllUsers: exports.getAllUsers,
  getUserById: exports.getUserById,
  updateUser: exports.updateUser,
  deleteUser: exports.deleteUser,
  getAllRestaurants: exports.getAllRestaurants,
  getRestaurantById: exports.getRestaurantById,
  approveRestaurant: exports.approveRestaurant,
  suspendRestaurant: exports.suspendRestaurant,
  deleteRestaurant: exports.deleteRestaurant,
  getReports: exports.getReports,
  getAnalytics: exports.getAnalytics,
  getRecentReviews: exports.getRecentReviews,
  getReviews: exports.getReviews,
  approveReview: exports.approveReview,
  rejectReview: exports.rejectReview,
  exportAnalytics: exports.exportAnalytics,
  getDashboardAnalytics: exports.getDashboardAnalytics,
  deleteComplaint: exports.deleteComplaint,
  getAllOrders: exports.getAllOrders,
  getOrders: exports.getOrders,
  getOrderById: exports.getOrderById,
  updateOrderStatus: exports.updateOrderStatus,
  exportOrders: exports.exportOrders,
  getStats: exports.getStats,
  logout: exports.logout,
  getCategories: exports.getCategories,
  signup: exports.signup,
  login: exports.login,
  getProfile: exports.getProfile,
  changePassword: exports.changePassword,
  getComplaints: exports.getComplaints,
  getComplaintById: exports.getComplaintById,
  updateComplaint: exports.updateComplaint,
  exportComplaints: exports.exportComplaints,
  addComplaint: exports.addComplaint,
  getMenuItems: exports.getMenuItems,
  getMenuItemById: exports.getMenuItemById,
  updateMenuItem: exports.updateMenuItem,
  addMenuItem: exports.addMenuItem,
  deleteMenuItem: exports.deleteMenuItem,
  exportMenuItems: exports.exportMenuItems,
  getUsers: exports.getUsers,
  getUserById: exports.getUserById,
  updateUser: exports.updateUser,
  exportUsers: exports.exportUsers,
  addUser: exports.addUser,
  getReviewsPendingModeration: exports.getReviewsPendingModeration,
  getRecentOrders: exports.getRecentOrders,
  getOverviewMetrics: exports.getOverviewMetrics
};
;