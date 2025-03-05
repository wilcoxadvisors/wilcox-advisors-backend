const mongoose = require('mongoose');

const AccountSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  accountNumber: { type: String, required: true },
  accountName: { type: String, required: true },
  accountType: { type: String, required: true },
  subledgerType: { type: String }, // e.g., 'AP', 'AR'
  provider: { type: String },
  isManual: { type: Boolean, default: true }
});

module.exports = mongoose.model('Account', AccountSchema);
