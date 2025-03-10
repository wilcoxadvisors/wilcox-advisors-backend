// routes/accounting.js
const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const router = express.Router();
const JournalEntry = require('../models/journalEntry');
const Transaction = require('../models/transaction');
const Account = require('../models/account');
const Entity = require('../models/entity');
const AuditLog = require('../models/auditLog');
const File = require('../models/file');
const { auth } = require('../middleware/auth');

// Journal entry validation middleware
const journalEntryValidation = [
 body('date')
   .isDate()
   .withMessage('Valid date is required'),
 body('entityId')
   .isMongoId()
   .withMessage('Valid entity ID is required'),
 body('description')
   .notEmpty()
   .withMessage('Description is required')
   .trim(),
 body('entries')
   .isArray({ min: 1 })
   .withMessage('At least one entry is required'),
 body('entries.*.accountId')
   .isMongoId()
   .withMessage('Valid account ID is required'),
 body('entries.*.amount')
   .isFloat({ gt: 0 })
   .withMessage('Amount must be greater than zero'),
 body('entries.*.type')
   .isIn(['debit', 'credit'])
   .withMessage('Type must be either debit or credit')
];

// Get entities validation
const getEntitiesValidation = [
 query('active')
   .optional()
   .isBoolean()
   .withMessage('Active must be a boolean')
];

// Get accounts validation
const getAccountsValidation = [
 query('entityId')
   .isMongoId()
   .withMessage('Valid entity ID is required'),
 query('type')
   .optional()
   .isString()
   .withMessage('Account type must be a string'),
 query('subledger')
   .optional()
   .isString()
   .withMessage('Subledger type must be a string'),
 query('active')
   .optional()
   .isBoolean()
   .withMessage('Active must be a boolean')
];

// Get journal entries validation
const getJournalEntriesValidation = [
 query('entityId')
   .isMongoId()
   .withMessage('Valid entity ID is required'),
 query('startDate')
   .optional()
   .isDate()
   .withMessage('Start date must be a valid date'),
 query('endDate')
   .optional()
   .isDate()
   .withMessage('End date must be a valid date'),
 query('accountId')
   .optional()
   .isMongoId()
   .withMessage('Account ID must be valid'),
 query('status')
   .optional()
   .isIn(['draft', 'posted', 'reversed'])
   .withMessage('Status must be draft, posted, or reversed'),
 query('limit')
   .optional()
   .isInt({ min: 1, max: 100 })
   .withMessage('Limit must be between 1 and 100'),
 query('page')
   .optional()
   .isInt({ min: 1 })
   .withMessage('Page must be a positive integer')
];

// Delete journal entry validation
const deleteJournalEntryValidation = [
 param('id')
   .isMongoId()
   .withMessage('Invalid journal entry ID format')
];

// Get entities
router.get('/entities', auth, getEntitiesValidation, async (req, res, next) => {
 // Check for validation errors
 const errors = validationResult(req);
 if (!errors.isEmpty()) {
   return res.status(400).json({ 
     success: false,
     message: 'Validation failed', 
     errors: errors.array() 
   });
 }
 
 try {
   const { active } = req.query;
   const query = { clientId: req.user.id };
   
   if (active !== undefined) {
     query.isActive = active === 'true';
   }
   
   const entities = await Entity.find(query).sort({ name: 1 });
   
   res.json({
     success: true,
     entities: entities.map(entity => ({
       id: entity._id,
       name: entity.name,
       code: entity.code,
       type: entity.type,
       currency: entity.currency,
       isActive: entity.isActive,
       parentEntityId: entity.parentEntityId
     }))
   });
 } catch (error) {
   console.error('Error fetching entities:', error);
   next(error);
 }
});

