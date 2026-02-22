const { body, param, query, validationResult } = require('express-validator');

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path || err.param,
        message: err.msg
      }))
    });
  }
  
  next();
};

/**
 * Validation chains for user registration
 */
const validateRegistration = [
  body('phone')
    .optional()
    .matches(/^[0-9]{10}$/)
    .withMessage('Phone must be 10 digits'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('birthDate')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('Birth date must be a valid date'),
  handleValidationErrors
];

/**
 * Validation for login
 */
const validateLogin = [
  body('phone')
    .if(body('email').not().exists())
    .notEmpty()
    .withMessage('Phone or email is required'),
  body('email')
    .if(body('phone').not().exists())
    .notEmpty()
    .withMessage('Phone or email is required'),
  handleValidationErrors
];

/**
 * Validation for OTP
 */
const validateOTP = [
  body('phone')
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^[0-9]{10}$/)
    .withMessage('Phone must be 10 digits'),
  body('otp')
    .optional()
    .isLength({ min: 4, max: 6 })
    .withMessage('OTP must be 4-6 digits'),
  handleValidationErrors
];

/**
 * Validation for sending a message
 * Ensures chatId is present and that either content or media is provided
 */
const validateMessage = [
  body('chatId')
    .notEmpty()
    .withMessage('chatId is required'),
  body('content')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Content must be at most 2000 characters'),
  // Simple middleware to ensure either content or media is provided.
  (req, res, next) => {
    const hasContent = req.body && req.body.content && String(req.body.content).trim().length > 0;
    const hasMediaArray = Array.isArray(req.body.media) && req.body.media.length > 0;
    // Note: file uploads via multer are handled on the media route (/messages/media) which uses upload middleware.
    if (hasContent || hasMediaArray) return next();
    return res.status(400).json({ success: false, message: 'Either content or media must be provided' });
  }
];

/**
 * Validation for menu item creation/update
 */
const validateMenuItem = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Item name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('description')
    .optional()
    .trim(),
  body('price')
    .isNumeric()
    .withMessage('Price must be a number')
    .isFloat({ min: 0 })
    .withMessage('Price must be greater than 0'),
  body('category')
    .notEmpty()
    .withMessage('Category is required'),
  body('isVeg')
    .optional()
    .isBoolean()
    .withMessage('isVeg must be boolean'),
  handleValidationErrors
];

/**
 * Validation for order creation
 */
const validateOrder = [
  body('items')
    .optional()
    .isArray({ min: 1 })
    .withMessage('Items must be a non-empty array if provided'),
  body('orderType')
    .isIn(['on_site_dining', 'delivery'])
    .withMessage('Order type must be on_site_dining or delivery'),
  body('deliveryAddress')
    .if(body('orderType').equals('delivery'))
    .notEmpty()
    .withMessage('Delivery address is required for delivery orders'),
  body('tableNumber')
    .if(body('orderType').equals('on_site_dining'))
    .notEmpty()
    .withMessage('Table number is required for dine-in orders'),
  handleValidationErrors
];

/**
 * Validation for address
 */
const validateAddress = [
  body('flatNumber')
    .optional()
    .trim(),
  body('address')
    .trim()
    .notEmpty()
    .withMessage('Address is required')
    .isLength({ min: 10, max: 200 })
    .withMessage('Address must be between 10 and 200 characters'),
  body('coordinates')
    .optional()
    .isArray({ min: 2, max: 2 })
    .withMessage('Coordinates must be [longitude, latitude]'),
  handleValidationErrors
];

/**
 * Validation for profile update (required fields from UI)
 * name, email, gender, birthDate are required
 */
const validateProfileUpdate = [
  body('name')
    .notEmpty()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .notEmpty()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('gender')
    .notEmpty()
    .isIn(['Male', 'Female', 'Other', 'Prefer not to say'])
    .withMessage('Invalid gender'),
  body('birthDate')
    .notEmpty()
    .isISO8601()
    .toDate()
    .withMessage('Birth date must be a valid date'),
  handleValidationErrors
];

/**
 * Validation for coupon code
 */
const validateCoupon = [
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Coupon code is required')
    .isLength({ min: 3, max: 20 })
    .withMessage('Coupon code must be between 3 and 20 characters')
    .matches(/^[A-Z0-9]+$/)
    .withMessage('Coupon code must be uppercase letters and numbers only'),
  body('discountType')
    .isIn(['percentage', 'fixed', 'free_delivery'])
    .withMessage('Invalid discount type'),
  body('discountValue')
    .isFloat({ min: 0 })
    .withMessage('Discount value must be greater than 0'),
  body('validUntil')
    .isISO8601()
    .withMessage('Valid until must be a valid date'),
  handleValidationErrors
];

