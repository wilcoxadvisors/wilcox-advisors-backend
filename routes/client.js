const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Chat = require('../models/chat');
const File = require('../models/file');

// Get client dashboard data
router.get('/dashboard', auth, async (req, res, next) => {
  try {
    // Get client's chat history
    const clientChat = await Chat.find({ 
      userId: req.user.id, 
      isClientChat: true 
    }).sort({ timestamp: -1 });
    
    // Get client's files
    const files = await File.find({ 
      userId: req.user.id 
    }).sort({ timestamp: -1 });
    
    // Mock financial data (to be replaced with real data from GL in future phases)
    const financialData = {
      profitLoss: { 
        revenue: 50000, 
        expenses: 30000, 
        netIncome: 20000 
      }, 
      balanceSheet: { 
        assets: 100000, 
        liabilities: 40000, 
        equity: 60000 
      },
      cashFlow: { 
        labels: ['Jan', 'Feb', 'Mar'], 
        data: [10000, 15000, 12000] 
      },
      reports: ['Sales by Category', 'Expense Breakdown'],
      gl: [{ date: '2025-02-01', description: 'Sales', amount: 5000 }]
    };

    res.json({
      financials: {
        profitLoss: financialData.profitLoss,
        balanceSheet: financialData.balanceSheet
      },
      cashFlow: financialData.cashFlow,
      reports: financialData.reports,
      gl: financialData.gl,
      clientChat,
      files
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
