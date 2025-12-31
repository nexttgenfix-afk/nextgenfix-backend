const express = require('express');
const router = express.Router();
const promoCodeController = require('../controllers/promoCodeController');
const { verifyToken } = require('../middlewares/auth');
const { validatePromoCode } = require('../middlewares/validation');
const { verifyAdmin } = require('../middlewares/adminAuth');

// Public routes (specific paths first)
router.post('/validate', promoCodeController.validatePromoCode);

// Admin routes (specific paths before /:id)
router.post('/', verifyAdmin, validatePromoCode, promoCodeController.createPromoCode);
router.get('/admin/all', verifyAdmin, promoCodeController.getAllPromoCodes);

// User routes
router.get('/', verifyToken, promoCodeController.getUserPromoCodes);

// Admin routes with parameters
router.put('/:id', verifyAdmin, promoCodeController.updatePromoCode);
router.delete('/:id', verifyAdmin, promoCodeController.deletePromoCode);
router.put('/:id/toggle', verifyAdmin, promoCodeController.togglePromoCodeStatus);

module.exports = router;