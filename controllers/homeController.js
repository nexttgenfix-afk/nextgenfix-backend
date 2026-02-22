const MenuItem = require('../models/menuItemModel');
const User = require('../models/userModel');
const Category = require('../models/categoryModel');
const Banner = require('../models/bannerModel');
const mongoose = require('mongoose');

// Helper: get user's favorite menu item IDs as strings
async function getUserFavorites(userId) {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return [];
  try {
    const user = await User.findById(userId).select('favorites');
    if (user && user.favorites && user.favorites.length > 0) {
      return user.favorites
        .map(fav => fav.menuItem ? fav.menuItem.toString() : null)
        .filter(Boolean);
    }
  } catch (err) {
    console.error('Error fetching user favorites:', err);
  }
  return [];
}

// GET /api/home/menu-items?filter=today-special|pure-veg|high-protein|salads|thali|popular&limit=15
exports.getMenuItems = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { filter, limit = 15 } = req.query;
    const today = new Date();

    // Base query: only show items with valid special offers or non-special items
    const baseQuery = {
      $or: [
        { 'specialOffer.isSpecial': { $ne: true } },
        {
          'specialOffer.isSpecial': true,
          'specialOffer.validFrom': { $lte: today },
          'specialOffer.validUntil': { $gte: today }
        }
      ]
    };

    let filterQuery = { ...baseQuery };
    let sortOptions = {};
    let responseKey = 'menuItems';

    if (filter) {
      switch (filter) {
        case 'today-special':
          filterQuery = {
            'specialOffer.isSpecial': true,
            'specialOffer.validFrom': { $lte: today },
            'specialOffer.validUntil': { $gte: today }
          };
          responseKey = 'todaySpecials';
          break;
        case 'pure-veg':
          filterQuery = { ...baseQuery, isVeg: true };
          responseKey = 'pureVegItems';
          break;
        case 'high-protein':
          filterQuery = { ...baseQuery, 'nutritionInfo.protein': { $gt: 15 } };
          sortOptions = { 'nutritionInfo.protein': -1 };
          responseKey = 'highProteinItems';
          break;
        case 'salads':
          filterQuery = { ...baseQuery, tags: { $in: [/salad/i] } };
          responseKey = 'saladItems';
          break;
        case 'thali':
          filterQuery = { ...baseQuery, tags: { $in: [/thali/i] } };
          responseKey = 'thaliItems';
          break;
      }
    }

    let menuItems;

    if (filter === 'popular') {
      responseKey = 'popularDishes';

      const popularDishes = await MenuItem.aggregate([
        { $match: baseQuery },
        {
          $lookup: {
            from: 'ratings',
            localField: '_id',
            foreignField: 'menuItemId',
            as: 'ratings'
          }
        },
        {
          $addFields: {
            averageRating: { $avg: '$ratings.rating' },
            totalRatings: { $size: '$ratings' },
            popularityScore: {
              $add: [
                { $multiply: [{ $ifNull: ['$popularity.orderCount', 0] }, 1] },
                { $multiply: [{ $ifNull: [{ $avg: '$ratings.rating' }, 0] }, 10] }
              ]
            }
          }
        },
        { $sort: { popularityScore: -1 } },
        { $limit: parseInt(limit) },
        {
          $project: {
            _id: 1, name: 1, isVeg: 1, price: 1, image: 1,
            preparationTime: 1, nutritionInfo: 1,
            averageRating: 1, totalRatings: 1
          }
        }
      ]);

      menuItems = popularDishes;
    } else {
      menuItems = await MenuItem.find(filterQuery)
        .sort(sortOptions)
        .limit(parseInt(limit))
        .lean();
    }

    const userFavorites = await getUserFavorites(userId);

    const formattedItems = menuItems.map(item => ({
      menuItemId: item._id,
      name: item.name,
      preparationTime: item.preparationTime || 30,
      isVeg: item.isVeg,
      nutritionInfo: item.nutritionInfo || {
        calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, servingSize: '1 serving'
      },
      rating: {
        average: filter === 'popular' ? (item.averageRating || 0) : (item.rating?.average || 0),
        count: filter === 'popular' ? (item.totalRatings || 0) : (item.rating?.count || 0)
      },
      image: item.image || item.photos?.main || '',
      isFavorite: userFavorites.includes(item._id.toString())
    }));

    res.status(200).json({ [responseKey]: formattedItems });
  } catch (err) {
    console.error(`Get menu items error (${req.query.filter || 'all'}):`, err);
    res.status(500).json({ message: 'Failed to fetch menu items' });
  }
};

