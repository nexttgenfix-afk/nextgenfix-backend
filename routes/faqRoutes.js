const express = require('express');
const router = express.Router();
const faqController = require('../controllers/faqController');
const { verifyAdmin } = require('../middlewares/adminAuth');
const { requireGuestOrUser } = require('../middlewares/unifiedAuth');

/**
 * PUBLIC ROUTES - For user/mobile app
 * No authentication required
 */

// Get all active FAQs (can filter by category)
router.get('/', faqController.getFAQs);

// Get FAQs by specific category
router.get('/category/:category', faqController.getFAQByCategory);

// Search FAQs
router.get('/search', faqController.searchFAQs);

// Mark FAQ as helpful/unhelpful
router.post('/:faqId/helpful', faqController.markFAQHelpful);

// Increment FAQ view count
router.post('/:faqId/view', faqController.incrementFAQView);

/**
 * ADMIN ROUTES - For admin dashboard
 * Require admin authentication
 */

// Create new FAQ
router.post('/admin', verifyAdmin, faqController.createFAQ);

// Get all FAQs (admin - includes inactive)
router.get('/admin/list', verifyAdmin, faqController.getAllFAQsAdmin);

// Get FAQ statistics
router.get('/admin/stats', verifyAdmin, faqController.getFAQStats);

// Update FAQ
router.put('/admin/:id', verifyAdmin, faqController.updateFAQ);

// Delete FAQ
router.delete('/admin/:id', verifyAdmin, faqController.deleteFAQ);

// Reorder FAQs
router.post('/admin/reorder', verifyAdmin, faqController.reorderFAQs);

module.exports = router;
