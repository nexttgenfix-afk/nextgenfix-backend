const Category = require('../models/categoryModel');
const MenuItem = require('../models/menuItemModel');
const mongoose = require('mongoose');

// Get all categories (top-level only by default; pass ?all=true for flat list)
exports.getAllCategories = async (req, res) => {
  try {
    const { isActive, all } = req.query;
    
    const filter = {};
    
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    // By default return only top-level categories (parentCategory is null)
    if (all !== 'true') {
      filter.parentCategory = null;
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

// Get all subcategories for a given parent category
exports.getSubcategories = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid category ID format" });
    }

    const parent = await Category.findById(id);
    if (!parent) {
      return res.status(404).json({ message: "Category not found" });
    }

    const filter = { parentCategory: id };
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const subcategories = await Category.find(filter)
      .sort({ displayOrder: 1, name: 1 });

    res.status(200).json({
      success: true,
      parent: { _id: parent._id, name: parent.name },
      subcategories,
      total: subcategories.length
    });
  } catch (err) {
    console.error('Error fetching subcategories:', err);
    res.status(500).json({ message: "Failed to fetch subcategories", error: err.message });
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

// Get menu items for a category (or subcategory)
exports.getCategoryItems = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      page = 1, 
      limit = 20,
      isAvailable,
      isVeg,
      sortBy = 'name',
      sortOrder = 'asc',
      subcategory
    } = req.query;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid category ID format" });
    }
    
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // If a specific subcategory filter is requested, use it directly
    // Otherwise, if this is a parent category, include items from all its subcategories
    let categoryIds = [id];
    if (!subcategory && !category.parentCategory) {
      // Top-level category: also include items belonging to any of its subcategories
      const subs = await Category.find({ parentCategory: id }).select('_id');
      categoryIds = [id, ...subs.map(s => s._id.toString())];
    } else if (subcategory) {
      if (!mongoose.Types.ObjectId.isValid(subcategory)) {
        return res.status(400).json({ message: "Invalid subcategory ID format" });
      }
      categoryIds = [subcategory];
    }
    
    // Build filter for menu items
    const filter = {
      $or: [
        { category: { $in: categoryIds } },
        { subcategory: { $in: categoryIds } }
      ]
    };
    
    if (isAvailable !== undefined) {
      filter.isAvailable = isAvailable === 'true';
    }
    
    if (isVeg !== undefined) {
      filter.isVeg = isVeg === 'true';
    }
    
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const menuItems = await MenuItem.find(filter)
      .populate('subcategory', 'name')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
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
    const { name, description, displayOrder, image, parentCategory } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Category name is required" });
    }

    const categoryData = {
      name,
      description,
      displayOrder: displayOrder || 0,
      parentCategory: parentCategory || null
    };
    
    // Validate parentCategory if provided
    if (parentCategory) {
      if (!mongoose.Types.ObjectId.isValid(parentCategory)) {
        return res.status(400).json({ message: "Invalid parent category ID format" });
      }
      const parent = await Category.findById(parentCategory);
      if (!parent) {
        return res.status(404).json({ message: "Parent category not found" });
      }
    }
    
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
      message: parentCategory ? "Subcategory created successfully" : "Category created successfully", 
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
    const { name, description, displayOrder, isActive, parentCategory } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid category ID format" });
    }
    
    // Load category first
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (parentCategory !== undefined) {
      if (parentCategory && !mongoose.Types.ObjectId.isValid(parentCategory)) {
        return res.status(400).json({ message: "Invalid parent category ID format" });
      }
      // Prevent self-referencing
      if (parentCategory && parentCategory === id) {
        return res.status(400).json({ message: "Category cannot be its own parent" });
      }
      updateData.parentCategory = parentCategory || null;
    }
    
    // Add image if uploaded
    if (req.file) {
      updateData.image = req.file.path;
    }

    // Apply updates and save
    Object.assign(category, updateData);
    await category.save();
    
    res.status(200).json({ 
      success: true,
      message: "Category updated successfully", 
      category 
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