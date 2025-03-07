// index.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/database');
const routes = require('./routes');
const authRoutes = require('./routes/auth');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

// Create Express app
const app = express();

// Middleware setup
app.use(express.json());
app.use(cookieParser());

// Configure CORS properly
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'https://vocal-daffodil-cc98bd.netlify.app',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Serve static files
app.use('/pdfs', express.static(path.join(__dirname, 'public', 'pdfs')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Auth routes (without CSRF)
app.use('/api/auth', authRoutes);

// API Routes (with potential CSRF protection elsewhere)
app.use('/api', routes);

// Error handling middleware (always last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