/**
 * Validation for promo code creation/update
 */
const validatePromoCode = [
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Promo code is required')
    .isLength({ min: 3, max: 20 })
    .withMessage('Promo code must be between 3 and 20 characters')
    .matches(/^[A-Z0-9]+$/i)
    .withMessage('Promo code must be alphanumeric')
    .customSanitizer(v => v.toUpperCase()),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required'),
  body('discountType')
    .isIn(['percentage', 'fixed'])
    .withMessage('Invalid discount type'),
  body('discountValue')
    .isFloat({ min: 0 })
    .withMessage('Discount value must be a non-negative number'),
  body('maxDiscount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('maxDiscount must be a non-negative number'),
  body('minOrderValue')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('minOrderValue must be a non-negative number'),
  body('expiryDate')
    .notEmpty()
    .withMessage('Expiry date is required')
    .isISO8601()
    .withMessage('Expiry date must be a valid date'),
  body('usageLimit')
    .optional()
    .isInt({ min: 1 })
    .withMessage('usageLimit must be an integer greater than 0'),
  handleValidationErrors
];

/**
 * Validation for complaint
 */
const validateComplaint = [
  body('category')
    .isIn(['order_issue', 'delivery_issue', 'payment_issue', 'account_issue', 'technical_issue', 'menu_issue', 'general_inquiry', 'feedback'])
    .withMessage('Invalid complaint category'),
  body('subject')
    .trim()
    .notEmpty()
    .withMessage('Subject is required')
    .isLength({ min: 5, max: 100 })
    .withMessage('Subject must be between 5 and 100 characters'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10 and 500 characters'),
  handleValidationErrors
];

/**
 * Validation for table reservation
 */
const validateTableReservation = [
  body('tableId')
    .notEmpty()
    .withMessage('Table ID is required'),
  body('date')
    .isISO8601()
    .withMessage('Valid date is required'),
  body('timeSlot')
    .notEmpty()
    .withMessage('Time slot is required'),
  body('guestCount')
    .isInt({ min: 1, max: 20 })
    .withMessage('Guest count must be between 1 and 20'),
  handleValidationErrors
];

/**
 * Validation for admin login
 */
const validateAdminLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  handleValidationErrors
];

/**
 * Validation for ObjectId parameter
 */
const validateObjectId = (paramName = 'id') => [
  param(paramName)
    .matches(/^[0-9a-fA-F]{24}$/)
    .withMessage('Invalid ID format'),
  handleValidationErrors
];

/**
 * Validation for category creation/update
 */
const validateCategory = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Category name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('restaurantId')
    .optional()
    .custom((value, { req }) => {
      // Allow omitting restaurantId when DEFAULT_RESTAURANT_ID is set (single-restaurant deployments)
      const resolved = value || process.env.DEFAULT_RESTAURANT_ID || null;
      if (!resolved) {
        throw new Error('Restaurant ID is required');
      }
      if (!/^[0-9a-fA-F]{24}$/.test(resolved)) {
        throw new Error('Invalid restaurant ID format');
      }
      return true;
    }),
  body('displayOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Display order must be a non-negative integer'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be boolean'),
  body('image')
    .optional()
    .trim(),
  handleValidationErrors
];

const validateChefProfile = [
  body('cognitoId')
    .notEmpty()
    .withMessage('Cognito ID is required'),
  body('phone')
    .notEmpty()
    .matches(/^[0-9]{10}$/)
    .withMessage('Phone must be 10 digits'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('name')
    .notEmpty()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('kitchenName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Kitchen name must be between 2 and 100 characters'),
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio must be less than 500 characters'),
  body('specialities')
    .optional()
    .isArray()
    .withMessage('Specialities must be an array'),
  body('cuisines')
    .optional()
    .isArray()
    .withMessage('Cuisines must be an array'),
  handleValidationErrors
];

/**
 * Validation for rating submission
 */
const validateRating = [
  param('orderId')
    .matches(/^[0-9a-fA-F]{24}$/)
    .withMessage('Invalid order ID format'),
  body('ratings')
    .isArray({ min: 1 })
    .withMessage('Ratings must be a non-empty array'),
  body('ratings.*.menuItemId')
    .matches(/^[0-9a-fA-F]{24}$/)
    .withMessage('Invalid menu item ID format'),
  body('ratings.*.rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('ratings.*.comment')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Comment must be less than 500 characters'),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateRegistration,
  validateLogin,
  validateOTP,
  validateMenuItem,
  validateOrder,
  validateAddress,
  validateCoupon,
  validateComplaint,
  validateTableReservation,
  validateAdminLogin,
  validateChefProfile,
  validateMessage,
  validatePromoCode,
  validateObjectId,
  validateProfileUpdate,
  validateCategory,
  validateRating
};
