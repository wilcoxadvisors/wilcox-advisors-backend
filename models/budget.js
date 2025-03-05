const mongoose = require('mongoose');

const BudgetSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  accountNumber: { type: String, required: true },
  subledgerType: String,
  amount: { type: Number, required: true },
  period: { type: String, enum: ['monthly', 'quarterly'], required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  isManual: { type: Boolean, default: true }
});

module.exports = mongoose.model('Budget', BudgetSchema);
