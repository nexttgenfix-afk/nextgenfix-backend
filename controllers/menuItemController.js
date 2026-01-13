const { MenuItem } = require('../models/menuItemModel');
const Order = require('../models/orderModel');
const Rating = require('../models/ratingModel');
const Category = require('../models/categoryModel'); // Add this import
const mongoose = require('mongoose');
const Restaurant = require('../models/restaurantModel'); // Add this import

// Toggle menu item special status (Chef-specific - REMOVED)
exports.toggleMenuItemSpecial = async (req, res) => {
  return res.status(410).json({ message: "Chef features have been removed from this platform" });
};

// Update multiple menu items availability status (Chef-specific - REMOVED)
exports.updateMenuItemsAvailability = async (req, res) => {
  return res.status(410).json({ message: "Chef features have been removed from this platform" });
};


// Get chef menu items with advanced filtering, sorting, and pagination
exports.getChefMenuItemsAdvanced = async (req, res) => {
  try {
    const { chefId } = req.params;
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search = '',
      category = '',
      status = '',
      priceMin,
      priceMax,
      isAvailable,
      isSpecial,
      isVeg
    } = req.query;
    
    // Validate chef exists
    if (!mongoose.Types.ObjectId.isValid(chefId)) {
      return res.status(400).json({ message: "Invalid chef ID format" });
    }
    
    const chef = await Chef.findById(chefId);
    if (!chef) {
      return res.status(404).json({ message: "Chef not found" });
    }
    
    // Build filter object
    const filter = { chefId };
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) {
      filter.category = category;
    }
    
    if (status) {
      filter.status = status;
    }
    
    if (priceMin !== undefined && priceMax !== undefined) {
      filter.price = { $gte: Number(priceMin), $lte: Number(priceMax) };
    } else if (priceMin !== undefined) {
      filter.price = { $gte: Number(priceMin) };
    } else if (priceMax !== undefined) {
      filter.price = { $lte: Number(priceMax) };
    }
    
    if (isAvailable !== undefined) {
      filter.isAvailable = isAvailable === 'true';
    }
    
    if (isSpecial !== undefined) {
      filter.isSpecial = isSpecial === 'true';
    }
    
    if (isVeg !== undefined) {
      filter.isVeg = isVeg === 'true';
    }
    
    // Create sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    // Execute query
    const menuItems = await MenuItem.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean();
    
    // Get total count for pagination
    const totalItems = await MenuItem.countDocuments(filter);
    
    // Get item performance data
    const itemIds = menuItems.map(item => item._id);
    
    // Get order counts for each item
    const orderCounts = await Order.aggregate([
      { $match: { 'items.menuItem': { $in: itemIds } } },
      { $unwind: '$items' },
      { $match: { 'items.menuItem': { $in: itemIds } } },
      { $group: {
          _id: '$items.menuItem',
          orderCount: { $sum: 1 },
          totalQuantity: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
        }
      }
    ]);
    
    // Create a map for quick lookup
    const itemStatsMap = {};
    orderCounts.forEach(item => {
      itemStatsMap[item._id.toString()] = {
        orderCount: item.orderCount,
        totalQuantity: item.totalQuantity,
        revenue: item.revenue
      };
    });
    
    // Get ratings for each menu item
    const ratings = await Rating.aggregate([
      { $match: { menuItemId: { $in: itemIds } } },
      { $group: {
          _id: '$menuItemId',
          avgRating: { $avg: '$rating' },
          ratingCount: { $sum: 1 }
        }
      }
    ]);
    
    // Add to the map
    ratings.forEach(rating => {
      if (!itemStatsMap[rating._id.toString()]) {
        itemStatsMap[rating._id.toString()] = {};
      }
      
      itemStatsMap[rating._id.toString()].avgRating = rating.avgRating;
      itemStatsMap[rating._id.toString()].ratingCount = rating.ratingCount;
    });
    
    // Enhance menu items with performance data
    const enhancedMenuItems = menuItems.map(item => {
      const stats = itemStatsMap[item._id.toString()] || {
        orderCount: 0,
        totalQuantity: 0,
        revenue: 0,
        avgRating: 0,
        ratingCount: 0
      };
      
      return {
        ...item,
        performance: {
          orderCount: stats.orderCount || 0,
          totalQuantity: stats.totalQuantity || 0,
          revenue: stats.revenue || 0,
          avgRating: stats.avgRating || 0,
          ratingCount: stats.ratingCount || 0
        }
      };
    });
    
    // Get unique categories for filtering
    const categories = await MenuItem.distinct('category', { chefId });
    
    res.status(200).json({
      totalItems,
      totalPages: Math.ceil(totalItems / Number(limit)),
      currentPage: Number(page),
      menuItems: enhancedMenuItems,
      filters: {
        categories
      }
    });
  } catch (err) {
    console.error('Error fetching chef menu items:', err);
    res.status(500).json({ message: "Failed to fetch menu items", error: err.message });
  }
};

