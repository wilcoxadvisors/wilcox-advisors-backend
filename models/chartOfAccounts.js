// models/chartOfAccounts.js
const mongoose = require('mongoose');

/**
 * Schema for individual account templates in the chart of accounts
 * - Maintains fixed accountType and fslCategory for reporting consistency
 * - Adds customFields for business-specific attributes
 */
const AccountTemplateSchema = new mongoose.Schema({
  // Core identification fields
  accountNumber: { 
    type: String, 
    required: true,
    trim: true
  },
  accountName: { 
    type: String, 
    required: true,
    trim: true 
  },
  
  // Fixed required fields for financial reporting integrity
  accountType: { 
    type: String, 
    required: true,
    enum: ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'],
    index: true
  },
  
  // Financial Statement Line Item category
  fslCategory: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  
  // Default settings that can be overridden
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Optional parent-child relationship
  parentAccount: {
    type: String,
    default: null
  },
  
  // Standard fields that have defaults but can be modified
  description: {
    type: String,
    trim: true
  },
  
  // For sub-categorization (e.g., AP, AR, Inventory)
  subledgerType: { 
    type: String,
    enum: ['GL', 'AP', 'AR', 'Payroll', 'Inventory', 'Assets', null],
    default: 'GL'
  },
  
  // For multi-entity operations
  isIntercompany: {
    type: Boolean,
    default: false
  },
  
  // Default currency
  currency: {
    type: String,
    default: 'USD'
  },
  
  // Flexible fields for customization
  customFields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Metadata and tags for organization
  tags: [String],
  
  // UI display options
  displayOptions: {
    color: String,
    icon: String,
    displayOrder: Number
  }
});

/**
 * Schema for the chart of accounts which contains account templates
 */
const ChartOfAccountsSchema = new mongoose.Schema({
  // Ownership and organization
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
  
  // Identification
  name: { 
    type: String, 
    required: true 
  },
  description: String,
  
  // The actual account templates
  accounts: [AccountTemplateSchema],
  
  // Status and version tracking
  isActive: { 
    type: Boolean, 
    default: true 
  },
  version: {
    type: Number,
    default: 1
  },
  
  // Customization options
  defaultCurrency: {
    type: String,
    default: 'USD'
  },
  
  // Industry-specific templates and configurations
  industry: {
    type: String,
    index: true
  },
  
  // Custom field definitions that apply to all accounts
  customFieldDefinitions: [{
    fieldName: String,
    fieldType: {
      type: String,
      enum: ['text', 'number', 'boolean', 'date', 'select']
    },
    required: Boolean,
    options: [String], // For select type fields
    defaultValue: mongoose.Schema.Types.Mixed
  }],
  
  // Integration with financial reporting
  reportingMappings: {
    type: Map,
    of: String
  }
}, {
  timestamps: true
});

// Add compound index for unique chart of accounts per entity
ChartOfAccountsSchema.index({ clientId: 1, entityId: 1, name: 1 }, { unique: true });

// Add index for querying accounts by number
ChartOfAccountsSchema.index({ 'accounts.accountNumber': 1 });

// Add index for querying accounts by type
ChartOfAccountsSchema.index({ 'accounts.accountType': 1 });

// Add index for querying accounts by FSLI category
ChartOfAccountsSchema.index({ 'accounts.fslCategory': 1 });

/**
 * Method to validate all account numbers are unique within this chart
 */
ChartOfAccountsSchema.methods.validateUniqueAccountNumbers = function() {
  const accountNumbers = this.accounts.map(a => a.accountNumber);
  const uniqueNumbers = new Set(accountNumbers);
  
  return accountNumbers.length === uniqueNumbers.size;
};

/**
 * Static method to create a default chart of accounts for a new entity
 */
