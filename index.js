// index.js - DEBUG VERSION 2
const express = require('express');

// Create Express app 
const app = express();

// Add JSON parsing middleware
app.use(express.json());

// Basic route for testing
app.get('/', (req, res) => {
  res.status(200).json({ message: 'Basic server running' });
});

try {
  console.log('Environment check:');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('PORT:', process.env.PORT);
  console.log('MONGO_URI set:', !!process.env.MONGO_URI);
  console.log('JWT_SECRET set:', !!process.env.JWT_SECRET);
  console.log('CORS_ORIGIN:', process.env.CORS_ORIGIN);

  // Load modules one by one with more details on errors
  console.log('Loading modules...');
  
  // Core modules
  const cors = require('cors');
  console.log('- cors loaded');
  
  const mongoose = require('mongoose');
  console.log('- mongoose loaded');
  
  const dotenv = require('dotenv');
  console.log('- dotenv loaded');
  dotenv.config();
  console.log('- dotenv config loaded');
  
  const path = require('path');
  console.log('- path loaded');
  
  const fs = require('fs');
  console.log('- fs loaded');
  
  // Try loading error handler
  let errorHandler;
  try {
    errorHandler = require('./middleware/errorHandler');
    console.log('- errorHandler loaded');
  } catch (err) {
    console.error('Error loading errorHandler:', err);
    console.log('Continuing without custom error handler...');
  }

  // Configure CORS
  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  console.log('CORS configured');

  // Check routes one by one
  console.log('Loading routes...');
  
  try {
    const authRoutes = require('./routes/auth');
    app.use('/api/auth', authRoutes);
    console.log('- auth routes loaded');
  } catch (err) {
    console.error('Error loading auth routes:', err);
  }
  
  try {
    const blogRoutes = require('./routes/blog');
    app.use('/api/blog', blogRoutes);
    console.log('- blog routes loaded');
  } catch (err) {
    console.error('Error loading blog routes:', err);
  }
  
  try {
    const consultationsRoutes = require('./routes/consultations');
    app.use('/api/consultations', consultationsRoutes);
    console.log('- consultations routes loaded');
  } catch (err) {
    console.error('Error loading consultations routes:', err);
  }
  
  try {
    const checklistsRoutes = require('./routes/checklists');
    app.use('/api/checklists', checklistsRoutes);
    console.log('- checklists routes loaded');
  } catch (err) {
    console.error('Error loading checklists routes:', err);
  }
  
  try {
    const contactsRoutes = require('./routes/contacts');
    app.use('/api/contacts', contactsRoutes);
    console.log('- contacts routes loaded');
  } catch (err) {
    console.error('Error loading contacts routes:', err);
  }
  
  try {
    const chatRoutes = require('./routes/chat');
    app.use('/api/chat', chatRoutes);
    console.log('- chat routes loaded');
  } catch (err) {
    console.error('Error loading chat routes:', err);
  }
  
  try {
    const filesRoutes = require('./routes/files');
    app.use('/api/files', filesRoutes);
    console.log('- files routes loaded');
  } catch (err) {
    console.error('Error loading files routes:', err);
  }
  
  try {
    const accountingRoutes = require('./routes/accounting');
    app.use('/api/accounting', accountingRoutes);
    console.log('- accounting routes loaded');
  } catch (err) {
    console.error('Error loading accounting routes:', err);
  }
  
  try {
    const adminRoutes = require('./routes/admin');
    app.use('/api/admin', adminRoutes);
    console.log('- admin routes loaded');
  } catch (err) {
    console.error('Error loading admin routes:', err);
  }
  
  try {
    const clientRoutes = require('./routes/client');
    app.use('/api/client', clientRoutes);
    console.log('- client routes loaded');
  } catch (err) {
    console.error('Error loading client routes:', err);
  }
  
  try {
    const entityRoutes = require('./routes/entities');
    app.use('/api/entities', entityRoutes);
    console.log('- entity routes loaded');
  } catch (err) {
    console.error('Error loading entity routes:', err);
  }
  
  try {
    const accountRoutes = require('./routes/accounts');
    app.use('/api/accounts', accountRoutes);
    console.log('- account routes loaded');
  } catch (err) {
    console.error('Error loading account routes:', err);
  }
  
  try {
    const journalEntryRoutes = require('./routes/journalEntries');
    app.use('/api/journal-entries', journalEntryRoutes);
    console.log('- journal entry routes loaded');
  } catch (err) {
    console.error('Error loading journal entry routes:', err);
  }
  
  try {
    const reportRoutes = require('./routes/reports');
    app.use('/api/reports', reportRoutes);
    console.log('- report routes loaded');
  } catch (err) {
    console.error('Error loading report routes:', err);
  }
  
  // Add basic error handler
  app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ 
      error: 'Server error', 
      message: err.message 
    });
  });

  // Start the server
  const PORT = process.env.PORT || 10000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    
    // Try MongoDB connection
    if (process.env.MONGO_URI) {
      console.log('Connecting to MongoDB...');
      mongoose.connect(process.env.MONGO_URI)
        .then(() => console.log('MongoDB Connected'))
        .catch(err => console.error('MongoDB Connection Error:', err));
    } else {
      console.error('MONGO_URI environment variable is not set');
    }
  });

} catch (error) {
  console.error('CRITICAL STARTUP ERROR:');
  console.error(error);
  
  // Start minimal server
  const PORT = process.env.PORT || 10000;
  app.listen(PORT, () => {
    console.log(`Emergency server running on port ${PORT}`);
  });
}
