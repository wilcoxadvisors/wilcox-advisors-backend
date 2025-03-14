// models/vendor.js
const mongoose = require('mongoose');

const VendorSchema = new mongoose.Schema({
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
  vendorId: {
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
  remitToAddress: {
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
  currentBalance: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'USD',
    trim: true
  },
  preferredPaymentMethod: {
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
  taxForm: {
    type: String,
    enum: ['W-9', 'W-8BEN', 'W-8BEN-E', 'other', 'none'],
    default: 'none'
  },
  taxFormReceived: {
    type: Boolean,
    default: false
  },
  category: {
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
  defaultExpenseAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account'
  },
  paymentSchedule: {
    frequency: { 
      type: String, 
      enum: ['weekly', 'biweekly', 'monthly', 'as_needed'], 
      default: 'as_needed' 
    },
    dayOfWeek: { type: Number }, // 0 = Sunday, 6 = Saturday
    dayOfMonth: { type: Number }
  },
  1099Eligible: {
    type: Boolean,
    default: false
  },
  vendorSince: {
    type: Date,
    default: Date.now
  },
  lastBillDate: {
    type: Date
  },
  lastPaymentDate: {
    type: Date
  },
  lastPaymentAmount: {
    type: Number
  },
  earlyPaymentDiscount: {
    available: { type: Boolean, default: false },
    percentage: { type: Number, default: 0 },
    days: { type: Number, default: 10 }
  },
  creditScore: {
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
VendorSchema.index({ clientId: 1, entityId: 1, name: 1 });
VendorSchema.index({ clientId: 1, entityId: 1, status: 1 });
VendorSchema.index({ clientId: 1, entityId: 1, category: 1 });

// Virtual for getting total outstanding bills (to be populated by application logic)
VendorSchema.virtual('outstandingBills').get(function() {
  // This would typically be calculated on demand by querying related bills
  return this.currentBalance;
});

// Check if vendor has early payment discount
VendorSchema.methods.hasEarlyPaymentDiscount = function() {
  return this.earlyPaymentDiscount.available && 
         this.earlyPaymentDiscount.percentage > 0 && 
         this.earlyPaymentDiscount.days > 0;
};

// Calculate discount amount for a specific bill amount
VendorSchema.methods.calculateEarlyPaymentDiscount = function(billAmount) {
  if (!this.hasEarlyPaymentDiscount()) return 0;
  return billAmount * (this.earlyPaymentDiscount.percentage / 100);
};

module.exports = mongoose.model('Vendor', VendorSchema);
