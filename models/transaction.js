const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  date: { type: Date, required: true },
  transactionNo: String,
  lineNo: Number,
  documentNumber: String,
  description: String,
  amount: { type: Number, required: true },
  type: { type: String, enum: ['debit', 'credit'], required: true },
  category: String,
  subledgerType: String,
  journalType: String,
  vendorName: String,
  employeeId: String,
  projectId: String,
  isManual: { type: Boolean, default: true }
});

module.exports = mongoose.model('Transaction', TransactionSchema);