// Get menu item by ID
exports.getMenuItemById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid menu item ID format" });
    }
    
    let itemQuery = MenuItem.findById(id).populate('restaurantId', 'name location rating profilePicture');
    if (MenuItem.schema.path('chefId')) itemQuery = itemQuery.populate('chefId', 'name kitchenName location rating profilePicture');
    const menuItem = await itemQuery;
    
    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }
    
    // Determine source type (restaurant or chef)
    let sourceType = null;
    let source = null;
    
    if (menuItem.restaurantId) {
      sourceType = 'restaurant';
      source = menuItem.restaurantId;
    } else if (menuItem.chefId) {
      sourceType = 'chef';
      source = menuItem.chefId;
    }
    
    // Format response
    const response = {
      ...menuItem.toObject(),
      sourceType,
      source
    };
    
    res.status(200).json(response);
  } catch (err) {
    console.error('Error fetching menu item:', err);
    res.status(500).json({ message: "Failed to fetch menu item details", error: err.message });
  }
};

// Get menu items by source (restaurant or chef) with filtering
exports.getMenuItemsBySource = async (req, res) => {
  try {
    const { sourceId } = req.params;
    const sourceType = req.path.includes('/restaurant/') ? 'restaurant' : 'chef';
    const { 
      isVeg, 
      minPrice, 
      maxPrice, 
      categoryId,
      search,
      sort = 'popularity', // Default sort by popularity
      page = 1,
      limit = 20
    } = req.query;
    
    if (!mongoose.Types.ObjectId.isValid(sourceId)) {
      return res.status(400).json({ message: `Invalid ${sourceType} ID format` });
    }
    
    // Build match conditions
    const filterField = sourceType === 'restaurant' ? 'restaurantId' : 'chefId';
    const match = { 
      [filterField]: new mongoose.Types.ObjectId(sourceId),
      isAvailable: true
    };
    
    // Apply filters
    if (isVeg === 'true') match.isVeg = true;
    if (isVeg === 'false') match.isVeg = false;
    
    if (minPrice && !isNaN(minPrice)) match.price = { $gte: Number(minPrice) };
    if (maxPrice && !isNaN(maxPrice)) {
      if (match.price) match.price.$lte = Number(maxPrice);
      else match.price = { $lte: Number(maxPrice) };
    }
    
    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
      match.category = new mongoose.Types.ObjectId(categoryId);
    }
    
    if (search) {
      match.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    
    // Determine sort field
    let sortField = {};
    switch (sort) {
      case 'price_asc':
        sortField = { price: 1 };
        break;
      case 'price_desc':
        sortField = { price: -1 };
        break;
      case 'rating':
        sortField = { 'rating.average': -1 };
        break;
      case 'newest':
        sortField = { createdAt: -1 };
        break;
      case 'popularity':
      default:
        sortField = { 'popularity.orderCount': -1 };
        break;
    }
    
    // First get all categories with their items
    const categories = await Category.find({ 
      [filterField]: sourceId,
      isActive: true 
    }).sort({ displayOrder: 1 });
    
    const categoryIds = categories.map(cat => cat._id);
    
    // If filtering by categoryId, ensure it's a valid category for this source
    if (categoryId && !categoryIds.some(id => id.toString() === categoryId)) {
      return res.status(400).json({ message: "Invalid category for this source" });
    }
    
    // Find menu items by categories
    const pipeline = [
      { $match: match },
      { 
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryDetails'
        }
      },
      { $unwind: { path: '$categoryDetails', preserveNullAndEmptyArrays: true } },
      {
        $sort: {
          'categoryDetails.displayOrder': 1,
          ...sortField,
          displayOrder: 1,
          name: 1
        }
      },
      {
        $group: {
          _id: "$category",
          categoryName: { $first: "$categoryDetails.name" },
          displayOrder: { $first: "$categoryDetails.displayOrder" },
          items: { $push: "$$ROOT" }
        }
      },
      { $sort: { displayOrder: 1, categoryName: 1 } }
    ];
    
    // Execute the aggregation
    const menuByCategory = await MenuItem.aggregate(pipeline);
    
    // Get source details
    const sourceModel = sourceType === 'restaurant' ? Restaurant : Chef;
    const source = await sourceModel.findById(sourceId).select('name kitchenName profilePicture rating');
    const sourceName = sourceType === 'restaurant' ? source.name : `${source.name} (${source.kitchenName})`;
    
    // Format response with categories that have items
    const formattedCategories = menuByCategory.map(category => {
      return {
        _id: category._id,
        name: category.categoryName,
        items: category.items.map(item => {
          // Clean up each item by removing categoryDetails
          const { categoryDetails, ...cleanItem } = item;
          return cleanItem;
        })
      };
    });
    
    res.status(200).json({
      source: {
        _id: sourceId,
        name: sourceName,
        profilePicture: source.profilePicture,
        rating: source.rating,
        type: sourceType
      },
      categories: formattedCategories,
      totalCategories: formattedCategories.length,
      totalItems: formattedCategories.reduce((acc, category) => acc + category.items.length, 0)
    });
  } catch (err) {
    console.error(`Error fetching menu items:`, err);
    res.status(500).json({ message: `Failed to fetch menu items`, error: err.message });
  }
};

