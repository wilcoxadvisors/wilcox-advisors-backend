// routes/journalEntries.js
const express = require('express');
const router = express.Router();
const { getJournalEntries, createJournalEntry } = require('../controllers/journalEntryController');
const { validateJournalEntry } = require('../validators/journalEntryValidator');
const { auth } = require('../middleware/auth');

// Routes with middleware
router.get('/', auth, getJournalEntries);
router.post('/', auth, validateJournalEntry, createJournalEntry);

module.exports = router;
