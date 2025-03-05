const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const router = express.Router();
const JournalEntry = require('../models/journalEntry');
const Account = require('../models/account');
const AuditLog = require('../models/auditLog');
const File = require('../models/file');
const { auth } = require('../middleware/auth');

// Journal entry validation middleware
const journalEntryValidation = [
  body('date')
    .isDate()
    .withMessage('Valid date is required'),
  body('description')
    .notEmpty()
    .withMessage('Description is required')
    .trim(),
  body('entries')
    .isArray({ min: 1 })
    .withMessage('At least one entry is required'),
  body('entries.*.accountNo')
    .notEmpty()
    .withMessage('Account number is required'),
  body('entries.*.accountTitle')
    .notEmpty()
    .withMessage('Account title is required'),
  body('entries.*.amount')
    .isFloat({ gt: 0 })
    .withMessage('Amount must be greater than zero'),
  body('entries.*.isDebit')
    .isBoolean()
    .withMessage('Debit indicator must be true or false')
];

// Get journal entries validation
const getJournalEntriesValidation = [
  query('startDate')
    .optional()
    .isDate()
    .withMessage('Start date must be a valid date'),
  query('endDate')
    .optional()
    .isDate()
    .withMessage('End date must be a valid date'),
  query('accountNo')
    .optional()
    .isString()
    .withMessage('Account number must be a string'),
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

// Manual Journal Entry Route (Multiple Entries with Supporting Docs)
router.post('/journal-entry', auth, journalEntryValidation, async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      message: 'Validation failed', 
      errors: errors.array() 
    });
  }

  const { date, transactionNo, description, entries, supportingDocs } = req.body;
  
  try {
    // Calculate debits and credits
    let debitTotal = 0;
    let creditTotal = 0;
    const journalEntryDocs = [];

    // Process each entry
    for (const entry of entries) {
      const { accountNo, accountTitle, amount, isDebit } = entry;

      try {
        // Find or create account
        let account = await Account.findOne({ accountNumber: accountNo });
        if (!account) {
          // Determine account type based on first digit of account number
          const accountType = accountNo.startsWith('1') ? 'Asset' : 
                            accountNo.startsWith('2') ? 'Liability' : 
                            accountNo.startsWith('3') ? 'Equity' : 
                            accountNo.startsWith('4') ? 'Revenue' : 'Expense';
          
          // Determine subledger type based on account number
          let subledgerType = 'GL'; // Default to General Ledger
          if (accountNo === '2000') {
            subledgerType = 'AP';
          } else if (accountNo === '1110') {
            subledgerType = 'AR';
          } else if (accountNo.startsWith('60')) {
            subledgerType = 'Payroll';
          } else if (accountNo.startsWith('12')) {
            subledgerType = 'Inventory';
          } else if (accountNo.startsWith('15')) {
            subledgerType = 'Assets';
          }
          
          account = new Account({
            clientId: req.user.id,
            accountNumber: accountNo,
            accountName: accountTitle,
            accountType,
            subledgerType,
            isManual: true
          });
          await account.save();
        }

        // Calculate totals
        const amountValue = parseFloat(amount);
        if (isDebit) {
          debitTotal += amountValue;
        } else {
          creditTotal += amountValue;
        }

        // Create journal entry document
        const journalEntry = new JournalEntry({
          clientId: req.user.id,
          date: new Date(date),
          transactionNo,
          description: entry.description || description,
          debitAccount: isDebit ? account._id : null,
          creditAccount: !isDebit ? account._id : null,
          amount: amountValue,
          createdBy: req.user.id,
          subledgerType: account.subledgerType || 'GL',
          journalType: 'Manual',
          isManual: true,
          lineNo: entry.lineNo,
          vendor: entry.vendor,
          documentNo: entry.documentNo,
          department: entry.department,
          project: entry.project
        });
        await journalEntry.save();
        journalEntryDocs.push(journalEntry);
      } catch (error) {
        return res.status(400).json({
          message: `Error processing entry for account ${accountNo}`,
          error: error.message
        });
      }
    }

    // Validate balance with precision handling (fix floating point issues)
    if (Math.abs(debitTotal - creditTotal) > 0.001) {
      return res.status(400).json({ 
        message: 'Journal entries are not balanced', 
        errors: { 
          balance: 'Debits must equal credits',
          debitTotal: debitTotal.toFixed(2),
          creditTotal: creditTotal.toFixed(2)
        } 
      });
    }

    // Handle supporting documents
    const documentRefs = [];
    const documentErrors = [];
    
    if (supportingDocs && Array.isArray(supportingDocs)) {
      for (const docName of supportingDocs) {
        try {
          const file = await File.findOne({ fileName: docName, userId: req.user.id });
          if (file) {
            documentRefs.push(file._id);
          } else {
            documentErrors.push(`Document "${docName}" not found in your uploaded files`);
          }
        } catch (docError) {
          documentErrors.push(`Error processing document "${docName}": ${docError.message}`);
        }
      }
    }

    // Log to AuditLog
    try {
      const auditLog = new AuditLog({
        clientId: req.user.id,
        action: 'CREATE_JOURNAL_ENTRIES',
        entityType: 'JournalEntry',
        entityId: journalEntryDocs.map(doc => doc._id.toString()).join(','),
        userId: req.user.id,
        details: { 
          transactionNo, 
          description, 
          totalDebits: debitTotal, 
          totalCredits: creditTotal,
          numberOfEntries: journalEntryDocs.length,
          supportingDocs: documentRefs.length,
          documentErrors: documentErrors.length > 0 ? documentErrors : undefined
        }
      });
      await auditLog.save();
    } catch (auditError) {
      console.error('Audit log creation failed:', auditError);
      // Continue processing - audit failure shouldn't stop the journal entry creation
    }

    res.status(201).json({ 
      message: 'Journal entries saved successfully', 
      journalEntries: journalEntryDocs.map(doc => ({
        id: doc._id,
        date: doc.date,
        description: doc.description,
        amount: doc.amount,
        isDebit: !!doc.debitAccount
      })),
      documentCount: documentRefs.length,
      documentWarnings: documentErrors.length > 0 ? documentErrors : undefined
    });
  } catch (error) {
    next(error);
  }
});

