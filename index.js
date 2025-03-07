// index.js - Simple version without extra dependencies
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const authRoutes = require('./routes/auth');
const fs = require('fs');

// Load env vars
dotenv.config();

// Create Express app
const app = express();

// Middleware
app.use(express.json());

// Configure CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'https://vocal-daffodil-cc98bd.netlify.app',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Serve static files
app.use('/pdfs', express.static(path.join(__dirname, 'public', 'pdfs')));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// Basic health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);

// Simple error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: err.message || 'Internal Server Error'
  });
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
