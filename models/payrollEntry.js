const mongoose = require('mongoose');

const PayrollEntrySchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  employeeId: String,
  date: { type: Date, required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['salary', 'bonus', 'deduction'], required: true },
  status: String,
  subledgerType: String,
  isManual: { type: Boolean, default: true }
});

module.exports = mongoose.model('PayrollEntry', PayrollEntrySchema);
