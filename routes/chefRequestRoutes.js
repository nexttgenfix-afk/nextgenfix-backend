const express = require('express');
const router = express.Router();
const chefRequestController = require('../controllers/chefRequestController');
const { verifyToken } = require('../middlewares/auth');
const { validateChefRequest } = require('../middlewares/validation');
const { uploadMultipleImages } = require('../middlewares/upload');

// User routes
router.post('/', verifyToken, validateChefRequest, uploadMultipleImages(5), chefRequestController.submitChefRequest);
router.get('/', verifyToken, chefRequestController.getUserRequests);
router.get('/:id', verifyToken, chefRequestController.getRequestById);

// Admin routes
const { verifyAdmin } = require('../middlewares/adminAuth');

router.get('/admin/all', verifyAdmin, chefRequestController.getAllRequests);
router.put('/:id/status', verifyAdmin, chefRequestController.updateRequestStatus);
router.put('/:id/review', verifyAdmin, chefRequestController.reviewRequest);

module.exports = router;

// Cancel request
router.put('/cancel/:requestId', cancelRequest);

// Get chef rental requests by status
router.get('/chef-rental/:status', getChefRentalRequestsByStatus);

// Get chef rental availability calendar
router.get('/chef-rental/calendar/:chefId', getChefRentalCalendar);

// Update chef rental request status
router.put('/chef-rental/:requestId/status', updateChefRentalStatus);

module.exports = router;