const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('../config/cloudinary');

const hasCloudinary = !!cloudinary;

// File size limits (in bytes)
const limits = {
  fileSize: 10 * 1024 * 1024, // 10MB default
  imageSize: 5 * 1024 * 1024,  // 5MB for images
  videoSize: 50 * 1024 * 1024  // 50MB for videos
};

// File filters
const imageFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test((file.originalname || '').toLowerCase());
  const mimetype = /^(image)\//.test(file.mimetype || '');
  if (mimetype && extname) return cb(null, true);
  cb(new Error('Only image files are allowed (jpeg, jpg, png, webp)'));
};

const videoFilter = (req, file, cb) => {
  const mimetype = /^(video)\//.test(file.mimetype || '');
  if (mimetype) return cb(null, true);
  cb(new Error('Only video files are allowed'));
};

const mediaFilter = (req, file, cb) => {
  if (/^(image|video)\//.test(file.mimetype || '')) return cb(null, true);
  cb(new Error('Only image and video files are allowed'));
};

let genericImageStorage;
let genericVideoStorage;
if (hasCloudinary) {
  // Generic Cloudinary storage (folder can be overridden per-field if needed)
  genericImageStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'nextgenfix/uploads',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ quality: 'auto' }]
    }
  });

  genericVideoStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'nextgenfix/uploads/videos',
      resource_type: 'video'
    }
  });
} else {
  // Fallback to memory storage so requires won't fail; controllers will handle req.file.buffer uploads
  const memoryStorage = multer.memoryStorage();
  genericImageStorage = memoryStorage;
  genericVideoStorage = memoryStorage;
}

// Upload single image
const uploadSingleImage = multer({
  storage: genericImageStorage,
  fileFilter: imageFilter,
  limits: { fileSize: limits.imageSize }
}).single('image');

// Upload multiple images
const uploadMultipleImages = (maxCount = 5) => {
  return multer({
    storage: genericImageStorage,
    fileFilter: imageFilter,
    limits: { fileSize: limits.imageSize }
  }).array('images', maxCount);
};

// Upload single video
const uploadSingleVideo = multer({
  storage: genericVideoStorage,
  fileFilter: videoFilter,
  limits: { fileSize: limits.videoSize }
}).single('video');

// Upload mixed media (images and videos) - images to image storage, videos to video storage
// Note: multer can't switch storage per file easily; for mixed uploads we use generic image storage
const uploadMedia = (maxCount = 5) => {
  return multer({
    storage: genericImageStorage,
    fileFilter: mediaFilter,
    limits: { fileSize: limits.fileSize }
  }).array('media', maxCount);
};

// Upload specific fields
const uploadFields = (fields) => {
  return multer({
    storage: genericImageStorage,
    fileFilter: mediaFilter,
    limits: { fileSize: limits.fileSize }
  }).fields(fields);
};

// Error handler for multer errors
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'File too large. Maximum size is 10MB.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ success: false, message: 'Too many files uploaded.' });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
};

module.exports = {
  uploadSingleImage,
  uploadMultipleImages,
  uploadSingleVideo,
  uploadMedia,
  uploadFields,
  handleMulterError
};
