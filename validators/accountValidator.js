// validators/accountValidator.js
const { body, validationResult } = require('express-validator');

// Validation middleware for account creation
exports.validateAccount = [
  body('entityId')
    .isMongoId()
    .withMessage('Valid entity ID is required'),
  body('accountNumber')
    .notEmpty()
    .withMessage('Account number is required')
    .trim(),
  body('accountName')
    .notEmpty()
    .withMessage('Account name is required')
    .trim(),
  body('accountType')
    .isIn(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'])
    .withMessage('Valid account type is required'),
    
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
