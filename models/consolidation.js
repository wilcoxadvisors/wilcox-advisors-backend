// models/consolidation.js
const mongoose = require('mongoose');

const ConsolidationSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  period: {
    year: {
      type: Number,
      required: true
    },
    month: {
      type: Number,
      required: true
    },
    quarter: {
      type: Number
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    }
  },
  consolidatedEntityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Entity',
    required: true
  },
  includedEntities: [{
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Entity'
    },
    ownershipPercentage: {
      type: Number,
      default: 100
    },
    consolidationMethod: {
      type: String,
      enum: ['Full', 'Proportional', 'Equity', 'Not Consolidated']
    }
  }],
  status: {
    type: String,
    enum: ['Draft', 'Processing', 'Completed', 'Error'],
    default: 'Draft'
  },
  eliminationEntries: [{
    journalEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JournalEntry'
    },
    description: String,
    amount: Number,
    category: String
  }],
  exchangeRates: [{
    sourceCurrency: String,
    targetCurrency: String,
    rate: Number,
    date: Date
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedAt: Date,
  metadata: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

ConsolidationSchema.index({ clientId: 1, 'period.year': 1, 'period.month': 1 });
ConsolidationSchema.index({ clientId: 1, consolidatedEntityId: 1, 'period.year': 1, 'period.month': 1 });

module.exports = mongoose.model('Consolidation', ConsolidationSchema);