// Get similar menu items
exports.getSimilarMenuItems = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 5 } = req.query;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid menu item ID format" });
    }
    
    // Get the reference menu item
    const menuItem = await MenuItem.findById(id);
    
    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }
    
    // Build query for similar items
    const query = {
      _id: { $ne: id }, // Exclude the current item
      $or: [
        // Same category
        { category: menuItem.category },
        // Similar price range (±20%)
        {
          price: {
            $gte: menuItem.price * 0.8,
            $lte: menuItem.price * 1.2
          }
        }
      ]
    };
    
    // Add source filter (either same restaurant or same chef)
    if (menuItem.restaurantId) {
      query.restaurantId = menuItem.restaurantId;
    } else if (menuItem.chefId) {
      query.chefId = menuItem.chefId;
    }
    
    // Find similar items
    const similarItems = await MenuItem.find(query)
      .limit(parseInt(limit))
      .populate('restaurantId', 'name')
      .populate('chefId', 'name kitchenName');
    
    res.status(200).json(similarItems);
  } catch (err) {
    console.error('Error fetching similar menu items:', err);
    res.status(500).json({ message: "Failed to fetch similar menu items", error: err.message });
  }
};

// Rate all menu items in an order
exports.rateMenuItem = async (req, res) => {
  try {
    const { orderId, rating } = req.body;
    const userId = req.user && req.user._id ? req.user._id : req.body.userId;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: 'Invalid orderId' });
    }
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Find the order and check status
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status !== 'delivered') {
      return res.status(400).json({ message: 'Order must be delivered to rate menu items' });
    }

    // Loop through all menu items in the order
    let ratedItems = [];
    for (const item of order.items) {
      const menuItemId = item.itemId;
      // Prevent duplicate rating for same user/order/menuItem
      const existing = await Rating.findOne({ user: userId, orderId, menuItemId });
      if (existing) continue; // Skip if already rated

      // Fetch the menu item to get restaurantId or chefId
      const menuItem = await MenuItem.findById(menuItemId);
      if (!menuItem) continue;
      const ratingData = {
        user: userId,
        orderId,
        menuItemId,
        rating
      };
      if (menuItem.restaurantId) ratingData.restaurantId = menuItem.restaurantId;
      if (menuItem.chefId) ratingData.chefId = menuItem.chefId;

      // Save the rating
      await Rating.create(ratingData);
      ratedItems.push(menuItemId);

      // Update menu item's average rating and count
      const ratings = await Rating.find({ menuItemId });
      const count = ratings.length;
      const average = ratings.reduce((sum, r) => sum + r.rating, 0) / (count || 1);
      await MenuItem.findByIdAndUpdate(menuItemId, { $set: { 'rating.average': average, 'rating.count': count } });
    }

    res.status(200).json({ message: 'Rating submitted for all items in order', ratedItems });
  } catch (err) {
    console.error('Error rating menu items:', err);
    res.status(500).json({ message: 'Failed to rate menu items', error: err.message });
  }
};

