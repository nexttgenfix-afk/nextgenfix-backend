const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Prefer explicit JSON service account file if present, otherwise build credential from env vars
function getServiceAccount() {
  try {
    const serviceAccountPath = path.resolve(__dirname, '../nextgenfix-8bbe3-firebase-adminsdk-fbsvc-628517bf82.json');
    if (fs.existsSync(serviceAccountPath)) {
      return require(serviceAccountPath);
    }
  } catch (e) {
    // fallthrough to env-based
  }

  // Build service account object from environment variables
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!process.env.FIREBASE_PROJECT_ID || !privateKey || !process.env.FIREBASE_CLIENT_EMAIL) {
    return null;
  }

  return {
    type: process.env.FIREBASE_TYPE || 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: privateKey.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  };
}

const serviceAccount = getServiceAccount();

if (!serviceAccount) {
  console.warn('Firebase service account not found in file or environment variables. Firebase will not be initialized.');
} else {
  // Avoid duplicate initialization when this module is imported multiple times
  if (!admin.apps || admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL || `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`,
    });
  } else {
    // Firebase already initialized by another module; reuse the existing app
    console.info('Firebase already initialized - reusing the existing app instance.');
  }
}

let db = null;
let messaging = null;
if (admin.apps && admin.apps.length > 0) {
  // Only initialize Realtime Database if an explicit database URL is provided.
  // This project uses MongoDB for all primary storage; Firebase RTDB is optional.
  const explicitDbUrl = process.env.FIREBASE_DATABASE_URL;
  if (explicitDbUrl) {
    try {
      db = admin.database();
    } catch (err) {
      console.warn('Failed to initialize Firebase Realtime Database:', err.message || err);
      db = null;
    }
  } else {
    // Do not call admin.database() to avoid "Can't determine Firebase Database URL."
    db = null;
  }

  // Messaging (FCM) can be used without RTDB
  try {
    messaging = admin.messaging();
  } catch (err) {
    console.warn('Firebase messaging not available:', err.message || err);
    messaging = null;
  }
}

module.exports = {
  admin,
  db,
  messaging,
  isInitialized: () => !!(admin.apps && admin.apps.length > 0),
};