// Create entity
router.post('/entities', auth, async (req, res, next) => {
 try {
   const { name, code, type, currency, parentEntityId } = req.body;
   
   // Check if entity code already exists
   const existingEntity = await Entity.findOne({ 
     clientId: req.user.id, 
     code: code 
   });
   
   if (existingEntity) {
     return res.status(400).json({
       success: false,
       message: `Entity with code ${code} already exists`
     });
   }
   
   const entity = new Entity({
     clientId: req.user.id,
     name,
     code,
     type: type || 'Operating',
     currency: currency || 'USD',
     parentEntityId: parentEntityId || null
   });
   
   await entity.save();
   
   // Create audit log
   const auditLog = new AuditLog({
     clientId: req.user.id,
     action: 'CREATE_ENTITY',
     entityType: 'Entity',
     entityId: entity._id,
     userId: req.user.id,
     details: { name, code, type }
   });
   await auditLog.save();
   
   res.status(201).json({
     success: true,
     message: 'Entity created successfully',
     entity: {
       id: entity._id,
       name: entity.name,
       code: entity.code,
       type: entity.type,
       currency: entity.currency,
       isActive: entity.isActive,
       parentEntityId: entity.parentEntityId
     }
   });
 } catch (error) {
   console.error('Error creating entity:', error);
   next(error);
 }
});

// Get accounts
router.get('/accounts', auth, getAccountsValidation, async (req, res, next) => {
 // Check for validation errors
 const errors = validationResult(req);
 if (!errors.isEmpty()) {
   return res.status(400).json({ 
     success: false,
     message: 'Validation failed', 
     errors: errors.array() 
   });
 }
 
 try {
   const { entityId, type, subledger, active } = req.query;
   const query = { 
     clientId: req.user.id,
     entityId
   };
   
   if (type) {
     query.accountType = type;
   }
   
   if (subledger) {
     query.subledgerType = subledger;
   }
   
   if (active !== undefined) {
     query.isActive = active === 'true';
   }
   
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
   console.error('Error fetching accounts:', error);
   next(error);
 }
});

// Create account
router.post('/accounts', auth, async (req, res, next) => {
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
   
   // Check if entity exists
   const entity = await Entity.findOne({ 
     _id: entityId,
     clientId: req.user.id
   });
   
   if (!entity) {
     return res.status(404).json({
       success: false,
       message: 'Entity not found'
     });
   }
   
   // Check if account already exists
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
   
   const account = new Account({
     clientId: req.user.id,
     entityId,
     accountNumber,
     accountName,
     accountType,
     subledgerType: subledgerType || 'GL',
     description,
     isIntercompany: isIntercompany || false,
     currency: currency || entity.currency
   });
   
   await account.save();
   
   // Create audit log
   const auditLog = new AuditLog({
     clientId: req.user.id,
     action: 'CREATE_ACCOUNT',
     entityType: 'Account',
     entityId: account._id,
     userId: req.user.id,
     details: { accountNumber, accountName, accountType }
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
       subledgerType: account.subledgerType,
       isIntercompany: account.isIntercompany,
       currency: account.currency
     }
   });
 } catch (error) {
   console.error('Error creating account:', error);
   next(error);
 }
});

