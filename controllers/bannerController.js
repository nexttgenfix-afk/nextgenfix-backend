const Banner = require('../models/bannerModel');

// ─── User ────────────────────────────────────────────────────────────────────

// GET /api/banners — return active banners within their date window
exports.getBanners = async (req, res) => {
  try {
    const now = new Date();
    const banners = await Banner.find({
      isActive: true,
      $or: [
        { startDate: { $exists: false }, endDate: { $exists: false } },
        { startDate: { $lte: now }, endDate: { $gte: now } },
        { startDate: { $exists: false }, endDate: { $gte: now } },
        { startDate: { $lte: now }, endDate: { $exists: false } }
      ]
    }).sort({ displayOrder: 1, createdAt: -1 });

    res.json({ success: true, data: banners });
  } catch (err) {
    console.error('Get banners error:', err);
    res.status(500).json({ message: 'Failed to fetch banners' });
  }
};

// ─── Admin ────────────────────────────────────────────────────────────────────

// GET /api/banners/admin — all banners (including inactive)
exports.getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.find().sort({ displayOrder: 1, createdAt: -1 });
    res.json({ success: true, data: banners });
  } catch (err) {
    console.error('Get all banners error:', err);
    res.status(500).json({ message: 'Failed to fetch banners' });
  }
};

// POST /api/banners/admin
exports.createBanner = async (req, res) => {
  try {
    const { title, mediaType, image, video, link, type, isActive, displayOrder, startDate, endDate } = req.body;

    if (!title) return res.status(400).json({ message: 'title is required' });
    if (!image && !video) return res.status(400).json({ message: 'Either image or video is required' });

    const banner = await Banner.create({ title, mediaType, image, video, link, type, isActive, displayOrder, startDate, endDate });
    res.status(201).json({ success: true, message: 'Banner created successfully', data: banner });
  } catch (err) {
    console.error('Create banner error:', err);
    res.status(500).json({ message: 'Failed to create banner' });
  }
};

// PUT /api/banners/admin/:id
exports.updateBanner = async (req, res) => {
  try {
    const { title, mediaType, image, video, link, type, isActive, displayOrder, startDate, endDate } = req.body;

    const banner = await Banner.findByIdAndUpdate(
      req.params.id,
      { title, mediaType, image, video, link, type, isActive, displayOrder, startDate, endDate },
      { new: true, runValidators: true }
    );

    if (!banner) return res.status(404).json({ message: 'Banner not found' });

    res.json({ success: true, message: 'Banner updated successfully', data: banner });
  } catch (err) {
    console.error('Update banner error:', err);
    res.status(500).json({ message: 'Failed to update banner' });
  }
};

// DELETE /api/banners/admin/:id
exports.deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) return res.status(404).json({ message: 'Banner not found' });

    res.json({ success: true, message: 'Banner deleted successfully' });
  } catch (err) {
    console.error('Delete banner error:', err);
    res.status(500).json({ message: 'Failed to delete banner' });
  }
};
