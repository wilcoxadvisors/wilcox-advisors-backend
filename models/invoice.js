// models/invoice.js
const mongoose = require('mongoose');

const InvoiceLineItemSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    default: 1
  },
  unitPrice: {
    type: Number,
    required: true
  },
  amount: {
    type: Number,
    required: true
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
  }
});

const InvoiceSchema = new mongoose.Schema({
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
  invoiceType: {
    type: String,
    enum: ['ar', 'ap'], // AR = Customer Invoice, AP = Vendor Bill
    required: true,
    index: true
  },
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
  // For AR invoices (customer)
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    index: true
  },
  // For AP invoices (vendor bills)
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    index: true
  },
  items: [InvoiceLineItemSchema],
  subtotal: {
    type: Number,
    required: true
  },
  taxTotal: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    required: true
  },
  amountPaid: {
    type: Number,
    default: 0
  },
  balanceDue: {
    type: Number,
    default: function() {
      return this.total;
    }
  },
  currency: {
    type: String,
    default: 'USD',
    trim: true
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'sent', 'partially_paid', 'paid', 'overdue', 'void', 'cancelled'],
    default: 'draft',
    index: true
  },
  paymentTerms: {
    type: String,
    default: 'Net 30',
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  memo: {
    type: String,
    trim: true
  },
  // Associated journal entry
  journalEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JournalEntry'
  },
  payments: [{
    date: { type: Date },
    amount: { type: Number },
    paymentMethod: { type: String },
    reference: { type: String },
    notes: { type: String }
  }],
  tags: [String],
  documents: [{
    fileId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'File' 
    },
    fileName: { type: String },
    uploadDate: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// Compound indexes
InvoiceSchema.index({ clientId: 1, entityId: 1, invoiceType: 1, status: 1 });
InvoiceSchema.index({ clientId: 1, customerId: 1, status: 1 });
InvoiceSchema.index({ clientId: 1, vendorId: 1, status: 1 });
InvoiceSchema.index({ dueDate: 1, status: 1 });

// Methods
InvoiceSchema.methods.addPayment = function(paymentData) {
  this.payments.push(paymentData);
  this.amountPaid += paymentData.amount;
  this.balanceDue = Math.max(0, this.total - this.amountPaid);
  
  // Update status based on payment
  if (this.balanceDue === 0) {
    this.status = 'paid';
  } else if (this.amountPaid > 0) {
    this.status = 'partially_paid';
  }
  
  return this;
};

// Update status based on due date
InvoiceSchema.methods.updateStatus = function() {
  if (this.status === 'paid' || this.status === 'void' || this.status === 'cancelled') {
    return this;
  }
  
  const today = new Date();
  if (this.dueDate < today && this.balanceDue > 0) {
    this.status = 'overdue';
  }
  
  return this;
};

module.exports = mongoose.model('Invoice', InvoiceSchema);
