// middleware/requestValidator.js
const { validationResult } = require('express-validator');

/**
 * Global validation middleware for express-validator
 * This checks for validation errors from any validation chain
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  
  next();
};

module.exports = validateRequest;
