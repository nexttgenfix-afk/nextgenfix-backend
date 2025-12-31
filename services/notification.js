const Notification = require('../models/notificationModel');
const firebaseService = require('./firebase');

module.exports = {
  /**
   * Send notification to user
   * @param {String} userId - User ID
   * @param {Object} notification - Notification details
   * @param {Array} channels - Channels to send through ['push', 'sms', 'email']
   * @returns {Object} Send result
   */
  async sendNotification(userId, notification, channels = ['push']) {
    try {
      // Save notification to database
      const savedNotification = await this.createNotification({
        userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data
      });

      // Send through specified channels
      const results = {};
      
      if (channels.includes('push')) {
        results.push = await this.sendPushNotification(userId, notification);
      }
      
      if (channels.includes('sms')) {
        results.sms = await this.sendSMSNotification(userId, notification.message);
      }
      
      if (channels.includes('email')) {
        results.email = await this.sendEmailNotification(userId, notification);
      }

      return {
        success: true,
        notification: savedNotification,
        channels: results
      };
    } catch (error) {
      console.error('Send notification error:', error);
      throw error;
    }
  },

  /**
   * Create notification in database
   * @param {Object} notificationData - Notification data object
   * @param {String} notificationData.userId - User ID
   * @param {String} notificationData.type - Notification type
   * @param {String} notificationData.title - Notification title
   * @param {String} notificationData.message - Notification message
   * @param {Object} notificationData.data - Additional data
   * @returns {Object} Created notification
   */
  async createNotification(notificationData) {
    const { userId, type, title, message, data = {} } = notificationData;
    
    const notification = new Notification({
      user: userId,
      type,
      title,
      message,
      data,
      sentVia: ['push'],
      isRead: false
    });

    return await notification.save();
  },

  /**
   * Send push notification via Firebase
   * @param {String} userId - User ID
   * @param {Object} notification - Notification details
   * @returns {Object} Send result
   */
  async sendPushNotification(userId, notification) {
    try {
      // In production, get user's FCM token from User model
      // For now, this is a mock/placeholder
      console.log('[MOCK] Sending push notification to user:', userId, notification);
      
      return {
        success: true,
        message: 'Push notification sent (MOCK)'
      };
    } catch (error) {
      console.error('Push notification error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Send SMS notification
   * @param {String} userId - User ID
   * @param {String} message - SMS message
   * @returns {Object} Send result
   */
  async sendSMSNotification(userId, message) {
    console.log('[MOCK] Sending SMS to user:', userId, message);
    
    return {
      success: true,
      message: 'SMS sent (MOCK)'
    };
  },

  /**
   * Send email notification
   * @param {String} userId - User ID
   * @param {Object} notification - Notification details
   * @returns {Object} Send result
   */
  async sendEmailNotification(userId, notification) {
    console.log('[MOCK] Sending email to user:', userId, notification);
    
    return {
      success: true,
      message: 'Email sent (MOCK)'
    };
  },

  /**
   * Mark notification as read
   * @param {String} notificationId - Notification ID
   * @returns {Object} Updated notification
   */
  async markAsRead(notificationId) {
    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    return notification;
  },

  /**
   * Get user notifications
   * @param {String} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Array} Notifications
   */
  async getUserNotifications(userId, filters = {}) {
    const query = { userId };
    
    if (filters.isRead !== undefined) {
      query.isRead = filters.isRead;
    }
    
    if (filters.type) {
      query.type = filters.type;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(filters.limit || 50);

    return notifications;
  },

  /**
   * Send bulk notifications
   * @param {Array} userIds - Array of user IDs
   * @param {Object} notification - Notification details
   * @returns {Object} Send result
   */
  async sendBulkNotifications(userIds, notification) {
    console.log('[MOCK] Sending bulk notifications to users:', userIds.length, notification);
    
    const results = await Promise.allSettled(
      userIds.map(userId => 
        this.sendNotification(userId, notification, ['push'])
      )
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return {
      success: true,
      total: userIds.length,
      successful,
      failed
    };
  },

  /**
   * Send broadcast notification to all users
   * @param {Object} notification - Notification details
   * @returns {Object} Send result
   */
  async broadcastNotification(notification) {
    console.log('[MOCK] Broadcasting notification:', notification);
    
    // In production, use Firebase topics or get all active user tokens
    return {
      success: true,
      message: 'Broadcast sent (MOCK)'
    };
  }
};

// Export standalone function for backward compatibility
const createNotification = async (notificationData) => {
  const { userId, type, title, message, data = {} } = notificationData;
  
  const notification = new Notification({
    user: userId,
    type,
    title,
    message,
    data,
    sentVia: ['push'],
    isRead: false
  });

  return await notification.save();
};

// Add standalone function to exports
module.exports.createNotification = createNotification;
