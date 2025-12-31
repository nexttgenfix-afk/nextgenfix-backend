const express = require('express');
const router = express.Router();
const chefController = require('../controllers/chefController');
const { verifyToken } = require('../middlewares/auth');
const { validateChefProfile } = require('../middlewares/validation');
const { uploadMultipleImages } = require('../middlewares/upload');

// Chef registration and profile
router.post('/register', verifyToken, validateChefProfile, chefController.registerChef);
router.get('/profile', verifyToken, chefController.getChefProfile);
router.put('/profile', verifyToken, validateChefProfile, uploadMultipleImages(5), chefController.updateChefProfile);

// Chef verification
// router.post('/verification/submit', verifyToken, uploadMultipleImages(10), chefController.submitVerification);
// router.get('/verification/status', verifyToken, chefController.getVerificationStatus);

// Menu management
// router.post('/menu', verifyToken, chefController.createMenuItem);
router.get('/menu', verifyToken, chefController.getChefMenu);
// router.put('/menu/:id', verifyToken, chefController.updateMenuItem);
// router.delete('/menu/:id', verifyToken, chefController.deleteMenuItem);

// Orders management
// router.get('/orders', verifyToken, chefController.getChefOrders);
// router.put('/orders/:id/status', verifyToken, chefController.updateOrderStatus);

// Earnings and analytics
// router.get('/earnings', verifyToken, chefController.getEarnings);
// router.get('/analytics', verifyToken, chefController.getAnalytics);

// Admin routes
const { verifyAdmin } = require('../middlewares/adminAuth');

// router.get('/admin/all', verifyAdmin, chefController.getAllChefs);
// router.put('/:id/verify', verifyAdmin, chefController.verifyChef);
// router.put('/:id/suspend', verifyAdmin, chefController.suspendChef);

module.exports = router;

// Get chefs by speciality
// router.get('/search/speciality', chefController.getChefsBySpeciality);

// Get chefs nearby
// router.get('/nearby', chefController.getChefsNearby);

// Get all chefs
// router.get('/', chefController.getAllChefs);

// Get chef by ID
// router.get('/:id', chefController.getChefById);

// Get chef dashboard overview
// router.get('/:id/dashboard', chefController.getChefDashboardOverview);

// Get menu for a chef
// router.get('/:id/menu', chefController.getChefMenu);

// router.post('/verify-firebase-token', chefController.verifyFirebaseToken);

// Get chef preferences
// router.get('/:id/preferences', chefController.getChefPreferences);

// Update chef settings and preferences
// router.put('/:id/settings', chefController.updateChefSettings);

// Get all veg/non-veg items from a chef (filter menu)
// router.get('/:id/menu/filter', chefController.getFilteredChefMenu);

// Get filters for UI
// router.get('/:id/filters', chefController.getChefFilters);

// Check chef availability
// router.get('/:id/availability', chefController.checkChefAvailability);

// Toggle chef availability status (ON/OFF)
// router.put('/:id/availability/toggle', chefController.toggleAvailabilityStatus);

// Get chef orders by status (preparing, ready, pickup)
// router.get('/:id/orders/:status', chefController.getChefOrdersByStatus);

// Update order preparation time
// router.put('/orders/:orderId/preparation-time', chefController.updateOrderPreparationTime);

// Reject an order with reason
// router.put('/orders/:orderId/reject', chefController.rejectOrder);

// Get chef's performance metrics
// router.get('/:id/metrics/performance', chefController.getChefPerformanceMetrics);

// Get chef's customer analytics
// router.get('/:id/metrics/customer-analytics', chefController.getChefCustomerAnalytics);

// Get chef's order analytics
// router.get('/:id/metrics/order-analytics', chefController.getChefOrderAnalytics);

// Inventory management routes
// router.get('/:id/inventory', chefController.getChefInventory);
// router.post('/:id/inventory', chefController.addInventoryItem);
// router.put('/:id/inventory/:itemId', chefController.updateInventoryItem);
// router.delete('/:id/inventory/:itemId', chefController.deleteInventoryItem);

// Admin routes - will be protected in production
// router.post(
//   '/add',
//   uploadChefProfilePicture.fields([
//     { name: 'profilePicture', maxCount: 1 },
//     { name: 'coverPhoto', maxCount: 1 }
//   ]),
//   chefController.addChef
// );
// router.post('/:id/menu', uploadMenuItemPhoto.single('photo'), chefController.addChefMenuItem);

// Get all meal boxes for a chef
// router.get('/:id/meal-boxes', chefController.getChefMealBoxes);

// Add a new meal box
// router.post('/:id/meal-boxes', uploadMealBoxPhoto.single('photo'), chefController.addMealBox);

// Get all combos for a chef
// router.get('/:id/combos', chefController.getCombos);

// Add a new combo
// router.post('/:id/combos', uploadComboPhoto.single('photo'), chefController.addCombo);

// Update a combo
// router.put('/:id/combos/:comboId', uploadComboPhoto.single('photo'), chefController.updateCombo);

// Delete a combo
// router.delete('/:id/combos/:comboId', chefController.deleteCombo);

module.exports = router;