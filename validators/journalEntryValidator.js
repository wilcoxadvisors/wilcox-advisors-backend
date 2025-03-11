// validators/journalEntryValidator.js
const { body, validationResult } = require('express-validator');

// Validation middleware for journal entry creation
exports.validateJournalEntry = [
  body('date')
    .isDate()
    .withMessage('Valid date is required'),
  body('entityId')
    .isMongoId()
    .withMessage('Valid entity ID is required'),
  body('description')
    .notEmpty()
    .withMessage('Description is required')
    .trim(),
  body('entries')
    .isArray({ min: 1 })
    .withMessage('At least one entry is required'),
  body('entries.*.accountId')
    .isMongoId()
    .withMessage('Valid account ID is required'),
  body('entries.*.amount')
    .isFloat({ gt: 0 })
    .withMessage('Amount must be greater than zero'),
  body('entries.*.type')
    .isIn(['debit', 'credit'])
    .withMessage('Type must be either debit or credit'),
    
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