// Get journal entries
router.get('/journal-entries', auth, getJournalEntriesValidation, async (req, res, next) => {
 // Check for validation errors
 const errors = validationResult(req);
 if (!errors.isEmpty()) {
   return res.status(400).json({ 
     success: false,
     message: 'Validation failed', 
     errors: errors.array() 
   });
 }
 
 try {
   const { 
     entityId, 
     startDate, 
     endDate, 
     accountId, 
     status, 
     limit = 50, 
     page = 1 
   } = req.query;
   
   const skip = (parseInt(page) - 1) * parseInt(limit);
   
   // Build query filters
   const query = { 
     clientId: req.user.id,
     entityId
   };
   
   if (startDate || endDate) {
     query.date = {};
     if (startDate) query.date.$gte = new Date(startDate);
     if (endDate) query.date.$lte = new Date(endDate);
   }
   
   if (status) {
     query.status = status;
   }
   
   // If accountId is provided, find corresponding transactions
   if (accountId) {
     const transactionIds = await Transaction.find({
       clientId: req.user.id,
       entityId,
       accountId
     }).distinct('journalEntryId');
     
     query._id = { $in: transactionIds };
   }
   
   // Execute query with pagination
   const totalCount = await JournalEntry.countDocuments(query);
   const entries = await JournalEntry.find(query)
     .sort({ date: -1, _id: -1 })
     .limit(parseInt(limit))
     .skip(skip)
     .populate('entityId', 'name code')
     .lean();
   
   // Get transactions for these journal entries
   const journalEntryIds = entries.map(entry => entry._id);
   const transactions = await Transaction.find({
     clientId: req.user.id,
     journalEntryId: { $in: journalEntryIds }
   }).populate('accountId', 'accountNumber accountName')
     .lean();
   
   // Group transactions by journal entry
   const transactionsByEntry = {};
   transactions.forEach(transaction => {
     const journalId = transaction.journalEntryId.toString();
     if (!transactionsByEntry[journalId]) {
       transactionsByEntry[journalId] = [];
     }
     transactionsByEntry[journalId].push(transaction);
   });
   
   // Format response
   const formattedEntries = entries.map(entry => ({
     id: entry._id,
     entryNumber: entry.entryNumber,
     date: entry.date,
     entity: entry.entityId ? {
       id: entry.entityId._id,
       name: entry.entityId.name,
       code: entry.entityId.code
     } : null,
     description: entry.description,
     totalAmount: entry.totalAmount,
     status: entry.status,
     isIntercompany: entry.isIntercompany,
     transactions: (transactionsByEntry[entry._id.toString()] || []).map(t => ({
       id: t._id,
       account: t.accountId ? {
         id: t.accountId._id,
         number: t.accountId.accountNumber,
         name: t.accountId.accountName
       } : null,
       amount: t.amount,
       type: t.type,
       description: t.description
     }))
   }));
   
   res.json({
     success: true,
     entries: formattedEntries,
     pagination: {
       total: totalCount,
       page: parseInt(page),
       limit: parseInt(limit),
       pages: Math.ceil(totalCount / parseInt(limit))
     }
   });
 } catch (error) {
   console.error('Error fetching journal entries:', error);
   next(error);
 }
});

