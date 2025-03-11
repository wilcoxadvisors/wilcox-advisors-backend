// controllers/chartOfAccountsController.js
const ChartOfAccounts = require('../models/chartOfAccounts');
const Entity = require('../models/entity');
const Account = require('../models/account');
const AuditLog = require('../models/auditLog');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Get all charts of accounts for a client
 */
exports.getAllChartOfAccounts = async (req, res, next) => {
  try {
    const { entityId, active } = req.query;
    const query = { clientId: req.user.id };
    
    if (entityId) {
      query.entityId = entityId;
    }
    
    if (active !== undefined) {
      query.isActive = active === 'true';
    }
    
    const chartOfAccounts = await ChartOfAccounts.find(query)
      .select('name description entityId isActive version updatedAt')
      .populate('entityId', 'name code')
      .sort({ name: 1 });
    
    res.json({
      success: true,
      chartOfAccounts
    });
  } catch (error) {
    logger.error('Error fetching charts of accounts:', error);
    next(error);
  }
};

/**
 * Get a single chart of accounts by ID
 */
exports.getChartOfAccountsById = async (req, res, next) => {
  try {
    const chartOfAccounts = await ChartOfAccounts.findOne({
      _id: req.params.id,
      clientId: req.user.id
    }).populate('entityId', 'name code');
    
    if (!chartOfAccounts) {
      return res.status(404).json({
        success: false,
        message: 'Chart of accounts not found'
      });
    }
    
    res.json({
      success: true,
      chartOfAccounts
    });
  } catch (error) {
    logger.error('Error fetching chart of accounts:', error);
    next(error);
  }
};

/**
 * Create a new chart of accounts
 */
