// routes/auth.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/user');

// Login validation middleware
const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 1 })
    .withMessage('Password is required')
];

// User login with validation
router.post('/login', loginValidation, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      message: 'Validation failed', 
      errors: errors.array() 
    });
  }

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token without storing in cookies
    const token = jwt.sign(
      { id: user._id, isAdmin: user.isAdmin }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' }
    );

    // Return token in response
    res.json({ 
      token,
      isAdmin: user.isAdmin,
      message: 'Logged in successfully' 
    });

  } catch (error) {
    next(error);
  }
});

// User logout (stateless - no server-side session)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
