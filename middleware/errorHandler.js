// Centralized error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = {};
    
    for (const field in err.errors) {
      errors[field] = err.errors[field].message;
    }
    
    return res.status(400).json({ 
      message: 'Validation error', 
      errors 
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ message: 'Invalid token' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ message: 'Token expired' });
  }

  // Default to 500 server error
  res.status(err.statusCode || 500).json({
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
  });
};

module.exports = errorHandler;
