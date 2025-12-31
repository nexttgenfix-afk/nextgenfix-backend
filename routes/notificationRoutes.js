const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { verifyToken } = require('../middlewares/auth');
const { verifyAdmin } = require('../middlewares/adminAuth');

// User routes
router.get('/', verifyToken, notificationController.getMyNotifications);
router.get('/paginated', verifyToken, notificationController.getNotificationsPaginated);
router.get('/count', verifyToken, notificationController.getNotificationCount);
router.put('/:id/read', verifyToken, notificationController.markNotificationRead);
router.put('/read-all', verifyToken, notificationController.markAllNotificationsRead);
router.put('/fcm-token', verifyToken, notificationController.updateFcmToken);
router.delete('/:id', verifyToken, notificationController.deleteNotification);
router.delete('/', verifyToken, notificationController.deleteAllNotifications);

// Topic management
router.post('/topics/subscribe', verifyToken, notificationController.subscribeToTopic);
router.post('/topics/unsubscribe', verifyToken, notificationController.unsubscribeFromTopic);

// Admin routes
router.post('/send', verifyAdmin, notificationController.sendNotification);
router.post('/topics/send', verifyAdmin, notificationController.sendTopicNotification);

module.exports = router;
