// models/invoice.js
const mongoose = require('mongoose');

/**
 * Invoice Line Item Schema
 * Used for individual items on an invoice
 */
const InvoiceItemSchema = new mongoose.Schema({
  description: { 
    type: String, 
    required: true, 
    trim: true 
  },
  quantity: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  unitPrice: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  amount: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  taxRate: { 
    type: Number, 
    default: 0 
  },
  taxAmount: { 
    type: Number, 
    default: 0 
  },
  accountId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Account' 
  },
  productId: { 
    type: String 
  },
  notes: { 
    type: String, 
    trim: true 
  }
});

/**
 * Payment Schema
 * Tracks payments made against this invoice
 */
const PaymentSchema = new mongoose.Schema({
  date: { 
    type: Date, 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true 
  },
  method: { 
    type: String, 
    enum: ['cash', 'check', 'credit_card', 'bank_transfer', 'other'],
    default: 'bank_transfer' 
  },
  reference: { 
    type: String, 
    trim: true 
  },
  notes: { 
    type: String, 
    trim: true 
  },
  journalEntryId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'JournalEntry' 
  }
}, {
  timestamps: true
});

/**
 * Invoice Schema
 * Comprehensive model for both customer invoices (AR) and vendor bills (AP)
 */
const InvoiceSchema = new mongoose.Schema({
  // Client Reference
  clientId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  
  // Entity Reference
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Entity',
    required: true,
    index: true
  },
  
  // Invoice Type
  type: { 
    type: String, 
    enum: ['invoice', 'bill', 'credit_note', 'debit_note'],
    required: true,
    index: true
  },
  
  // Invoice Number and Identification
  invoiceNumber: { 
    type: String, 
    required: true,
    trim: true,
    index: true
  },
  reference: { 
    type: String, 
    trim: true 
  },
  externalReference: { 
    type: String, 
    trim: true 
  },
  
  // Invoice Dates
  issueDate: { 
    type: Date, 
    required: true,
    index: true
  },
  dueDate: { 
    type: Date, 
    required: true,
    index: true
  },
  
  // Terms
  paymentTerms: { 
    type: String,
    trim: true
  },
  daysPayable: { 
    type: Number, 
    min: 0 
  },
  
  // Customer/Vendor Information
  party: {
    id: { 
      type: mongoose.Schema.Types.ObjectId 
    },
    type: { 
      type: String, 
      enum: ['customer', 'vendor'],
      required: true
    },
    name: { 
      type: String, 
      required: true,
      trim: true
    },
    email: { 
      type: String,
      trim: true,
      lowercase: true
    },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      zip: { type: String, trim: true },
      country: { type: String, trim: true }
    },
    contactPerson: { type: String, trim: true },
    phone: { type: String, trim: true }
  },
  
  // Invoice Items
  items: [InvoiceItemSchema],
  
  // Currency
  currency: { 
    type: String, 
    default: 'USD',
    trim: true,
    uppercase: true
  },
  exchangeRate: { 
    type: Number, 
    default: 1 
  },
  
  // Totals
  subtotal: { 
    type: Number, 
    required: true,
    min: 0
  },
  taxTotal: { 
    type: Number, 
    default: 0,
    min: 0
  },
  discountAmount: { 
    type: Number, 
    default: 0,
    min: 0
  },
  total: { 
    type: Number, 
    required: true,
    min: 0
  },
  amountPaid: { 
    type: Number, 
    default: 0,
    min: 0
  },
  amountDue: { 
    type: Number, 
    required: true,
    min: 0
  },
  
  // Status Tracking
  status: { 
    type: String, 
    enum: ['draft', 'open', 'paid', 'partially_paid', 'overdue', 'void', 'cancelled'],
    default: 'draft',
    index: true
  },
  
  // Payments
  payments: [PaymentSchema],
  
  // Connected Journal Entries
  journalEntryId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'JournalEntry' 
  },
  
  // Accounting Fields
  accountsReceivableId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Account' 
  },
  accountsPayableId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Account' 
  },
  
  // Document Attachments
  attachments: [{
    fileId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'File' 
    },
    fileName: { type: String },
    uploadDate: { type: Date }
  }],
  
  // Notes and Memos
  notes: { 
    type: String, 
    trim: true 
  },
  internalNotes: { 
    type: String, 
    trim: true 
  },
  
  // Recurring Invoice Setting
  isRecurring: { 
    type: Boolean, 
    default: false 
  },
  recurringSchedule: {
    frequency: { 
      type: String, 
      enum: ['weekly', 'monthly', 'quarterly', 'annually'] 
    },
    nextDate: { type: Date },
    endDate: { type: Date }
  },
  
  // Metadata for customization
  metadata: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

// Create compound indexes for better query performance
InvoiceSchema.index({ clientId: 1, entityId: 1, type: 1, issueDate: -1 });
InvoiceSchema.index({ clientId: 1, entityId: 1, status: 1 });
InvoiceSchema.index({ 'party.id': 1, dueDate: 1 });
InvoiceSchema.index({ dueDate: 1, status: 1 });
InvoiceSchema.index({ issueDate: 1, dueDate: 1, type: 1 });

// Virtual field for calculating age of invoice in days
InvoiceSchema.virtual('ageInDays').get(function() {
  const now = new Date();
  const issueDate = new Date(this.issueDate);
  const diffTime = Math.abs(now - issueDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual field for calculating days overdue
InvoiceSchema.virtual('daysOverdue').get(function() {
  const now = new Date();
  const dueDate = new Date(this.dueDate);
  if (now <= dueDate) return 0;
  
  const diffTime = Math.abs(now - dueDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Method to calculate aging bucket (current, 1-30, 31-60, 61-90, 90+ days)
InvoiceSchema.methods.getAgingBucket = function() {
  if (this.status === 'paid' || this.status === 'void' || this.status === 'cancelled') {
    return 'paid';
  }
  
  const daysOverdue = this.daysOverdue;
  
  if (daysOverdue <= 0) return 'current';
  if (daysOverdue <= 30) return '1-30';
  if (daysOverdue <= 60) return '31-60';
  if (daysOverdue <= 90) return '61-90';
  return '90+';
};

// Method to add a payment to the invoice
InvoiceSchema.methods.addPayment = function(paymentData) {
  this.payments.push(paymentData);
  
  // Update amount paid and amount due
  this.amountPaid = this.payments.reduce((sum, payment) => sum + payment.amount, 0);
  this.amountDue = this.total - this.amountPaid;
  
  // Update status based on payment
  if (this.amountDue <= 0) {
    this.status = 'paid';
  } else if (this.amountPaid > 0) {
    this.status = 'partially_paid';
  }
  
  return this;
};

// Pre-save hook to calculate totals and update status
InvoiceSchema.pre('save', function(next) {
  // Calculate subtotal from items
  this.subtotal = this.items.reduce((sum, item) => sum + item.amount, 0);
  
  // Calculate tax total from items
  this.taxTotal = this.items.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
  
  // Calculate total
  this.total = this.subtotal + this.taxTotal - this.discountAmount;
  
  // Set amount due
  this.amountDue = this.total - this.amountPaid;
  
  // Update status if overdue
  if (this.status !== 'paid' && this.status !== 'void' && this.status !== 'cancelled') {
    const now = new Date();
    if (now > this.dueDate && this.amountDue > 0) {
      this.status = 'overdue';
    } else if (this.status === 'draft' && this.issueDate <= now) {
      this.status = 'open';
    }
  }
  
  next();
});

module.exports = mongoose.model('Invoice', InvoiceSchema);
