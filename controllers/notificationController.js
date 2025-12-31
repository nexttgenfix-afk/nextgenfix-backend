const notificationService = require('../services/notificationService');
const User = require('../models/userModel');

exports.updateFcmToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: 'FCM token is required' });
    }
    await User.findByIdAndUpdate(userId, { 
      fcmToken: token,
      fcmTokenLastUpdated: new Date()
    });
    res.status(200).json({ message: 'FCM token updated successfully' });
  } catch (error) {
    console.error('Error updating FCM token:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.sendNotification = async (req, res) => {
  try {
    const { userId, title, body, data } = req.body;
    if (!userId || !title || !body) {
      return res.status(400).json({ message: 'User ID, title, and body are required' });
    }
    const result = await notificationService.sendToUser(userId, {
      title,
      body,
      data: data || {}
    });
    if (!result.success) {
      return res.status(400).json({ message: 'Failed to send notification', error: result.error });
    }
    res.status(200).json({
      message: 'Notification sent successfully',
      result
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit } = req.query;
    const notifications = await notificationService.getUserNotifications(
      userId,
      limit ? parseInt(limit) : 50
    );
    res.status(200).json({ notifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getNotificationsPaginated = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, page = 1, read } = req.query;
    const pageSize = parseInt(limit);
    const pageNum = parseInt(page);
    const startAt = (pageNum - 1) * pageSize;
    let notifications = await notificationService.getUserNotifications(userId, 500);
    if (read === 'true') notifications = notifications.filter(n => n.read === true);
    if (read === 'false') notifications = notifications.filter(n => n.read === false);
    notifications = notifications.sort((a, b) => b.timestamp - a.timestamp);
    const paginated = notifications.slice(startAt, startAt + pageSize);
    res.status(200).json({
      notifications: paginated,
      total: notifications.length,
      page: pageNum,
      pageSize
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;
    if (!notificationId) {
      return res.status(400).json({ message: 'Notification ID is required' });
    }
    const result = await notificationService.markNotificationRead(userId, notificationId);
    if (!result.success) {
      return res.status(400).json({ message: 'Failed to mark notification as read', error: result.error });
    }
    res.status(200).json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const notifications = await notificationService.getUserNotifications(userId, 500);
    const unread = notifications.filter(n => !n.read);
    const promises = unread.map(n => notificationService.markNotificationRead(userId, n.id));
    await Promise.all(promises);
    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;
    if (!notificationId) {
      return res.status(400).json({ message: 'Notification ID is required' });
    }
    const result = await notificationService.deleteNotification(userId, notificationId);
    if (!result.success) {
      return res.status(400).json({ message: 'Failed to delete notification', error: result.error });
    }
    res.status(200).json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteAllNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const notifications = await notificationService.getUserNotifications(userId, 500);
    const promises = notifications.map(n => notificationService.deleteNotification(userId, n.id));
    await Promise.all(promises);
    res.status(200).json({ message: 'All notifications deleted' });
  } catch (error) {
    console.error('Error deleting all notifications:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getNotificationCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const notifications = await notificationService.getUserNotifications(userId, 500);
    const total = notifications.length;
    const unread = notifications.filter(n => !n.read).length;
    const read = notifications.filter(n => n.read).length;
    res.status(200).json({ total, unread, read });
  } catch (error) {
    console.error('Error getting notification count:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.subscribeToTopic = async (req, res) => {
  try {
    const userId = req.user.id;
    const { topic } = req.body;
    if (!topic) {
      return res.status(400).json({ message: 'Topic name is required' });
    }
    const user = await User.findById(userId);
    if (!user || !user.fcmToken) {
      return res.status(400).json({ message: 'User has no FCM token registered' });
    }
    const result = await notificationService.subscribeToTopic([user.fcmToken], topic);
    if (!result.success) {
      return res.status(400).json({ message: 'Failed to subscribe to topic', error: result.error });
    }
    if (!user.subscribedTopics.includes(topic)) {
      user.subscribedTopics.push(topic);
      await user.save();
    }
    res.status(200).json({ message: 'Subscribed to topic successfully' });
  } catch (error) {
    console.error('Error subscribing to topic:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.unsubscribeFromTopic = async (req, res) => {
  try {
    const userId = req.user.id;
    const { topic } = req.body;
    if (!topic) {
      return res.status(400).json({ message: 'Topic name is required' });
    }
    const user = await User.findById(userId);
    if (!user || !user.fcmToken) {
      return res.status(400).json({ message: 'User has no FCM token registered' });
    }
    const result = await notificationService.unsubscribeFromTopic([user.fcmToken], topic);
    if (!result.success) {
      return res.status(400).json({ message: 'Failed to unsubscribe from topic', error: result.error });
    }
    user.subscribedTopics = user.subscribedTopics.filter(t => t !== topic);
    await user.save();
    res.status(200).json({ message: 'Unsubscribed from topic successfully' });
  } catch (error) {
    console.error('Error unsubscribing from topic:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.sendTopicNotification = async (req, res) => {
  try {
    const { topic, title, body, data } = req.body;
    if (!topic || !title || !body) {
      return res.status(400).json({ message: 'Topic, title, and body are required' });
    }
    const result = await notificationService.sendToTopic(topic, {
      title,
      body,
      data: data || {}
    });
    if (!result.success) {
      return res.status(400).json({ message: 'Failed to send topic notification', error: result.error });
    }
    res.status(200).json({
      message: 'Topic notification sent successfully',
      result
    });
  } catch (error) {
    console.error('Error sending topic notification:', error);
    res.status(500).json({ message: 'Server error' });
  }
};