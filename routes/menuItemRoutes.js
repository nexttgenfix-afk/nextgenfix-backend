const express = require('express');
const router = express.Router();
const menuItemController = require('../controllers/menuItemController');
const { protect, authorizeVendor } = require('../middlewares/authMiddleware');
const { uploadMenuItemPhoto } = require('../config/cloudinary'); // CORRECT PATH

// Public routes - Search and filtering
router.get('/search', menuItemController.searchMenuItems);
router.get('/mood/:mood', menuItemController.getMenuItemsByMood);
router.get('/hunger-level/:level', menuItemController.getMenuItemsByHungerLevel);
router.get('/restaurant/:sourceId', menuItemController.getMenuItemsBySource);
router.get('/chef/:sourceId', menuItemController.getMenuItemsBySource);
router.get('/:id', menuItemController.getMenuItemById);
router.get('/:id/similar', menuItemController.getSimilarMenuItems);

// Protected routes for users
router.post('/rate', protect, menuItemController.rateMenuItem);

// Protected routes for vendors
router.post('/', protect, authorizeVendor, menuItemController.createMenuItem);
router.put('/:id', protect, authorizeVendor, menuItemController.updateMenuItem);
router.delete('/:id', protect, authorizeVendor, menuItemController.deleteMenuItem);
router.post('/:id/photos', protect, authorizeVendor, uploadMenuItemPhoto.array('photos', 5), menuItemController.uploadMenuItemPhotos);
router.put('/:id/description', protect, authorizeVendor, menuItemController.updateDescription);
router.get('/:id/description/preview', protect, authorizeVendor, menuItemController.previewDescription);

// Chef dashboard menu management routes
router.get('/chef/:chefId/advanced', protect, menuItemController.getChefMenuItemsAdvanced);
router.put('/chef/:chefId/availability', protect, authorizeVendor, menuItemController.updateMenuItemsAvailability);
router.patch('/chef/:chefId/item/:menuItemId/special', protect, authorizeVendor, menuItemController.toggleMenuItemSpecial);

module.exports = router;