// GET /api/home/popular-dishes?limit=15
exports.getPopularDishes = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { limit = 15 } = req.query;

    const popularDishes = await MenuItem.aggregate([
      {
        $lookup: {
          from: 'ratings',
          localField: '_id',
          foreignField: 'menuItemId',
          as: 'ratings'
        }
      },
      {
        $addFields: {
          averageRating: { $avg: '$ratings.rating' },
          totalRatings: { $size: '$ratings' },
          popularityScore: {
            $add: [
              { $multiply: [{ $ifNull: ['$popularity.orderCount', 0] }, 1] },
              { $multiply: [{ $ifNull: [{ $avg: '$ratings.rating' }, 0] }, 10] }
            ]
          }
        }
      },
      { $sort: { popularityScore: -1 } },
      { $limit: parseInt(limit) },
      {
        $project: {
          _id: 1, name: 1, isVeg: 1, price: 1, image: 1,
          preparationTime: 1, nutritionInfo: 1,
          averageRating: 1, totalRatings: 1
        }
      }
    ]);

    const userFavorites = await getUserFavorites(userId);

    const dishes = popularDishes.map(item => ({
      menuItemId: item._id,
      name: item.name,
      preparationTime: item.preparationTime || 30,
      isVeg: item.isVeg,
      nutritionInfo: item.nutritionInfo || {
        calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, servingSize: '1 serving'
      },
      rating: {
        average: item.averageRating || 0,
        count: item.totalRatings || 0
      },
      image: item.image || '',
      isFavorite: userFavorites.includes(item._id.toString())
    }));

    res.status(200).json({ popularDishes: dishes });
  } catch (err) {
    console.error('Get popular dishes error:', err);
    res.status(500).json({ message: 'Failed to fetch popular dishes' });
  }
};

