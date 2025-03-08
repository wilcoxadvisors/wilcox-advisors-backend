// routes/auth.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const logger = require('../utils/logger');
const { sendNotificationEmail } = require('../utils/emailService');

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
router.post('/login', [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
], async (req, res, next) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Check if email and password are provided
    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide email and password'
      });
    }

    // Find user by email, explicitly include password
    const user = await User.findOne({ email }).select('+password');
    
    // If user doesn't exist
    if (!user) {
      logger.warn(`Login attempt with invalid email: ${email}`);
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials'
      });
    }

    // Check if account is locked
    if (user.isLocked()) {
      logger.warn(`Attempted login to locked account: ${email}`);
      return res.status(401).json({
        status: 'error',
        message: 'Account is temporarily locked. Please try again later.'
      });
    }

    try {
      // Check if password matches
      const isMatch = await bcrypt.compare(password, user.password);
      
      if (!isMatch) {
        // Record failed login attempt
        await user.failedLogin();
        
        logger.warn(`Failed login attempt for user: ${email}`);
        return res.status(401).json({
          status: 'error',
          message: 'Invalid credentials'
        });
      }

      // Record successful login
      await user.successfulLogin();
      
      // Create JWT token
      const token = jwt.sign(
        { 
          id: user._id, 
          isAdmin: user.isAdmin,
          email: user.email
        },
        process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_production',
        { expiresIn: '24h' }
      );

      // Log successful login
      logger.info(`User logged in: ${user.email} (${user._id})`);

      // Return success response
      res.status(200).json({
        status: 'success',
        message: 'Login successful',
        token,
        isAdmin: user.isAdmin,
        userId: user._id
      });
    } catch (passwordError) {
      logger.error(`Password comparison error: ${passwordError.message}`);
      return res.status(500).json({
        status: 'error',
        message: 'Server error during authentication'
      });
    }
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    next(error);
  }
});

/**
 * @desc    Register user (admin only)
 * @route   POST /api/auth/register
 * @access  Admin
 */
router.post('/register', [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  body('isAdmin')
    .isBoolean()
    .optional()
], async (req, res, next) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password, isAdmin = false } = req.body;

    // Check if user exists
    let user = await User.findOne({ email });
    
    if (user) {
      return res.status(400).json({
        status: 'error',
        message: 'User already exists'
      });
    }

    // Create new user
    user = new User({
      email,
      password, // Will be hashed in pre-save middleware
      isAdmin
    });

    // Save user to database
    await user.save();

    // Send notification email
    try {
      await sendNotificationEmail({
        from: process.env.EMAIL_USER,
        to: process.env.NOTIFICATION_EMAIL,
        subject: 'New User Registration - Wilcox Advisors',
        html: `
          <h2>New User Account Created</h2>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Admin:</strong> ${isAdmin ? 'Yes' : 'No'}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        `
      });
    } catch (emailError) {
      logger.error(`Failed to send registration notification email: ${emailError.message}`);
    }

    logger.info(`New user registered: ${email} (${user._id})`);

    // Return success response
    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      userId: user._id
    });
  } catch (error) {
    logger.error(`Registration error: ${error.message}`);
    next(error);
  }
});

/**
 * @desc    Verify JWT token
 * @route   GET /api/auth/verify
 * @access  Public
 */
router.get('/verify', async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'No token provided'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_production');
      
      // Check if user still exists
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid token - user does not exist'
        });
      }

      // Return success response
      res.status(200).json({
        status: 'success',
        isValid: true,
        user: {
          id: user._id,
          email: user.email,
          isAdmin: user.isAdmin
        }
      });
    } catch (verifyError) {
      // Token invalid or expired
      return res.status(401).json({
        status: 'error',
        message: 'Invalid or expired token',
        isValid: false
      });
    }
  } catch (error) {
    logger.error(`Token verification error: ${error.message}`);
    next(error);
  }
});

/**
 * @desc    Logout user (stateless, just for API completeness)
 * @route   POST /api/auth/logout
 * @access  Public
 */
router.post('/logout', (req, res) => {
  // Since we're using JWT, server-side logout isn't necessary
  // Just return a success response
  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully'
  });
});

module.exports = router;