// Create a new menu item
exports.createMenuItem = async (req, res) => {
  try {
    const { 
      name, descriptionText, formatting, price, isVeg, category, 
      restaurantId, chefId, keyIngredients, allergens, 
      oilType, customizationOptions, preparationTime, 
      tags, nutritionInfo, photos
    } = req.body;

    if (!name || !descriptionText || !price || isVeg === undefined || !category) {
      return res.status(400).json({ 
        message: "Required fields missing: name, descriptionText, price, isVeg, and category are required" 
      });
    }

    if ((!restaurantId && !chefId) || (restaurantId && chefId)) {
      return res.status(400).json({ 
        message: "Either restaurantId or chefId must be provided, but not both" 
      });
    }

    const newMenuItem = new MenuItem({
      name,
      description: {
        text: descriptionText,
        formatting: formatting || "PlainText"
      },
      price,
      isVeg,
      category,
      restaurantId: restaurantId || undefined,
      chefId: chefId || undefined,
      keyIngredients: keyIngredients || [],
      allergens: allergens || [],
      oilType: oilType || "No oil used",
      customizationOptions: customizationOptions || {},
      preparationTime: preparationTime || 30,
      tags: tags || [],
      nutritionInfo: nutritionInfo || {},
      photos: photos || { main: "", additional: [] }
    });

    await newMenuItem.save();

    res.status(201).json({ 
      message: "Menu item created successfully", 
      menuItem: newMenuItem 
    });
  } catch (err) {
    console.error('Error creating menu item:', err);
    res.status(500).json({ message: "Failed to create menu item", error: err.message });
  }
};

// Update a menu item
exports.updateMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid menu item ID format" });
    }
    
    // Prevent changing both restaurantId and chefId
    if (updateData.restaurantId && updateData.chefId) {
      return res.status(400).json({ 
        message: "Cannot update both restaurantId and chefId" 
      });
    }
    
    const updatedMenuItem = await MenuItem.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    if (!updatedMenuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }
    
    res.status(200).json({ 
      message: "Menu item updated successfully", 
      menuItem: updatedMenuItem 
    });
  } catch (err) {
    console.error('Error updating menu item:', err);
    res.status(500).json({ message: "Failed to update menu item", error: err.message });
  }
};