// Create journal entry
router.post('/journal-entry', auth, journalEntryValidation, async (req, res, next) => {
 // Check for validation errors
 const errors = validationResult(req);
 if (!errors.isEmpty()) {
   return res.status(400).json({ 
     success: false,
     message: 'Validation failed', 
     errors: errors.array() 
   });
 }

 const { entityId, date, description, entries, attachments } = req.body;
 const session = await mongoose.startSession();
 
 try {
   session.startTransaction();
   
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
   
   // Calculate totals
   let totalDebits = 0;
   let totalCredits = 0;
   
   for (const entry of entries) {
     const amount = parseFloat(entry.amount);
     if (entry.type === 'debit') {
       totalDebits += amount;
     } else {
       totalCredits += amount;
     }
   }
   
   // Verify balanced entry
   if (Math.abs(totalDebits - totalCredits) > 0.01) {
     return res.status(400).json({
       success: false,
       message: 'Journal entries must be balanced',
       details: {
         totalDebits,
         totalCredits,
         difference: totalDebits - totalCredits
       }
     });
   }
   
   // Generate entry number (YYYY-MM-XXXXX)
   const entryDate = new Date(date);
   const year = entryDate.getFullYear();
   const month = String(entryDate.getMonth() + 1).padStart(2, '0');
   
   // Get count of entries this month for sequential numbering
   const entryCount = await JournalEntry.countDocuments({
     clientId: req.user.id,
     entityId,
     'period.year': year,
     'period.month': entryDate.getMonth() + 1
   }).session(session);
   
   const entryNumber = `${year}-${month}-${String(entryCount + 1).padStart(5, '0')}`;
   
   // Create journal entry
   const journalEntry = new JournalEntry({
     clientId: req.user.id,
     entityId,
     entryNumber,
     date: entryDate,
     description,
     totalAmount: totalDebits,
     status: 'posted',
     createdBy: req.user.id,
     currency: entity.currency,
     period: {
       year,
       month: entryDate.getMonth() + 1,
       quarter: Math.floor(entryDate.getMonth() / 3) + 1
     },
     isManual: true,
     attachments: []
   });
   
   // Handle attachments
   if (attachments && Array.isArray(attachments)) {
     for (const attachmentId of attachments) {
       const file = await File.findOne({
         _id: attachmentId,
         userId: req.user.id
       }).session(session);
       
       if (file) {
         journalEntry.attachments.push({
           fileId: file._id,
           fileName: file.fileName,
           uploadDate: file.createdAt
         });
       }
     }
   }
   
   await journalEntry.save({ session });
   
   // Create transactions for each entry
   const transactions = [];
   for (const entry of entries) {
     // Verify account exists and belongs to client
     const account = await Account.findOne({
       _id: entry.accountId,
       clientId: req.user.id,
       entityId
     }).session(session);
     
     if (!account) {
       throw new Error(`Account ${entry.accountId} not found or does not belong to this entity`);
     }
     
     const transaction = new Transaction({
       clientId: req.user.id,
       entityId,
       accountId: entry.accountId,
       journalEntryId: journalEntry._id,
       date: entryDate,
       description: entry.description || description,
       amount: parseFloat(entry.amount),
       type: entry.type,
       transactionNo: entryNumber,
       lineNo: entry.lineNo || transactions.length + 1,
       documentNumber: entry.documentNumber,
       subledgerType: account.subledgerType,
       currency: entity.currency,
       isManual: true
     });
     
     transactions.push(transaction);
     
     // Update account balance
     const updateAmount = parseFloat(entry.amount);
     let balanceChange = 0;
     
     if (['Asset', 'Expense'].includes(account.accountType)) {
       // Debit increases, credit decreases
       balanceChange = entry.type === 'debit' ? updateAmount : -updateAmount;
     } else {
       // Credit increases, debit decreases
       balanceChange = entry.type === 'credit' ? updateAmount : -updateAmount;
     }
     
     await Account.findByIdAndUpdate(
       account._id,
       { 
         $inc: { balance: balanceChange },
         $set: { lastUpdated: new Date() }
       },
       { session }
     );
   }
   
   await Transaction.insertMany(transactions, { session });
   
   // Create audit log
   const auditLog = new AuditLog({
     clientId: req.user.id,
     action: 'CREATE_JOURNAL_ENTRY',
     entityType: 'JournalEntry',
     entityId: journalEntry._id,
     userId: req.user.id,
     details: { 
       entryNumber, 
       entityId, 
       date, 
       totalAmount: totalDebits,
       transactionCount: transactions.length
     }
   });
   await auditLog.save({ session });
   
   await session.commitTransaction();
   
   res.status(201).json({
     success: true,
     message: 'Journal entry created successfully',
     journalEntry: {
       id: journalEntry._id,
       entryNumber: journalEntry.entryNumber,
       date: journalEntry.date,
       description: journalEntry.description,
       totalAmount: journalEntry.totalAmount,
       transactions: transactions.map(t => ({
         id: t._id,
         accountId: t.accountId,
         amount: t.amount,
         type: t.type
       }))
     }
   });
 } catch (error) {
   await session.abortTransaction();
   console.error('Error creating journal entry:', error);
   
   if (error.message && error.message.includes('Account')) {
     return res.status(400).json({
       success: false,
       message: error.message
     });
   }
   
   next(error);
 } finally {
   session.endSession();
 }
});

