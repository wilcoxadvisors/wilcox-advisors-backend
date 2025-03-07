const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/user');

const signupValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .custom(async (email) => {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new Error('Email is already in use');
      }
      return true;
    }),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/\d/)
    .withMessage('Password must contain at least one number')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 1 })
];

router.post('/signup', signupValidation, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { email, password } = req.body;
  try {
    const user = new User({ email, password });
    await user.save();
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.cookie('auth_token', token, {
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });
    res.status(201).json({ isAdmin: user.isAdmin });
  } catch (error) {
    next(error);
  }
};

router.post('/signup', signupValidation, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
  }
  next();
}, signupValidation);

router.post('/login', loginValidation, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
  }

  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id, isAdmin: user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie('auth_token', token, {
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });

    // Return the token explicitly for frontend
    res.json({ token, isAdmin: user.isAdmin });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
