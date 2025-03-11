// controllers/journalEntryController.js
const JournalEntry = require('../models/journalEntry');
const Transaction = require('../models/transaction');
const Account = require('../models/account');
const Entity = require('../models/entity');
const AuditLog = require('../models/auditLog');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Get journal entries with filtering and pagination
exports.getJournalEntries = async (req, res, next) => {
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
    logger.error('Error fetching journal entries:', error);
    next(error);
  }
};

// Get a single journal entry by ID
exports.getJournalEntryById = async (req, res, next) => {
  try {
    const entry = await JournalEntry.findOne({
      _id: req.params.id,
      clientId: req.user.id
    }).populate('entityId', 'name code');
    
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Journal entry not found'
      });
    }
    
    // Get related transactions
    const transactions = await Transaction.find({
      journalEntryId: entry._id
    }).populate('accountId', 'accountNumber accountName');
    
    res.json({
      success: true,
      entry: {
        id: entry._id,
        entryNumber: entry.entryNumber,
        date: entry.date,
        description: entry.description,
        entity: entry.entityId ? {
          id: entry.entityId._id,
          name: entry.entityId.name,
          code: entry.entityId.code
        } : null,
        totalAmount: entry.totalAmount,
        status: entry.status,
        transactions: transactions.map(t => ({
          id: t._id,
          account: t.accountId ? {
            id: t.accountId._id,
            number: t.accountId.accountNumber,
            name: t.accountId.accountName
          } : null,
          amount: t.amount,
          type: t.type,
          description: t.description || entry.description
        }))
      }
    });
  } catch (error) {
    logger.error('Error fetching journal entry:', error);
    next(error);
  }
};

// Create journal entry
exports.createJournalEntry = async (req, res, next) => {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();
    
    const { entityId, date, description, entries, attachments } = req.body;
    
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
      journalEntry.attachments = attachments;
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
    logger.error('Error creating journal entry:', error);
    
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
};

// Delete/Reverse journal entry
exports.deleteJournalEntry = async (req, res, next) => {
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
    logger.error('Error reversing journal entry:', error);
    next(error);
  } finally {
    session.endSession();
  }
};
