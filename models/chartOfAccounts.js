// models/chartOfAccounts.js
const AccountTemplate = new mongoose.Schema({
  accountNumber: { type: String, required: true },
  accountName: { type: String, required: true },
  accountType: { type: String, required: true },
  subAccountOf: { type: String, default: null }
});

const ChartOfAccountsSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
  name: { type: String, required: true },
  description: String,
  accounts: [AccountTemplate],
  isActive: { type: Boolean, default: true }
});
