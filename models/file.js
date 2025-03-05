const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
  userId: String, // Required for authenticated users only
  fileName: String,
  s3Key: String,
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('File', FileSchema);
