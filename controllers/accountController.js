// controllers/accountController.js
const Account = require('../models/account');
const logger = require('../utils/logger');

// Get all accounts for an entity
exports.getAccounts = async (req, res, next) => {
  try {
    const { entityId, type, subledger, active } = req.query;
    const query = { 
      clientId: req.user.id,
      entityId
    };
    
    if (type) query.accountType = type;
    if (subledger) query.subledgerType = subledger;
    if (active !== undefined) query.isActive = active === 'true';
    
    const accounts = await Account.find(query).sort({ accountNumber: 1 });
    
    res.json({
      success: true,
      accounts: accounts.map(account => ({
        id: account._id,
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        accountType: account.accountType,
        subledgerType: account.subledgerType,
        isIntercompany: account.isIntercompany,
        currency: account.currency,
        balance: account.balance,
        isActive: account.isActive
      }))
    });
  } catch (error) {
    logger.error('Error fetching accounts:', error);
    next(error);
  }
};

// Create new account
exports.createAccount = async (req, res, next) => {
  try {
    const { 
      entityId, 
      accountNumber, 
      accountName, 
      accountType, 
      subledgerType, 
      description,
      isIntercompany,
      currency
    } = req.body;
    
    const account = new Account({
      clientId: req.user.id,
      entityId,
      accountNumber,
      accountName,
      accountType,
      subledgerType: subledgerType || 'GL',
      description,
      isIntercompany: isIntercompany || false,
      currency: currency || 'USD'
    });
    
    await account.save();
    
    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      account: {
        id: account._id,
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        accountType: account.accountType,
        subledgerType: account.subledgerType
      }
    });
  } catch (error) {
    logger.error('Error creating account:', error);
    next(error);
  }
};
