// models/account.js
const mongoose = require('mongoose');

const AccountSchema = new mongoose.Schema({
  clientId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Entity',
    required: true,
    index: true
  },
  accountNumber: { 
    type: String, 
    required: true,
    index: true
  },
  accountName: { 
    type: String, 
    required: true 
  },
  accountType: { 
    type: String, 
    required: true,
    enum: ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'],
    index: true
  },
  subledgerType: { 
    type: String,
    enum: ['GL', 'AP', 'AR', 'Payroll', 'Inventory', 'Assets', null],
    default: 'GL',
    index: true
  },
  description: { 
    type: String 
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  parentAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    default: null
  },
  balance: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  isManual: { 
    type: Boolean, 
    default: true 
  },
  // Multi-entity and consolidation fields
  isIntercompany: {
    type: Boolean,
    default: false,
    index: true
  },
  intercompanyPairAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account'
  },
  eliminationCategory: {
    type: String,
    enum: ['Investment', 'Receivable-Payable', 'Revenue-Expense', 'Other', null],
    default: null,
    index: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  metadata: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

// Create unique compound index for clientId + entityId + accountNumber
AccountSchema.index({ clientId: 1, entityId: 1, accountNumber: 1 }, { unique: true });

module.exports = mongoose.model('Account', AccountSchema);
