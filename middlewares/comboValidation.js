const mongoose = require('mongoose');

/**
 * Validate combo creation/update data
 */
const validateComboData = (req, res, next) => {
  const { name, items, originalPrice, discount } = req.body;

  // Validate name
  if (req.method === 'POST' && (!name || name.trim().length === 0)) {
    return res.status(400).json({ message: 'Combo name is required' });
  }

  // Validate items for POST requests
  if (req.method === 'POST') {
    let parsedItems;
    try {
      parsedItems = typeof items === 'string' ? JSON.parse(items) : items;
    } catch (e) {
      return res.status(400).json({ message: 'Invalid items format' });
    }

    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      return res.status(400).json({ message: 'At least one menu item is required' });
    }

    // Validate each item structure
    for (const item of parsedItems) {
      const itemId = item.menuItem || item._id || item;
      const quantity = item.quantity || 1;

      if (!mongoose.Types.ObjectId.isValid(itemId)) {
        return res.status(400).json({ message: `Invalid menu item ID: ${itemId}` });
      }

      if (quantity < 1) {
        return res.status(400).json({ message: 'Item quantity must be at least 1' });
      }
    }
  }

  // Validate discount if provided
  if (discount !== undefined) {
    let parsedDiscount;
    try {
      parsedDiscount = typeof discount === 'string' ? JSON.parse(discount) : discount;
    } catch (e) {
      return res.status(400).json({ message: 'Invalid discount format' });
    }

    if (parsedDiscount.type && !['percentage', 'fixed', 'none'].includes(parsedDiscount.type)) {
      return res.status(400).json({ message: 'Invalid discount type. Must be percentage, fixed, or none' });
    }

    const discountValue = parseFloat(parsedDiscount.value);
    if (isNaN(discountValue) || discountValue < 0) {
      return res.status(400).json({ message: 'Discount value must be a non-negative number' });
    }

    if (parsedDiscount.type === 'percentage' && discountValue > 100) {
      return res.status(400).json({ message: 'Percentage discount cannot exceed 100%' });
    }

    // For fixed discount, we'll validate against original price in controller
    // since we need to calculate original price from items first
  }

  // Validate originalPrice if provided
  if (originalPrice !== undefined) {
    const price = parseFloat(originalPrice);
    if (isNaN(price) || price < 0) {
      return res.status(400).json({ message: 'Original price must be a non-negative number' });
    }
  }

  next();
};

/**
 * Validate price calculations
 */
const validatePriceCalculation = (originalPrice, discount) => {
  if (discount.type === 'none') {
    return { isValid: true, finalPrice: originalPrice };
  }

  let discountAmount = 0;
  if (discount.type === 'percentage') {
    discountAmount = (originalPrice * discount.value) / 100;
  } else if (discount.type === 'fixed') {
    discountAmount = discount.value;
  }

  // Round to 2 decimal places
  discountAmount = Math.round(discountAmount * 100) / 100;
  const finalPrice = Math.max(0, Math.round((originalPrice - discountAmount) * 100) / 100);

  // Validate that discount doesn't exceed original price
  if (discountAmount > originalPrice) {
    return {
      isValid: false,
      message: 'Discount amount cannot exceed original price',
      originalPrice,
      discountAmount,
      finalPrice: 0
    };
  }

  return {
    isValid: true,
    originalPrice,
    discountAmount,
    finalPrice
  };
};

/**
 * Sanitize combo input data
 */
const sanitizeComboInput = (req, res, next) => {
  if (req.body.name) {
    req.body.name = req.body.name.trim();
  }
  
  if (req.body.description) {
    req.body.description = req.body.description.trim();
  }

  next();
};

module.exports = {
  validateComboData,
  validatePriceCalculation,
  sanitizeComboInput
};
