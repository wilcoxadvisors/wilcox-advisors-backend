// controllers/reportController.js
const Account = require('../models/account');
const Transaction = require('../models/transaction');
const logger = require('../utils/logger');

// Get Trial Balance
exports.getTrialBalance = async (req, res, next) => {
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
    logger.error('Trial Balance error:', error);
    next(error);
  }
};

// Get Balance Sheet
exports.getBalanceSheet = async (req, res, next) => {
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
    logger.error('Balance Sheet error:', error);
    next(error);
  }
};

// Get Income Statement
exports.getIncomeStatement = async (req, res, next) => {
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
    logger.error('Income Statement error:', error);
    next(error);
  }
};