// Get Trial Balance endpoint
router.get('/trial-balance', auth, async (req, res, next) => {
 try {
   const { entityId, startDate, endDate, level = 'detail' } = req.query;
   
   if (!entityId) {
     return res.status(400).json({ 
       success: false,
       message: 'Entity ID is required'
     });
   }

   // Validate date parameters
   const parsedStartDate = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
   const parsedEndDate = endDate ? new Date(endDate) : new Date();
   
   // Define account aggregation for Trial Balance
   const accounts = await Account.find({
     clientId: req.user.id,
     entityId: entityId,
     isActive: true
   }).sort({ accountNumber: 1 });
   
   // Get transactions for the period
   const transactions = await Transaction.find({
     clientId: req.user.id,
     entityId: entityId,
     date: { $gte: parsedStartDate, $lte: parsedEndDate }
   });
   
   // Calculate balances for each account
   const trialBalance = accounts.map(account => {
     const accountTransactions = transactions.filter(t => 
       t.accountId.toString() === account._id.toString()
     );
     
     const debits = accountTransactions
       .filter(t => t.type === 'debit')
       .reduce((sum, t) => sum + t.amount, 0);
       
     const credits = accountTransactions
       .filter(t => t.type === 'credit')
       .reduce((sum, t) => sum + t.amount, 0);
     
     // Calculate balance based on account type
     let balance = 0;
     if (['Asset', 'Expense'].includes(account.accountType)) {
       balance = debits - credits;
     } else {
       balance = credits - debits;
     }
     
     return {
       id: account._id,
       accountNumber: account.accountNumber,
       accountName: account.accountName,
       accountType: account.accountType,
       debits,
       credits,
       balance
     };
   });
   
   // Summarize at parent account level if requested
   let result = trialBalance;
   if (level === 'summary') {
     // Group by first 2 digits of account number and summarize
     const summaryMap = {};
     trialBalance.forEach(account => {
       const prefix = account.accountNumber.substring(0, 2);
       if (!summaryMap[prefix]) {
         summaryMap[prefix] = {
           accountNumber: `${prefix}XX`,
           accountName: `${account.accountType} Summary (${prefix}XX)`,
           accountType: account.accountType,
           debits: 0,
           credits: 0,
           balance: 0
         };
       }
       summaryMap[prefix].debits += account.debits;
       summaryMap[prefix].credits += account.credits;
       summaryMap[prefix].balance += account.balance;
     });
     result = Object.values(summaryMap);
   }
   
   // Calculate totals
   const totals = {
     debits: result.reduce((sum, acc) => sum + acc.debits, 0),
     credits: result.reduce((sum, acc) => sum + acc.credits, 0),
     netIncome: result
       .filter(acc => ['Revenue', 'Expense'].includes(acc.accountType))
       .reduce((sum, acc) => sum + acc.balance, 0)
   };
   
   res.json({
     success: true,
     trialBalance: result,
     totals,
     period: {
       startDate: parsedStartDate,
       endDate: parsedEndDate
     },
     entityId
   });
 } catch (error) {
   console.error('Trial Balance error:', error);
   next(error);
 }
});

// Get Balance Sheet endpoint
router.get('/balance-sheet', auth, async (req, res, next) => {
 try {
   const { entityId, asOfDate } = req.query;
   
   if (!entityId) {
     return res.status(400).json({ 
       success: false,
       message: 'Entity ID is required'
     });
   }

   const parsedAsOfDate = asOfDate ? new Date(asOfDate) : new Date();
   
   // Get all accounts
   const accounts = await Account.find({
     clientId: req.user.id,
     entityId: entityId,
     isActive: true,
     accountType: { $in: ['Asset', 'Liability', 'Equity'] }
   }).sort({ accountNumber: 1 });
   
   // Get all transactions up to the as-of date
   const transactions = await Transaction.find({
     clientId: req.user.id,
     entityId: entityId,
     date: { $lte: parsedAsOfDate }
   });
   
   // Calculate balances for each account
   const balanceSheetAccounts = accounts.map(account => {
     const accountTransactions = transactions.filter(t => 
       t.accountId.toString() === account._id.toString()
     );
     
     const debits = accountTransactions
       .filter(t => t.type === 'debit')
       .reduce((sum, t) => sum + t.amount, 0);
       
     const credits = accountTransactions
       .filter(t => t.type === 'credit')
       .reduce((sum, t) => sum + t.amount, 0);
     
     // Calculate balance based on account type
     let balance = 0;
     if (account.accountType === 'Asset') {
       balance = debits - credits;
     } else {
       balance = credits - debits;
     }
     
     return {
       id: account._id,
       accountNumber: account.accountNumber,
       accountName: account.accountName,
       accountType: account.accountType,
       balance
     };
   });
   
   // Organize by type and calculate totals
   const assets = balanceSheetAccounts.filter(a => a.accountType === 'Asset');
   const liabilities = balanceSheetAccounts.filter(a => a.accountType === 'Liability');
   const equity = balanceSheetAccounts.filter(a => a.accountType === 'Equity');
   
   const totalAssets = assets.reduce((sum, account) => sum + account.balance, 0);
   const totalLiabilities = liabilities.reduce((sum, account) => sum + account.balance, 0);
   const totalEquity = equity.reduce((sum, account) => sum + account.balance, 0);
   
   // Calculate Year-to-Date Income
   // Get income accounts
   const incomeAccounts = await Account.find({
     clientId: req.user.id,
     entityId: entityId,
     isActive: true,
     accountType: { $in: ['Revenue', 'Expense'] }
   });
   
   // Get current year start date
   const currentYear = parsedAsOfDate.getFullYear();
   const yearStartDate = new Date(currentYear, 0, 1);
   
   // Get income transactions for current year
   const incomeTransactions = await Transaction.find({
     clientId: req.user.id,
     entityId: entityId,
     accountId: { $in: incomeAccounts.map(a => a._id) },
     date: { $gte: yearStartDate, $lte: parsedAsOfDate }
   });
   
   // Calculate net income
   let netIncome = 0;
   incomeAccounts.forEach(account => {
     const accountTransactions = incomeTransactions.filter(t => 
       t.accountId.toString() === account._id.toString()
     );
     
     const debits = accountTransactions
       .filter(t => t.type === 'debit')
       .reduce((sum, t) => sum + t.amount, 0);
       
     const credits = accountTransactions
       .filter(t => t.type === 'credit')
       .reduce((sum, t) => sum + t.amount, 0);
     
     if (account.accountType === 'Revenue') {
       netIncome += (credits - debits);
     } else {
       netIncome -= (debits - credits);
     }
   });
   
   res.json({
     success: true,
     balanceSheet: {
       asOfDate: parsedAsOfDate,
       assets,
       liabilities,
       equity,
       netIncome,
       retainedEarnings: netIncome, // Simplified - would need more logic for real retained earnings
       totals: {
         assets: totalAssets,
         liabilities: totalLiabilities,
         equity: totalEquity + netIncome,
         liabilitiesAndEquity: totalLiabilities + totalEquity + netIncome
       }
     },
     entityId
   });
 } catch (error) {
   console.error('Balance Sheet error:', error);
   next(error);
 }
});

