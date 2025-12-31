const MenuItem = require('../models/menuItemModel');

/**
 * Core recommendation builder. Accepts an optional user object.
 * @param {String} userId
 * @param {Object} user
 */
async function getRecommendations(userId, user) {
  try {
    let recommendations = [];

    // 1. Get preference-based items
    if (user && user.preferences) {
      const preferenceItems = await getPreferenceBasedItems(user.preferences);
      recommendations.push(...preferenceItems);
    }

    // 2. Get order history-based items
    if (userId && !user?.isGuest) {
      const historyItems = await getOrderHistoryItems(userId);
      recommendations.push(...historyItems);
    }

    // 3. Get trending items
    const trendingItems = await getTrendingItems();
    recommendations.push(...trendingItems);

    // Remove duplicates and limit to 10 items
    const uniqueRecommendations = Array.from(
      new Map(recommendations.map(item => [item._id.toString(), item])).values()
    ).slice(0, 10);

    return uniqueRecommendations;
  } catch (error) {
    console.error('Get recommendations error:', error);
    return [];
  }
}

async function getPreferenceBasedItems(preferences) {
  try {
    const query = { isAvailable: true };

    // Filter by dietary preferences
    if (preferences?.dietaryPreferences && preferences.dietaryPreferences.length > 0) {
      if (preferences.dietaryPreferences.includes('vegetarian') || 
          preferences.dietaryPreferences.includes('vegan')) {
        query.isVeg = true;
      }
    }

    // Exclude allergens
    if (preferences?.allergens && preferences.allergens.length > 0) {
      query.allergens = { $nin: preferences.allergens };
    }

    const items = await MenuItem.find(query)
      .limit(5)
      .sort({ rating: -1 });

    return items;
  } catch (error) {
    console.error('Get preference-based items error:', error);
    return [];
  }
}

async function getOrderHistoryItems(userId) {
  try {
    const Order = require('../models/orderModel');
    
    // Get user's past orders
    const orders = await Order.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('items.itemId');

    if (!orders || orders.length === 0) {
      return [];
    }

    // Extract item IDs from orders
    const orderedItemIds = [];
    orders.forEach(order => {
      order.items.forEach(item => {
        if (item.itemId) {
          orderedItemIds.push(item.itemId._id);
        }
      });
    });

    // Get similar items (same category)
    const items = await MenuItem.find({
      _id: { $nin: orderedItemIds },
      isAvailable: true
    })
      .limit(3)
      .sort({ rating: -1 });

    return items;
  } catch (error) {
    console.error('Get order history items error:', error);
    return [];
  }
}

async function getTrendingItems() {
  try {
    // In production, calculate based on order count, ratings, etc.
    const items = await MenuItem.find({ isAvailable: true })
      .sort({ rating: -1, orderCount: -1 })
      .limit(5);

    return items;
  } catch (error) {
    console.error('Get trending items error:', error);
    return [];
  }
}

async function getSimilarItems(itemId) {
  try {
    const item = await MenuItem.findById(itemId);
    
    if (!item) {
      return [];
    }

    // Find items in same category with similar tags
    const similarItems = await MenuItem.find({
      _id: { $ne: itemId },
      category: item.category,
      isAvailable: true,
      $or: [
        { tags: { $in: item.tags } },
        { cuisine: item.cuisine }
      ]
    })
      .limit(4)
      .sort({ rating: -1 });

    return similarItems;
  } catch (error) {
    console.error('Get similar items error:', error);
    return [];
  }
}

/**
 * Public helper for controllers that only pass userId.
 * It will attempt to load the user (if userId provided) and then call
 * the core recommendation builder.
 * @param {String} userId
 */
async function getPersonalizedRecommendations(userId) {
  try {
    let user = { isGuest: true };
    if (userId) {
      try {
        const User = require('../models/userModel');
        const u = await User.findById(userId);
        if (u) user = u;
      } catch (e) {
        // If user model not found or DB error, continue as guest
        console.warn('Could not load user for recommendations:', e.message || e);
      }
    }

    return await getRecommendations(userId, user);
  } catch (error) {
    console.error('getPersonalizedRecommendations error:', error);
    return [];
  }
}

module.exports = {
  getRecommendations,
  getPersonalizedRecommendations,
  getPreferenceBasedItems,
  getOrderHistoryItems,
  getTrendingItems,
  getSimilarItems
};
