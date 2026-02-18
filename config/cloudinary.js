const CloudinaryStorage = require('multer-storage-cloudinary');
const multer = require('multer');
const cloudinaryLib = require('cloudinary');
const dotenv = require('dotenv');
dotenv.config();
// If Cloudinary environment variables are present, configure real Cloudinary storage.
const hasCloudinaryEnv = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;

if (hasCloudinaryEnv) {
  const cloudinary = cloudinaryLib.v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    timeout: 120000 // 2 minutes timeout for uploads
  });

  // Configure storage for menu item photos
  const menuItemPhotoStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'nextgenfix/menu-items',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [
        { width: 800, height: 600, crop: 'limit' },
        { quality: 'auto' }
      ]
    }
  });

  // Configure storage for restaurant photos
  const restaurantPhotoStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'nextgenfix/restaurants',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [
        { width: 1200, height: 800, crop: 'limit' },
        { quality: 'auto' }
      ]
    }
  });

  // Configure storage for chef profile pictures
  const chefProfileStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'nextgenfix/chefs/profile',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [
        { width: 500, height: 500, crop: 'limit' },
        { quality: 'auto' }
      ]
    }
  });

  // Configure storage for chef cover photos
  const chefCoverStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'nextgenfix/chefs/cover',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [
        { width: 1200, height: 400, crop: 'limit' },
        { quality: 'auto' }
      ]
    }
  });

  // Configure storage for meal box photos
  const mealBoxPhotoStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'nextgenfix/meal-boxes',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [
        { width: 800, height: 800, crop: 'limit' },
        { quality: 'auto' }
      ]
    }
  });

  // General Cloudinary storage for combo photos
  const cloudinaryStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'nextgenfix/combo-photos',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [
        { width: 800, height: 800, crop: 'limit' },
        { quality: 'auto' }
      ]
    }
  });

  // Create the multer instances backed by Cloudinary
  const uploadMenuItemPhoto = multer({ 
    storage: menuItemPhotoStorage,
    limits: { fileSize: 5000000 } // 5MB limit
  });

  module.exports = {
    cloudinary,
    uploadMenuItemPhoto,
    uploadRestaurantPhotos: multer({ 
      storage: restaurantPhotoStorage,
      limits: { fileSize: 5000000 } // 5MB limit
    }),
    uploadChefProfilePicture: multer({ 
      storage: chefProfileStorage,
      limits: { fileSize: 5000000 } // 5MB limit
    }),
    uploadChefCoverPhoto: multer({ 
      storage: chefCoverStorage,
      limits: { fileSize: 5000000 } // 5MB limit
    }),
    uploadMealBoxPhoto: multer({
      storage: mealBoxPhotoStorage,
      limits: { fileSize: 5000000 }, // 5MB limit
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/jpg') {
          cb(null, true);
        } else {
          cb(new Error('Only JPEG, JPG and PNG file formats are allowed'));
        }
      }
    }),
    uploadComboPhoto: multer({
      storage: cloudinaryStorage,
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/jpg') {
          cb(null, true);
        } else {
          cb(new Error('Only JPEG, JPG and PNG file formats are allowed'));
        }
      }
    })
  };

} else {
  // Fallback: Cloudinary not configured — use memory storage and log a warning.
  console.warn('[cloudinary] CLOUDINARY env vars missing; using memory-storage fallback. Files will be available as buffers on req.file and must be uploaded via a service.');

  const memoryStorage = multer.memoryStorage();

  const uploadMenuItemPhoto = multer({
    storage: memoryStorage,
    limits: { fileSize: 5000000 }
  });

  module.exports = {
    cloudinary: null,
    uploadMenuItemPhoto,
    uploadRestaurantPhotos: multer({ storage: memoryStorage, limits: { fileSize: 5000000 } }),
    uploadChefProfilePicture: multer({ storage: memoryStorage, limits: { fileSize: 5000000 } }),
    uploadChefCoverPhoto: multer({ storage: memoryStorage, limits: { fileSize: 5000000 } }),
    uploadMealBoxPhoto: multer({ storage: memoryStorage, limits: { fileSize: 5000000 } }),
    uploadComboPhoto: multer({ storage: memoryStorage, limits: { fileSize: 5000000 } })
  };

}