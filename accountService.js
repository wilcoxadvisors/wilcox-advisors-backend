// services/accountService.js
const Account = require('../models/account');
const AuditLog = require('../models/auditLog');
const logger = require('../utils/logger');

/**
 * Business logic for account operations
 */
exports.findAccountsByEntity = async (clientId, entityId, filters = {}) => {
  try {
    const query = { clientId, entityId };
    
    if (filters.type) query.accountType = filters.type;
    if (filters.subledger) query.subledgerType = filters.subledger;
    if (filters.active !== undefined) query.isActive = filters.active;
    
    return await Account.find(query).sort({ accountNumber: 1 });
  } catch (error) {
    logger.error('Account service error (findAccountsByEntity):', error);
    throw error;
  }
};

exports.createAccount = async (accountData, userId) => {
  try {
    const account = new Account(accountData);
    await account.save();
    
    // Log the account creation
    const auditLog = new AuditLog({
      clientId: accountData.clientId,
      action: 'CREATE_ACCOUNT',
      entityType: 'Account',
      entityId: account._id,
      userId,
      details: {
        accountNumber: accountData.accountNumber,
        accountName: accountData.accountName,
        accountType: accountData.accountType
      }
    });
    await auditLog.save();
    
    return account;
  } catch (error) {
    logger.error('Account service error (createAccount):', error);
    throw error;
  }
};
