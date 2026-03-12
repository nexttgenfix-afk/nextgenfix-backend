const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/bannerController');
const { verifyAdmin } = require('../middlewares/adminAuth');
const { uploadBannerImage, uploadBannerVideo } = require('../config/cloudinary');

// User
router.get('/', bannerController.getBanners);

// Admin
router.get('/admin', verifyAdmin, bannerController.getAllBanners);
router.post('/admin', verifyAdmin, bannerController.createBanner);
router.put('/admin/:id', verifyAdmin, bannerController.updateBanner);
router.delete('/admin/:id', verifyAdmin, bannerController.deleteBanner);

// Media upload
router.post('/admin/upload/image', verifyAdmin, uploadBannerImage.single('file'), bannerController.uploadBannerMedia);
router.post('/admin/upload/video', verifyAdmin, uploadBannerVideo.single('file'), bannerController.uploadBannerMedia);

module.exports = router;