ChartOfAccountsSchema.statics.createDefault = async function(clientId, entityId, name = 'Default Chart of Accounts') {
  const defaultAccounts = [
    // Assets
    { accountNumber: '1000', accountName: 'Cash', accountType: 'Asset', fslCategory: 'Cash and Cash Equivalents' },
    { accountNumber: '1100', accountName: 'Accounts Receivable', accountType: 'Asset', fslCategory: 'Accounts Receivable', subledgerType: 'AR' },
    { accountNumber: '1200', accountName: 'Inventory', accountType: 'Asset', fslCategory: 'Inventory', subledgerType: 'Inventory' },
    { accountNumber: '1300', accountName: 'Prepaid Expenses', accountType: 'Asset', fslCategory: 'Prepaid Expenses' },
    { accountNumber: '1500', accountName: 'Fixed Assets', accountType: 'Asset', fslCategory: 'Property, Plant and Equipment', subledgerType: 'Assets' },
    { accountNumber: '1600', accountName: 'Accumulated Depreciation', accountType: 'Asset', fslCategory: 'Property, Plant and Equipment', subledgerType: 'Assets' },
    
    // Liabilities
    { accountNumber: '2000', accountName: 'Accounts Payable', accountType: 'Liability', fslCategory: 'Accounts Payable', subledgerType: 'AP' },
    { accountNumber: '2100', accountName: 'Accrued Liabilities', accountType: 'Liability', fslCategory: 'Accrued Liabilities' },
    { accountNumber: '2200', accountName: 'Payroll Liabilities', accountType: 'Liability', fslCategory: 'Payroll Liabilities', subledgerType: 'Payroll' },
    { accountNumber: '2300', accountName: 'Short-term Loans', accountType: 'Liability', fslCategory: 'Short-term Debt' },
    { accountNumber: '2700', accountName: 'Long-term Debt', accountType: 'Liability', fslCategory: 'Long-term Debt' },
    
    // Equity
    { accountNumber: '3000', accountName: 'Common Stock', accountType: 'Equity', fslCategory: 'Common Stock' },
    { accountNumber: '3100', accountName: 'Retained Earnings', accountType: 'Equity', fslCategory: 'Retained Earnings' },
    
    // Revenue
    { accountNumber: '4000', accountName: 'Sales Revenue', accountType: 'Revenue', fslCategory: 'Revenue' },
    { accountNumber: '4900', accountName: 'Other Income', accountType: 'Revenue', fslCategory: 'Other Income' },
    
    // Expenses
    { accountNumber: '5000', accountName: 'Cost of Goods Sold', accountType: 'Expense', fslCategory: 'Cost of Goods Sold' },
    { accountNumber: '6000', accountName: 'Salaries and Wages', accountType: 'Expense', fslCategory: 'Operating Expenses', subledgerType: 'Payroll' },
    { accountNumber: '6100', accountName: 'Rent Expense', accountType: 'Expense', fslCategory: 'Operating Expenses' },
    { accountNumber: '6200', accountName: 'Utilities Expense', accountType: 'Expense', fslCategory: 'Operating Expenses' },
    { accountNumber: '6300', accountName: 'Office Supplies', accountType: 'Expense', fslCategory: 'Operating Expenses' },
    { accountNumber: '6900', accountName: 'Depreciation Expense', accountType: 'Expense', fslCategory: 'Operating Expenses' },
    { accountNumber: '7000', accountName: 'Interest Expense', accountType: 'Expense', fslCategory: 'Interest Expense' },
    { accountNumber: '9000', accountName: 'Income Tax Expense', accountType: 'Expense', fslCategory: 'Income Tax Expense' }
  ];

  const coa = new this({
    clientId,
    entityId,
    name,
    description: 'Standard chart of accounts',
    accounts: defaultAccounts,
    customFieldDefinitions: [
      {
        fieldName: 'department',
        fieldType: 'text',
        required: false
      },
      {
        fieldName: 'location',
        fieldType: 'text',
        required: false
      }
    ]
  });

  await coa.save();
  return coa;
};

module.exports = mongoose.model('ChartOfAccounts', ChartOfAccountsSchema);
