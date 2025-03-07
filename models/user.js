// models/user.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * User Schema
 * Includes fields for email, password, admin status, and account security
 */
const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false // Don't include password in queries by default
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Pre-save middleware to hash password
 */
UserSchema.pre('save', async function(next) {
  // Only hash the password if it's modified (or new)
  if (!this.isModified('password')) {
    return next();
  }

  try {
    // Generate salt
    const salt = await bcrypt.genSalt(10);
    
    // Hash password with salt
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Method to compare passwords
 * @param {string} candidatePassword - The password to compare
 * @returns {boolean} - Whether the password matches
 */
UserSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    // Use bcrypt to compare the provided password with the stored hash
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error(error);
  }
};

/**
 * Method to generate and hash password reset token
 * @returns {string} - The password reset token
 */
UserSchema.methods.getResetPasswordToken = function() {
  // Generate token
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set expire (10 minutes)
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

/**
 * Method to handle failed login attempts and account locking
 * Increments loginAttempts and locks account after 5 consecutive failed attempts
 */
UserSchema.methods.failedLogin = async function() {
  // Increment login attempts
  this.loginAttempts += 1;
  
  // Lock account if more than 5 consecutive failed attempts
  if (this.loginAttempts >= 5) {
    // Lock for 30 minutes
    this.lockUntil = Date.now() + 30 * 60 * 1000;
  }
  
  await this.save();
};

/**
 * Method to reset login attempts after successful login
 */
UserSchema.methods.successfulLogin = async function() {
  // Reset login attempts and lock
  this.loginAttempts = 0;
  this.lockUntil = undefined;
  this.lastLogin = Date.now();
  
  await this.save();
};

/**
 * Method to check if account is locked
 * @returns {boolean} - Whether the account is currently locked
 */
UserSchema.methods.isLocked = function() {
  // Check if account is locked
  return this.lockUntil && this.lockUntil > Date.now();
};

// Virtual to check if account is locked
UserSchema.virtual('locked').get(function() {
  return this.isLocked();
});

// Create User model from schema
const User = mongoose.model('User', UserSchema);

module.exports = User;