// Delete a menu item
exports.deleteMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid menu item ID format" });
    }
    
    const deletedMenuItem = await MenuItem.findByIdAndDelete(id);
    
    if (!deletedMenuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }
    
    res.status(200).json({ 
      message: "Menu item deleted successfully" 
    });
  } catch (err) {
    console.error('Error deleting menu item:', err);
    res.status(500).json({ message: "Failed to delete menu item", error: err.message });
  }
};

// Upload photos for a menu item
exports.uploadMenuItemPhotos = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid menu item ID format" });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    // Get uploaded file URLs from Cloudinary
    const uploadedPhotos = req.files.map(file => file.path);

    // Get the menu item
    const menuItem = await MenuItem.findById(id);
    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    // First photo becomes main if no main exists
    if (!menuItem.photos.main && uploadedPhotos.length > 0) {
      menuItem.photos.main = uploadedPhotos[0];
      // Remove it from the array to avoid duplication
      uploadedPhotos.shift();
    }

    // Add remaining photos to additional array
    if (uploadedPhotos.length > 0) {
      menuItem.photos.additional = [
        ...(menuItem.photos.additional || []),
        ...uploadedPhotos
      ];
    }

    await menuItem.save();

    res.status(200).json({
      message: "Photos uploaded successfully",
      photos: menuItem.photos
    });
  } catch (err) {
    console.error('Error uploading photos:', err);
    res.status(500).json({ message: "Failed to upload photos", error: err.message });
  }
};

// Update description of a menu item
exports.updateDescription = async (req, res) => {
  const { id } = req.params;
  const { text, formatting } = req.body;

  try {
    const menuItem = await MenuItem.findById(id);
    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    menuItem.description = {
      text: text || menuItem.description.text,
      formatting: formatting || menuItem.description.formatting
    };

    await menuItem.save();
    res.status(200).json({ message: "Description updated successfully", description: menuItem.description });
  } catch (err) {
    console.error("Error updating description:", err);
    res.status(500).json({ message: "Failed to update description", error: err.message });
  }
};

// Preview description of a menu item
exports.previewDescription = async (req, res) => {
  const { id } = req.params;

  try {
    const menuItem = await MenuItem.findById(id).select('description');
    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    res.status(200).json({ description: menuItem.description });
  } catch (err) {
    console.error("Error fetching description preview:", err);
    res.status(500).json({ message: "Failed to fetch description preview", error: err.message });
  }
};

