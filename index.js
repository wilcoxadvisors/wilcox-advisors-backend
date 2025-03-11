// index.js - Modular version
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Basic route for testing
app.get('/', (req, res) => {
  res.status(200).json({ message: 'Wilcox Advisors API' });
});

// Import routes module (which loads all route files)
try {
  const routes = require('./routes/index');
  app.use('/api', routes);
  console.log('Routes loaded successfully');
} catch (error) {
  console.error('Failed to load routes:', error.message);
}

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Server error', message: err.message });
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Connect to MongoDB
  if (process.env.MONGO_URI) {
    mongoose.connect(process.env.MONGO_URI)
      .then(() => console.log('MongoDB Connected'))
      .catch(err => console.error('MongoDB Connection Error:', err));
  } else {
    console.error('MONGO_URI environment variable is not set');
  }
});
