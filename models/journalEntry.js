const mongoose = require('mongoose');

const JournalEntrySchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  transactionNo: String,
  description: String,
  debitAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  creditAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  amount: { type: Number, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  subledgerType: String,
  journalType: String,
  isManual: { type: Boolean, default: true }
});

module.exports = mongoose.model('JournalEntry', JournalEntrySchema);
