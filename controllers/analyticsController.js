const Order = require('../models/orderModel');
const User = require('../models/userModel');
const MenuItem = require('../models/menuItemModel');
const Cart = require('../models/cartModel');
const KPICache = require('../models/kpiCacheModel');
const SessionAnalytics = require('../models/sessionAnalyticsModel');
const ProductAnalytics = require('../models/productAnalyticsModel');

// Helper function to get date range
const getDateRange = (period = '30d') => {
  const now = new Date();
  let startDate = new Date();

  switch (period) {
    case '1d':
      startDate.setDate(now.getDate() - 1);
      break;
    case '7d':
      startDate.setDate(now.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(now.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(now.getDate() - 90);
      break;
    case '1y':
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    default:
      startDate.setDate(now.getDate() - 30);
  }

  return { startDate, endDate: now };
};

// Helper function to calculate percentage change
const calculateChange = (current, previous) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

// Cache helper functions
const getCachedMetric = async (metricKey) => {
  return await KPICache.getValidCache(metricKey);
};

const setCachedMetric = async (metricKey, metricName, value, breakdown = {}, trend = [], cacheType = 'daily') => {
  const { startDate, endDate } = getDateRange('30d');

  // Calculate validity period based on cache type
  let validUntil = new Date();
  switch (cacheType) {
    case 'realtime':
      validUntil.setMinutes(validUntil.getMinutes() + 5);
      break;
    case 'hourly':
      validUntil.setHours(validUntil.getHours() + 1);
      break;
    case 'daily':
      validUntil.setDate(validUntil.getDate() + 1);
      break;
    case 'weekly':
      validUntil.setDate(validUntil.getDate() + 7);
      break;
    case 'monthly':
      validUntil.setMonth(validUntil.getMonth() + 1);
      break;
  }

  await KPICache.findOneAndUpdate(
    { metricKey },
    {
      metricName,
      metricValue: value,
      breakdown,
      trend,
      dateRange: { start: startDate, end: endDate },
      calculatedAt: new Date(),
      validUntil,
      cacheType,
      isValid: true
    },
    { upsert: true, new: true }
  );

  return { value, breakdown, trend };
};

// ====================
// ORDER ANALYTICS
// ====================

// Get order overview metrics
const getOrderOverview = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const { startDate, endDate } = getDateRange(period);
    const cacheKey = `orders_overview_${period}`;

    // Check cache first
    const cached = await getCachedMetric(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached.metricValue,
        breakdown: cached.breakdown,
        trend: cached.trend,
        cached: true,
        metadata: {
          dateRange: { start: startDate, end: endDate },
          calculatedAt: cached.calculatedAt
        }
      });
    }

    // Calculate metrics
    const orders = await Order.find({
      createdAt: { $gte: startDate, $lte: endDate }
    });

    const totalOrders = orders.length;
    const completedOrders = orders.filter(o => o.status === 'delivered').length;
    const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
    const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

    // Calculate average order value
    const totalRevenue = orders
      .filter(o => o.status === 'delivered')
      .reduce((sum, order) => sum + (order.billing?.totalAmount || 0), 0);
    const averageOrderValue = completedOrders > 0 ? totalRevenue / completedOrders : 0;

    // Basket size
    const totalItems = orders.reduce((sum, order) =>
      sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
    const basketSize = totalOrders > 0 ? totalItems / totalOrders : 0;

    // Day part distribution
    const dayPartBreakdown = orders.reduce((acc, order) => {
      const dayPart = order.dayPart || 'dinner';
      acc[dayPart] = (acc[dayPart] || 0) + 1;
      return acc;
    }, {});

    // Order type breakdown
    const orderTypeBreakdown = orders.reduce((acc, order) => {
      const type = order.orderType === 'on_site_dining' ? 'pickup' : 'delivery';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    const metrics = {
      totalOrders,
      completedOrders,
      cancelledOrders,
      completionRate: Math.round(completionRate * 100) / 100,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      basketSize: Math.round(basketSize * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100
    };

    const breakdown = {
      dayPart: dayPartBreakdown,
      orderType: orderTypeBreakdown,
      status: {
        completed: completedOrders,
        cancelled: cancelledOrders,
        pending: totalOrders - completedOrders - cancelledOrders
      }
    };

    // Calculate first-time vs repeat order rates (percentage of orders placed by new customers vs returning)
    try {
      const customerOrderAgg = await Order.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: '$user', ordersInPeriod: { $sum: 1 } } },
        { $lookup: {
            from: 'orders',
            let: { uid: '$_id' },
            pipeline: [
              // Only consider prior orders that were delivered before the period (use deliveredAt)
              { $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$user', '$$uid'] },
                      { $lt: ['$deliveredAt', startDate] }
                    ]
                  },
                  status: 'delivered'
              } },
              { $limit: 1 }
            ],
            as: 'priorOrders'
        } },
        { $project: { ordersInPeriod: 1, hasPrior: { $gt: [ { $size: '$priorOrders' }, 0 ] } } },
        { $group: {
          _id: null,
          totalOrders: { $sum: '$ordersInPeriod' },
          ordersByNewCustomers: { $sum: { $cond: [ { $eq: ['$hasPrior', false] }, '$ordersInPeriod', 0 ] } },
          ordersByReturningCustomers: { $sum: { $cond: [ { $eq: ['$hasPrior', true] }, '$ordersInPeriod', 0 ] } }
        } }
      ]);

      const custStats = customerOrderAgg[0] || { totalOrders: 0, ordersByNewCustomers: 0, ordersByReturningCustomers: 0 };
      const firstTimeRate = custStats.totalOrders > 0 ? (custStats.ordersByNewCustomers / custStats.totalOrders) * 100 : 0;
      const repeatRate = custStats.totalOrders > 0 ? (custStats.ordersByReturningCustomers / custStats.totalOrders) * 100 : 0;

      metrics.firstTimeOrderRate = Math.round(firstTimeRate * 100) / 100;
      metrics.repeatOrderRate = Math.round(repeatRate * 100) / 100;

      breakdown.ordersByCustomerType = {
        totalOrders: custStats.totalOrders,
        ordersByNewCustomers: custStats.ordersByNewCustomers,
        ordersByReturningCustomers: custStats.ordersByReturningCustomers
      };
    } catch (e) {
      // If aggregation fails for any reason, ensure metrics still return without these fields
      console.error('Error computing first-time/repeat order rates:', e);
      metrics.firstTimeOrderRate = 0;
      metrics.repeatOrderRate = 0;
      breakdown.ordersByCustomerType = { totalOrders: 0, ordersByNewCustomers: 0, ordersByReturningCustomers: 0 };
    }

    // Cache the results
    await setCachedMetric(cacheKey, 'Order Overview', metrics, breakdown, [], 'hourly');

    res.json({
      success: true,
      data: metrics,
      breakdown,
      metadata: {
        dateRange: { start: startDate, end: endDate },
        calculatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error in getOrderOverview:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get abandoned cart metrics
const getAbandonedCarts = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const { startDate, endDate } = getDateRange(period);
    const cacheKey = `abandoned_carts_${period}`;

    const cached = await getCachedMetric(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached.metricValue,
        breakdown: cached.breakdown,
        cached: true,
        metadata: {
          dateRange: { start: startDate, end: endDate },
          calculatedAt: cached.calculatedAt
        }
      });
    }

    // Get abandoned cart statistics
    const abandonedStats = await Cart.aggregate([
      {
        $match: {
          status: 'abandoned',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalAbandonedCarts: { $sum: 1 },
          totalAbandonedValue: { $sum: '$totalAmount' },
          avgCartValue: { $avg: '$totalAmount' },
          recovered: {
            $sum: { $cond: [{ $eq: ['$convertedToOrder', true] }, 1, 0] }
          },
          recoveredValue: {
            $sum: {
              $cond: [
                { $eq: ['$convertedToOrder', true] },
                '$totalAmount',
                0
              ]
            }
          }
        }
      }
    ]);

    const stats = abandonedStats[0] || {
      totalAbandonedCarts: 0,
      totalAbandonedValue: 0,
      avgCartValue: 0,
      recovered: 0,
      recoveredValue: 0
    };

    // Calculate recovery rate
    stats.recoveryRate = stats.totalAbandonedCarts > 0 ? (stats.recovered / stats.totalAbandonedCarts) * 100 : 0;
    stats.recoveryValueRate = stats.totalAbandonedValue > 0 ? (stats.recoveredValue / stats.totalAbandonedValue) * 100 : 0;

    // Get abandonment reasons (if available)
    const abandonmentReasons = await Cart.aggregate([
      {
        $match: {
          status: 'abandoned',
          createdAt: { $gte: startDate, $lte: endDate },
          abandonmentReason: { $exists: true }
        }
      },
      {
        $group: {
          _id: '$abandonmentReason',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    stats.abandonmentReasons = abandonmentReasons;

    await setCachedMetric(cacheKey, 'Abandoned Carts', stats, {}, [], 'daily');

    res.json({
      success: true,
      data: stats,
      metadata: {
        dateRange: { start: startDate, end: endDate },
        calculatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error in getAbandonedCarts:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ====================
// REVENUE ANALYTICS
// ====================

// Get revenue overview (GMV, Net Revenue, etc.)
const getRevenueOverview = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const { startDate, endDate } = getDateRange(period);
    const cacheKey = `revenue_overview_${period}`;

    const cached = await getCachedMetric(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached.metricValue,
        breakdown: cached.breakdown,
        cached: true,
        metadata: {
          dateRange: { start: startDate, end: endDate },
          calculatedAt: cached.calculatedAt
        }
      });
    }

    const orders = await Order.find({
      createdAt: { $gte: startDate, $lte: endDate },
      status: 'delivered'
    });

    // GMV (Gross Merchandise Value) - total value of all orders
    const gmv = orders.reduce((sum, order) => sum + (order.billing?.totalAmount || 0), 0);

    // Net Revenue (GMV minus refunds, cancellations, discounts)
    const refunds = orders
      .filter(o => o.status === 'cancelled')
      .reduce((sum, order) => sum + (order.billing?.totalAmount || 0), 0);

    const discounts = orders.reduce((sum, order) =>
      sum + (order.billing?.discounts?.totalDiscount || 0), 0);

    const netRevenue = gmv - refunds - discounts;

    // Revenue by order type
    const revenueByOrderType = orders.reduce((acc, order) => {
      const type = order.orderType === 'on_site_dining' ? 'pickup' : 'delivery';
      acc[type] = (acc[type] || 0) + (order.billing?.totalAmount || 0);
      return acc;
    }, {});

    // Revenue by payment mode
    const revenueByPaymentMode = orders.reduce((acc, order) => {
      const mode = order.paymentDetails?.method || 'unknown';
      acc[mode] = (acc[mode] || 0) + (order.billing?.totalAmount || 0);
      return acc;
    }, {});

    // Average discount per order
    const avgDiscountPerOrder = orders.length > 0 ? discounts / orders.length : 0;

    const metrics = {
      gmv: Math.round(gmv * 100) / 100,
      netRevenue: Math.round(netRevenue * 100) / 100,
      totalDiscounts: Math.round(discounts * 100) / 100,
      refunds: Math.round(refunds * 100) / 100,
      avgDiscountPerOrder: Math.round(avgDiscountPerOrder * 100) / 100
    };

    const breakdown = {
      byOrderType: revenueByOrderType,
      byPaymentMode: revenueByPaymentMode
    };

    await setCachedMetric(cacheKey, 'Revenue Overview', metrics, breakdown, [], 'hourly');

    res.json({
      success: true,
      data: metrics,
      breakdown,
      metadata: {
        dateRange: { start: startDate, end: endDate },
        calculatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error in getRevenueOverview:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ====================
// USER ANALYTICS
// ====================

// Get user overview metrics
const getUserOverview = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const { startDate, endDate } = getDateRange(period);
    const cacheKey = `users_overview_${period}`;

    const cached = await getCachedMetric(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached.metricValue,
        breakdown: cached.breakdown,
        cached: true,
        metadata: {
          dateRange: { start: startDate, end: endDate },
          calculatedAt: cached.calculatedAt
        }
      });
    }

    // Total users
    const totalUsers = await User.countDocuments();

    // Active users in period (DAU, WAU, MAU)
    const activeUsers = await User.countDocuments({
      lastActive: { $gte: startDate, $lte: endDate }
    });

    // New users in period
    const newUsers = await User.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate }
    });

    // Returning users (users who have placed orders before the period and active in period)
    const returningUsers = await User.countDocuments({
      createdAt: { $lt: startDate },
      lastActive: { $gte: startDate, $lte: endDate }
    });

    const newVsReturning = {
      new: newUsers,
      returning: returningUsers,
      newPercentage: activeUsers > 0 ? (newUsers / activeUsers) * 100 : 0,
      returningPercentage: activeUsers > 0 ? (returningUsers / activeUsers) * 100 : 0
    };

    // Demographics
    const genderBreakdown = await User.aggregate([
      { $group: { _id: '$gender', count: { $sum: 1 } } }
    ]);

    const ageGroupBreakdown = await User.aggregate([
      { $group: { _id: '$ageGroup', count: { $sum: 1 } } }
    ]);

    const deviceTypeBreakdown = await User.aggregate([
      { $group: { _id: '$deviceType', count: { $sum: 1 } } }
    ]);

    const loginMethodBreakdown = await User.aggregate([
      { $group: { _id: '$preferredLoginMethod', count: { $sum: 1 } } }
    ]);

    const metrics = {
      totalUsers,
      activeUsers,
      newUsers,
      newVsReturning
    };

    const breakdown = {
      gender: genderBreakdown.reduce((acc, item) => {
        acc[item._id || 'Unknown'] = item.count;
        return acc;
      }, {}),
      ageGroup: ageGroupBreakdown.reduce((acc, item) => {
        acc[item._id || 'Unknown'] = item.count;
        return acc;
      }, {}),
      deviceType: deviceTypeBreakdown.reduce((acc, item) => {
        acc[item._id || 'Unknown'] = item.count;
        return acc;
      }, {}),
      loginMethod: loginMethodBreakdown.reduce((acc, item) => {
        acc[item._id || 'OTP'] = item.count;
        return acc;
      }, {})
    };

    await setCachedMetric(cacheKey, 'User Overview', metrics, breakdown, [], 'daily');

    res.json({
      success: true,
      data: metrics,
      breakdown,
      metadata: {
        dateRange: { start: startDate, end: endDate },
        calculatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error in getUserOverview:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ====================
// PRODUCT ANALYTICS
// ====================

// Get top-selling products
const getTopSellingProducts = async (req, res) => {
  try {
    const { period = '30d', limit = 10 } = req.query;
    const { startDate, endDate } = getDateRange(period);
    const cacheKey = `top_selling_products_${period}_${limit}`;

    const cached = await getCachedMetric(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached.metricValue,
        cached: true,
        metadata: {
          dateRange: { start: startDate, end: endDate },
          calculatedAt: cached.calculatedAt
        }
      });
    }

    const topProducts = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'delivered'
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.itemId',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
          orderCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'menuitems',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          productId: '$_id',
          name: '$product.name',
          category: '$product.category',
          totalQuantity: 1,
          totalRevenue: 1,
          orderCount: 1,
          averagePrice: { $divide: ['$totalRevenue', '$totalQuantity'] }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: parseInt(limit) }
    ]);

    await setCachedMetric(cacheKey, 'Top Selling Products', topProducts, {}, [], 'daily');

    res.json({
      success: true,
      data: topProducts,
      metadata: {
        dateRange: { start: startDate, end: endDate },
        calculatedAt: new Date(),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error in getTopSellingProducts:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get product category performance
const getProductCategoryPerformance = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const { startDate, endDate } = getDateRange(period);
    const cacheKey = `category_performance_${period}`;

    const cached = await getCachedMetric(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached.metricValue,
        cached: true,
        metadata: {
          dateRange: { start: startDate, end: endDate },
          calculatedAt: cached.calculatedAt
        }
      });
    }

    // Get category performance from orders
    const categoryStats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'delivered'
        }
      },
      {
        $unwind: '$items'
      },
      {
        $lookup: {
          from: 'menuitems',
          localField: 'items.menuItem',
          foreignField: '_id',
          as: 'menuItem'
        }
      },
      {
        $unwind: '$menuItem'
      },
      {
        $group: {
          _id: '$menuItem.category',
          totalOrders: { $addToSet: '$_id' },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
          avgOrderValue: { $avg: { $multiply: ['$items.quantity', '$items.price'] } }
        }
      },
      {
        $project: {
          category: '$_id',
          orderCount: { $size: '$totalOrders' },
          totalQuantity: 1,
          totalRevenue: 1,
          avgOrderValue: 1
        }
      },
      {
        $sort: { totalRevenue: -1 }
      }
    ]);

    await setCachedMetric(cacheKey, 'Category Performance', categoryStats, {}, [], 'daily');

    res.json({
      success: true,
      data: categoryStats,
      metadata: {
        dateRange: { start: startDate, end: endDate },
        calculatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error in getProductCategoryPerformance:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ====================
// USER DEMOGRAPHICS & RETENTION
// ====================

// Get detailed user demographics
const getUserDemographics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const { startDate, endDate } = getDateRange(period);
    const cacheKey = `user_demographics_${period}`;

    const cached = await getCachedMetric(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached.metricValue,
        breakdown: cached.breakdown,
        cached: true,
        metadata: {
          dateRange: { start: startDate, end: endDate },
          calculatedAt: cached.calculatedAt
        }
      });
    }

    // Get active users in period
    const activeUsers = await User.find({
      lastActive: { $gte: startDate, $lte: endDate }
    });

    const totalActiveUsers = activeUsers.length;

    // Demographics breakdowns
    const genderBreakdown = await User.aggregate([
      { $match: { lastActive: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$gender', count: { $sum: 1 } } }
    ]);

    const ageGroupBreakdown = await User.aggregate([
      { $match: { lastActive: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$ageGroup', count: { $sum: 1 } } }
    ]);

    const locationBreakdown = await User.aggregate([
      { $match: { lastActive: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$location.city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const deviceTypeBreakdown = await User.aggregate([
      { $match: { lastActive: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$deviceType', count: { $sum: 1 } } }
    ]);

    const loginMethodBreakdown = await User.aggregate([
      { $match: { lastActive: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$preferredLoginMethod', count: { $sum: 1 } } }
    ]);

    const demographics = {
      totalActiveUsers,
      gender: genderBreakdown.reduce((acc, item) => {
        acc[item._id || 'Not Specified'] = item.count;
        return acc;
      }, {}),
      ageGroup: ageGroupBreakdown.reduce((acc, item) => {
        acc[item._id || 'Unknown'] = item.count;
        return acc;
      }, {}),
      location: locationBreakdown.reduce((acc, item) => {
        acc[item._id || 'Unknown'] = item.count;
        return acc;
      }, {}),
      deviceType: deviceTypeBreakdown.reduce((acc, item) => {
        acc[item._id || 'Unknown'] = item.count;
        return acc;
      }, {}),
      loginMethod: loginMethodBreakdown.reduce((acc, item) => {
        acc[item._id || 'Unknown'] = item.count;
        return acc;
      }, {})
    };

    await setCachedMetric(cacheKey, 'User Demographics', demographics, {}, [], 'daily');

    res.json({
      success: true,
      data: demographics,
      metadata: {
        dateRange: { start: startDate, end: endDate },
        calculatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error in getUserDemographics:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get user retention analytics
const getUserRetention = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const { startDate, endDate } = getDateRange(period);
    const cacheKey = `user_retention_${period}`;

    const cached = await getCachedMetric(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached.metricValue,
        cached: true,
        metadata: {
          dateRange: { start: startDate, end: endDate },
          calculatedAt: cached.calculatedAt
        }
      });
    }

    // Calculate retention cohorts
    const retentionData = {
      '1_day': { total: 0, retained: 0, rate: 0 },
      '7_days': { total: 0, retained: 0, rate: 0 },
      '30_days': { total: 0, retained: 0, rate: 0 }
    };

    // Get users who signed up in the period
    const newUsers = await User.find({
      createdAt: { $gte: startDate, $lte: endDate }
    }).select('_id createdAt');

    retentionData['1_day'].total = newUsers.length;
    retentionData['7_days'].total = newUsers.length;
    retentionData['30_days'].total = newUsers.length;

    // Check retention for each period
    const oneDayLater = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
    const sevenDaysLater = new Date(endDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysLater = new Date(endDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    const retained1Day = await User.countDocuments({
      _id: { $in: newUsers.map(u => u._id) },
      lastActive: { $gte: oneDayLater }
    });

    const retained7Days = await User.countDocuments({
      _id: { $in: newUsers.map(u => u._id) },
      lastActive: { $gte: sevenDaysLater }
    });

    const retained30Days = await User.countDocuments({
      _id: { $in: newUsers.map(u => u._id) },
      lastActive: { $gte: thirtyDaysLater }
    });

    retentionData['1_day'].retained = retained1Day;
    retentionData['1_day'].rate = newUsers.length > 0 ? (retained1Day / newUsers.length) * 100 : 0;

    retentionData['7_days'].retained = retained7Days;
    retentionData['7_days'].rate = newUsers.length > 0 ? (retained7Days / newUsers.length) * 100 : 0;

    retentionData['30_days'].retained = retained30Days;
    retentionData['30_days'].rate = newUsers.length > 0 ? (retained30Days / newUsers.length) * 100 : 0;

    await setCachedMetric(cacheKey, 'User Retention', retentionData, {}, [], 'daily');

    res.json({
      success: true,
      data: retentionData,
      metadata: {
        dateRange: { start: startDate, end: endDate },
        calculatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error in getUserRetention:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ====================
// SESSION ANALYTICS
// ====================

// Get session analytics
const getSessionAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const { startDate, endDate } = getDateRange(period);
    const cacheKey = `session_analytics_${period}`;

    const cached = await getCachedMetric(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached.metricValue,
        cached: true,
        metadata: {
          dateRange: { start: startDate, end: endDate },
          calculatedAt: cached.calculatedAt
        }
      });
    }

    // Aggregate session data from SessionAnalytics model
    const sessionStats = await SessionAnalytics.aggregate([
      {
        $match: {
          startTime: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          avgSessionDuration: { $avg: '$duration' },
          totalPageViews: { $sum: '$pageViews' },
          avgPageViewsPerSession: { $avg: '$pageViews' },
          uniqueUsers: { $addToSet: '$userId' },
          bounceRate: {
            $avg: {
              $cond: [{ $eq: ['$pageViews', 1] }, 1, 0]
            }
          }
        }
      }
    ]);

    const stats = sessionStats[0] || {
      totalSessions: 0,
      avgSessionDuration: 0,
      totalPageViews: 0,
      avgPageViewsPerSession: 0,
      uniqueUsers: [],
      bounceRate: 0
    };

    // Calculate unique user count
    stats.uniqueUsersCount = stats.uniqueUsers.length;
    delete stats.uniqueUsers;

    // Convert bounce rate to percentage
    stats.bounceRate = (stats.bounceRate * 100).toFixed(2);

    // Get session duration distribution
    const durationBuckets = await SessionAnalytics.aggregate([
      {
        $match: {
          startTime: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $bucket: {
          groupBy: '$duration',
          boundaries: [0, 30, 60, 120, 300, 600, 1800, 3600],
          default: '3600+',
          output: {
            count: { $sum: 1 }
          }
        }
      }
    ]);

    stats.durationDistribution = durationBuckets.map(bucket => ({
      range: bucket._id === '3600+' ? '60+ min' : `${Math.floor(bucket._id / 60)}-${Math.floor((bucket._id + 30) / 60)} min`,
      count: bucket.count
    }));

    await setCachedMetric(cacheKey, 'Session Analytics', stats, {}, [], 'daily');

    res.json({
      success: true,
      data: stats,
      metadata: {
        dateRange: { start: startDate, end: endDate },
        calculatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error in getSessionAnalytics:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ====================
// FAVORITES ANALYTICS
// ====================

// Get favorites analytics
const getFavoritesAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const { startDate, endDate } = getDateRange(period);
    const cacheKey = `favorites_analytics_${period}`;

    const cached = await getCachedMetric(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached.metricValue,
        cached: true,
        metadata: {
          dateRange: { start: startDate, end: endDate },
          calculatedAt: cached.calculatedAt
        }
      });
    }

    // Get favorites data from ProductAnalytics
    const favoritesStats = await ProductAnalytics.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalFavorites: { $sum: '$favoritesCount' },
          totalUnfavorites: { $sum: '$unfavoritesCount' },
          avgFavoritesPerProduct: { $avg: '$favoritesCount' },
          mostFavoritedProducts: {
            $push: {
              productId: '$productId',
              favorites: '$favoritesCount',
              name: '$productName'
            }
          }
        }
      }
    ]);

    const stats = favoritesStats[0] || {
      totalFavorites: 0,
      totalUnfavorites: 0,
      avgFavoritesPerProduct: 0,
      mostFavoritedProducts: []
    };

    // Sort and limit most favorited products
    stats.mostFavoritedProducts = stats.mostFavoritedProducts
      .sort((a, b) => b.favorites - a.favorites)
      .slice(0, 10);

    // Calculate favorites growth over time
    const favoritesOverTime = await ProductAnalytics.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$date' }
          },
          totalFavorites: { $sum: '$favoritesCount' },
          totalUnfavorites: { $sum: '$unfavoritesCount' }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    stats.favoritesTrend = favoritesOverTime.map(item => ({
      date: item._id,
      favorites: item.totalFavorites,
      unfavorites: item.totalUnfavorites,
      netFavorites: item.totalFavorites - item.totalUnfavorites
    }));

    await setCachedMetric(cacheKey, 'Favorites Analytics', stats, {}, [], 'daily');

    res.json({
      success: true,
      data: stats,
      metadata: {
        dateRange: { start: startDate, end: endDate },
        calculatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error in getFavoritesAnalytics:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ====================
// LOYALTY ANALYTICS
// ====================

// Get loyalty program analytics
const getLoyaltyAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const { startDate, endDate } = getDateRange(period);
    const cacheKey = `loyalty_analytics_${period}`;

    const cached = await getCachedMetric(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached.metricValue,
        cached: true,
        metadata: {
          dateRange: { start: startDate, end: endDate },
          calculatedAt: cached.calculatedAt
        }
      });
    }

    // Get loyalty program statistics
    const loyaltyStats = await User.aggregate([
      {
        $match: {
          createdAt: { $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          enrolledInLoyalty: {
            $sum: { $cond: [{ $ne: ['$loyaltyTier', null] }, 1, 0] }
          },
          tierBreakdown: {
            $push: '$loyaltyTier'
          },
          totalPointsEarned: { $sum: '$loyaltyPoints' },
          avgPointsPerUser: { $avg: '$loyaltyPoints' }
        }
      }
    ]);

    const stats = loyaltyStats[0] || {
      totalUsers: 0,
      enrolledInLoyalty: 0,
      tierBreakdown: [],
      totalPointsEarned: 0,
      avgPointsPerUser: 0
    };

    // Calculate enrollment rate
    stats.enrollmentRate = stats.totalUsers > 0 ? (stats.enrolledInLoyalty / stats.totalUsers) * 100 : 0;

    // Process tier breakdown
    const tierCounts = {};
    stats.tierBreakdown.forEach(tier => {
      if (tier) {
        tierCounts[tier] = (tierCounts[tier] || 0) + 1;
      }
    });

    stats.tierDistribution = Object.entries(tierCounts).map(([tier, count]) => ({
      tier,
      count,
      percentage: ((count / stats.enrolledInLoyalty) * 100).toFixed(2)
    }));

    // Get points earned over time (from orders)
    const pointsOverTime = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'delivered',
          loyaltyPointsEarned: { $exists: true }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          totalPoints: { $sum: '$loyaltyPointsEarned' },
          ordersCount: { $sum: 1 }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    stats.pointsTrend = pointsOverTime.map(item => ({
      date: item._id,
      pointsEarned: item.totalPoints,
      orders: item.ordersCount
    }));

    // Get referral analytics
    const referralStats = await User.aggregate([
      {
        $match: {
          referralCode: { $exists: true },
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'referredBy',
          foreignField: 'referralCode',
          as: 'referrer'
        }
      },
      {
        $group: {
          _id: null,
          totalReferrals: { $sum: 1 },
          successfulReferrals: {
            $sum: { $cond: [{ $gt: [{ $size: '$referrer' }, 0] }, 1, 0] }
          }
        }
      }
    ]);

    const refStats = referralStats[0] || { totalReferrals: 0, successfulReferrals: 0 };
    stats.referralStats = {
      totalReferrals: refStats.totalReferrals,
      successfulReferrals: refStats.successfulReferrals,
      conversionRate: refStats.totalReferrals > 0 ? (refStats.successfulReferrals / refStats.totalReferrals) * 100 : 0
    };

    await setCachedMetric(cacheKey, 'Loyalty Analytics', stats, {}, [], 'daily');

    res.json({
      success: true,
      data: stats,
      metadata: {
        dateRange: { start: startDate, end: endDate },
        calculatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error in getLoyaltyAnalytics:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ====================
// ADVANCED ANALYTICS (PHASE 3)
// ====================

// Get Customer Lifetime Value (LTV)
const getCustomerLifetimeValue = async (req, res) => {
  try {
    const { period = '90d' } = req.query;
    const { startDate, endDate } = getDateRange(period);
    const cacheKey = `customer_ltv_${period}`;

    const cached = await getCachedMetric(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached.metricValue,
        breakdown: cached.breakdown,
        cached: true,
        metadata: {
          dateRange: { start: startDate, end: endDate },
          calculatedAt: cached.calculatedAt
        }
      });
    }

    // Calculate LTV by user cohorts
    const userLTV = await Order.aggregate([
      {
        $match: {
          status: 'delivered',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$user',
          totalRevenue: { $sum: '$billing.totalAmount' },
          orderCount: { $sum: 1 },
          firstOrderDate: { $min: '$createdAt' },
          lastOrderDate: { $max: '$createdAt' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $unwind: '$userInfo'
      },
      {
        $project: {
          totalRevenue: 1,
          orderCount: 1,
          firstOrderDate: 1,
          lastOrderDate: 1,
          gender: '$userInfo.gender',
          ageGroup: '$userInfo.ageGroup',
          tier: '$userInfo.tier',
          customerLifespanDays: {
            $divide: [
              { $subtract: ['$lastOrderDate', '$firstOrderDate'] },
              1000 * 60 * 60 * 24
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgLTV: { $avg: '$totalRevenue' },
          ltvValues: { $push: '$totalRevenue' },
          totalCustomers: { $sum: 1 },
          avgOrdersPerCustomer: { $avg: '$orderCount' },
          avgCustomerLifespan: { $avg: '$customerLifespanDays' },
          ltvByGender: {
            $push: {
              gender: '$gender',
              ltv: '$totalRevenue'
            }
          },
          ltvByTier: {
            $push: {
              tier: '$tier',
              ltv: '$totalRevenue'
            }
          }
        }
      }
    ]);

    const ltvData = userLTV[0] || {
      avgLTV: 0,
      ltvValues: [],
      totalCustomers: 0,
      avgOrdersPerCustomer: 0,
      avgCustomerLifespan: 0
    };

    // Compute median in JS (avoids $median which requires MongoDB 7.0+)
    const sortedLTVs = (ltvData.ltvValues || []).slice().sort((a, b) => a - b);
    const medianLTV = sortedLTVs.length > 0
      ? sortedLTVs[Math.floor(sortedLTVs.length / 2)]
      : 0;

    // Compute LTV distribution buckets from sorted values
    const ltvBuckets = [
      { range: '0-500', min: 0, max: 500 },
      { range: '500-1000', min: 500, max: 1000 },
      { range: '1000-2500', min: 1000, max: 2500 },
      { range: '2500-5000', min: 2500, max: 5000 },
      { range: '5000+', min: 5000, max: Infinity }
    ];
    const ltvDistribution = ltvBuckets.map(({ range, min, max }) => ({
      range,
      count: sortedLTVs.filter(v => v >= min && v < max).length
    }));

    // Calculate LTV by gender
    const genderLTV = await Order.aggregate([
      {
        $match: {
          status: 'delivered',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$user',
          totalRevenue: { $sum: '$billing.totalAmount' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $unwind: '$userInfo'
      },
      {
        $group: {
          _id: '$userInfo.gender',
          avgLTV: { $avg: '$totalRevenue' },
          customerCount: { $sum: 1 }
        }
      }
    ]);

    // Calculate LTV by tier
    const tierLTV = await Order.aggregate([
      {
        $match: {
          status: 'delivered',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$user',
          totalRevenue: { $sum: '$billing.totalAmount' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $unwind: '$userInfo'
      },
      {
        $group: {
          _id: '$userInfo.tier',
          avgLTV: { $avg: '$totalRevenue' },
          customerCount: { $sum: 1 }
        }
      }
    ]);

    const breakdown = {
      byGender: genderLTV.map(item => ({
        gender: item._id,
        avgLTV: Math.round(item.avgLTV * 100) / 100,
        customers: item.customerCount
      })),
      byTier: tierLTV.map(item => ({
        tier: item._id,
        avgLTV: Math.round(item.avgLTV * 100) / 100,
        customers: item.customerCount
      }))
    };

    const metrics = {
      avgLTV: Math.round(ltvData.avgLTV * 100) / 100,
      medianLTV: Math.round(medianLTV * 100) / 100,
      totalCustomers: ltvData.totalCustomers,
      avgOrdersPerCustomer: Math.round(ltvData.avgOrdersPerCustomer * 100) / 100,
      avgCustomerLifespanDays: Math.round(ltvData.avgCustomerLifespan * 100) / 100,
      ltvDistribution
    };

    await setCachedMetric(cacheKey, 'Customer LTV', metrics, breakdown, [], 'daily');

    res.json({
      success: true,
      data: metrics,
      breakdown,
      metadata: {
        dateRange: { start: startDate, end: endDate },
        calculatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error in getCustomerLifetimeValue:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get Gender-Item-Day Trends
const getGenderTrends = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const { startDate, endDate } = getDateRange(period);
    const cacheKey = `gender_trends_${period}`;

    const cached = await getCachedMetric(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached.metricValue,
        breakdown: cached.breakdown,
        cached: true,
        metadata: {
          dateRange: { start: startDate, end: endDate },
          calculatedAt: cached.calculatedAt
        }
      });
    }

    // Gender-Item-Day analysis
    const genderItemDay = await Order.aggregate([
      {
        $match: {
          status: 'delivered',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $unwind: '$userInfo'
      },
      {
        $unwind: '$items'
      },
      {
        $lookup: {
          from: 'menuitems',
          localField: 'items.itemId',
          foreignField: '_id',
          as: 'itemInfo'
        }
      },
      {
        $unwind: '$itemInfo'
      },
      {
        $project: {
          gender: '$userInfo.gender',
          dayOfWeek: { $dayOfWeek: '$createdAt' },
          dayPart: '$dayPart',
          itemName: '$itemInfo.name',
          category: '$itemInfo.category',
          quantity: '$items.quantity',
          revenue: { $multiply: ['$items.quantity', '$items.price'] }
        }
      },
      {
        $group: {
          _id: {
            gender: '$gender',
            dayOfWeek: '$dayOfWeek',
            dayPart: '$dayPart',
            category: '$category'
          },
          totalOrders: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalRevenue: { $sum: '$revenue' }
        }
      },
      {
        $sort: { totalRevenue: -1 }
      },
      {
        $limit: 50
      }
    ]);

    // Format day of week
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const formattedTrends = genderItemDay.map(item => ({
      gender: item._id.gender,
      dayOfWeek: dayNames[item._id.dayOfWeek - 1],
      dayPart: item._id.dayPart,
      category: item._id.category,
      orders: item.totalOrders,
      quantity: item.totalQuantity,
      revenue: Math.round(item.totalRevenue * 100) / 100
    }));

    // Calculate gender preferences by day part
    const genderDayPartPrefs = await Order.aggregate([
      {
        $match: {
          status: 'delivered',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $unwind: '$userInfo'
      },
      {
        $group: {
          _id: {
            gender: '$userInfo.gender',
            dayPart: '$dayPart'
          },
          orderCount: { $sum: 1 },
          avgOrderValue: { $avg: '$billing.totalAmount' }
        }
      },
      {
        $sort: { orderCount: -1 }
      }
    ]);

    const breakdown = {
      genderItemDayTrends: formattedTrends,
      genderDayPartPreferences: genderDayPartPrefs.map(item => ({
        gender: item._id.gender,
        dayPart: item._id.dayPart,
        orders: item.orderCount,
        avgOrderValue: Math.round(item.avgOrderValue * 100) / 100
      }))
    };

    await setCachedMetric(cacheKey, 'Gender Trends', { totalTrends: formattedTrends.length }, breakdown, [], 'daily');

    // Transform genderDayPartPrefs into frontend-friendly shape: one object per gender with breakfast/lunch/dinner counts
    const dayPartMap = {};
    genderDayPartPrefs.forEach(item => {
      const gender = item._id.gender || 'Unknown';
      const part = item._id.dayPart || 'dinner';
      if (!dayPartMap[gender]) {
        dayPartMap[gender] = { gender, breakfast: 0, lunch: 0, dinner: 0 };
      }
      const count = item.orderCount || 0;
      if (part.toLowerCase().includes('break')) dayPartMap[gender].breakfast += count;
      else if (part.toLowerCase().includes('lunch')) dayPartMap[gender].lunch += count;
      else dayPartMap[gender].dinner += count;
    });

    const dayPartPreferences = Object.values(dayPartMap);

    // Provide genderItemMatrix for compatibility (group formattedTrends by gender)
    const genderItemMatrix = formattedTrends.reduce((acc, t) => {
      if (!acc[t.gender]) acc[t.gender] = { gender: t.gender, items: [] };
      acc[t.gender].items.push({ itemName: t.category || t.itemName || 'Unknown', orderCount: t.quantity || t.orders || 0, revenue: t.revenue || 0 });
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        totalTrends: formattedTrends.length,
        topTrends: formattedTrends.slice(0, 10),
        genderItemMatrix: Object.values(genderItemMatrix),
        dayPartPreferences
      },
      breakdown,
      metadata: {
        dateRange: { start: startDate, end: endDate },
        calculatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error in getGenderTrends:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get High-Value Customers (Pareto Analysis)
const getHighValueCustomers = async (req, res) => {
  try {
    const { period = '90d' } = req.query;
    const { startDate, endDate } = getDateRange(period);
    const cacheKey = `high_value_customers_${period}`;

    const cached = await getCachedMetric(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached.metricValue,
        breakdown: cached.breakdown,
        cached: true,
        metadata: {
          dateRange: { start: startDate, end: endDate },
          calculatedAt: cached.calculatedAt
        }
      });
    }

    // Get customer revenue ranking
    const customerRevenue = await Order.aggregate([
      {
        $match: {
          status: 'delivered',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$user',
          totalRevenue: { $sum: '$billing.totalAmount' },
          orderCount: { $sum: 1 },
          avgOrderValue: { $avg: '$billing.totalAmount' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $unwind: '$userInfo'
      },
      {
        $project: {
          userId: '$_id',
          name: '$userInfo.name',
          email: '$userInfo.email',
          phone: '$userInfo.phone',
          tier: '$userInfo.tier',
          totalRevenue: 1,
          orderCount: 1,
          avgOrderValue: 1
        }
      },
      {
        $sort: { totalRevenue: -1 }
      }
    ]);

    // Calculate total revenue
    const totalRevenue = customerRevenue.reduce((sum, c) => sum + c.totalRevenue, 0);
    const totalCustomers = customerRevenue.length;

    // Calculate cumulative revenue and find 80/20 split
    let cumulativeRevenue = 0;
    let top20PercentCount = Math.ceil(totalCustomers * 0.2);
    let top20PercentRevenue = 0;

    customerRevenue.forEach((customer, index) => {
      cumulativeRevenue += customer.totalRevenue;
      customer.cumulativeShare = (cumulativeRevenue / totalRevenue) * 100;
      
      if (index < top20PercentCount) {
        top20PercentRevenue += customer.totalRevenue;
      }
    });

    const top20Share = (top20PercentRevenue / totalRevenue) * 100;

    // Get top 20 customers
    const topCustomers = customerRevenue.slice(0, 20).map(c => ({
      userId: c.userId,
      name: c.name,
      email: c.email,
      tier: c.tier,
      totalRevenue: Math.round(c.totalRevenue * 100) / 100,
      orderCount: c.orderCount,
      avgOrderValue: Math.round(c.avgOrderValue * 100) / 100,
      revenueShare: Math.round((c.totalRevenue / totalRevenue) * 10000) / 100
    }));

    // Also compute top10 percent share for explicit reporting
    const top10PercentRevenue = customerRevenue.slice(0, Math.ceil(totalCustomers * 0.1)).reduce((sum, c) => sum + c.totalRevenue, 0);
    const top10Share = totalRevenue > 0 ? (top10PercentRevenue / totalRevenue) * 100 : 0;

    const metrics = {
      totalCustomers,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      top20PercentCount,
      top20PercentRevenue: Math.round(top20PercentRevenue * 100) / 100,
      top20Share: Math.round(top20Share * 100) / 100,
      top10PercentRevenue: Math.round(top10PercentRevenue * 100) / 100,
      top10Share: Math.round(top10Share * 100) / 100,
      avgRevenuePerCustomer: Math.round((totalRevenue / totalCustomers) * 100) / 100
    };

    const breakdown = {
      topCustomers,
      revenueDistribution: {
        top10Percent: customerRevenue.slice(0, Math.ceil(totalCustomers * 0.1)).reduce((sum, c) => sum + c.totalRevenue, 0),
        top20Percent: top20PercentRevenue,
        top50Percent: customerRevenue.slice(0, Math.ceil(totalCustomers * 0.5)).reduce((sum, c) => sum + c.totalRevenue, 0)
      }
    };

    await setCachedMetric(cacheKey, 'High-Value Customers', metrics, breakdown, [], 'daily');

    res.json({
      success: true,
      data: metrics,
      breakdown,
      metadata: {
        dateRange: { start: startDate, end: endDate },
        calculatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error in getHighValueCustomers:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get Time-to-Second-Order
const getTimeToSecondOrder = async (req, res) => {
  try {
    const { period = '90d' } = req.query;
    const { startDate, endDate } = getDateRange(period);
    const cacheKey = `time_to_second_order_${period}`;

    const cached = await getCachedMetric(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached.metricValue,
        breakdown: cached.breakdown,
        cached: true,
        metadata: {
          dateRange: { start: startDate, end: endDate },
          calculatedAt: cached.calculatedAt
        }
      });
    }

    // Get first and second order times for each customer
    const orderTiming = await Order.aggregate([
      {
        $match: {
          status: 'delivered',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $sort: { user: 1, createdAt: 1 }
      },
      {
        $group: {
          _id: '$user',
          orders: {
            $push: {
              orderId: '$_id',
              orderDate: '$createdAt',
              orderValue: '$billing.totalAmount'
            }
          },
          orderCount: { $sum: 1 }
        }
      },
      {
        $match: {
          orderCount: { $gte: 2 }
        }
      },
      {
        $project: {
          firstOrder: { $arrayElemAt: ['$orders', 0] },
          secondOrder: { $arrayElemAt: ['$orders', 1] },
          orderCount: 1
        }
      },
      {
        $project: {
          daysToSecondOrder: {
            $divide: [
              { $subtract: ['$secondOrder.orderDate', '$firstOrder.orderDate'] },
              1000 * 60 * 60 * 24
            ]
          },
          firstOrderValue: '$firstOrder.orderValue',
          secondOrderValue: '$secondOrder.orderValue'
        }
      }
    ]);

    if (orderTiming.length === 0) {
      return res.json({
        success: true,
        data: {
          avgDaysToSecondOrder: 0,
          medianDaysToSecondOrder: 0,
          totalRepeatCustomers: 0
        },
        breakdown: {},
        metadata: {
          dateRange: { start: startDate, end: endDate },
          calculatedAt: new Date()
        }
      });
    }

    const daysArray = orderTiming.map(o => o.daysToSecondOrder).sort((a, b) => a - b);
    const avgDays = daysArray.reduce((sum, days) => sum + days, 0) / daysArray.length;
    const medianDays = daysArray[Math.floor(daysArray.length / 2)];

    // Distribution buckets
    const distribution = {
      '0-7 days': daysArray.filter(d => d <= 7).length,
      '8-14 days': daysArray.filter(d => d > 7 && d <= 14).length,
      '15-30 days': daysArray.filter(d => d > 14 && d <= 30).length,
      '31-60 days': daysArray.filter(d => d > 30 && d <= 60).length,
      '61+ days': daysArray.filter(d => d > 60).length
    };

    const metrics = {
      avgDaysToSecondOrder: Math.round(avgDays * 100) / 100,
      medianDaysToSecondOrder: Math.round(medianDays * 100) / 100,
      totalRepeatCustomers: orderTiming.length,
      minDays: Math.round(Math.min(...daysArray) * 100) / 100,
      maxDays: Math.round(Math.max(...daysArray) * 100) / 100
    };

    const breakdown = {
      distribution,
      distributionPercentage: {
        '0-7 days': Math.round((distribution['0-7 days'] / orderTiming.length) * 10000) / 100,
        '8-14 days': Math.round((distribution['8-14 days'] / orderTiming.length) * 10000) / 100,
        '15-30 days': Math.round((distribution['15-30 days'] / orderTiming.length) * 10000) / 100,
        '31-60 days': Math.round((distribution['31-60 days'] / orderTiming.length) * 10000) / 100,
        '61+ days': Math.round((distribution['61+ days'] / orderTiming.length) * 10000) / 100
      }
    };

    await setCachedMetric(cacheKey, 'Time to Second Order', metrics, breakdown, [], 'daily');

    res.json({
      success: true,
      data: metrics,
      breakdown,
      metadata: {
        dateRange: { start: startDate, end: endDate },
        calculatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error in getTimeToSecondOrder:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get Peak Order Times (Heatmap data)
const getPeakOrderTimes = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const { startDate, endDate } = getDateRange(period);
    const cacheKey = `peak_order_times_${period}`;

    const cached = await getCachedMetric(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached.metricValue,
        breakdown: cached.breakdown,
        cached: true,
        metadata: {
          dateRange: { start: startDate, end: endDate },
          calculatedAt: cached.calculatedAt
        }
      });
    }

    // Get order distribution by day and hour
    const orderHeatmap = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $project: {
          dayOfWeek: { $dayOfWeek: '$createdAt' },
          hour: { $hour: '$createdAt' },
          dayPart: '$dayPart',
          orderValue: '$billing.totalAmount'
        }
      },
      {
        $group: {
          _id: {
            dayOfWeek: '$dayOfWeek',
            hour: '$hour',
            dayPart: '$dayPart'
          },
          orderCount: { $sum: 1 },
          totalRevenue: { $sum: '$orderValue' },
          avgOrderValue: { $avg: '$orderValue' }
        }
      },
      {
        $sort: { '_id.dayOfWeek': 1, '_id.hour': 1 }
      }
    ]);

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    const heatmapData = orderHeatmap.map(item => ({
      dayOfWeek: dayNames[item._id.dayOfWeek - 1],
      hour: item._id.hour,
      dayPart: item._id.dayPart,
      orderCount: item.orderCount,
      totalRevenue: Math.round(item.totalRevenue * 100) / 100,
      avgOrderValue: Math.round(item.avgOrderValue * 100) / 100
    }));

    // Find peak times
    const sortedByOrders = [...heatmapData].sort((a, b) => b.orderCount - a.orderCount);
    const peakTimes = sortedByOrders.slice(0, 10);

    const metrics = {
      totalDataPoints: heatmapData.length,
      peakOrderTime: peakTimes[0] || null,
      avgOrdersPerHour: Math.round((heatmapData.reduce((sum, d) => sum + d.orderCount, 0) / heatmapData.length) * 100) / 100
    };

    const breakdown = {
      heatmapData,
      top10PeakTimes: peakTimes
    };

    await setCachedMetric(cacheKey, 'Peak Order Times', metrics, breakdown, [], 'daily');

    res.json({
      success: true,
      data: metrics,
      breakdown,
      metadata: {
        dateRange: { start: startDate, end: endDate },
        calculatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error in getPeakOrderTimes:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get Product Search Analytics
const getSearchAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const { startDate, endDate } = getDateRange(period);
    const cacheKey = `search_analytics_${period}`;

    const cached = await getCachedMetric(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached.metricValue,
        breakdown: cached.breakdown,
        cached: true,
        metadata: {
          dateRange: { start: startDate, end: endDate },
          calculatedAt: cached.calculatedAt
        }
      });
    }

    // Get search actions from session analytics
    const searchData = await SessionAnalytics.aggregate([
      {
        $match: {
          startTime: { $gte: startDate, $lte: endDate },
          'actions.type': 'search'
        }
      },
      {
        $unwind: '$actions'
      },
      {
        $match: {
          'actions.type': 'search'
        }
      },
      {
        $group: {
          _id: '$actions.metadata.searchTerm',
          searchCount: { $sum: 1 },
          resultsFound: { $avg: '$actions.metadata.resultsCount' },
          clickThrough: {
            $sum: {
              $cond: [{ $gt: ['$actions.metadata.clicked', 0] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          searchTerm: '$_id',
          searchCount: 1,
          avgResultsFound: { $round: ['$resultsFound', 2] },
          clickThroughRate: {
            $multiply: [
              { $divide: ['$clickThrough', '$searchCount'] },
              100
            ]
          }
        }
      },
      {
        $sort: { searchCount: -1 }
      },
      {
        $limit: 100
      }
    ]);

    const totalSearches = searchData.reduce((sum, s) => sum + s.searchCount, 0);
    const failedSearches = searchData.filter(s => s.avgResultsFound === 0);
    const failedSearchCount = failedSearches.reduce((sum, s) => sum + s.searchCount, 0);

    const metrics = {
      totalSearches,
      uniqueSearchTerms: searchData.length,
      failedSearches: failedSearchCount,
      failedSearchRate: totalSearches > 0 ? Math.round((failedSearchCount / totalSearches) * 10000) / 100 : 0,
      avgClickThroughRate: searchData.length > 0 ? Math.round((searchData.reduce((sum, s) => sum + s.clickThroughRate, 0) / searchData.length) * 100) / 100 : 0
    };

    const breakdown = {
      topSearches: searchData.slice(0, 20),
      failedSearchTerms: failedSearches.slice(0, 20)
    };

    await setCachedMetric(cacheKey, 'Search Analytics', metrics, breakdown, [], 'daily');

    res.json({
      success: true,
      data: metrics,
      breakdown,
      metadata: {
        dateRange: { start: startDate, end: endDate },
        calculatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error in getSearchAnalytics:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get Product Customization Usage
const getCustomizationAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const { startDate, endDate } = getDateRange(period);
    const cacheKey = `customization_analytics_${period}`;

    const cached = await getCachedMetric(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached.metricValue,
        breakdown: cached.breakdown,
        cached: true,
        metadata: {
          dateRange: { start: startDate, end: endDate },
          calculatedAt: cached.calculatedAt
        }
      });
    }

    // Analyze customization usage in orders
    const customizationData = await Order.aggregate([
      {
        $match: {
          status: 'delivered',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $unwind: '$items'
      },
      {
        $project: {
          hasCustomization: {
            $or: [
              { $gt: [{ $ifNull: ['$items.customizations.spiceLevel', ''] }, ''] },
              { $gt: [{ $size: { $ifNull: ['$items.customizations.addOns', []] } }, 0] },
              { $gt: [{ $ifNull: ['$items.customizations.cookingInstructions', ''] }, ''] }
            ]
          },
          spiceLevel: '$items.customizations.spiceLevel',
          addOnsCount: { $size: { $ifNull: ['$items.customizations.addOns', []] } },
          itemPrice: '$items.price'
        }
      },
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          customizedItems: {
            $sum: { $cond: ['$hasCustomization', 1, 0] }
          },
          spiceLevelUsage: {
            $push: '$spiceLevel'
          },
          avgAddOns: { $avg: '$addOnsCount' },
          customizedRevenue: {
            $sum: { $cond: ['$hasCustomization', '$itemPrice', 0] }
          },
          totalRevenue: { $sum: '$itemPrice' }
        }
      }
    ]);

    const data = customizationData[0] || {
      totalItems: 0,
      customizedItems: 0,
      avgAddOns: 0,
      customizedRevenue: 0,
      totalRevenue: 0
    };

    // Count spice level preferences
    const spiceLevels = data.spiceLevelUsage || [];
    const spiceLevelCount = spiceLevels.reduce((acc, level) => {
      if (level) {
        acc[level] = (acc[level] || 0) + 1;
      }
      return acc;
    }, {});

    const metrics = {
      totalItems: data.totalItems,
      customizedItems: data.customizedItems,
      customizationRate: data.totalItems > 0 ? Math.round((data.customizedItems / data.totalItems) * 10000) / 100 : 0,
      avgAddOnsPerItem: Math.round((data.avgAddOns || 0) * 100) / 100,
      customizedRevenue: Math.round(data.customizedRevenue * 100) / 100,
      customizationRevenueShare: data.totalRevenue > 0 ? Math.round((data.customizedRevenue / data.totalRevenue) * 10000) / 100 : 0
    };

    const breakdown = {
      spiceLevelPreferences: spiceLevelCount
    };

    await setCachedMetric(cacheKey, 'Customization Analytics', metrics, breakdown, [], 'daily');

    res.json({
      success: true,
      data: metrics,
      breakdown,
      metadata: {
        dateRange: { start: startDate, end: endDate },
        calculatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error in getCustomizationAnalytics:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get Push Notification Analytics
const getPushNotificationAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const { startDate, endDate } = getDateRange(period);
    const cacheKey = `push_notification_analytics_${period}`;

    const cached = await getCachedMetric(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached.metricValue,
        breakdown: cached.breakdown,
        cached: true,
        metadata: {
          dateRange: { start: startDate, end: endDate },
          calculatedAt: cached.calculatedAt
        }
      });
    }

    const Notification = require('../models/notificationModel');

    // Get notification statistics
    const notificationStats = await Notification.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$type',
          totalSent: { $sum: 1 },
          opened: {
            $sum: { $cond: ['$read', 1, 0] }
          },
          clicked: {
            $sum: { $cond: ['$clicked', 1, 0] }
          }
        }
      },
      {
        $project: {
          type: '$_id',
          totalSent: 1,
          opened: 1,
          clicked: 1,
          openRate: {
            $multiply: [
              { $divide: ['$opened', '$totalSent'] },
              100
            ]
          },
          clickThroughRate: {
            $multiply: [
              { $divide: ['$clicked', '$totalSent'] },
              100
            ]
          }
        }
      }
    ]);

    const totalNotifications = notificationStats.reduce((sum, n) => sum + n.totalSent, 0);
    const totalOpened = notificationStats.reduce((sum, n) => sum + n.opened, 0);
    const totalClicked = notificationStats.reduce((sum, n) => sum + n.clicked, 0);

    const metrics = {
      totalNotificationsSent: totalNotifications,
      totalOpened,
      totalClicked,
      avgOpenRate: totalNotifications > 0 ? Math.round((totalOpened / totalNotifications) * 10000) / 100 : 0,
      avgClickThroughRate: totalNotifications > 0 ? Math.round((totalClicked / totalNotifications) * 10000) / 100 : 0
    };

    const breakdown = {
      byType: notificationStats.map(n => ({
        type: n.type,
        sent: n.totalSent,
        opened: n.opened,
        clicked: n.clicked,
        openRate: Math.round(n.openRate * 100) / 100,
        ctr: Math.round(n.clickThroughRate * 100) / 100
      }))
    };

    await setCachedMetric(cacheKey, 'Push Notification Analytics', metrics, breakdown, [], 'hourly');

    res.json({
      success: true,
      data: metrics,
      breakdown,
      metadata: {
        dateRange: { start: startDate, end: endDate },
        calculatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error in getPushNotificationAnalytics:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  // Phase 1 - Critical Business Metrics
  getOrderOverview,
  getRevenueOverview,
  getUserOverview,
  getTopSellingProducts,
  getAbandonedCarts,
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
  // getSubscriptionAnalytics will be exported after its definition to avoid TDZ
  getTimeToSecondOrder,
  getPeakOrderTimes,
  getSearchAnalytics,
  getCustomizationAnalytics,
  getPushNotificationAnalytics
};

// Get Subscription / Pre-Booking Uptake Analytics
const getSubscriptionAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const { startDate, endDate } = getDateRange(period);
    const cacheKey = `subscription_analytics_${period}`;

    const cached = await getCachedMetric(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached.metricValue,
        breakdown: cached.breakdown,
        cached: true,
        metadata: {
          dateRange: { start: startDate, end: endDate },
          calculatedAt: cached.calculatedAt
        }
      });
    }

    let Subscription;
    try {
      Subscription = require('../models/subscriptionModel');
    } catch (e) {
      Subscription = null;
    }

    // If Subscription collection exists, aggregate from it
    let metrics = {
      totalSubscriptions: 0,
      activeSubscriptions: 0,
      subscriptionRevenue: 0,
      churnRate: 0
    };

    let breakdown = { subscriptionTrend: [] };

    if (Subscription) {
      const totalSubscriptions = await Subscription.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } });
      const activeSubscriptions = await Subscription.countDocuments({ isActive: true });
      // Revenue: sum of price for active subscriptions (approx monthly recurring revenue)
      const revenueAgg = await Subscription.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, totalRevenue: { $sum: '$price' }, count: { $sum: 1 } } }
      ]);
      const subscriptionRevenue = (revenueAgg[0] && revenueAgg[0].totalRevenue) || 0;

      // Churn rate in period: subscriptions cancelled during period / subscriptions active at period start
      const churnedInPeriod = await Subscription.countDocuments({ cancelledAt: { $gte: startDate, $lte: endDate } });
      const activeAtPeriodStart = await Subscription.countDocuments({ startDate: { $lt: startDate }, isActive: true });
      const churnRate = activeAtPeriodStart > 0 ? (churnedInPeriod / activeAtPeriodStart) * 100 : 0;

      // Trend: daily subscriptions and churns
      const trend = await Subscription.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        { $project: { day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, cancelledAt: 1, cancelledDay: { $dateToString: { format: '%Y-%m-%d', date: '$cancelledAt' } } } },
        { $group: { _id: '$day', subscriptions: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);

      const churnTrend = await Subscription.aggregate([
        { $match: { cancelledAt: { $gte: startDate, $lte: endDate } } },
        { $project: { cancelledDay: { $dateToString: { format: '%Y-%m-%d', date: '$cancelledAt' } } } },
        { $group: { _id: '$cancelledDay', churns: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);

      // Merge trend and churnTrend into date-wise array
      const trendMap = {};
      trend.forEach(t => { trendMap[t._id] = { date: t._id, subscriptions: t.subscriptions, churns: 0 }; });
      churnTrend.forEach(c => {
        if (trendMap[c._id]) trendMap[c._id].churns = c.churns;
        else trendMap[c._id] = { date: c._id, subscriptions: 0, churns: c.churns };
      });

      const subscriptionTrend = Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date));

      metrics = {
        totalSubscriptions,
        activeSubscriptions,
        subscriptionRevenue: Math.round(subscriptionRevenue * 100) / 100,
        churnRate: Math.round(churnRate * 100) / 100
      };

      breakdown = { subscriptionTrend };
    } else {
      // No Subscription collection found — return empty metrics with a helpful message in metadata
      metrics = {
        totalSubscriptions: 0,
        activeSubscriptions: 0,
        subscriptionRevenue: 0,
        churnRate: 0
      };
      breakdown = { subscriptionTrend: [] };
    }

    await setCachedMetric(cacheKey, 'Subscription Analytics', metrics, breakdown, [], 'daily');

    res.json({
      success: true,
      data: metrics,
      breakdown,
      metadata: {
        dateRange: { start: startDate, end: endDate },
        calculatedAt: new Date(),
        note: Subscription ? undefined : 'No Subscription collection present; returned zeros. Consider populating subscriptions or connecting recurring orders.'
      }
    });

  } catch (error) {
    console.error('Error in getSubscriptionAnalytics:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Export handlers (include getSubscriptionAnalytics now that it's defined)
module.exports = {
  // Phase 1 - Critical Business Metrics
  getOrderOverview,
  getRevenueOverview,
  getUserOverview,
  getTopSellingProducts,
  getAbandonedCarts,
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
  getSubscriptionAnalytics,
  getTimeToSecondOrder,
  getPeakOrderTimes,
  getSearchAnalytics,
  getCustomizationAnalytics,
  getPushNotificationAnalytics
};