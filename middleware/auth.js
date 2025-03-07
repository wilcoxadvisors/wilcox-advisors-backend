// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/user');

// Basic authentication middleware for JWT tokens in Authorization header
exports.auth = (req, res, next) => {
  // Get token from header
  const authHeader = req.headers.authorization;
  
  // Check if not token
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    // Verify token
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Add user from payload
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Admin authentication middleware
exports.adminAuth = async (req, res, next) => {
  try {
    // First use the auth middleware to verify the token
    exports.auth(req, res, async () => {
      // After token verification, check if user is admin
      const user = await User.findById(req.user.id);
      
      if (!user || !user.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }
      
      next();
    });
  } catch (error) {
    return res.status(401).json({ message: 'Authentication failed' });
  }
};