// Get Income Statement endpoint
router.get('/income-statement', auth, async (req, res, next) => {
 try {
   const { entityId, startDate, endDate } = req.query;
   
   if (!entityId) {
     return res.status(400).json({ 
       success: false,
       message: 'Entity ID is required'
     });
   }

   // Validate date parameters
   const parsedStartDate = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
   const parsedEndDate = endDate ? new Date(endDate) : new Date();
   
   // Get income accounts (Revenue and Expense)
   const accounts = await Account.find({
     clientId: req.user.id,
     entityId: entityId,
     isActive: true,
     accountType: { $in: ['Revenue', 'Expense'] }
   }).sort({ accountNumber: 1 });
   
   // Get transactions for the period
   const transactions = await Transaction.find({
     clientId: req.user.id,
     entityId: entityId,
     date: { $gte: parsedStartDate, $lte: parsedEndDate },
     accountId: { $in: accounts.map(a => a._id) }
   });
   
   // Calculate balances for each account
   const incomeAccounts = accounts.map(account => {
     const accountTransactions = transactions.filter(t => 
       t.accountId.toString() === account._id.toString()
     );
     
     const debits = accountTransactions
       .filter(t => t.type === 'debit')
       .reduce((sum, t) => sum + t.amount, 0);
       
     const credits = accountTransactions
        .filter(t => t.type === 'credit')
        .reduce((sum, t) => sum + t.amount, 0);
      
      // Calculate balance based on account type
      let balance = 0;
      if (account.accountType === 'Revenue') {
        balance = credits - debits;
      } else { // Expense
        balance = debits - credits;
      }
      
      return {
        id: account._id,
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        accountType: account.accountType,
        balance
      };
    });
    
    // Organize by type and calculate totals
    const revenue = incomeAccounts.filter(a => a.accountType === 'Revenue');
    const expenses = incomeAccounts.filter(a => a.accountType === 'Expense');
    
    const totalRevenue = revenue.reduce((sum, account) => sum + account.balance, 0);
    const totalExpenses = expenses.reduce((sum, account) => sum + account.balance, 0);
    const netIncome = totalRevenue - totalExpenses;
    
    res.json({
      success: true,
      incomeStatement: {
        period: {
          startDate: parsedStartDate,
          endDate: parsedEndDate
        },
        revenue,
        expenses,
        totals: {
          revenue: totalRevenue,
          expenses: totalExpenses,
          netIncome
        }
      },
      entityId
    });
  } catch (error) {
    console.error('Income Statement error:', error);
    next(error);
  }
});

