const Chat = require('../models/chatModel');
const User = require('../models/userModel');
const { broadcastMessage } = require('../config/websocket'); // Import WebSocket broadcast function

// Create a new chat
exports.createChat = async (req, res) => {
  const { participants } = req.body;

  if (!participants || participants.length < 2) {
    return res.status(400).json({ message: "At least two participants are required" });
  }

  try {
    const chat = new Chat({ participants });
    await chat.save();

    res.status(201).json({ message: "Chat created successfully", chat });
  } catch (err) {
    console.error("Create chat error:", err);
    res.status(500).json({ message: "Failed to create chat", error: err.message });
  }
};

// Send a message
exports.sendMessage = async (req, res) => {
  const { chatId, content, media } = req.body;
  const senderId = req.user.id;

  if (!chatId || (!content && (!media || media.length === 0))) {
    return res.status(400).json({ message: "Chat ID and message content or media are required" });
  }

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const message = {
      sender: senderId,
      content: content || "",
      media: media || [],
      timestamp: new Date()
    };

    chat.messages.push(message);
    chat.unreadCount += 1; // Increment unread count for participants other than the sender
    chat.updatedAt = Date.now();
    await chat.save();

    // Broadcast the message to participants via WebSocket
    broadcastMessage(chat.participants, {
      chatId,
      senderId,
      content: message.content,
      media: message.media,
      timestamp: message.timestamp
    });

    res.status(200).json({ message: "Message sent successfully", chat });
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ message: "Failed to send message", error: err.message });
  }
};

// Get chat messages
exports.getChatMessages = async (req, res) => {
  const { chatId } = req.params;
  const { page = 1, limit = 20 } = req.query; // Default pagination values

  try {
    const chat = await Chat.findById(chatId).populate('participants', 'name profilePicture');
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    // Paginate messages
    const totalMessages = chat.messages.length;
    const paginatedMessages = chat.messages.slice((page - 1) * limit, page * limit);

    res.status(200).json({
      messages: paginatedMessages,
      totalMessages,
      currentPage: page,
      totalPages: Math.ceil(totalMessages / limit)
    });
  } catch (err) {
    console.error("Get chat messages error:", err);
    res.status(500).json({ message: "Failed to fetch messages", error: err.message });
  }
};

// Mark messages as read
exports.markMessagesAsRead = async (req, res) => {
  const { chatId } = req.params;
  const userId = req.user.id;

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    chat.messages.forEach(message => {
      if (message.sender.toString() !== userId) {
        message.isRead = true;
      }
    });

    chat.unreadCount = 0; // Reset unread count for the user
    await chat.save();

    res.status(200).json({ message: "Messages marked as read" });
  } catch (err) {
    console.error("Mark messages as read error:", err);
    res.status(500).json({ message: "Failed to mark messages as read", error: err.message });
  }
};

