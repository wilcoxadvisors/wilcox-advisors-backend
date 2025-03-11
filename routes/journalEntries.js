// routes/journalEntries.js
const express = require('express');
const router = express.Router();
const { 
  getJournalEntries, 
  getJournalEntryById,
  createJournalEntry,
  deleteJournalEntry
} = require('../controllers/journalEntryController');
const { 
  validateJournalEntry,
  validateJournalEntryId
} = require('../validators/journalEntryValidator');
const { auth } = require('../middleware/auth');

// Get all journal entries with filtering
router.get('/', auth, getJournalEntries);

// Get a single journal entry by ID
router.get('/:id', auth, validateJournalEntryId, getJournalEntryById);

// Create a new journal entry
router.post('/', auth, validateJournalEntry, createJournalEntry);

// Delete (reverse) a journal entry
router.delete('/:id', auth, validateJournalEntryId, deleteJournalEntry);

module.exports = router;