// Delete journal entry
router.delete('/journal-entries/:id', auth, deleteJournalEntryValidation, async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false,
      message: 'Validation failed', 
      errors: errors.array() 
    });
  }
  
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();
    
    const journalEntryId = req.params.id;
    
    // First, check if the entry exists and belongs to the user
    const journalEntry = await JournalEntry.findOne({
      _id: journalEntryId,
      clientId: req.user.id,
      status: { $ne: 'reversed' } // Cannot delete already reversed entries
    }).session(session);
    
    if (!journalEntry) {
      return res.status(404).json({ 
        success: false,
        message: 'Journal entry not found or already reversed'
      });
    }
    
    // Get transactions for this journal entry
    const transactions = await Transaction.find({
      journalEntryId: journalEntryId
    }).populate('accountId').session(session);
    
    // Reverse account balances
    for (const transaction of transactions) {
      if (!transaction.accountId) continue;
      
      const account = transaction.accountId;
      const updateAmount = transaction.amount;
      let balanceChange = 0;
      
      if (['Asset', 'Expense'].includes(account.accountType)) {
        // Reverse the effect: debit decreased, credit increased
        balanceChange = transaction.type === 'debit' ? -updateAmount : updateAmount;
      } else {
        // Reverse the effect: credit decreased, debit increased
        balanceChange = transaction.type === 'credit' ? -updateAmount : updateAmount;
      }
      
      await Account.findByIdAndUpdate(
        account._id,
        { 
          $inc: { balance: balanceChange },
          $set: { lastUpdated: new Date() }
        },
        { session }
      );
    }
    
    // Create reversal journal entry
    const reversalEntry = new JournalEntry({
      clientId: req.user.id,
      entityId: journalEntry.entityId,
      entryNumber: `REV-${journalEntry.entryNumber}`,
      date: new Date(),
      description: `Reversal of ${journalEntry.entryNumber}: ${journalEntry.description}`,
      totalAmount: journalEntry.totalAmount,
      status: 'posted',
      createdBy: req.user.id,
      reversalOf: journalEntry._id,
      currency: journalEntry.currency,
      period: {
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        quarter: Math.floor(new Date().getMonth() / 3) + 1
      },
      isManual: true
    });
    
    await reversalEntry.save({ session });
    
    // Create reversal transactions
    const reversalTransactions = [];
    for (const transaction of transactions) {
      const reversalTransaction = new Transaction({
        clientId: req.user.id,
        entityId: transaction.entityId,
        accountId: transaction.accountId._id,
        journalEntryId: reversalEntry._id,
        date: new Date(),
        description: `Reversal of ${transaction.description}`,
        amount: transaction.amount,
        // Reverse the transaction type
        type: transaction.type === 'debit' ? 'credit' : 'debit',
        transactionNo: reversalEntry.entryNumber,
        lineNo: transaction.lineNo,
        subledgerType: transaction.subledgerType,
        currency: transaction.currency,
        isManual: true
      });
      
      reversalTransactions.push(reversalTransaction);
    }
    
    await Transaction.insertMany(reversalTransactions, { session });
    
    // Update original journal entry
    await JournalEntry.findByIdAndUpdate(
      journalEntry._id,
      { 
        $set: { 
          status: 'reversed',
          reversedBy: reversalEntry._id
        }
      },
      { session }
    );
    
    // Create audit log
    const auditLog = new AuditLog({
      clientId: req.user.id,
      action: 'REVERSE_JOURNAL_ENTRY',
      entityType: 'JournalEntry',
      entityId: journalEntry._id,
      userId: req.user.id,
      details: { 
        originalEntryNumber: journalEntry.entryNumber,
        reversalEntryNumber: reversalEntry.entryNumber,
        date: new Date(),
        amount: journalEntry.totalAmount
      }
    });
    await auditLog.save({ session });
    
    await session.commitTransaction();
    
    res.json({ 
      success: true,
      message: 'Journal entry reversed successfully',
      reversalEntry: {
        id: reversalEntry._id,
        entryNumber: reversalEntry.entryNumber
      }
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error reversing journal entry:', error);
    next(error);
  } finally {
    session.endSession();
  }
});

module.exports = router;
