const express = require('express');
const router = express.Router();
const {
  // Phase 1 - Critical Business Metrics
  getOrderOverview,
  getAbandonedCarts,
  getRevenueOverview,
  getUserOverview,
  getTopSellingProducts,
  getProductCategoryPerformance,
  
  // Phase 2 - User Behavior & Engagement
  getUserDemographics,
  getUserRetention,
  getSessionAnalytics,
  getFavoritesAnalytics,
  getLoyaltyAnalytics,
  
  // Phase 3 - Advanced Analytics
  getCustomerLifetimeValue,
  getGenderTrends,
  getHighValueCustomers,
  getTimeToSecondOrder,
  getPeakOrderTimes,
  getSearchAnalytics,
  getCustomizationAnalytics,
  getSubscriptionAnalytics,
  getPushNotificationAnalytics
} = require('../controllers/analyticsController');

// Middleware to verify admin token (reuse from admin routes)
const { verifyAdmin } = require('../middlewares/adminAuth');

// Apply admin verification to all analytics routes
router.use(verifyAdmin);

// ====================
// ORDER ANALYTICS ROUTES
// ====================

/**
 * @route GET /api/admin/analytics/orders/overview
 * @desc Get comprehensive order metrics (total orders, completion rate, AOV, basket size, etc.)
 * @query {string} period - Time period (1d, 7d, 30d, 90d, 1y) default: 30d
 * @access Admin
 */
router.get('/orders/overview', getOrderOverview);

/**
 * @route GET /api/admin/analytics/orders/abandoned-carts
 * @desc Get abandoned cart metrics and recovery rates
 * @query {string} period - Time period (1d, 7d, 30d, 90d, 1y) default: 30d
 * @access Admin
 */
router.get('/orders/abandoned-carts', getAbandonedCarts);

// ====================
// REVENUE ANALYTICS ROUTES
// ====================

/**
 * @route GET /api/admin/analytics/revenue/overview
 * @desc Get revenue metrics (GMV, net revenue, discounts, refunds)
 * @query {string} period - Time period (1d, 7d, 30d, 90d, 1y) default: 30d
 * @access Admin
 */
router.get('/revenue/overview', getRevenueOverview);

// ====================
// USER ANALYTICS ROUTES
// ====================

/**
 * @route GET /api/admin/analytics/users/overview
 * @desc Get user metrics (active users, new vs returning, demographics)
 * @query {string} period - Time period (1d, 7d, 30d, 90d, 1y) default: 30d
 * @access Admin
 */
router.get('/users/overview', getUserOverview);

// ====================
// PRODUCT ANALYTICS ROUTES
// ====================

/**
 * @route GET /api/admin/analytics/products/top-selling
 * @desc Get top-selling products by revenue
 * @query {string} period - Time period (1d, 7d, 30d, 90d, 1y) default: 30d
 * @query {number} limit - Number of products to return (default: 10)
 * @access Admin
 */
router.get('/products/top-selling', getTopSellingProducts);

/**
 * @route GET /api/admin/analytics/products/category-performance
 * @desc Get performance metrics by product category
 * @query {string} period - Time period (1d, 7d, 30d, 90d, 1y) default: 30d
 * @access Admin
 */
router.get('/products/category-performance', getProductCategoryPerformance);

// ====================
// PHASE 2: USER BEHAVIOR & ENGAGEMENT ANALYTICS
// ====================

/**
 * @route GET /api/admin/analytics/users/demographics
 * @desc Get detailed user demographics (age, gender, location, device)
 * @query {string} period - Time period (1d, 7d, 30d, 90d, 1y) default: 30d
 * @access Admin
 */
router.get('/users/demographics', getUserDemographics);

/**
 * @route GET /api/admin/analytics/users/retention
 * @desc Get user retention rates and cohort analysis
 * @query {string} period - Time period (1d, 7d, 30d, 90d, 1y) default: 30d
 * @access Admin
 */
router.get('/users/retention', getUserRetention);

