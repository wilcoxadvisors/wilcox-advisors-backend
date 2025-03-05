const mongoose = require('mongoose');

const ChecklistSchema = new mongoose.Schema({
  userId: String, // Optional for guests
  name: String,
  email: String,
  companyName: String,
  revenueRange: String,
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Checklist', ChecklistSchema);
