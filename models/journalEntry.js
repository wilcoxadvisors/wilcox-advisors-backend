// models/journalEntry.js
const mongoose = require('mongoose');

const JournalEntrySchema = new mongoose.Schema({
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
  entryNumber: {
    type: String,
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
  description: String,
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'posted', 'reversed'],
    default: 'posted',
    index: true
  },
  reversalOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JournalEntry',
    default: null
  },
  reversedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JournalEntry',
    default: null
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvalDate: Date,
  subledgerType: {
    type: String,
    index: true
  },
  journalType: {
    type: String,
    index: true
  },
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
  consolidationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Consolidation'
    // Removed index: true here to avoid duplicate
  },
  recurring: {
    isRecurring: {
      type: Boolean,
      default: false
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'annually', null],
      default: null
    },
    nextDate: Date,
    endDate: Date
  },
  period: {
    year: {
      type: Number,
      index: true
    },
    month: {
      type: Number,
      index: true
    },
    quarter: {
      type: Number,
      index: true
    }
  },
  isManual: { 
    type: Boolean, 
    default: true 
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed, // Changed from Object to Mixed
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
    details: mongoose.Schema.Types.Mixed // Changed from Object to Mixed
  }]
}, {
  timestamps: true
});

// Create compound indexes for performance
JournalEntrySchema.index({ clientId: 1, entityId: 1, date: -1 });
JournalEntrySchema.index({ clientId: 1, entityId: 1, 'period.year': 1, 'period.month': 1 });
JournalEntrySchema.index({ clientId: 1, entityId: 1, subledgerType: 1, date: -1 });
JournalEntrySchema.index({ clientId: 1, isIntercompany: 1, relatedEntityId: 1 });
JournalEntrySchema.index({ consolidationId: 1 });

module.exports = mongoose.model('JournalEntry', JournalEntrySchema);
