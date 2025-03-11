// index.js
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const errorHandler = require('./middleware/errorHandler');

// Load env vars
dotenv.config();

// Import existing routes
const authRoutes = require('./routes/auth');
const blogRoutes = require('./routes/blog');

// Import accounting route modules
const entityRoutes = require('./routes/entities');
const accountRoutes = require('./routes/accounts');
const journalEntryRoutes = require('./routes/journalEntries');
const reportRoutes = require('./routes/reports');

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

// Ensure PDF directory exists
const pdfDir = path.join(__dirname, 'public', 'pdfs');
if (!fs.existsSync(pdfDir)) {
  fs.mkdirSync(pdfDir, { recursive: true });
}

// Serve static files
app.use('/pdfs', express.static(pdfDir));

// Basic health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root route for basic testing
app.get('/', (req, res) => {
  res.status(200).json({ message: 'Wilcox Advisors API is running' });
});

// Existing routes
app.use('/api/auth', authRoutes);
app.use('/api/blog', blogRoutes);

// Accounting routes
app.use('/api/entities', entityRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/journal-entries', journalEntryRoutes);
app.use('/api/reports', reportRoutes);

// Centralized error handling middleware
app.use(errorHandler);

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');
    
    // Start server after successful DB connection
    const PORT = process.env.PORT || 10000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error('MongoDB Connection Error:', err);
    
    // Start server anyway, even without DB connection
    const PORT = process.env.PORT || 10000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} (without database connection)`);
      console.log('Please check your MongoDB connection string and make sure MongoDB Atlas is properly configured');
    });
  }
};

startServer();
