const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const walletController = require('../controllers/walletController');
const { verifyAdmin } = require('../middlewares/adminAuth');
const { validateRegistration } = require('../middlewares/validation');
const { uploadMenuItemPhoto } = require('../config/cloudinary');
const { uploadSingleVideo, handleMulterError } = require('../middlewares/upload');

// Import analytics routes
const analyticsRoutes = require('./analyticsRoutes');

// Admin authentication routes (public)
router.post('/register', validateRegistration, adminController.registerAdmin);
router.post('/login', adminController.loginAdmin);

// All other routes require admin authentication
// router.use(verifyAdmin);

// Dashboard routes
// router.get('/dashboard/stats', adminController.getDashboardStats);
router.get('/dashboard/revenue', adminController.getRevenueStats);
router.get('/dashboard/orders', adminController.getOrderStats);
router.get('/dashboard/users', adminController.getUserStats);

// User management
router.get('/users', adminController.getAllUsers);
router.get('/users/:id', adminController.getUserById);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

// Guest user stats
router.get('/guest-stats', verifyAdmin, async (req, res) => {
  try {
    const { getGuestStats } = require('../services/guestService');
    const stats = await getGuestStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// Restaurant management
router.get('/restaurants', adminController.getAllRestaurants);
router.get('/restaurants/:id', adminController.getRestaurantById);
router.put('/restaurants/:id/approve', adminController.approveRestaurant);
router.put('/restaurants/:id/suspend', adminController.suspendRestaurant);
router.delete('/restaurants/:id', adminController.deleteRestaurant);

// Content management
router.get('/reports', adminController.getReports);
router.get('/analytics', adminController.getAnalytics);

// Analytics routes (KPI Dashboard)
router.use('/analytics', analyticsRoutes);

// --- Category Management (Admin Categories Tab) ---
// List all categories
router.get('/categories', verifyAdmin, adminController.getCategories);


// --- Category Management (Admin Categories Tab) ---
// List all categories
// router.get('/categories', verifyAdmin, adminController.getCategories);

// Export users (CSV/Excel) - must be above /users/:userId
// router.get('/users-export', verifyAdmin, adminController.exportUsers);

// Review moderation routes
// router.get('/reviews', verifyAdmin, adminController.getReviews);
// router.post('/reviews/:reviewId/approve', verifyAdmin, adminController.approveReview);
// router.post('/reviews/:reviewId/reject', verifyAdmin, adminController.rejectReview);
// Recent Reviews
// router.get('/recent-reviews', verifyAdmin, adminController.getRecentReviews);

// --- Menu Item Management (Admin Menu Items Tab) ---
// List menu items with optional search, filter, pagination
router.get('/menu-items', verifyAdmin, adminController.getMenuItems);

// Get single menu item details
router.get('/menu-items/:menuItemId', verifyAdmin, adminController.getMenuItemById);

// Add menu item (admin action) with image upload
router.post('/menu-items', verifyAdmin, uploadMenuItemPhoto.array('images', 5), adminController.addMenuItem);

// Update menu item (admin action) with image upload
router.put('/menu-items/:menuItemId', verifyAdmin, uploadMenuItemPhoto.array('images', 5), adminController.updateMenuItem);

// Delete menu item (admin action)
router.delete('/menu-items/:menuItemId', verifyAdmin, adminController.deleteMenuItem);

// Export menu items (CSV/Excel)
router.get('/menu-items-export', verifyAdmin, adminController.exportMenuItems);

// Dashboard Stats (chart and summary data)
router.get('/stats', verifyAdmin, adminController.getStats);

// --- Complaint Management (Admin Complaints Tab) ---
// List complaints with optional search, filter, pagination
router.get('/complaints', verifyAdmin, adminController.getComplaints);

// Add complaint (admin action)
router.post('/complaints', verifyAdmin, adminController.addComplaint);

// Get single complaint details
router.get('/complaints/:complaintId', verifyAdmin, adminController.getComplaintById);

// Update complaint (admin action)
router.put('/complaints/:complaintId', verifyAdmin, adminController.updateComplaint);

// Delete complaint (admin action)
router.delete('/complaints/:complaintId', verifyAdmin, adminController.deleteComplaint);

// Export complaints (CSV/Excel)
router.get('/complaints-export', verifyAdmin, adminController.exportComplaints);


// Overview Metrics
router.get('/overview', verifyAdmin, adminController.getOverviewMetrics);

// Dashboard Analytics (single API for all analytics data)
router.get('/dashboard-analytics', verifyAdmin, adminController.getDashboardAnalytics);

// Export analytics data (CSV)
router.get('/analytics-export', verifyAdmin, adminController.exportAnalytics);

// Recent Orders
router.get('/recent-orders', verifyAdmin, adminController.getRecentOrders);

// List all orders sorted from newest to oldest
router.get('/all-orders', verifyAdmin, adminController.getAllOrders);

// Get single order details
router.get('/orders/:orderId', verifyAdmin, adminController.getOrderById);


// Reviews Pending Moderation
router.get('/reviews-pending', verifyAdmin, adminController.getReviewsPendingModeration);
router.put('/reviews/:reviewId/approve', verifyAdmin, adminController.approveReview);
router.put('/reviews/:reviewId/reject', verifyAdmin, adminController.rejectReview);

// Update order status (admin action)
router.put('/orders/:orderId', verifyAdmin, adminController.updateOrderStatus);

// Export orders (CSV/Excel)
router.get('/orders-export', verifyAdmin, adminController.exportOrders);

// --- User Management (Admin Users Tab) ---


// List users with optional search, filter, pagination
router.get('/users', verifyAdmin, adminController.getUsers);

// Add user (admin action)
router.post('/users', verifyAdmin, adminController.addUser);

// Get single user details
router.get('/users/:userId', verifyAdmin, adminController.getUserById);

// Update user (status, preferences, etc.)
router.put('/users/:userId', verifyAdmin, adminController.updateUser);

// Overview Metrics
router.get('/overview', verifyAdmin, adminController.getOverviewMetrics);

// Recent Orders
router.get('/recent-orders', verifyAdmin, adminController.getRecentOrders);

// Reviews Pending Moderation
router.get('/reviews-pending', verifyAdmin, adminController.getReviewsPendingModeration);
router.put('/reviews/:reviewId/approve', verifyAdmin, adminController.approveReview);
router.put('/reviews/:reviewId/reject', verifyAdmin, adminController.rejectReview);

// User addresses
router.get('/users/:userId/locations', verifyAdmin, adminController.getUserAddresses);

// User cancelled orders
router.get('/users/:userId/cancelled-orders', verifyAdmin, adminController.getUserCancelledOrders);

// Abandoned carts
router.get('/carts/abandoned', verifyAdmin, adminController.getAbandonedCarts);

// --- Wallet Management ---
// Get specific user's wallet details
router.get('/wallet/user/:userId', verifyAdmin, walletController.getUserWallet);

// Add bonus to user wallet
router.post('/wallet/add-bonus', verifyAdmin, walletController.addWalletBonus);

// Deduct amount from user wallet
router.post('/wallet/deduct', verifyAdmin, walletController.deductWalletAmount);

// Get platform-wide wallet statistics
router.get('/wallet/stats', verifyAdmin, walletController.getWalletStats);

// Search users by name or phone number
router.get('/wallet/search', verifyAdmin, walletController.searchUsers);

// --- Video Management ---
// Upload video to menu item
router.post('/menu-items/:menuItemId/video', verifyAdmin, uploadSingleVideo, handleMulterError, adminController.uploadMenuItemVideo);

// Delete video from menu item
router.delete('/menu-items/:menuItemId/video', verifyAdmin, adminController.deleteMenuItemVideo);

module.exports = router;
