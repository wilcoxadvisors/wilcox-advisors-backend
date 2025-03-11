// validators/entityValidator.js
const { body, validationResult } = require('express-validator');

// Validation middleware for entity creation
exports.validateEntity = [
  body('name')
    .notEmpty()
    .withMessage('Entity name is required')
    .trim(),
  body('code')
    .notEmpty()
    .withMessage('Entity code is required')
    .trim(),
  body('type')
    .optional()
    .isIn(['Operating', 'Holding', 'Special Purpose', 'Elimination', 'Consolidated'])
    .withMessage('Invalid entity type'),
    
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
