// routes/reports.js
const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { 
  getTrialBalance, 
  getBalanceSheet, 
  getIncomeStatement 
} = require('../controllers/reportController');

// Get Trial Balance endpoint
router.get('/trial-balance', auth, getTrialBalance);

// Get Balance Sheet endpoint
router.get('/balance-sheet', auth, getBalanceSheet);

// Get Income Statement endpoint
router.get('/income-statement', auth, getIncomeStatement);

module.exports = router;
