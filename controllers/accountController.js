// controllers/accountController.js
const Account = require('../models/account');
const Transaction = require('../models/transaction');
const Entity = require('../models/entity');
const AuditLog = require('../models/auditLog');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Get all accounts for an entity
exports.getAccounts = async (req, res, next) => {
  try {
    const { entityId, type, subledger, active } = req.query;
    const query = { 
      clientId: req.user.id
    };
    
    if (entityId) query.entityId = entityId;
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

// Get account by ID
exports.getAccountById = async (req, res, next) => {
  try {
    const account = await Account.findOne({
      _id: req.params.id,
      clientId: req.user.id
    });
    
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }
    
    res.json({
      success: true,
      account: {
        id: account._id,
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        accountType: account.accountType,
        subledgerType: account.subledgerType,
        description: account.description,
        isIntercompany: account.isIntercompany,
        currency: account.currency,
        balance: account.balance,
        isActive: account.isActive,
        parentAccount: account.parentAccount,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt
      }
    });
  } catch (error) {
    logger.error('Error fetching account:', error);
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
      currency,
      parentAccount
    } = req.body;
    
    // Verify entity exists and belongs to client
    const entity = await Entity.findOne({
      _id: entityId,
      clientId: req.user.id
    });
    
    if (!entity) {
      return res.status(404).json({
        success: false,
        message: 'Entity not found or you do not have permission'
      });
    }
    
    // Check if account number already exists for this entity
    const existingAccount = await Account.findOne({
      clientId: req.user.id,
      entityId,
      accountNumber
    });
    
    if (existingAccount) {
      return res.status(400).json({
        success: false,
        message: `Account with number ${accountNumber} already exists for this entity`
      });
    }
    
    // Check if parent account exists
    if (parentAccount) {
      const parent = await Account.findOne({
        _id: parentAccount,
        clientId: req.user.id,
        entityId
      });
      
      if (!parent) {
        return res.status(404).json({
          success: false,
          message: 'Parent account not found or does not belong to this entity'
        });
      }
    }
    
    const account = new Account({
      clientId: req.user.id,
      entityId,
      accountNumber,
      accountName,
      accountType,
      subledgerType: subledgerType || 'GL',
      description,
      isIntercompany: isIntercompany || false,
      currency: currency || entity.currency,
      parentAccount: parentAccount || null
    });
    
    await account.save();
    
    // Create audit log
    const auditLog = new AuditLog({
      clientId: req.user.id,
      action: 'CREATE_ACCOUNT',
      entityType: 'Account',
      entityId: account._id,
      userId: req.user.id,
      details: { 
        accountNumber, 
        accountName, 
        accountType,
        entityId 
      }
    });
    await auditLog.save();
    
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

// Update account
exports.updateAccount = async (req, res, next) => {
  try {
    const { 
      accountName, 
      description, 
      isActive,
      isIntercompany,
      parentAccount
    } = req.body;
    
    // Find account and make sure it belongs to this client
    const account = await Account.findOne({
      _id: req.params.id,
      clientId: req.user.id
    });
    
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }
    
    // Check if parent account exists
    if (parentAccount && parentAccount !== account.parentAccount?.toString()) {
      const parent = await Account.findOne({
        _id: parentAccount,
        clientId: req.user.id,
        entityId: account.entityId
      });
      
      if (!parent) {
        return res.status(404).json({
          success: false,
          message: 'Parent account not found or does not belong to this entity'
        });
      }
      
      // Prevent circular references
      if (parentAccount === account._id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'An account cannot be its own parent'
        });
      }
    }
    
    // Update fields
    if (accountName) account.accountName = accountName;
    if (description !== undefined) account.description = description;
    if (isActive !== undefined) account.isActive = isActive;
    if (isIntercompany !== undefined) account.isIntercompany = isIntercompany;
    if (parentAccount !== undefined) account.parentAccount = parentAccount || null;
    
    await account.save();
    
    // Create audit log
    const auditLog = new AuditLog({
      clientId: req.user.id,
      action: 'UPDATE_ACCOUNT',
      entityType: 'Account',
      entityId: account._id,
      userId: req.user.id,
      details: { 
        accountName, 
        isActive
      }
    });
    await auditLog.save();
    
    res.json({
      success: true,
      message: 'Account updated successfully',
      account: {
        id: account._id,
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        accountType: account.accountType,
        subledgerType: account.subledgerType,
        isActive: account.isActive
      }
    });
  } catch (error) {
    logger.error('Error updating account:', error);
    next(error);
  }
};

// Delete account
exports.deleteAccount = async (req, res, next) => {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();
    
    // Find account and make sure it belongs to this client
    const account = await Account.findOne({
      _id: req.params.id,
      clientId: req.user.id
    }).session(session);
    
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }
    
    // Check if account has transactions
    const transactionCount = await Transaction.countDocuments({
      accountId: account._id
    }).session(session);
    
    if (transactionCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete account with associated transactions. Deactivate it instead.'
      });
    }
    
    // Check if account has child accounts
    const childAccountCount = await Account.countDocuments({
      parentAccount: account._id
    }).session(session);
    
    if (childAccountCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete account with child accounts. Remove parent reference from child accounts first.'
      });
    }
    
    // Delete the account
    await Account.deleteOne({ _id: account._id }).session(session);
    
    // Create audit log
    const auditLog = new AuditLog({
      clientId: req.user.id,
      action: 'DELETE_ACCOUNT',
      entityType: 'Account',
      entityId: account._id,
      userId: req.user.id,
      details: { 
        accountNumber: account.accountNumber, 
        accountName: account.accountName 
      }
    });
    await auditLog.save({ session });
    
    await session.commitTransaction();
    
    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Error deleting account:', error);
    next(error);
  } finally {
    session.endSession();
  }
};
