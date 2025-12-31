const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference to users involved in the chat
    required: true
  }],
  messages: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Reference to the sender
      required: true
    },
    content: {
      type: String,
      required: true
    },
    media: [{
      type: String, // URL of media attachments (images, videos, etc.)
      default: null
    }],
    timestamp: {
      type: Date,
      default: Date.now
    },
    isRead: {
      type: Boolean,
      default: false
    }
  }],
  unreadCount: {
    type: Number, // Count of unread messages for each participant
    default: 0
  },
  lastMessage: {
    type: String, // Content of the last message
    default: ""
  },
  lastMessageTimestamp: {
    type: Date, // Timestamp of the last message
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Index participants for faster queries
chatSchema.index({ participants: 1 });

// Index messages.sender for faster queries
chatSchema.index({ 'messages.sender': 1 });

// Middleware to update lastMessage and lastMessageTimestamp
chatSchema.pre('save', function (next) {
  if (this.messages.length > 0) {
    const lastMessage = this.messages[this.messages.length - 1];
    this.lastMessage = lastMessage.content || "";
    this.lastMessageTimestamp = lastMessage.timestamp || Date.now();
  }
  next();
});

module.exports = mongoose.model('Chat', chatSchema);