const MenuItem = require('../models/menuItemModel');
const Category = require('../models/categoryModel');
const { uploadImage, deleteImage } = require('../services/cloudinary');
const { getPersonalizedRecommendations } = require('../services/recommendation');

// Get all menu items
const getAllMenuItems = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      minPrice,
      maxPrice,
      isVeg,
      isAvailable = true
    } = req.query;

    const now = new Date();
    let query = { 
      isAvailable,
      $and: [
        {
          $or: [
            { 'specialOffer.isSpecial': { $ne: true } },
            { 
              'specialOffer.isSpecial': true,
              'specialOffer.validFrom': { $lte: now },
              'specialOffer.validUntil': { $gte: now }
            }
          ]
        }
      ]
    };

    // Add filters
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }
    if (isVeg !== undefined) query.isVeg = isVeg === 'true';

    // Sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Build query and only populate chefId if it exists in the schema
    let menuQuery = MenuItem.find(query).populate('category', 'name');
    const menuItems = await menuQuery
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await MenuItem.countDocuments(query);

    res.json({
      menuItems,
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

// Get categories
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .sort({ order: 1, name: 1 });

    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get personalized recommendations
const getRecommendations = async (req, res) => {
  try {
    const userId = req.user?.id;
    const recommendations = await getPersonalizedRecommendations(userId);

    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get trending items
const getTrendingItems = async (req, res) => {
  try {
    const now = new Date();
    const query = {
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
    let trendingQuery = MenuItem.find(query).sort({ orderCount: -1, rating: -1 }).limit(10).populate('category', 'name');
    const trendingItems = await trendingQuery;

    res.json(trendingItems);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Search menu items
const searchMenuItems = async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const searchRegex = new RegExp(q, 'i');
    const now = new Date();

    let searchQuery = MenuItem.find({
      isAvailable: true,
      $and: [
        {
          $or: [
            { name: searchRegex },
            { description: searchRegex },
            { tags: { $in: [searchRegex] } }
          ]
        },
        {
          $or: [
            { 'specialOffer.isSpecial': { $ne: true } },
            { 
              'specialOffer.isSpecial': true,
              'specialOffer.validFrom': { $lte: now },
              'specialOffer.validUntil': { $gte: now }
            }
          ]
        }
      ]
    });
    searchQuery = searchQuery.populate('category', 'name');
    const menuItems = await searchQuery.limit(parseInt(limit)).sort({ rating: -1, orderCount: -1 });

    res.json(menuItems);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get menu item by ID
const getMenuItemById = async (req, res) => {
  try {
    let itemQuery = MenuItem.findById(req.params.id).populate('category', 'name').populate('reviews.userId', 'name');
    const menuItem = await itemQuery;

    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    res.json(menuItem);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create menu item (Admin only)
const createMenuItem = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category,
      isVeg,
      preparationTime,
      ingredients,
      nutritionalInfo,
      tags,
      allergens
    } = req.body;

    // Handle image upload
    let imageUrl = null;
    if (req.file) {
      // If multer-storage-cloudinary was used it already uploaded the file and
      // populated req.file with cloud info (path / secure_url / url).
      if (req.file.path || req.file.secure_url || req.file.url) {
        imageUrl = req.file.path || req.file.secure_url || req.file.url;
      } else if (req.file.location) {
        imageUrl = req.file.location;
      } else if (req.file.buffer) {
        // Fallback: upload via service (used with memory storage)
        const result = await uploadImage(req.file.buffer, 'menu-items');
        imageUrl = result?.url || result;
      }
    }

    // Basic validation for required fields per schema
    if (!name) return res.status(400).json({ message: 'Name is required' });

    // Description in schema is an object { text, formatting }
    let descriptionObj = null;
    if (description) {
      if (typeof description === 'string') {
        descriptionObj = { text: description, formatting: 'PlainText' };
      } else if (typeof description === 'object') {
        descriptionObj = description;
      }
    }
    if (!descriptionObj || !descriptionObj.text) {
      return res.status(400).json({ message: 'Description text is required' });
    }

    // Allow image via upload or image URL field
    if (!imageUrl && req.body.image) {
      imageUrl = req.body.image;
    }
    if (!imageUrl) {
      return res.status(400).json({ message: 'Image is required' });
    }

    // Price must be a number
    const priceNum = parseFloat(price);
    if (isNaN(priceNum)) return res.status(400).json({ message: 'Valid price is required' });

    // Category must be a Category ObjectId
    const mongoose = require('mongoose');
    if (!category || !mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({ message: 'Valid category id is required' });
    }

    const menuItemData = {
      name,
      description: descriptionObj,
      price: priceNum,
      category,
      image: imageUrl,
      isVeg: isVeg === 'true',
      ingredients,
      nutritionalInfo,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      allergens: allergens ? allergens.split(',').map(allergen => allergen.trim()) : []
    };

    // preparationTime is optional — only set when valid
    const prep = preparationTime !== undefined ? parseInt(preparationTime) : undefined;
    if (prep !== undefined && !isNaN(prep)) menuItemData.preparationTime = prep;

    const menuItem = await MenuItem.create(menuItemData);

  await menuItem.populate('category', 'name');

    res.status(201).json({
      message: 'Menu item created successfully',
      menuItem
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update menu item (Admin only)
const updateMenuItem = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category,
      isVeg,
      preparationTime,
      ingredients,
      nutritionalInfo,
      tags,
      allergens,
      isAvailable
    } = req.body;

    const menuItem = await MenuItem.findById(req.params.id);
    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    // Handle image upload
    if (req.file) {
      // Delete old image if exists
      if (menuItem.image) {
        await deleteImage(menuItem.image);
      }
      if (req.file.path || req.file.secure_url || req.file.url) {
        menuItem.image = req.file.path || req.file.secure_url || req.file.url;
      } else if (req.file.location) {
        menuItem.image = req.file.location;
      } else if (req.file.buffer) {
        const result = await uploadImage(req.file.buffer, 'menu-items');
        menuItem.image = result?.url || result;
      }
    }

    // Update fields
    if (name) menuItem.name = name;
    if (description) {
      if (typeof description === 'string') {
        menuItem.description = { text: description, formatting: 'PlainText' };
      } else {
        menuItem.description = description;
      }
    }
    if (price) menuItem.price = parseFloat(price);
    if (category) {
      const mongoose = require('mongoose');
      if (!mongoose.Types.ObjectId.isValid(category)) {
        return res.status(400).json({ message: 'Invalid category id' });
      }
      menuItem.category = category;
    }
    if (isVeg !== undefined) menuItem.isVeg = isVeg === 'true';
    if (preparationTime !== undefined) {
      const p = parseInt(preparationTime);
      if (!isNaN(p)) menuItem.preparationTime = p;
    }
    if (ingredients) menuItem.ingredients = ingredients;
    if (nutritionalInfo) menuItem.nutritionalInfo = nutritionalInfo;
    if (tags) menuItem.tags = tags.split(',').map(tag => tag.trim());
    if (allergens) menuItem.allergens = allergens.split(',').map(allergen => allergen.trim());
    if (isAvailable !== undefined) menuItem.isAvailable = isAvailable === 'true';

    await menuItem.save();
    await menuItem.populate('category', 'name');

    res.json({
      message: 'Menu item updated successfully',
      menuItem
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete menu item (Admin only)
const deleteMenuItem = async (req, res) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id);
    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    // Delete image if exists
    if (menuItem.image) {
      await deleteImage(menuItem.image);
    }

    await MenuItem.findByIdAndDelete(req.params.id);

    res.json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create category (Admin only)
const createCategory = async (req, res) => {
  try {
    const { name, description, image, order, isActive } = req.body;

    // Handle image upload
    let imageUrl = null;
    if (req.file) {
      if (req.file.path || req.file.secure_url || req.file.url) {
        imageUrl = req.file.path || req.file.secure_url || req.file.url;
      } else if (req.file.location) {
        imageUrl = req.file.location;
      } else if (req.file.buffer) {
        const result = await uploadImage(req.file.buffer, 'categories');
        imageUrl = result?.url || result;
      }
    }

    const category = await Category.create({
      name,
      description,
      image: imageUrl,
      order: parseInt(order) || 0,
      isActive: isActive !== 'false'
    });

    res.status(201).json({
      message: 'Category created successfully',
      category
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update category (Admin only)
const updateCategory = async (req, res) => {
  try {
    const { name, description, order, isActive } = req.body;

    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Handle image upload
    if (req.file) {
      if (category.image) {
        await deleteImage(category.image);
      }
      if (req.file.path || req.file.secure_url || req.file.url) {
        category.image = req.file.path || req.file.secure_url || req.file.url;
      } else if (req.file.location) {
        category.image = req.file.location;
      } else if (req.file.buffer) {
        const result = await uploadImage(req.file.buffer, 'categories');
        category.image = result?.url || result;
      }
    }

    // Update fields
    if (name) category.name = name;
    if (description) category.description = description;
    if (order !== undefined) category.order = parseInt(order);
    if (isActive !== undefined) category.isActive = isActive === 'true';

    await category.save();

    res.json({
      message: 'Category updated successfully',
      category
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete category (Admin only)
const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Check if category has menu items
    const menuItemsCount = await MenuItem.countDocuments({ category: req.params.id });
    if (menuItemsCount > 0) {
      return res.status(400).json({
        message: 'Cannot delete category with existing menu items'
      });
    }

    // Delete image if exists
    if (category.image) {
      await deleteImage(category.image);
    }

    await Category.findByIdAndDelete(req.params.id);

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getAllMenuItems,
  getCategories,
  getRecommendations,
  getTrendingItems,
  searchMenuItems,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  createCategory,
  updateCategory,
  deleteCategory
};