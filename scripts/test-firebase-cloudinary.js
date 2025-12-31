// Quick test script to verify Firebase Admin and Cloudinary initialization
require('dotenv').config();

const path = require('path');
const firebase = require('../config/firebase');
const cloudinaryModule = require('../config/cloudinary');

console.log('--- Firebase Initialization ---');
try {
  console.log('Firebase initialized:', firebase.isInitialized());
  if (firebase.isInitialized()) {
    console.log('Firebase project id:', (firebase.admin?.app()?.options || {}).projectId || process.env.FIREBASE_PROJECT_ID);
  } else {
    console.warn('Firebase not initialized. Check FIREBASE_* env vars or service account JSON.');
  }
} catch (err) {
  console.error('Firebase error:', err.message || err);
}

console.log('\n--- Cloudinary Initialization ---');
try {
  const { cloudinary } = cloudinaryModule;
  console.log('Cloudinary configured:', !!(cloudinary && cloudinary.config));
  if (cloudinary && cloudinary.config) {
    const conf = cloudinary.config();
    console.log('Cloud name:', conf.cloud_name || process.env.CLOUDINARY_CLOUD_NAME);
  } else {
    console.warn('Cloudinary not configured. Check CLOUDINARY_* env vars.');
  }
} catch (err) {
  console.error('Cloudinary error:', err.message || err);
}

console.log('\nTest script finished.');
