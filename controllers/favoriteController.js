const User = require('../models/userModel');
const MenuItem = require('../models/menuItemModel');
const Restaurant = require('../models/restaurantModel');
const mongoose = require('mongoose');

// Add a menu item to favorites
exports.addToFavorites = async (req, res) => {
  const userId = req.user.id;
  const menuItemId = req.params.itemId;

  if (!menuItemId) {
    return res.status(400).json({ 
      message: "Menu item ID is required" 
    });
  }

  try {
    // Verify that the menu item exists
    const menuItem = await MenuItem.findById(menuItemId);
    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    // Check if item is already in favorites
    const user = await User.findById(userId);
    const alreadyFavorited = user.favorites.some(
      fav => fav.menuItem.toString() === menuItemId
    );

    if (alreadyFavorited) {
      return res.status(400).json({ message: "Item already in favorites" });
    }

    // Add to favorites
    await User.findByIdAndUpdate(userId, {
      $push: { 
        favorites: { 
          menuItem: menuItemId, 
          addedAt: new Date()
        } 
      }
    });

    res.status(201).json({ 
      success: true,
      message: "Item added to favorites successfully" 
    });
  } catch (error) {
    console.error('Error adding to favorites:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to add item to favorites', 
      error: error.message 
    });
  }
};

// Remove from favorites
exports.removeFromFavorites = async (req, res) => {
  const userId = req.user.id;
  const menuItemId = req.params.itemId;

  if (!menuItemId) {
    return res.status(400).json({ 
      message: "Menu item ID is required" 
    });
  }

  try {
    const result = await User.findByIdAndUpdate(userId, {
      $pull: { 
        favorites: { 
          menuItem: menuItemId
        } 
      }
    });

    if (!result) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ 
      success: true,
      message: "Removed from favorites" 
    });
  } catch (err) {
    console.error("Remove from favorites error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to remove from favorites" 
    });
  }
};

// Get all favorites for a user
exports.getAllFavorites = async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 20, sortBy = 'dateAdded', order = 'desc' } = req.query;

  try {
    const user = await User.findById(userId)
      .populate({
        path: 'favorites.menuItem',
        select: 'name description price isVeg category tags'
      });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Sort by most recently added
    let favorites = user.favorites.sort((a, b) => b.addedAt - a.addedAt);

    // Paginate results
    const paginatedFavorites = favorites.slice((page - 1) * limit, page * limit);

    res.status(200).json({ favorites: paginatedFavorites });
  } catch (err) {
    console.error("Fetch favorites error:", err);
    res.status(500).json({ message: "Failed to fetch favorites" });
  }
};

// Get all favorites from a specific restaurant for a user
exports.getRestaurantFavorites = async (req, res) => {
  const userId = req.user.id;
  const { restaurantId } = req.params;

  if (!restaurantId) {
    return res.status(400).json({ message: "Restaurant ID is required" });
  }

  try {
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Filter favorites by restaurant and populate menu item details
    const restaurantFavorites = await User.findById(userId)
      .populate({
        path: 'favorites.menuItem',
        select: 'name description price isVeg category tags',
        match: { restaurantId: restaurantId }
      })
      .select('favorites')
      .lean();

    // Filter out any null menuItems (happens when populate with match doesn't find matches)
    const filteredFavorites = restaurantFavorites.favorites.filter(fav => 
      fav.restaurantId.toString() === restaurantId && fav.menuItem !== null
    );

    res.status(200).json({ favorites: filteredFavorites });
  } catch (err) {
    console.error("Fetch restaurant favorites error:", err);
    res.status(500).json({ message: "Failed to fetch restaurant favorites" });
  }
};

// Check if a menu item is in favorites
exports.checkFavorite = async (req, res) => {
  const userId = req.user.id;
  const menuItemId = req.params.itemId;

  try {
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isFavorite = user.favorites.some(fav => 
      fav.menuItem.toString() === menuItemId
    );

    res.status(200).json({ 
      success: true,
      isFavorite 
    }); 
  } catch (err) {
    console.error("Check favorite error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to check favorite status" 
    });
  }
};