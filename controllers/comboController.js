const ComboOffer = require('../models/comboOfferModel');
const MenuItem = require('../models/menuItemModel');
const { uploadImage, deleteImage } = require('../services/cloudinary');
const mongoose = require('mongoose');

// Get all active combos
const getActiveCombos = async (req, res) => {
  try {
    const combos = await ComboOffer.find({ isActive: true })
      .populate('items.menuItem', 'name price image isAvailable')
      .sort({ createdAt: -1 });

    res.json(combos);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get combo by ID
const getComboById = async (req, res) => {
  try {
    const combo = await ComboOffer.findById(req.params.id)
      .populate('items.menuItem', 'name price image description isAvailable');

    if (!combo) {
      return res.status(404).json({ message: 'Combo not found' });
    }

    res.json(combo);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create combo (Admin only)
const createCombo = async (req, res) => {
  try {
    const { name, description, items, discount, validFrom, validUntil } = req.body;

    // Handle items - expecting array of {menuItem, quantity}
    let parsedItems = items;
    if (typeof items === 'string') {
      try {
        parsedItems = JSON.parse(items);
      } catch (e) {
        return res.status(400).json({ message: 'Invalid items format. Expected JSON array.' });
      }
    }

    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      return res.status(400).json({ message: 'Items must be a non-empty array.' });
    }

    // Transform items to new structure and validate
    const transformedItems = [];
    let calculatedOriginalPrice = 0;

    for (const item of parsedItems) {
      const itemId = item.menuItem || item._id || item;
      const quantity = item.quantity || 1;

      if (!mongoose.Types.ObjectId.isValid(itemId)) {
        return res.status(400).json({ message: `Invalid MenuItem ID: ${itemId}` });
      }

      // Fetch menu item to get price
      const menuItem = await MenuItem.findById(itemId);
      if (!menuItem) {
        return res.status(404).json({ message: `Menu item not found: ${itemId}` });
      }

      transformedItems.push({
        menuItem: itemId,
        quantity: parseInt(quantity)
      });

      // Calculate original price
      calculatedOriginalPrice += menuItem.price * quantity;
    }

    // Round to 2 decimal places
    calculatedOriginalPrice = Math.round(calculatedOriginalPrice * 100) / 100;

    // Parse discount
    let discountConfig = {
      type: 'none',
      value: 0
    };

    if (discount) {
      const parsedDiscount = typeof discount === 'string' ? JSON.parse(discount) : discount;
      discountConfig = {
        type: parsedDiscount.type || 'none',
        value: parseFloat(parsedDiscount.value) || 0
      };

      // Validate discount
      if (discountConfig.type === 'percentage' && (discountConfig.value < 0 || discountConfig.value > 100)) {
        return res.status(400).json({ message: 'Percentage discount must be between 0 and 100.' });
      }
      if (discountConfig.type === 'fixed' && (discountConfig.value < 0 || discountConfig.value > calculatedOriginalPrice)) {
        return res.status(400).json({ message: 'Fixed discount cannot exceed original price.' });
      }
    }

    // Handle image upload
    let imageUrl = null;
    if (req.file) {
      if (req.file.path || req.file.secure_url || req.file.url) {
        imageUrl = req.file.path || req.file.secure_url || req.file.url;
      } else if (req.file.location) {
        imageUrl = req.file.location;
      } else if (req.file.buffer) {
        const result = await uploadImage(req.file.buffer, 'combos');
        imageUrl = result?.url || result;
      }
    }

    const comboData = {
      name,
      description,
      items: transformedItems,
      originalPrice: calculatedOriginalPrice,
      discount: discountConfig,
      image: imageUrl
    };

    // Add validFrom and validUntil if provided
    if (validFrom) {
      comboData.validFrom = new Date(validFrom);
    }
    if (validUntil) {
      comboData.validUntil = new Date(validUntil);
    }

    const combo = await ComboOffer.create(comboData);
    
    // Populate items before returning
    await combo.populate('items.menuItem', 'name price image isAvailable');

    res.status(201).json({
      message: 'Combo created successfully',
      combo
    });
  } catch (error) {
    console.error('Create combo error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update combo (Admin only)
const updateCombo = async (req, res) => {
  try {
    const { name, description, items, discount, validFrom, validUntil } = req.body;

    const combo = await ComboOffer.findById(req.params.id);
    if (!combo) {
      return res.status(404).json({ message: 'Combo not found' });
    }

    // Handle items update
    if (items !== undefined) {
      let parsedItems = items;
      if (typeof items === 'string') {
        try {
          parsedItems = JSON.parse(items);
        } catch (e) {
          return res.status(400).json({ message: 'Invalid items format. Expected JSON array.' });
        }
      }

      if (!Array.isArray(parsedItems)) {
        return res.status(400).json({ message: 'Items must be an array.' });
      }

      // Transform items to new structure and validate
      const transformedItems = [];
      let calculatedOriginalPrice = 0;

      for (const item of parsedItems) {
        const itemId = item.menuItem || item._id || item;
        const quantity = item.quantity || 1;

        if (!mongoose.Types.ObjectId.isValid(itemId)) {
          return res.status(400).json({ message: `Invalid MenuItem ID: ${itemId}` });
        }

        // Fetch menu item to get price
        const menuItem = await MenuItem.findById(itemId);
        if (!menuItem) {
          return res.status(404).json({ message: `Menu item not found: ${itemId}` });
        }

        transformedItems.push({
          menuItem: itemId,
          quantity: parseInt(quantity)
        });

        calculatedOriginalPrice += menuItem.price * quantity;
      }

      calculatedOriginalPrice = Math.round(calculatedOriginalPrice * 100) / 100;
      combo.items = transformedItems;
      combo.originalPrice = calculatedOriginalPrice;
    }

    // Handle discount update
    if (discount !== undefined) {
      const parsedDiscount = typeof discount === 'string' ? JSON.parse(discount) : discount;
      const discountConfig = {
        type: parsedDiscount.type || 'none',
        value: parseFloat(parsedDiscount.value) || 0
      };

      // Validate discount
      if (discountConfig.type === 'percentage' && (discountConfig.value < 0 || discountConfig.value > 100)) {
        return res.status(400).json({ message: 'Percentage discount must be between 0 and 100.' });
      }
      if (discountConfig.type === 'fixed' && (discountConfig.value < 0 || discountConfig.value > combo.originalPrice)) {
        return res.status(400).json({ message: 'Fixed discount cannot exceed original price.' });
      }

      combo.discount = discountConfig;
    }

    // Handle image upload
    if (req.file) {
      if (combo.image) {
        await deleteImage(combo.image);
      }
      if (req.file.path || req.file.secure_url || req.file.url) {
        combo.image = req.file.path || req.file.secure_url || req.file.url;
      } else if (req.file.location) {
        combo.image = req.file.location;
      } else if (req.file.buffer) {
        const result = await uploadImage(req.file.buffer, 'combos');
        combo.image = result?.url || result;
      }
    }

    // Update basic fields
    if (name !== undefined) combo.name = name;
    if (description !== undefined) combo.description = description;
    
    // Update validFrom and validUntil if provided
    if (validFrom) {
      combo.validFrom = new Date(validFrom);
    }
    if (validUntil) {
      combo.validUntil = new Date(validUntil);
    }

    await combo.save();
    
    // Populate items before returning
    await combo.populate('items.menuItem', 'name price image isAvailable');

    res.json({
      message: 'Combo updated successfully',
      combo
    });
  } catch (error) {
    console.error('Update combo error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete combo (Admin only)
const deleteCombo = async (req, res) => {
  try {
    const combo = await ComboOffer.findById(req.params.id);
    if (!combo) {
      return res.status(404).json({ message: 'Combo not found' });
    }

    // Delete image if exists
    if (combo.image) {
      await deleteImage(combo.image);
    }

    await ComboOffer.findByIdAndDelete(req.params.id);

    res.json({ message: 'Combo deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Toggle combo status (Admin only)
const toggleComboStatus = async (req, res) => {
  try {
    const combo = await ComboOffer.findById(req.params.id);
    if (!combo) {
      return res.status(404).json({ message: 'Combo not found' });
    }

    combo.isActive = !combo.isActive;
    await combo.save();

    res.json({
      message: `Combo ${combo.isActive ? 'activated' : 'deactivated'} successfully`,
      combo
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Check price mismatches for all combos (Solution 3: Semi-auto warning)
const checkPriceMismatches = async (req, res) => {
  try {
    const combos = await ComboOffer.find()
      .populate('items.menuItem', 'name price isAvailable');

    const warnings = [];

    for (const combo of combos) {
      let currentTotalPrice = 0;
      let unavailableItems = [];

      for (const item of combo.items) {
        if (!item.menuItem) {
          unavailableItems.push('Unknown item');
          continue;
        }
        
        if (!item.menuItem.isAvailable) {
          unavailableItems.push(item.menuItem.name);
        }
        
        currentTotalPrice += item.menuItem.price * item.quantity;
      }

      currentTotalPrice = Math.round(currentTotalPrice * 100) / 100;
      const priceDifference = Math.abs(currentTotalPrice - combo.originalPrice);
      const hasWarning = priceDifference > 0.01 || unavailableItems.length > 0;

      if (hasWarning) {
        let warningMessage = '';
        
        if (priceDifference > 0.01) {
          warningMessage += `Price mismatch: Original ₹${combo.originalPrice}, Current ₹${currentTotalPrice}. `;
        }
        
        if (unavailableItems.length > 0) {
          warningMessage += `Unavailable items: ${unavailableItems.join(', ')}`;
        }

        warnings.push({
          comboId: combo._id,
          comboName: combo.name,
          warning: warningMessage.trim(),
          originalPrice: combo.originalPrice,
          currentPrice: currentTotalPrice,
          priceDifference: Math.round(priceDifference * 100) / 100,
          unavailableItems
        });

        // Update warning in database
        combo.priceWarning = {
          hasWarning: true,
          lastChecked: new Date(),
          message: warningMessage.trim()
        };
        await combo.save();
      } else {
        // Clear warning if everything is fine
        if (combo.priceWarning?.hasWarning) {
          combo.priceWarning = {
            hasWarning: false,
            lastChecked: new Date(),
            message: ''
          };
          await combo.save();
        }
      }
    }

    res.json({
      message: 'Price mismatch check completed',
      totalCombos: combos.length,
      warningsCount: warnings.length,
      warnings
    });
  } catch (error) {
    console.error('Check price mismatches error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all combos (Admin only) with warnings
const getAllCombos = async (req, res) => {
  try {
    const combos = await ComboOffer.find()
      .populate('items.menuItem', 'name price image isAvailable')
      .sort({ createdAt: -1 });

    res.json({ combos });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getActiveCombos,
  getAllCombos,
  getComboById,
  createCombo,
  updateCombo,
  deleteCombo,
  toggleComboStatus,
  checkPriceMismatches
};