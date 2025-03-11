const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const consultationsRoutes = require('./consultations');
const checklistsRoutes = require('./checklists');
const contactsRoutes = require('./contacts');
const chatRoutes = require('./chat');
const filesRoutes = require('./files');
const accountingRoutes = require('./accounting');
const adminRoutes = require('./admin');
const clientRoutes = require('./client');
const blogRoutes = require('./blog');
const chartOfAccountsRoutes = require('./chartOfAccounts');

// Register routes
router.use('/auth', authRoutes);
router.use('/consultations', consultationsRoutes);
router.use('/checklists', checklistsRoutes);
router.use('/contacts', contactsRoutes);
router.use('/chat', chatRoutes);
router.use('/files', filesRoutes);
router.use('/accounting', accountingRoutes);
router.use('/admin', adminRoutes);
router.use('/client', clientRoutes);
router.use('/blog', blogRoutes);
router.use('/chart-of-accounts', chartOfAccountsRoutes);

module.exports = router;
