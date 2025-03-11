// index.js - DEBUG VERSION
const express = require('express');

// Create Express app right away so we can start even if other modules fail
const app = express();

// Basic route for testing
app.get('/', (req, res) => {
  res.status(200).json({ message: 'Basic server running' });
});

try {
  // Print environment variables (excluding sensitive ones)
  console.log('Environment check:');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('PORT:', process.env.PORT);
  console.log('MONGO_URI set:', !!process.env.MONGO_URI);
  console.log('JWT_SECRET set:', !!process.env.JWT_SECRET);
  console.log('CORS_ORIGIN:', process.env.CORS_ORIGIN);

  // Try loading remaining modules one by one
  console.log('Loading modules...');
  const cors = require('cors');
  console.log('- cors loaded');
  
  const mongoose = require('mongoose');
  console.log('- mongoose loaded');
  
  const dotenv = require('dotenv');
  console.log('- dotenv loaded');
  
  const path = require('path');
  console.log('- path loaded');
  
  const fs = require('fs');
  console.log('- fs loaded');
  
  try {
    const errorHandler = require('./middleware/errorHandler');
    console.log('- errorHandler loaded');
  } catch (err) {
    console.error('Error loading errorHandler:', err.message);
  }

  // Load configurations
  dotenv.config();
  console.log('dotenv config loaded');

  // Configure CORS
  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  console.log('CORS configured');

  // Start the server with basic functionality
  const PORT = process.env.PORT || 10000;
  app.listen(PORT, () => {
    console.log(`Basic server running on port ${PORT}`);
    
    // Try connecting to MongoDB
    if (process.env.MONGO_URI) {
      console.log('Attempting MongoDB connection...');
      mongoose.connect(process.env.MONGO_URI)
        .then(() => console.log('MongoDB Connected'))
        .catch(err => console.error('MongoDB Connection Error:', err.message));
    } else {
      console.error('MONGO_URI environment variable is not set');
    }
  });
} catch (error) {
  console.error('CRITICAL ERROR DURING STARTUP:');
  console.error(error);
  
  // Start a minimal server with error info
  const PORT = process.env.PORT || 10000;
  app.get('/error', (req, res) => {
    res.status(500).json({ 
      error: 'Server startup failed',
      message: error.message,
      stack: error.stack
    });
  });
  
  app.listen(PORT, () => {
    console.log(`Minimal error server running on port ${PORT}`);
  });
}
