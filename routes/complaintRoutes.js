const express = require('express');
const router = express.Router();
const complaintController = require('../controllers/complaintController');
const { verifyToken } = require('../middlewares/auth');
const { validateComplaint } = require('../middlewares/validation');
const { uploadMedia } = require('../middlewares/upload');
const { verifyAdmin } = require('../middlewares/adminAuth');

// Admin routes (must be before /:id to avoid conflicts)
router.get('/all', verifyAdmin, complaintController.getAllComplaints);
router.get('/stats', verifyAdmin, complaintController.getComplaintStats);
router.get('/admin/export', verifyAdmin, complaintController.exportComplaints);
router.get('/admin/:id', verifyAdmin, complaintController.getComplaintById);
router.post('/admin', verifyAdmin, validateComplaint, complaintController.submitComplaint);
router.put('/admin/:id', verifyAdmin, complaintController.updateComplaint);
router.delete('/admin/:id', verifyAdmin, complaintController.deleteComplaint);

// User routes
router.post('/', verifyToken, uploadMedia(5), validateComplaint, complaintController.submitComplaint);
router.get('/', verifyToken, complaintController.getUserComplaints);
router.get('/:id', verifyToken, complaintController.getComplaintById);

// Admin routes with parameters
router.put('/:id/status', verifyAdmin, complaintController.updateComplaintStatus);
router.put('/:id/respond', verifyAdmin, complaintController.respondToComplaint);

module.exports = router;
