// models/customer.js
const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
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
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  customerId: {
    type: String,
    trim: true,
    index: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  taxId: {
    type: String,
    trim: true
  },
  address: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zip: { type: String, trim: true },
    country: { type: String, trim: true, default: 'USA' }
  },
  billingAddress: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zip: { type: String, trim: true },
    country: { type: String, trim: true, default: 'USA' }
  },
  contactPerson: {
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    position: { type: String, trim: true }
  },
  paymentTerms: {
    type: String,
    default: 'Net 30',
    trim: true
  },
  creditLimit: {
    type: Number,
    default: 0
  },
  currentBalance: {
    type: Number,
    default: 0
  },
  availableCredit: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'USD',
    trim: true
  },
  category: {
    type: String,
    trim: true
  },
  industryType: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'on_hold'],
    default: 'active'
  },
  defaultGLAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account'
  },
  paymentMethod: {
    type: String,
    enum: ['check', 'ach', 'wire', 'credit_card', 'other'],
    default: 'check'
  },
  bankInfo: {
    bankName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    routingNumber: { type: String, trim: true },
    accountType: { type: String, enum: ['checking', 'savings'], default: 'checking' }
  },
  taxExempt: {
    isExempt: { type: Boolean, default: false },
    exemptionNumber: { type: String, trim: true },
    expirationDate: { type: Date }
  },
  invoicingPreferences: {
    method: { type: String, enum: ['email', 'mail', 'both'], default: 'email' },
    emailAddresses: [{ type: String, trim: true, lowercase: true }],
    attachPdf: { type: Boolean, default: true },
    separateInvoices: { type: Boolean, default: false }
  },
  customerSince: {
    type: Date,
    default: Date.now
  },
  lastInvoiceDate: {
    type: Date
  },
  lastPaymentDate: {
    type: Date
  },
  lastPaymentAmount: {
    type: Number
  },
  tags: [String],
  metadata: {
    type: Object,
    default: {}
  },
  documents: [{
    fileId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'File' 
    },
    fileName: { type: String },
    documentType: { type: String },
    uploadDate: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// Create compound indexes for better query performance
CustomerSchema.index({ clientId: 1, entityId: 1, name: 1 });
CustomerSchema.index({ clientId: 1, entityId: 1, status: 1 });
CustomerSchema.index({ clientId: 1, entityId: 1, category: 1 });

// Virtual for getting total outstanding invoices (to be populated by application logic)
CustomerSchema.virtual('outstandingInvoices').get(function() {
  // This would typically be calculated on demand by querying related invoices
  return this.currentBalance;
});

// Method to check if customer is over credit limit
CustomerSchema.methods.isOverCreditLimit = function(additionalAmount = 0) {
  // If credit limit is 0, assume no limit
  if (this.creditLimit === 0) return false;
  
  return (this.currentBalance + additionalAmount) > this.creditLimit;
};

// Method to update available credit
CustomerSchema.methods.updateAvailableCredit = function() {
  // If credit limit is 0, assume unlimited credit
  if (this.creditLimit === 0) {
    this.availableCredit = 0; // Indicates unlimited
    return;
  }
  
  this.availableCredit = Math.max(0, this.creditLimit - this.currentBalance);
};

// Pre-save hook to calculate available credit
CustomerSchema.pre('save', function(next) {
  this.updateAvailableCredit();
  next();
});

module.exports = mongoose.model('Customer', CustomerSchema);
