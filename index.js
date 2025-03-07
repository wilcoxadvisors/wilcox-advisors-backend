// index.js
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const compression = require('compression');

// Import routes
const authRoutes = require('./routes/auth');
const consultationsRoutes = require('./routes/consultations');
const checklistsRoutes = require('./routes/checklists');
const contactsRoutes = require('./routes/contacts');
const chatRoutes = require('./routes/chat');
const filesRoutes = require('./routes/files');
const accountingRoutes = require('./routes/accounting');
const adminRoutes = require('./routes/admin');
const clientRoutes = require('./routes/client');
const blogRoutes = require('./routes/blog');

// Import middleware
const { auth } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

// Load environment variables
dotenv.config();

// MongoDB Connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

// Create Express app
const app = express();

// Security middleware
app.use(helmet()); // Set security HTTP headers

// Rate limiting
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 10 minutes'
});
app.use('/api/auth', limiter); // Apply rate limiting to auth routes

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(hpp());

// Compression
app.use(compression());

// Enable CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'https://vocal-daffodil-cc98bd.netlify.app',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  // Create a write stream for access logs
  const accessLogStream = fs.createWriteStream(
    path.join(__dirname, 'logs', 'access.log'),
    { flags: 'a' }
  );
  app.use(morgan('combined', { stream: accessLogStream }));
}

// Serve static files
app.use('/pdfs', express.static(path.join(__dirname, 'public', 'pdfs')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: process.env.APP_VERSION || '1.0.0'
  });
});

// Auth routes (without CSRF)
app.use('/api/auth', authRoutes);

// Protected API routes
app.use('/api/consultations', consultationsRoutes);
app.use('/api/checklists', checklistsRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/accounting', auth, accountingRoutes);
app.use('/api/admin', auth, adminRoutes);
app.use('/api/client', auth, clientRoutes);
app.use('/api/blog', blogRoutes);

// Handle 404 routes
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'fail',
    message: `Can't find ${req.originalUrl} on this server!`
  });
});

// Global error handler
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 10000;
const server = app.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  logger.error(err.stack);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Connect to database
connectDB();

module.exports = app; // For testing
