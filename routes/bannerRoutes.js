const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/bannerController');
const { verifyAdmin } = require('../middlewares/adminAuth');

// User
router.get('/', bannerController.getBanners);

// Admin
router.get('/admin', verifyAdmin, bannerController.getAllBanners);
router.post('/admin', verifyAdmin, bannerController.createBanner);
router.put('/admin/:id', verifyAdmin, bannerController.updateBanner);
router.delete('/admin/:id', verifyAdmin, bannerController.deleteBanner);

module.exports = router;
