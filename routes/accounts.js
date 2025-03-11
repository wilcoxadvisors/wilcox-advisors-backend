// routes/accounts.js
const express = require('express');
const router = express.Router();
const { getAccounts, createAccount } = require('../controllers/accountController');
const { validateAccount } = require('../validators/accountValidator');
const { auth } = require('../middleware/auth');

// Routes with middleware
router.get('/', auth, getAccounts);
router.post('/', auth, validateAccount, createAccount);

module.exports = router;
