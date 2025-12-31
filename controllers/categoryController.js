const Category = require('../models/categoryModel');
const MenuItem = require('../models/menuItemModel');
const mongoose = require('mongoose');

// Get all categories
exports.getAllCategories = async (req, res) => {
  try {
    const { isActive } = req.query;
    
    const filter = {};
    
    // Filter by active status if provided
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    const categories = await Category.find(filter)
      .sort({ displayOrder: 1, name: 1 });
    
    res.status(200).json({ 
      success: true,
      categories,
      total: categories.length
    });
  } catch (err) {
    console.error('Error fetching all categories:', err);
    res.status(500).json({ message: "Failed to fetch categories", error: err.message });
  }
};

// Get category by ID
exports.getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid category ID format" });
    }
    
    const category = await Category.findById(id);
    
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    
    res.status(200).json({ 
      success: true,
      category 
    });
  } catch (err) {
    console.error('Error fetching category by ID:', err);
    res.status(500).json({ message: "Failed to fetch category", error: err.message });
  }
};

// Get menu items for a category
exports.getCategoryItems = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      page = 1, 
      limit = 20,
      isAvailable,
      isVeg,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid category ID format" });
    }
    
    // Check if category exists
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    
    // Build filter for menu items
    const filter = { category: id };
    
    if (isAvailable !== undefined) {
      filter.isAvailable = isAvailable === 'true';
    }
    
    if (isVeg !== undefined) {
      filter.isVeg = isVeg === 'true';
    }
    
    // Build sort option
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get menu items
    const menuItems = await MenuItem.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count
    const total = await MenuItem.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      category: {
        id: category._id,
        name: category.name,
        description: category.description
      },
      menuItems,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
        hasMore: skip + menuItems.length < total
      }
    });
  } catch (err) {
    console.error('Error fetching category items:', err);
    res.status(500).json({ message: "Failed to fetch category items", error: err.message });
  }
};

// Toggle category status (active/inactive)
exports.toggleCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid category ID format" });
    }
    
    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    
    // Toggle the status
    category.isActive = !category.isActive;
    await category.save();
    
    res.status(200).json({ 
      success: true,
      message: `Category ${category.isActive ? 'activated' : 'deactivated'} successfully`,
      category: {
        id: category._id,
        name: category.name,
        isActive: category.isActive
      }
    });
  } catch (err) {
    console.error('Error toggling category status:', err);
    res.status(500).json({ message: "Failed to toggle category status", error: err.message });
  }
};

// Get all categories for a restaurant/chef (legacy)
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ 
      isActive: true 
    }).sort({ displayOrder: 1, name: 1 });
    
    res.status(200).json({ 
      categories,
      total: categories.length
    });
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ message: "Failed to fetch categories", error: err.message });
  }
};

// Create a new category
exports.createCategory = async (req, res) => {
  try {
    const { name, description, displayOrder, image } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Category name is required" });
    }

    const categoryData = {
      name,
      description,
      displayOrder: displayOrder || 0
    };
    
    // Add image if uploaded
    if (req.file) {
      categoryData.image = req.file.path;
    } else if (image) {
      categoryData.image = image;
    }
    
    const newCategory = new Category(categoryData);
    await newCategory.save();
    
    res.status(201).json({ 
      success: true,
      message: "Category created successfully", 
      category: newCategory 
    });
  } catch (err) {
    console.error('Error creating category:', err);
    res.status(500).json({ message: "Failed to create category", error: err.message });
  }
};

// Update a category
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, displayOrder, isActive } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid category ID format" });
    }
    
    // Load category first so we can perform ownership check
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    // Add image if uploaded
    if (req.file) {
      updateData.image = req.file.path;
    }

    // Apply updates and save
    Object.assign(category, updateData);
    await category.save();
    const updatedCategory = category;
    
    res.status(200).json({ 
      message: "Category updated successfully", 
      category: updatedCategory 
    });
  } catch (err) {
    console.error('Error updating category:', err);
    res.status(500).json({ message: "Failed to update category", error: err.message });
  }
};

// Delete a category
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid category ID format" });
    }
    // Load category to perform ownership check
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    const defaultRestaurantId = process.env.DEFAULT_RESTAURANT_ID || null;
    const resolvedRestaurantId = req.body?.restaurantId || req.query?.restaurantId || defaultRestaurantId;
    if (resolvedRestaurantId) {
      if (!mongoose.Types.ObjectId.isValid(resolvedRestaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID format' });
      }
      if (category.restaurantId && category.restaurantId.toString() !== resolvedRestaurantId) {
        return res.status(403).json({ message: 'Permission denied for this restaurant' });
      }
    }

    const deletedCategory = await Category.findByIdAndDelete(id);

    if (!deletedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }
    
    res.status(200).json({ 
      message: "Category deleted successfully" 
    });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ message: "Failed to delete category", error: err.message });
  }
};