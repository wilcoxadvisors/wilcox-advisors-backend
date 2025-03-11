// routes/chartOfAccounts.js
const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { 
  getAllChartOfAccounts,
  getChartOfAccountsById,
  createChartOfAccounts,
  createDefaultChartOfAccounts,
  updateChartOfAccounts,
  deleteChartOfAccounts,
  addAccount,
  updateAccount,
  deleteAccount,
  getFSLICategories,
  importAccounts
} = require('../controllers/chartOfAccountsController');
const { auth } = require('../middleware/auth');
const validateRequest = require('../middleware/requestValidator');

/**
 * Base validation for chart of accounts
 */
const chartOfAccountsValidation = [
  body('entityId')
    .isMongoId()
    .withMessage('Valid entity ID is required'),
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .trim(),
  validateRequest
];

/**
 * Base validation for account in chart of accounts
 */
const accountValidation = [
  body('accountNumber')
    .notEmpty()
    .withMessage('Account number is required')
    .trim()
    .matches(/^[0-9A-Za-z-_]{1,20}$/)
    .withMessage('Account number must be 1-20 alphanumeric characters, hyphens, or underscores'),
  body('accountName')
    .notEmpty()
    .withMessage('Account name is required')
    .trim(),
  body('accountType')
    .isIn(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'])
    .withMessage('Valid account type is required'),
  body('fslCategory')
    .notEmpty()
    .withMessage('FSLI category is required')
    .trim(),
  validateRequest
];

/**
 * Routes for chart of accounts
 */

// Get all charts of accounts
router.get('/', auth, getAllChartOfAccounts);

// Get FSLI categories
router.get('/fsli-categories', auth, getFSLICategories);

// Get a single chart of accounts
router.get('/:id', auth, [
  param('id')
    .isMongoId()
    .withMessage('Invalid chart of accounts ID format'),
  validateRequest
], getChartOfAccountsById);

// Create a new chart of accounts
router.post('/', auth, chartOfAccountsValidation, createChartOfAccounts);

// Create a default chart of accounts
router.post('/default', auth, [
  body('entityId')
    .isMongoId()
    .withMessage('Valid entity ID is required'),
  body('name')
    .optional()
    .trim(),
  validateRequest
], createDefaultChartOfAccounts);

// Update a chart of accounts
router.put('/:id', auth, [
  param('id')
    .isMongoId()
    .withMessage('Invalid chart of accounts ID format'),
  body('name')
    .optional()
    .notEmpty()
    .withMessage('Name cannot be empty')
    .trim(),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  validateRequest
], updateChartOfAccounts);

// Delete a chart of accounts
router.delete('/:id', auth, [
  param('id')
    .isMongoId()
    .withMessage('Invalid chart of accounts ID format'),
  validateRequest
], deleteChartOfAccounts);

// Add an account to a chart of accounts
router.post('/:id/accounts', auth, [
  param('id')
    .isMongoId()
    .withMessage('Invalid chart of accounts ID format'),
  ...accountValidation
], addAccount);

// Update an account in a chart of accounts
router.put('/:id/accounts/:accountNumber', auth, [
  param('id')
    .isMongoId()
    .withMessage('Invalid chart of accounts ID format'),
  param('accountNumber')
    .notEmpty()
    .withMessage('Account number is required'),
  validateRequest
], updateAccount);

// Delete an account from a chart of accounts
router.delete('/:id/accounts/:accountNumber', auth, [
  param('id')
    .isMongoId()
    .withMessage('Invalid chart of accounts ID format'),
  param('accountNumber')
    .notEmpty()
    .withMessage('Account number is required'),
  validateRequest
], deleteAccount);

// Import accounts from another chart of accounts
router.post('/:id/import', auth, [
  param('id')
    .isMongoId()
    .withMessage('Invalid chart of accounts ID format'),
  body('sourceChartId')
    .isMongoId()
    .withMessage('Valid source chart ID is required'),
  validateRequest
], importAccounts);

module.exports = router;
