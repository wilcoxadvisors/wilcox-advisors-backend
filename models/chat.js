const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
  userId: String, // Can be null for guest chats
  message: String,
  reply: String,
  isClientChat: Boolean,
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Chat', ChatSchema);
