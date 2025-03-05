const mongoose = require('mongoose');

const ContentSchema = new mongoose.Schema({
  section: String,
  value: mongoose.Mixed,
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Content', ContentSchema);
