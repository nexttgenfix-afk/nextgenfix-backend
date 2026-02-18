const { messaging, db } = require('../config/firebase');
const User = require('../models/userModel');

const notificationService = {
  /**
   * Send push notification to a specific user
   * @param {string} userId - User's MongoDB ID
   * @param {object} notification - Notification object with title, body, and data
   * @returns {Promise<object>} - Result of sending notification
   */
  async sendToUser(userId, notification) {
    try {
      // Get user's FCM token
      const user = await User.findById(userId);
      
      if (!user || !user.fcmToken) {
        console.log(`No FCM token found for user ${userId}`);
        return { success: false, error: 'User has no FCM token registered' };
      }
      
      // Create message
      const message = {
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data || {},
        token: user.fcmToken
      };
      
      // Send notification
      const response = await messaging.send(message);
      
      // Store notification in Firebase Realtime Database for history
      const notificationRef = db.ref(`notifications/${userId}`).push();
      await notificationRef.set({
        ...notification,
        timestamp: Date.now(),
        read: false
      });
      
      return { 
        success: true, 
        messageId: response,
        dbKey: notificationRef.key
      };
    } catch (error) {
      console.error('Error sending notification:', error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Send notification to multiple users
   * @param {Array<string>} userIds - Array of user MongoDB IDs
   * @param {object} notification - Notification object
   * @returns {Promise<object>} - Result of sending notification
   */
  async sendToMultipleUsers(userIds, notification) {
    try {
      // Get FCM tokens for all users
      const users = await User.find({ _id: { $in: userIds } });
      const tokens = users
        .filter(user => user.fcmToken)
        .map(user => user.fcmToken);
      
      if (tokens.length === 0) {
        return { success: false, error: 'No valid FCM tokens found' };
      }
      
      // Create message for multiple recipients
      const message = {
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data || {},
        tokens: tokens
      };
      
      // Send multicast notification
      const response = await messaging.sendMulticast(message);
      
      // Store notifications in database
      const dbUpdates = {};
      users.forEach(user => {
        if (user.fcmToken) {
          const notifKey = db.ref(`notifications/${user._id}`).push().key;
          dbUpdates[`notifications/${user._id}/${notifKey}`] = {
            ...notification,
            timestamp: Date.now(),
            read: false
          };
        }
      });
      
      await db.ref().update(dbUpdates);
      
      return { 
        success: true, 
        successCount: response.successCount,
        failureCount: response.failureCount,
        responses: response.responses
      };
    } catch (error) {
      console.error('Error sending multicast notification:', error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Send notification to a topic
   * @param {string} topic - Topic name
   * @param {object} notification - Notification object
   * @returns {Promise<object>} - Result of sending notification
   */
  async sendToTopic(topic, notification) {
    try {
      const message = {
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data || {},
        topic: topic
      };
      
      const response = await messaging.send(message);
      
      // Store notification in topic history
      const notificationRef = db.ref(`topic_notifications/${topic}`).push();
      await notificationRef.set({
        ...notification,
        timestamp: admin.database.ServerValue.TIMESTAMP
      });
      
      return { 
        success: true, 
        messageId: response,
        dbKey: notificationRef.key
      };
    } catch (error) {
      console.error('Error sending topic notification:', error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Subscribe users to a topic
   * @param {Array<string>} tokens - FCM tokens to subscribe
   * @param {string} topic - Topic name
   * @returns {Promise<object>} - Result of subscription
   */
  async subscribeToTopic(tokens, topic) {
    try {
      const response = await messaging.subscribeToTopic(tokens, topic);
      return { success: true, results: response.results };
    } catch (error) {
      console.error('Error subscribing to topic:', error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Unsubscribe users from a topic
   * @param {Array<string>} tokens - FCM tokens to unsubscribe
   * @param {string} topic - Topic name
   * @returns {Promise<object>} - Result of unsubscription
   */
  async unsubscribeFromTopic(tokens, topic) {
    try {
      const response = await messaging.unsubscribeFromTopic(tokens, topic);
      return { success: true, results: response.results };
    } catch (error) {
      console.error('Error unsubscribing from topic:', error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Mark a notification as read
   * @param {string} userId - User's MongoDB ID
   * @param {string} notificationKey - Notification key in database
   * @returns {Promise<object>} - Result of operation
   */
  async markNotificationRead(userId, notificationKey) {
    try {
      await db.ref(`notifications/${userId}/${notificationKey}`).update({ read: true });
      return { success: true };
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Get user's notifications
   * @param {string} userId - User's MongoDB ID
   * @param {number} limit - Maximum number of notifications to retrieve
   * @returns {Promise<Array>} - User notifications
   */
  async getUserNotifications(userId, limit = 50) {
    try {
      const snapshot = await db.ref(`notifications/${userId}`)
        .orderByChild('timestamp')
        .limitToLast(limit)
        .once('value');
      
      const notifications = [];
      snapshot.forEach(childSnapshot => {
        notifications.push({
          id: childSnapshot.key,
          ...childSnapshot.val()
        });
      });
      
      return notifications.reverse();
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  }
};

module.exports = notificationService;