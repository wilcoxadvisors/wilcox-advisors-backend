const mongoose = require('mongoose');

const AccountTemplateSchema = new mongoose.Schema({
  accountNumber: { type: String, required: true, trim: true },
  accountName: { type: String, required: true, trim: true },
  accountType: {
    type: String,
    required: true,
    enum: ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']
  },
  fslCategory: { type: String, required: true, trim: true },
  isActive: { type: Boolean, default: true },
  parentAccount: { type: String, default: null },
  description: { type: String, trim: true },
  subledgerType: {
    type: String,
    enum: ['GL', 'AP', 'AR', 'Payroll', 'Inventory', 'Assets', null],
    default: 'GL'
  },
  isIntercompany: { type: Boolean, default: false },
  currency: { type: String, default: 'USD' },
  customFields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  tags: [String],
  displayOptions: {
    color: String,
    icon: String,
    displayOrder: Number
  }
});

const ChartOfAccountsSchema = new mongoose.Schema({
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
  name: { type: String, required: true },
  description: String,
  accounts: [AccountTemplateSchema],
  isActive: { type: Boolean, default: true },
  version: { type: Number, default: 1 },
  defaultCurrency: { type: String, default: 'USD' },
  industry: { type: String, index: true },
  customFieldDefinitions: [{
    fieldName: String,
    fieldType: {
      type: String,
      enum: ['text', 'number', 'boolean', 'date', 'select']
    },
    required: Boolean,
    options: [String],
    defaultValue: mongoose.Schema.Types.Mixed
  }],
  reportingMappings: {
    type: Map,
    of: String
  }
}, {
  timestamps: true
});

// Removed duplicate index definitions (kept schema-level only)
ChartOfAccountsSchema.index({ clientId: 1, entityId: 1, name: 1 }, { unique: true });
ChartOfAccountsSchema.index({ 'accounts.accountNumber': 1 });
ChartOfAccountsSchema.index({ 'accounts.accountType': 1 });
ChartOfAccountsSchema.index({ 'accounts.fslCategory': 1 });

ChartOfAccountsSchema.methods.validateUniqueAccountNumbers = function() {
  const accountNumbers = this.accounts.map(a => a.accountNumber);
  const uniqueNumbers = new Set(accountNumbers);
  return accountNumbers.length === uniqueNumbers.size;
};

ChartOfAccountsSchema.statics.createDefault = async function(clientId, entityId, name = 'Default Chart of Accounts') {
  const defaultAccounts = [
    { accountNumber: '1000', accountName: 'Cash', accountType: 'Asset', fslCategory: 'Cash and Cash Equivalents' },
    { accountNumber: '1100', accountName: 'Accounts Receivable', accountType: 'Asset', fslCategory: 'Accounts Receivable', subledgerType: 'AR' },
    { accountNumber: '1200', accountName: 'Inventory', accountType: 'Asset', fslCategory: 'Inventory', subledgerType: 'Inventory' },
    { accountNumber: '1300', accountName: 'Prepaid Expenses', accountType: 'Asset', fslCategory: 'Prepaid Expenses' },
    { accountNumber: '1500', accountName: 'Fixed Assets', accountType: 'Asset', fslCategory: 'Property, Plant and Equipment', subledgerType: 'Assets' },
    { accountNumber: '1600', accountName: 'Accumulated Depreciation', accountType: 'Asset', fslCategory: 'Property, Plant and Equipment', subledgerType: 'Assets' },
    { accountNumber: '2000', accountName: 'Accounts Payable', accountType: 'Liability', fslCategory: 'Accounts Payable', subledgerType: 'AP' },
    { accountNumber: '2100', accountName: 'Accrued Liabilities', accountType: 'Liability', fslCategory: 'Accrued Liabilities' },
    { accountNumber: '2200', accountName: 'Payroll Liabilities', accountType: 'Liability', fslCategory: 'Payroll Liabilities', subledgerType: 'Payroll' },
    { accountNumber: '2300', accountName: 'Short-term Loans', accountType: 'Liability', fslCategory: 'Short-term Debt' },
    { accountNumber: '2700', accountName: 'Long-term Debt', accountType: 'Liability', fslCategory: 'Long-term Debt' },
    { accountNumber: '3000', accountName: 'Common Stock', accountType: 'Equity', fslCategory: 'Common Stock' },
    { accountNumber: '3100', accountName: 'Retained Earnings', accountType: 'Equity', fslCategory: 'Retained Earnings' },
    { accountNumber: '4000', accountName: 'Sales Revenue', accountType: 'Revenue', fslCategory: 'Revenue' },
    { accountNumber: '4900', accountName: 'Other Income', accountType: 'Revenue', fslCategory: 'Other Income' },
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
      { fieldName: 'department', fieldType: 'text', required: false },
      { fieldName: 'location', fieldType: 'text', required: false }
    ]
  });

  await coa.save();
  return coa;
};

module.exports = mongoose.model('ChartOfAccounts', ChartOfAccountsSchema);
