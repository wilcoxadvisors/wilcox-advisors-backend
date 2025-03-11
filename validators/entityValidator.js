// validators/entityValidator.js
const { body, param, validationResult } = require('express-validator');

// Validation middleware for entity creation
exports.validateCreateEntity = [
  body('name')
    .notEmpty()
    .withMessage('Entity name is required')
    .trim(),
  body('code')
    .notEmpty()
    .withMessage('Entity code is required')
    .trim()
    .matches(/^[A-Za-z0-9-_]+$/)
    .withMessage('Entity code can only contain letters, numbers, hyphens and underscores'),
  body('type')
    .optional()
    .isIn(['Operating', 'Holding', 'Special Purpose', 'Elimination', 'Consolidated'])
    .withMessage('Invalid entity type'),
  body('currency')
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be a 3-letter code'),
  
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

// Validation middleware for entity update
exports.validateUpdateEntity = [
  param('id')
    .isMongoId()
    .withMessage('Invalid entity ID format'),
  body('name')
    .optional()
    .notEmpty()
    .withMessage('Entity name cannot be empty')
    .trim(),
  body('type')
    .optional()
    .isIn(['Operating', 'Holding', 'Special Purpose', 'Elimination', 'Consolidated'])
    .withMessage('Invalid entity type'),
  body('currency')
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be a 3-letter code'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  
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

// Validation middleware for entity ID
exports.validateEntityId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid entity ID format'),
  
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
