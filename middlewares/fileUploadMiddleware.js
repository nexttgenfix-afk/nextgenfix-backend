// Re-export a Cloudinary-backed single-image uploader from central upload middleware
const { uploadSingleImage } = require('./upload');
module.exports = uploadSingleImage;