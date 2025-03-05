const mongoose = require('mongoose');

const BlogSchema = new mongoose.Schema({
  title: String,
  content: String,
  isDraft: { type: Boolean, default: true },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Blog', BlogSchema);
