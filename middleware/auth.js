const jwt = require('jsonwebtoken');
const User = require('../models/user');

// Basic authentication middleware
exports.auth = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token && req.method !== 'POST') return res.status(401).json({ message: 'Unauthorized' });
  try {
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    }
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Admin authentication middleware
exports.adminAuth = async (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || !user.isAdmin) return res.status(403).json({ message: 'Admin access required' });
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};
