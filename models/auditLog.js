const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  timestamp: { type: Date, default: Date.now },
  details: { type: Object }
});

module.exports = mongoose.model('AuditLog', AuditLogSchema);
