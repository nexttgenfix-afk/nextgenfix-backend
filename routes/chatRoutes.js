const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { verifyToken } = require('../middlewares/auth');
const { validateMessage } = require('../middlewares/validation');
const { uploadSingleImage } = require('../middlewares/upload');

// All routes require authentication
router.use(verifyToken);

// Get user's chat conversations
router.get('/conversations', chatController.getConversations);

// Get messages for a specific conversation
router.get('/conversations/:conversationId/messages', chatController.getMessages);

// Send a message
router.post('/messages', validateMessage, chatController.sendMessage);

// Send media message
router.post('/messages/media', uploadSingleImage, chatController.sendMediaMessage);

// Mark messages as read
router.put('/conversations/:conversationId/read', chatController.markAsRead);

// Get conversation with a specific user
router.get('/users/:userId', chatController.getConversationWithUser);

// Start new conversation
router.post('/conversations', chatController.startConversation);

// Delete conversation
router.delete('/conversations/:conversationId', chatController.deleteConversation);

module.exports = router;