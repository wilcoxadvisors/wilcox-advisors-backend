// validators/accountValidator.js
const { body, param, validationResult } = require('express-validator');

// Validation middleware for account creation
exports.validateCreateAccount = [
  body('entityId')
    .isMongoId()
    .withMessage('Valid entity ID is required'),
  body('accountNumber')
    .notEmpty()
    .withMessage('Account number is required')
    .trim()
    .matches(/^[0-9]{3,6}$/)
    .withMessage('Account number must be 3-6 digits'),
  body('accountName')
    .notEmpty()
    .withMessage('Account name is required')
    .trim(),
  body('accountType')
    .isIn(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'])
    .withMessage('Valid account type is required'),
  body('subledgerType')
    .optional()
    .isIn(['GL', 'AP', 'AR', 'Payroll', 'Inventory', 'Assets'])
    .withMessage('Valid subledger type is required'),
  body('parentAccount')
    .optional()
    .isMongoId()
    .withMessage('Valid parent account ID required'),
    
  // Validation result middleware
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }
    next();
  }
];

// Validation middleware for account update
exports.validateUpdateAccount = [
  param('id')
    .isMongoId()
    .withMessage('Invalid account ID format'),
  body('accountName')
    .optional()
    .notEmpty()
    .withMessage('Account name cannot be empty')
    .trim(),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('isIntercompany')
    .optional()
    .isBoolean()
    .withMessage('isIntercompany must be a boolean'),
  body('parentAccount')
    .optional()
    .custom(value => {
      if (value === null) return true;
      return /^[0-9a-fA-F]{24}$/.test(value); // Simple MongoDB ObjectId validation
    })
    .withMessage('parentAccount must be a valid MongoDB ID or null'),
    
  // Validation result middleware
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }
    next();
  }
];

// Validation middleware for account ID
exports.validateAccountId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid account ID format'),
  
  // Validation result middleware
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }
    next();
  }
];