// Get user's conversations (paginated)
exports.getConversations = async (req, res) => {
  const userId = req.user.id || req.user._id;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;

  try {
    const filter = { participants: userId };
    const totalConversations = await Chat.countDocuments(filter);

    const chats = await Chat.find(filter)
      .populate('participants', 'name profilePicture')
      .sort({ lastMessageTimestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const conversations = (chats || []).map(chat => {
      // compute unread messages for this user
      const unread = (chat.messages || []).reduce((acc, msg) => {
        const senderId = msg.sender ? msg.sender.toString() : '';
        if (!msg.isRead && senderId !== (userId ? userId.toString() : '')) return acc + 1;
        return acc;
      }, 0);

      const otherParticipants = (chat.participants || []).filter(p => p._id.toString() !== (userId ? userId.toString() : ''));

      return {
        chatId: chat._id,
        participants: chat.participants,
        otherParticipants,
        lastMessage: chat.lastMessage || ((chat.messages && chat.messages.length) ? chat.messages[chat.messages.length - 1].content : ''),
        lastMessageTimestamp: chat.lastMessageTimestamp || ((chat.messages && chat.messages.length) ? chat.messages[chat.messages.length - 1].timestamp : null),
        unreadCount: unread,
        updatedAt: chat.updatedAt || chat.lastMessageTimestamp
      };
    });

    res.status(200).json({
      conversations,
      totalConversations,
      currentPage: page,
      totalPages: Math.ceil(totalConversations / limit)
    });
  } catch (err) {
    console.error('Get conversations error:', err);
    res.status(500).json({ message: 'Failed to fetch conversations', error: err.message });
  }
};

// Backwards-compatible alias: some routes expect getMessages
exports.getMessages = async (req, res) => {
  // Delegate to getChatMessages to keep behavior consistent
  return exports.getChatMessages(req, res);
};

// Send media message (expects multer middleware to populate req.file or req.files)
exports.sendMediaMessage = async (req, res) => {
  const { chatId } = req.body;
  const senderId = req.user.id;

  // multer single upload will put file at req.file
  const file = req.file;

  if (!chatId || !file) {
    return res.status(400).json({ message: 'chatId and a media file are required' });
  }

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    // Build media URL/path. If your app serves uploads statically, adjust accordingly.
    const mediaUrl = file.path || (file.location ? file.location : null);

    const message = {
      sender: senderId,
      content: '',
      media: mediaUrl ? [mediaUrl] : [],
      timestamp: new Date()
    };

    chat.messages.push(message);
    chat.unreadCount += 1;
    chat.updatedAt = Date.now();
    await chat.save();

    broadcastMessage(chat.participants, {
      chatId,
      senderId,
      content: message.content,
      media: message.media,
      timestamp: message.timestamp
    });

    res.status(200).json({ message: 'Media message sent successfully', chat });
  } catch (err) {
    console.error('Send media message error:', err);
    res.status(500).json({ message: 'Failed to send media message', error: err.message });
  }
};

// Alias for backward compatibility: routes may call markAsRead
exports.markAsRead = exports.markMessagesAsRead;

// Get or return the conversation between current user and another user
exports.getConversationWithUser = async (req, res) => {
  const currentUserId = req.user.id || req.user._id;
  const otherUserId = req.params.userId;

  if (!otherUserId) return res.status(400).json({ message: 'userId param is required' });

  try {
    const chat = await Chat.findOne({ participants: { $all: [currentUserId, otherUserId] } })
      .populate('participants', 'name profilePicture')
      .lean();

    if (!chat) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    res.status(200).json({ chat });
  } catch (err) {
    console.error('Get conversation with user error:', err);
    res.status(500).json({ message: 'Failed to fetch conversation', error: err.message });
  }
};

// Start a conversation (create if not exists). Accepts either `participants` array or `userId` in body.
exports.startConversation = async (req, res) => {
  const currentUserId = req.user.id || req.user._id;
  const { participants, userId } = req.body;

  try {
    let participantIds = [];

    if (Array.isArray(participants) && participants.length >= 2) {
      participantIds = participants;
    } else if (userId) {
      if (userId === currentUserId) return res.status(400).json({ message: 'Cannot start conversation with self' });
      participantIds = [currentUserId, userId];
    } else {
      return res.status(400).json({ message: 'participants array or userId is required to start a conversation' });
    }

    // Ensure current user is included
    if (!participantIds.includes(currentUserId.toString())) participantIds.push(currentUserId);

    // Check existing conversation with the same participants (order-agnostic)
    const existing = await Chat.findOne({ participants: { $all: participantIds, $size: participantIds.length } });
    if (existing) {
      return res.status(200).json({ message: 'Conversation already exists', chat: existing });
    }

    const chat = new Chat({ participants: participantIds });
    await chat.save();

    res.status(201).json({ message: 'Conversation created', chat });
  } catch (err) {
    console.error('Start conversation error:', err);
    res.status(500).json({ message: 'Failed to start conversation', error: err.message });
  }
};

// Delete a conversation (only participants can delete)
exports.deleteConversation = async (req, res) => {
  const conversationId = req.params.conversationId;
  const currentUserId = req.user.id || req.user._id;

  if (!conversationId) return res.status(400).json({ message: 'conversationId param is required' });

  try {
    const chat = await Chat.findById(conversationId);
    if (!chat) return res.status(404).json({ message: 'Conversation not found' });

    // Ensure current user is a participant
    const isParticipant = (chat.participants || []).some(p => p.toString() === currentUserId.toString());
    if (!isParticipant) return res.status(403).json({ message: 'Not authorized to delete this conversation' });

    await Chat.deleteOne({ _id: conversationId });

    res.status(200).json({ message: 'Conversation deleted' });
  } catch (err) {
    console.error('Delete conversation error:', err);
    res.status(500).json({ message: 'Failed to delete conversation', error: err.message });
  }
};