// models/transaction.js
const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
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
  accountId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Account', 
    required: true,
    index: true
  },
  journalEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JournalEntry',
    required: true,
    index: true
  },
  date: { 
    type: Date, 
    required: true,
    index: true
  },
  postingDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  transactionNo: {
    type: String,
    index: true
  },
  lineNo: Number,
  documentNumber: {
    type: String,
    index: true
  },
  description: String,
  amount: { 
    type: Number, 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['debit', 'credit'], 
    required: true 
  },
  category: String,
  subledgerType: {
    type: String,
    index: true
  },
  journalType: String,
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    index: true
  },
  vendorName: String,
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    index: true
  },
  employeeId: {
    type: String,
    index: true
  },
  projectId: {
    type: String,
    index: true
  },
  departmentId: {
    type: String,
    index: true
  },
  // Multi-entity and consolidation fields
  isIntercompany: {
    type: Boolean,
    default: false,
    index: true
  },
  relatedEntityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Entity',
    index: true
  },
  eliminationReference: {
    type: String,
    index: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  exchangeRate: {
    type: Number,
    default: 1
  },
  originalAmount: {
    type: Number
  },
  originalCurrency: {
    type: String
  },
  isReconciled: {
    type: Boolean,
    default: false,
    index: true
  },
  reconciledDate: Date,
  reconciledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isManual: { 
    type: Boolean, 
    default: true 
  },
  consolidationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Consolidation',
    index: true
  },
  metadata: {
    type: Object,
    default: {}
  },
  attachments: [{
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File'
    },
    fileName: String,
    uploadDate: Date
  }],
  auditTrail: [{
    action: String,
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    details: Object
  }]
}, {
  timestamps: true
});

// Create compound indexes for performance
TransactionSchema.index({ clientId: 1, entityId: 1, date: -1 });
TransactionSchema.index({ clientId: 1, entityId: 1, accountId: 1, date: -1 });
TransactionSchema.index({ clientId: 1, entityId: 1, subledgerType: 1, date: -1 });
TransactionSchema.index({ clientId: 1, isIntercompany: 1, relatedEntityId: 1 });

module.exports = mongoose.model('Transaction', TransactionSchema);
