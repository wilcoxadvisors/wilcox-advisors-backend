const mongoose = require('mongoose');

const ContactSchema = new mongoose.Schema({
  userId: String, // Optional for guests
  name: String,
  email: String,
  company: String,
  message: String,
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Contact', ContactSchema);
