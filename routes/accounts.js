// routes/accounts.js
const express = require('express');
const router = express.Router();
const { 
  getAccounts, 
  getAccountById, 
  createAccount, 
  updateAccount,
  deleteAccount 
} = require('../controllers/accountController');
const { 
  validateCreateAccount, 
  validateUpdateAccount,
  validateAccountId 
} = require('../validators/accountValidator');
const { auth } = require('../middleware/auth');

// Get all accounts
router.get('/', auth, getAccounts);

// Get account by ID
router.get('/:id', auth, validateAccountId, getAccountById);

// Create new account
router.post('/', auth, validateCreateAccount, createAccount);

// Update account
router.put('/:id', auth, validateUpdateAccount, updateAccount);

// Delete account
router.delete('/:id', auth, validateAccountId, deleteAccount);

module.exports = router;
