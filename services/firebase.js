/**
 * Firebase Service
 * Handles Firebase Admin SDK operations for authentication
 * 
 * Features:
 * - Verify Firebase ID Tokens (Phone/Google/Apple)
 * - User management via Firebase Admin
 * - Push notifications via FCM
 */

// Use the centrally-initialized admin instance from config/firebase
const { admin, db, messaging, isInitialized } = require('../config/firebase');

// Determine whether Firebase Admin SDK is initialized (credentials available)
const hasFirebaseCredentials = !!isInitialized();

/**
 * Verify Firebase ID Token
 * Used for Phone, Google, and Apple authentication
 * 
 * @param {string} idToken - Firebase ID Token from client
 * @returns {object} Result with user information
 */
const verifyIdToken = async (idToken) => {
  // Mock mode if Firebase not configured
  if (!hasFirebaseCredentials) {
    console.log('🔥 MOCK: Firebase ID Token verification (no credentials)');
    console.log('Token preview:', idToken.substring(0, 50) + '...');
    
    // Return mock data for testing
    return {
      success: true,
      uid: 'mock_firebase_uid_' + Date.now(),
      phone: '+919876543210',
      email: 'testuser@example.com',
      name: 'Test User',
      picture: null,
      provider: 'phone',
      emailVerified: false,
      isMockData: true
    };
  }

  // Real Firebase verification
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken, true);
    
    // Extract user information from token
    const provider = decodedToken.firebase.sign_in_provider;
    
    return {
      success: true,
      uid: decodedToken.uid,
      phone: decodedToken.phone_number || null,
      email: decodedToken.email || null,
      name: decodedToken.name || null,
      picture: decodedToken.picture || null,
      provider: provider, // 'phone', 'google.com', 'apple.com'
      emailVerified: decodedToken.email_verified || false,
      isMockData: false
    };
  } catch (error) {
    console.error('Firebase token verification error:', error.message);
    
    return {
      success: false,
      error: error.message,
      code: error.code
    };
  }
};

/**
 * Get user by Firebase UID
 * For admin purposes or user management
 * 
 * @param {string} uid - Firebase UID
 * @returns {object} User record from Firebase
 */
const getUserByUid = async (uid) => {
  if (!hasFirebaseCredentials) {
    console.log('🔥 MOCK: Get user by UID');
    return {
      success: true,
      user: {
        uid: uid,
        phone: '+919876543210',
        email: 'testuser@example.com',
        displayName: 'Test User'
      },
      isMockData: true
    };
  }

  try {
    const userRecord = await admin.auth().getUser(uid);
    return {
      success: true,
      user: userRecord
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Delete user from Firebase Authentication
 * Used when admin deletes a user account
 * 
 * @param {string} uid - Firebase UID
 * @returns {object} Success status
 */
const deleteFirebaseUser = async (uid) => {
  if (!hasFirebaseCredentials) {
    console.log('🔥 MOCK: Delete Firebase user');
    return { success: true, isMockData: true };
  }

  try {
    await admin.auth().deleteUser(uid);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Update user in Firebase
 * Used to update phone, email, etc.
 * 
 * @param {string} uid - Firebase UID
 * @param {object} updates - Fields to update
 * @returns {object} Success status
 */
const updateFirebaseUser = async (uid, updates) => {
  if (!hasFirebaseCredentials) {
    console.log('🔥 MOCK: Update Firebase user');
    return { success: true, isMockData: true };
  }

  try {
    await admin.auth().updateUser(uid, updates);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send Push Notification via FCM
 * 
 * @param {string} fcmToken - User's FCM device token
 * @param {object} notification - Notification payload
 * @returns {object} Send result
 */
const sendPushNotification = async (fcmToken, notification) => {
  if (!hasFirebaseCredentials) {
    console.log('🔥 MOCK: Send push notification');
    console.log('To:', fcmToken);
    console.log('Notification:', notification);
    return { success: true, isMockData: true };
  }

  try {
    const message = {
      token: fcmToken,
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: notification.data || {},
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    const response = await admin.messaging().send(message);
    return {
      success: true,
      messageId: response
    };
  } catch (error) {
    console.error('FCM send error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send Push Notification to Multiple Devices
 * 
 * @param {Array} fcmTokens - Array of FCM tokens
 * @param {object} notification - Notification payload
 * @returns {object} Send result
 */
const sendBulkPushNotifications = async (fcmTokens, notification) => {
  if (!hasFirebaseCredentials) {
    console.log('🔥 MOCK: Send bulk push notifications');
    console.log('To:', fcmTokens.length, 'devices');
    console.log('Notification:', notification);
    return { success: true, isMockData: true };
  }

  try {
    const message = {
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: notification.data || {},
      tokens: fcmTokens
    };

    const response = await admin.messaging().sendMulticast(message);
    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount
    };
  } catch (error) {
    console.error('FCM bulk send error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Subscribe user to topic
 * For broadcasting notifications to groups
 * 
 * @param {Array} fcmTokens - FCM tokens to subscribe
 * @param {string} topic - Topic name
 * @returns {object} Subscribe result
 */
const subscribeToTopic = async (fcmTokens, topic) => {
  if (!hasFirebaseCredentials) {
    console.log('🔥 MOCK: Subscribe to topic');
    return { success: true, isMockData: true };
  }

  try {
    const response = await admin.messaging().subscribeToTopic(fcmTokens, topic);
    return {
      success: true,
      successCount: response.successCount
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Unsubscribe user from topic
 * 
 * @param {Array} fcmTokens - FCM tokens to unsubscribe
 * @param {string} topic - Topic name
 * @returns {object} Unsubscribe result
 */
const unsubscribeFromTopic = async (fcmTokens, topic) => {
  if (!hasFirebaseCredentials) {
    console.log('🔥 MOCK: Unsubscribe from topic');
    return { success: true, isMockData: true };
  }

  try {
    const response = await admin.messaging().unsubscribeFromTopic(fcmTokens, topic);
    return {
      success: true,
      successCount: response.successCount
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send notification to topic
 * Broadcast to all users subscribed to a topic
 * 
 * @param {string} topic - Topic name
 * @param {object} notification - Notification payload
 * @returns {object} Send result
 */
const sendToTopic = async (topic, notification) => {
  if (!hasFirebaseCredentials) {
    console.log('🔥 MOCK: Send to topic');
    console.log('Topic:', topic);
    console.log('Notification:', notification);
    return { success: true, isMockData: true };
  }

  try {
    const message = {
      topic: topic,
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: notification.data || {}
    };

    const response = await admin.messaging().send(message);
    return {
      success: true,
      messageId: response
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  // Authentication
  verifyIdToken,
  getUserByUid,
  deleteFirebaseUser,
  updateFirebaseUser,
  
  // Push Notifications
  sendPushNotification,
  sendBulkPushNotifications,
  subscribeToTopic,
  unsubscribeFromTopic,
  sendToTopic,
  
  // Utility
  hasFirebaseCredentials
};
