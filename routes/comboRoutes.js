const express = require('express');
const router = express.Router();
const comboController = require('../controllers/comboController');
const { optionalAuth } = require('../middlewares/auth');
const { validateObjectId } = require('../middlewares/validation');
const { validateComboData, sanitizeComboInput } = require('../middlewares/comboValidation');

// Admin routes (must come before dynamic routes like /:id)
const { verifyAdmin } = require('../middlewares/adminAuth');
const { uploadSingleImage } = require('../middlewares/upload');

// Get all combos (including inactive) for admin panel
router.get('/admin/all', verifyAdmin, comboController.getAllCombos);

// Check price mismatches
router.get('/admin/check-prices', verifyAdmin, comboController.checkPriceMismatches);

// Public routes
router.get('/', optionalAuth, comboController.getActiveCombos);
router.get('/:id', optionalAuth, comboController.getComboById);

router.post('/', verifyAdmin, uploadSingleImage, sanitizeComboInput, validateComboData, comboController.createCombo);
router.put('/:id', verifyAdmin, uploadSingleImage, sanitizeComboInput, validateComboData, comboController.updateCombo);
router.delete('/:id', verifyAdmin, comboController.deleteCombo);
router.put('/:id/toggle', verifyAdmin, comboController.toggleComboStatus);

module.exports = router;