/**
 * @route GET /api/admin/analytics/engagement/sessions
 * @desc Get session analytics (duration, page views, bounce rate)
 * @query {string} period - Time period (1d, 7d, 30d, 90d, 1y) default: 30d
 * @access Admin
 */
router.get('/engagement/sessions', getSessionAnalytics);

/**
 * @route GET /api/admin/analytics/engagement/favorites
 * @desc Get favorites analytics (most favorited products, trends)
 * @query {string} period - Time period (1d, 7d, 30d, 90d, 1y) default: 30d
 * @access Admin
 */
router.get('/engagement/favorites', getFavoritesAnalytics);

/**
 * @route GET /api/admin/analytics/loyalty/overview
 * @desc Get loyalty program analytics (enrollment, tiers, points, referrals)
 * @query {string} period - Time period (1d, 7d, 30d, 90d, 1y) default: 30d
 * @access Admin
 */
router.get('/loyalty/overview', getLoyaltyAnalytics);

// ====================
// PHASE 3: ADVANCED ANALYTICS ROUTES
// ====================

/**
 * @route GET /api/admin/analytics/advanced/ltv
 * @desc Get Customer Lifetime Value (LTV) analysis
 * @query {string} period - Time period (1d, 7d, 30d, 90d, 1y) default: 90d
 * @access Admin
 */
router.get('/advanced/ltv', getCustomerLifetimeValue);

/**
 * @route GET /api/admin/analytics/advanced/gender-trends
 * @desc Get gender-item-day trends and preferences
 * @query {string} period - Time period (1d, 7d, 30d, 90d, 1y) default: 30d
 * @access Admin
 */
router.get('/advanced/gender-trends', getGenderTrends);

/**
 * @route GET /api/admin/analytics/advanced/high-value-customers
 * @desc Get high-value customers analysis (Pareto 80/20)
 * @query {string} period - Time period (1d, 7d, 30d, 90d, 1y) default: 90d
 * @access Admin
 */
router.get('/advanced/high-value-customers', getHighValueCustomers);

/**
 * @route GET /api/admin/analytics/advanced/time-to-second-order
 * @desc Get time-to-second-order distribution
 * @query {string} period - Time period (1d, 7d, 30d, 90d, 1y) default: 90d
 * @access Admin
 */
router.get('/advanced/time-to-second-order', getTimeToSecondOrder);

/**
 * @route GET /api/admin/analytics/advanced/subscriptions
 * @desc Get subscription and pre-booking uptake analytics
 * @query {string} period - Time period (1d, 7d, 30d, 90d, 1y) default: 30d
 * @access Admin
 */
router.get('/advanced/subscriptions', getSubscriptionAnalytics);

/**
 * @route GET /api/admin/analytics/orders/peak-times
 * @desc Get peak order times heatmap data
 * @query {string} period - Time period (1d, 7d, 30d, 90d, 1y) default: 30d
 * @access Admin
 */
router.get('/orders/peak-times', getPeakOrderTimes);

/**
 * @route GET /api/admin/analytics/products/search-analytics
 * @desc Get search analytics (search terms, failed searches, conversion)
 * @query {string} period - Time period (1d, 7d, 30d, 90d, 1y) default: 30d
 * @access Admin
 */
router.get('/products/search-analytics', getSearchAnalytics);

/**
 * @route GET /api/admin/analytics/products/customization-usage
 * @desc Get product customization usage analytics
 * @query {string} period - Time period (1d, 7d, 30d, 90d, 1y) default: 30d
 * @access Admin
 */
router.get('/products/customization-usage', getCustomizationAnalytics);

/**
 * @route GET /api/admin/analytics/engagement/push-notifications
 * @desc Get push notification performance metrics
 * @query {string} period - Time period (1d, 7d, 30d, 90d, 1y) default: 30d
 * @access Admin
 */
router.get('/engagement/push-notifications', getPushNotificationAnalytics);

module.exports = router;