// GET /api/home/items/:itemId
exports.getMenuItemDetails = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { itemId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: 'Invalid menu item ID' });
    }

    const menuItem = await MenuItem.findById(itemId)
      .populate('recommendedItems');

    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    // Check if user has favorited this item
    let isFavorite = false;
    if (userId) {
      const user = await User.findById(userId).select('favorites');
      if (user && user.favorites) {
        isFavorite = user.favorites.some(fav => fav.menuItem && fav.menuItem.toString() === itemId);
      }
    }

    // Get more dishes from the same category (top 5)
    const moreDishes = await MenuItem.find({
      category: menuItem.category,
      _id: { $ne: itemId }
    })
      .sort({ 'rating.average': -1 })
      .limit(5)
      .lean();

    // Check if more dishes are favorited
    const userFavorites = await getUserFavorites(userId);

    const formattedMoreDishes = moreDishes.map(dish => ({
      itemId: dish._id,
      name: dish.name,
      isVeg: dish.isVeg,
      isFavorite: userFavorites.includes(dish._id.toString()),
      rating: {
        average: dish.rating?.average || 0,
        count: dish.rating?.count || 0
      },
      preparationTime: dish.preparationTime || 30,
      mainPhoto: dish.photos?.main || '',
      additionalPhotos: dish.photos?.additional || []
    }));

    // Get pairing suggestions
    let pairingSuggestions = [];

    if (menuItem.recommendedItems && menuItem.recommendedItems.length > 0) {
      pairingSuggestions = menuItem.recommendedItems.map(item => ({
        itemId: item._id,
        name: item.name,
        category: item.category,
        isVeg: item.isVeg,
        price: item.price,
        photos: {
          main: item.photos?.main || '',
          additional: item.photos?.additional || []
        }
      }));
    } else if (menuItem.tags && menuItem.tags.length > 0) {
      // Algorithmic pairing based on complementary categories
      let complementaryCategories = [];
      // We'd need to resolve category names, but since category is an ObjectId,
      // just find items with similar tags from the same restaurant
      const suggestedItems = await MenuItem.find({
        _id: { $ne: itemId },
        tags: { $in: menuItem.tags }
      })
        .sort({ 'rating.average': -1 })
        .limit(4)
        .select('_id name category isVeg photos price')
        .lean();

      pairingSuggestions = suggestedItems.map(item => ({
        itemId: item._id,
        name: item.name,
        category: item.category,
        isVeg: item.isVeg,
        price: item.price,
        photos: {
          main: item.photos?.main || '',
          additional: item.photos?.additional || []
        }
      }));
    }

    // Determine if "Highly Popular"
    const isHighlyPopular = (
      (menuItem.rating?.count >= 10) &&
      (menuItem.rating?.average >= 4.2) &&
      (menuItem.popularity?.orderCount >= 50)
    );

    const response = {
      itemDetails: {
        name: menuItem.name,
        price: menuItem.price,
        isVeg: menuItem.isVeg,
        isFavorite,
        preparationTime: menuItem.preparationTime || 30,
        rating: {
          average: menuItem.rating?.average || 0,
          count: menuItem.rating?.count || 0
        },
        description: menuItem.description?.text || '',
        keyIngredients: menuItem.keyIngredients || [],
        allergens: menuItem.allergens || [],
        oilType: menuItem.oilType || 'Not specified',
        pairingSuggestions,
        isHighlyPopular,
        photos: {
          main: menuItem.photos?.main || '',
          additional: menuItem.photos?.additional || []
        }
      },
      moreDishes: formattedMoreDishes
    };

    res.status(200).json(response);
  } catch (err) {
    console.error('Get menu item details error:', err);
    res.status(500).json({ message: 'Failed to fetch menu item details' });
  }
};

// GET /api/home/categories
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .sort({ displayOrder: 1 })
      .select('name description image displayOrder')
      .lean();

    res.status(200).json({ success: true, data: categories });
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
};

// GET /api/home/banners
exports.getBanners = async (req, res) => {
  try {
    const now = new Date();
    const banners = await Banner.find({
      isActive: true,
      $or: [
        { startDate: { $exists: false }, endDate: { $exists: false } },
        { startDate: null, endDate: null },
        { startDate: { $lte: now }, endDate: { $gte: now } },
        { startDate: { $lte: now }, endDate: null },
        { startDate: null, endDate: { $gte: now } }
      ]
    })
      .sort({ displayOrder: 1 })
      .select('title image link type displayOrder')
      .lean();

    res.status(200).json({ success: true, data: banners });
  } catch (err) {
    console.error('Get banners error:', err);
    res.status(500).json({ message: 'Failed to fetch banners' });
  }
};

// GET /api/home/search?q=...&category=...&limit=20
exports.searchItems = async (req, res) => {
  try {
    const { q, category, limit = 20 } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const searchRegex = new RegExp(q.trim(), 'i');

    const query = {
      $or: [
        { name: searchRegex },
        { tags: searchRegex }
      ]
    };

    if (category && mongoose.Types.ObjectId.isValid(category)) {
      query.category = new mongoose.Types.ObjectId(category);
    }

    const items = await MenuItem.find(query)
      .sort({ 'rating.average': -1 })
      .limit(parseInt(limit))
      .select('name price isVeg image photos preparationTime rating tags category')
      .lean();

    const results = items.map(item => ({
      menuItemId: item._id,
      name: item.name,
      price: item.price,
      isVeg: item.isVeg,
      image: item.image || item.photos?.main || '',
      preparationTime: item.preparationTime || 30,
      rating: {
        average: item.rating?.average || 0,
        count: item.rating?.count || 0
      }
    }));

    res.status(200).json({ success: true, data: results });
  } catch (err) {
    console.error('Search items error:', err);
    res.status(500).json({ message: 'Failed to search items' });
  }
};
