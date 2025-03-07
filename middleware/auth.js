// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const logger = require('../utils/logger');

/**
 * Authentication Middleware
 * Verifies JWT token from Authorization header and adds user to request
 */
exports.auth = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'Authorization denied. No valid token provided.'
      });
    }

    // Extract the token
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Authorization denied. Token is missing.'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Add user from payload to request
      req.user = decoded;
      
      // Check if token is about to expire (within 30 minutes)
      const tokenExp = new Date(decoded.exp * 1000);
      const now = new Date();
      const timeDiff = tokenExp.getTime() - now.getTime();
      const minutesLeft = Math.floor(timeDiff / 1000 / 60);
      
      // If token is about to expire (less than 30 minutes), refresh it
      if (minutesLeft < 30) {
        // Get user from database to ensure they still exist and their role hasn't changed
        const user = await User.findById(decoded.id).select('-password');
        
        if (user) {
          // Generate a new token
          const newToken = jwt.sign(
            { 
              id: user._id, 
              isAdmin: user.isAdmin,
              email: user.email
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
          );
          
          // Add token to response headers
          res.setHeader('x-auth-token', newToken);
        }
      }
      
      next();
    } catch (error) {
      logger.error(`Token verification error: ${error.message}`);
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          status: 'error',
          message: 'Token has expired. Please log in again.'
        });
      }
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid token. Please log in again.'
        });
      }
      
      return res.status(401).json({
        status: 'error',
        message: 'Token verification failed. Please log in again.'
      });
    }
  } catch (error) {
    logger.error(`Auth middleware error: ${error.message}`);
    return res.status(500).json({
      status: 'error',
      message: 'Server error in authentication.'
    });
  }
};

/**
 * Admin Authorization Middleware
 * Ensures the authenticated user has admin privileges
 */
exports.adminAuth = async (req, res, next) => {
  try {
    // Run the auth middleware first to verify token
    exports.auth(req, res, async () => {
      try {
        // Check if user exists and is an admin
        const user = await User.findById(req.user.id);
        
        if (!user) {
          return res.status(404).json({
            status: 'error',
            message: 'User not found.'
          });
        }
        
        if (!user.isAdmin) {
          logger.warn(`Non-admin user ${user.email} (${user._id}) attempted to access admin route`);
          return res.status(403).json({
            status: 'error',
            message: 'Access denied. Admin privileges required.'
          });
        }
        
        logger.info(`Admin access granted to ${user.email} (${user._id})`);
        next();
      } catch (error) {
        logger.error(`Admin auth error: ${error.message}`);
        return res.status(500).json({
          status: 'error',
          message: 'Server error in admin authorization.'
        });
      }
    });
  } catch (error) {
    logger.error(`Admin middleware error: ${error.message}`);
    return res.status(500).json({
      status: 'error',
      message: 'Server error in authorization.'
    });
  }
};

/**
 * Role-Based Access Control Middleware
 * Ensures the authenticated user has the required role
 * @param {Array} roles - Array of allowed roles
 */
exports.roleAuth = (roles) => {
  return async (req, res, next) => {
    try {
      // Run the auth middleware first to verify token
      exports.auth(req, res, async () => {
        try {
          // Check if user exists
          const user = await User.findById(req.user.id);
          
          if (!user) {
            return res.status(404).json({
              status: 'error',
              message: 'User not found.'
            });
          }
          
          // Check if user has the required role
          if (user.isAdmin) {
            // Admin can access all routes
            next();
          } else if (roles.includes('client')) {
            // User with client role can access this route
            next();
          } else {
            logger.warn(`User ${user.email} (${user._id}) lacks required role for this route`);
            return res.status(403).json({
              status: 'error',
              message: 'Access denied. Required role not found.'
            });
          }
        } catch (error) {
          logger.error(`Role auth error: ${error.message}`);
          return res.status(500).json({
            status: 'error',
            message: 'Server error in role authorization.'
          });
        }
      });
    } catch (error) {
      logger.error(`Role middleware error: ${error.message}`);
      return res.status(500).json({
        status: 'error',
        message: 'Server error in role authorization.'
      });
    }
  };
};