// Search and filter menu items by mood and hunger level tags (User-facing)
exports.searchMenuItems = async (req, res) => {
  try {
    const {
      search,
      moodTag,
      hungerLevelTag,
      category,
      isVeg,
      minPrice,
      maxPrice,
      isAvailable,
      sort = 'popularity',
      page = 1,
      limit = 20
    } = req.query;

    // Build filter object
    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'description.text': { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    if (moodTag && moodTag !== 'Unknown') {
      filter.moodTag = moodTag;
    }

    if (hungerLevelTag && hungerLevelTag !== 'Unknown') {
      filter.hungerLevelTag = hungerLevelTag;
    }

    if (category && mongoose.Types.ObjectId.isValid(category)) {
      filter.category = category;
    }

    if (isVeg !== undefined) {
      filter.isVeg = isVeg === 'true';
    }

    if (minPrice && !isNaN(minPrice)) {
      filter.price = { $gte: Number(minPrice) };
    }
    if (maxPrice && !isNaN(maxPrice)) {
      if (filter.price) filter.price.$lte = Number(maxPrice);
      else filter.price = { $lte: Number(maxPrice) };
    }

    if (isAvailable !== undefined) {
      filter.isAvailable = isAvailable === 'true';
    } else {
      // By default, only show available items
      filter.isAvailable = true;
    }

    // Add active special offer check
    const now = new Date();
    if (!filter.$and) filter.$and = [];
    filter.$and.push({
      $or: [
        { 'specialOffer.isSpecial': { $ne: true } },
        { 
          'specialOffer.isSpecial': true,
          'specialOffer.validFrom': { $lte: now },
          'specialOffer.validUntil': { $gte: now }
        }
      ]
    });

    // Determine sort field
    let sortField = {};
    switch (sort) {
      case 'price_asc':
        sortField = { price: 1 };
        break;
      case 'price_desc':
        sortField = { price: -1 };
        break;
      case 'rating':
        sortField = { 'rating.average': -1 };
        break;
      case 'newest':
        sortField = { createdAt: -1 };
        break;
      case 'name':
        sortField = { name: 1 };
        break;
      case 'popularity':
      default:
        sortField = { 'popularity.orderCount': -1 };
        break;
    }

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Execute query
    const [menuItems, totalItems] = await Promise.all([
      MenuItem.find(filter)
        .populate('category', 'name')
        .sort(sortField)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      MenuItem.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      totalItems,
      totalPages: Math.ceil(totalItems / Number(limit)),
      currentPage: Number(page),
      menuItems
    });
  } catch (err) {
    console.error('Error searching menu items:', err);
    res.status(500).json({ 
      success: false,
      message: "Failed to search menu items", 
      error: err.message 
    });
  }
};

// Get menu items by mood tag (User-facing)
exports.getMenuItemsByMood = async (req, res) => {
  try {
    const { mood } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const validMoodTags = ['good', 'angry', 'in_love', 'sad'];
    if (!validMoodTags.includes(mood)) {
      return res.status(400).json({ 
        success: false,
        message: `Invalid mood tag. Must be one of: ${validMoodTags.join(', ')}` 
      });
    }

    const skip = (Number(page) - 1) * Number(limit);
    const now = new Date();
    const query = { 
      moodTag: mood, 
      isAvailable: true,
      $or: [
        { 'specialOffer.isSpecial': { $ne: true } },
        { 
          'specialOffer.isSpecial': true,
          'specialOffer.validFrom': { $lte: now },
          'specialOffer.validUntil': { $gte: now }
        }
      ]
    };

    const [menuItems, totalItems] = await Promise.all([
      MenuItem.find(query)
        .populate('category', 'name')
        .sort({ 'popularity.orderCount': -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      MenuItem.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      mood,
      totalItems,
      totalPages: Math.ceil(totalItems / Number(limit)),
      currentPage: Number(page),
      menuItems
    });
  } catch (err) {
    console.error('Error fetching menu items by mood:', err);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch menu items by mood", 
      error: err.message 
    });
  }
};

// Get menu items by hunger level (User-facing)
exports.getMenuItemsByHungerLevel = async (req, res) => {
  try {
    const { level } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const validHungerLevels = ['little_hungry', 'quite_hungry', 'very_hungry', 'super_hungry'];
    if (!validHungerLevels.includes(level)) {
      return res.status(400).json({ 
        success: false,
        message: `Invalid hunger level. Must be one of: ${validHungerLevels.join(', ')}` 
      });
    }

    const skip = (Number(page) - 1) * Number(limit);
    const now = new Date();
    const query = { 
      hungerLevelTag: level, 
      isAvailable: true,
      $or: [
        { 'specialOffer.isSpecial': { $ne: true } },
        { 
          'specialOffer.isSpecial': true,
          'specialOffer.validFrom': { $lte: now },
          'specialOffer.validUntil': { $gte: now }
        }
      ]
    };

    const [menuItems, totalItems] = await Promise.all([
      MenuItem.find(query)
        .populate('category', 'name')
        .sort({ 'popularity.orderCount': -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      MenuItem.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      hungerLevel: level,
      totalItems,
      totalPages: Math.ceil(totalItems / Number(limit)),
      currentPage: Number(page),
      menuItems
    });
  } catch (err) {
    console.error('Error fetching menu items by hunger level:', err);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch menu items by hunger level", 
      error: err.message 
    });
  }
};