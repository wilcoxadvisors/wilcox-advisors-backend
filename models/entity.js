// models/entity.js
const mongoose = require('mongoose');

const EntitySchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  code: { 
    type: String, 
    required: true,
    index: true
  },
  clientId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    index: true
  },
  parentEntityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Entity',
    default: null
  },
  type: {
    type: String,
    enum: ['Operating', 'Holding', 'Special Purpose', 'Elimination', 'Consolidated'],
    default: 'Operating',
    index: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  consolidationSettings: {
    isIncludedInConsolidation: {
      type: Boolean,
      default: true
    },
    ownershipPercentage: {
      type: Number,
      default: 100
    },
    consolidationMethod: {
      type: String,
      enum: ['Full', 'Proportional', 'Equity', 'Not Consolidated'],
      default: 'Full'
    },
    eliminationRules: [{
      sourceAccount: String,
      targetAccount: String,
      eliminationEntity: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Entity'
      },
      description: String,
      isAutomatic: Boolean
    }]
  },
  metadata: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

// Add unique compound index for clientId + code
EntitySchema.index({ clientId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Entity', EntitySchema);