// Get Journal Entries
router.get('/journal-entries', auth, getJournalEntriesValidation, async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      message: 'Validation failed', 
      errors: errors.array() 
    });
  }
  
  try {
    const { startDate, endDate, accountNo, limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build query filters
    const query = { clientId: req.user.id };
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    
    // If accountNo is provided, find the account and query by it
    if (accountNo) {
      try {
        const account = await Account.findOne({ accountNumber: accountNo });
        if (account) {
          query.$or = [
            { debitAccount: account._id },
            { creditAccount: account._id }
          ];
        } else {
          return res.status(404).json({ 
            message: 'Account not found',
            error: { accountNo: `Account number ${accountNo} does not exist` } 
          });
        }
      } catch (accountError) {
        return res.status(400).json({ 
          message: 'Error finding account',
          error: { accountNo: accountError.message } 
        });
      }
    }
    
    // Execute query with pagination
    const totalCount = await JournalEntry.countDocuments(query);
    const entries = await JournalEntry.find(query)
      .sort({ date: -1, _id: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .populate('debitAccount creditAccount')
      .lean();
    
    // Format response
    const formattedEntries = entries.map(entry => ({
      id: entry._id,
      date: entry.date,
      transactionNo: entry.transactionNo,
      description: entry.description,
      amount: entry.amount,
      debitAccount: entry.debitAccount ? {
        id: entry.debitAccount._id,
        number: entry.debitAccount.accountNumber,
        name: entry.debitAccount.accountName
      } : null,
      creditAccount: entry.creditAccount ? {
        id: entry.creditAccount._id,
        number: entry.creditAccount.accountNumber,
        name: entry.creditAccount.accountName
      } : null,
      lineNo: entry.lineNo,
      vendor: entry.vendor,
      documentNo: entry.documentNo,
      department: entry.department,
      project: entry.project,
      isManual: entry.isManual
    }));
    
    res.json({
      entries: formattedEntries,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

// Delete Journal Entry (with appropriate permissions)
router.delete('/journal-entries/:id', auth, deleteJournalEntryValidation, async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      message: 'Validation failed', 
      errors: errors.array() 
    });
  }
  
  try {
    const journalEntryId = req.params.id;
    
    // First, check if the entry exists and belongs to the user
    const journalEntry = await JournalEntry.findOne({
      _id: journalEntryId,
      clientId: req.user.id
    });
    
    if (!journalEntry) {
      return res.status(404).json({ 
        message: 'Journal entry not found',
        error: { id: 'The requested journal entry does not exist or you do not have permission' }
      });
    }
    
    // Check if deletion is allowed (e.g., only for manual entries, time restrictions)
    if (!journalEntry.isManual) {
      return res.status(403).json({ 
        message: 'Cannot delete automatic journal entry',
        error: { permission: 'Only manual journal entries can be deleted' }
      });
    }
    
    // Delete the entry
    await JournalEntry.deleteOne({ _id: journalEntryId });
    
    // Create audit log for deletion
    const auditLog = new AuditLog({
      clientId: req.user.id,
      action: 'DELETE_JOURNAL_ENTRY',
      entityType: 'JournalEntry',
      entityId: journalEntryId,
      userId: req.user.id,
      details: { 
        date: journalEntry.date,
        transactionNo: journalEntry.transactionNo,
        amount: journalEntry.amount
      }
    });
    await auditLog.save();
    
    res.json({ 
      message: 'Journal entry deleted successfully',
      id: journalEntryId
    });
  } catch (error) {
    next(error);
  }
});

// Get Accounts validation
const getAccountsValidation = [
  query('type')
    .optional()
    .isString()
    .withMessage('Account type must be a string'),
  query('subledger')
    .optional()
    .isString()
    .withMessage('Subledger type must be a string')
];

// Get Accounts
router.get('/accounts', auth, getAccountsValidation, async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      message: 'Validation failed', 
      errors: errors.array() 
    });
  }
  
  try {
    const { type, subledger } = req.query;
    const query = { clientId: req.user.id };
    
    if (type) {
      query.accountType = type;
    }
    
    if (subledger) {
      query.subledgerType = subledger;
    }
    
    const accounts = await Account.find(query).sort({ accountNumber: 1 });
    
    res.json({
      accounts: accounts.map(account => ({
        id: account._id,
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        accountType: account.accountType,
        subledgerType: account.subledgerType
      }))
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
