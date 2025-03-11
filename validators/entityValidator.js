// validators/entityValidator.js
const { body, param } = require('express-validator');
const validateRequest = require('../middleware/requestValidator');

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
  
  // Use centralized validation middleware
  validateRequest
];

// Similar updates for other validation chains
exports.validateUpdateEntity = [
  param('id')
    .isMongoId()
    .withMessage('Invalid entity ID format'),
  body('name')
    .optional()
    .notEmpty()
    .withMessage('Entity name cannot be empty')
    .trim(),
  // other validations...
  validateRequest
];

exports.validateEntityId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid entity ID format'),
  validateRequest
];
