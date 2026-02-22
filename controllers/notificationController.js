const notificationService = require('../services/notificationService');
const Notification = require('../models/notificationModel');
const User = require('../models/userModel');

exports.updateFcmToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'FCM token is required' });
    }
    await User.findByIdAndUpdate(userId, {
      fcmToken: token,
      fcmTokenLastUpdated: new Date()
    });
    res.status(200).json({ success: true, message: 'FCM token updated successfully' });
  } catch (error) {
    console.error('Error updating FCM token:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.sendNotification = async (req, res) => {
  try {
    const { userId, title, body, data, type } = req.body;
    if (!userId || !title || !body) {
      return res.status(400).json({ success: false, message: 'User ID, title, and body are required' });
    }
    const result = await notificationService.sendToUser(userId, { title, body, data: data || {}, type });
    if (!result.success) {
      return res.status(400).json({ success: false, message: 'Failed to send notification', error: result.error });
    }
    res.status(200).json({ success: true, message: 'Notification sent successfully', data: result });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;

    const notifications = await Notification.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(limit);

    res.status(200).json({ success: true, data: notifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getNotificationsPaginated = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = { user: userId };
    if (req.query.read === 'true') query.isRead = true;
    if (req.query.read === 'false') query.isRead = false;

    const [notifications, total] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: notifications,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, user: userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.status(200).json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await Notification.updateMany(
      { user: userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndDelete({ _id: notificationId, user: userId });

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.status(200).json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteAllNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    await Notification.deleteMany({ user: userId });
    res.status(200).json({ success: true, message: 'All notifications deleted' });
  } catch (error) {
    console.error('Error deleting all notifications:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getNotificationCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const [total, unread] = await Promise.all([
      Notification.countDocuments({ user: userId }),
      Notification.countDocuments({ user: userId, isRead: false })
    ]);

    res.status(200).json({
      success: true,
      data: { total, unread, read: total - unread }
    });
  } catch (error) {
    console.error('Error getting notification count:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.subscribeToTopic = async (req, res) => {
  try {
    const userId = req.user.id;
    const { topic } = req.body;
    if (!topic) {
      return res.status(400).json({ success: false, message: 'Topic name is required' });
    }
    const user = await User.findById(userId);
    if (!user || !user.fcmToken) {
      return res.status(400).json({ success: false, message: 'User has no FCM token registered' });
    }
    const result = await notificationService.subscribeToTopic([user.fcmToken], topic);
    if (!result.success) {
      return res.status(400).json({ success: false, message: 'Failed to subscribe to topic', error: result.error });
    }
    if (!user.subscribedTopics.includes(topic)) {
      user.subscribedTopics.push(topic);
      await user.save();
    }
    res.status(200).json({ success: true, message: 'Subscribed to topic successfully' });
  } catch (error) {
    console.error('Error subscribing to topic:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.unsubscribeFromTopic = async (req, res) => {
  try {
    const userId = req.user.id;
    const { topic } = req.body;
    if (!topic) {
      return res.status(400).json({ success: false, message: 'Topic name is required' });
    }
    const user = await User.findById(userId);
    if (!user || !user.fcmToken) {
      return res.status(400).json({ success: false, message: 'User has no FCM token registered' });
    }
    const result = await notificationService.unsubscribeFromTopic([user.fcmToken], topic);
    if (!result.success) {
      return res.status(400).json({ success: false, message: 'Failed to unsubscribe from topic', error: result.error });
    }
    user.subscribedTopics = user.subscribedTopics.filter(t => t !== topic);
    await user.save();
    res.status(200).json({ success: true, message: 'Unsubscribed from topic successfully' });
  } catch (error) {
    console.error('Error unsubscribing from topic:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.sendTopicNotification = async (req, res) => {
  try {
    const { topic, title, body, data } = req.body;
    if (!topic || !title || !body) {
      return res.status(400).json({ success: false, message: 'Topic, title, and body are required' });
    }
    const result = await notificationService.sendToTopic(topic, { title, body, data: data || {} });
    if (!result.success) {
      return res.status(400).json({ success: false, message: 'Failed to send topic notification', error: result.error });
    }
    res.status(200).json({ success: true, message: 'Topic notification sent successfully', data: result });
  } catch (error) {
    console.error('Error sending topic notification:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
