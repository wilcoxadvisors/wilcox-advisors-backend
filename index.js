// index.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const connectDB = require('./config/database');
const routes = require('./routes');
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
  origin: process.env.CORS_ORIGIN || 'https://your-frontend-domain.com',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Authorization'],
  credentials: true
}));

// CSRF protection setup - but move it AFTER the routes that don't need CSRF
const csrfProtection = csrf({ 
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' // Important for cross-site requests
  }
});

// CSRF token endpoint - no protection on this route
app.get('/api/csrf-token', (req, res) => {
  // Generate a CSRF token without protection
  const csrfMiddleware = csrf({
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
  });
  
  csrfMiddleware(req, res, () => {
    res.json({ csrfToken: req.csrfToken() });
  });
});

// Serve static files
app.use('/pdfs', express.static(path.join(__dirname, 'public', 'pdfs')));

// Health check endpoint (no CSRF needed)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Then apply CSRF protection to sensitive routes
app.use('/api/login', csrfProtection);
app.use('/api/signup', csrfProtection);
app.use('/api/contact', csrfProtection);
app.use('/api/consultation', csrfProtection);
app.use('/api/accounting/journal-entry', csrfProtection);

// API Routes
app.use('/api', routes);

// Error handling middleware (always last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