exports.createChartOfAccounts = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { 
      entityId, 
      name, 
      description, 
      accounts, 
      customFieldDefinitions,
      industry,
      defaultCurrency 
    } = req.body;
    
    // Verify entity exists and belongs to client
    const entity = await Entity.findOne({
      _id: entityId,
      clientId: req.user.id
    }).session(session);
    
    if (!entity) {
      return res.status(404).json({
        success: false,
        message: 'Entity not found or you do not have permission'
      });
    }
    
    // Check if a chart of accounts with the same name already exists for this entity
    const existingCOA = await ChartOfAccounts.findOne({
      clientId: req.user.id,
      entityId,
      name
    }).session(session);
    
    if (existingCOA) {
      return res.status(400).json({
        success: false,
        message: `Chart of accounts with name "${name}" already exists for this entity`
      });
    }
    
    // Create new chart of accounts
    const chartOfAccounts = new ChartOfAccounts({
      clientId: req.user.id,
      entityId,
      name,
      description,
      accounts: accounts || [],
      customFieldDefinitions: customFieldDefinitions || [],
      industry,
      defaultCurrency: defaultCurrency || entity.currency || 'USD'
    });
    
    // Validate account numbers are unique
    if (accounts && accounts.length > 0) {
      if (!chartOfAccounts.validateUniqueAccountNumbers()) {
        return res.status(400).json({
          success: false,
          message: 'Account numbers must be unique within the chart of accounts'
        });
      }
    }
    
    await chartOfAccounts.save({ session });
    
    // Create audit log
    const auditLog = new AuditLog({
      clientId: req.user.id,
      action: 'CREATE_CHART_OF_ACCOUNTS',
      entityType: 'ChartOfAccounts',
      entityId: chartOfAccounts._id,
      userId: req.user.id,
      details: { name, entityId }
    });
    
    await auditLog.save({ session });
    await session.commitTransaction();
    
    res.status(201).json({
      success: true,
      message: 'Chart of accounts created successfully',
      chartOfAccounts: {
        id: chartOfAccounts._id,
        name: chartOfAccounts.name,
        entityId: chartOfAccounts.entityId
      }
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Error creating chart of accounts:', error);
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * Create a default chart of accounts for an entity
 */
exports.createDefaultChartOfAccounts = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { entityId, name } = req.body;
    
    // Verify entity exists and belongs to client
    const entity = await Entity.findOne({
      _id: entityId,
      clientId: req.user.id
    }).session(session);
    
    if (!entity) {
      return res.status(404).json({
        success: false,
        message: 'Entity not found or you do not have permission'
      });
    }
    
    // Check if a default chart of accounts already exists for this entity
    const existingCOA = await ChartOfAccounts.findOne({
      clientId: req.user.id,
      entityId,
      name: name || 'Default Chart of Accounts'
    }).session(session);
    
    if (existingCOA) {
      return res.status(400).json({
        success: false,
        message: `A chart of accounts named "${name || 'Default Chart of Accounts'}" already exists for this entity`
      });
    }
    
    // Create default chart of accounts
    const chartOfAccounts = await ChartOfAccounts.createDefault(
      req.user.id, 
      entityId,
      name || 'Default Chart of Accounts'
    );
    
    // Create audit log
    const auditLog = new AuditLog({
      clientId: req.user.id,
      action: 'CREATE_DEFAULT_CHART_OF_ACCOUNTS',
      entityType: 'ChartOfAccounts',
      entityId: chartOfAccounts._id,
      userId: req.user.id,
      details: { entityId }
    });
    
    await auditLog.save({ session });
    await session.commitTransaction();
    
    res.status(201).json({
      success: true,
      message: 'Default chart of accounts created successfully',
      chartOfAccounts: {
        id: chartOfAccounts._id,
        name: chartOfAccounts.name,
        entityId: chartOfAccounts.entityId,
        accountCount: chartOfAccounts.accounts.length
      }
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Error creating default chart of accounts:', error);
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * Update a chart of accounts
 */
exports.updateChartOfAccounts = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { 
      name, 
      description, 
      isActive,
      customFieldDefinitions,
      defaultCurrency
    } = req.body;
    
    // Find chart of accounts and make sure it belongs to this client
    const chartOfAccounts = await ChartOfAccounts.findOne({
      _id: req.params.id,
      clientId: req.user.id
    }).session(session);
    
    if (!chartOfAccounts) {
      return res.status(404).json({
        success: false,
        message: 'Chart of accounts not found'
      });
    }
    
    // Update fields
    if (name !== undefined) chartOfAccounts.name = name;
    if (description !== undefined) chartOfAccounts.description = description;
    if (isActive !== undefined) chartOfAccounts.isActive = isActive;
    if (customFieldDefinitions !== undefined) chartOfAccounts.customFieldDefinitions = customFieldDefinitions;
    if (defaultCurrency !== undefined) chartOfAccounts.defaultCurrency = defaultCurrency;
    
    // Increment version
    chartOfAccounts.version += 1;
    
    await chartOfAccounts.save({ session });
    
    // Create audit log
    const auditLog = new AuditLog({
      clientId: req.user.id,
      action: 'UPDATE_CHART_OF_ACCOUNTS',
      entityType: 'ChartOfAccounts',
      entityId: chartOfAccounts._id,
      userId: req.user.id,
      details: { 
        name, 
        isActive,
        version: chartOfAccounts.version
      }
    });
    
    await auditLog.save({ session });
    await session.commitTransaction();
    
    res.json({
      success: true,
      message: 'Chart of accounts updated successfully',
      chartOfAccounts: {
        id: chartOfAccounts._id,
        name: chartOfAccounts.name,
        isActive: chartOfAccounts.isActive,
        version: chartOfAccounts.version
      }
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Error updating chart of accounts:', error);
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * Delete a chart of accounts
 */
exports.deleteChartOfAccounts = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Find chart of accounts and make sure it belongs to this client
    const chartOfAccounts = await ChartOfAccounts.findOne({
      _id: req.params.id,
      clientId: req.user.id
    }).session(session);
    
    if (!chartOfAccounts) {
      return res.status(404).json({
        success: false,
        message: 'Chart of accounts not found'
      });
    }
    
    // Check if the chart of accounts is in use in real accounts
    const accountsUsingCOA = await Account.countDocuments({
      clientId: req.user.id,
      entityId: chartOfAccounts.entityId
    }).session(session);
    
    if (accountsUsingCOA > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete chart of accounts that is in use. Deactivate it instead.'
      });
    }
    
    // Delete the chart of accounts
    await ChartOfAccounts.deleteOne({ _id: chartOfAccounts._id }).session(session);
    
    // Create audit log
    const auditLog = new AuditLog({
      clientId: req.user.id,
      action: 'DELETE_CHART_OF_ACCOUNTS',
      entityType: 'ChartOfAccounts',
      entityId: chartOfAccounts._id,
      userId: req.user.id,
      details: { 
        name: chartOfAccounts.name,
        entityId: chartOfAccounts.entityId
      }
    });
    
    await auditLog.save({ session });
    await session.commitTransaction();
    
    res.json({
      success: true,
      message: 'Chart of accounts deleted successfully'
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Error deleting chart of accounts:', error);
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * Add an account to a chart of accounts
 */
exports.addAccount = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const {
      accountNumber,
      accountName,
      accountType,
      fslCategory,
      description,
      subledgerType,
      parentAccount,
      isIntercompany,
      currency,
      customFields,
      tags
    } = req.body;
    
    // Find chart of accounts and make sure it belongs to this client
    const chartOfAccounts = await ChartOfAccounts.findOne({
      _id: req.params.id,
      clientId: req.user.id
    }).session(session);
    
    if (!chartOfAccounts) {
      return res.status(404).json({
        success: false,
        message: 'Chart of accounts not found'
      });
    }
    
    // Check if account number already exists
    const accountExists = chartOfAccounts.accounts.some(a => a.accountNumber === accountNumber);
    
    if (accountExists) {
      return res.status(400).json({
        success: false,
        message: `Account with number ${accountNumber} already exists in this chart of accounts`
      });
    }
    
    // Check if parent account exists if specified
    if (parentAccount) {
      const parentExists = chartOfAccounts.accounts.some(a => a.accountNumber === parentAccount);
      
      if (!parentExists) {
        return res.status(400).json({
          success: false,
          message: `Parent account ${parentAccount} does not exist in this chart of accounts`
        });
      }
    }
    
    // Create new account object
    const newAccount = {
      accountNumber,
      accountName,
      accountType,
      fslCategory,
      description,
      subledgerType: subledgerType || 'GL',
      parentAccount: parentAccount || null,
      isIntercompany: isIntercompany || false,
      currency: currency || chartOfAccounts.defaultCurrency || 'USD',
      customFields: customFields || {},
      tags: tags || []
    };
    
    // Add the account to the chart of accounts
    chartOfAccounts.accounts.push(newAccount);
    
    // Increment version
    chartOfAccounts.version += 1;
    
    await chartOfAccounts.save({ session });
    
    // Create audit log
    const auditLog = new AuditLog({
      clientId: req.user.id,
      action: 'ADD_ACCOUNT_TO_CHART',
      entityType: 'ChartOfAccounts',
      entityId: chartOfAccounts._id,
      userId: req.user.id,
      details: { 
        accountNumber,
        accountName,
        accountType,
        fslCategory,
        chartOfAccountsName: chartOfAccounts.name
      }
    });
    
    await auditLog.save({ session });
    await session.commitTransaction();
    
    res.status(201).json({
      success: true,
      message: 'Account added to chart of accounts successfully',
      account: newAccount
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Error adding account to chart of accounts:', error);
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * Update an account in a chart of accounts
 */
exports.updateAccount = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { accountNumber } = req.params;
    const {
      accountName,
      fslCategory,
      description,
      subledgerType,
      parentAccount,
      isIntercompany,
      isActive,
      currency,
      customFields,
      tags,
      displayOptions
    } = req.body;
    
    // Find chart of accounts and make sure it belongs to this client
    const chartOfAccounts = await ChartOfAccounts.findOne({
      _id: req.params.id,
      clientId: req.user.id
    }).session(session);
    
    if (!chartOfAccounts) {
      return res.status(404).json({
        success: false,
        message: 'Chart of accounts not found'
      });
    }
    
    // Find the account to update
    const accountIndex = chartOfAccounts.accounts.findIndex(a => a.accountNumber === accountNumber);
    
    if (accountIndex === -1) {
      return res.status(404).json({
        success: false,
        message: `Account with number ${accountNumber} not found in this chart of accounts`
      });
    }
    
    // Check if parent account exists if specified and different from current
    if (parentAccount && parentAccount !== chartOfAccounts.accounts[accountIndex].parentAccount) {
      const parentExists = chartOfAccounts.accounts.some(a => a.accountNumber === parentAccount);
      
      if (!parentExists) {
        return res.status(400).json({
          success: false,
          message: `Parent account ${parentAccount} does not exist in this chart of accounts`
        });
      }
      
      // Prevent circular references
      if (parentAccount === accountNumber) {
        return res.status(400).json({
          success: false,
          message: 'An account cannot be its own parent'
        });
      }
    }
    
    // Update account fields
    const account = chartOfAccounts.accounts[accountIndex];
    
    if (accountName !== undefined) account.accountName = accountName;
    if (fslCategory !== undefined) account.fslCategory = fslCategory;
    if (description !== undefined) account.description = description;
    if (subledgerType !== undefined) account.subledgerType = subledgerType;
    if (parentAccount !== undefined) account.parentAccount = parentAccount;
    if (isIntercompany !== undefined) account.isIntercompany = isIntercompany;
    if (isActive !== undefined) account.isActive = isActive;
    if (currency !== undefined) account.currency = currency;
    if (customFields !== undefined) {
      account.customFields = new Map([...account.customFields, ...customFields]);
    }
    if (tags !== undefined) account.tags = tags;
    if (displayOptions !== undefined) account.displayOptions = {
      ...account.displayOptions,
      ...displayOptions
    };
    
    // Update the account in the chart of accounts
    chartOfAccounts.accounts[accountIndex] = account;
    
    // Increment version
    chartOfAccounts.version += 1;
    
    // Mark the document as modified
    chartOfAccounts.markModified('accounts');
    
    await chartOfAccounts.save({ session });
    
    // Create audit log
    const auditLog = new AuditLog({
      clientId: req.user.id,
      action: 'UPDATE_ACCOUNT_IN_CHART',
      entityType: 'ChartOfAccounts',
      entityId: chartOfAccounts._id,
      userId: req.user.id,
      details: { 
        accountNumber,
        accountName,
        chartOfAccountsName: chartOfAccounts.name
      }
    });
    
    await auditLog.save({ session });
    await session.commitTransaction();
    
    res.json({
      success: true,
      message: 'Account updated successfully',
      account: chartOfAccounts.accounts[accountIndex]
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Error updating account in chart of accounts:', error);
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * Delete an account from a chart of accounts
 */
exports.deleteAccount = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { accountNumber } = req.params;
    
    // Find chart of accounts and make sure it belongs to this client
    const chartOfAccounts = await ChartOfAccounts.findOne({
      _id: req.params.id,
      clientId: req.user.id
    }).session(session);
    
    if (!chartOfAccounts) {
      return res.status(404).json({
        success: false,
        message: 'Chart of accounts not found'
      });
    }
    
    // Find the account to delete
    const accountIndex = chartOfAccounts.accounts.findIndex(a => a.accountNumber === accountNumber);
    
    if (accountIndex === -1) {
      return res.status(404).json({
        success: false,
        message: `Account with number ${accountNumber} not found in this chart of accounts`
      });
    }
    
    // Check if this account is a parent of other accounts
    const isParent = chartOfAccounts.accounts.some(a => a.parentAccount === accountNumber);
    
    if (isParent) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete account ${accountNumber} as it is a parent of other accounts`
      });
    }
    
    // Store account info for audit log
    const accountInfo = chartOfAccounts.accounts[accountIndex];
    
    // Remove the account from the chart of accounts
    chartOfAccounts.accounts.splice(accountIndex, 1);
    
    // Increment version
    chartOfAccounts.version += 1;
    
    await chartOfAccounts.save({ session });
    
    // Create audit log
    const auditLog = new AuditLog({
      clientId: req.user.id,
      action: 'DELETE_ACCOUNT_FROM_CHART',
      entityType: 'ChartOfAccounts',
      entityId: chartOfAccounts._id,
      userId: req.user.id,
      details: { 
        accountNumber,
        accountName: accountInfo.accountName,
        accountType: accountInfo.accountType,
        fslCategory: accountInfo.fslCategory,
        chartOfAccountsName: chartOfAccounts.name
      }
    });
    
    await auditLog.save({ session });
    await session.commitTransaction();
    
    res.json({
      success: true,
      message: 'Account deleted from chart of accounts successfully'
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Error deleting account from chart of accounts:', error);
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * Get FSLI categories by accountType
 */
exports.getFSLICategories = async (req, res, next) => {
  try {
    // Default FSLI categories by account type
    const defaultCategories = {
      Asset: [
        'Cash and Cash Equivalents',
        'Short-term Investments',
        'Accounts Receivable',
        'Inventory',
        'Prepaid Expenses',
        'Other Current Assets',
        'Property, Plant and Equipment',
        'Intangible Assets',
        'Long-term Investments',
        'Other Non-current Assets'
      ],
      Liability: [
        'Accounts Payable',
        'Short-term Debt',
        'Current Portion of Long-term Debt',
        'Accrued Liabilities',
        'Deferred Revenue',
        'Other Current Liabilities',
        'Long-term Debt',
        'Deferred Tax Liabilities',
        'Other Non-current Liabilities'
      ],
      Equity: [
        'Common Stock',
        'Preferred Stock',
        'Additional Paid-in Capital',
        'Treasury Stock',
        'Retained Earnings',
        'Accumulated Other Comprehensive Income',
        'Non-controlling Interest'
      ],
      Revenue: [
        'Revenue',
        'Service Revenue',
        'Product Revenue',
        'Other Revenue'
      ],
      Expense: [
        'Cost of Goods Sold',
        'Operating Expenses',
        'Sales and Marketing',
        'General and Administrative',
        'Research and Development',
        'Depreciation and Amortization',
        'Interest Expense',
        'Income Tax Expense',
        'Other Expenses'
      ]
    };
    
    // Get custom FSLI categories from existing charts of accounts
    const chartOfAccounts = await ChartOfAccounts.find({
      clientId: req.user.id,
      isActive: true
    });
    
    // Extract all FSLI categories used
    const customCategories = {};
    
    chartOfAccounts.forEach(coa => {
      coa.accounts.forEach(account => {
        if (!customCategories[account.accountType]) {
          customCategories[account.accountType] = new Set();
        }
        
        customCategories[account.accountType].add(account.fslCategory);
      });
    });
    
    // Merge default and custom categories
    const result = {};
    
    Object.keys(defaultCategories).forEach(type => {
      result[type] = defaultCategories[type];
      
      if (customCategories[type]) {
        // Add custom categories that aren't in the default list
        customCategories[type].forEach(category => {
          if (!result[type].includes(category)) {
            result[type].push(category);
          }
        });
      }
      
      // Sort categories alphabetically
      result[type].sort();
    });
    
    res.json({
      success: true,
      fsliCategories: result
    });
  } catch (error) {
    logger.error('Error fetching FSLI categories:', error);
    next(error);
  }
};

/**
 * Import accounts from another chart of accounts
 */
exports.importAccounts = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { sourceChartId } = req.body;
    
    // Find target chart of accounts
    const targetChart = await ChartOfAccounts.findOne({
      _id: req.params.id,
      clientId: req.user.id
    }).session(session);
    
    if (!targetChart) {
      return res.status(404).json({
        success: false,
        message: 'Target chart of accounts not found'
      });
    }
    
    // Find source chart of accounts
    const sourceChart = await ChartOfAccounts.findOne({
      _id: sourceChartId,
      clientId: req.user.id
    }).session(session);
    
    if (!sourceChart) {
      return res.status(404).json({
        success: false,
        message: 'Source chart of accounts not found'
      });
    }
    
    // Get existing account numbers in target
    const existingAccountNumbers = new Set(targetChart.accounts.map(a => a.accountNumber));
    
    // Filter source accounts that don't already exist in target
    const accountsToImport = sourceChart.accounts.filter(a => !existingAccountNumbers.has(a.accountNumber));
    
    // Add accounts to target
    targetChart.accounts.push(...accountsToImport);
    
    // Increment version
    targetChart.version += 1;
    
    await targetChart.save({ session });
    
    // Create audit log
    const auditLog = new AuditLog({
      clientId: req.user.id,
      action: 'IMPORT_ACCOUNTS_TO_CHART',
      entityType: 'ChartOfAccounts',
      entityId: targetChart._id,
      userId: req.user.id,
      details: { 
        sourceChartId,
        sourceChartName: sourceChart.name,
        targetChartName: targetChart.name,
        accountCount: accountsToImport.length
      }
    });
    
    await auditLog.save({ session });
    await session.commitTransaction();
    
    res.json({
      success: true,
      message: `Successfully imported ${accountsToImport.length} accounts`,
      importedAccounts: accountsToImport.map(a => ({
        accountNumber: a.accountNumber,
        accountName: a.accountName,
        accountType: a.accountType,
        fslCategory: a.fslCategory
      }))
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Error importing accounts to chart of accounts:', error);
    next(error);
  } finally {
    session.endSession();
  }
};
