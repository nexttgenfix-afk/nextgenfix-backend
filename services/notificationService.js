const { messaging } = require('../config/firebase');
const Notification = require('../models/notificationModel');
const User = require('../models/userModel');

const notificationService = {
  /**
   * Send push notification to a specific user and store in MongoDB
   * @param {string} userId - User's MongoDB ID
   * @param {object} notification - { title, body, data, type }
   * @returns {Promise<object>}
   */
  async sendToUser(userId, notification) {
    try {
      // Store notification in MongoDB
      const saved = await Notification.create({
        user: userId,
        type: notification.type || 'system',
        title: notification.title,
        message: notification.body,
        data: notification.data || {}
      });

      // Try sending FCM push (non-blocking — notification is already stored)
      const user = await User.findById(userId);
      if (user && user.fcmToken && messaging) {
        try {
          const message = {
            notification: { title: notification.title, body: notification.body },
            data: notification.data || {},
            token: user.fcmToken
          };
          await messaging.send(message);
        } catch (fcmErr) {
          console.warn(`FCM push failed for user ${userId}:`, fcmErr.message);
        }
      }

      return { success: true, notificationId: saved._id };
    } catch (error) {
      console.error('Error sending notification:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Send notification to multiple users
   * @param {Array<string>} userIds - Array of user MongoDB IDs
   * @param {object} notification - { title, body, data, type }
   * @returns {Promise<object>}
   */
  async sendToMultipleUsers(userIds, notification) {
    try {
      // Bulk insert notifications for all users
      const docs = userIds.map(uid => ({
        user: uid,
        type: notification.type || 'system',
        title: notification.title,
        message: notification.body,
        data: notification.data || {}
      }));
      await Notification.insertMany(docs);

      // Send FCM multicast
      const users = await User.find({ _id: { $in: userIds } });
      const tokens = users.filter(u => u.fcmToken).map(u => u.fcmToken);

      let fcmResult = { successCount: 0, failureCount: 0 };
      if (tokens.length > 0 && messaging) {
        try {
          const message = {
            notification: { title: notification.title, body: notification.body },
            data: notification.data || {},
            tokens
          };
          fcmResult = await messaging.sendEachForMulticast(message);
        } catch (fcmErr) {
          console.warn('FCM multicast failed:', fcmErr.message);
        }
      }

      return {
        success: true,
        totalUsers: userIds.length,
        successCount: fcmResult.successCount,
        failureCount: fcmResult.failureCount
      };
    } catch (error) {
      console.error('Error sending multicast notification:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Send notification to a topic via FCM
   * @param {string} topic - Topic name
   * @param {object} notification - { title, body, data }
   * @returns {Promise<object>}
   */
  async sendToTopic(topic, notification) {
    try {
      if (!messaging) {
        return { success: false, error: 'FCM messaging not initialized' };
      }

      const message = {
        notification: { title: notification.title, body: notification.body },
        data: notification.data || {},
        topic
      };
      const response = await messaging.send(message);

      return { success: true, messageId: response };
    } catch (error) {
      console.error('Error sending topic notification:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Subscribe tokens to a topic
   */
  async subscribeToTopic(tokens, topic) {
    try {
      if (!messaging) {
        return { success: false, error: 'FCM messaging not initialized' };
      }
      const response = await messaging.subscribeToTopic(tokens, topic);
      return { success: true, results: response.results };
    } catch (error) {
      console.error('Error subscribing to topic:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Unsubscribe tokens from a topic
   */
  async unsubscribeFromTopic(tokens, topic) {
    try {
      if (!messaging) {
        return { success: false, error: 'FCM messaging not initialized' };
      }
      const response = await messaging.unsubscribeFromTopic(tokens, topic);
      return { success: true, results: response.results };
    } catch (error) {
      console.error('Error unsubscribing from topic:', error);
      return { success: false, error: error.message };
    }
  }
};

module.exports = notificationService;
